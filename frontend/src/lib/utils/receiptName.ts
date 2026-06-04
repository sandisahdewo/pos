// Receipt name shortening — hybrid Indomaret-style.
//
// Operator can set a manual `printName` per product (cleanest result). When
// empty, we run an algorithm that:
//   1) drops stop-words ("dan", "dengan", ...)
//   2) substitutes common retail words ("goreng" → "grg")
//   3) abbreviates remaining words to 3 chars when the result is still too long
//   4) hard-truncates with ellipsis as the last resort
//
// Receipt width is 74mm — at the current 11px font, ~16 char fits comfortably
// next to qty + subtotal columns. Tune via MAX_RECEIPT_NAME_LEN.

export const MAX_RECEIPT_NAME_LEN = 18;

// Words that add no info on a struk and can be dropped entirely.
const STOP_WORDS = new Set([
  'dan',
  'dengan',
  'dari',
  'untuk',
  'atau',
  'pada',
  'di',
  'ke'
]);

// Common Indonesian retail abbreviations — Indomaret-style aliasing.
// Keep the dictionary tight; favour additions when a real product becomes
// awkward on the struk, not preemptively.
const ABBREVIATIONS: Record<string, string> = {
  goreng: 'grg',
  spesial: 'spc',
  special: 'spc',
  manis: 'mns',
  coklat: 'cklt',
  cokelat: 'cklt',
  kemasan: 'kms',
  sambal: 'smb',
  rasa: 'r',
  kotak: 'ktk',
  botol: 'btl',
  sachet: 'sch',
  bungkus: 'bks',
  isi: 'is',
  ekstra: 'ext',
  extra: 'ext',
  jumbo: 'jmb',
  premium: 'prm',
  reguler: 'reg',
  regular: 'reg',
  original: 'ori',
  daging: 'dag',
  sapi: 'sp',
  ayam: 'aym',
  telur: 'tlr',
  susu: 'ss',
  kopi: 'kpi',
  teh: 'teh',
  beras: 'brs',
  minyak: 'mnk',
  gula: 'gl',
  tepung: 'tpg',
  cincang: 'cnc'
};

const TRAILING_DIGIT_UNIT_RE = /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|gr|gram|pcs|pc|cm|mm)?$/i;

// Tokens that look like sizes ("85g", "250ml", "1L") stay intact — they carry
// real information the operator needs to confirm SKU.
function isSizeToken(token: string): boolean {
  return TRAILING_DIGIT_UNIT_RE.test(token);
}

function abbreviateWord(word: string): string {
  if (word.length <= 3) return word;
  if (isSizeToken(word)) return word;

  // Trailing digits like "Yakult40" → keep digits, abbreviate alpha prefix
  const m = word.match(/^([A-Za-z]+)(\d.*)$/);
  if (m) return m[1].slice(0, 3) + m[2];

  return word.slice(0, 3);
}

// Map a word through dictionary first (case-insensitive), preserving the
// input's original capitalisation pattern (Title vs lower vs UPPER).
function applyDictionary(word: string): string {
  const lower = word.toLowerCase();
  const repl = ABBREVIATIONS[lower];
  if (!repl) return word;
  // Preserve case style.
  if (word === word.toUpperCase()) return repl.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}

/**
 * Shorten a product name to fit a thermal receipt line.
 * Pure function — deterministic, no side effects.
 */
export function shortenForReceipt(name: string, max: number = MAX_RECEIPT_NAME_LEN): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;

  // Pass 1: dictionary substitution + stop-word removal.
  const tokens = trimmed.split(' ');
  const pass1 = tokens
    .filter((t) => !STOP_WORDS.has(t.toLowerCase()))
    .map(applyDictionary);
  const joined1 = pass1.join(' ');
  if (joined1.length <= max) return joined1;

  // Pass 2: word-level abbreviation (size tokens preserved).
  const pass2 = pass1.map(abbreviateWord);
  const joined2 = pass2.join(' ');
  if (joined2.length <= max) return joined2;

  // Pass 3: still too long — hard truncate with ellipsis.
  return joined2.slice(0, max - 1) + '…';
}

/**
 * Compose the receipt display name for a sold line.
 *
 * Priority (highest wins):
 *   1. `variantPrintName` — operator's complete alias for this exact variant
 *      (e.g. "IDM GRG 85G"). Used as-is, treated as the full receipt name.
 *   2. `productPrintName` + variantName — operator's product-level alias
 *      combined with the variant's display name; variant portion is shortened
 *      algorithmically if total overflows.
 *   3. No alias — full algorithmic shorten of `productName + variantName`.
 */
export function displayLineName(args: {
  productName: string;
  variantName?: string;
  productPrintName?: string;
  variantPrintName?: string;
  max?: number;
}): string {
  const max = args.max ?? MAX_RECEIPT_NAME_LEN;
  const vpn = args.variantPrintName?.trim();
  const ppn = args.productPrintName?.trim();
  const variant = args.variantName?.trim();

  // 1. Variant-level alias is the full receipt name for this SKU.
  if (vpn) {
    return vpn.length <= max ? vpn : vpn.slice(0, max - 1) + '…';
  }

  // 2. Product-level alias + variant suffix (variant shortened if needed).
  if (ppn) {
    if (!variant) {
      return ppn.length <= max ? ppn : ppn.slice(0, max - 1) + '…';
    }
    const full = `${ppn} ${variant}`;
    if (full.length <= max) return full;
    const budget = max - ppn.length - 1;
    if (budget < 3) {
      return full.slice(0, max - 1) + '…';
    }
    const v = variant.length <= budget ? variant : shortenForReceipt(variant, budget);
    return `${ppn} ${v}`;
  }

  // 3. No alias — algorithmic shorten across the whole thing.
  const full = variant ? `${args.productName} ${variant}` : args.productName;
  return shortenForReceipt(full, max);
}
