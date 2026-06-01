export const RUPIAH_LOCALE = 'id-ID';
export const RUPIAH_CURRENCY = 'IDR';

const rupiahFormatter = new Intl.NumberFormat(RUPIAH_LOCALE, {
  style: 'currency',
  currency: RUPIAH_CURRENCY,
  maximumFractionDigits: 0
});

const rupiahNumberFormatter = new Intl.NumberFormat(RUPIAH_LOCALE, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});

export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return rupiahFormatter.format(value);
}

export function formatRupiahNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return rupiahNumberFormatter.format(value);
}

export function parseRupiahNumber(input: string): number {
  const cleaned = input.replace(/[^\d]/g, '');
  if (cleaned === '') return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}
