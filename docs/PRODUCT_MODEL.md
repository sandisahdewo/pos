# Master Product Model

This document captures the design decisions, data model, and conventions for the **product master** in this POS scaffold. The goal is to give a future maintainer — human or AI agent — enough context to extend the system without re-deriving the rationale.

> **Status:** scaffold, frontend-only. No backend yet; all data is in-memory `$state` and resets on reload.
> **Terakhir diupdate:** 2026-05-27 (sesi lanjutan: **Reorder kartu untuk komposit** — Bahan / Isi paket sekarang muncul sebelum Harga & Stok supaya biaya efektif sudah terhitung dari bahan saat operator atur harga; kartu Bahan selalu render untuk komposit (bukan cuma saat ada bahan) dengan empty state "Tambah komponen pertama"; chip "Tambah komponen (resep)" dihapus dari opt-in chips Harga & Stok karena kartu Bahan sudah jadi entry point natural. **`CompositeComponent` dapat `unitId?` + `unitFactor?`** — bahan boleh dispesifikasi dalam satuan kemasan produk komponen (mis. "1 ekor ayam" alih-alih "8 pcs"). Helper `componentBaseQty(c)` exported, dipakai di semua callsite: `componentsCost` & `componentsProducible` di store; `deductComponents` di `orders.svelte.ts`; `productionRuns` planner (perOutput + required + bottleneck); `recipeFormCost` & `variantEffectiveCost` & `producibleFormStock` di ProductForm; component cost approximation di `PriceAdjustmentModal`. **UI Satuan picker** ditambah di tiga tempat: kartu Bahan level-produk, sub-section "Resep" per-varian (kartu Varian), dan sub-section "Bahan yang dipotong" di kartu Ekstra — Select muncul cuma kalau produk komponen punya minimal 1 kemasan tambahan; hint konversi "1 ekor = 8 pcs" muncul saat factor ≠ 1; reset `unitId`+`unitFactor` saat ganti produk komponen. Helper baru di form: `componentUnitOptionsFor(productId)` + `onComponentUnitChange(comp, value)` dengan encoding `${unitId}|${factor}` mirror PO line. **Tooltip kontekstual field "Satuan"** di kartu Harga & Stok — switch berdasarkan `form.kind`: untuk goods jelaskan satuan dasar jual + arah ke Satuan Kemasan; untuk composite jelaskan satuan output (porsi, paket, pcs, potong) dan bedanya dari satuan bahan. **Tips inline `<details>` di kartu Varian** — collapsible biru muda "💡 Kapan pakai varian vs pisah jadi produk baru?" dengan tiga blok kriteria + contoh + catatan keterbatasan varian × kemasan (kemasan & harga lusinannya shared lintas varian; workaround: jadikan varian atau pisah produk). Sebelumnya hari ini: Komponen `Tooltip` baru + prop `tooltip?: string` di `Input`, `Select`, dan `MoneyInput` — ikon `?` muncul di samping label dengan popup penjelasan; banyak label/hint di `ProductForm` direvisi jadi bahasa sehari-hari (Jenis produk, Cara penyiapan, Acuan biaya untuk hitung harga jual, Bahan / Isi paket, Pilihan variasi, Ekstra / tambahan opsional, Harga tambahan, Pengelompokan, dll.); opsi `pricingKindOptions` diterjemahkan ke Indonesia (`Harga tetap` / `Biaya + nominal` / `Persen untung`); opsi `productKindOptions`, `markupCostSourceOptions`, dan `productionModeOptions` ditulis ulang pakai contoh konkret tanpa jargon (FIFO, composite, fallback) — `Komposit` di-display sebagai `Resep / Paket`, `Saya atur sendiri` ↔ `Harga beli stok yang sedang dijual` ↔ `Rata-rata harga beli semua stok`, `Hanya dari produksi` jadi `Wajib disiapkan dulu`; status produk dan beberapa opsi sundry (`Active`/`Archived`/`No default supplier`/`lead Nh`) ikut diterjemahkan. **Entitas Brand baru** (`src/lib/stores/brands.svelte.ts` + route `/brands` CRUD modal + ikon `Bookmark` di sidebar + permission `menu.brands`) — `Product.brandId?: string` opsional, ada filter & display brand di `/products` list. **Sistem Tag** (`src/lib/stores/tags.svelte.ts` + route `/tags` + ikon `Sparkles` + permission `menu.tags`) — `Product.tags?: string[]` (simpan nama, lookup warna lewat `tags.getByName()`); `ChipInput` di-extend dengan prop `suggestions: string[]` yang menampilkan dropdown autocomplete saat input fokus, filter case-insensitive, exclude yang sudah dipilih, dengan toleransi enter free-form (auto-create); badge tag tampil di `/products` name column. **Prebuilt custom fields** di `Product` — `bpomNumber?`, `halalCertNumber?`, `warrantyMonths?`, plus `metadata?: Record<string, string>` bebas key-value; semua disurface di kartu "Info tambahan" sidebar form (Collapsible, auto-buka kalau ada data). **Kategori hierarkis** — `Category.parentId?: string` + helper `path(id)` / `descendantsOf(id)` / `isAncestorOf(ancestorId, descendantId)`; `taxRateFor()` di-update untuk walk parent chain ASC sampai root (sub-kategori bisa inherit pajak dari induk); category form punya Select "Kategori induk" yang otomatis exclude self + descendants untuk cegah siklus; filter kategori di `/products` include semua descendants; **tree view di `/categories`** — Table di-render dalam DFS dengan indent per-depth + chevron expand/collapse, mode search otomatis flatten + tampilkan breadcrumb subtitle, kolom Produk menunjukkan jumlah deep (termasuk sub-kategori) plus selisih "(N langsung)" kalau beda. **MOQ supplier-side** — `ProductSupplier.minOrderQty?: number` (opsional, satuan dasar produk) + input di kartu pemasok form produk + warning amber di line PO kalau qty < MOQ. Lihat section **Fitur baru (dibangun 2026-05-27)** di Part I. Sebelumnya 2026-05-26: source-aware cost preview di ProductForm (`effectiveFormCost` / `variantEffectiveCost` rute lewat `costFromSource(form.markupCostSource, …)`), `costFromSource` di-export + pakai `manualFallback` konsisten untuk semua source termasuk `batch-avg`; UI Harga & Stok dirapikan (Sumber biaya di atas Biaya beli, label kontekstual Biaya beli ↔ Biaya awal, preview "Biaya saat ini" saat batch override, banner amber saat cost=0 dengan markup pricing); helper `pricingMode(p)` + badge `Statis`/`Markup manual`/`Ikut PO`/`Campur` di `/products`; `Product.barcode?: string` untuk barcode base unit; `resolveScanToken` priority chain 6-langkah (variant.barcode → packaging.barcode → product.barcode → SKU → variant.sku → batch.code) yang nge-set unitId+factor di cart line saat packaging match; helper `findBarcodeOwner()` + `validateBarcodes` untuk uniqueness lintas katalog; keputusan: packaging **tetap tanpa SKU**. Sebelumnya 2026-05-22: shelf label + production model + `markupCostSource` + bulk price adjustment + `/pengaturan-harga` Pantauan Margin. Sebelumnya 2026-05-15: Tax rates, Suppliers, Product images, Purchase Orders, Composite products, batch-based stock, Payouts, Locations, StockMovement + StockOpname.

## Table of contents

1. [Context](#context)
2. [The five dimensions of variation](#the-five-dimensions-of-variation)
3. [Data model](#data-model)
4. [Key decisions and why](#key-decisions-and-why)
5. [Form UX principles](#form-ux-principles)
6. [File map](#file-map)
7. [Helpers quick reference](#helpers-quick-reference)
8. [Conventions when extending](#conventions-when-extending)
9. [What's intentionally deferred](#whats-intentionally-deferred)
10. [Glossary](#glossary)

---

## Context

`/home/sandi/code/pos` is a SvelteKit 2 + Svelte 5 (runes) admin app for a Point-of-Sale system. The stack:

- SvelteKit 2 / Svelte 5 with `$state` / `$derived` / `$props` / `$bindable` / `$effect`
- Tailwind CSS v4 (CSS-first config in `src/app.css`, brand palette + tokens)
- `lucide-svelte` icons
- TypeScript
- `@sveltejs/adapter-auto`

Currently shipped: **Master Data** routes (Employees, Categories, Units, Pricelists, Tax rates, Products, Suppliers, Customers), **Sales** routes (POS with scan-to-sell, Orders), **Procurement** routes (Purchase Orders with partial receipts + expiration capture, Payouts), and **Inventory** (`/inventory` with Stock Adjustment + Batches view + per-batch label print + bulk PO label print at `/inventory/po/[poId]/labels`). Still 404: Dashboard widgets (data), Reports, Settings.

This doc focuses on the **Product** master because its model is significantly richer than the other resources.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`/home/sandi/code/pos` adalah admin app SvelteKit 2 + Svelte 5 (runes) untuk sistem Point-of-Sale. Stack-nya: SvelteKit 2 / Svelte 5 (runes — `$state` / `$derived` / `$props` / `$bindable` / `$effect`), Tailwind CSS v4 (config CSS-first di `src/app.css`), `lucide-svelte` untuk ikon, TypeScript, dan `@sveltejs/adapter-auto`.

Yang sudah jadi: **Data Master** (Karyawan, Kategori, Satuan, Pricelist, Tarif Pajak, Produk, Pemasok, Pelanggan), **Penjualan** (POS dengan scan-to-sell, Pesanan), **Pengadaan** (Purchase Order dengan partial receipt + tangkap kedaluwarsa, Payouts), dan **Inventaris** (`/inventory` dengan Atur Stok + tampilan Batch + cetak label per batch + cetak label massal per PO di `/inventory/po/[poId]/labels`). Yang masih 404: widget Dashboard (data), Laporan, Settings.

Dokumen ini fokus ke master **Produk** karena modelnya jauh lebih kaya dibanding resource lainnya.

</details>

---

## The five dimensions of variation

A Product can vary along several orthogonal axes, but with a **kind discriminator** (`'goods' | 'composite'`) that gates which combinations make sense:

| Dimension | Example | Lives on | Goods | Composite |
|---|---|---|---|---|
| **Customer tier** | Retail Rp 8.000 / Wholesale Rp 7.000 | `Product.prices: PricelistEntry[]` | ✓ | ✓ |
| **Quantity** | Buy 24+ for Rp 6.500 | `PricelistEntry.tiers: PricingTier[]` | ✓ | ✓ |
| **Packaging** | 1 pc / 6-pack / case of 24 | `Product.units: ProductPackaging[]` | ✓ | — |
| **Variant** | Red/S, Red/M, Blue/L | `Product.variants: ProductVariant[]` | ✓ | ✓ (with per-variant recipe) |
| **Pricing strategy** | Fixed, markup+amount, markup% | `PricelistEntry.pricing: PricingStrategy` | ✓ | ✓ |
| **Components (recipe / bundle)** | Combo = 1 espresso + 1 croissant | `Product.components: CompositeComponent[]` + per-variant | — | ✓ |
| **Extras / modifiers** | Extra cheese, extra sauce | `Product.extras: ProductExtra[]` | ✓ | ✓ |

Most products only use one or two dimensions. The form is designed so simple products see only the essentials and complex products opt into more, with the kind selector at the top of Basics filtering which feature chips appear.

**Tax** is orthogonal to pricing — it's applied on top of the computed sale price. Tax rate is resolved through a fallback chain: `Product.taxRateId` (optional override) → walk `Category` parent chain from the product's category up to root, returning the first ancestor with a `taxRateId` (sub-categories inherit from parent without having to repeat the field) → global default `TaxRate.isDefault`. See [Tax](#tax) below.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Sebuah Produk bisa bervariasi di beberapa sumbu yang ortogonal, dengan diskriminator `kind` (`'goods' | 'composite'`) yang menentukan kombinasi mana yang relevan:

| Dimensi | Contoh | Disimpan di | Goods | Composite |
|---|---|---|---|---|
| **Tier pelanggan** | Retail Rp 8.000 / Grosir Rp 7.000 | `Product.prices: PricelistEntry[]` | ✓ | ✓ |
| **Kuantitas** | Beli 24+ jadi Rp 6.500 | `PricelistEntry.tiers: PricingTier[]` | ✓ | ✓ |
| **Packaging** | 1 pcs / 6-pak / dus 24 | `Product.units: ProductPackaging[]` | ✓ | — |
| **Varian** | Merah/S, Merah/M, Biru/L | `Product.variants: ProductVariant[]` | ✓ | ✓ (dengan recipe per varian) |
| **Strategi harga** | Tetap, markup+nominal, markup% | `PricelistEntry.pricing: PricingStrategy` | ✓ | ✓ |
| **Komponen (recipe / bundle)** | Combo = 1 espresso + 1 croissant | `Product.components: CompositeComponent[]` + per varian | — | ✓ |
| **Extras / modifier** | Extra keju, extra sambal | `Product.extras: ProductExtra[]` | ✓ | ✓ |

Mayoritas produk hanya pakai satu atau dua dimensi. Form dirancang supaya produk sederhana cuma lihat yang esensial, dan produk kompleks opt-in ke fitur tambahan. Selektor `kind` di atas Basics memfilter chip fitur mana yang muncul.

**Pajak** ortogonal terhadap pricing — dihitung di atas harga jual yang sudah dihitung. Tarif pajak diresolusi via fallback chain: `Product.taxRateId` (override opsional) → walk parent chain `Category` dari kategori produk naik sampai root, return tax pertama yang ada (sub-kategori bisa inherit dari induk tanpa harus repeat field) → default global `TaxRate.isDefault`. Lihat [Tax](#tax) di bawah.

</details>

---

## Data model

All types live in `src/lib/stores/products.svelte.ts`.

### `Product`

```ts
type ProductKind = 'goods' | 'composite';

type Product = {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;                              // discriminator — drives form gating
  categoryId: string;             // FK -> categories store
  unitId: string;                 // FK -> units store (base unit, e.g. "pcs")
  cost: number;                   // IDR per base unit; bootstrap value, not auto-updated by POs (see CONSIGNMENT.md)
  prices: PricelistEntry[];       // sale pricing per pricelist
  // stock is no longer a scalar field. Live stock is `stockOf(product.id)` summed
  // over matching `Batch` rows (see src/lib/stores/batches.svelte.ts).
  status: 'active' | 'archived';
  description: string;
  taxRateId?: string;             // override opsional; inherit dari kategori (walk chain ke induk) kalau kosong
  defaultSupplierId?: string;     // pemasok utama; autofill saat buat PO baru (legacy field, sekarang dipakai bareng suppliers[])
  brandId?: string;               // FK opsional ke brands store; tampil sebagai filter & badge di /products
  tags?: string[];                // nama-nama tag (default kosong); lookup warna & visibilitas via tags.getByName()
  imageUrl: string;               // URL atau string kosong; upload masih ditunda sampai backend siap
  barcode?: string;               // barcode untuk base unit (UPC/EAN/GTIN); satu-satunya tempat untuk produk simple
  units: ProductPackaging[];      // kemasan tambahan (base unit tetap di `unitId`)
  attributes: ProductAttribute[]; // template opsi untuk generator varian
  variants: ProductVariant[];
  components: CompositeComponent[]; // resep level-produk (dipakai saat tidak ada varian)
  extras: ProductExtra[];           // tambahan opsional saat penjualan (saus, topping, gift wrap)
  requiresBatchLabel?: boolean;     // cetak label thermal per batch yang diterima (perishable, lot-tracked)
  requiresExpiration?: boolean;     // wajib isi tanggal kedaluwarsa di setiap batch; FIFO walk expiresAt ASC
  // Info regulated / garansi — opsional, hanya dipakai untuk kategori yang
  // butuh (kosmetik, makanan, obat) atau barang elektronik.
  bpomNumber?: string;            // nomor izin edar BPOM (mis. "POM NA 18101200123")
  halalCertNumber?: string;       // nomor sertifikat MUI Halal
  warrantyMonths?: number;        // masa garansi dalam bulan (untuk elektronik / peralatan)
  // Catatan key-value bebas untuk apa pun yang tidak punya struktur khusus —
  // mis. kandungan, ukuran botol, nama produsen, dll.
  metadata?: Record<string, string>;
};
```

`barcode?` adalah barcode untuk **base unit** (per pcs / per botol / per kaleng). Untuk produk simple ini satu-satunya tempat. Untuk produk dengan kemasan, ini barcode kaleng/botol — dus/karton pakai `pack.barcode` sendiri. Untuk produk varian biasanya kosong (`variant.barcode` yang jadi sumber); kalau diisi, jadi parent GTIN yang auto-pilih varian pertama saat di-scan. Scan resolver mengecek barcode paling spesifik dulu: variant → packaging → product → SKU → batch. Detail lengkap di section **2026-05-26**.

`brandId?` opsional — tidak setiap produk perlu brand (jasa, makanan in-house, dll. boleh kosong). Filter & badge brand tampil di `/products` list, plus `countByBrand()` untuk count produk per brand di route `/brands`.

`tags?: string[]` menyimpan nama tag (bukan ID) supaya gampang dibaca di JSON dump dan robust kalau tag di-rename di store registry. Style/visibility tag tetap ada di `tags.svelte.ts` — lookup via `tags.getByName(name)`. Operator boleh ketik nama tag yang belum terdaftar (free-form) — tag bakal muncul di chip + di `/products` badge dengan warna neutral.

Custom field — `bpomNumber`, `halalCertNumber`, `warrantyMonths`, dan `metadata` — semuanya opsional dan disurface di kartu "Info tambahan" sidebar form (Collapsible). Tidak ada custom field framework full (per-category scoping, dynamic defs) — keputusannya: mulai dengan prebuilt fields yang paling umum, tambahkan `metadata` sebagai escape hatch key-value untuk yang lain. Custom field framework lengkap di-defer.

Tidak ada flag `advanced`. Pakai `isAdvanced(p)` yang dihitung dari `units.length || variants.length || attributes.length`.

Field lain yang penting:

- `cost` = nilai bootstrap per base unit (IDR); tidak otomatis ter-update oleh PO — lihat [CONSIGNMENT.md](./CONSIGNMENT.md).
- Stock bukan field skalar lagi. Stock live = `stockOf(product.id)` yang dijumlahkan dari batch yang cocok (lihat `src/lib/stores/batches.svelte.ts`).
- `taxRateId?` = override opsional; kalau kosong, `taxRateFor()` walk parent chain kategori sampai root, baru fallback ke `taxRates.default()`.
- `requiresBatchLabel?` → cetak label thermal per batch yang diterima (untuk perishable, item lot-tracked).
- `requiresExpiration?` → tangkap tanggal kedaluwarsa di tiap batch; FIFO berjalan via `expiresAt` ASC.
- `markupCostSource?` (legacy default `'manual'`) → menentukan cost yang dipakai math markup; lihat section 2026-05-22 untuk detail.

### `PricingStrategy`, `PricelistEntry`, `PricingTier`

```ts
type PricingStrategy =
  | { kind: 'fixed'; value: number }          // sale = value
  | { kind: 'markup_amount'; value: number }  // sale = cost + value
  | { kind: 'markup_pct'; value: number };    // sale = cost × (1 + value/100)

type PricingTier = {
  minQty: number;
  pricing: PricingStrategy;
};

type PricelistEntry = {
  pricelistId: string;       // FK -> pricelists store
  pricing: PricingStrategy;  // base price (qty < smallest minQty)
  tiers: PricingTier[];      // ordered by ascending minQty; highest matching minQty wins
};
```

**Sale price is never stored.** Always compute via `computeSalePrice(cost, strategy)` or `priceForQty(entry, qty, cost)`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Ada tiga `PricingStrategy`: `fixed` (sale = value), `markup_amount` (sale = cost + value), dan `markup_pct` (sale = cost × (1 + value/100)). `PricingTier` punya `minQty` + `pricing`; `PricelistEntry` membungkus base pricing dan tiers (terurut ascending `minQty`, tier yang `minQty` paling besar yang masih cocok dengan qty menang).

**Harga jual tidak pernah disimpan.** Selalu dihitung via `computeSalePrice(cost, strategy)` atau `priceForQty(entry, qty, cost)`.

</details>

### `ProductVariant`

```ts
type ProductVariant = {
  id: string;                      // uuid
  name: string;                    // display, e.g., "Red / Large"
  sku: string;
  cost: number;                    // own cost (used when components are empty); bootstrap value, not auto-updated by POs
  prices: PricelistEntry[];        // own pricing per pricelist
  // stock is derived from batches keyed by (productId, variantId).
  // Call `stockOf(productId, v.id)` to read it.
  barcode: string;
  values: Record<string, string>;  // {Color: "Red", Size: "Large"} — links to attributes
  imageUrl: string;                // URL or empty string
  components: CompositeComponent[]; // per-variant recipe (for composite kind only)
};
```

`values` is the structural key for the variant generator. Empty `values: {}` = manually-added variant; generated variants have a key per active attribute.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tiap varian punya `cost`, `prices`, `barcode`, `imageUrl`, dan `components` (recipe per varian untuk komposit) sendiri. Stock varian dihitung dari batch yang di-key dengan `(productId, variantId)` — panggil `stockOf(productId, v.id)`. `cost` adalah nilai bootstrap, bukan auto-update dari PO.

`values` adalah kunci struktural untuk generator varian. `values: {}` kosong = varian ditambah manual; varian hasil generate punya satu kunci per attribute yang aktif.

</details>

### `ProductPackaging`

```ts
type ProductPackaging = {
  unitId: string;              // e.g., "box"
  factor: number;              // how many base units this contains; e.g., 24
  prices: PricelistEntry[];
  barcode: string;
};
```

A packaging's effective cost is `factor × product.cost`. The base unit (`pcs`) is **not** repeated in `units[]`; it lives on `product.unitId`.

**No `sku` field — by design.** A packaging isn't a separate stock-keeping entity; it's a way to *count and price* the same underlying stock. Selling "1 dus Cola" depletes 24 pcs from the same base-unit pool that "1 pcs Cola" depletes from — there's only one Cola inventory. The `(product, unitId, factor)` tuple already identifies the packaging uniquely, `pack.barcode` covers POS scan, and `lineUnitId + unitFactor` on PO/Order lines covers procurement. Add a packaging-level SKU only if a concrete need surfaces: supplier catalog mapping per-packaging (current `ProductSupplier.supplierSku` is one-per-(product, supplier), a known limitation), or external accounting that requires a code per packing form.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Cost efektif sebuah packaging = `factor × product.cost`. Base unit (`pcs`) **tidak** diulang di `units[]`; tempatnya di `product.unitId`.

**Tidak ada field `sku` — disengaja.** Packaging bukan entitas stok terpisah; cuma cara *menghitung dan menghargai* stok yang sama. Menjual "1 dus Cola" memotong 24 pcs dari kolam base-unit yang sama yang dipotong oleh "1 pcs Cola" — hanya ada satu inventaris Cola. Tuple `(product, unitId, factor)` sudah mengidentifikasi packaging secara unik, `pack.barcode` menutupi scan kasir, dan `lineUnitId + unitFactor` di line PO/Order menutupi pengadaan. SKU level-packaging hanya ditambahkan jika muncul kebutuhan konkret: mapping katalog supplier per-packaging (`ProductSupplier.supplierSku` saat ini satu-per-(produk, supplier), keterbatasan yang sudah diketahui), atau akuntansi eksternal yang require kode per packing form.

</details>

### `ProductAttribute`

```ts
type ProductAttribute = {
  id: string;
  name: string;        // e.g., "Color"
  values: string[];    // e.g., ["Red", "Green", "Blue"]
};
```

Drives the variant generator. `generateVariants(attrs, defaults)` returns the Cartesian product; `regenerateVariants(attrs, existing, defaults)` preserves edits on combos that still exist and drops orphans.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Menggerakkan generator varian. `generateVariants(attrs, defaults)` mengembalikan Cartesian product; `regenerateVariants(attrs, existing, defaults)` mempertahankan edit pada kombinasi yang masih ada dan membuang yang yatim (orphan).

</details>

### `CompositeComponent`

```ts
type CompositeComponent = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;     // dalam satuan yang dipilih operator (unitId)
  // Pemilih kemasan opsional. Saat operator ingin tulis resep dalam satuan
  // non-base (mis. "1 ekor ayam" alih-alih "8 potong"), pilih kemasan produk
  // komponen di sini. Math stok, biaya, dan konsumsi semuanya kalikan ke base
  // via `unitFactor`. Default: unitId = base unit produk komponen, factor = 1.
  unitId?: string;
  unitFactor?: number;
};

// Helper exported untuk konversi qty → base unit. Dipakai semua tempat yang
// hitung biaya, ketersediaan stok, dan konsumsi (order, production run).
export function componentBaseQty(c: CompositeComponent): number;
```

Sebuah produk adalah **komposit** (bundle atau recipe/BOM) kalau `components.length > 0`. Satu model menutup dua kasus:

- **Bundle**: "Combo Kopi & Croissant" — komponennya juga dijual satuan.
- **BOM / manufactured**: "Mie Tek-Tek = mie + telur + mayo" — komponennya mungkin dijual satuan, mungkin tidak; cukup ditentukan dari `status` (active vs archived).

Untuk komposit, dua angka level-produk **diturunkan**, bukan disimpan:

- `effectiveCost(p) = sum(componentBaseQty(c) × componentBaseCost)`. Field manual `cost` di produk diabaikan ketika ada komponen. Strategi harga (markup_pct dll) jalan di atas cost efektif ini — margin otomatis terupdate kalau cost komponen berubah.
- `producibleStock(p) = min(floor(componentStock / componentBaseQty(c)))`. "Bisa rakit berapa unit penuh dari bahan saat ini?" Dibatasi oleh komponen paling langka. Stock komponen dibaca lewat `stockOf(componentProductId, componentVariantId?)` dalam base unit, lalu dibagi `componentBaseQty(c)` supaya kompatibel dengan kemasan pilihan operator.

Form mengubah field cost jadi tampilan read-only "Biaya efektif" saat komponen ada, dan menampilkan "Stok produksi" read-only yang diturunkan dari ketersediaan komponen. Form **tidak punya field Stok** untuk goods juga — stock dikelola eksklusif di `/inventory` (Atur Stok / terima PO / penjualan / retur). Ini menjaga pemisahan Produk = katalog / Inventaris = stok.

**Pilih kemasan untuk bahan** (ditambah 2026-05-27): kalau produk komponen punya kemasan tambahan (mis. Ayam Mentah punya base `pcs` dan kemasan `ekor` factor 8), operator boleh pilih satuan di form Bahan. Qty 1 + Satuan "ekor" → sistem ngitung 8 base unit untuk biaya, ketersediaan, dan potongan stok. Saat user ganti produk komponen, `unitId` + `unitFactor` di-reset. UI Satuan Select sekarang ada di tiga tempat: kartu Bahan level-produk, sub-section "Resep" di tiap varian (untuk override resep per-varian), dan sub-section "Bahan yang dipotong" di tiap ekstra.

**Resep per-varian**: ketika produk komposit punya varian, tiap varian punya array `components` sendiri. Math harga switch per-varian: `effectiveVariantCost(v, p) = sum(componentBaseQty(c) × componentCost)` kalau `v.components` non-empty, kalau tidak fallback ke `v.cost` (di-rute via `costFromSource` untuk produk existing — lihat section 2026-05-26). Sama untuk `producibleVariantStock`. Generator varian pre-seed varian baru dengan komponen level-produk sebagai titik awal, lalu user atur per varian (mis. Combo Small: 1 mie + 1 telur; Combo Large: 1 mie + 3 telur).

**Batasan scaffold:** Select produk komponen di form menyembunyikan produk yang sendiri komposit, mencegah rekursi (belum ada composite-of-composites di produksi; saat sale untuk parent `flexible`, sub-composite tetap di-resolve via `deductCompositeOrGoods`).

</details>

### `ProductExtra`

```ts
type ProductExtra = {
  id: string;
  name: string;            // "Extra cheese"
  priceDelta: number;      // added to sale price when picked
  components: CompositeComponent[];  // optional stock impact when picked
};
```

Extras are **optional add-ons at sale time** that apply to either kind (goods or composite). Each extra carries a price delta added to the sale price and an optional list of components that get deducted from ingredient stock when the customer picks it. At the future POS terminal:

- `salePrice = baseProductPrice + sum(picked extras' priceDelta)`
- stock deducted: from base product/variant components + each picked extra's components

Extras are stored per product; no shared "modifier groups" master-data resource yet (could be added later for "Sauces" / "Toppings" reused across products). `required` flag (force-pick like "must choose size S/M/L") is **not implemented** in this scaffold — all extras are treated as optional toggles. Add it when POS sale UX needs single-select groups.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Extras adalah **add-on opsional saat penjualan** yang berlaku untuk kedua kind (goods atau composite). Tiap extra punya price delta yang ditambahkan ke harga jual, plus daftar opsional komponen yang akan dipotong dari stok bahan saat dipilih. Di POS nanti:

- `salePrice = baseProductPrice + sum(picked extras' priceDelta)`
- stok dipotong: dari komponen produk/varian dasar + komponen tiap extra yang dipilih.

Extras disimpan per produk; belum ada master "modifier group" yang shared (bisa ditambah nanti untuk "Saus" / "Topping" yang dipakai ulang di banyak produk). Flag `required` (wajib pilih, seperti "harus pilih ukuran S/M/L") **belum diimplementasi** — semua extra diperlakukan sebagai toggle opsional. Tambahkan kalau UX POS butuh group single-select.

</details>

### `Supplier`

Lives in `src/lib/stores/suppliers.svelte.ts`. Master-data resource at `/suppliers`.

```ts
type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;      // typical days from order to delivery
  status: 'active' | 'archived';
  notes: string;
};
```

Suppliers power Purchase Orders (see below). `Product.defaultSupplierId` is a soft reference to a primary supplier — used to autofill the supplier when creating a new PO for that product. If the supplier is deleted, the reference dangles harmlessly and `defaultSupplier(p)` returns undefined.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/suppliers.svelte.ts`. Resource master-data di `/suppliers`. Supplier menggerakkan Purchase Order (lihat di bawah). `Product.defaultSupplierId` adalah soft reference ke supplier utama — dipakai untuk autofill supplier saat buat PO baru untuk produk tersebut. Kalau supplier-nya dihapus, referensinya dangling tanpa efek samping, dan `defaultSupplier(p)` mengembalikan `undefined`.

</details>

### `Location`

Lives in `src/lib/stores/locations.svelte.ts`. Master-data resource at `/locations`. **Opt-in via `settings.inventory.locationsEnabled` (default off)** — small stores keeping everything in one place don't see the UI at all. The data model is always-on (every batch carries a `locationId`), so toggling later is zero-migration.

```ts
type LocationKind = 'shelf' | 'rack' | 'warehouse';

type Location = {
  id: string;
  name: string;              // "Etalase", "Rak Belakang", "Gudang"
  slug: string;
  kind: LocationKind;        // shelf → customer-visible by default
  customerVisible: boolean;  // overridable per zone
  isDefaultReceipt: boolean; // exactly one; PO receipts land here
  displayOrder: number;
  description: string;
  status: 'active' | 'archived';
};
```

Three locations are seeded: `Etalase` (shelf, customer-visible), `Rak Belakang` (rack, hidden), and `Gudang` (warehouse, hidden, **default receipt**). `locations.default()` returns the default-receipt entry; `locations.customerVisibleIds()` returns the set used by display chips. The store enforces "exactly one `isDefaultReceipt`" the same way `pricelists` enforces `isDefault`. `locations.remove(id)` returns `{ ok, reason? }` and blocks deleting the default location or any location still holding batches with `qtyRemaining > 0`.

**Storage model.** `Batch.locationId` is the only stock-location axis — a product with 5 on the shelf and 20 in gudang is two batches with the same `(productId, variantId)` and different `locationId`. The total `stockOf(...)` aggregates across all locations (single source of truth); `stockByLocation(...)` returns the per-location breakdown. **Sales walk `batches.forStock(...)` in unchanged FIFO order** (expiry asc, then receivedAt asc) — no shelf-first preference, so perishables stay protected regardless of where they sit.

**Stock movement.** `batches.moveStock({ batchId, toLocationId, qty, notes?, transferGroupId? })` splits the source batch into a sibling at the destination (preserving `unitCost`, `expiresAt`, `receivedAt`, `ownership`, `supplierId`, `sourcePurchaseOrderId/LineId`) so history stays intact. When `qty === src.qtyRemaining`, it mutates `locationId` in place to avoid zero-history zombies. `batches.moveProductStock({ productId, variantId?, fromLocationId, toLocationId, qty, notes? })` is the convenience wrapper that walks source batches sorted by **expiry asc** (the admin-awareness nudge — move expiring stock to Etalase first) and calls `moveStock` until satisfied. Callers can pass a shared `transferGroupId` so multiple `moveStock` calls land as one logical transfer in the movement log.

**Three move flows** sharing the same underlying `moveStock` call — pick whichever matches your physical context:

| Flow | Route | When to use |
|---|---|---|
| **Row modal** (per-product) | `/inventory` → "Pindah" button on a row | Desktop review-and-decide. Surfaces the batch-expiry preview panel inline before submit. |
| **Scan & Pindah** (basket) | `/inventory/move/scan` | Phone/handheld in the warehouse. Scan batch codes / SKUs (USB scanner emits as keyboard events with Enter; manual typing also works), accumulate in a basket, submit all to one destination with a shared `transferGroupId`. |
| **Pindah Massal** (from-location) | `/inventory/move/bulk` | Weekly refill / large reorganization. Pick source location once, check many batches (sorted by expiry asc with red/yellow hint badges), one destination, one submit. "Pilih yang mendekati kedaluwarsa" quick-action handles the "rotate perishables to the shelf" pattern. |

**Display visibility.** "Is this product on display for customers" is emergent from where its batches sit, not a product-level flag. A product is "warehouse-only" iff `stockByLocation(...)` has no entry at any `customerVisible` location. The POS surfaces this with a yellow "Ambil dari: Gudang · 80" chip; otherwise it shows per-location quantities (`Etalase · 5 / Gudang · 20`).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/locations.svelte.ts`. Resource master-data di `/locations`. **Opt-in via `settings.inventory.locationsEnabled` (default off)** — toko kecil yang menyimpan semua barang di satu tempat tidak melihat UI ini sama sekali. Data model selalu on (tiap batch bawa `locationId`), jadi toggling di kemudian hari = zero migration.

Tiga lokasi di-seed: `Etalase` (shelf, customerVisible), `Rak Belakang` (rack, hidden), dan `Gudang` (warehouse, hidden, **default penerimaan**). `locations.default()` mengembalikan entry default-receipt; `locations.customerVisibleIds()` mengembalikan set yang dipakai chip display. Store memastikan "tepat satu `isDefaultReceipt`" persis seperti `pricelists` memastikan `isDefault`. `locations.remove(id)` mengembalikan `{ ok, reason? }` dan menolak penghapusan lokasi default atau lokasi yang masih memegang batch dengan `qtyRemaining > 0`.

**Model penyimpanan.** `Batch.locationId` adalah satu-satunya sumbu lokasi stok — produk dengan 5 di etalase dan 20 di gudang adalah dua batch dengan `(productId, variantId)` sama dan `locationId` berbeda. Total `stockOf(...)` mengagregasi lintas lokasi (single source of truth); `stockByLocation(...)` mengembalikan breakdown per-lokasi. **Penjualan berjalan via `batches.forStock(...)` dalam urutan FIFO yang tidak berubah** (expiry asc, lalu receivedAt asc) — tidak ada preferensi shelf-first, sehingga barang perishable tetap terlindungi terlepas di mana letaknya.

**Pemindahan stok.** `batches.moveStock({ batchId, toLocationId, qty, notes?, transferGroupId? })` memecah batch sumber jadi sibling di tujuan (mempertahankan `unitCost`, `expiresAt`, `receivedAt`, `ownership`, `supplierId`, `sourcePurchaseOrderId/LineId`) supaya history tetap utuh. Saat `qty === src.qtyRemaining`, ia memutasi `locationId` in-place untuk hindari batch nol-history yang zombie. `batches.moveProductStock({ productId, variantId?, fromLocationId, toLocationId, qty, notes? })` adalah wrapper convenience yang berjalan di batch sumber yang sudah diurutkan **expiry asc** (nudge admin-awareness — pindahkan stok yang mendekati expired ke etalase dulu) dan memanggil `moveStock` sampai cukup. Caller bisa pass `transferGroupId` yang sama supaya banyak panggilan `moveStock` ter-grup jadi satu transfer logis di log pergerakan.

**Tiga flow pemindahan** yang berbagi `moveStock` di bawah — pilih sesuai konteks fisik:

| Flow | Route | Kapan dipakai |
|---|---|---|
| **Modal per-row** | `/inventory` → tombol "Pindah" di row | Review-and-decide di desktop. Panel preview batch-expiry inline sebelum submit. |
| **Scan & Pindah** | `/inventory/move/scan` | HP/handheld di gudang. Scan kode batch / SKU (USB scanner emit sebagai keyboard event + Enter; ketik manual juga jalan), kumpulkan di basket, submit semua ke satu tujuan dengan `transferGroupId` yang sama. |
| **Pindah Massal** | `/inventory/move/bulk` | Pengisian mingguan / reorganisasi besar. Pilih lokasi sumber sekali, centang banyak batch (terurut expiry asc dengan badge merah/kuning), satu tujuan, satu submit. Quick-action "Pilih yang mendekati kedaluwarsa" menangani pola "rotasi perishable ke etalase". |

**Visibilitas display.** "Produk ini tampil ke pelanggan atau tidak" muncul dari posisi batch-nya, bukan flag level-produk. Produk dianggap "warehouse-only" kalau `stockByLocation(...)` tidak punya entry di lokasi `customerVisible` mana pun. POS menampilkan ini dengan chip kuning "Ambil dari: Gudang · 80"; selain itu menampilkan qty per lokasi (`Etalase · 5 / Gudang · 20`).

</details>

### `StockMovement` and `StockOpname` (audit trail + cycle count)

Lives in `src/lib/stores/stockMovements.svelte.ts` and `src/lib/stores/stockOpnames.svelte.ts`. **Opt-in via `settings.inventory.auditTrailEnabled` (default off)** — when off, the `stockMovements.log()` calls embedded at every batch mutation site are no-ops, so there's zero overhead.

```ts
type StockMovementKind =
  | 'receive' | 'sale' | 'sale-cancel'
  | 'adjust-in' | 'adjust-out'
  | 'move-out' | 'move-in' | 'move-relocate'
  | 'return-consignor';

type StockMovement = {
  id: string;
  code: string;          // MOV-YYYY-NNN
  at: string;            // ISO datetime
  kind: StockMovementKind;
  productId: string;
  variantId?: string;
  locationId: string;
  batchId: string;       // every movement attaches to a specific batch
  qtyDelta: number;      // signed base units (positive=+, negative=−, 0 for move-relocate)
  qtyAfter: number;      // batch's qtyRemaining post-mutation snapshot
  unitCost: number;      // snapshot for cost-impact reporting
  reference?: { kind: 'po' | 'order' | 'opname' | 'manual' | 'transfer' | 'return'; id: string; code?: string };
  performedBy: string;   // user.current.name snapshot
  notes: string;
};
```

**Hook sites (exhaustive):**
- `purchaseOrders.receive()` → `receive` (one per line).
- `applyOrderToStock` (via `deductBatchesFIFO`) → `sale` (one per `BatchAllocation` — a 5-line order across 10 batches = up to 50 rows).
- `orders.cancel()` → `sale-cancel` (one per allocation).
- `batches.adjustStock` → `adjust-in` (positive delta) or `adjust-out` (per batch in the LIFO walk).
- `batches.moveStock` → `move-out` + `move-in` for partial splits (sharing a `transferGroupId`), or `move-relocate` for full-remainder moves (qtyDelta=0).
- `batches.returnToConsignor` → `return-consignor`.

**`StockOpname` and the count workflow:**

```ts
type OpnameLine = {
  id: string;
  productId: string;
  variantId?: string;
  expectedQty: number;       // snapshot from stockByLocation at draft time
  countedQty: number | null; // admin enters during count; null = skip
  unitCost: number;          // snapshot for shrinkage value
  notes: string;
};

type StockOpname = {
  id: string;
  code: string;              // OPN-YYYY-NNN
  locationId?: string;       // omitted when locations feature is off
  startedAt: string;
  completedAt?: string;
  status: 'draft' | 'completed' | 'cancelled';
  lines: OpnameLine[];
  performedBy: string;
  notes: string;
};
```

`stockOpnames.buildDraft({ locationId?, categoryIds?, productIds?, notes? })` snapshots `expectedQty` and `unitCost` per (product, variant?) and returns a draft. `stockOpnames.complete(id, { skipUncounted })` walks lines with non-zero variance and calls `batches.adjustStock` with `reference: { kind: 'opname', id, code }` — so the resulting `adjust-in` / `adjust-out` movement rows are stamped to the opname for forward and reverse traceability.

**Investigation (theft detection):** the count screen at `/stock-opname/[id]` has a per-row "Selidiki" button that opens a side panel showing `stockMovements.forProduct(productId, variantId, { locationId, since: startedAt - 30d })` as a chronological timeline. When the admin sees a -1 variance, the panel reveals the trail: e.g. `+30 move-in (transfer) → -3 sale (ORD-2026-042) → -1 adjust-out (OPN-2026-001 shrinkage)` so they can spot any unaccounted gap.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/stockMovements.svelte.ts` dan `src/lib/stores/stockOpnames.svelte.ts`. **Opt-in via `settings.inventory.auditTrailEnabled` (default off)** — saat off, panggilan `stockMovements.log()` yang tertanam di tiap titik mutasi batch jadi no-op, jadi zero overhead.

**Hook sites (lengkap):**
- `purchaseOrders.receive()` → `receive` (satu per line).
- `applyOrderToStock` (via `deductBatchesFIFO`) → `sale` (satu per `BatchAllocation` — order 5-line lintas 10 batch = sampai 50 row).
- `orders.cancel()` → `sale-cancel` (satu per alokasi).
- `batches.adjustStock` → `adjust-in` (delta positif) atau `adjust-out` (per batch dalam LIFO walk).
- `batches.moveStock` → `move-out` + `move-in` untuk split parsial (berbagi `transferGroupId`), atau `move-relocate` untuk move sisa-penuh (qtyDelta=0).
- `batches.returnToConsignor` → `return-consignor`.

**Workflow opname:** `stockOpnames.buildDraft({ locationId?, categoryIds?, productIds?, notes? })` snapshot `expectedQty` dan `unitCost` per (product, variant?) dan mengembalikan draft. `stockOpnames.complete(id, { skipUncounted })` berjalan di line dengan varian non-nol dan memanggil `batches.adjustStock` dengan `reference: { kind: 'opname', id, code }` — sehingga row `adjust-in` / `adjust-out` yang dihasilkan ter-stempel ke opname untuk traceability dua arah.

**Selidiki (deteksi pencurian):** layar count di `/stock-opname/[id]` punya tombol "Selidiki" per row yang membuka panel samping menampilkan `stockMovements.forProduct(...)` sebagai timeline kronologis. Saat admin melihat variance -1, panel mengungkap jejaknya, mis. `+30 move-in (transfer) → -3 sale (ORD-2026-042) → -1 adjust-out (OPN-2026-001 shrinkage)` supaya bisa identifikasi gap yang belum tercatat.

</details>

### `PurchaseOrder`

Lives in `src/lib/stores/purchaseOrders.svelte.ts`. Routes at `/purchase-orders` (list), `/purchase-orders/new`, `/purchase-orders/[id]` (detail), `/purchase-orders/[id]/edit`.

```ts
type PurchaseOrderType = 'standard' | 'consignment';
type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

type PurchaseOrderLine = {
  id: string;
  productId: string;
  variantId?: string;       // required when product has variants
  quantity: number;         // ordered quantity (chosen unit)
  receivedQty: number;      // already received (chosen unit); 0 ≤ receivedQty ≤ quantity
  unitId: string;           // base unit or one of the product's packaging units
  unitFactor: number;       // base units per 1 of unitId; snapshot at PO creation
  unitPrice: number;        // IDR per unit (per chosen unit, not per base unit)
  notes: string;
};

type PurchaseOrder = {
  id: string;
  code: string;             // human-readable, auto-generated: PO-YYYY-NNN
  type: PurchaseOrderType;
  supplierId: string;
  status: PurchaseOrderStatus;
  orderDate: string;        // ISO date
  expectedDate: string;     // optional ISO date
  receivedDate: string;     // set when status -> received
  lines: PurchaseOrderLine[];
  notes: string;
};
```

**Status workflow:** `draft → sent → received` (one-way) with `cancelled` available from `draft` or `sent`. The detail page has the action buttons (`Mark as sent`, `Receive`, `Cancel`). Only drafts are editable.

**PO lines support packaging units.** A line can buy in the base unit OR any of the product's packaging units (a Cola line can buy "20 case at Rp 78.000" instead of "480 pcs at Rp 3.250"). The line stores `unitId` + `unitFactor` (factor is snapshotted at line creation so the PO doesn't drift if the product's packaging config changes later). The form's unit Select offers `base` and each packaging; when the user changes unit, `unitPrice` defaults to `(variant?.cost ?? product.cost) × factor`. Helpers `lineBaseQuantity(line)` and `lineBaseUnitCost(line)` convert to base units for display and stock math.

**Receive action** (`purchaseOrders.receive(id, opts?)`):
- Supports partial fulfillment. `opts.receiveQty` is a map `lineId → qty` (in the line's chosen unit). Omitted lines receive their full remaining `quantity − receivedQty`. Set qty to 0 to skip a line this round.
- For each line touched: creates one `Batch` row with `qtyReceived = qtyRemaining = qtyToReceive × unitFactor`, `unitCost = unitPrice / unitFactor`, `ownership = po.type === 'consignment' ? 'consignment' : 'owned'`, snapshotting `supplierId`, `sourcePurchaseOrderId`, `sourcePurchaseOrderLineId`, and `receivedAt`. The line's `receivedQty` is incremented by `qtyToReceive`.
- Status transitions: every line fully received → `received`; some but not all → `partial`. The PO can be received again from `partial` to complete remaining lines.
- Stock for the product/variant rises automatically because `stockOf(...)` sums batches. No scalar `product.stock` write happens any more.
- Cost is **not** auto-updated for either PO type. The manual `product.cost` / `variant.cost` field is the bootstrap value; live cost is `currentCost(productId, variantId?)` — weighted avg of owned batches' `unitCost`, falling back to the manual field when no owned batches exist. Consignment batches are deliberately excluded from `currentCost` since they aren't part of our cost basis.
- (Future) Standard PO will create an AP entry; consignment PO settles per-sale via the Consignor Payout report once the accounting / `/payouts` modules ship.

See [`CONSIGNMENT.md`](./CONSIGNMENT.md) §"Proposed implementation" for the full batch model.

**Consignment is now PO-driven.** There is no `consignment` field on Product anymore. A product is "on consignment" if it has at least one non-cancelled consignment-type PO referencing it. The helper `purchaseOrders.hasConsignmentFor(productId)` answers this; the products list page uses it to render the Consignment badge.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/purchaseOrders.svelte.ts`. Routes di `/purchase-orders` (list), `/purchase-orders/new`, `/purchase-orders/[id]` (detail), `/purchase-orders/[id]/edit`.

**Workflow status:** `draft → sent → received` (satu arah) dengan `cancelled` tersedia dari `draft` atau `sent`. Halaman detail punya tombol aksinya (`Mark as sent`, `Receive`, `Cancel`). Hanya draft yang bisa di-edit.

**Line PO mendukung unit packaging.** Satu line bisa beli pakai base unit ATAU salah satu unit packaging produk (line Cola bisa beli "20 dus harga Rp 78.000" daripada "480 pcs harga Rp 3.250"). Line menyimpan `unitId` + `unitFactor` (factor di-snapshot saat line dibuat supaya PO tidak drift kalau konfigurasi packaging produk berubah). Select unit di form menawarkan `base` dan tiap packaging; saat user ganti unit, `unitPrice` default ke `(variant?.cost ?? product.cost) × factor`. Helper `lineBaseQuantity(line)` dan `lineBaseUnitCost(line)` melakukan konversi ke base unit untuk display dan stock math.

**Aksi penerimaan** (`purchaseOrders.receive(id, opts?)`):
- Mendukung partial fulfillment. `opts.receiveQty` adalah map `lineId → qty` (dalam unit yang dipilih line). Line yang dihilangkan menerima sisa penuh `quantity − receivedQty`. Set qty ke 0 untuk skip line di putaran ini.
- Untuk tiap line yang disentuh: buat satu row `Batch` dengan `qtyReceived = qtyRemaining = qtyToReceive × unitFactor`, `unitCost = unitPrice / unitFactor`, `ownership = po.type === 'consignment' ? 'consignment' : 'owned'`, snapshot `supplierId`, `sourcePurchaseOrderId`, `sourcePurchaseOrderLineId`, dan `receivedAt`. `receivedQty` line ditambah `qtyToReceive`.
- Transisi status: semua line terima penuh → `received`; sebagian → `partial`. PO bisa di-receive lagi dari `partial` untuk melengkapi sisa line.
- Stok untuk produk/varian naik otomatis karena `stockOf(...)` menjumlah batch. Tidak ada write skalar `product.stock` lagi.
- Cost **tidak** auto-update untuk kedua tipe PO. Field manual `product.cost` / `variant.cost` adalah nilai bootstrap; cost live = `currentCost(productId, variantId?)` — weighted avg `unitCost` batch yang owned, fallback ke field manual saat belum ada owned batch. Batch konsinyasi sengaja dikecualikan dari `currentCost` karena bukan bagian dari basis cost kita.
- (Masa depan) PO standard akan buat entri AP; PO konsinyasi diselesaikan per-sale via laporan Payout Konsinyasi saat modul akuntansi / `/payouts` ship.

Lihat [`CONSIGNMENT.md`](./CONSIGNMENT.md) §"Proposed implementation" untuk model batch lengkap.

**Konsinyasi sekarang PO-driven.** Tidak ada lagi field `consignment` di Produk. Produk "on consignment" kalau ada minimal satu PO tipe konsinyasi non-cancelled yang mereferensikannya. Helper `purchaseOrders.hasConsignmentFor(productId)` menjawab ini; halaman list produk pakai untuk render badge Konsinyasi.

</details>

### `Customer` and pricelist assignment

Lives in `src/lib/stores/customers.svelte.ts`. Master-data resource at `/customers`.

```ts
type CustomerType = 'individual' | 'business';

type Customer = {
  id: string;
  name: string;
  type: CustomerType;
  email: string;
  phone: string;
  address: string;
  pricelistId: string;        // FK to Pricelist — drives checkout prices
  taxId: string;              // NPWP for businesses (Indonesian tax ID)
  status: 'active' | 'archived';
  notes: string;
  joinedAt: string;           // ISO date
};
```

Every customer has a `pricelistId`. When the POS terminal ships, selecting a customer at checkout switches the cart's effective pricelist to that customer's — drives `priceForQty` lookups for every line. Walk-in customers (no explicit customer selected at POS) use the global default pricelist (`pricelists.default()`).

The store exposes `customers.countByPricelist(id)` which the Pricelists list page uses to surface customer counts inline ("2 customers" linked back to `/customers?pricelist=pl_wholesale`). The `pricelist` URL query param pre-selects the pricelist filter on the customers list.

For Indonesian B2B compliance, business-type customers can store an `NPWP` (tax ID); the form shows that field only when `type === 'business'`. PPN-compliant invoices (future) will pull this onto the receipt.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/customers.svelte.ts`. Resource master-data di `/customers`. Tiap customer punya `pricelistId`. Saat POS terminal jalan, memilih customer di checkout otomatis ganti pricelist efektif cart ke milik customer — menggerakkan lookup `priceForQty` untuk tiap line. Customer walk-in (tidak ada customer spesifik dipilih) pakai pricelist default global (`pricelists.default()`).

Store mengekspos `customers.countByPricelist(id)` yang dipakai halaman list Pricelist untuk munculkan jumlah customer inline ("2 customers" link ke `/customers?pricelist=pl_wholesale`). Query param URL `pricelist` pre-select filter pricelist di list customer.

Untuk kepatuhan B2B Indonesia, customer tipe business bisa menyimpan `NPWP`; form menampilkan field itu hanya saat `type === 'business'`. Invoice PPN-compliant (masa depan) akan menarik ini ke struk.

</details>

### `Order` — sales from the POS terminal

Lives in `src/lib/stores/orders.svelte.ts`. Routes at `/pos` (terminal), `/orders` (list), `/orders/[id]` (detail).

```ts
type OrderStatus = 'paid' | 'cancelled';
type PaymentMethod = 'cash' | 'card' | 'qris' | 'transfer';

type OrderLineExtra = {
  extraId: string;
  name: string;            // snapshot
  priceDelta: number;      // snapshot
};

type OrderLine = {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;     // snapshot for receipt durability
  variantName: string;     // snapshot
  unitId: string;
  unitFactor: number;      // snapshot
  unitCode: string;        // snapshot
  quantity: number;        // in chosen unit
  unitPrice: number;       // resolved after tier; snapshot
  extras: OrderLineExtra[];
  taxRatePct: number;      // snapshot of tax % at sale time
  lineSubtotal: number;    // qty × (unitPrice + Σ extras.priceDelta)
  lineTax: number;         // lineSubtotal × taxRatePct/100
  lineTotal: number;       // lineSubtotal + lineTax
  batchAllocations: BatchAllocation[];  // populated by applyOrderToStock at charge — exact batches drawn down, snapshotted
};

type Order = {
  id: string;
  code: string;            // ORD-YYYY-NNN
  pricelistId: string;     // snapshot — even if customer's pricelist changes later, this stays
  customerId?: string;     // undefined for walk-in
  paymentMethod: PaymentMethod;
  lines: OrderLine[];
  subtotal: number;        // sum of line subtotals (pre-tax)
  taxTotal: number;        // sum of line taxes
  total: number;           // subtotal + taxTotal
  status: OrderStatus;
  notes: string;
  createdAt: string;       // ISO datetime
};
```

**All financial and product info is snapshotted onto the order** — product name, variant name, unit code, factor, prices, tax rates, and (per line) `batchAllocations`. If a product is renamed, repriced, or its batches mutated/deleted, historical orders remain accurate and the Consignor Payout report stays correct.

The POS terminal at `/pos` supports **multiple concurrent cart sessions** ("tabs"). The cashier can hold one customer's cart while serving the next — common when a customer steps away to grab something they forgot. A horizontal tab strip at the top of the cart panel shows each open session; clicking switches between them. New tabs auto-create with labels like "Tab 2"; once a customer is selected on a tab, the tab's label switches to the customer's name. Closing a tab with items shows a confirm dialog ("Discard 3 items?"). On Charge, the active session becomes an Order and is removed; if it was the last open tab, a fresh blank "Tab N" is auto-created. Session state lives in `src/lib/stores/cartSessions.svelte.ts` as a singleton — it survives navigating away from `/pos` within the same browser session but does **not** persist across reloads (real production would back this with localStorage or server state).

The POS terminal at `/pos` is a two-pane layout: product grid (left) + cart panel (right) with the tab strip on top of the cart. It resolves prices through the full chain:
- Customer's pricelist drives the active pricelist (walk-in → default)
- Each cart line finds its `PricelistEntry` based on whether it's a base / variant / packaging line
- `priceForQty(entry, qty, cost)` resolves quantity tiers
- Extras add their `priceDelta` per quantity
- `taxRateFor(product)` resolves the chain (product override → category → default tax rate); tax is computed per line and shown both inline and aggregated

**Scan-to-sell.** The search input doubles as a barcode/QR target. Pressing Enter triggers `resolveScanToken(text)`, which matches the typed/scanned text in priority order:
1. Exact `product.sku` (case-insensitive)
2. Exact `variant.sku` (case-insensitive)
3. Exact `batch.code` via `batches.getByCode(code)` — resolves to the batch's product + variantId

On a successful match, the line is added to the cart with the correct variant (if any) at the active pricelist's price, and the input clears. Composite products work too — scanning resolves to the composite product; `applyOrderToStock` then deducts each component normally. If no exact match, the text stays as a search filter (existing behavior).

USB barcode scanners that emulate keyboard + Enter work without extra setup. The QR codes printed on batch labels encode `batch.code`, so scanning a label at POS adds the right SKU. Note that scanning a batch QR is *product identification*, not *batch enforcement* — `applyOrderToStock` still walks FIFO on charge, so the soonest-expiring batch is decremented regardless of which batch was scanned.

`applyOrderToStock(order)` (called on charge) deducts stock by walking `Batch` rows FIFO (oldest `receivedAt` first):
- For simple goods: decrement `qtyRemaining` across batches matching `(productId, variantId?)` until `quantity × unitFactor` is satisfied
- For composite products: same FIFO walk per component (per-variant recipe if variant set, else product-level recipe)
- For each picked extra: walk batches for the extra's components per quantity sold
- Every batch touched is stamped onto the line's `batchAllocations` (snapshot of `batchId`, `qtyTaken`, `ownership`, `unitCost`, `supplierId`). The Consignor Payout report aggregates `batchAllocations` where `ownership === 'consignment'` to compute exact per-supplier payables — see the `Payout` section below.

Cancellation (`orders.cancel(id)`) flips status to `cancelled` AND restocks: walks each line's `batchAllocations` and adds `qtyTaken` back to each original batch's `qtyRemaining`. Batches that have been deleted are skipped silently. The `batchAllocations` snapshot remains on the cancelled order as a historical record of what was originally deducted.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/orders.svelte.ts`. Routes di `/pos` (terminal), `/orders` (list), `/orders/[id]` (detail).

**Semua info finansial dan produk di-snapshot ke order** — nama produk, nama varian, kode unit, factor, harga, tarif pajak, dan (per line) `batchAllocations`. Kalau produk diubah nama, di-reprice, atau batch-nya dimutasi/dihapus, order historis tetap akurat dan laporan Payout Konsinyasi tetap benar.

POS terminal di `/pos` mendukung **sesi cart konkuren ganda** ("tabs"). Kasir bisa hold cart satu customer sambil melayani yang lain — umum saat customer pergi sebentar mengambil sesuatu yang tertinggal. Strip tab horizontal di atas panel cart menampilkan tiap sesi terbuka; klik untuk switch antar tab. Tab baru auto-create dengan label seperti "Tab 2"; setelah customer dipilih di sebuah tab, label tab beralih ke nama customer. Tutup tab yang masih ada itemnya menampilkan dialog konfirmasi ("Buang 3 item?"). Saat Charge, sesi aktif jadi Order dan dihapus; kalau itu tab terakhir, "Tab N" kosong baru otomatis dibuat. State sesi ada di `src/lib/stores/cartSessions.svelte.ts` sebagai singleton — bertahan saat pindah dari `/pos` dalam sesi browser yang sama tapi **tidak** persisten antar reload (produksi nyata harus di-back dengan localStorage atau state server).

POS terminal di `/pos` adalah layout dua-panel: grid produk (kiri) + panel cart (kanan) dengan strip tab di atas cart. Ia meresolusi harga via full chain:
- Pricelist customer menggerakkan pricelist aktif (walk-in → default).
- Tiap line cart menemukan `PricelistEntry`-nya berdasarkan jenis line (base / varian / packaging).
- `priceForQty(entry, qty, cost)` meresolusi tier kuantitas.
- Extras menambah `priceDelta`-nya per kuantitas.
- `taxRateFor(product)` meresolusi chain (override produk → kategori → tarif pajak default); pajak dihitung per line dan ditampilkan baik inline maupun agregat.

**Scan-to-sell.** Input pencarian merangkap target barcode/QR. Tekan Enter memicu `resolveScanToken(text)`, yang mencocokkan teks yang diketik/discan dalam urutan prioritas:
1. `product.sku` persis (case-insensitive).
2. `variant.sku` persis (case-insensitive).
3. `batch.code` persis via `batches.getByCode(code)` — resolusi ke productId + variantId batch.

Saat match berhasil, line ditambah ke cart dengan varian yang benar (jika ada) pada harga pricelist aktif, dan input dibersihkan. Produk komposit juga jalan — scan resolusi ke produk komposit; `applyOrderToStock` lalu memotong tiap komponen seperti biasa. Kalau tidak ada match persis, teks tetap jadi filter pencarian (perilaku lama).

USB barcode scanner yang meng-emulasi keyboard + Enter jalan tanpa setup tambahan. QR yang dicetak di label batch meng-encode `batch.code`, jadi scan label di POS menambah SKU yang benar. Catatan: scan QR batch adalah *identifikasi produk*, bukan *enforcement batch* — `applyOrderToStock` tetap jalan FIFO saat charge, jadi batch yang paling cepat expired tetap dipotong terlepas batch mana yang discan.

`applyOrderToStock(order)` (dipanggil saat charge) memotong stok dengan berjalan di row `Batch` secara FIFO (`receivedAt` tertua dulu):
- Goods sederhana: turunkan `qtyRemaining` di batch yang cocok `(productId, variantId?)` sampai `quantity × unitFactor` terpenuhi.
- Produk komposit: walk FIFO yang sama per komponen (recipe per-varian kalau varian di-set, kalau tidak recipe level-produk).
- Tiap extra yang dipilih: walk batch untuk komponen extra per qty yang dijual.
- Tiap batch yang disentuh di-stempel ke `batchAllocations` line (snapshot `batchId`, `qtyTaken`, `ownership`, `unitCost`, `supplierId`). Laporan Payout Konsinyasi mengagregasi `batchAllocations` di mana `ownership === 'consignment'` untuk hitung utang per-supplier eksak — lihat bagian `Payout` di bawah.

Pembatalan (`orders.cancel(id)`) flip status ke `cancelled` DAN restock: walk `batchAllocations` tiap line dan tambah `qtyTaken` kembali ke `qtyRemaining` batch asal. Batch yang sudah dihapus di-skip diam-diam. Snapshot `batchAllocations` tetap di order yang cancel sebagai catatan historis apa yang sebelumnya dipotong.

</details>

### `Payout` — consignor settlements

Lives in `src/lib/stores/payouts.svelte.ts`. Route at `/payouts`.

```ts
type PayoutMethod = 'cash' | 'transfer' | 'other';

type Payout = {
  id: string;
  code: string;                // PAYOUT-YYYY-NNN
  supplierId: string;
  amount: number;              // IDR
  paidAt: string;              // ISO date
  method: PayoutMethod;
  coversPeriodStart: string;   // ISO date
  coversPeriodEnd: string;     // ISO date
  notes: string;
};
```

A `Payout` records a settlement to a consignor — money out the door. The `/payouts` page computes outstanding payables from `consignmentOwedBySupplier(...)` (which walks paid orders' `batchAllocations`) minus `payouts.paidToSupplier(supplierId, asOf?)`, then offers a Record-payout modal to log new settlements. The page also exposes a Return-stock action backed by `batches.returnToConsignor(batchId, qty)` so a retailer can hand back unsold consignment units without financial impact.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/payouts.svelte.ts`. Route di `/payouts`. `Payout` mencatat settlement ke konsinyor — uang keluar. Halaman `/payouts` menghitung utang outstanding dari `consignmentOwedBySupplier(...)` (yang walk `batchAllocations` order yang sudah paid) dikurangi `payouts.paidToSupplier(supplierId, asOf?)`, lalu menawarkan modal Catat-payout untuk log settlement baru. Halaman juga menawarkan aksi Retur-stock yang di-back oleh `batches.returnToConsignor(batchId, qty)` supaya retailer bisa kembalikan unit konsinyasi yang tidak terjual tanpa dampak finansial.

</details>

### `Pricelist` (cross-reference)

Lives in `src/lib/stores/pricelists.svelte.ts`. Master-data resource at `/pricelists`.

```ts
type Pricelist = {
  id: string;
  name: string;          // "Retail", "Wholesale", "VIP"
  isDefault: boolean;    // exactly one true; store enforces
  description: string;
};
```

Seed: Retail (default), Wholesale, VIP. The default cannot be deleted; the last remaining list cannot be deleted.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/pricelists.svelte.ts`. Resource master-data di `/pricelists`. Seed: Retail (default), Wholesale, VIP. Default tidak bisa dihapus; pricelist terakhir yang tersisa juga tidak bisa dihapus.

</details>

### `TaxRate` and tax resolution

Lives in `src/lib/stores/taxRates.svelte.ts`. Master-data resource at `/taxes`.

```ts
type TaxRate = {
  id: string;
  name: string;          // "PPN 11%", "Tax-exempt", "Zero-rated"
  rate: number;          // percentage (e.g., 11 for 11%)
  description: string;
  isDefault: boolean;    // exactly one true; used when neither product nor category specifies
};
```

Seed: PPN 11% (default), Tax-exempt, Zero-rated. The default cannot be deleted; the last rate cannot be deleted.

**Tax is resolved per product**, not per pricelist or per tier:

- `Category.taxRateId: string` — required. Each category has a default tax rate.
- `Product.taxRateId?: string` — optional override. When unset, the product inherits from its category.
- `taxRateFor(product)` walks the chain: product override → category default → global default. Always returns a TaxRate (or undefined only in degenerate cases).
- `priceWithTax(price, rate)` returns the tax-inclusive price for any computed sale price.

This matches the Indonesian retail reality: most items are PPN 11%, certain items (basic food, education, healthcare per UU HPP) are exempt, and you set this at the category level so individual products rarely need to override. The override exists for cases where one product within a category has a different status.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Lives di `src/lib/stores/taxRates.svelte.ts`. Resource master-data di `/taxes`. Seed: PPN 11% (default), Tax-exempt, Zero-rated. Default tidak bisa dihapus; tarif terakhir tidak bisa dihapus.

**Pajak diresolusi per produk**, bukan per pricelist atau per tier:

- `Category.taxRateId: string` — wajib. Tiap kategori punya tarif pajak default.
- `Product.taxRateId?: string` — override opsional. Saat unset, produk inherit dari kategorinya.
- `taxRateFor(product)` walk chain: override produk → default kategori → default global. Selalu kembali TaxRate (atau undefined hanya di kasus aneh).
- `priceWithTax(price, rate)` mengembalikan harga inclusive-pajak untuk harga jual hasil hitung.

Ini sesuai realitas retail Indonesia: mayoritas item PPN 11%, item tertentu (sembako, pendidikan, kesehatan per UU HPP) exempt, dan ini di-set di level kategori jadi produk individual jarang perlu override. Override ada untuk kasus saat satu produk dalam kategori punya status berbeda.

</details>

---

## Key decisions and why

These are load-bearing. If you disagree, change them deliberately — don't accidentally undo them.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Keputusan di bawah ini load-bearing. Kalau tidak setuju, ubah secara sengaja — jangan secara tidak sadar membalikkan keputusan ini.

</details>

### 1. No `margin_pct` strategy — markup only

Originally we had four strategies (fixed, markup_amount, markup_pct, margin_pct). Margin was removed because **markup is more intuitive for product pricing**. Markup answers "how much do I add to cost?"; margin answers "what fraction of sale is profit?". Both are real, but small retailers think in markup. Margin% is still displayed as informational text in the `PricingInput` preview alongside markup%.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Awalnya kami punya empat strategi (fixed, markup_amount, markup_pct, margin_pct). Margin dihapus karena **markup lebih intuitif untuk pricing produk**. Markup menjawab "berapa yang aku tambah ke cost?"; margin menjawab "berapa bagian dari sale yang profit?". Keduanya nyata, tapi retailer kecil berpikir dalam markup. Margin% tetap ditampilkan sebagai teks informasional di preview `PricingInput` di samping markup%.

</details>

### 2. Sale price is computed, never stored

`PricelistEntry.pricing` is the *strategy*; the actual price number is computed on read via `computeSalePrice`. Reason: when supplier cost changes (eventually via Purchase Orders), all markup-based prices auto-update without writes. UI should never multiply/add directly — use `basePrice(p)`, `priceRange(p)`, `priceForQty(entry, qty, cost)`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`PricelistEntry.pricing` adalah *strategi*; angka harga aslinya dihitung saat read via `computeSalePrice`. Alasannya: kalau cost supplier berubah (nantinya via Purchase Order), semua harga berbasis markup otomatis ter-update tanpa write. UI tidak boleh kali/tambah langsung — pakai `basePrice(p)`, `priceRange(p)`, `priceForQty(entry, qty, cost)`.

</details>

### 3. Pricing is per-row, not just per-product

Each `ProductVariant`, `ProductPackaging`, and the `Product` itself has its own `prices: PricelistEntry[]`. A premium variant can have its own markup; a wholesale-only 24-pack can have its own tier ladder. Variant `cost` is also per-variant (a Brand Blue mug may cost more than White).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tiap `ProductVariant`, `ProductPackaging`, dan `Product` punya `prices: PricelistEntry[]` sendiri. Varian premium bisa punya markup-nya sendiri; pak 24-pcs khusus grosir bisa punya tangga tier sendiri. `cost` varian juga per-varian (mug Biru bisa lebih mahal cost-nya daripada Putih).

</details>

### 4. Pricelists rendered as a vertical list, not tabs

The form renders each pricelist as a stacked card. We tried tabs first; the problem was **hidden state** — errors on inactive tabs were invisible, and users developed anxiety about "what's in the other tab." The vertical list shows everything at once. Adding/removing a pricelist cascades the change to **all** variants and packagings to keep entries in sync.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Form me-render tiap pricelist sebagai card bertumpuk. Awalnya kami coba tab; masalahnya **hidden state** — error di tab non-aktif tidak terlihat, dan user jadi cemas "ada apa di tab lain." List vertikal menampilkan semua sekaligus. Tambah/hapus pricelist meng-cascade perubahan ke **semua** varian dan packaging supaya entry tetap sinkron.

</details>

### 5. `advanced: boolean` was dropped

There used to be `advanced: boolean` on Product that gated the form's packagings/variants visibility. It was removed because:
- It bundled three orthogonal features into one toggle
- "Advanced" is a meaningless label — users don't know what they're opting into
- It can be derived: `isAdvanced(p)` from data presence

Form now uses **progressive disclosure** — opt-in chips like `+ Add packaging`, `+ Add variants`. Sections appear only when populated.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Dulu ada `advanced: boolean` di Produk yang men-gate visibility packaging/varian di form. Itu dihapus karena:
- Menggabungkan tiga fitur ortogonal jadi satu toggle.
- "Advanced" label tidak bermakna — user tidak tahu opt-in ke apa.
- Bisa diturunkan: `isAdvanced(p)` dari kehadiran data.

Form sekarang pakai **progressive disclosure** — chip opt-in seperti `+ Add packaging`, `+ Add variants`. Section muncul hanya saat ada data.

</details>

### 6. Cost lives on batches; `product.cost` is a manual bootstrap fallback

Each `Batch` carries its own `unitCost` snapshotted at receipt time, and `currentCost(productId, variantId?)` returns the weighted average across remaining **owned** batches. `product.cost` / `variant.cost` are not auto-updated by `receive()` any more — they exist only as:
- The bootstrap value used by pricing math (`computeSalePrice`, `priceForQty`) before any batches exist for a product
- A manual fallback that's still editable in the product form

Consignment batches are deliberately excluded from `currentCost` since they aren't part of our cost basis. See [`CONSIGNMENT.md`](./CONSIGNMENT.md) §"Cost" for the full rationale.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tiap `Batch` bawa `unitCost`-nya sendiri yang di-snapshot saat penerimaan, dan `currentCost(productId, variantId?)` mengembalikan weighted average di batch owned yang masih punya stok. `product.cost` / `variant.cost` tidak auto-update oleh `receive()` lagi — keduanya ada hanya sebagai:
- Nilai bootstrap yang dipakai math pricing (`computeSalePrice`, `priceForQty`) sebelum ada batch untuk produk tersebut.
- Fallback manual yang masih bisa di-edit di form produk.

Batch konsinyasi sengaja dikecualikan dari `currentCost` karena bukan bagian dari basis cost kita. Lihat [`CONSIGNMENT.md`](./CONSIGNMENT.md) §"Cost" untuk rationale lengkap.

</details>

### 7. Variant generator preserves edits on regenerate

When the user clicks "Generate variants" with attributes set, we don't wipe existing variants. `regenerateVariants` matches by `values: Record<string, string>` and preserves edited rows whose combo still exists. Orphans (combos no longer in the attribute set) are dropped. Manual variants (empty `values`) are also dropped. This is non-destructive enough that no confirm dialog is needed.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat user klik "Generate variants" dengan attribute yang sudah di-set, kami tidak menghapus varian yang sudah ada. `regenerateVariants` mencocokkan via `values: Record<string, string>` dan mempertahankan row yang sudah di-edit selama kombinasinya masih ada. Yang yatim (kombinasi tidak lagi ada di attribute set) dibuang. Varian manual (empty `values`) juga dibuang. Non-destruktif cukup untuk tidak butuh dialog konfirmasi.

</details>

### 8. Quantity tiers stored per pricelist entry, not per product

`PricelistEntry.tiers` lives inside the entry, not at the product level. This is critical for the "wholesale customers get more aggressive volume tiers than retail" scenario — same product, different ladders per customer tier. `priceForQty(entry, qty, cost)` returns the right price for any quantity by walking tiers (highest matching `minQty` wins).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`PricelistEntry.tiers` ada di dalam entry, bukan di level produk. Ini krusial untuk skenario "customer grosir dapat tier volume lebih agresif daripada retail" — produk sama, tangga berbeda per tier customer. `priceForQty(entry, qty, cost)` mengembalikan harga yang tepat untuk kuantitas berapa pun dengan walk tier (tier dengan `minQty` paling besar yang masih cocok menang).

</details>

### 9. Currency is Indonesian Rupiah throughout

Locale `id-ID`, 0 fraction digits, dot as thousands separator (e.g., `Rp 25.000`). Helpers in `src/lib/utils/currency.ts` — `formatRupiah`, `formatRupiahNumber`, `parseRupiahNumber`. All monetary inputs use `<MoneyInput>` which formats live with thousand separators and preserves cursor position. If you ever change currency, change there and the seed prices.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Locale `id-ID`, 0 fraction digit, titik sebagai pemisah ribuan (mis. `Rp 25.000`). Helper ada di `src/lib/utils/currency.ts` — `formatRupiah`, `formatRupiahNumber`, `parseRupiahNumber`. Semua input mata uang pakai `<MoneyInput>` yang format live dengan separator ribuan dan mempertahankan posisi cursor. Kalau suatu saat ganti mata uang, ubah di sana plus harga di seed.

</details>

### Tax

Tax is **always resolved through the fallback chain**: product override → category default → global default. The system never assumes "no tax" silently — there's always a resolved TaxRate, even if its rate is 0. This makes reports and POS calculations predictable.

Tax rate ≠ tax included in price. The PricelistEntry pricing is **tax-exclusive**. `priceWithTax(salePrice, rate)` computes the tax-inclusive figure. At the POS, you typically display tax-inclusive prices to walk-in customers (Indonesian retail convention) but break out the tax line on the receipt. The data model supports both views.

If you change tax behavior (e.g., display tax-inclusive in pricelists), do it in helpers, not by mutating stored values. Stored prices stay tax-exclusive.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Pajak **selalu diresolusi via fallback chain**: override produk → default kategori → default global. Sistem tidak pernah berasumsi "tanpa pajak" diam-diam — selalu ada TaxRate yang resolved, meskipun rate-nya 0. Ini bikin laporan dan kalkulasi POS dapat diprediksi.

Tax rate ≠ pajak inclusive di harga. Pricing `PricelistEntry` adalah **tax-exclusive**. `priceWithTax(salePrice, rate)` menghitung angka tax-inclusive. Di POS biasanya tampilkan harga tax-inclusive ke customer walk-in (konvensi retail Indonesia) tapi pisahkan line pajak di struk. Data model mendukung kedua tampilan.

Kalau ubah behavior pajak (mis. tampilkan tax-inclusive di pricelist), lakukan di helper, bukan dengan memutasi nilai yang tersimpan. Harga yang tersimpan tetap tax-exclusive.

</details>

### 10. UI primitives vs product-domain components

| Type | Location | Purpose |
|---|---|---|
| Reusable across any feature | `src/lib/components/ui/` | `Button`, `Input`, `Select`, `Modal`, `Card`, `Table`, `PricingInput`, `MoneyInput`, `ChipInput`, `Collapsible`, etc. Re-exported from `index.ts`. |
| Product-domain specific | `src/lib/components/products/` | `ProductForm.svelte`, `TierEditor.svelte` |

When in doubt, default to `ui/` only if it's truly generic. The product form and tier editor know about the product model and stay in `products/`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat ragu, default ke `ui/` hanya kalau benar-benar generik. Form produk dan tier editor tahu tentang model produk dan tinggal di `products/`.

</details>

---

## Form UX principles

The form (`ProductForm.svelte`) follows these rules. Future changes should respect them.

1. **Simple by default.** First-time user adding "Espresso, Rp 25.000" sees only Basics + Pricing (single pricelist) + Stock. Nothing else.

2. **Opt-in via chips.** New features (packagings, variants, additional pricelists, volume tiers) are added via labeled dashed-border chips. Clicking creates the first row and reveals its section.

3. **Cards, not tabs.** Major concepts (Basics, Pricing & inventory, Packagings, Variants, Organization) each get their own Card. Conditional cards (Packagings, Variants) only render when their data exists.

4. **Collapsible for repeat patterns.** Volume tier editors and per-pricelist pricing blocks inside variant/packaging cards use `<Collapsible>` to stay compact. The header summary shows current state (e.g., `Volume tiers (3)`, or `Sale pricing — Rp 150.000 (Retail) +1`).

5. **Sticky bottom action bar.** Cancel / Save stay on screen regardless of scroll position.

6. **Validation surfaces inline AND via toast.** Per-field errors render below their input. If submit blocks, a single toast tells the user to "fix the highlighted fields." All pricelists' entries are validated on every submit — no hidden errors.

7. **No tabs anywhere in the form.** Tabs hide state. We tried them for pricelists, removed them. Don't reintroduce them without a strong reason.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Form (`ProductForm.svelte`) mengikuti aturan ini. Perubahan ke depan harus menghormatinya.

1. **Sederhana sebagai default.** User pertama kali menambah "Espresso, Rp 25.000" hanya lihat Basics + Pricing (satu pricelist) + Stock. Tidak ada yang lain.
2. **Opt-in via chip.** Fitur baru (packaging, varian, pricelist tambahan, volume tier) ditambahkan via chip dashed-border berlabel. Klik membuat row pertama dan menampilkan section-nya.
3. **Card, bukan tab.** Konsep utama (Basics, Pricing & inventory, Packagings, Variants, Organization) dapat Card sendiri-sendiri. Card kondisional (Packagings, Variants) hanya render saat data ada.
4. **Collapsible untuk pola berulang.** Volume tier editor dan blok pricing per-pricelist di dalam card varian/packaging pakai `<Collapsible>` supaya tetap compact. Header summary menampilkan state saat ini (mis. `Volume tiers (3)`, atau `Sale pricing — Rp 150.000 (Retail) +1`).
5. **Action bar sticky di bawah.** Cancel / Save tetap di layar terlepas dari posisi scroll.
6. **Validation muncul inline DAN via toast.** Error per-field render di bawah input-nya. Kalau submit di-block, satu toast minta user "perbaiki field yang di-highlight." Semua entry pricelist di-validate di tiap submit — tidak ada error tersembunyi.
7. **Tidak ada tab di form.** Tab menyembunyikan state. Sudah dicoba untuk pricelist, dihapus. Jangan masukkan lagi tanpa alasan kuat.

</details>

---

## File map

The shortest path to understanding the system:

```
src/
├── routes/
│   ├── pricelists/+page.svelte           # Pricelist CRUD (Modal-based)
│   ├── categories/+page.svelte           # Category CRUD (Modal-based)
│   ├── units/+page.svelte                # Unit CRUD (Modal-based)
│   ├── employees/+page.svelte            # Employee CRUD (Modal-based)
│   └── products/
│       ├── +page.svelte                  # Product list with filters
│       ├── new/+page.svelte              # Wraps ProductForm for create
│       └── [id]/edit/+page.svelte        # Wraps ProductForm for edit
├── lib/
│   ├── stores/                           # $state-backed singletons
│   │   ├── pricelists.svelte.ts          # Pricelist resource
│   │   ├── categories.svelte.ts
│   │   ├── units.svelte.ts
│   │   ├── employees.svelte.ts
│   │   ├── products.svelte.ts            # Product types + helpers (THE BIG ONE)
│   │   ├── sidebar.svelte.ts             # Sidebar collapse/mobile state
│   │   ├── toast.svelte.ts               # Toast notifications
│   │   └── user.svelte.ts                # User dropdown state
│   ├── utils/
│   │   └── currency.ts                   # Rupiah formatter/parser
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.svelte            # Nav (Master Data group lives here)
│       │   ├── TopBar.svelte
│       │   └── ToastContainer.svelte
│       ├── ui/                           # Reusable primitives
│       │   ├── Button.svelte             # Supports `href` prop
│       │   ├── Input.svelte
│       │   ├── MoneyInput.svelte         # Rupiah formatting + cursor preservation
│       │   ├── PricingInput.svelte       # Strategy + value + live preview
│       │   ├── ChipInput.svelte          # Tag/chip input
│       │   ├── Collapsible.svelte        # Chevron expand/collapse
│       │   ├── ConfirmDialog.svelte
│       │   ├── Modal.svelte
│       │   ├── Tabs.svelte               # Available but NOT used in ProductForm
│       │   ├── Table.svelte
│       │   ├── ...
│       │   └── index.ts                  # Re-exports
│       └── products/
│           ├── ProductForm.svelte        # The big form (shared by new + edit)
│           └── TierEditor.svelte         # Volume-tier repeater
└── app.css                               # Tailwind v4 theme tokens
```

---

## Helpers quick reference

All in `src/lib/stores/products.svelte.ts` unless noted.

### Pricing math

| Helper | Returns | Notes |
|---|---|---|
| `computeSalePrice(cost, strategy)` | `number` | Core. Returns `NaN` if strategy value isn't finite. |
| `priceForQty(entry, qty, cost)` | `number` | Walks tiers; highest `minQty ≤ qty` wins. |
| `basePrice(p, pricelistId?)` | `number` | Defaults to default pricelist; falls back if missing. |
| `priceRange(p, pricelistId?)` | `{min, max}` | Across base + variants + packagings. |

### Pricelist entry lookups

| Helper | Returns | Notes |
|---|---|---|
| `findEntry(entries, pricelistId)` | `PricelistEntry \| undefined` | Strict match. |
| `effectiveEntry(entries, pricelistId, fallbackId?)` | `PricelistEntry \| undefined` | Falls back if missing. |
| `emptyEntry(pricelistId)` | `PricelistEntry` | Fixed strategy, value 0, no tiers. |
| `cloneEntry(entry)` | `PricelistEntry` | Deep clone (pricing and tiers). |
| `tierFor(entry, qty)` | `PricingTier \| null` | Highest matching tier. |

### Strategy + validation

| Helper | Returns | Notes |
|---|---|---|
| `validatePricing(strategy)` | `string \| null` | Inline error message or null. |
| `defaultPricing(value=0)` | `PricingStrategy` | `{ kind: 'fixed', value }`. |
| `isPercentKind(kind)` | `boolean` | `true` for `markup_pct`. Used by PricingInput to switch input type. |
| `pricingKindOptions` | `{value, label}[]` | For Select. |

### Variant generator

| Helper | Returns | Notes |
|---|---|---|
| `activeAttributes(attrs)` | `ProductAttribute[]` | Filters out attrs with empty name or no values. |
| `variantCombinations(attrs)` | `Record<string,string>[]` | Cartesian product. |
| `valuesMatch(a, b)` | `boolean` | Same keys + same values. |
| `generateVariants(attrs, defaults)` | `ProductVariant[]` | Fresh generation, ignores existing. |
| `regenerateVariants(attrs, existing, defaults)` | `ProductVariant[]` | Preserves edits on matching combos. |

### Product introspection

| Helper | Returns | Notes |
|---|---|---|
| `isAdvanced(p)` | `boolean` | True if packagings/variants/attributes exist. |
| `isComposite(p)` | `boolean` | True if `p.components.length > 0` (legacy — prefer `p.kind === 'composite'`). |
| `effectiveCost(p)` | `number` | For composites: `sum(qty × componentCost)`. For simple: `p.cost`. |
| `effectiveVariantCost(v)` | `number` | Per-variant: `sum(qty × componentCost)` if `v.components` non-empty, else `v.cost`. |
| `producibleStock(p)` | `number` | For composites: limited by rarest component (via `stockOf` per component). For simple: `stockOf(p.id)`. |
| `producibleVariantStock(productId, v)` | `number` | Per-variant: limited by rarest component if `v.components` non-empty, else `stockOf(productId, v.id)`. Signature gained `productId` so it can query batches. |
| `totalStock(p)` | `number` | Variants: sum of `producibleVariantStock(p.id, v)`. Composites (no variants): `producibleStock`. Else: `stockOf(p.id)`. |
| `pricelistEntries(p)` | `Set<string>` | All pricelist IDs across product, variants, packagings. |
| `hasAnyTier(p)` | `boolean` | True if any entry anywhere has tiers. |
| `taxRateFor(product)` | `TaxRate \| undefined` | Resolves the chain: product → category → default. |
| `priceWithTax(price, rate)` | `number` | Tax-inclusive of a sale price. |
| `defaultSupplier(p)` | `Supplier \| undefined` | Resolves `p.defaultSupplierId` to a Supplier; undefined if id is stale. |
| `purchaseOrders.hasConsignmentFor(productId)` | `boolean` | True if any non-cancelled consignment PO references this product. |
| `purchaseOrders.receive(id)` | `{ ok, reason? }` | Marks PO as received. Creates one `Batch` per line (ownership derived from PO type). No scalar `product.stock` / `product.cost` write. |
| `stockOf(productId, variantId?)` | `number` | Live stock — sum of `qtyRemaining` across matching batches. The single source of truth. |
| `stockBreakdown(productId, variantId?)` | `{ owned, consignment }` | Same as `stockOf` but split by ownership. For displays like "80 owned + 10 consignment". |
| `currentCost(productId, variantId?)` | `number` | Weighted avg of owned batches' `unitCost` across `qtyRemaining`; falls back to `product.cost` / `variant.cost` when no owned batches exist. Consignment batches excluded (not our cost basis). |
| `batches.forStock(productId, variantId?)` | `Batch[]` | FIFO-ordered batches with `qtyRemaining > 0`. Sort key: `expiresAt` ASC first (perishables sell first), then `receivedAt` ASC as fallback. Used by `applyOrderToStock` and any FIFO-walk caller. |
| `batches.forSupplier(supplierId, ownership?)` | `Batch[]` | Supplier-scoped batch list. Powers the consignor payout / return flows. |
| `batches.forSourcePO(poId)` | `Batch[]` | All batches created from a given PO, sorted by `receivedAt` ASC. Drives `/inventory/po/[poId]/labels`. |
| `batches.getByCode(code)` | `Batch \| undefined` | Look up by human-readable `BATCH-YYYY-NNN`. Used by the POS scan flow. |
| `batches.adjustStock({ productId, variantId?, delta, unitCost, locationId?, notes? })` | `void` | Manual stock adjustment. Positive delta → new owned batch at `locationId` (defaults to `locations.default().id`). Negative → LIFO decrement starting at `locationId`, falling through to other locations if shortfall remains. Used by the product form save. |
| `batches.forProduct(productId)` | `Batch[]` | All batches for a product (across variants, including depleted), sorted by `receivedAt` ASC. Drives the per-product Batches modal on the products list. |
| `batches.returnToConsignor(batchId, qty)` | `{ ok, reason? }` | Decrements a consignment batch's `qtyRemaining`. No payable, no revenue. Used by the Return-stock modal on `/payouts`. |
| `stockByLocation(productId, variantId?)` | `Map<locationId, qty>` | Per-location remaining stock for a (product, variant?). Drives the breakdown chips on `/inventory`, `/products`, and `/pos`. |
| `batches.moveStock({ batchId, toLocationId, qty, notes? })` | `{ ok, reason?, newBatch? }` | Splits the source batch into a sibling at the destination preserving all snapshotted fields. Full-remainder moves mutate `locationId` in place. |
| `batches.moveProductStock({ productId, variantId?, fromLocationId, toLocationId, qty, notes? })` | `{ ok, reason?, moved }` | Convenience wrapper. Walks source batches sorted by `expiresAt` ASC and chains `moveStock` calls until satisfied. Used by the Pindahkan modal on `/inventory`. |
| `locations.default()` / `locations.defaultId()` | `Location` / `string` | The single `isDefaultReceipt: true` location. PO receipts and unspecified positive adjustments land here. |
| `locations.customerVisibleIds()` | `Set<string>` | IDs of locations flagged customer-visible. Used to detect "warehouse-only" products and tint breakdown chips. |
| `locations.sortedActive()` | `Location[]` | Active locations sorted by `displayOrder` asc — used for consistent ordering across all surfaces. |
| `stockMovements.log({ kind, productId, batchId, locationId, qtyDelta, qtyAfter, unitCost, reference?, notes })` | `StockMovement \| undefined` | Append a ledger row; no-op when `settings.inventory.auditTrailEnabled` is off. Captures `performedBy` from `user.current.name` and `at` from `new Date().toISOString()` unless overridden. |
| `stockMovements.forProduct(productId, variantId?, { locationId?, since?, until?, limit? })` | `StockMovement[]` | Filtered chronological history (desc). Powers the Selidiki investigation panel. |
| `stockMovements.forReference(kind, id)` | `StockMovement[]` | All rows referencing a given source doc (PO, Order, Opname, transfer group, return). Asc by `at`. |
| `stockOpnames.buildDraft({ locationId?, categoryIds?, productIds?, notes? })` | `StockOpname` | Snapshots expected qty + unit cost per line. Composite products excluded. |
| `stockOpnames.complete(id, { skipUncounted? })` | `{ ok, reason?, adjusted, skipped }` | Reconciles non-zero variances via `batches.adjustStock` with an opname reference, sets status `completed`. |
| `opnameTotals(opname)` | `{ totalExpected, totalCounted, totalVariance, totalShrinkageValue, totalSurplusValue, countedLines, uncountedLines }` | Aggregates across lines; powers the StatCard strip on the count screen. |
| `consignmentOwedBySupplier({ start?, end? })` | `Map<supplierId, { units, amount }>` | Aggregates per-supplier consignment payable from paid orders' `batchAllocations` in a date range. Drives the Outstanding card on `/payouts`. |
| `payouts.add(input)` | `Payout` | Records a settlement to a supplier; auto-generates `PAYOUT-YYYY-NNN` code. |
| `payouts.paidToSupplier(supplierId, asOf?)` | `number` | Sum of recorded payouts to a supplier, optionally up to a cutoff date. The Outstanding column subtracts this from the owed amount. |
| `purchaseOrders.markSent(id)` | `{ ok, reason? }` | Transitions draft → sent. |
| `purchaseOrders.cancel(id)` | `{ ok, reason? }` | Transitions draft or sent → cancelled. |
| `poTotal(po)` | `number` | Sum of line subtotals. |
| `lineSubtotal(line)` | `number` | `quantity × unitPrice`. |
| `lineBaseQuantity(line)` | `number` | `quantity × unitFactor` — converted to base units. |
| `lineBaseUnitCost(line)` | `number` | `unitPrice / unitFactor` — per-base-unit price for cost math. |
| `products.countByCategory(id)` | `number` | Used by Categories page badge. |
| `products.countByUnit(id)` | `number` | Used by Units page badge. |
| `products.countByPricelist(id)` | `number` | Used by Pricelist page (not yet wired). |

### Currency (`src/lib/utils/currency.ts`)

| Helper | Returns | Notes |
|---|---|---|
| `formatRupiah(value)` | `string` | `Rp 25.000`. Returns `—` for non-finite. |
| `formatRupiahNumber(value)` | `string` | `25.000` (no symbol). |
| `parseRupiahNumber(input)` | `number` | Strips non-digits. |

---

## Conventions when extending

- **State management:** `$state`-backed class singletons in `src/lib/stores/*.svelte.ts`. See `toast.svelte.ts` (simple) and `products.svelte.ts` (complex) for patterns.
- **New master-data resource:** mirror the Categories / Units pattern — store with seed + `add` / `update` / `remove` / `getById`, Modal-based form for create/edit, `<ConfirmDialog>` for delete, add a nav item to the Master Data group in `Sidebar.svelte`.
- **Money:** always use `<MoneyInput>` for input, `formatRupiah()` for display. Never raw number inputs for currency.
- **Pricing math:** always go through `computeSalePrice` / `priceForQty` / `basePrice` / `priceRange`. Don't multiply/add directly.
- **Pricelist sync:** when adding or removing a pricelist on a product, mirror the change to every variant and packaging (see `addProductPricelist` / `removeProductPricelist` in `ProductForm.svelte`). Lookups gracefully fall back to the default pricelist, but writes should be explicit.
- **New UI primitive:** `src/lib/components/ui/`, exported from `index.ts`. Keep it generic (no domain knowledge).
- **Routes:** `+page.svelte` under `src/routes/<slug>/`. Dynamic params: `src/routes/<slug>/[id]/+page.svelte`. SvelteKit's `page.params.id` is typed as `string | undefined` — handle the missing case.
- **Frontend stack:** Svelte 5 runes only — no legacy `let`/stores. Tailwind v4 utilities. `lucide-svelte` for icons.
- **Validation:** inline errors per field + a single toast on submit. Don't show validation walls.
- **Form sections:** Cards, not tabs. Progressive disclosure for optional features.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- **State management:** singleton class yang di-back `$state` di `src/lib/stores/*.svelte.ts`. Lihat `toast.svelte.ts` (sederhana) dan `products.svelte.ts` (kompleks) untuk pola.
- **Resource master-data baru:** ikuti pola Categories / Units — store dengan seed + `add` / `update` / `remove` / `getById`, form berbasis Modal untuk create/edit, `<ConfirmDialog>` untuk delete, tambah item nav di group Data Master di `Sidebar.svelte`.
- **Uang:** selalu pakai `<MoneyInput>` untuk input, `formatRupiah()` untuk display. Jangan pakai input number mentah untuk mata uang.
- **Math pricing:** selalu via `computeSalePrice` / `priceForQty` / `basePrice` / `priceRange`. Jangan kali/tambah langsung.
- **Sinkronisasi pricelist:** saat menambah atau menghapus pricelist di produk, mirror perubahan ke tiap varian dan packaging (lihat `addProductPricelist` / `removeProductPricelist` di `ProductForm.svelte`). Lookup fallback ke pricelist default dengan tenang, tapi write harus eksplisit.
- **UI primitive baru:** `src/lib/components/ui/`, di-export dari `index.ts`. Tetap generik (tanpa domain knowledge).
- **Routes:** `+page.svelte` di bawah `src/routes/<slug>/`. Param dinamis: `src/routes/<slug>/[id]/+page.svelte`. `page.params.id` SvelteKit di-type `string | undefined` — handle kasus missing.
- **Stack frontend:** Svelte 5 runes saja — tidak ada `let` legacy / store legacy. Utility Tailwind v4. `lucide-svelte` untuk ikon.
- **Validation:** error inline per field + satu toast saat submit. Jangan tampilkan dinding validasi.
- **Section form:** Card, bukan tab. Progressive disclosure untuk fitur opsional.

</details>

---

## What's intentionally deferred

These exist in the mental model but aren't built:

| Feature | Status | Notes |
|---|---|---|
| Receipt printing | Not built | Order detail page is receipt-ready in layout; integrating ESC/POS or browser print is a future task. |
| Refunds / returns | Not built | Line-level partial refunds. Whole-order cancellation already restocks via `batchAllocations` replay (see `orders.cancel`). |
| Order discounts | Not built | Neither line-level nor order-level discounts implemented. Would add `discount: PricingStrategy` per line and per order. |
| Session persistence across reloads | Not built | Multi-session ("tabs") works, but state lives in memory. Backing with localStorage or a server-side store is future work for real cashier workflows. |
| Image upload | Not built | `imageUrl` is a URL string only. Backend needed for file uploads; storage choice (S3, local) and thumbnail generation TBD. |
| Excel/CSV import (`/products/import`) | Not built | Planned. Will use SheetJS `xlsx` client-side, row-per-SKU flat format with `Parent SKU` for variants, attribute columns (`Color`, `Size`), one price column per pricelist (`Retail Price`, `Wholesale Price`). Pricing strategies + tiers will be UI-only (import sets fixed prices) |
| Accounts Payable for POs | Not built | Currently receive() updates stock + cost, but no AP entry is created. When accounting lands, standard POs will create AP on receipt; consignment POs will create AP per-sale instead. |
| Customer → pricelist assignment | Not built | At checkout, a customer's `pricelistId` should drive `priceForQty` lookup |
| Orphaned `PricelistEntry` cleanup | Not done | When a Pricelist is deleted, dangling entries on products are harmless (fallback to default) but a sweep helper would tidy things |
| Backwards-compatible accordion on cards | Considered | If the form ever feels too long for products with both packagings and variants, make the card headers collapsible (accordion) rather than introduce tabs |
| Inventory movement log | Not built | Adjustments and sales create batches / decrement `qtyRemaining`, but there's no audit log surface. Could derive from batch creation timestamps + order batchAllocations for a future Movement view. |
| Multi-branch / multi-store | Not built | Single-store only. The current `Location` model covers multi-zone within one store (Etalase / Rak / Gudang); branching to multiple physical stores would need a `Store` axis above `Location`. |
| Per-location reorder points | Not built | A "low at Etalase, plenty at Gudang" alert that auto-suggests a transfer would close the loop on the manual move flow. |
| Movement log persistence / pruning | Not built | In-memory; resets on reload. Real audit needs a server-side append-only store with retention policy and tamper-evidence (hash chain). |
| Auth-bound performer tracking | Not built | `StockMovement.performedBy` snapshots `user.current.name` (hardcoded). When real session auth lands, switch to `employeeId`. |

---

## Glossary

| Term | Meaning |
|---|---|
| **Base unit** | The smallest unit you count in (e.g., `pcs`). Lives on `Product.unitId`. |
| **Packaging** | An alternative sellable form, e.g., a box of 24. `factor` is how many base units it contains. |
| **Variant** | A variation of a product (Red/M T-shirt vs Blue/L T-shirt). Each has own SKU, cost, prices, stock. |
| **Attribute** | An option type (`Color`, `Size`). Has a name + list of values. Used by the variant generator. |
| **Pricelist** | A customer tier (Retail, Wholesale, VIP). Determines which `PricelistEntry` applies. |
| **Pricelist entry** | A product's (or variant's, or packaging's) sale pricing for one pricelist. Has a base strategy + optional volume tiers. |
| **Pricing strategy** | How sale price relates to cost. Fixed price, cost + amount, or cost × markup%. |
| **Tier** | A higher-quantity override inside a pricelist entry. `{minQty, pricing}`. Highest matching `minQty` wins. |
| **Cost** | Per-base-unit cost. Lives on individual `Batch` rows (`unitCost`); the manual `product.cost` is a bootstrap fallback used when no owned batches exist. `currentCost(productId, variantId?)` returns the weighted average across remaining owned batches. |
| **Sale price** | What the customer pays. Computed from `cost + pricing` at read time. Never stored. |
| **Markup %** | Pricing strategy: `sale = cost × (1 + pct/100)`. |
| **Cost + amount** | Pricing strategy: `sale = cost + amount`. |
| **Fixed price** | Pricing strategy: `sale = value`, ignores cost. |
| **Tax rate** | A percentage applied on top of sale price (e.g., PPN 11%). Resolved per product via fallback chain. |
| **PPN** | Pajak Pertambahan Nilai — Indonesian VAT, standard 11% per UU HPP. |
| **Consignment / titipan** | Inventory supplied by a vendor that the store doesn't pay for until sold. Tracked via consignment-type Purchase Orders rather than a flag on the product. |
| **Supplier** | A vendor that supplies products via Purchase Orders. Master-data resource at `/suppliers`. |
| **Purchase Order (PO)** | A document recording an order placed with a supplier. Has a type (`standard` / `consignment`) that drives AP behavior on receipt. |
| **Goods receipt** | The act of marking a PO as received. Creates one `Batch` row per line; no scalar stock or cost mutation. |
| **Batch** | One received quantity of a (product, variant?) with its own `unitCost`, `qtyRemaining`, `ownership` (`owned` \| `consignment`), source PO, and `receivedAt` date. The single source of truth for stock. See [`CONSIGNMENT.md`](./CONSIGNMENT.md). |
| **Batch ownership** | `owned` (the retailer paid for it via a standard PO or initial seeding) or `consignment` (the consignor still owns it; we owe per-unit only on sale). `currentCost` only averages owned batches. |
| **FIFO depletion** | Sale deducts from batches ordered by `expiresAt` ASC, then `receivedAt` ASC. `applyOrderToStock` walks `batches.forStock(...)` and decrements `qtyRemaining` soonest-expiring first, then oldest-first. **No location preference** — perishables are protected regardless of where they sit. Location-aware filtering is available via `forStock(productId, variantId?, { locationIds })` but the sales path doesn't use it. |
| **Location** | A physical storage zone in the store (Etalase, Rak Belakang, Gudang). Lives on every `Batch` via `locationId`. Customer-visible flag controls whether stock there counts toward "displayed to pelanggan." Opt-in via `settings.inventory.locationsEnabled` — when off, the UI surface hides everywhere but the data model still records `locationId: 'loc_gudang'` by default. |
| **Move stock / pindahkan** | Splitting a batch's remaining quantity by location. Source batch decrements; a sibling is created at the destination preserving every other field. The Pindahkan modal on `/inventory` walks source batches by expiry asc so the admin moves expiring stock to Etalase first. |
| **Stock movement / pergerakan stok** | An entry in the audit ledger (`StockMovement`). Written by every batch mutation site when `auditTrailEnabled` is on. Carries kind, qty delta, qty-after, unit cost, reference doc, performer, timestamp. The single source of truth for "what happened to this product." |
| **Opname / stok opname** | Cycle count / physical audit. Admin picks a location + product scope, snapshots expected qty, enters counted qty, and the system records the difference as shrinkage (variance < 0) or surplus (variance > 0) via batch adjustments referenced back to the opname. Routes at `/stock-opname`. |
| **Shrinkage** | Negative variance discovered during opname — stock that exists in the system but not on the shelf. Most common cause: theft, breakage, miscounting. Reported as `|negativeVariance| × unitCost` aggregated per opname. |
| **Selidiki (investigate)** | Per-row action on the opname count screen that opens a side panel timeline of recent `StockMovement` rows for that (product, variant?, location). Used to trace where a missing unit went. |
| **Stock adjustment** | Manual change to on-hand quantity that doesn't come from a PO or sale (write-off, found stock, count correction, initial seed via the product form). Positive deltas create a new owned batch; negative deltas LIFO-decrement owned batches. |
| **Composite product** | A product built from other products (bundles, recipes, manufactured goods). `kind === 'composite'`; `cost` and `stock` are derived from components. |
| **Bundle** | A composite product whose components are typically sold individually too (e.g., "Coffee + Croissant Combo"). |
| **BOM (Bill of Materials)** | A composite product whose components are ingredients (e.g., "Mie Tek-Tek = noodle + egg + mayo"). Same data model as bundle; intent differs. |
| **Product kind** | The discriminator `'goods' \| 'composite'` chosen at the top of the product form. Filters which feature chips (packagings, components) appear. |
| **Per-variant recipe** | Each variant of a composite product can have its own `components` array, so e.g. Combo Small / Medium / Large can have different ingredient quantities. |
| **Extras / modifiers** | Optional add-ons picked at sale time (sauces, toppings, gift wrap). Each has a price delta and optional stock impact. Apply to either kind. |
| **Lead time / Waktu tunggu** | Typical days from placing an order to receiving goods. Stored on `Supplier.leadTimeDays` (global per supplier) with optional per-product override on `ProductSupplier.leadTimeDays`. Used for reorder-point math on /forecast. UI label: "Waktu tunggu". |
| **Buffer / Cadangan** | Extra days of safety stock added on top of waktu tunggu in the reorder formula. `bufferDays` arg defaults to 7. UI label: "Cadangan". |

---

## Newer features (built 2026-05-15)

The sections above describe the foundation. The features below extend it — payment lifecycle on orders + POs, the two finance pages, the per-product history view + reusable timeline component, the forecast subsystem, and a few POS terminal improvements. All described at the code-shape level (types, helpers, file paths); rationale for each lives in [Part II — Key design decisions](#key-design-decisions).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Section di atas menggambarkan fondasi. Fitur di bawah memperluasnya — lifecycle pembayaran di order + PO, dua halaman finansial (utang/piutang), tampilan history per-produk + komponen timeline reusable, subsistem forecast, dan beberapa peningkatan POS terminal. Semua dideskripsikan di level code-shape (tipe, helper, path file); rationale tiap fitur ada di [Part II — Key design decisions](#key-design-decisions).

</details>

### Customer credit flag (`Customer.creditAllowed`)

```ts
// src/lib/stores/customers.svelte.ts
type Customer = {
  ...existing fields...
  creditAllowed: boolean;  // default false. Walk-in always treated as false.
};
```

Toggled per customer in the customer form (and in the inline "Tambah" modal on `/pos`). When `false`, the POS terminal refuses to complete any transaction where `paymentAmount < total`. Default seed: `cust_1`, `cust_2`, `cust_3` are `true`; `cust_4` (Siti Rahayu, walk-in regular) stays `false`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Toggle per customer di form customer (dan di modal "Tambah" inline di `/pos`). Saat `false`, POS terminal menolak menyelesaikan transaksi apa pun di mana `paymentAmount < total`. Default seed: `cust_1`, `cust_2`, `cust_3` `true`; `cust_4` (Siti Rahayu, langganan walk-in) tetap `false`.

</details>

### Order payments lifecycle (`status: 'credit'`)

```ts
// src/lib/stores/orders.svelte.ts
export type OrderStatus = 'paid' | 'credit' | 'cancelled';

export type OrderPayment = {
  id: string;        // opay_<uuid>
  amount: number;
  method: PaymentMethod;
  at: string;        // ISO datetime
  notes: string;
};

export type Order = {
  ...existing fields...
  paidAmount: number;        // cumulative payments received
  payments: OrderPayment[];  // chronological, includes the initial payment
};
```

**Behaviors:**
- `orders.add(input)` auto-seeds the first `OrderPayment` from the cart's `paymentMethod` + `paidAmount` when `paidAmount > 0`. So a fully-paid order has `payments: [oneEntry]` and a fully-credit order has `payments: []`.
- `orders.recordPayment(orderId, { amount, method, notes? })` appends a payment, increments `paidAmount`, flips status to `'paid'` when `paidAmount >= total`. Rejects overpay (`amount > outstanding`) and cancelled orders.
- `orderStatusLabels.credit = 'Piutang'`.

**POS validation** (`charge()` in `/pos/+page.svelte`):
- Computes `isPartialCash = isCash && paymentAmount < cartTotal`.
- If partial cash AND walk-in → blocked with toast.
- If partial cash AND customer without `creditAllowed` → blocked with toast.
- Otherwise: `paidAmount = isCash ? min(paymentAmount, cartTotal) : cartTotal`, `status = paidAmount >= total ? 'paid' : 'credit'`.
- Inline amber banner shows expected sisa piutang; rose banner explains rejection.
- Button copy switches from `Bayar Rp X` → `Catat piutang` when partial-cash + permitted.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Perilaku:**
- `orders.add(input)` auto-seed `OrderPayment` pertama dari `paymentMethod` + `paidAmount` cart saat `paidAmount > 0`. Jadi order yang fully-paid punya `payments: [oneEntry]` dan order fully-credit punya `payments: []`.
- `orders.recordPayment(orderId, { amount, method, notes? })` menambahkan payment, naikkan `paidAmount`, flip status ke `'paid'` saat `paidAmount >= total`. Menolak overpay dan order cancelled.
- `orderStatusLabels.credit = 'Piutang'`.

**Validation POS** (`charge()` di `/pos/+page.svelte`):
- Hitung `isPartialCash = isCash && paymentAmount < cartTotal`.
- Kalau partial cash DAN walk-in → di-block dengan toast.
- Kalau partial cash DAN customer tanpa `creditAllowed` → di-block dengan toast.
- Selain itu: `paidAmount = isCash ? min(paymentAmount, cartTotal) : cartTotal`, `status = paidAmount >= total ? 'paid' : 'credit'`.
- Banner amber inline menampilkan sisa piutang yang diharapkan; banner rose menjelaskan penolakan.
- Copy tombol switch dari `Bayar Rp X` → `Catat piutang` saat partial-cash + diizinkan.

</details>

### PurchaseOrder payments lifecycle

```ts
// src/lib/stores/purchaseOrders.svelte.ts
export type PurchaseOrderPaymentMethod = 'cash' | 'transfer' | 'other';

export type PurchaseOrderPayment = {
  id: string;        // popay_<uuid>
  amount: number;
  method: PurchaseOrderPaymentMethod;
  at: string;
  notes: string;
};

export type PurchaseOrder = {
  ...existing fields...
  paidAmount: number;
  payments: PurchaseOrderPayment[];
};
```

`purchaseOrders.recordPayment(poId, { amount, method, notes? })`:
- Rejects consignment POs (use `/payouts` instead).
- Rejects cancelled POs.
- Rejects overpay.
- Appends payment, increments `paidAmount`. (No status field flip — `PurchaseOrderStatus` is about receipt lifecycle, not payment.)

`poTotal(po) - po.paidAmount` is the outstanding utang.

Default seed: `PO-2026-001` paid 200k of 490k, `PO-2026-005` paid 100k of 477k. Drives non-empty `/utang` on first paint.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`purchaseOrders.recordPayment(poId, { amount, method, notes? })`:
- Menolak PO konsinyasi (pakai `/payouts`).
- Menolak PO cancelled.
- Menolak overpay.
- Tambahkan payment, naikkan `paidAmount`. (Tidak ada flip status field — `PurchaseOrderStatus` tentang lifecycle penerimaan, bukan pembayaran.)

`poTotal(po) - po.paidAmount` adalah utang outstanding.

Default seed: `PO-2026-001` paid 200k dari 490k, `PO-2026-005` paid 100k dari 477k. Menggerakkan `/utang` non-empty saat first paint.

</details>

### `/utang` — Accounts payable to suppliers

`src/routes/utang/+page.svelte`. Standalone page; not an extension of `/payouts` (consignment payouts are deliberately separate, see [decision](#separate-utang--piutang-pages)).

**Row set:** every standard PO with status in `{sent, partial, received}` and `outstanding > 0` (default). Cancelled and drafts excluded.

**Stat cards:** total committed, total paid, total outstanding.

**Filters:** search (code/supplier/notes), supplier Select, status (`'open' | 'paid' | ''`), date range.

**Row actions:** Detail modal (payment timeline + Buka PO link) + Bayar modal (calls `purchaseOrders.recordPayment`).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`src/routes/utang/+page.svelte`. Halaman standalone; bukan ekstensi `/payouts` (payout konsinyasi sengaja dipisah, lihat [decision](#separate-utang--piutang-pages)).

**Set row:** tiap PO standard dengan status di `{sent, partial, received}` dan `outstanding > 0` (default). Cancelled dan draft dikecualikan.

**Stat card:** total committed, total paid, total outstanding.

**Filter:** search (code/supplier/notes), Select supplier, status (`'open' | 'paid' | ''`), date range.

**Aksi row:** modal Detail (timeline pembayaran + link Buka PO) + modal Bayar (panggil `purchaseOrders.recordPayment`).

</details>

### `/piutang` — Accounts receivable from customers

`src/routes/piutang/+page.svelte`. Standalone page.

**Row set:** orders with `customerId` set AND (`status === 'credit'` OR `status === 'paid' && payments.length > 1`). The second clause keeps historical multi-payment lifecycle orders visible in the "paid" view.

**Per-customer rekap card** (above the main table): groups outstanding by `customerId`, sorted by outstanding desc. Click a row to filter the main table. Shows a red "Piutang tidak diizinkan" badge when the customer's `creditAllowed` is false (data-integrity safety net).

**Stat cards:** total dijual on credit, total received, total outstanding.

**Filters:** search, customer, status (`'open' | 'paid' | ''`), date range.

**Row actions:** Detail modal (payment timeline + Buka pesanan link) + Terima modal (calls `orders.recordPayment`).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`src/routes/piutang/+page.svelte`. Halaman standalone.

**Set row:** order dengan `customerId` ter-set DAN (`status === 'credit'` OR `status === 'paid' && payments.length > 1`). Klausa kedua menjaga order multi-payment historis tetap terlihat di tampilan "paid".

**Card rekap per-customer** (di atas tabel utama): grup outstanding berdasarkan `customerId`, terurut outstanding desc. Klik row untuk filter tabel utama. Menampilkan badge merah "Piutang tidak diizinkan" saat `creditAllowed` customer adalah false (safety net integritas data).

**Stat card:** total dijual on credit, total received, total outstanding.

**Filter:** search, customer, status (`'open' | 'paid' | ''`), date range.

**Aksi row:** modal Detail (timeline pembayaran + link Buka pesanan) + modal Terima (panggil `orders.recordPayment`).

</details>

### `<MovementTimeline>` component

```svelte
<!-- src/lib/components/inventory/MovementTimeline.svelte -->
<script lang="ts">
  type Props = {
    movements: StockMovement[];
    emptyTitle?: string;
    emptyHint?: string;
    onImageClick?: (movement: StockMovement) => void;
  };
</script>
```

Vertical timeline (left border + colored dots). Each row: kind Badge with up/down arrow, signed colored qty delta, "→ sisa N", `Intl.DateTimeFormat('id-ID')` timestamp, performer, clickable reference code (link based on `reference.kind` → `/purchase-orders/[id]`, `/orders/[id]`, `/stock-opname/[id]`), reason badge, 40×40 image thumbnail, notes line.

Used by:
- Opname Selidiki panel (`/stock-opname/[id]`).
- Per-product history page (`/inventory/[productId]/history`).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Timeline vertikal (border kiri + dot berwarna). Tiap row: badge kind dengan panah atas/bawah, qty delta bertanda + berwarna, "→ sisa N", timestamp `Intl.DateTimeFormat('id-ID')`, performer, kode reference yang clickable (link berdasarkan `reference.kind` → `/purchase-orders/[id]`, `/orders/[id]`, `/stock-opname/[id]`), badge alasan, thumbnail gambar 40×40, line catatan.

Dipakai oleh:
- Panel Selidiki opname (`/stock-opname/[id]`).
- Halaman history per-produk (`/inventory/[productId]/history`).

</details>

### `/inventory/[productId]/history` — Per-product timeline

`src/routes/inventory/[productId]/history/+page.svelte`. Full-page audit story for one product.

**Header card:** product name + SKU. Back link to `/inventory`. Audit-off empty state when toggle is disabled.

**5 stat cards:**
- **Stok saat ini** — `stockOf(productId, variantFilter?)` with per-location breakdown when locations on.
- **Diterima** — sum of `receive` qtyDelta in window.
- **Terjual** — net of `sale` − `sale-cancel` deltas.
- **Penyesuaian** — split `+/-` of `adjust-in` / `adjust-out`, with shrinkage value (`Σ |negative adjust × unitCost|`) in IDR.
- **Pemindahan** — separate ↑ `move-in` / ↓ `move-out` totals.

**Filter strip:** search, variant Select (when product has variants), kind, location (when on), reason, date range.

**Timeline:** `<MovementTimeline>` fed with `stockMovements.forProduct(productId, variantId?)` filtered by the strip. Image preview Modal for clicked thumbs.

**Entry points to this page:**
- `/inventory` row Activity icon (when `auditOn`).
- "Lihat riwayat lengkap" link in the inventory Batches modal footer.
- "Buka riwayat lengkap" link in the opname Selidiki panel footer.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`src/routes/inventory/[productId]/history/+page.svelte`. Cerita audit lengkap per produk.

**Header card:** nama produk + SKU. Link kembali ke `/inventory`. Empty state audit-off saat toggle dimatikan.

**5 stat card:**
- **Stok saat ini** — `stockOf(productId, variantFilter?)` dengan breakdown per-lokasi saat lokasi aktif.
- **Diterima** — sum qtyDelta `receive` dalam window.
- **Terjual** — net delta `sale` − `sale-cancel`.
- **Penyesuaian** — split `+/-` `adjust-in` / `adjust-out`, dengan nilai shrinkage (`Σ |negative adjust × unitCost|`) dalam IDR.
- **Pemindahan** — total ↑ `move-in` / ↓ `move-out` terpisah.

**Strip filter:** search, Select varian (saat produk punya varian), kind, lokasi (saat aktif), alasan, date range.

**Timeline:** `<MovementTimeline>` di-feed `stockMovements.forProduct(productId, variantId?)` yang difilter oleh strip. Modal preview gambar untuk thumb yang diklik.

**Entry point ke halaman ini:**
- Ikon Activity row `/inventory` (saat `auditOn`).
- Link "Lihat riwayat lengkap" di footer modal Batches inventory.
- Link "Buka riwayat lengkap" di footer panel Selidiki opname.

</details>

### Forecast subsystem

```ts
// src/lib/utils/forecast.ts
export function dailySalesRate(productId, variantId?, windowDays = 30): number;
export function currentStockFor(productId, variantId?): number;
export function daysOfSupply(productId, variantId?, windowDays = 30): number;
export function suggestedReorderQty({
  productId, variantId?, windowDays?, leadDays?, bufferDays?
}): number;
export function runwayBandFor(days): 'critical' | 'low' | 'watch' | 'ok' | 'inactive';
export const runwayBandLabels: Record<RunwayBand, string>;
export const runwayBandVariant: Record<RunwayBand, 'danger'|'warning'|'info'|'success'|'neutral'>;
export function formatRunway(days): string;        // '5.2 hari', 'Tidak ada penjualan', etc.
export function leadDaysFor(productId): number;     // resolves Supplier.leadTimeDays via Product.defaultSupplierId
export function forecastSubjects(): ForecastSubject[]; // flat list of (product, variant?) pairs
```

**Method:** sums non-cancelled `order.lines.quantity × unitFactor` for matching `(productId, variantId)` over the window, divides by windowDays. Works for goods + composites because every order line carries the parent productId (composites count "1 combo per line" regardless of how many ingredient units it consumed). Sales of ingredients via composites also count at the ingredient level via `applyOrderToStock` → `deductComponents` movements.

**Composite support:** `currentStockFor` picks `producibleStock` / `producibleVariantStock` for composites; `stockOf` for goods.

**Suggested reorder formula:** `ceil(rate × (lead + buffer))` where `lead = Supplier.leadTimeDays` and `buffer = bufferDays` arg (default 7).

**Bands:**
| Band | Days of supply | Use |
|---|---|---|
| `critical` | ≤3 (or negative) | Reorder hari ini |
| `low` | 4–7 | Reorder minggu ini |
| `watch` | 8–14 | Pantau, siapkan PO |
| `ok` | >14 | Belum perlu tindakan |
| `inactive` | `Infinity` (no sales) | Tidak ada data |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Metode:** menjumlahkan `order.lines.quantity × unitFactor` order non-cancelled yang match `(productId, variantId)` selama window, dibagi windowDays. Jalan untuk goods + komposit karena tiap line order bawa productId parent (komposit dihitung "1 combo per line" terlepas berapa unit bahan yang dikonsumsi). Penjualan bahan via komposit juga dihitung di level bahan via `applyOrderToStock` → `deductComponents` movement.

**Dukungan komposit:** `currentStockFor` memilih `producibleStock` / `producibleVariantStock` untuk komposit; `stockOf` untuk goods.

**Formula suggested reorder:** `ceil(rate × (lead + buffer))` di mana `lead = Supplier.leadTimeDays` dan `buffer = arg bufferDays` (default 7).

**Band:**
| Band | Hari pasokan | Penggunaan |
|---|---|---|
| `critical` | ≤3 (atau negatif) | Reorder hari ini |
| `low` | 4–7 | Reorder minggu ini |
| `watch` | 8–14 | Pantau, siapkan PO |
| `ok` | >14 | Belum perlu tindakan |
| `inactive` | `Infinity` (tanpa penjualan) | Tidak ada data |

</details>

### `/forecast` — Prediksi Stok page

`src/routes/forecast/+page.svelte`.

**5 colored stat cards** counting items per band (Kritis / Menipis / Perhatikan / Aman / Tidak ada penjualan), filtered by category + location.

**Filter strip:** search, window (7/14/30/60/90), category, location (when on), urgency band, "Sembunyikan tanpa penjualan" toggle.

**Tunable buffer-days input** in the strip between header and rows — affects suggested reorder live.

**Table** sorted by runway asc, with rows: product+variant (linked to `/inventory/[id]/history`, with optional "Komposit" badge), stock with unit suffix, velocity ("~24/hari pcs"), runway Badge, suggested reorder qty with "lead 7h + buffer 7h" sub-line, supplier name (or "Belum di-set").

**Empty states** differentiate "no products" / "no products + hide-no-sales" / "no match for filter."

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`src/routes/forecast/+page.svelte`.

**5 stat card berwarna** menghitung item per band (Kritis / Menipis / Perhatikan / Aman / Tidak ada penjualan), difilter kategori + lokasi.

**Strip filter:** search, window (7/14/30/60/90), kategori, lokasi (saat aktif), band urgency, toggle "Sembunyikan tanpa penjualan".

**Input buffer-days yang bisa di-tune** di strip antara header dan row — mempengaruhi suggested reorder secara live.

**Tabel** terurut runway asc, dengan row: product+variant (link ke `/inventory/[id]/history`, dengan badge opsional "Komposit"), stock dengan suffix unit, velocity ("~24/hari pcs"), Badge runway, suggested reorder qty dengan sub-line "lead 7h + buffer 7h", nama supplier (atau "Belum di-set").

**Empty state** membedakan "tidak ada produk" / "tidak ada produk + sembunyikan no-sales" / "tidak match filter".

</details>

### Per-row forecast badge on `/inventory`

Small pill in the stock cell, shown only when `daysOfSupply(row.id, undefined, 30)` lands in `critical` / `low` / `watch` band. Colored rose / amber / sky to match band. Hidden for `ok` and `inactive` to avoid clutter. Title attr: "Berdasarkan rata-rata penjualan 30 hari terakhir."

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Pill kecil di sel stock, hanya muncul saat `daysOfSupply(row.id, undefined, 30)` masuk band `critical` / `low` / `watch`. Warna rose / amber / sky sesuai band. Disembunyikan untuk `ok` dan `inactive` supaya tidak ramai. Title attr: "Berdasarkan rata-rata penjualan 30 hari terakhir."

</details>

### POS card quick-pick (variants + packagings)

Product cards in `/pos` grow a button strip below the main click area:

- **Has variants only** — one button per variant: `+ White ·N`, `+ Black ·N` (with per-variant available stock). Disables individual buttons when that variant has 0 stock.
- **Has packagings only** — `+ base` plus one per packaging: `+ Pack ·6`, `+ Box ·24`. Each tap = new cart line at that unit.
- **Both** — variant strip wins; packaging is switched on the cart line after add.
- **Neither** — no strip; main card click still adds 1 base unit.

Main click on the card still adds **first variant + base unit** (backward compatibility — cashier in a hurry doesn't have to aim).

`addToCart(p, variantId?, unitId?, unitFactor = 1)`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Card produk di `/pos` mendapat strip tombol di bawah area klik utama:

- **Hanya punya varian** — satu tombol per varian: `+ White ·N`, `+ Black ·N` (dengan stok available per-varian). Disable tombol individual saat varian itu stok 0.
- **Hanya punya packaging** — `+ base` plus satu per packaging: `+ Pack ·6`, `+ Box ·24`. Tiap tap = line cart baru di unit itu.
- **Keduanya** — strip varian menang; packaging di-switch di line cart setelah ditambah.
- **Tidak keduanya** — tidak ada strip; klik utama card tetap menambah 1 base unit.

Klik utama di card tetap menambah **varian pertama + base unit** (backward compatibility — kasir yang terburu-buru tidak perlu mengarah).

`addToCart(p, variantId?, unitId?, unitFactor = 1)`.

</details>

### Inline "+ Tambah" customer on `/pos`

Small dashed-border button next to the Pelanggan label in the cart sidebar. Opens a focused modal:
- Name (required)
- Phone
- Type (Individu/Bisnis)
- Daftar harga
- `creditAllowed` Toggle
- Notes

Save → calls `customers.add(...)` with empty defaults for the rest (email/address/taxId), sets `joinedAt` to today, then auto-sets `session.customerId = created.id` so the new customer is immediately active in the tab.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tombol dashed-border kecil di samping label Pelanggan di sidebar cart. Membuka modal fokus dengan field: Name (wajib), Phone, Type (Individu/Bisnis), Daftar harga, Toggle `creditAllowed`, Notes.

Save → panggil `customers.add(...)` dengan default kosong untuk sisanya (email/address/taxId), set `joinedAt` ke hari ini, lalu auto-set `session.customerId = created.id` supaya customer baru langsung aktif di tab.

</details>

### Atur Stok reason + image

```ts
// src/lib/stores/stockMovements.svelte.ts
export type StockAdjustmentReason =
  | 'damaged' | 'expired' | 'lost' | 'sample'
  | 'found' | 'initial-seed' | 'correction' | 'other';

export const adjustmentReasonLabels: Record<StockAdjustmentReason, string>;
export const adjustmentReasonsForOut: StockAdjustmentReason[];  // damaged/expired/lost/sample/correction/other
export const adjustmentReasonsForIn: StockAdjustmentReason[];   // found/initial-seed/correction/other

export type StockMovement = {
  ...existing fields...
  reason?: StockAdjustmentReason;
  imageUrl?: string;   // optional data URL via FileReader.readAsDataURL
};
```

`batches.adjustStock(...)` gains `reason?` and `imageUrl?` args; forwards both to `stockMovements.log` for every emitted row (both positive new-batch path and negative LIFO walk).

`/inventory` Atur stok modal:
- Required Alasan Select. Options switch based on Add/Subtract mode — picking Tambah shows only intake reasons, Kurangi shows only outflow reasons. Mode toggle resets the selection.
- Foto bukti uploader (dashed drop zone) → FileReader → data URL. 96×96 preview with "Hapus foto" button.
- Save validates reason set. If notes left blank, auto-fills with the reason label.

`/stock-movements`:
- Notes column renders 32×32 thumbnail (clickable → opens full image in a Modal with caption `MOV-… · Product · Reason`) + reason Badge + existing notes text.
- Toolbar gains a reason filter Select.
- Search matches the reason label too.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`batches.adjustStock(...)` mendapat arg `reason?` dan `imageUrl?`; meneruskan keduanya ke `stockMovements.log` untuk tiap row yang di-emit (baik path new-batch positif maupun LIFO walk negatif).

Modal Atur stok di `/inventory`:
- Select Alasan wajib. Opsi switch berdasarkan mode Add/Subtract — pilih Tambah hanya menampilkan alasan masuk, Kurangi hanya alasan keluar. Toggle mode mereset pilihan.
- Uploader Foto bukti (drop zone dashed) → FileReader → data URL. Preview 96×96 dengan tombol "Hapus foto".
- Save mem-validasi reason ter-set. Kalau notes dibiarkan kosong, auto-fill dengan label reason.

`/stock-movements`:
- Kolom Notes render thumbnail 32×32 (clickable → buka gambar penuh di Modal dengan caption `MOV-… · Product · Reason`) + Badge reason + teks notes yang sudah ada.
- Toolbar mendapat Select filter reason.
- Search juga cocokkan label reason.

</details>

### Three move flows (scan basket, bulk picker)

In addition to the existing per-row `Pindah` modal:

**`/inventory/move/scan`** — scan-first basket. Top: destination Select. Center: large autofocused input that accepts `BATCH-YYYY-NNN`, variant SKU, or product SKU (parent SKU rejected on multi-variant products). Enter → `resolveToken` resolves to a specific batch and adds (or increments) a row in the basket. Each basket row has its own qty stepper + unit selector (when product has packagings — qty stored in BASE, display in chosen unit, steppers move by `factor`). Submit fires `moveStock` per item with a shared `transferGroupId`. Input refocuses after each scan and after submit for hands-free workflow.

**`/inventory/move/bulk`** — from-location batch picker. Pick source location once → batch list at source sorted by expiry asc. Each row: checkbox + per-row unit selector + qty input (default = batch qtyRemaining, capped). "Pilih semua" / "Pilih yang mendekati kedaluwarsa" / "Bersihkan" quick-actions. Submit moves all selected with shared `transferGroupId`.

Both flows: `batches.moveStock` accepts an optional `transferGroupId` so multi-batch transfers group as one logical operation in the ledger.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Di samping modal `Pindah` per-row yang sudah ada:

**`/inventory/move/scan`** — basket scan-first. Atas: Select destination. Tengah: input besar autofocused yang menerima `BATCH-YYYY-NNN`, SKU varian, atau SKU produk (SKU parent ditolak untuk produk multi-varian). Enter → `resolveToken` resolusi ke batch spesifik dan menambah (atau naikkan) row di basket. Tiap row basket punya qty stepper + selector unit sendiri (saat produk punya packaging — qty disimpan dalam BASE, display di unit terpilih, stepper bergerak dengan `factor`). Submit memicu `moveStock` per item dengan `transferGroupId` yang sama. Input auto-refocus setelah tiap scan dan setelah submit untuk workflow hands-free.

**`/inventory/move/bulk`** — pemilih batch from-location. Pilih lokasi sumber sekali → daftar batch di sumber terurut expiry asc. Tiap row: checkbox + selector unit per-row + input qty (default = qtyRemaining batch, di-cap). Quick-action "Pilih semua" / "Pilih yang mendekati kedaluwarsa" / "Bersihkan". Submit memindahkan semua yang dipilih dengan `transferGroupId` yang sama.

Kedua flow: `batches.moveStock` menerima `transferGroupId` opsional supaya transfer multi-batch ter-grup sebagai satu operasi logis di ledger.

</details>

### Sidebar additions

New nav items added by these features:
- "Lokasi" — Data Master group (gated on `locationsEnabled`).
- "Opname Stok" — Katalog group (gated on `auditTrailEnabled`).
- "Riwayat Stok" — Wawasan group (gated on `auditTrailEnabled`).
- "Prediksi Stok" — Wawasan group (always shown).
- "Utang Pembelian" — new **Keuangan** group.
- "Piutang Pelanggan" — new **Keuangan** group.

`/payouts` (Pembayaran Konsinyasi) stays under Pengadaan (consignment-specific).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Item nav baru yang ditambah fitur ini:
- "Lokasi" — group Data Master (gated `locationsEnabled`).
- "Opname Stok" — group Katalog (gated `auditTrailEnabled`).
- "Riwayat Stok" — group Wawasan (gated `auditTrailEnabled`).
- "Prediksi Stok" — group Wawasan (selalu tampil).
- "Utang Pembelian" — group **Keuangan** baru.
- "Piutang Pelanggan" — group **Keuangan** baru.

`/payouts` (Pembayaran Konsinyasi) tetap di Pengadaan (konsinyasi-specific).

</details>

### Helpers quick reference (additions)

| Helper | Returns | Notes |
|---|---|---|
| `orders.recordPayment(id, { amount, method, notes? })` | `{ ok, reason?, order? }` | Appends `OrderPayment`, updates `paidAmount`, flips status to `'paid'` when fully covered. Rejects overpay/cancelled. |
| `purchaseOrders.recordPayment(id, { amount, method, notes? })` | `{ ok, reason?, po? }` | Same for POs. Rejects consignment POs (use `/payouts`) + cancelled + overpay. |
| `dailySalesRate(productId, variantId?, windowDays = 30)` | `number` | Σ `quantity × unitFactor` for non-cancelled order lines in window ÷ windowDays. |
| `currentStockFor(productId, variantId?)` | `number` | Picks `producibleStock`/`producibleVariantStock` for composites, `stockOf` for goods. |
| `daysOfSupply(productId, variantId?, windowDays = 30)` | `number` | `currentStock / rate`; `Infinity` when no sales. |
| `suggestedReorderQty({ productId, variantId?, leadDays?, bufferDays? = 7 })` | `number` | `ceil(rate × (lead + buffer))`. 0 when no sales. |
| `runwayBandFor(days)` | `'critical'\|'low'\|'watch'\|'ok'\|'inactive'` | ≤3 / ≤7 / ≤14 / >14 / no-sales. |
| `formatRunway(days)` | `string` | "5.2 hari" / "Tidak ada penjualan" / "Sudah habis" / "<1 hari". |
| `leadDaysFor(productId)` | `number` | Resolves `Product.defaultSupplierId` → `Supplier.leadTimeDays`. |
| `forecastSubjects()` | `ForecastSubject[]` | Flat list of (product, variant?) pairs for forecast iteration. |
| `customers.add({ ..., creditAllowed })` | `Customer` | Extends existing add; `creditAllowed` defaults false in form, true in seed for selected customers. |

### File map (additions)

```
src/lib/stores/
  customers.svelte.ts         + creditAllowed field on Customer
  orders.svelte.ts            + OrderStatus 'credit', OrderPayment, paidAmount, payments, recordPayment
  purchaseOrders.svelte.ts    + PurchaseOrderPaymentMethod, PurchaseOrderPayment, paidAmount, payments, recordPayment
  stockMovements.svelte.ts    + StockAdjustmentReason types + labels + option lists; movement reason/imageUrl fields
  batches.svelte.ts           + adjustStock reason/imageUrl args; moveStock transferGroupId; moveProductStock wrapper

src/lib/utils/
  forecast.ts                 NEW — daily rate, days of supply, reorder, runway bands, subject iterator

src/lib/components/inventory/
  MovementTimeline.svelte     NEW — reusable vertical timeline component

src/routes/
  customers/+page.svelte      + creditAllowed Toggle in form
  pos/+page.svelte            + quick-pick variant/packaging buttons, + Tambah customer modal, piutang validation
  inventory/+page.svelte      + forecast badge in stock cell, Riwayat row action, reason+image in Atur modal,
                               Lihat batch modal "Lihat riwayat lengkap" footer
  inventory/[productId]/history/+page.svelte  NEW
  inventory/move/scan/+page.svelte            NEW
  inventory/move/bulk/+page.svelte            NEW
  stock-movements/+page.svelte                + reason filter, reason badge + image thumb + preview modal
  stock-opname/[id]/+page.svelte              + multi-packaging count input, Selidiki uses MovementTimeline,
                                                "Buka riwayat lengkap" footer link
  utang/+page.svelte          NEW
  piutang/+page.svelte        NEW
  forecast/+page.svelte       NEW
```

### Seed data summary (drives non-empty first-paint demos)

- **14 orders** (`ORD-2026-001..014`): 1 cancelled (Espresso), 4 paid Telur/Daging (referenced from movements), 7 paid consignment-mug sales (drive `/payouts` owed for `sup_3`), 2 credit orders (`ORD-013` Andi partial 100k/166.5k, `ORD-014` PT Distributor full credit 122.1k → drive `/piutang`).
- **26 movements** total. Anchored to seed batches; each batch's final qtyAfter matches its current `qtyRemaining` for full reconciliation.
- **10 opnames** (`OPN-2026-001..010`): 1 with Telur shrinkage (cross-linked from `mov_seed_10`), 6 zero-variance completed, 2 drafts, 1 cancelled.
- **3 payouts** to `sup_3` (200k + 150k + 80k = 430k paid of 510k owed → 80k outstanding).
- **2 PO partial payments** (PO-2026-001 200k of 490k, PO-2026-005 100k of 477k).
- Batches reconciled: `batch_1` 116/120, `batch_2` 78/80, `batch_4` 12/18, `batch_5` 8/12, `batch_6` 3/6, others unchanged.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Ringkasan seed data yang menggerakkan demo first-paint non-empty:

- **14 order** (`ORD-2026-001..014`): 1 cancelled (Espresso), 4 paid Telur/Daging (di-reference dari movement), 7 paid penjualan mug konsinyasi (menggerakkan `/payouts` utang untuk `sup_3`), 2 order kredit (`ORD-013` Andi parsial 100k/166.5k, `ORD-014` PT Distributor full credit 122.1k → menggerakkan `/piutang`).
- **26 movement** total. Di-anchor ke batch seed; final qtyAfter tiap batch cocok dengan `qtyRemaining` saat ini untuk rekonsiliasi penuh.
- **10 opname** (`OPN-2026-001..010`): 1 dengan shrinkage Telur (cross-link dari `mov_seed_10`), 6 zero-variance completed, 2 draft, 1 cancelled.
- **3 payout** ke `sup_3` (200k + 150k + 80k = 430k paid dari 510k owed → 80k outstanding).
- **2 PO partial payment** (PO-2026-001 200k dari 490k, PO-2026-005 100k dari 477k).
- Batch direkonsiliasi: `batch_1` 116/120, `batch_2` 78/80, `batch_4` 12/18, `batch_5` 8/12, `batch_6` 3/6, sisanya tidak berubah.

</details>

---

## Shift & Kas (built 2026-05-15)

Cashier shift tracking with PIN authentication, planned shift templates, and per-shift cash reconciliation (drawer in/out + variance against cash sales). Opt-in via `settings.operations.shiftsEnabled` (default on); when off, POS works as before and no shift attribution happens.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Pelacakan shift kasir dengan otentikasi PIN, template shift terencana, dan rekonsiliasi kas per-shift (drawer in/out + variance terhadap penjualan tunai). Opt-in via `settings.operations.shiftsEnabled` (default on); saat off, POS jalan seperti biasa dan tidak ada atribusi shift.

</details>

### `Employee.pin`

```ts
// src/lib/stores/employees.svelte.ts
type Employee = {
  ...existing fields...
  pin: string;  // 4-digit numeric, plaintext for the scaffold
};
employees.verifyPin(employeeId, pin): boolean;
```

PIN is enforced unique across employees at the form-validation layer in `/employees`. Re-seeded with Indonesian warmindo-context names (Sari Wahyuni admin, Joko Susilo manajer, Rina Marlina kasir, Andi Pratama kasir, Dimas Saputra staf).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

PIN harus unik antar karyawan, dipaksakan di layer validasi form di `/employees`. Re-seed dengan nama konteks warmindo Indonesia (Sari Wahyuni admin, Joko Susilo manajer, Rina Marlina kasir, Andi Pratama kasir, Dimas Saputra staf).

</details>

### `ShiftTemplate`

```ts
// src/lib/stores/shiftTemplates.svelte.ts
type ShiftTemplate = {
  id: string;
  name: string;          // "Pagi", "Sore", "Malam"
  startTime: string;     // "HH:MM"
  endTime: string;       // "HH:MM" — wraps past midnight (22:00 → 06:00 OK)
  notes: string;
  status: 'active' | 'archived';
};
plannedDurationHours(t): number;   // handles overnight wrap
formatShiftRange(t): string;       // "06:00–14:00"
```

Templates are **labels + planned hours**, not hard gates. Actual start/end is logged from real time at open/close. CRUD inlined into `/settings` page (no separate route).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Template adalah **label + jam yang direncanakan**, bukan gate keras. Start/end aktual di-log dari waktu nyata saat open/close. CRUD inline ke halaman `/settings` (tidak ada route terpisah).

</details>

### `ShiftSession`

```ts
// src/lib/stores/shifts.svelte.ts
type CashDenomination = { unit: number; count: number };
type CashCount = {
  total: number;
  denominations?: CashDenomination[];  // optional — collapsed by default
};
type CashEntry = {
  id: string;
  at: string;
  kind: 'in' | 'out';
  category: CashEntryCategory;  // modal-tambahan | beli-bahan | operasional | ...
  amount: number;
  notes: string;
  performedBy: string;
};
type ShiftSession = {
  id: string;
  code: string;          // SHF-YYYY-NNN
  employeeId: string;
  templateId?: string;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed' | 'cancelled';
  openingCash: CashCount;
  closingCash?: CashCount;
  expectedClosingCash?: number;  // computed at close
  variance?: number;             // closingCash.total - expectedClosingCash
  entries: CashEntry[];
  notes: string;
};
```

Store API: `shifts.open()`, `shifts.addEntry()`, `shifts.removeEntry()`, `shifts.close()`, `shifts.cancel()`, `shifts.active()`. Only ONE shift can be open at a time (`open()` rejects when one is already active).

Helpers:
- `expectedClosingCash(shift)` — openingCash + cash sales in window + cash entries (in) - cash entries (out)
- `salesSummary(shift)` — `{ orderCount, grossTotal, byMethod, outstandingCredit }`, scoped to orders where `shiftId === shift.id` AND created within the open/close window
- `cashSalesIn(shift)` — sum of `OrderPayment` where method='cash' and time within the shift window
- `denominationTotal(denoms[])` — `sum(unit × count)`
- `shiftDurationHours(s)` / `formatDuration(hours)`

`IDR_DENOMINATIONS` constant (`[100000, 50000, ..., 100]`) drives the optional per-pecahan input rows. The `CashCountInput` component (in `src/lib/components/shifts/`) wraps a `MoneyInput` for the total with a collapsible "Hitung per pecahan" section that, when expanded, syncs total to `sum(unit × count)` live.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

API store: `shifts.open()`, `shifts.addEntry()`, `shifts.removeEntry()`, `shifts.close()`, `shifts.cancel()`, `shifts.active()`. Hanya SATU shift bisa terbuka pada satu waktu (`open()` menolak saat sudah ada yang aktif).

Helper:
- `expectedClosingCash(shift)` — openingCash + cash sales dalam window + cash entries (in) - cash entries (out)
- `salesSummary(shift)` — `{ orderCount, grossTotal, byMethod, outstandingCredit }`, di-scope ke order di mana `shiftId === shift.id` DAN dibuat dalam window open/close
- `cashSalesIn(shift)` — sum `OrderPayment` di mana method='cash' dan waktunya dalam window shift
- `denominationTotal(denoms[])` — `sum(unit × count)`
- `shiftDurationHours(s)` / `formatDuration(hours)`

Konstanta `IDR_DENOMINATIONS` (`[100000, 50000, ..., 100]`) menggerakkan row input per-pecahan opsional. Komponen `CashCountInput` (di `src/lib/components/shifts/`) membungkus `MoneyInput` untuk total dengan section "Hitung per pecahan" yang collapsible — saat dibuka, sinkronkan total ke `sum(unit × count)` live.

</details>

### `Order.shiftId` attribution

```ts
type Order = {
  ...existing fields...
  shiftId?: string;     // populated by POS only when shifts feature is on AND an active shift exists
};
```

Soft attribution — POS never blocks sales for absent shift. When shifts off, `shiftId` stays undefined and `salesSummary` falls back to time-window matching only.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Atribusi lunak — POS tidak pernah memblokir penjualan saat shift tidak ada. Saat shift off, `shiftId` tetap undefined dan `salesSummary` jatuh ke match window waktu saja.

</details>

### Routes

| Route | What it does |
|---|---|
| `/shifts` | List of all shifts. Stat cards (active count, closed today, today's cash sales, today's variance). Filter by employee/status/date. Active shift banner pinned to top. |
| `/shifts/[id]` | Detail page. Header card (employee + template + duration + notes). Catatan kas card (opening cash, sales-tunai, each cash entry, expected total). Rekap penjualan card (count, gross, per-method breakdown, piutang baru). Pesanan list at the bottom. Actions: Tambah kas / Tutup shift / Batalkan (when open). |
| `/settings` | Hosts the shifts toggle + shift template editor (add/edit/archive/delete templates inline). |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

| Route | Fungsinya |
|---|---|
| `/shifts` | List semua shift. Stat card (jumlah active, closed hari ini, penjualan tunai hari ini, variance hari ini). Filter via karyawan/status/tanggal. Banner shift active di-pin di atas. |
| `/shifts/[id]` | Halaman detail. Card header (karyawan + template + durasi + notes). Card catatan kas (kas awal, sales-tunai, tiap entry kas, total seharusnya). Card rekap penjualan (count, gross, breakdown per-metode, piutang baru). Daftar Pesanan di bawah. Aksi: Tambah kas / Tutup shift / Batalkan (saat open). |
| `/settings` | Host toggle shift + editor template shift (tambah/edit/archive/delete template inline). |

</details>

### Components (`src/lib/components/shifts/`)

| File | Purpose |
|---|---|
| `CashCountInput.svelte` | Bindable `CashCount` field. Total via `MoneyInput`, optional collapsible denomination breakdown that syncs total. |
| `OpenShiftModal.svelte` | Pick employee → PIN entry (4-digit, show/hide toggle) → pick template (or "Bebas") → opening cash → optional notes. Verifies PIN via `employees.verifyPin`, opens via `shifts.open`. |
| `CloseShiftModal.svelte` | Shows live ringkasan (kas awal + tunai + entries → seharusnya), enters closing cash (with optional denom breakdown), live variance preview color-coded (emerald/sky/rose). Calls `shifts.close`. |
| `CashEntryModal.svelte` | In/out toggle (color-coded buttons), category Select (different lists for in vs out), MoneyInput, notes Textarea. Calls `shifts.addEntry`. |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

| File | Fungsinya |
|---|---|
| `CashCountInput.svelte` | Field `CashCount` bindable. Total via `MoneyInput`, breakdown denominasi opsional yang collapsible yang sinkronkan total. |
| `OpenShiftModal.svelte` | Pilih karyawan → input PIN (4 digit, toggle show/hide) → pilih template (atau "Bebas") → kas awal → notes opsional. Verifikasi PIN via `employees.verifyPin`, buka via `shifts.open`. |
| `CloseShiftModal.svelte` | Tampilkan ringkasan live (kas awal + tunai + entries → seharusnya), input kas akhir (dengan breakdown denom opsional), preview variance live berkode-warna (emerald/sky/rose). Panggil `shifts.close`. |
| `CashEntryModal.svelte` | Toggle in/out (tombol berkode-warna), Select kategori (daftar berbeda untuk in vs out), MoneyInput, Textarea notes. Panggil `shifts.addEntry`. |

</details>

### POS terminal integration (`/pos`)

When `shiftsEnabled` is on:
- **Active shift banner** (emerald): cashier name, code, template label, open time, live order count + cash total, "Tambah kas" / "Detail" / "Tutup shift" buttons.
- **No active shift banner** (amber): "Belum ada shift terbuka" + "Buka shift" button. Sales still allowed (soft gate).
- New orders auto-stamp `shiftId` and `employeeId` from `shifts.active()`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat `shiftsEnabled` on:
- **Banner shift aktif** (emerald): nama kasir, code, label template, jam buka, count order + total tunai live, tombol "Tambah kas" / "Detail" / "Tutup shift".
- **Banner tidak ada shift aktif** (amber): "Belum ada shift terbuka" + tombol "Buka shift". Penjualan tetap diizinkan (gate lunak).
- Order baru auto-stamp `shiftId` dan `employeeId` dari `shifts.active()`.

</details>

### Sidebar

When `shiftsEnabled` is on, a new "Operasional" group appears with "Shift Kasir" → `/shifts` (icon: `CalendarClock`). When off, the group is hidden.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat `shiftsEnabled` on, group "Operasional" baru muncul dengan "Shift Kasir" → `/shifts` (ikon: `CalendarClock`). Saat off, group disembunyikan.

</details>

### Decision: PIN, not session login

The user wants PIN-based clock-in rather than username/password login or just a dropdown pick. PIN strikes the right balance for warmindo: fast (4 digits), prevents misattribution if a kasir accidentally picks the wrong name, and doesn't require an auth stack the rest of the app doesn't have. PIN is stored plaintext at the scaffold level — when persistence + real auth land, hash it.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

User ingin clock-in berbasis PIN, bukan login username/password atau sekadar dropdown pick. PIN seimbang untuk warmindo: cepat (4 digit), cegah salah-atribusi kalau kasir tidak sengaja pilih nama yang salah, dan tidak butuh stack auth yang belum dimiliki app. PIN disimpan plaintext di level scaffold — saat persistence + auth real masuk, hash dulu.

</details>

### Decision: Soft attribution (no shift required to sell)

Other POS systems hard-gate sales behind an open shift. Warmindo are flexible — owner sometimes operates without formal shifts during quiet hours, and forcing a shift open would create friction. POS allows sales either way; the amber "no shift" banner is advisory. When backed by real auth + multiple registers, this can grow into per-register required shifts; for now soft attribution is the right default.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

POS lain men-gate keras penjualan di belakang shift yang terbuka. Warmindo fleksibel — owner kadang operasi tanpa shift formal di jam sepi, dan memaksa shift terbuka akan menciptakan friction. POS izinkan jual di kedua kondisi; banner amber "tidak ada shift" sifatnya advisory. Saat di-back auth real + banyak register, ini bisa berkembang jadi shift required per-register; untuk sekarang atribusi lunak adalah default yang tepat.

</details>

### Decision: Per-shift cash drawer, not per-register

A single open shift at a time, drawer is whichever cashier is logged in. Multi-cashier parallel shifts (e.g., front register + delivery register) is plausible but deferred. The store's `active()` returns the single open session; `open()` rejects if one is already open.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Satu shift terbuka pada satu waktu, drawer adalah milik kasir yang login. Shift paralel multi-kasir (mis. register depan + register delivery) masuk akal tapi ditunda. `active()` store mengembalikan satu session terbuka; `open()` tolak kalau sudah ada yang terbuka.

</details>

### Decision: Cash entries inline, not separate ledger

Cash in/out lives **inside** the shift session as `entries[]`, not as a global cash ledger. Reason: every cash entry happens within a shift context (someone authorized it on their watch), and a global "kas keluar" history can be derived later by flattening `shifts[].entries[]`. Keeps the data model tight; no orphan rows.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Cash in/out tinggal **di dalam** session shift sebagai `entries[]`, bukan sebagai ledger kas global. Alasannya: tiap cash entry terjadi dalam konteks shift (seseorang mengotorisasinya di waktu kerjanya), dan history "kas keluar" global bisa diturunkan kemudian dengan flatten `shifts[].entries[]`. Menjaga data model tetap rapat; tidak ada row yatim.

</details>

### Shift schedule (jadwal shift)

Owner/admin plans which employee works which template on which day — for one week, one month, or one year — without manually creating each day.

```ts
// src/lib/stores/shiftSchedule.svelte.ts
type AssignmentStatus = 'planned' | 'completed' | 'absent' | 'replaced';
type ShiftAssignment = {
  id: string;
  date: string;              // YYYY-MM-DD
  templateId: string;
  employeeId: string;
  notes: string;
  status: AssignmentStatus;
  actualShiftId?: string;    // populated when the planned assignment turns into a real ShiftSession
};
```

Store API:
- `add`, `update`, `remove`, `getById`
- `forDate(iso)` / `forRange(start, end)` / `forEmployee(id, opts)`
- `bulkGenerate({ startDate, endDate, pattern, skipExisting?, notes? })` — `pattern` is `Record<dayOfWeek 0..6, WeekdayPattern[]>` where each slot is `{ templateId, employeeId }`. Walks the date range, emits assignments per slot for matching day-of-week, dedupes (date + template + employee) when `skipExisting`. Returns `{ created, skipped, invalid }`.
- `markCompleted(assignmentId, shiftSessionId)` — flips `status` → `completed` and links to the real session.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Owner/admin merencanakan karyawan mana yang bekerja di template mana di hari mana — untuk satu minggu, satu bulan, atau satu tahun — tanpa membuat tiap hari secara manual.

API store:
- `add`, `update`, `remove`, `getById`.
- `forDate(iso)` / `forRange(start, end)` / `forEmployee(id, opts)`.
- `bulkGenerate({ startDate, endDate, pattern, skipExisting?, notes? })` — `pattern` adalah `Record<dayOfWeek 0..6, WeekdayPattern[]>` di mana tiap slot berisi `{ templateId, employeeId }`. Walk date range, emit assignment per slot untuk day-of-week yang cocok, dedup (date + template + employee) saat `skipExisting`. Mengembalikan `{ created, skipped, invalid }`.
- `markCompleted(assignmentId, shiftSessionId)` — flip `status` → `completed` dan link ke session nyata.

</details>

### `/shifts/schedule` — monthly calendar

- 6-row × 7-column grid, week starts Senin (Indonesian convention).
- Each cell shows up to 3 assignment chips (employee initials + template name), color-coded by template (5-color palette cycling by template index). Overflow shows `+N`.
- Click empty cell → `AssignmentModal` (add single).
- Click chip → `AssignmentModal` (edit/delete).
- Month nav (chevrons + "Hari ini" button), legend showing template colors, total assignments count for the visible month.
- Generate Massal CTA opens `BulkGenerateModal`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- Grid 6 baris × 7 kolom, minggu mulai Senin (konvensi Indonesia).
- Tiap sel menampilkan sampai 3 chip assignment (initial karyawan + nama template), berkode-warna per template (palette 5-warna cycling per index template). Overflow tampil `+N`.
- Klik sel kosong → `AssignmentModal` (tambah satu).
- Klik chip → `AssignmentModal` (edit/delete).
- Nav bulan (chevron + tombol "Hari ini"), legend yang tampilkan warna template, total assignment untuk bulan terlihat.
- CTA Generate Massal membuka `BulkGenerateModal`.

</details>

### `BulkGenerateModal`

- Date range with quick buttons: **+1 minggu / +1 bulan / +1 tahun** (jump endDate relative to startDate).
- Per-day-of-week section (Senin → Minggu order). Each day has 0+ slots; admin clicks "Tambah slot" to append `(template Select + employee Select)` rows.
- "Tiru ke semua hari" button on a day's header — copies that day's slot list to every other day. Useful for uniform schedules ("kasir yang sama setiap hari").
- "Lewati jadwal yang sudah ada" checkbox (default on) — bulkGenerate dedupes via `skipExisting`.
- Submit toasts e.g., "12 jadwal dibuat · 3 dilewati (sudah ada)".

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- Date range dengan tombol cepat: **+1 minggu / +1 bulan / +1 tahun** (loncatkan endDate relatif ke startDate).
- Section per-hari (urutan Senin → Minggu). Tiap hari punya 0+ slot; admin klik "Tambah slot" untuk append row `(Select template + Select karyawan)`.
- Tombol "Tiru ke semua hari" di header sebuah hari — salin daftar slot hari itu ke tiap hari lain. Berguna untuk jadwal seragam ("kasir sama tiap hari").
- Checkbox "Lewati jadwal yang sudah ada" (default on) — bulkGenerate dedup via `skipExisting`.
- Toast submit mis. "12 jadwal dibuat · 3 dilewati (sudah ada)".

</details>

### `AssignmentModal`

- Template Select + Employee Select + notes Textarea.
- Delete button visible when editing.
- When the assignment was already `completed` (linked to a real shift), an info Alert warns that changes here don't affect the running shift.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- Select template + Select karyawan + Textarea notes.
- Tombol delete terlihat saat sedang edit.
- Saat assignment sudah `completed` (link ke shift nyata), Alert info memperingatkan bahwa perubahan di sini tidak mempengaruhi shift yang berjalan.

</details>

### POS prefill from today's schedule

`OpenShiftModal` consults `shiftSchedule.forDate(today)` when it opens. If any `planned` assignment is found, it prefills `employeeId` and `templateId` from the first one and shows an info Alert "Sesuai jadwal hari ini". Cashier still types the PIN to verify. On successful `shifts.open()`, the prefilled assignment is auto-marked `completed` via `markCompleted`. Cashier can override the prefill freely (handles last-minute swaps).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`OpenShiftModal` melihat `shiftSchedule.forDate(today)` saat dibuka. Kalau ada assignment `planned` yang ketemu, ia prefill `employeeId` dan `templateId` dari yang pertama dan menampilkan Alert info "Sesuai jadwal hari ini". Kasir tetap ketik PIN untuk verifikasi. Saat `shifts.open()` sukses, assignment yang prefilled auto-mark `completed` via `markCompleted`. Kasir bisa override prefill bebas (menangani swap last-minute).

</details>

### `/shifts` schedule preview banner

When there's no active shift but today has planned assignments, a sky-blue banner lists today's planned shifts (template · employee) at the top of `/shifts`, with a "Lihat kalender" button. Decays to nothing once a shift opens (the green active-shift banner takes precedence).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat tidak ada shift aktif tapi hari ini ada assignment yang direncanakan, banner biru-langit menampilkan jadwal hari ini (template · karyawan) di atas `/shifts`, dengan tombol "Lihat kalender". Hilang saat shift dibuka (banner shift-aktif hijau didahulukan).

</details>

### Decisions

**Day-of-week pattern (not interval).** Bulk-generate keys the pattern by Sen/Sel/Rab/… instead of "every N days" or rrule-style recurrence. Most warmindo schedules cycle weekly with different staffing on weekends — `Record<0..6, slots[]>` covers this with zero ceremony.

**Schedule prefills, doesn't lock.** OpenShiftModal prefills but allows override. Hard-locking to scheduled employees would block legitimate last-minute swaps; soft prefill captures the 90% common case while staying flexible.

**Calendar starts Senin.** Indonesian week convention. Day headers ordered `[1, 2, 3, 4, 5, 6, 0]` to map Senin → Minggu.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Pola day-of-week (bukan interval).** Bulk-generate meng-key pattern via Sen/Sel/Rab/… alih-alih "tiap N hari" atau rekursi gaya rrule. Mayoritas jadwal warmindo siklik mingguan dengan staffing berbeda di weekend — `Record<0..6, slots[]>` menutup ini tanpa upacara.

**Schedule prefill, tidak mengunci.** OpenShiftModal prefill tapi izinkan override. Mengunci keras ke karyawan terjadwal akan memblokir swap last-minute yang sah; prefill lunak menangkap kasus umum 90% sambil tetap fleksibel.

**Kalender mulai Senin.** Konvensi minggu Indonesia. Header hari diurutkan `[1, 2, 3, 4, 5, 6, 0]` untuk map Senin → Minggu.

</details>

## Diskon & Promo (built 2026-05-15)

Promotion engine covering four kinds, auto-applied at POS with predictable stacking (max 1 line-level promo per line + max 1 order-level promo on top).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Mesin promo yang menutup empat kind, auto-apply di POS dengan stacking yang dapat diprediksi (maks 1 promo line-level per line + maks 1 promo order-level di atas).

</details>

### `Promotion`

```ts
// src/lib/stores/promotions.svelte.ts
type PromoKind = 'discount' | 'combo' | 'bogo' | 'member-tier';
type PromoLevel = 'line' | 'order';
type DiscountUnit = 'percent' | 'fixed';

type ComboItem = {
  productId: string;
  variantId?: string;
  unitId?: string;       // when set: strict unit match (e.g. only when bought in box)
  unitFactor?: number;   // base units per unitId (default 1)
  quantity: number;      // in unitId, or base if unset
};

type Promotion = {
  id: string;
  code: string;          // PRM-NNN
  name: string;
  kind: PromoKind;
  level: PromoLevel;

  // discount fields
  discountUnit?: 'percent' | 'fixed';
  discountValue?: number;

  // combo fields
  comboItems?: ComboItem[];
  comboPrice?: number;

  // bogo fields (buy and get sides can be in different units)
  buyQuantity?: number;
  getQuantity?: number;
  bogoProductId?: string;       // optional limit to a single product
  bogoVariantId?: string;       // optional variant filter
  buyUnitId?: string;           // when set: buy line must be in this unit
  buyUnitFactor?: number;       // base units per buy unit (default 1)
  getUnitId?: string;           // when set: free units measured in this unit
  getUnitFactor?: number;       // base units per get unit (default 1)

  // member-tier fields
  memberPricelistId?: string;   // customer must be on this pricelist
  memberPercentOff?: number;

  // Scope (applies mainly to discount + bogo)
  productIds?: string[];
  categoryIds?: string[];
  minimumPurchase?: number;     // order-level minimum

  // Activation window
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];        // 0..6 (Sun..Sat)
  hourStart?: string;
  hourEnd?: string;             // wraps past midnight

  // Tracking
  status: 'active' | 'scheduled' | 'expired' | 'archived';
  usageCount: number;
  usageLimit?: number;

  description: string;
  notes: string;
};
```

Helpers:
- `isWithinPromoWindow(p, at)` — checks date / days-of-week / hour windows
- `isPromoUsable(p, at)` — status === 'active' AND within window AND not over limit
- `promotions.usableAt(at)` — list of currently-usable promos
- `promotions.incrementUsage(id)` — bumps counter after a sale

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Helper:
- `isWithinPromoWindow(p, at)` — cek window tanggal / day-of-week / jam.
- `isPromoUsable(p, at)` — status === 'active' AND dalam window AND belum lewat limit.
- `promotions.usableAt(at)` — daftar promo yang saat ini bisa dipakai.
- `promotions.incrementUsage(id)` — naikkan counter setelah penjualan.

</details>

### Promo resolver

```ts
// src/lib/utils/promoResolver.ts
type CartLineForPromo = { id, productId, variantId?, unitFactor, quantity, baseQuantity, unitPrice, subtotal };
type AppliedPromo = { promoId, promoCode, promoName, kind, level, affectedLineIds, discountAmount, description };

resolvePromos({ lines, customer, at, dismissedPromoIds }): AppliedPromo[];
distributePromosAcrossLines(lines, applied): Map<lineId, { lineDiscount, orderDiscountShare }>;
```

Algorithm:
1. **Combos consume across lines.** For each combo promo, count how many bundles can be claimed against `remaining[productId|variantId]` map. Bundle size = sum(item.quantity). Consume from `remaining`, push `AppliedPromo` with `discount = bundles × (originalPrice − comboPrice)`.
2. **BOGO per (product, variant)** on remaining quantity. `bundles = floor(remainingQty / (buyQuantity + getQuantity))`, `discount = bundles × getQuantity × unitPrice`.
3. **Line-level discount (% / Rp)** — pick the single best (max discount) per line, filtered by scope. Scope match uses OR semantic: empty `productIds` and empty `categoryIds` → applies to all products; only `productIds` → only those; only `categoryIds` → all in those; both filled → line matches if it's in `productIds` OR its category is in `categoryIds` (union, not intersection). Discount applies to the remaining (post-combo/bogo) subtotal share.
4. **Order-level promo** — among all `level === 'order'` candidates (incl. `member-tier` which requires `customer.pricelistId === memberPricelistId`), pick the one yielding max discount on `netSubtotal = subtotal − lineDiscountTotal`.

`distributePromosAcrossLines` then maps total promo discount back to per-line: line-level apportioned by subtotal share across affected lines; order-level apportioned across ALL lines by post-line-discount net subtotal.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Algoritma:
1. **Combo dikonsumsi lintas-line.** Untuk tiap promo combo, hitung berapa bundle bisa diklaim terhadap map `remaining[productId|variantId]`. Ukuran bundle = sum(item.quantity). Konsumsi dari `remaining`, push `AppliedPromo` dengan `discount = bundles × (originalPrice − comboPrice)`.
2. **BOGO per (product, variant)** pada qty sisa. `bundles = floor(remainingQty / (buyQuantity + getQuantity))`, `discount = bundles × getQuantity × unitPrice`.
3. **Diskon line-level (% / Rp)** — pilih satu yang terbaik (max discount) per line, difilter scope. Match scope pakai semantic OR: `productIds` dan `categoryIds` kosong → berlaku untuk semua produk; cuma `productIds` → cuma itu; cuma `categoryIds` → semua di sana; keduanya terisi → line cocok kalau dia di `productIds` ATAU kategorinya di `categoryIds` (union, bukan intersection). Diskon berlaku pada subtotal share sisa (post-combo/bogo).
4. **Promo order-level** — di antara semua kandidat `level === 'order'` (termasuk `member-tier` yang mengharuskan `customer.pricelistId === memberPricelistId`), pilih yang menghasilkan max discount pada `netSubtotal = subtotal − lineDiscountTotal`.

`distributePromosAcrossLines` lalu memetakan total promo discount kembali ke per-line: line-level diapportion berdasarkan share subtotal di antara line yang terdampak; order-level diapportion lintas SEMUA line via net subtotal post-line-discount.

</details>

### POS cart integration

```ts
// In /pos
const linesForPromo = $derived(...);   // shape from cart
const appliedPromos = $derived(resolvePromos({ lines, customer, at: new Date(), dismissedPromoIds }));
const promoDiscount = $derived(sum(applied.discountAmount));
const promoDistribution = $derived(distributePromosAcrossLines(...));

// Per-line net:
lineDiscountFor(l) = distribution[l.id].lineDiscount + distribution[l.id].orderDiscountShare
lineNetSubtotalFor(l) = max(0, lineSubtotal − lineDiscountFor(l))
lineTaxNetFor(l) = lineNetSubtotalFor(l) × taxRate / 100
cartTax = sum(lineTaxNetFor)              // tax recomputed on net (PPN on harga setelah diskon)
cartNetSubtotal = cartSubtotal − promoDiscount
cartTotal = cartNetSubtotal + cartTax
```

Cart panel renders an emerald "Promo aktif" stripe between Subtotal and Pajak, showing each applied promo with name + `−Rp X` + dismiss `×` button. Dismissed promos appear below in muted with "Pulihkan" to re-add. Saved on `CartSession.dismissedPromoIds: string[]` per tab.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Panel cart me-render strip emerald "Promo aktif" antara Subtotal dan Pajak, menampilkan tiap promo aktif dengan nama + `−Rp X` + tombol dismiss `×`. Promo yang di-dismiss muncul di bawah dengan style muted dan tombol "Pulihkan" untuk re-add. Disimpan di `CartSession.dismissedPromoIds: string[]` per tab.

</details>

### Order snapshot

```ts
type OrderLine = { ..., linePromoDiscount?, lineSubtotalNet?, ... };
type Order = { ..., appliedPromos?: OrderPromoApplication[], promoDiscount?, netSubtotal?, ... };
```

All new fields are optional so seed data remains valid. POS `charge()`:
1. Re-maps each cart-line ID → fresh order-line ID
2. Translates `affectedLineIds` in applied promos to order-line IDs
3. Computes `linePromoDiscount`, `lineSubtotalNet`, `lineTax` (on net) per line
4. Persists `appliedPromos`, `promoDiscount`, `netSubtotal` on the Order
5. Calls `promotions.incrementUsage(promoId)` once per applied promo

`/orders/[id]` receipt panel renders the applied promos as a green inset between subtotal and tax, plus a "Hemat Rp X" line under total.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Semua field baru opsional supaya seed data tetap valid. POS `charge()`:
1. Remap ID tiap line cart → ID line order baru.
2. Translate `affectedLineIds` di applied promo ke ID line order.
3. Hitung `linePromoDiscount`, `lineSubtotalNet`, `lineTax` (pada net) per line.
4. Persist `appliedPromos`, `promoDiscount`, `netSubtotal` di Order.
5. Panggil `promotions.incrementUsage(promoId)` sekali per applied promo.

Panel receipt `/orders/[id]` me-render applied promo sebagai inset hijau antara subtotal dan pajak, plus line "Hemat Rp X" di bawah total.

</details>

### Routes & sidebar

- `/promotions` — list with stat cards (aktif now, total, berakhir 7 hari, total dipakai), filters by kind/status, table with kind icon + level badge + value summary + period + usage / limit. "Tambah promo" CTA.
- `/promotions/[id]` — dynamic route; `id === 'new'` means create. Conditional sections per kind (discount → unit + value; combo → items list + price; bogo → buy/get/optional product; member-tier → pricelist + percent). Common scope/period/limit cards in right sidebar.
- Sidebar: "Diskon & Promo" entry at the top group (next to Pesanan), icon `BadgePercent`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- `/promotions` — list dengan stat card (aktif sekarang, total, berakhir 7 hari, total dipakai), filter via kind/status, tabel dengan ikon kind + badge level + ringkasan value + period + usage / limit. CTA "Tambah promo".
- `/promotions/[id]` — route dinamis; `id === 'new'` artinya create. Section kondisional per kind (discount → unit + value; combo → daftar item + harga; bogo → buy/get/produk opsional; member-tier → pricelist + percent). Card scope/period/limit umum di sidebar kanan.
- Sidebar: entry "Diskon & Promo" di group atas (di sebelah Pesanan), ikon `BadgePercent`.

</details>

### Decisions

**Auto-apply with dismiss.** Resolver runs on every cart change; cashier doesn't have to remember to apply. Dismiss button per promo gives explicit opt-out for edge cases (e.g., customer waives a combo to get bigger BOGO discount on other items). Dismissed list is per-cart-tab.

**Stacking: best-line + best-order.** Each line gets at most one line-level promo (combo > bogo > discount priority via consumption order). One order-level promo on top. Predictable, common, and prevents negative-total bugs.

**Tax recomputed on net.** PPN in Indonesia is charged on harga jual, so discount must come pre-tax. Each line's tax is recomputed using its net (post-discount) subtotal, ensuring `cartTotal` = `(subtotal − discount) + tax_on_net`.

**Combo consumes across lines.** A combo of (Mi + Es Teh) where customer has 3 Mi and 2 Es Teh yields 2 bundles. Remaining 1 Mi can still receive other line-level promos (e.g., BOGO if applicable). Combo isn't "all-or-nothing".

**Per-line tax handled via redistribution.** Order-level discount distributes proportionally across all lines by their post-line-discount net subtotal, then each line's tax recomputes. This is more complex than a flat `taxTotal -= discount × rate` but matches how Indonesian receipts must show line-level tax.

**Optional fields on Order/OrderLine.** New promo fields are all optional so existing seed data (17 orders) and existing helpers (`/utang`, `/piutang`, `/orders`) work without modification. `order.total` is already post-promo, so credit math and aging continue to be correct.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Auto-apply dengan dismiss.** Resolver jalan di tiap perubahan cart; kasir tidak perlu ingat untuk apply. Tombol dismiss per-promo memberi opt-out eksplisit untuk edge case (mis. customer rela lepas combo demi BOGO yang lebih besar di item lain). Daftar dismissed per-cart-tab.

**Stacking: best-line + best-order.** Tiap line dapat maks satu promo line-level (prioritas combo > bogo > discount via urutan konsumsi). Satu promo order-level di atas. Dapat diprediksi, umum, dan cegah bug total negatif.

**Pajak dihitung ulang pada net.** PPN di Indonesia dikenakan pada harga jual, jadi diskon harus datang pre-tax. Pajak tiap line dihitung ulang via net subtotal (post-diskon), memastikan `cartTotal` = `(subtotal − discount) + tax_on_net`.

**Combo dikonsumsi lintas-line.** Combo (Mi + Es Teh) saat customer punya 3 Mi dan 2 Es Teh menghasilkan 2 bundle. Sisa 1 Mi tetap bisa terima promo line-level lain (mis. BOGO kalau berlaku). Combo bukan "all-or-nothing".

**Pajak per-line ditangani via redistribusi.** Diskon order-level didistribusikan proporsional lintas semua line via net subtotal post-line-discount, lalu pajak tiap line dihitung ulang. Ini lebih kompleks dari `taxTotal -= discount × rate` polos tapi cocok dengan cara struk Indonesia harus menampilkan pajak per-line.

**Field opsional di Order/OrderLine.** Semua field promo baru opsional supaya seed data lama (17 order) dan helper lama (`/utang`, `/piutang`, `/orders`) jalan tanpa modifikasi. `order.total` sudah post-promo, jadi math kredit dan aging tetap benar.

</details>

### Unit & variant matching (added 2026-05-15)

Promos can target specific packaging units and specific variants:

- **ComboItem** can specify `unitId + unitFactor` (strict unit match: a 6-pack box only satisfies the requirement when the customer bought it in the box unit). Without unit: any unit accepted, qty counted in base units.
- **BOGO** can specify `buyUnitId + buyUnitFactor` on the buy side and `getUnitId + getUnitFactor` on the get side. When they differ, the resolver counts each side's eligible cart-line quantity separately and claims `min(buyBundles, getBundles)`. When they match, single-pool bundle math (current behavior) applies.
- **BOGO** also gains `bogoVariantId` to restrict to a single variant (e.g., "Beli 2 Mug Black gratis 1 Mug Black").

Resolver helpers:
- `lineMatches(line, productId, variantId?, unitId?, unitFactor?)` — line-by-line filter
- `availableFor(...)` — total remaining base units across matching lines
- `consume(...)` — FIFO deduction from matching lines, returns affected line ids
- `unitPriceForMatch(...)` — picks unit price from first matching line (used to price the "free" side of a cross-unit BOGO)

Suggestion helpers (`suggestCombos`, `suggestBogos`) include `unitLabel` per `needed` row, so the cart can render "Tambah 1 box × 6 Cola untuk dapat Combo X" instead of bare "Tambah 1 Cola".

Seed example (PRM-006): "Beli 1 Box Cola Gratis 1 Pcs" with `bogoProductId='prd_5'`, `buyUnitId='unit_2', buyUnitFactor=6, buyQuantity=1`, `getUnitId='unit_1', getUnitFactor=1, getQuantity=1`. Customer adds 1 box + 1 pcs of Cola → BOGO claims 1 bundle, discounts 1 × Cola pcs price (Rp 8.000).

**Decision — strict unit match, not flexible.** When a promo says "1 box", the customer must actually buy a 1-box line; 6 individual pcs don't count. This matches retail intent (bulk-buy gets the gift) and is more predictable than fuzzy base-unit aggregation across packaging.

**Decision — separate buy/get pools for cross-unit BOGO.** "Beli 1 box gratis 1 pcs" requires BOTH the box and the pcs to be in cart (cashier adds the free pcs line). Discount applies to the pcs line. Without the pcs in cart, the suggestion strip prompts "Tambah 1 pcs untuk gratis 1 pcs".

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Promo dapat menarget unit packaging dan varian spesifik:

- **ComboItem** dapat menentukan `unitId + unitFactor` (strict unit match: box 6-pak hanya memenuhi syarat saat customer beli dalam unit box). Tanpa unit: unit apa pun diterima, qty dihitung dalam base unit.
- **BOGO** dapat menentukan `buyUnitId + buyUnitFactor` di sisi buy dan `getUnitId + getUnitFactor` di sisi get. Saat berbeda, resolver hitung qty cart-line eligible tiap sisi terpisah dan klaim `min(buyBundles, getBundles)`. Saat sama, math bundle single-pool (perilaku lama) berlaku.
- **BOGO** juga dapat `bogoVariantId` untuk batasi ke satu varian (mis. "Beli 2 Mug Black gratis 1 Mug Black").

Helper resolver:
- `lineMatches(line, productId, variantId?, unitId?, unitFactor?)` — filter per-line.
- `availableFor(...)` — total base unit tersisa lintas line yang cocok.
- `consume(...)` — pengurangan FIFO dari line yang cocok, mengembalikan ID line yang terdampak.
- `unitPriceForMatch(...)` — pilih unit price dari line pertama yang cocok (dipakai untuk price sisi "gratis" dari BOGO cross-unit).

Helper saran (`suggestCombos`, `suggestBogos`) menyertakan `unitLabel` per row `needed`, supaya cart bisa render "Tambah 1 box × 6 Cola untuk dapat Combo X" alih-alih "Tambah 1 Cola" polos.

Contoh seed (PRM-006): "Beli 1 Box Cola Gratis 1 Pcs" dengan `bogoProductId='prd_5'`, `buyUnitId='unit_2', buyUnitFactor=6, buyQuantity=1`, `getUnitId='unit_1', getUnitFactor=1, getQuantity=1`. Customer tambah 1 box + 1 pcs Cola → BOGO klaim 1 bundle, diskon 1 × harga Cola pcs (Rp 8.000).

**Decision — strict unit match, bukan fleksibel.** Saat promo bilang "1 box", customer harus benar-benar beli line 1-box; 6 pcs individu tidak hitung. Cocok dengan intent retail (bulk-buy dapat hadiah) dan lebih dapat diprediksi daripada agregasi base-unit kabur lintas packaging.

**Decision — pool buy/get terpisah untuk BOGO cross-unit.** "Beli 1 box gratis 1 pcs" mengharuskan KEDUANYA box DAN pcs ada di cart (kasir tambah line pcs gratisnya). Diskon berlaku ke line pcs. Tanpa pcs di cart, strip suggestion prompt "Tambah 1 pcs untuk gratis 1 pcs".

</details>

### Khusus pelanggan / member-only filter (added 2026-05-17)

`memberPricelistId` is now allowed on any promo kind (not just `member-tier`). When set, the promo only applies when the cart's customer is on the matching pricelist. Implemented as a single upstream filter:

```ts
function customerMatchesMemberFilter(promo, customer?): boolean {
  if (!promo.memberPricelistId) return true;
  if (!customer) return false;
  return customer.pricelistId === promo.memberPricelistId;
}
```

This filter runs in `resolvePromos`, `suggestCombos`, `suggestBogos`, and the POS product-card badge derivation. Effect: walk-in carts hide member-only promos entirely (no badge, no suggestion, no apply); promos appear only after a matching customer is picked.

Form: a new "Khusus pelanggan (opsional)" card in the right sidebar of `/promotions/[id]` for `discount` / `combo` / `bogo` kinds (member-tier already uses `memberPricelistId` inline). `/promotions` list shows a `Khusus member` badge next to the name.

Seed PRM-007: "Diskon 15% Minuman Khusus Member" — discount + categoryIds=['cat_1'] + memberPricelistId='pl_wholesale'. Only fires when wholesale-pricelist customer is selected in POS.

**Decision — hide vs. show-with-grayed-out.** Hidden when customer doesn't match. Showing-grayed-out would be more discoverable but adds noise to walk-in carts; hidden keeps the focus on actionable promos. Owner can still see all configured promos in `/promotions`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`memberPricelistId` sekarang diizinkan di kind promo apa pun (tidak hanya `member-tier`). Saat di-set, promo hanya berlaku saat customer cart ada di pricelist yang cocok. Diimplementasikan sebagai filter tunggal di hulu (`customerMatchesMemberFilter`).

Filter ini jalan di `resolvePromos`, `suggestCombos`, `suggestBogos`, dan derivasi badge product-card di POS. Efek: cart walk-in menyembunyikan promo member-only sepenuhnya (tidak ada badge, tidak ada suggestion, tidak ada apply); promo muncul hanya setelah customer yang cocok dipilih.

Form: card "Khusus pelanggan (opsional)" baru di sidebar kanan `/promotions/[id]` untuk kind `discount` / `combo` / `bogo` (member-tier sudah pakai `memberPricelistId` inline). List `/promotions` menampilkan badge `Khusus member` di sebelah nama.

Seed PRM-007: "Diskon 15% Minuman Khusus Member" — discount + categoryIds=['cat_1'] + memberPricelistId='pl_wholesale'. Hanya fire saat customer pricelist wholesale dipilih di POS.

**Decision — sembunyikan vs. tampilkan grayed-out.** Disembunyikan saat customer tidak cocok. Tampilkan-grayed-out akan lebih discoverable tapi tambah noise di cart walk-in; disembunyikan menjaga fokus di promo yang actionable. Owner tetap bisa lihat semua promo yang dikonfigurasi di `/promotions`.

</details>

### Per-product scope (added 2026-05-17, evolved same day)

Promotion scope is now keyed per-product, with optional variant + unit constraints embedded per entry:

```ts
type ProductScope = {
  productId: string;
  variantId?: string;     // when set: line must match this variant
  unitId?: string;        // when set: line must be in this packaging
  unitFactor?: number;
};
type Promotion = {
  ...,
  productScopes?: ProductScope[];   // replaces former productIds: string[]
  categoryIds?: string[];           // unchanged — union match
};
```

`matchesScope` evaluates productScopes and categoryIds as a union (OR):

```
match = (no scope set)
     OR (any productScope: productId match AND optional variant match AND optional unit match)
     OR (any categoryIds entry matches the line's category)
```

Different products in the same promo can have different unit/variant constraints. Example:

```ts
productScopes: [
  { productId: 'prd_5', unitId: 'unit_2', unitFactor: 6 },  // Cola only in box
  { productId: 'prd_3' },                                    // Croissant, any
  { productId: 'prd_4', variantId: 'var_white' }             // Mug only White variant
]
```

`/promotions/[id]` form: each row in the product checklist becomes interactive. Checking a product toggles a `ProductScope` entry. When checked AND the product has variants or packaging, inline variant + unit Selects appear under the row. A small "dibatasi" pill appears in the row when variant/unit is set.

Standalone `scopeUnitId/scopeUnitFactor` fields were removed (data and form). Existing seeds that used them migrated to `productScopes`.

Example PRM-008: "Diskon Rp 5.000 Cola per Box" — `productScopes: [{ productId: 'prd_5', unitId: 'unit_2', unitFactor: 6 }]`. Buy Cola in pcs → no discount. Buy Cola in box → Rp 5.000 off the line.

**Decision — per-row inline vs. global filter.** The earlier global "Hanya untuk unit tertentu" Select only worked when scope was exactly one product. Embedding the constraint inside each scope entry removes that limitation and keeps everything in one list — no separate panel below. Trade-off: schema change (`string[]` → `ProductScope[]`) and the per-row form is more complex, but matches the natural mental model ("for these products, optionally with these constraints").

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Scope promotion sekarang di-key per-produk, dengan kendala varian + unit opsional yang disematkan per entry:

`matchesScope` mengevaluasi productScopes dan categoryIds sebagai union (OR):

```
cocok = (tidak ada scope di-set)
     ATAU (ada productScope: match productId AND match varian opsional AND match unit opsional)
     ATAU (ada categoryIds yang cocok dengan kategori line)
```

Produk berbeda dalam promo yang sama bisa punya kendala unit/varian berbeda.

Form `/promotions/[id]`: tiap row di checklist produk jadi interaktif. Centang produk meng-toggle entry `ProductScope`. Saat dicentang DAN produk punya varian atau packaging, Select varian + unit inline muncul di bawah row. Pill kecil "dibatasi" muncul di row saat varian/unit di-set.

Field `scopeUnitId/scopeUnitFactor` standalone dihapus (data dan form). Seed lama yang pakainya migrate ke `productScopes`.

Contoh PRM-008: "Diskon Rp 5.000 Cola per Box" — `productScopes: [{ productId: 'prd_5', unitId: 'unit_2', unitFactor: 6 }]`. Beli Cola pcs → tidak diskon. Beli Cola box → Rp 5.000 off line itu.

**Decision — per-row inline vs. filter global.** Select global "Hanya untuk unit tertentu" yang sebelumnya hanya jalan saat scope tepat satu produk. Menyematkan kendala di tiap scope entry menghilangkan batasan itu dan menjaga semua di satu list — tidak ada panel terpisah di bawah. Trade-off: perubahan schema (`string[]` → `ProductScope[]`) dan form per-row lebih kompleks, tapi cocok dengan model mental natural ("untuk produk-produk ini, opsional dengan kendala ini").

</details>

### Expiring-batch markdown (added 2026-05-17)

The **first promo kind that depends on inventory state**, not just cart math. Use case: "Diskon 50% untuk batch yang akan kedaluwarsa dalam ≤ 3 hari".

```ts
type Promotion = {
  ...,
  kind: 'discount' | 'combo' | 'bogo' | 'member-tier' | 'expiring-batch',
  daysToExpiryThreshold?: number;       // batches expiring within N days = eligible
  expiryDiscountUnit?: 'percent' | 'fixed';
  expiryDiscountValue?: number;         // percent (0..100) or Rp per chosen-unit of line
};
```

Resolver helper `expiringStockFor(productId, variantId, withinDays)` sums `qtyRemaining` across batches where `expiresAt ≤ today + withinDays`. The expiring-batch pass runs between BOGO and line-level discount:

1. For each cart line matching the promo's scope (`productScopes` / `categoryIds`):
2. `eligibleBase = expiringStockFor(line.productId, line.variantId, threshold)`
3. `claimableBase = min(eligibleBase, line.baseQuantity remaining)`
4. Convert claimableBase back to line's chosen unit, apply per-unit discount (% or Rp)
5. Push `AppliedPromo` (kind = `expiring-batch`), deduct claimable from `remaining` so subsequent line-level discount doesn't double-apply

**Per-unit math.** If line has 5 Susu and 2 come from expiring batches, the discount applies to those 2 units only (`2 × unitPrice × 50% = discount`). Mixed-pricing per line is correct because FIFO + expiry-first allocation already pulls expiring stock first at charge time; the discount mirrors what's actually being sold.

**Reuses existing scope semantics.** `productScopes` lets the owner write "50% off Susu Murni varian Strawberry, ≤ 3 hari mau expired" (specific product + variant). `categoryIds` lets the owner write "50% off semua Bahan Segar mau expired" (broad).

**Allocation untouched.** Current FIFO + expiry-first batch depletion is already correct for this — expiring batches get sold first, the discount mirrors that. No allocation engine changes needed; the resolver only inspects batch state.

**`/promotions` list** — describeValue shows e.g. `50% off (≤ 3 hari)`; kindIcon uses CalendarDays. shortPromoLabel produces `Exp −50%` for product card badges.

Seed PRM-009: "Diskon 50% Bahan Segar Mau Expired" — kind=`expiring-batch`, `daysToExpiryThreshold=3`, `expiryDiscountUnit='percent'`, `expiryDiscountValue=50`, `categoryIds=['cat_5']`. With seed batches, Telur Ayam (batch_10, expires 2026-05-20) and Daging Sapi Cincang (batch_11, expires 2026-05-15, already past) become eligible based on today's date.

**Decision — depends on inventory state.** Unlike all prior promo kinds (which are pure cart math), expiring-batch reads `batches.items` at resolve time. This couples the promo engine to inventory state, but is necessary — the whole point is that the discount is a function of which physical units are about to expire. Trade-off is the resolver becomes slightly less deterministic from the cart's perspective (the same cart with different batch state yields different discount). Acceptable; this is a feature, not a bug.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Kind promo pertama yang bergantung pada state inventaris**, bukan hanya math cart. Use case: "Diskon 50% untuk batch yang akan kedaluwarsa dalam ≤ 3 hari".

Helper resolver `expiringStockFor(productId, variantId, withinDays)` menjumlahkan `qtyRemaining` di batch yang `expiresAt ≤ today + withinDays`. Pass expiring-batch jalan antara BOGO dan diskon line-level:

1. Untuk tiap line cart yang cocok scope promo (`productScopes` / `categoryIds`):
2. `eligibleBase = expiringStockFor(line.productId, line.variantId, threshold)`
3. `claimableBase = min(eligibleBase, sisa baseQuantity line)`
4. Konversi claimableBase kembali ke unit yang dipilih line, apply diskon per-unit (% atau Rp)
5. Push `AppliedPromo` (kind = `expiring-batch`), kurangi claimable dari `remaining` supaya diskon line-level setelahnya tidak double-apply

**Math per-unit.** Kalau line punya 5 Susu dan 2 dari batch expiring, diskon berlaku ke 2 unit itu saja (`2 × unitPrice × 50% = discount`). Mixed-pricing per line benar karena alokasi FIFO + expiry-first sudah menarik stok expiring duluan saat charge; diskon mencerminkan apa yang sebenarnya dijual.

**Memakai ulang semantic scope.** `productScopes` memungkinkan owner tulis "50% off Susu Murni varian Strawberry, ≤ 3 hari mau expired" (produk + varian spesifik). `categoryIds` memungkinkan "50% off semua Bahan Segar mau expired" (broad).

**Alokasi tidak diubah.** Penipisan batch FIFO + expiry-first saat ini sudah benar untuk ini — batch expiring tetap dijual dulu, diskon mencerminkan itu. Tidak butuh perubahan engine alokasi; resolver hanya inspect state batch.

**`/promotions` list** — describeValue tampil mis. `50% off (≤ 3 hari)`; kindIcon pakai CalendarDays. shortPromoLabel menghasilkan `Exp −50%` untuk badge product card.

Seed PRM-009: "Diskon 50% Bahan Segar Mau Expired" — kind=`expiring-batch`, `daysToExpiryThreshold=3`, `expiryDiscountUnit='percent'`, `expiryDiscountValue=50`, `categoryIds=['cat_5']`. Dengan seed batch, Telur Ayam (batch_10, expires 2026-05-20) dan Daging Sapi Cincang (batch_11, expires 2026-05-15, sudah lewat) jadi eligible berdasarkan tanggal hari ini.

**Decision — bergantung pada state inventaris.** Tidak seperti kind promo sebelumnya (yang murni math cart), expiring-batch membaca `batches.items` saat resolve time. Ini meng-couple engine promo ke state inventaris, tapi memang diperlukan — point utama adalah diskon adalah fungsi dari unit fisik mana yang mau expired. Trade-off: resolver jadi sedikit kurang deterministik dari perspektif cart (cart sama dengan state batch berbeda menghasilkan diskon berbeda). Bisa diterima; ini fitur, bukan bug.

</details>

---

## Newer features (built 2026-05-22)

A second wave of features focused on **print-out customer-facing materials**, **composite production tracking**, and **honest cost-based pricing**. None of these flip default behaviour for existing data — every addition is opt-in via a per-product or per-promo field defaulting to the legacy behaviour.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Gelombang fitur kedua, fokus ke **materi cetak yang menghadap-customer**, **tracking produksi komposit**, dan **pricing berbasis cost yang jujur**. Tidak ada yang membalik perilaku default untuk data lama — tiap penambahan opt-in via field per-produk atau per-promo yang default ke perilaku lama.

</details>

### Promo display labels (`/promotions/[id]/label`)

Admins print attractive promo signage from any promotion in `/promotions`. Three paper sizes — Kecil 80 × 120 mm, Sedang A5, Besar A4 — plus a copies counter, dynamic `@page` CSS so the print dialog defaults to the right paper size, and inline preview that scales to fit on screen.

The label content is **kind-aware**:
- `discount` → big "10% OFF" or "−Rp 5.000" hero.
- `combo` → "PAKET COMBO" kicker + combo price + included items list (each component's name).
- `bogo` → "BELI N GRATIS M" with the target product name.
- `member-tier` → "KHUSUS MEMBER" with the pricelist tier.
- `expiring-batch` → "STOK TERBATAS" kicker + discount.

Below the hero: promo name, description, scope ("Untuk: …"), period, day-of-week, hour window, minimum-purchase, member restriction. Footer carries the promo code (e.g. `PRM-009`) and kind icon.

**Length-aware hero sizing.** Long rupiah amounts ("Rp 18.000") would overflow at 110pt — so each label carries a `data-len="xs|sm|md|lg"` attribute on its hero element keyed off the rendered character count (≤5/≤7/≤10/11+). CSS picks the right font size per size × length bucket. The same trick handles the price block on shelf labels and the promo banner on shelf labels.

**Entry points.** Printer icon button in the `/promotions` row, plus a "Cetak label" button on the promo edit page (only when editing — not on the new-promo form).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Admin cetak signage promo yang atraktif dari promo apa pun di `/promotions`. Tiga ukuran kertas — Kecil 80 × 120 mm, Sedang A5, Besar A4 — plus counter copies, CSS `@page` dinamis supaya dialog print default ke ukuran kertas yang benar, dan preview inline yang scale-to-fit di layar.

Konten label **kind-aware**:
- `discount` → hero besar "10% OFF" atau "−Rp 5.000".
- `combo` → kicker "PAKET COMBO" + harga combo + daftar item yang dapat (nama tiap komponen).
- `bogo` → "BELI N GRATIS M" dengan nama produk target.
- `member-tier` → "KHUSUS MEMBER" dengan tier pricelist.
- `expiring-batch` → kicker "STOK TERBATAS" + diskon.

Di bawah hero: nama promo, deskripsi, scope ("Untuk: …"), period, day-of-week, window jam, minimum-purchase, restriction member. Footer membawa kode promo (mis. `PRM-009`) dan ikon kind.

**Hero yang aware-panjang.** Jumlah rupiah panjang ("Rp 18.000") akan overflow di 110pt — jadi tiap label bawa attribute `data-len="xs|sm|md|lg"` di element hero yang di-key dari jumlah karakter render (≤5/≤7/≤10/11+). CSS pilih font size yang tepat per ukuran × bucket panjang. Trik sama menangani price block di shelf label dan banner promo di shelf label.

**Entry point.** Tombol ikon printer di row `/promotions`, plus tombol "Cetak label" di halaman edit promo (hanya saat edit — tidak di form promo baru).

</details>

### Product shelf labels (`/inventory/[productId]/label`)

Customer-facing shelf signage for goods and composites. Three sizes again. Content includes:

- Top stripe: category name + SKU (or variant SKU when a variant is selected).
- Product name (big), variant name below if a specific variant is chosen, "Tersedia N varian" when "Semua varian" is picked for a multi-variant product.
- Price block — single price, or `min – max` range across variants, or strikethrough original + discounted price + "Hemat Rp X" when a `discount` or `expiring-batch` promo targets the product.
- Unit subtitle: "per pcs" for base unit, "per box · isi 6 pcs" for packaging — so customers know exactly what they're paying for.
- Promo banner (rose) when any active promo targets the product, with the badge text plus the promo name and a "+N promo lain" hint when multiple apply.

**Unit & variant pickers** sit in a config sub-bar above the preview:
- Variant picker (when the product has variants).
- Unit picker (when the product has packagings) — entries labelled e.g. *"Box · isi 6"*, *"Box · isi 24"*. Selecting a packaging switches the price source via the cascade `packaging.prices → variant.prices → product.prices` and multiplies cost by `packaging.factor` for markup-based strategies — matches POS behaviour.
- Pricelist picker (so the operator can print labels for different price tiers).
- Toggle "Tampilkan promo (jika ada)".

**Active-promo discovery** filters `promotions.items` by `isPromoUsable(promo, now)` AND `promoTargetsProduct(...)`, then honors `productScopes` variant constraints when a specific variant is picked. `member-tier` is excluded (doesn't change shelf price).

Entry point: Printer icon in the `/inventory` row, between Pindah and Lihat batch.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Signage rak yang menghadap-customer untuk goods dan komposit. Tiga ukuran lagi. Konten:

- Strip atas: nama kategori + SKU (atau SKU varian saat varian dipilih).
- Nama produk (besar), nama varian di bawah kalau varian spesifik dipilih, "Tersedia N varian" saat "Semua varian" dipilih untuk produk multi-varian.
- Block harga — harga tunggal, atau range `min – max` lintas varian, atau coret + harga diskon + "Hemat Rp X" saat promo `discount` atau `expiring-batch` menarget produk.
- Subtitle unit: "per pcs" untuk base unit, "per box · isi 6 pcs" untuk packaging — supaya customer tahu persis apa yang dibayar.
- Banner promo (rose) saat promo aktif menarget produk, dengan teks badge plus nama promo dan hint "+N promo lain" saat banyak yang berlaku.

**Picker unit & varian** ada di sub-bar config di atas preview:
- Picker varian (saat produk punya varian).
- Picker unit (saat produk punya packaging) — entry diberi label mis. *"Box · isi 6"*, *"Box · isi 24"*. Pilih packaging meng-switch sumber harga via cascade `packaging.prices → variant.prices → product.prices` dan kalikan cost dengan `packaging.factor` untuk strategi berbasis markup — cocok dengan perilaku POS.
- Picker pricelist (supaya operator bisa cetak label untuk tier harga berbeda).
- Toggle "Tampilkan promo (jika ada)".

**Penemuan promo aktif** memfilter `promotions.items` via `isPromoUsable(promo, now)` AND `promoTargetsProduct(...)`, lalu menghormati kendala varian `productScopes` saat varian spesifik dipilih. `member-tier` dikecualikan (tidak ubah harga rak).

Entry point: ikon Printer di row `/inventory`, antara Pindah dan Lihat batch.

</details>

### Production model — composites with real stock

The biggest addition. **Composites can now be assembled in advance** instead of (or in addition to) being made-to-order at sale.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Penambahan terbesar. **Komposit sekarang bisa dirakit di depan** alih-alih (atau di samping) dibuat made-to-order saat penjualan.

</details>

#### Production modes (`Product.productionMode`, optional `ProductVariant.productionMode` override)

```ts
type ProductionMode = 'flexible' | 'strict';
```

- **`flexible`** *(default)* — operator can pre-produce when convenient, but isn't required. At sale: prefer composite batches when stock exists; if empty, fall back to deducting components on-the-fly (the legacy behaviour). Suits cafe combos and fried-chicken warung (pre-fry batches that gracefully fall back to fresh-make when the warmer empties).
- **`strict`** — must be produced before it can be sold. No component fallback at sale. Out-of-stock if no produced batches. Suits hampers, kotak nasi, kits where "fresh-make at till" is nonsensical.

**Variant-level override.** Each variant can override the product-level mode via `variant.productionMode`. The product form exposes this through a collapsed disclosure "Atur per varian" so the common case (all variants same mode) stays clean. Useful when one cut behaves differently from the rest.

The earlier conversation considered a third "Hybrid" mode but collapsed it into `flexible` — once the deductor learned to prefer batches first and fall back to components, hybrid was just flexible with optional production.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- **`flexible`** *(default)* — operator bisa pre-produce saat sempat, tapi tidak wajib. Saat penjualan: prioritaskan batch komposit kalau stok ada; kalau kosong, fallback ke potong komponen on-the-fly (perilaku lama). Cocok untuk combo café dan warung ayam goreng (pre-fry batch yang fallback gracefully ke fresh-make saat warmer kosong).
- **`strict`** — harus diproduksi sebelum bisa dijual. Tidak ada fallback komponen di penjualan. Out-of-stock kalau tidak ada batch produced. Cocok untuk hampers, nasi kotak, kit di mana "fresh-make di kasir" nonsens.

**Override level-varian.** Tiap varian bisa override mode level-produk via `variant.productionMode`. Form produk mengekspos ini via disclosure "Atur per varian" yang collapsed supaya kasus umum (semua varian mode sama) tetap bersih. Berguna saat satu cut berperilaku beda dari sisanya.

Percakapan awal pertimbangkan mode ketiga "Hybrid" tapi di-collapse ke `flexible` — begitu deductor belajar prioritaskan batch dulu lalu fallback ke komponen, hybrid sebenarnya cuma flexible dengan produksi opsional.

</details>

#### `shelfLifeAfterProductionHours`

Optional on composites. The production modal pre-fills `expiresAt` to `now + N hours` on the produced batch — fried chicken 2h, gorengan 4h, nasi kotak 6h, roti tawar 72h. Plugs directly into the existing **expiring-batch promo** (`PromoKind: 'expiring-batch'`) — warmer-batches that age out get auto-discounted markdown without any extra wiring.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Opsional di komposit. Modal produksi pre-fill `expiresAt` ke `now + N jam` pada batch produced — ayam goreng 2 jam, gorengan 4 jam, nasi kotak 6 jam, roti tawar 72 jam. Langsung nyambung ke **promo expiring-batch** yang sudah ada (`PromoKind: 'expiring-batch'`) — batch warmer yang umur-out otomatis dapat markdown diskon tanpa wiring tambahan.

</details>

#### ProductionRun (`src/lib/stores/productionRuns.svelte.ts`)

```ts
type ProductionRun = {
  id; code; // PROD-YYYY-NNN
  productId; variantId?;
  intendedQty;     // drives component consumption / real cost incurred
  producedQty;     // ≤ intendedQty; drives output batch (yield variance)
  componentConsumptions: ConsumedComponent[];  // one per consumed batch
  producedBatchId;
  unitCost;        // Σ(consumed cost) / producedQty
  locationId; expiresAt?; shiftId?; notes; createdAt;
  status: 'completed' | 'cancelled';
};
```

**`planConsumption(productId, variantId?, intendedQty) → ConsumptionPlan`** — pure preview function called by the modal. Walks the recipe (variant override wins), computes FIFO draws per component (using `batches.forStock(...)` for goods, `batches.forStock(...)` for produced batches of sub-composites), reports per-component sufficiency, total cost, bottleneck capacity ("you can make max N"), and `blockReasons[]` (e.g. "Butuh 50 ekor, hanya ada 20").

**`productionRuns.add(input)`** is atomic-ish (in-memory, no transaction primitives yet):
1. Re-plan to catch any stock change between modal open and submit.
2. FIFO-consume each planned draw, log `'production-out'` per consumed batch.
3. Resolve `expiresAt` (explicit → product.shelfLifeAfterProductionHours → undefined).
4. `batches.add()` a new composite batch with `unitCost = Σ(actualConsumedCost) / producedQty`.
5. Log `'production-in'` for the produced batch.
6. Persist the `ProductionRun` record.

**Yield variance.** Intended qty drives consumption (real cost incurred). Produced qty drives the output batch. Tried to fry 20 thighs, got 18 → components consumed for 20, batch created for 18, unit cost honestly reflects yield loss. The product detail page surfaces this with a "Rendemen N%" warning.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**`planConsumption(productId, variantId?, intendedQty) → ConsumptionPlan`** — fungsi preview murni yang dipanggil modal. Walk recipe (override varian menang), hitung draw FIFO per komponen (pakai `batches.forStock(...)` untuk goods, `batches.forStock(...)` untuk batch produced sub-komposit), laporkan kecukupan per-komponen, total cost, kapasitas bottleneck ("kamu bisa bikin maks N"), dan `blockReasons[]` (mis. "Butuh 50 ekor, hanya ada 20").

**`productionRuns.add(input)`** atomic-ish (in-memory, belum ada primitive transaksi):
1. Re-plan untuk tangkap perubahan stok antara modal terbuka dan submit.
2. FIFO-konsumsi tiap draw yang direncanakan, log `'production-out'` per batch yang dikonsumsi.
3. Resolve `expiresAt` (eksplisit → product.shelfLifeAfterProductionHours → undefined).
4. `batches.add()` batch komposit baru dengan `unitCost = Σ(actualConsumedCost) / producedQty`.
5. Log `'production-in'` untuk batch produced.
6. Persist record `ProductionRun`.

**Variance yield.** Intended qty menggerakkan konsumsi (cost nyata yang muncul). Produced qty menggerakkan batch output. Coba goreng 20 paha, dapat 18 → komponen dikonsumsi untuk 20, batch dibuat untuk 18, unit cost jujur mencerminkan kehilangan yield. Halaman detail produk menampilkan ini via peringatan "Rendemen N%".

</details>

#### Sub-composite policy

Recipes can reference other composites. At **production time**, sub-composite components must have produced batches — no recursive make-from-raw. If the sub-composite is `strict` AND empty, the run fails with "Produksi *Saus Sambal* dulu". If `flexible` AND empty, the run still fails (cleaner audit — one production per level). This was a judgment call we made explicitly during the design — auto-cascading was tempting but invited mistakes ("I made 50 ayam goreng and somehow consumed 50 ekor of raw chicken plus 50 portions of bumbu I didn't know about").

At **sale time**, the rules are looser. A flexible composite's recipe component that's itself a flexible composite *will* recurse into its grandchildren if there's no batch stock — matching the cafe model where the cashier doesn't care which level made the thing.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Recipe bisa mereferensi komposit lain. Saat **produksi**, komponen sub-komposit harus punya batch produced — tidak ada make-from-raw rekursif. Kalau sub-komposit `strict` DAN kosong, run gagal dengan "Produksi *Saus Sambal* dulu". Kalau `flexible` DAN kosong, run tetap gagal (audit lebih bersih — satu produksi per level). Ini judgment call eksplisit saat design — auto-cascading menggoda tapi mengundang kesalahan ("Aku bikin 50 ayam goreng dan tahu-tahu konsumsi 50 ekor ayam mentah plus 50 porsi bumbu yang aku tidak tahu").

Saat **penjualan**, aturan lebih longgar. Komponen recipe komposit flexible yang sendiri komposit flexible *akan* recurse ke grandchildren-nya kalau tidak ada stok batch — sesuai model café di mana kasir tidak peduli level mana yang bikin barangnya.

</details>

#### Stock movement kinds

Added two:
```ts
type StockMovementKind =
  | ...
  | 'production-in'    // composite batch created by a production run
  | 'production-out';  // component batch consumed by a production run
```

Plus a new `StockMovementReferenceKind: 'production'` so all rows from one run share `{ kind: 'production', id, code: 'PROD-...' }` — the per-product audit history (`/inventory/[productId]/history`) and the production-run detail page both filter on this reference.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Ditambah dua kind: `production-in` (batch komposit dibuat oleh production run) dan `production-out` (batch komponen dikonsumsi production run).

Plus `StockMovementReferenceKind: 'production'` baru supaya semua row dari satu run berbagi `{ kind: 'production', id, code: 'PROD-...' }` — history audit per-produk (`/inventory/[productId]/history`) dan halaman detail production-run keduanya filter via reference ini.

</details>

#### Mode-aware sale path

`orders.svelte.ts` had its composite branch refactored. The new function `deductCompositeOrGoods(productId, variantId?, qty, context)` is the single deductor for both goods and composites at sale time:

1. Goods → straight FIFO from batches.
2. Composite with produced stock → straight FIFO from those batches (treat like goods once produced).
3. Composite empty, mode `flexible` → recurse into the recipe (and apply the same rules per child).
4. Composite empty, mode `strict` → stop here. The line is short and the operator gets the out-of-stock signal.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Cabang composite di `orders.svelte.ts` di-refactor. Fungsi baru `deductCompositeOrGoods(productId, variantId?, qty, context)` adalah satu-satunya deductor untuk goods dan komposit saat penjualan:

1. Goods → FIFO lurus dari batch.
2. Komposit dengan stok produced → FIFO lurus dari batch-batch itu (perlakukan seperti goods sekali sudah diproduksi).
3. Komposit kosong, mode `flexible` → recurse ke recipe (dan apply aturan yang sama per child).
4. Komposit kosong, mode `strict` → berhenti di sini. Line kurang dan operator dapat sinyal out-of-stock.

</details>

#### `/production` routes

- `/production` — list with stat cards (runs hari ini, unit hari ini, unit 7 hari, produk diproduksi), filters (product, search), sortable table linking to detail.
- `/production/new` — form with product + variant pickers, mode badge, live recipe & availability table (per-component FIFO draws shown inline, bottleneck capacity surfaced), `intendedQty` + `producedQty` (yield variance), expiry pre-fill, location (when `settings.inventory.locationsEnabled`), notes. Submit disabled until plan is feasible. Accepts `?productId=...&variantId=...` deep-link from the inventory shortcut.
- `/production/[id]` — header with code + product/variant + status, intended/produced/cost cards, consumption table linking back to each consumed component's history, the full audit-trail movements list, produced-batch card with "Cetak label batch" shortcut, stub cancel button reserved for v2.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- `/production` — list dengan stat card (run hari ini, unit hari ini, unit 7 hari, produk diproduksi), filter (produk, search), tabel sortable yang link ke detail.
- `/production/new` — form dengan picker produk + varian, badge mode, tabel recipe & ketersediaan live (draw FIFO per-komponen tampil inline, kapasitas bottleneck di-surface), `intendedQty` + `producedQty` (variance yield), pre-fill expiry, lokasi (saat `settings.inventory.locationsEnabled`), notes. Submit disabled sampai plan feasible. Menerima deep-link `?productId=...&variantId=...` dari shortcut inventory.
- `/production/[id]` — header dengan code + produk/varian + status, card intended/produced/cost, tabel konsumsi yang link kembali ke history tiap komponen yang dikonsumsi, daftar audit-trail movement lengkap, card batch produced dengan shortcut "Cetak label batch", tombol cancel stub disimpan untuk v2.

</details>

#### Inventory page surfacing

Composite rows show a **Produksi** button (instead of the disabled "Atur") routing to `/production/new?productId=...`. The stock cell adds chips: *"N dari produksi"* (real batch stock, emerald) and *"N dari bahan"* (component-derived capacity, sky) — so the operator can see what's been produced vs. what could be produced.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Row komposit menampilkan tombol **Produksi** (alih-alih "Atur" yang disabled) routing ke `/production/new?productId=...`. Sel stock menambahkan chip: *"N dari produksi"* (stok batch nyata, emerald) dan *"N dari bahan"* (kapasitas turunan komponen, sky) — supaya operator bisa lihat yang sudah diproduksi vs. yang masih bisa diproduksi.

</details>

#### Staff attribution

Production runs carry an optional `shiftId` that's empty today; populated when the planned login-then-pick-shift flow lands. No `performedBy` picker on the modal (kept the UX tight; avoids parallel attribution mechanism that'll get ripped out later).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Production run membawa `shiftId` opsional yang kosong hari ini; diisi saat flow login-lalu-pilih-shift yang direncanakan masuk. Tidak ada picker `performedBy` di modal (jaga UX tight; hindari mekanisme atribusi paralel yang akan dicabut nanti).

</details>

#### Seed examples

Three composites illustrate the model side-by-side:

- **`prd_7` Coffee & Croissant Combo** — existing seed, no `productionMode` field → default `flexible`, behaves exactly as before.
- **`prd_11` Ayam Goreng** — composite, `flexible`, `shelfLifeAfterProductionHours: 2`. Variants Paha / Dada / Sayap / Drumstick, each with its own recipe pointing at the matching raw cut on `prd_10`.
- **`prd_10` Ayam Mentah** — goods, variants Paha / Dada / Sayap / Drumstick with seeded batches (BATCH-2026-012 through 015).
- **`prd_12` Hampers Lebaran** — composite, `strict`. No variants. Recipe = 4 croissants + 6 colas. Must be produced before sale.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tiga komposit mengilustrasikan model bersebelahan:

- **`prd_7` Coffee & Croissant Combo** — seed lama, tidak ada field `productionMode` → default `flexible`, perilaku persis seperti dulu.
- **`prd_11` Ayam Goreng** — komposit, `flexible`, `shelfLifeAfterProductionHours: 2`. Varian Paha / Dada / Sayap / Drumstick, masing-masing dengan recipe sendiri yang menunjuk ke cut mentah yang cocok di `prd_10`.
- **`prd_10` Ayam Mentah** — goods, varian Paha / Dada / Sayap / Drumstick dengan batch seeded (BATCH-2026-012 sampai 015).
- **`prd_12` Hampers Lebaran** — komposit, `strict`. Tanpa varian. Recipe = 4 croissant + 6 cola. Harus diproduksi sebelum jual.

</details>

### Bulk price adjustment per product (`PriceAdjustmentModal.svelte`)

Opened by the "Sesuaikan harga" link in the *Harga & Stok* card on the product form, next to "Kelola daftar harga". Disabled until the product has at least one price entry.

**Scope**: one product. Lists every price entry across the product — product-level (each pricelist), variants (each pricelist), packagings (each pricelist) — plus every tier inside each entry. Each row gets a checkbox; default-selected. A **Tipe** column shows each row's strategy kind with a color-coded badge: *Tetap* (slate, `fixed`), *Markup %* (sky, `markup_pct`), or *Cost + Rp* (violet, `markup_amount`).

**Two independent operations in one modal.** This was a design pivot after the user pointed out that "Tipe: Persen" was ambiguous — does it mean "operate in percent" or "only affect percent-kind rows"? We split the modal into two fieldsets:

**Fieldset 1 — Sesuaikan markup** (operates on strategy value directly):
- `Markup % (poin)` — adds points to `markup_pct` strategy values. E.g. `+5` turns markup 10% into 15%.
- `Markup Cost + Rp` — adds rupiah to `markup_amount` strategy values. E.g. `+500` turns +Rp 5.000 into +Rp 5.500.
- Auto-filters by kind: each input only affects rows whose strategy kind matches; mismatched rows are untouched.

**Fieldset 2 — Naikkan harga jual** (operates on resulting sale price, with rounding):
- `Tipe`: Persen (%) / Rupiah (Rp).
- `Nilai`: positive raises, negative cuts.
- `Pembulatan`: Tanpa / Rp 100 / 500 / 1.000 / 5.000.
- `Arah pembulatan`: `Otomatis` *(default, naik = ke atas, turun = ke bawah — "rounding away from cost")*, `Selalu ke atas`, `Selalu ke bawah`, `Ke nilai terdekat`.
- Eligibility-gated per row: `fixed` rows always apply; `markup_*` rows apply only when `markupCostSource === 'manual'` (otherwise the bump would drift back at the next batch transition).

Either fieldset (or both) can have values. Empty/zero = skip.

**Per-row pipeline** runs four steps in order:

1. **Markup adjust** (`applyMarkupAdjust`) — modifies `strategy.value` if kind matches. `fixed` is untouched here.
2. **Interim sale** — `computeSalePrice(cost, adjustedStrategy)`.
3. **Sale-price bump** (`bumpSale`) — only when eligible AND `salePriceDelta !== 0`. Applies the percent/amount delta, then rounding.
4. **Back-write strategy** (`backWriteStrategy`) — only when step 3 ran. Preserves the strategy kind:
   - `fixed` → `value = finalSale`.
   - `markup_amount` → `value = finalSale − cost`.
   - `markup_pct` → `value = (finalSale / cost − 1) × 100`. When `cost = 0`, auto-converts to `fixed` and surfaces an amber inline warning.

When only step 1 runs (no sale bump), the back-write is skipped and the step-1 strategy is used directly. The preview table calculates `r.newSale = computeSalePrice(r.cost, finalStrategy)` so the user sees the resulting price either way.

**Combined example.** Product with `cost = 10.000`, two pricelists: Retail `markup_pct: 10` (sale 11.000) and Wholesale `markup_amount: 5.000` (sale 15.000). User enters: `Markup % poin: +5`, `Markup Rp: +500`, `Naikkan harga jual Persen: +10`, rounding Rp 500 auto.

```
Retail (Markup %):
  Step 1: markup 10 → 15
  Step 2: interim sale = 10.000 × 1,15 = 11.500
  Step 3: +10% → 12.650 → round up 500 = 13.000
  Step 4: back-write markup_pct = (13.000/10.000−1)×100 = 30%
  Result: Retail markup 30%, harga 13.000

Wholesale (Cost + Rp):
  Step 1: amount 5.000 → 5.500
  Step 2: interim sale = 10.000 + 5.500 = 15.500
  Step 3: +10% → 17.050 → round up 500 = 17.500
  Step 4: back-write markup_amount = 17.500 − 10.000 = 7.500
  Result: Wholesale +Rp 7.500, harga 17.500
```

**Non-manual sources show all rows.** Earlier versions hid `markup_*` rows entirely when `markupCostSource !== 'manual'`. The refactor exposes them because markup adjust (step 1) still works for cost-following sources — changing the markup value is meaningful and persistent, only the sale-price bump (step 3) gets skipped. A blue notice at the top of the modal explains this, and rows that skipped step 3 get a small "Bump harga jual dilewati" hint next to the Tipe badge.

**Patches**, not direct mutation. The modal returns `PriceChangePatch[]` describing scope (product / variant / packaging) + pricelistId + optional tierIndex + new strategy. The parent (`ProductForm`) walks the patches and applies them to its form state. Nothing persists until the user clicks **Simpan** on the product form — they can leave the page to undo.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Dibuka oleh link "Sesuaikan harga" di card *Harga & Stok* di form produk, di sebelah "Kelola daftar harga". Disabled sampai produk punya minimal satu price entry.

**Scope**: satu produk. Daftar tiap price entry lintas produk — level-produk (tiap pricelist), varian (tiap pricelist), packaging (tiap pricelist) — plus tiap tier di dalam tiap entry. Tiap row dapat checkbox; default-selected. Kolom **Tipe** menampilkan strategy kind tiap row dengan badge berkode-warna: *Tetap* (slate, `fixed`), *Markup %* (sky, `markup_pct`), atau *Cost + Rp* (violet, `markup_amount`).

**Dua operasi independen dalam satu modal.** Ini pivot design setelah user menunjukkan bahwa "Tipe: Persen" ambigu — apakah maksudnya "operasi dalam persen" atau "cuma pengaruhi row kind persen"? Kami pecah modal jadi dua fieldset:

**Fieldset 1 — Sesuaikan markup** (operasi langsung pada nilai strategi):
- `Markup % (poin)` — tambah poin ke nilai strategi `markup_pct`. Mis. `+5` ubah markup 10% jadi 15%.
- `Markup Cost + Rp` — tambah rupiah ke nilai strategi `markup_amount`. Mis. `+500` ubah +Rp 5.000 jadi +Rp 5.500.
- Auto-filter via kind: tiap input hanya pengaruhi row yang kind strategy-nya cocok; row tidak-cocok tidak disentuh.

**Fieldset 2 — Naikkan harga jual** (operasi pada harga jual hasil, dengan pembulatan):
- `Tipe`: Persen (%) / Rupiah (Rp).
- `Nilai`: positif menaikkan, negatif memotong.
- `Pembulatan`: Tanpa / Rp 100 / 500 / 1.000 / 5.000.
- `Arah pembulatan`: `Otomatis` *(default, naik = ke atas, turun = ke bawah — "rounding away from cost")*, `Selalu ke atas`, `Selalu ke bawah`, `Ke nilai terdekat`.
- Eligibility-gated per row: row `fixed` selalu apply; row `markup_*` apply hanya saat `markupCostSource === 'manual'` (kalau tidak, bump akan drift kembali di transisi batch berikutnya).

Salah satu fieldset (atau keduanya) bisa punya nilai. Kosong/nol = skip.

**Pipeline per-row** jalan empat langkah berurutan:

1. **Markup adjust** (`applyMarkupAdjust`) — modifikasi `strategy.value` kalau kind cocok. `fixed` tidak disentuh di sini.
2. **Interim sale** — `computeSalePrice(cost, adjustedStrategy)`.
3. **Bump sale-price** (`bumpSale`) — hanya saat eligible AND `salePriceDelta !== 0`. Apply delta persen/jumlah, lalu pembulatan.
4. **Back-write strategy** (`backWriteStrategy`) — hanya saat step 3 jalan. Pertahankan kind strategy:
   - `fixed` → `value = finalSale`.
   - `markup_amount` → `value = finalSale − cost`.
   - `markup_pct` → `value = (finalSale / cost − 1) × 100`. Saat `cost = 0`, auto-convert ke `fixed` dan tampilkan peringatan amber inline.

Saat hanya step 1 yang jalan (tanpa bump sale), back-write di-skip dan strategy hasil step 1 dipakai langsung. Tabel preview menghitung `r.newSale = computeSalePrice(r.cost, finalStrategy)` supaya user lihat harga hasil di kedua kasus.

**Row sumber non-manual menampilkan semua row.** Versi awal sembunyikan row `markup_*` sepenuhnya saat `markupCostSource !== 'manual'`. Refactor mengekspos semuanya karena markup adjust (step 1) tetap jalan untuk sumber cost-following — mengubah nilai markup bermakna dan persisten, hanya bump sale-price (step 3) yang di-skip. Notice biru di atas modal menjelaskan ini, dan row yang skip step 3 dapat hint kecil "Bump harga jual dilewati" di sebelah badge Tipe.

**Patch**, bukan mutasi langsung. Modal mengembalikan `PriceChangePatch[]` yang mendeskripsikan scope (product / variant / packaging) + pricelistId + tierIndex opsional + strategy baru. Parent (`ProductForm`) walk patch dan apply ke state form-nya. Tidak ada yang persist sampai user klik **Simpan** di form produk — mereka bisa tinggalkan halaman untuk undo.

</details>

### Margin watch — `/pengaturan-harga`

New top-level menu under **Data Master**. Single tab in v1: **Pantauan Margin** — sortable table comparing every product's sale price against the cost it would take to restock, with risk bands.

**Cost source for comparison**: the **latest PO line** for the product, normalized to base units (`unitPrice / unitFactor`). Falls back to `product.cost` with an amber "Belum ada PO" hint when no PO exists. We picked latest-PO over weighted-avg because the margin watch's job is "is the current sale price sustainable to restock?" — not "what's profitable on inventory I already paid for."

**Sale source**: active pricelist (default = retail) via `basePrice(p)` (or `priceRange(p)` for multi-variant products — margin computed against `min` for the worst-case view). This means the watch automatically reflects whichever `markupCostSource` the product uses for pricing.

**Bands** (computed off `margin = (sale - cost) / sale * 100`):
- ≤ 0 → **Rugi** (rose)
- < 10% → **Waspada** (rose)
- < 30% → **Tipis** (amber)
- ≥ 30% → **Aman** (emerald)

**Filters**: search by name/SKU, category, active pricelist, band, sort (margin terkecil / selisih / nama).

**Inline action**: "Sesuaikan" per row jumps straight to the product edit form — one click away from the bulk-adjust modal.

**Stat cards** at top: Rugi count, Margin berisiko (Rugi + Waspada), Total produk aktif, Belum ada PO count.

Not built yet (deferred to v2): the inline margin badge on the `/inventory` table for at-a-glance "is this product bleeding?" without leaving inventory.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Menu top-level baru di bawah **Data Master**. Satu tab di v1: **Pantauan Margin** — tabel sortable yang membandingkan harga jual tiap produk dengan cost yang dibutuhkan untuk restock, dengan band risiko.

**Sumber cost untuk perbandingan**: **line PO terbaru** untuk produk, dinormalisasi ke base unit (`unitPrice / unitFactor`). Fallback ke `product.cost` dengan hint amber "Belum ada PO" saat tidak ada PO. Kami pilih PO terbaru daripada weighted-avg karena tugas margin watch adalah "apakah harga jual saat ini sustainable untuk restock?" — bukan "apa yang profitable di inventaris yang sudah aku bayar?"

**Sumber sale**: pricelist aktif (default = retail) via `basePrice(p)` (atau `priceRange(p)` untuk produk multi-varian — margin dihitung terhadap `min` untuk view worst-case). Ini berarti watch otomatis mencerminkan `markupCostSource` mana pun yang dipakai produk untuk pricing.

**Band** (dihitung dari `margin = (sale - cost) / sale * 100`):
- ≤ 0 → **Rugi** (rose)
- < 10% → **Waspada** (rose)
- < 30% → **Tipis** (amber)
- ≥ 30% → **Aman** (emerald)

**Filter**: search via nama/SKU, kategori, pricelist aktif, band, sort (margin terkecil / selisih / nama).

**Aksi inline**: "Sesuaikan" per row langsung ke form edit produk — satu klik dari modal bulk-adjust.

**Stat card** di atas: count Rugi, Margin berisiko (Rugi + Waspada), Total produk aktif, count Belum ada PO.

Belum dibangun (ditunda v2): badge margin inline di tabel `/inventory` untuk at-a-glance "produk ini berdarah?" tanpa keluar dari inventaris.

</details>

### Markup cost source (`Product.markupCostSource`) — the big naming fix

The deepest change in this batch. Before this, markup-based pricing wasn't actually dynamic — `effectiveCost(p)` returned `p.cost` (the manual baseline), so `markup_pct: 10` always meant "10% above the manually-set cost", never auto-tracked the real cost paid via PO/batches. The name "markup" implied dynamic tracking but the implementation was static.

Introduced a per-product `MarkupCostSource` field with three values:

```ts
type MarkupCostSource = 'manual' | 'fifo-current' | 'batch-avg';
```

- **`'manual'`** *(default)* — `product.cost` (preserves the legacy behaviour for every seeded product that doesn't specify the field). Sale price never moves on its own; operator adjusts manually or via Sesuaikan harga.
- **`'fifo-current'`** — unitCost of the OLDEST owned batch with stock left (the next one FIFO will consume). Sale price snaps to the next batch's cost the moment the current batch depletes. The most honest pricing for businesses with cost volatility — customers pay based on what you actually paid for the unit they're getting.
- **`'batch-avg'`** — weighted-avg of all owned batches' `unitCost` (calls existing `currentCost(productId, variantId)` from `batches.svelte`). Sale price drifts gradually as old/new stock blends.

All three fall back to `product.cost` (or `variant.cost`) when no owned batch exists yet — keeps newly-created products usable before the first PO lands.

**Internal helper** `costFromSource(productId, variantId, source, manualFallback)` does the lookup. `effectiveCost(p)` and `effectiveVariantCost(v, p?)` now route through it. The variant function takes an *optional* product so it can resolve the source — backward-compatible (callers that don't pass `product` get the old behaviour). All callsites that compute pricing (POS, PO form, `priceRange`, inventory shelf label) updated to pass the product.

**Composite ripple-through.** `componentBaseCost(c)` now recursively calls `effectiveCost` / `effectiveVariantCost(v, parentProduct)` so a composite's cost reflects its components' own sources. Concretely: a `flexible` Ayam Goreng whose Ayam Mentah Paha is `fifo-current` will auto-pick up whichever raw-paha batch is currently being consumed — without any extra wiring at the composite level.

**Surfaced in product form** as a "Sumber biaya untuk markup" dropdown sitting under the "Biaya beli" row in the *Harga & Stok* card. The three options have descriptive hints explaining the trade-offs.

**Effect on Sesuaikan harga modal**: when a product's source isn't `manual`, the modal hides all `markup_*` rows (per-entry and per-tier), with a blue notice explaining that markup pricing follows cost automatically and to change the markup itself directly in the form. Fixed-price entries remain editable.

**Seed example** — `prd_2` Latte flipped to `markupCostSource: 'fifo-current'`. A second batch (BATCH-2026-016, 40 pcs @13.000) added so the dynamic behaviour is observable: while batch_2 (78 pcs @12.000) still has stock the Latte sale stays at `12.000 × 2.75 = 33.000`; once batch_2 depletes the sale auto-snaps to `13.000 × 2.75 = 35.750`. Visible in `/pengaturan-harga` as the gap between latest-PO cost and current sale.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Perubahan terdalam di batch ini. Sebelumnya, pricing berbasis markup tidak benar-benar dinamis — `effectiveCost(p)` mengembalikan `p.cost` (baseline manual), jadi `markup_pct: 10` selalu artinya "10% di atas cost yang di-set manual", tidak pernah auto-track cost nyata yang dibayar via PO/batch. Nama "markup" mengimplikasikan tracking dinamis tapi implementasinya statis.

Diperkenalkan field per-produk `MarkupCostSource` dengan tiga nilai:

- **`'manual'`** *(default)* — `product.cost` (pertahankan perilaku lama untuk tiap produk seeded yang tidak menentukan field). Harga jual tidak pernah bergerak sendiri; operator atur manual atau via Sesuaikan harga.
- **`'fifo-current'`** — unitCost batch OWNED PALING TUA yang masih ada stok (yang berikutnya akan dikonsumsi FIFO). Harga jual snap ke cost batch berikutnya begitu batch saat ini habis. Pricing paling jujur untuk bisnis dengan volatilitas cost — customer bayar berdasarkan apa yang kamu benar-benar bayar untuk unit yang dia dapat.
- **`'batch-avg'`** — weighted-avg `unitCost` semua batch owned (panggil `currentCost(productId, variantId)` yang sudah ada dari `batches.svelte`). Harga jual drift bertahap saat stok lama/baru bercampur.

Ketiganya fallback ke `product.cost` (atau `variant.cost`) saat belum ada batch owned — jaga produk baru-dibuat tetap usable sebelum PO pertama mendarat.

**Helper internal** `costFromSource(productId, variantId, source, manualFallback)` melakukan lookup. `effectiveCost(p)` dan `effectiveVariantCost(v, p?)` sekarang routing via dia. Fungsi varian menerima *opsional* product supaya bisa resolve source — backward-compatible (caller yang tidak pass `product` dapat perilaku lama). Semua callsite yang menghitung pricing (POS, form PO, `priceRange`, shelf label inventory) di-update untuk pass product.

**Ripple komposit.** `componentBaseCost(c)` sekarang rekursif memanggil `effectiveCost` / `effectiveVariantCost(v, parentProduct)` jadi cost komposit mencerminkan sumber komponennya sendiri. Konkretnya: Ayam Goreng `flexible` yang Ayam Mentah Paha-nya `fifo-current` akan auto-pickup batch paha mentah mana pun yang sedang dikonsumsi — tanpa wiring tambahan di level komposit.

**Tampil di form produk** sebagai dropdown "Sumber biaya untuk markup" yang duduk di bawah row "Biaya beli" di card *Harga & Stok*. Tiga opsi punya hint deskriptif menjelaskan trade-off-nya.

**Efek di modal Sesuaikan harga**: saat source produk bukan `manual`, modal sembunyikan semua row `markup_*` (per-entry dan per-tier), dengan notice biru yang menjelaskan bahwa pricing markup ikut cost otomatis dan untuk ubah markup-nya sendiri langsung di form. Entry fixed-price tetap editable.

**Contoh seed** — `prd_2` Latte dibalik ke `markupCostSource: 'fifo-current'`. Batch kedua (BATCH-2026-016, 40 pcs @13.000) ditambah supaya perilaku dinamis bisa diamati: selama batch_2 (78 pcs @12.000) masih ada stok, sale Latte tetap di `12.000 × 2.75 = 33.000`; begitu batch_2 habis, sale auto-snap ke `13.000 × 2.75 = 35.750`. Terlihat di `/pengaturan-harga` sebagai gap antara cost PO terbaru dan sale saat ini.

</details>

### Conversation thread that produced this

> Ringkasan singkat (ID): rekaman keputusan dari percakapan yang menghasilkan batch fitur 2026-05-22. Bagian ini sengaja English-only — meta-dokumen untuk maintainer berikutnya. Inti: ukuran label diatur ke tiga pilihan, picker unit ditambah setelah feedback user, mode produksi C dilebur ke `flexible`, sub-komposit di-block saat produksi tapi diizinkan saat penjualan, `/pengaturan-harga` bersifat additive (bukan menggantikan), arah pembulatan dapat override manual, margin watch pakai PO terbaru, dan `markupCostSource` lahir dari pengamatan bahwa "markup" lama-statisnya tidak jujur.

Decision points worth preserving for whoever picks this up later:

1. **Promo & shelf labels** — three sizes settled on 80 × 120 mm / A5 / A4. Dynamic `@page` injected via `$effect` rather than CSS named pages (browser support inconsistency for the latter). Length-aware hero sizing via `data-len` attributes after a screenshot from the user showed "Rp 18.000" overflowing at 110pt on Medium.
2. **Unit pickers on labels** — the user surfaced "what about packaging?" — added unit + packaging selectors that mirror POS pricing cascade. Variants already worked.
3. **Composite production** — started with "what's missing for production?" research. Considered three modes A/B/C, collapsed C into A (`flexible` + optional production = original C). Sub-composite recursion explicitly blocked at production time, allowed at sale for `flexible` parents only.
4. **Pricing UI scope** — discussed whether to move price editing out of the product form into a dedicated menu. Settled on *additive*: keep per-product editing as source of truth, add `/pengaturan-harga` for cross-product analysis (margin watch) and bulk-edit *within* one product (Sesuaikan harga modal).
5. **Round direction** — added a manual override on top of the auto default ("naik = ke atas, turun = ke bawah") at user's request.
6. **Margin watch cost basis** — latest PO unit cost picked over weighted-avg because the watch answers "is the current price sustainable to restock?" not "is old stock profitable?"
7. **Markup-isn't-dynamic discovery** — when the user asked "what if PO/batch price changes?" the static-markup design surfaced. We then surveyed three possible cost sources and ended with all three coexisting as a per-product opt-in. The user's preferred mode is `fifo-current` (price tracks the current consumed batch); we kept `'manual'` as the default to preserve legacy behaviour for every seeded product.

---

## Newer features (built 2026-05-26)

The 2026-05-22 batch shipped `markupCostSource` correctly but exposed three usability gaps in the product form, the product list, and the POS scan path. This batch fills those gaps and clarifies the three pricing modes for the operator, then extends the catalog with a base-unit barcode so simple products can be scanned at the till.

### Three pricing modes — the mental model the docs were missing

The user surfaced a clarification while reading the form: `markupCostSource: 'manual'` isn't "static pricing" — it's **"markup formula stays, operator controls cost timing"**. That gives three orthogonal modes the operator can pick per product:

| Mode | `PricingStrategy.kind` | `markupCostSource` | Sale-price update trigger |
|---|---|---|---|
| Statis | `fixed` | irrelevant | Operator edits sale price directly |
| Markup manual | `markup_*` | `'manual'` | Operator edits `product.cost` (or markup) |
| Ikut PO | `markup_*` | `'fifo-current'` / `'batch-avg'` | Automatic on batch change |

The mid mode (markup manual) is the one people often miss. It's valuable when supplier costs jitter weekly but the shop doesn't want sale prices to yo-yo — operator changes `product.cost` on their own cadence (e.g., monthly review or after a bulk purchase) and the 10% markup carries through. Auto-updating `product.cost` on PO receipt would defeat the purpose; we explicitly decided against it.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

User mengangkat klarifikasi sambil baca form: `markupCostSource: 'manual'` bukan "harga statis" — itu **"rumus markup tetap, operator kontrol timing cost"**. Itu memberi tiga mode ortogonal yang operator bisa pilih per produk (lihat tabel di atas).

Mode tengah (markup manual) yang sering luput. Berguna saat cost supplier naik-turun mingguan tapi toko nggak mau harga jual yoyo — operator ubah `product.cost` di cadence-nya sendiri (mis. review bulanan atau setelah bulk purchase) dan markup 10% jalan terus. Auto-update `product.cost` saat PO terima akan mengalahkan tujuan mode ini; kami eksplisit memutuskan untuk **tidak** melakukannya.

</details>

### `costFromSource` is exported, uses `manualFallback` consistently

Before: `costFromSource(productId, variantId, source, manualFallback)` was `function`-scoped (not exported) and the `'batch-avg'` branch delegated to `currentCost(productId, variantId)`, which ignores `manualFallback` and falls back to the *stored* `product.cost` / `variant.cost`. That had two consequences:

1. The form couldn't preview "what would my sale price look like if I flipped to `fifo-current`" before saving — there was no public entry point.
2. Composite variants in `batch-avg` mode with no produced batches fell back to `variant.cost` (often 0 for seeded composites), not the recipe cost. So a `markupCostSource: 'batch-avg'` composite read as cost = 0 until its first production run.

The refactor:

```ts
export function costFromSource(
  productId: string,
  variantId: string | undefined,
  source: MarkupCostSource,
  manualFallback: number
): number
```

- Now `export`-ed. The product form imports it and passes `form.markupCostSource` + `form.cost` (or `recipeFormCost` for composites) as the fallback — so unsaved edits drive the preview.
- The `'batch-avg'` branch no longer delegates to `currentCost`. It inlines the variant-aggregation logic (matching `currentCost`'s "no variantId on a variant-bearing product → aggregate across variants via `forProduct`") and falls back to `manualFallback` when no owned batches exist.
- Behaviour change: `effectiveVariantCost(v, p)` for a composite variant in non-manual mode now correctly falls back to recipe cost instead of `v.cost`. Existing callers (`effectiveCost(p)` passes `p.cost`) are unaffected because `manualFallback === stored cost` for them.
- `currentCost` still exists in `batches.svelte` and is used elsewhere (inventory adjust modal, opname snapshots) — only the products-side helper inlines its logic now.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Sebelumnya: `costFromSource(productId, variantId, source, manualFallback)` scope-nya `function` (tidak exported) dan cabang `'batch-avg'` delegasi ke `currentCost(productId, variantId)`, yang abaikan `manualFallback` dan fallback ke `product.cost` / `variant.cost` *tersimpan*. Dua konsekuensi:

1. Form tidak bisa preview "berapa harga jual kalau saya flip ke `fifo-current`" sebelum save — tidak ada entry point publik.
2. Composite variant di mode `batch-avg` tanpa batch produksi fallback ke `variant.cost` (sering 0 untuk komposit seed), bukan recipe cost. Jadi composite `markupCostSource: 'batch-avg'` terbaca cost = 0 sampai production run pertama.

Refactor: sekarang `export`-ed, cabang `'batch-avg'` inline logic-nya sendiri (match `currentCost` untuk aggregation lintas varian), dan fallback konsisten ke `manualFallback`. Perubahan perilaku: `effectiveVariantCost(v, p)` untuk varian komposit di mode non-manual sekarang benar fallback ke recipe cost.

</details>

### Source-aware cost preview in `ProductForm`

`effectiveFormCost` and `variantEffectiveCost` previously ignored the source — they always showed either `form.cost`, `v.cost`, or the recipe sum, regardless of `markupCostSource`. That meant editing a `fifo-current` product whose FIFO batch is at 5,400 while `product.cost` still shows the stale 5,000 bootstrap would render `PricingInput` previews at 7,500 (`5,000 × 1.5`) while POS actually charges 8,100 (`5,400 × 1.5`).

The form now routes both through `costFromSource` when editing an existing product:

```ts
// goods
return costFromSource(product.id, undefined, form.markupCostSource, form.cost);
// composite — recipeFormCost is the fallback
return costFromSource(product.id, undefined, form.markupCostSource, recipeFormCost);
// variant — same shape, scoped to v.id
return costFromSource(product.id, v.id, form.markupCostSource, fallback);
```

For new products (`!product.id`) the fallback is returned directly — no batches exist anyway.

The preview reflects the source picked in the form **right now** (even before save), so the operator can flip manual → `fifo-current` and immediately see the price snap to the batch cost. Combined with the "Biaya saat ini" line below the cost field, the form is the same source of truth as POS.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`effectiveFormCost` dan `variantEffectiveCost` sebelumnya mengabaikan source — selalu menampilkan `form.cost` / `v.cost` / recipe sum, tanpa peduli `markupCostSource`. Akibatnya saat edit produk `fifo-current` yang batch FIFO-nya 5.400 sementara `product.cost` masih bootstrap stale 5.000, preview `PricingInput` muncul di 7.500 (`5.000 × 1.5`) padahal POS sebenarnya pakai 8.100 (`5.400 × 1.5`).

Sekarang form rute keduanya via `costFromSource` saat edit produk existing, dengan `manualFallback` diisi nilai dari form (`form.cost` atau `recipeFormCost`). Preview mencerminkan source yang dipilih di form **saat ini** (sebelum save), jadi operator bisa flip manual → `fifo-current` dan langsung lihat harga snap ke batch cost.

</details>

### "Harga & Stok" card rearrangement

The card layout was reordered to put the cause (which source) above the effect (cost field), and to surface the live batch-derived cost as a preview line.

**Before:** `Satuan | Biaya beli` in one grid row; `Sumber biaya untuk markup` on its own row below.
**After:** `Satuan | Sumber biaya` in the top row; cost field in the row below with conditional label/hint and an inline preview.

Reactive bits:

- **Label switch**: `Biaya beli` (when source = `manual`) ↔ `Biaya awal` (when source = `fifo-current` / `batch-avg`). The latter wording signals "this is just the bootstrap; batches will take over later."
- **Hint switch**: per-source one-liner — manual emphasizes "update saat biaya beli berubah", fifo/batch-avg emphasize "dipakai sampai PO/stok pertama masuk".
- **Preview line**: when `costIsFromBatch` (source ≠ manual AND `effectiveFormCost ≠ fallback`), a small "Biaya saat ini: Rp X (dari batch FIFO berjalan / rata-rata batch)" line appears under the cost field. For composites, the read-only box title flips from "Biaya efektif" to "Biaya saat ini" and adds a "Resep: Rp X" line for reference.
- **Amber warning**: when `hasMarkupPricing && effectiveFormCost === 0`, an amber banner appears explaining that the sale price will be Rp 0 until cost is filled or the first PO/batch lands. Wording differs per source so the operator knows whether to edit the cost field or wait for the PO.

`hasMarkupPricing` walks `form.prices`, every `form.variants[i].prices`, and every `form.units[i].prices` for any non-`fixed` entry or tier. The check is form-local so it stays accurate as the operator edits without saving.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Layout card disusun ulang supaya sebab (sumber mana) di atas akibat (field cost), dan supaya cost batch yang live muncul sebagai baris preview.

**Sebelum:** `Satuan | Biaya beli` di satu row grid; `Sumber biaya untuk markup` di row sendiri di bawah.
**Sesudah:** `Satuan | Sumber biaya` di row atas; cost field di row bawah dengan label/hint kondisional + preview inline.

Bagian reaktif:
- **Switch label**: `Biaya beli` (manual) ↔ `Biaya awal` (fifo/batch-avg) — yang kedua memberi sinyal "ini cuma bootstrap; batch akan ambil alih".
- **Switch hint**: one-liner per source.
- **Preview line**: muncul saat `costIsFromBatch` (source ≠ manual DAN `effectiveFormCost ≠ fallback`), menampilkan "Biaya saat ini: Rp X (dari batch FIFO berjalan / rata-rata batch)".
- **Banner amber**: muncul saat `hasMarkupPricing && effectiveFormCost === 0`, menjelaskan bahwa harga jual akan Rp 0 sampai cost diisi atau PO/batch pertama tiba.

</details>

### `pricingMode(p)` helper + product-list badges

A new exported helper classifies a product's pricing into one of four modes for at-a-glance review:

```ts
export type PricingMode = 'fixed' | 'manual-markup' | 'dynamic-markup' | 'mixed';
export function pricingMode(p: Product): PricingMode
```

Logic: walk every `PricelistEntry` (product-level + each variant + each packaging), collect every `pricing.kind` across base entry and tiers. Then:

- All `'fixed'` → `'fixed'`.
- Has at least one `markup_*` and at least one `'fixed'` → `'mixed'`.
- All `markup_*` and `markupCostSource === 'manual'` (or undefined) → `'manual-markup'`.
- All `markup_*` and `markupCostSource ∈ {'fifo-current', 'batch-avg'}` → `'dynamic-markup'`.

Rendered as a colored badge in `/products` next to the price label: **Statis** (slate) / **Markup manual** (sky) / **Ikut PO** (emerald) / **Campur** (amber). Tooltip explains each. Sits between the price text and the existing "Berjenjang" / "+N daftar harga" badges.

`pricingModeLabels: Record<PricingMode, string>` provides the Indonesian display strings so callers don't duplicate them.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Helper exported baru `pricingMode(p): 'fixed' | 'manual-markup' | 'dynamic-markup' | 'mixed'` mengklasifikasi mode harga produk untuk review sekilas. Render sebagai badge berwarna di `/products` di sebelah label harga: **Statis** / **Markup manual** / **Ikut PO** / **Campur**.

Logika: walk semua `PricelistEntry` (level produk + tiap varian + tiap packaging), kumpulkan semua `pricing.kind` lintas base entry dan tier. Lalu klasifikasi sesuai tabel di atas.

</details>

### `Product.barcode` — base-unit barcode

Before this batch, `barcode` lived only on `ProductPackaging` and `ProductVariant`. Simple products (no packaging, no variant) had no place to store a barcode — yet most goods in a retail catalog *are* simple SKUs with a single UPC. The POS search bar's `placeholder="…scan barcode…"` was also misleading: `resolveScanToken` only ever matched SKUs and batch codes, never `pack.barcode` / `variant.barcode`.

```ts
type Product = {
  …
  barcode?: string;  // base-unit barcode (UPC/EAN/GTIN)
  …
};
```

Semantics:

- **Simple product**: only place to put a barcode. Scan → product → 1 pcs in cart.
- **Product with packaging**: the **base unit** barcode (pcs / can / bottle). Each `pack.barcode` is the code for *that* packaging (dus / karton).
- **Variant product**: usually empty (variant.barcode is the per-variant code). If set, acts as a parent GTIN — when scanned and the product has variants, the resolver returns the product without a `variantId`; `addToCart`'s existing `useVariantId = variantId ?? p.variants[0]?.id` picks the first variant. Toast surfaces the chosen variant name so the operator can see what was added.

Storage: optional (`barcode?`) for minimal seed-data churn. Form treats it as a string, persists as `string | undefined` (empty trimmed → undefined). Surfaced in the *Dasar* card under SKU with a contextual hint per product shape (simple / packaging / variant).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Sebelum batch ini, `barcode` cuma ada di `ProductPackaging` dan `ProductVariant`. Produk simple (tanpa packaging, tanpa varian) tidak punya tempat untuk simpan barcode — padahal mayoritas barang di katalog retail *adalah* SKU simple dengan satu UPC. Placeholder search bar POS `"…scan barcode…"` juga menyesatkan: `resolveScanToken` cuma match SKU dan batch code, tidak pernah `pack.barcode` / `variant.barcode`.

Tambahan: `Product.barcode?: string` — barcode untuk **base unit**.

- **Produk simple**: satu-satunya tempat. Scan → produk → 1 pcs di cart.
- **Produk dengan packaging**: barcode **base unit** (pcs / kaleng / botol). `pack.barcode` per kemasan tambahan (dus / karton).
- **Produk varian**: biasanya kosong (variant.barcode yang jadi sumber). Kalau diisi, jadi parent GTIN — scan → resolver kembali tanpa `variantId`; `addToCart` ambil varian pertama via `useVariantId = variantId ?? p.variants[0]?.id`.

</details>

### POS scan resolver — six-step priority chain

`resolveScanToken(raw)` (in `src/routes/pos/+page.svelte`) now walks from most-specific to most-general:

```
1. variant.barcode        → product + variantId          (source: 'variantBarcode')
2. packaging.barcode      → product + unitId + factor    (source: 'packagingBarcode')
3. product.barcode        → product (base unit)          (source: 'productBarcode')
4. product.sku            → product                      (source: 'sku', existing)
5. variant.sku            → product + variantId          (source: 'variantSku', existing)
6. batch.code             → product + variantId          (source: 'batchCode', existing)
```

Return type extended with optional `unitId` and `unitFactor`. `handleSearchKeyDown` passes them through to the existing `addToCart(p, variantId?, unitId?, unitFactor=1)` — so scanning a dus barcode lands a cart line with the dus unit and factor already set, no extra plumbing. The toast detail shows `(Box · isi 6)` etc. when a packaging matched.

Comparison is case-sensitive for barcodes (UPCs are numeric so case doesn't matter; staying exact avoids accidental matches against alphanumeric SKUs). SKU matching stays case-insensitive (existing behaviour). Empty `barcode === token` is guarded so blank strings never match — only non-empty stored values compete against the (already-trimmed-non-empty) token.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`resolveScanToken(raw)` (di `src/routes/pos/+page.svelte`) sekarang berjalan dari paling spesifik ke paling umum (lihat tabel 6 langkah di atas).

Return type diperluas dengan `unitId` dan `unitFactor` opsional. `handleSearchKeyDown` meneruskannya ke `addToCart(p, variantId?, unitId?, unitFactor=1)` yang sudah ada — jadi scan barcode dus langsung mengisi cart line dengan unit dus dan factor-nya, tanpa wiring tambahan. Toast detail menampilkan `(Box · isi 6)` saat packaging cocok.

</details>

### Barcode uniqueness — `findBarcodeOwner` + form validator

```ts
export type BarcodeOwner = {
  productId: string;
  productName: string;
  scope: 'product' | 'variant' | 'packaging';
  scopeLabel?: string;  // variant name OR "{unitName} · isi {factor}"
};
export function findBarcodeOwner(
  barcode: string,
  excludeProductId?: string
): BarcodeOwner | null
```

Walks the full catalog, checks `product.barcode`, every `variant.barcode`, every `pack.barcode`. Returns the first match (or null). `excludeProductId` lets the edit form skip its own product so saving a row doesn't conflict with itself.

`ProductForm.validateBarcodes(next)` runs two passes when validating:

1. **Internal duplicates**: collect every non-empty barcode the form holds (product / each variant / each packaging) with a human scope label. Same code appearing twice → error on the second occurrence (`"Barcode sama dengan {scope} di produk ini."`).
2. **Cross-product collisions**: for each non-duplicate in-form barcode, call `findBarcodeOwner(code, product?.id)`. Conflict → error pointing at the other product + scope (`'Barcode sudah dipakai di "Cola 330mL" (Dus · isi 6).'`).

Errors are surfaced via the existing `errors[key]` map on three `Input`s (`barcode` for product-level, `v_{i}_barcode` for each variant, `u_{i}_barcode` for each packaging — last two `error` props were added since the validator targets them).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`findBarcodeOwner(barcode, excludeProductId?)` walk seluruh katalog, cek `product.barcode`, tiap `variant.barcode`, tiap `pack.barcode`. Return match pertama (atau null). `excludeProductId` membuat form edit melewatkan produk-nya sendiri.

`ProductForm.validateBarcodes(next)` dua pass:
1. **Duplikat internal**: kumpulkan semua barcode non-kosong di form (produk / tiap varian / tiap packaging) dengan label scope. Kode sama muncul dua kali → error di occurrence kedua.
2. **Bentrok lintas produk**: untuk tiap barcode in-form non-duplikat, panggil `findBarcodeOwner(code, product?.id)`. Bentrok → error menunjuk produk lain + scope.

</details>

### Decision: packagings remain without SKU

Discussed and explicitly chosen *not* to add `ProductPackaging.sku`. Reasoning recorded in the data-model section above (search "**No `sku` field — by design**"). Short form: packaging isn't a stock-keeping entity; the `(product, unitId, factor)` tuple + barcode + `lineUnitId/unitFactor` on procurement already cover identity. Add it only if a concrete need (supplier per-packaging mapping, external accounting) surfaces.

### Conversation thread that produced this

> Ringkasan (ID): rekaman keputusan dari sesi 2026-05-26. Operator menanyakan "apa yang kurang benar di master produk" lalu mengklarifikasi tiga mode harga (statis / markup manual / ikut PO); preview cost di form ternyata tidak source-aware sehingga edit produk dynamic kelihatan margin salah; produk simple tidak punya tempat barcode; dan packaging tidak butuh SKU karena bukan entitas stok terpisah.

1. **Three pricing modes — operator clarifying note**. The operator pushed back on calling `markupCostSource: 'manual'` "static": it isn't, because the markup still applies — operator just controls *when* the cost changes. That re-framing produced the three-mode table preserved above. The static-vs-dynamic question turned out to be the wrong frame; the right frame is "who triggers the price update: clock (operator) or batch (system)?"
2. **Form preview was lying**. The operator asked whether the master form needed editing post-PO. Investigation showed `effectiveFormCost` for goods just returned `form.cost` regardless of `markupCostSource` — so a `fifo-current` product's preview disagreed with POS. Fixed by routing through `costFromSource` and exporting it.
3. **`costFromSource` fallback inconsistency**. While exporting, noticed the `batch-avg` branch ignored `manualFallback` (delegated to `currentCost`). Inlined the logic so all three sources honour the caller's fallback — preview now correctly uses unsaved `form.cost` edits even for `batch-avg`. Side benefit: composite variants in non-manual mode no longer drop to `variant.cost` (often 0) when no production batches exist; they fall back to recipe cost.
4. **Cost = 0 onboarding policy**. Asked the operator: "for new products with markup pricing, should cost = 0 be allowed?" Answer: yes, with an amber warning. Auto-fill or hard validation both interfere with the flow of "create master ad-hoc, fill cost when PO confirms." The warning makes the consequence visible without blocking.
5. **PO → cost auto-update was rejected**. Considered offering a per-PO checkbox "update product.cost to PO line cost" for manual-mode products. Operator decided no: that would conflate the two modes. If you want auto, use `fifo-current`; if you want manual control, the operator's typed cost is the source of truth.
6. **Product-list badge naming**. Picked Indonesian labels (Statis / Markup manual / Ikut PO / Campur) over English. "Ikut PO" reads naturally for a shop owner and accurately describes both `fifo-current` and `batch-avg` (they both follow batches that come from POs).
7. **Barcode design — simple product gap**. Operator asked whether simple products need barcode. Trace through the POS scan path revealed `resolveScanToken` never matched any barcode field at all (despite UI promising "scan barcode") — independent bug that surfaced during the review. Added `Product.barcode` for base-unit code, kept the existing variant/packaging fields, designed a 6-step priority chain so all three coexist deterministically.
8. **Three barcode levels — operator's "how does that work?" check**. After proposing all three levels, the operator asked how the resolver disambiguates. The answer "most-specific first" satisfied; documented the priority chain in code and here. Edge case "variant product with parent GTIN scanned" auto-picks first variant for consistency with parent-SKU behaviour; deferred any picker UI as out-of-scope.
9. **Cross-catalog barcode uniqueness**. Added the validator after deciding the model was right but the form needed guardrails. Validator surfaces both in-form duplicates (operator typo: same code in two variants of one product) and cross-product collisions. Message points at the conflicting scope so the operator can navigate to fix.
10. **Packaging SKU — decided no**. Operator asked if packagings need SKU. The clarifying question "is packaging a stock-keeping entity?" — no, it's a counting/pricing convention over the same base-unit stock — settled it. Documented the rationale and the (concrete) conditions that would justify revisiting (supplier per-packaging catalog mapping; external accounting that requires it).

---

## Fitur baru (dibangun 2026-05-27)

Batch 2026-05-26 menutup gap modeling utama (barcode 3-level, source-aware preview, indikator harga). Batch ini fokus ke dua hal yang berbeda: **UX & wording yang ramah operator awam** (sebelumnya banyak jargon Inggris yang menyusahkan toko kecil), dan **field/entity baru yang muncul dari riset toko kecil-menengah** (Brand, Tag, custom fields, kategori hierarkis, MOQ).

### Tooltip kit + revamp wording

Sebelumnya banyak label di `ProductForm` ditulis dengan istilah yang masuk akal untuk dev tapi terlalu teknis untuk pemilik warung/butik: "Tipe produk: Komposit", "Sumber biaya untuk markup: Biaya batch berjalan (FIFO)", "Mode produksi: Fleksibel/Hanya dari produksi", "Atribut varian", "Selisih harga", "Dampak stok", "Inherit from category". Operator harus tahu istilah POS/inventory dulu sebelum bisa pakai form.

**Komponen baru** `src/lib/components/ui/Tooltip.svelte` — ikon `?` kecil dengan popup penjelasan. Hover di desktop, tap toggle di mobile, Escape & click-outside untuk tutup. Render via `aria-expanded` + popover absolut, ringan tanpa library.

**Prop `tooltip?: string`** ditambah di `Input`, `Select`, dan `MoneyInput` — kalau diisi, ikon Tooltip otomatis muncul di samping label. Pattern di-pakai di banyak tempat:

- Jenis produk (Tipe produk lama) — penjelasan Barang vs Resep/Paket dengan contoh konkret
- Pelacakan stok per pengiriman — kapan butuh label batch + tanggal kedaluwarsa
- Cara penyiapan (Mode produksi lama) — beda Fleksibel vs Wajib disiapkan dulu
- Acuan biaya untuk hitung harga jual — kapan field ini berlaku (hanya untuk markup, bukan harga tetap)
- Harga jual — penjelasan harga tetap vs markup + tier per kuantitas
- Bahan / Isi paket (Komponen lama) — apa bedanya resep vs bundle
- Varian + Pilihan variasi (Atribut varian lama) — cara generator bekerja
- Ekstra / tambahan opsional — kapan dipakai, contoh ganti susu / tambah keju
- Sidebar Pengelompokan: Kategori / Brand / Tag / Pajak / Status — semua dapat tooltip kontekstual
- Info tambahan: BPOM, Halal, Garansi, Catatan lain — penjelasan per field

**Wording revisions** (sample, bukan exhaustive):

| Sebelum | Sesudah |
|---|---|
| Tipe produk | Jenis produk |
| Komposit (display) | Resep / Paket |
| Pelacakan batch | Pelacakan stok per pengiriman |
| Memerlukan label batch | Cetak label setiap kali stok masuk |
| Memerlukan tanggal kedaluwarsa | Wajib isi tanggal kedaluwarsa |
| Mode produksi | Cara penyiapan |
| Masa simpan setelah produksi (jam) | Tahan berapa jam setelah dibuat? |
| Hanya dari produksi | Wajib disiapkan dulu |
| Sumber biaya untuk markup | Acuan biaya untuk hitung harga jual |
| Biaya manual | Biaya beli yang saya isi sendiri |
| Biaya batch berjalan (FIFO) | Harga beli stok yang sedang dijual |
| Rata-rata semua batch | Rata-rata harga beli semua stok |
| Komponen | Bahan / Isi paket |
| Atribut varian | Pilihan variasi |
| Selisih harga | Harga tambahan |
| Dampak stok | Bahan yang dipotong |
| Organisasi | Pengelompokan |
| Inherit from category | Ikut tarif kategori |
| Fixed price | Harga tetap |
| Cost + amount | Biaya + nominal |
| Markup % | Persen untung |
| Markup % (poin) | Persen untung (poin) |
| Active / Archived | Aktif / Diarsipkan |
| No default supplier | Tanpa pemasok utama |
| (lead Nh) | (tunggu Nh) |

Selain label, deskripsi opsi di store juga ditulis ulang pakai contoh konkret (gorengan/hampers untuk mode produksi, "ayam goreng 2 jam" untuk shelf life), supaya operator nggak perlu mengira-ngira terminologi.

**Iterasi feedback**: revisi pertama ada label `Cara harga jual mengikuti biaya` + value `Ikut pengiriman yang sedang habis` yang masih bingungkan (operator share screenshot, bilang "ini masih membingungkan"). Diperbaiki jadi `Acuan biaya untuk hitung harga jual` + value yang berbentuk kalimat utuh (`Biaya beli yang saya isi sendiri` / `Harga beli stok yang sedang dijual` / `Rata-rata harga beli semua stok`) supaya label + value baca natural sebagai satu kalimat. Plus screenshot kedua nunjukin status dropdown masih `Active/Archived` — fix sekaligus.

### Entitas Brand

`src/lib/stores/brands.svelte.ts` baru. Mirror pattern Categories (CRUD modal di single page, bukan separate routes).

```ts
type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;       // logo URL
  status: 'active' | 'archived';
};
```

**Product** dapat field `brandId?: string` opsional. **`products.countByBrand(brandId)`** untuk count di route `/brands`. **Seed**: `brand_indofood`, `brand_aqua`, `brand_coca-cola` — beberapa seed produk (`prd_5` Cola, `prd_6` Spring Water) dapat `brandId` untuk demo.

**Route `/brands`** — Table dengan thumbnail logo + nama + slug + deskripsi + status badge + count produk + actions. Modal form mirror Categories: nama, slug (auto-generated), URL logo, status, deskripsi.

**Permission `menu.brands`** ditambah di `PERMISSION_CATALOG` + `ROUTE_PERMISSIONS` + role admin & gudang. Sidebar dapat link "Brand" dengan ikon `Bookmark`.

**ProductForm** — Select Brand di kartu Pengelompokan (di bawah Kategori), dengan opsi pertama "Tanpa brand" untuk yang nggak perlu. **`/products` list** — filter brand di toolbar; nama brand tampil di kolom Produk setelah SKU.

**Tradeoff yang ditolak**: tidak bikin `Brand.color` (banyak brand sudah punya identitas warna sendiri; biar tetap netral di list). Tidak bikin `Brand.taxRateId` (brand bukan pengelompokan pajak; pajak ikut kategori).

### Sistem Tag + ChipInput autocomplete

`src/lib/stores/tags.svelte.ts` baru.

```ts
type TagColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type Tag = {
  id: string;
  name: string;
  color: TagColor;
  publicVisible: boolean;  // tampil di POS card / shelf label untuk customer
  description: string;
};
```

**Penyimpanan di Product**: `tags?: string[]` — yang disimpan adalah **nama tag**, bukan ID. Alasannya: (a) operator boleh ketik nama yang belum terdaftar (free-form auto-add), (b) JSON dump readable, (c) tag rename di store registry tetap robust (kalau ada produk yang masih pakai nama lama, badge-nya cuma kehilangan warna sampai operator re-tag). Lookup color/visibility lewat `tags.getByName(name)` (case-insensitive).

**`ChipInput` di-extend** dengan prop opsional `suggestions: string[]`. Saat input fokus dan suggestions non-empty, dropdown autocomplete muncul: filter case-insensitive `includes`, exclude yang sudah dipilih, cap di 8 hasil. Klik suggestion → tambahkan + clear pending. Enter dengan pending yang exact match di suggestions → pilih suggestion (preserve casing yang benar); Enter dengan pending yang tidak match → tetap free-form add. Esc tutup dropdown. `onBlur` defer 100ms supaya click suggestion sempat ke-register sebelum input lose focus.

**Seed**: `Baru`, `Best Seller`, `Halal`, `Promo`, `Lokal` — 5 tag awal dengan warna + `publicVisible: true`. Produk `prd_5` Cola di-seed dengan `tags: ['Best Seller', 'Promo']`.

**Route `/tags`** — Table tag dengan badge berwarna, toggle `publicVisible`, count produk per tag. Validator unique-by-name (case-insensitive).

**Permission `menu.tags`** + sidebar dengan ikon `Sparkles`.

**ProductForm** — `ChipInput` di sidebar Pengelompokan (di bawah Brand), bind `form.tags` + `suggestions={tags.items.map(t => t.name)}`. **`/products` list** — badge per tag dengan warna dari registered tag (atau `neutral` kalau tagnya belum terdaftar).

### Prebuilt custom fields

Bukan custom field framework full dengan dynamic defs/per-category scoping — defer karena ROI rendah untuk SMB. Sebagai gantinya, prebuilt 4 field opsional di `Product` yang paling sering dibutuhkan:

```ts
bpomNumber?: string;       // POM NA / POM MD / POM ML / dll.
halalCertNumber?: string;  // nomor sertifikat MUI Halal
warrantyMonths?: number;   // garansi dalam bulan (elektronik)
metadata?: Record<string, string>;  // bebas key-value
```

**Form** — kartu "Info tambahan" baru di sidebar (setelah Pemasok). Pakai `Collapsible`, auto-buka kalau produk sudah punya data di salah satu field. Berisi:

- Input BPOM (text) — placeholder `mis. POM NA 18101200123`
- Input Halal cert (text) — placeholder `mis. 00150003420220`
- Input Garansi (number, min 0) — `0 = tanpa garansi`
- Sub-card "Catatan lain" — list pair `[key, value]` dengan tombol Tambah/Hapus. Saat submit, pair yang key/value-nya kosong di-skip; kalau hasil reduce kosong, simpan `undefined`

**Kenapa metadata key-value, bukan custom field framework**:
- Skala SMB rata-rata: 1-3 custom field aktif per produk. Framework lengkap = overkill.
- Metadata bebas escape hatch yang cukup untuk 90% kasus (kandungan, ukuran, warna pabrik, kode toko, dll.)
- Kalau nanti ternyata operator pakai metadata yang sama untuk banyak produk, baru pertimbangkan promosi ke prebuilt field.

Display di shelf label / receipt belum di-implementasi (BPOM, Halal yang sering wajib tampil ke customer untuk regulated products) — bisa di-tambah belakangan tanpa breaking change.

### Kategori hierarkis + tree view

`Category` dapat field baru:

```ts
type Category = {
  // … existing …
  parentId?: string;  // undefined = kategori utama (root)
};
```

**Helper baru di `CategoriesStore`**:

```ts
path(id: string): Category[]      // root → ... → kategori ini (defensive: cap 16 hops)
descendantsOf(id: string): Category[]   // semua anak rekursif (BFS)
isAncestorOf(ancestorId, descendantId): boolean   // cycle prevention
```

`path` dipakai untuk render breadcrumb (`Minuman › Kopi › Single Origin`) di product form Select kategori, di table /categories saat mode search, dan di /categories list untuk subtitle saat mode tree. `descendantsOf` dipakai untuk filter /products (filter "Minuman" include semua sub-kategori). `isAncestorOf` dipakai validator parent Select di category form (exclude self + descendants supaya operator nggak bisa bikin siklus).

**Tax fallback chain di-update**. Dulu: `Product.taxRateId → Category.taxRateId → default`. Sekarang: `Product.taxRateId → walk Category chain dari sub-kategori naik ke root, return tax pertama yang ada → default`. Maksudnya: kalau sub-kategori `Single Origin` kosong `taxRateId`-nya, sistem cek `Kopi`, lalu `Minuman`, baru fallback ke default. Jadi operator nggak perlu repeat tax di setiap sub-kategori — atur di induk, anak auto-inherit.

**Category form** — Select "Kategori induk" baru dengan opsi-opsi yang otomatis exclude self + descendants (cegah siklus). Label opsi tampilkan path full (`Minuman › Kopi`) supaya nama yang ambigu (`Kopi` di dua induk berbeda) bisa di-disambiguasi.

**ProductForm** — Select Kategori sekarang tampil path full sebagai label opsi. Filter di /products: pilih kategori induk akan include semua produk di descendants-nya (`categoryFilterSet = new Set([id, ...descendantsOf(id).map(c => c.id)])`).

**Tree view di /categories**:

```ts
type CategoryRow = Category & { _depth: number; _hasChildren: boolean };
```

`treeRows` di-derive — DFS dari root ke anak, attach `_depth` (untuk indent) + `_hasChildren` (untuk render chevron). Kalau search aktif, flip ke flat sorted list (matches yang dalam tree tetap kelihatan tanpa harus expand parent). Saat search aktif, breadcrumb subtitle muncul di name cell supaya operator tahu konteksnya.

**Chevron toggle**: tombol kecil di depan name kalau `_hasChildren && !isSearching`. State `collapsed: Set<string>` melacak ID yang ditutup; klik chevron toggle entry di set. Visual: ikon `ChevronRight` putar 90° saat terbuka. Untuk row tanpa chevron (leaf atau search mode), render `<span>` placeholder selebar tombol supaya nama tetap rata kiri.

**Indent**: `style="padding-left: {_depth * 1.25}rem"`. Bukan margin karena background hover/selected harus tetap full-width. Bukan nested table karena column alignment penting — Slug, Pajak, Deskripsi, count Produk tetap rata.

**Count Produk**: angka utama = count deep (kategori ini + semua descendants). Kalau ada selisih dengan direct count, tampilkan `(N langsung)` kecil di sebelahnya. Konsisten dengan filter /products yang sudah include descendants.

**Seed sub-kategori untuk demo**:
- `cat_6 Kopi` (parent `cat_1 Minuman`) — tax kosong, inherit dari Minuman
- `cat_7 Single Origin` (parent `cat_6 Kopi`) — depth 2
- `cat_8 Pastry` (parent `cat_2 Makanan`)

### MOQ supplier-side

`ProductSupplier.minOrderQty?: number` opsional, satuan dasar produk. Disurface di kartu pemasok ProductForm (expanded row, di bawah SKU pemasok) dengan tooltip + hint contoh ("Mis. 12 = minimal pesan 12 pcs").

**Validator di PO form** — warning amber, bukan error. Saat pemasok dipilih + qty (base) < MOQ pemasok, tampilkan banner:

> ⚠ Pemasok ini biasanya minta minimal **12 pcs** per pesanan. Saat ini cuma 8 pcs.

Bukan hard-block — operator bisa tetap submit kalau memang konfirmasi sama pemasoknya. Soft warning sudah cukup untuk SMB use case; hard-block lebih cocok untuk integrasi B2B otomatis nanti.

**Yang TIDAK dibikin**: sales-side MOQ (pelanggan grosir wajib min N pcs). Diskusinya: di SMB Indonesia jarang dipakai — yang lebih sering adalah multi-pricelist (grosir punya harga, ecer punya harga). Tier discount per kuantitas (`PricelistEntry.tiers`) sudah cover use case "beli banyak harga turun". MOQ proper hanya relevan kalau toko mau hard-block customer (jarang).

### Tentang HET — penjelasan, tidak diimplementasi

Operator nanya: "konsumen perlu tahu HET?". Jawaban tercatat di sesi (regulated products: rokok/obat/sembako/susu formula HET tercetak di kemasan, konsumen pakai sebagai patokan, toko nggak boleh jual di atas; produk tidak diregulasi: HET tidak ada). Keputusan: **belum tambah** `Product.hetPrice?` ke master sekarang. Sekarang HET cuma muncul di consignment PO line untuk override dari consignor. Bisa ditambahkan belakangan kalau muncul toko yang minta — tidak breaking.

### Conversation thread

Dari riset toko kecil-menengah Indonesia + iterasi UX, ada 12 keputusan yang worth dilacak:

1. **Riset SMB Indonesia menghasilkan 4 gap utama** — Brand (banyak filter dibutuhkan), Tag (merchandising flexibility), Custom field (regulated categories), Hierarchical category (F&B menu deep). MOQ ditambahkan sebagai bonus kecil. Diskusi awal mempertimbangkan multi-foto, alias nama struk, dan successor (produk pengganti yang discontinued) — di-defer.
2. **Custom field: prebuilt vs framework** — pilih prebuilt + metadata escape hatch. Framework dinamis dengan per-category scoping di-defer karena ROI tidak besar untuk SMB awal; kalau nanti ada operator yang pakai metadata yang sama untuk banyak produk, baru promosi ke prebuilt.
3. **Tag storage: name vs ID** — pilih name. Trade-off: rename tag di registry tidak update produk yang sudah pakai. Tapi: JSON readable, free-form auto-add (operator boleh ketik tag belum-terdaftar), robust kalau tag dihapus (produk masih ada tag-nya, cuma neutral color).
4. **Brand: dengan logo URL atau nama saja** — operator pilih dengan logo URL. Tradeoff: butuh URL dari operator (sama seperti Product imageUrl, upload masih di-defer).
5. **MOQ: sales-side vs procurement-side** — pilih procurement-side. Reasoning: tier diskon volume sudah cover use case sales-side. Procurement MOQ lebih sering ditemui karena pemasok wajibkan min dus/krat.
6. **Tree view di /categories: indented Table vs nested ul/li** — pilih indented Table. Alasan: SMB tetap butuh kolom info (Slug, Pajak, Deskripsi, count). Tree view murni kehilangan alignment kolom.
7. **Tree count: direct only atau include descendants** — pilih include descendants sebagai angka utama, plus subtitle `(N langsung)` kalau beda. Konsisten dengan filter /products yang sudah include descendants. Operator yang lihat "Minuman: 5 produk" expect total termasuk Kopi & Single Origin.
8. **Tooltip mobile UX** — toggle on tap (click), bukan hover. Hover dipakai untuk desktop sebagai fallback. Click-outside dan Escape untuk close — tidak butuh library karena pattern simple.
9. **Wording iteration**: revisi pertama "Cara harga jual mengikuti biaya" + "Ikut pengiriman yang sedang habis" masih awkward (kata "pengiriman" dan "sedang habis" tidak alami). Iterasi kedua: "Acuan biaya untuk hitung harga jual" + value berbentuk kalimat ("Biaya beli yang saya isi sendiri" / "Harga beli stok yang sedang dijual"). Hasilnya: baca label+value sebagai satu kalimat utuh.
10. **Pricing kind labels Indonesia** — "Markup %" → "Persen untung" (lebih akrab untuk pemilik toko), "Cost + amount" → "Biaya + nominal" (frasenya tetap aritmatika tapi pakai kata Indonesia), "Fixed price" → "Harga tetap". Berdampak di PriceAdjustmentModal juga.
11. **`Komposit` label tampil sebagai `Resep / Paket`** — value `'composite'` tetap (tidak refactor enum) supaya codepath tidak berubah; cuma display label di `productKindOptions` yang ganti. Operator nggak perlu tahu kata "komposit" untuk paham fitur.
12. **HET di-defer** — operator nanya soal HET; jawabannya regulated product specific. Karena pattern saat ini sudah ada di consignment PO line, tidak buru-buru tambah field master sebelum ada permintaan konkret.

### Sesi lanjutan: order kartu, satuan di bahan, tips varian

Setelah batch utama selesai, ada beberapa iterasi UX yang ditemukan saat operator review form:

#### Reorder kartu untuk produk komposit

Sebelumnya untuk komposit, urutan kartu di kolom utama: **Dasar → Cara penyiapan → Harga & Stok → (chip "Tambah komponen" di dalam Harga & Stok) → Bahan / Isi paket** (cuma muncul saat sudah ada bahan). Akibatnya operator harus scroll ke Harga & Stok untuk lihat chip add component, klik, scroll bawah ke kartu Bahan baru muncul, isi bahan, scroll naik lagi ke Harga & Stok untuk ubah biaya pakai biaya efektif dari bahan. Awkward.

**Sekarang** untuk komposit: **Dasar → Cara penyiapan → Bahan / Isi paket → Harga & Stok**. Bahan card selalu render (bukan cuma `showComponents`); empty state berisi tombol "Tambah komponen pertama" + penjelasan kenapa diisi dulu. Saat user sampai ke Harga & Stok, biaya efektif sudah keisi dari bahan. Chip "Tambah komponen (resep)" di-remove dari opt-in chips Harga & Stok karena redundan dengan kartu Bahan yang sudah jadi entry point natural.

Outer condition kartu Bahan ganti dari `{#if showComponents}` ke `{#if form.kind === 'composite'}`. Untuk goods, urutan tetap sama (kartu Bahan tidak render karena `showComponents` di kalkulasi cost masih operasi sebagai before).

#### Kemasan untuk bahan — `CompositeComponent` dapat unitId + unitFactor

Sebelumnya `c.quantity` selalu dianggap dalam base unit produk komponen. Akibatnya kalau operator mau tulis resep "1 ekor ayam" dan Ayam Mentah base-nya `pcs` (potong), harus diisi `quantity: 8`. Tidak natural — operator mikirnya "ekor", bukan "8 pcs".

Tambah 2 field opsional ke `CompositeComponent`:

```ts
unitId?: string;
unitFactor?: number;
```

Plus helper exported `componentBaseQty(c)` = `c.quantity * (c.unitFactor ?? 1)`. Dipakai di semua callsite math:

| File | Sebelum | Sesudah |
|---|---|---|
| `products.svelte.ts` `componentsCost` | `c.quantity * componentBaseCost(c)` | `componentBaseQty(c) * componentBaseCost(c)` |
| `products.svelte.ts` `componentsProducible` | `floor(stock / c.quantity)` | `floor(stock / componentBaseQty(c))` |
| `orders.svelte.ts` `deductComponents` | `c.quantity * multiplier` | `c.quantity * (c.unitFactor ?? 1) * multiplier` |
| `productionRuns.svelte.ts` planner | `c.quantity * intendedQty` + bottleneck `floor(have / c.quantity)` | `perOutput = componentBaseQty(c)`, `required = perOutput * intendedQty`, bottleneck `floor(have / perOutput)` |
| `ProductForm` `recipeFormCost` | `c.quantity * componentCost(c)` | `c.quantity * (c.unitFactor ?? 1) * componentCost(c)` |
| `ProductForm` `variantEffectiveCost` | sama | sama (factor dimasukkan) |
| `ProductForm` `producibleFormStock` | `floor(avail / c.quantity)` | `floor(avail / (qty × factor))` |
| `PriceAdjustmentModal` cost approx | `c.quantity * cost` | `(qty × factor) * cost` |

Backward compat: legacy components tanpa `unitId`/`unitFactor` tetap berfungsi karena factor di-default ke 1.

**UI Satuan picker** ditambah di tiga tempat (semuanya pakai pola yang sama):

1. Kartu **Bahan / Isi paket** level-produk
2. Sub-section **Resep** di tiap kartu Varian (untuk override resep per-varian)
3. Sub-section **Bahan yang dipotong** di tiap kartu Ekstra

Layout dual-row mirror PO line:
- **Row 1**: Produk Select + Varian Select (kalau produk komponen punya varian) + tombol Hapus
- **Row 2**: Qty Input + Satuan Select (cuma muncul kalau produk komponen punya minimal 1 kemasan tambahan)
- Hint konversi *"1 ekor = 8 pcs"* di bawah saat `unitFactor !== 1`

Helper baru di ProductForm:

```ts
componentUnitOptionsFor(productId): { value, label }[]
// Returns: base unit (factor 1) + tiap packaging dari produk komponen.
// Value encoding: `${unitId}|${factor}`.

onComponentUnitChange(comp, value)
// Parse "unitId|factor", set comp.unitId + comp.unitFactor.
// Saat factor === 1, simpan undefined supaya seed lama tetap kompatibel.
```

Saat operator ganti produk komponen, `unitId` + `unitFactor` di-reset ke `undefined` (kemasan beda produk beda).

#### Tooltip kontekstual field "Satuan" di Harga & Stok

Operator nanya: untuk komposit, "satuan" itu maksudnya satuan output atau satuan bahan? Pertanyaan valid karena field "Satuan" di kartu Harga & Stok ambiguous kalau dilihat tanpa konteks.

Tooltip sekarang switch berdasarkan `form.kind`:

- **Goods**: *"Satuan dasar untuk jual barang ini — mis. pcs, kg, gram, botol, liter. Kalau jual juga per dus/karton, tambah di Satuan Kemasan."*
- **Composite**: *"Satuan output produk ini — yaitu 1 unit hasil jadinya (mis. porsi, paket, pcs, potong). Bukan satuan bahan-bahannya; bahan punya satuan sendiri masing-masing."*

#### Tips inline: kapan pakai varian vs produk baru

Operator menanyakan: kapan pakai varian, kapan jadikan produk terpisah, kapan cukup kemasan saja? Pertanyaan yang sering muncul saat operator setup katalog awal. Ditambah `<details>` collapsible biru muda di kartu Varian, di atas attribute editor:

> 💡 **Kapan pakai varian vs pisah jadi produk baru?**
>
> **Pakai varian** kalau: versi sama produk (warna/ukuran/edisi); customer mikirnya satu produk; laporan masuk akal kalau digabung; stok dipisah per kombinasi tapi tampil satu kartu.
>
> **Pisah jadi produk baru** kalau: spec teknis beda penting (Aqua 600mL vs 1.5L); beda kategori/brand di laporan; nama beda banget di mata customer; butuh kemasan jual benar-benar beda.
>
> **Cukup kemasan saja** kalau: produknya sama persis, cuma cara jualnya beda (kaleng/6-pack/dus); tidak ada perbedaan warna/ukuran.
>
> **Keterbatasan saat ini**: varian × kemasan = kemasan & harga lusinannya shared lintas varian. Tidak bisa beda barcode/harga per (varian, kemasan). Workaround: jadikan varian, atau pisah produk.

Default collapsed supaya tidak overload form, terbuka saat operator butuh.

#### Conversation thread sesi lanjutan

13. **Urutan kartu untuk komposit** — operator complain harus scroll naik-turun. Reorder Bahan sebelum Harga & Stok adalah refactor visual kecil yang impactful. Sekalian kartu Bahan dibuat selalu render untuk komposit dengan empty state, dan chip "Tambah komponen" di Harga & Stok dihapus.
14. **Satuan untuk bahan (mis. 1 ekor ayam)** — operator nanya apakah bahan cuma bisa pakai satuan dasar. Realisasinya `CompositeComponent.quantity` selalu base, jadi resep "1 ekor" terpaksa ditulis "8 pcs". Fix: tambah `unitId` + `unitFactor` opsional plus helper `componentBaseQty(c)`. Math di semua call site di-update konsisten.
15. **Varian × kemasan, bisa coexist?** — operator nanya sebelum lanjut UI. Jawaban: ya bisa untuk goods, tapi `ProductPackaging` shared lintas varian (tidak ada per-(varian, kemasan) pricing/barcode). Keterbatasan didokumentasi di tips inline; refactor besar di-defer karena workaround "jadikan varian" cukup untuk SMB awal.
16. **Tips kapan pakai varian vs produk baru** — operator minta panduan tertulis di form. Ditambah `<details>` collapsible di kartu Varian dengan 3 blok kriteria + contoh + catatan keterbatasan.
17. **Per-variant components + extras components UI** — sebelumnya cuma Bahan level-produk yang dapat Satuan picker. Operator minta konsisten — UI Satuan picker ditambah di dua tempat lain (resep per-varian, bahan ekstra) dengan pola identik.
18. **Field "Satuan" di Harga & Stok ambiguous untuk komposit** — operator review tooltip sebelumnya minim konteks. Tooltip sekarang switch per `form.kind` supaya jelas: goods = satuan jual, composite = satuan output.

---

That's the master product. If you're picking this up cold, read this doc, then open `src/lib/stores/products.svelte.ts` and `src/lib/components/products/ProductForm.svelte` — those two files plus this doc are 90% of the surface area.

---

# Part II — Business plan, decisions, and rationale

> Everything below is the **why**. The sections above are the **what** (data shapes, helpers, code paths). When the two disagree, the sections below are the intent; sections above are the implementation.
>
> **Last reviewed:** 2026-05-15

## Vision & positioning

A point-of-sale + inventory admin tool for **small-to-medium Indonesian retail**. Target persona: warmindo / warung / café owner who manages a single store and wants to grow into multi-zone storage, consignment supply, audit-grade accountability, and credit-customer (bon/piutang) sales without buying enterprise software.

**Promise:** start as simple as a paper notebook ("ketik produk, cetak harga, terima uang"), but every feature the owner needs as they grow — multi-location stock, cycle count for theft detection, piutang ledger for regular customers, consignment tracking, stock forecasting — is one toggle away and uses the data they're already entering.

**Positioning:**
- **Not** ERP-class (no general ledger, no chart of accounts, no double-entry). Focused on operational reality of a small store.
- **Not** SaaS-templated. Indonesian-language UI, IDR-only pricing, tax rules (PPN 11% / exempt) baked in.
- **Not** "POS for restaurants only" nor "POS for retail only" — supports both: composite recipes (mie ayam = noodle + chicken + sauce) AND retail packaging (1 pcs / 1 box of 24).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Alat admin POS + inventaris untuk **retail Indonesia kecil-menengah**. Persona target: pemilik warmindo / warung / café yang mengelola satu toko dan ingin berkembang ke penyimpanan multi-zona, supply konsinyasi, akuntabilitas berkualitas audit, dan penjualan customer kredit (bon/piutang) tanpa harus beli software enterprise.

**Janji:** mulai sesederhana buku catatan ("ketik produk, cetak harga, terima uang"), tapi tiap fitur yang dibutuhkan owner saat berkembang — stok multi-lokasi, cycle count untuk deteksi pencurian, ledger piutang untuk langganan tetap, tracking konsinyasi, forecast stok — cukup satu toggle di /settings dan langsung memakai data yang sudah ada.

**Positioning:**
- **Bukan** kelas ERP (tidak ada general ledger, chart of accounts, double-entry). Fokus pada realitas operasional toko kecil.
- **Bukan** SaaS templated. UI berbahasa Indonesia, harga IDR saja, aturan pajak (PPN 11% / exempt) sudah baked-in.
- **Bukan** "POS hanya restoran" atau "POS hanya retail" — mendukung keduanya: recipe komposit (mie ayam = mie + ayam + saus) DAN packaging retail (1 pcs / 1 dus isi 24).

</details>

## Target user

**Primary persona: Pak/Bu Warmindo Owner**
- Single physical store (warmindo, warung, kelontong, café, small toko).
- Sells goods (drinks, snacks, packaged food) AND prepared items (recipes from ingredients).
- 50–500 SKUs.
- 1–4 staff: owner + cashier(s); maybe a kitchen worker.
- Phone or shared desktop/tablet; rarely both.
- 2–10 suppliers; some consign mugs/merch.
- 0–30 "langganan tetap" who might "bon dulu, bayar minggu depan."
- Currently tracks stock in a notebook or spreadsheet; loses 5–15% to shrinkage they can't trace.

**Secondary persona: Kasir**
- Fast pick (variant + packaging shortcut buttons), fast scan (USB scanner), clear blockers when transaction is rejected.
- Doesn't manage inventory directly; might do moves and opname.

**Anti-persona:** multi-branch chain (out of scope), restaurant with full table-service / reservations / kitchen tickets, B2B distributor primarily on net-90 invoices.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Persona utama: Pak/Bu Owner Warmindo**
- Satu toko fisik (warmindo, warung, kelontong, café, toko kecil).
- Jual goods (minuman, snack, makanan kemasan) DAN item olahan (recipe dari bahan).
- 50–500 SKU.
- 1–4 staf: owner + kasir; mungkin satu pekerja dapur.
- HP atau desktop/tablet bersama; jarang keduanya.
- 2–10 supplier; ada yang konsinyasi mug/merch.
- 0–30 "langganan tetap" yang kadang "bon dulu, bayar minggu depan."
- Saat ini catat stok di buku atau spreadsheet; kehilangan 5–15% ke shrinkage yang tidak bisa di-trace.

**Persona sekunder: Kasir**
- Pick cepat (tombol shortcut varian + packaging), scan cepat (USB scanner), penolakan transaksi yang jelas.
- Tidak langsung mengelola inventaris; mungkin lakukan pindah stok dan opname.

**Anti-persona:** rantai multi-cabang (di luar scope), restoran dengan full table-service / reservasi / kitchen ticket, distributor B2B yang utamanya jalan dengan invoice net-90.

</details>

## Constraints & defaults

| Aspect | Choice | Why |
|---|---|---|
| Currency | IDR only | Domestic Indonesian retail. `formatRupiah` uses `id-ID`, 0 fraction digits. |
| Language | Bahasa Indonesia | UI labels, errors, badges, notes. English in code/comments. |
| Tax | PPN 11% default, `tax_exempt` available | Per UU HPP. Fallback: product → category → default. Bahan Segar defaults exempt. |
| Date locale | `id-ID` | Display via `Intl.DateTimeFormat`. ISO 8601 for storage. |
| Time zone | Local (browser) | No multi-TZ handling. |
| Scale | Single store, multi-zone | One physical location with internal zones (Etalase, Rak, Gudang). |
| Persistence | In-memory only | `$state` singletons; refresh wipes runtime data. Backend deferred. |
| Auth | Hardcoded user | `user.current.name` for performer attribution. Blocked on backend. |
| Decimal qty | Allowed via packaging factor | Base units always integer (pcs, g, mL). Fractional packaging input rounds on store. |
| Negative stock | Not allowed | Atur stok / opname enforce min 0. Sales blocked when `stockOf <= 0`. |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

| Aspek | Pilihan | Kenapa |
|---|---|---|
| Mata uang | IDR saja | Retail domestik Indonesia. `formatRupiah` pakai `id-ID`, 0 digit pecahan. |
| Bahasa | Bahasa Indonesia | Label UI, error, badge, catatan. English di code/komentar. |
| Pajak | PPN 11% default, `tax_exempt` tersedia | Per UU HPP. Fallback: produk → kategori → default. Bahan Segar default exempt. |
| Locale tanggal | `id-ID` | Display via `Intl.DateTimeFormat`. Storage ISO 8601. |
| Zona waktu | Lokal (browser) | Tidak ada handling multi-TZ. |
| Skala | Single store, multi-zona | Satu lokasi fisik dengan zona internal (Etalase, Rak, Gudang). |
| Persistence | In-memory saja | Singleton `$state`; refresh bersihkan data runtime. Backend ditunda. |
| Auth | User hardcoded | `user.current.name` untuk atribusi performer. Diblokir backend. |
| Qty desimal | Diizinkan via packaging factor | Base unit selalu integer (pcs, g, mL). Input packaging pecahan dibulatkan di store. |
| Stok negatif | Tidak diizinkan | Atur stok / opname enforce min 0. Penjualan diblokir saat `stockOf <= 0`. |

</details>

## Architecture philosophy

### Opt-in features for small stores
Every non-trivial workflow (multi-zone storage, audit trail, opname) is **gated behind a toggle in /settings**, designed off-by-default for production (currently `true` for dev convenience). A warmindo with 20 SKUs and one cashier should not see "Pindahkan stok" / "Riwayat Stok" / "Opname Stok" until they enable them.

When a toggle is **off**: data layer keeps working (every batch carries `locationId: 'loc_gudang'`; `stockMovements.log` no-ops). UI surface vanishes (sidebar entries hide, row actions hide, page-level empty states explain enabling). Toggling on later = zero migration.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tiap workflow non-trivial (penyimpanan multi-zona, audit trail, opname) **di-gate di belakang toggle di /settings**, dirancang off-by-default untuk produksi (saat ini `true` untuk kenyamanan dev). Warmindo dengan 20 SKU dan satu kasir tidak boleh melihat "Pindahkan stok" / "Riwayat Stok" / "Opname Stok" sampai mengaktifkannya.

Saat toggle **off**: data layer tetap jalan (tiap batch tetap bawa `locationId: 'loc_gudang'`; `stockMovements.log` jadi no-op). Permukaan UI menghilang (entry sidebar hide, aksi row hide, empty state di halaman menjelaskan cara mengaktifkan). Toggle on di kemudian hari = zero migration.

</details>

### Audit-first when enabled
When audit toggle is on, **every** batch mutation writes a `StockMovement` row — no exceptions. Sales (per-allocation), receives, manual adjustments, moves, opname reconciliations, consignment returns. The ledger is the single source of truth for "what happened, to what, when, where, by whom, with what reason."

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat toggle audit on, **tiap** mutasi batch menulis row `StockMovement` — tanpa pengecualian. Penjualan (per-alokasi), penerimaan, penyesuaian manual, pemindahan, rekonsiliasi opname, retur konsinyasi. Ledger ini jadi single source of truth untuk "apa yang terjadi, ke apa, kapan, di mana, oleh siapa, dengan alasan apa."

</details>

### Frontend-first scaffold
`$state`-backed singletons are the "stores," seeded with realistic data. Lets the user iterate on UX without committing to a backend stack. Forces clean separation between UI and "API" (store method calls). Backend migration becomes mostly mechanical (store methods → API endpoints; `$state` arrays → SQL queries).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Singleton yang di-back `$state` adalah "store"-nya, di-seed dengan data realistis. Memungkinkan user iterasi UX tanpa commit ke stack backend dulu. Memaksa pemisahan rapi antara UI dan "API" (panggilan method store). Migrasi backend nantinya tinggal mekanikal (method store → endpoint API; array `$state` → query SQL).

</details>

### Single source of truth for stock
Stock lives **only** on `Batch.qtyRemaining`. No scalar `Product.stock` / `Variant.stock`. Every derived value (`stockOf`, `stockBreakdown`, `stockByLocation`, `producibleStock`, `producibleVariantStock`, `totalStock`) computed at read. Eliminates "displayed stock ≠ actual stock" bug class. Cost is similarly derived (`currentCost` = weighted average of owned batches).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Stok ada **hanya** di `Batch.qtyRemaining`. Tidak ada skalar `Product.stock` / `Variant.stock`. Tiap nilai turunan (`stockOf`, `stockBreakdown`, `stockByLocation`, `producibleStock`, `producibleVariantStock`, `totalStock`) dihitung saat read. Menghapus kelas bug "stok tampilan ≠ stok aktual". Cost juga diturunkan dengan cara serupa (`currentCost` = weighted average batch yang owned).

</details>

### Reverse-only audit operations
Non-destructive where possible:
- `moveStock` full-remainder transfer mutates `locationId` in place but logs `move-relocate` for traceability.
- Partial transfers create sibling batches preserving `unitCost`, `expiresAt`, `receivedAt`, supplier, source PO.
- Cancelled orders don't delete `batchAllocations`; they replay them in reverse to restock.
- Manual `adjust-out` decrements existing batches LIFO (newest first) to preserve FIFO order for future sales.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Non-destruktif sedapat mungkin:
- Transfer sisa-penuh `moveStock` memutasi `locationId` in-place tapi log `move-relocate` untuk traceability.
- Transfer parsial buat batch sibling dengan tetap pertahankan `unitCost`, `expiresAt`, `receivedAt`, supplier, source PO.
- Order yang cancel tidak menghapus `batchAllocations`; di-replay terbalik untuk restock.
- `adjust-out` manual mengurangi batch yang ada secara LIFO (terbaru dulu) untuk pertahankan urutan FIFO penjualan ke depan.

</details>

## Feature inventory

Grouped by domain. Each lists its surfaces and key behaviors.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Dikelompokkan per domain. Tiap entry mendaftar surface (route) dan perilaku kunci.

</details>

### Product catalog
**Surfaces:** `/products`, `/products/new`, `/products/[id]/edit`, master-data CRUD for category/unit/pricelist/tax/supplier.

- **Two product kinds:** `goods` (bought finished) and `composite` (made from other products — bundles, BOM recipes).
- **Variants** (Red/M, Black/L) with own SKU, cost, prices, barcode, image, FIFO stock queue.
- **Packagings** (1 pcs / 6-pack / 24-box) with own pricing entries + barcode.
- **Attributes** (Color, Size) drive variant generator; `regenerateVariants` preserves manual edits.
- **Extras / modifiers** (extra shot, almond milk) — optional add-ons with price delta + optional component deductions.
- **Tax fallback chain:** product → category → default.
- **Default supplier** soft reference; used for autofill at PO creation + forecast reorder math.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Surface:** `/products`, `/products/new`, `/products/[id]/edit`, CRUD master-data untuk kategori/unit/pricelist/pajak/supplier.

- **Dua kind produk:** `goods` (dibeli jadi) dan `composite` (dirakit dari produk lain — bundle, recipe BOM).
- **Varian** (Merah/M, Hitam/L) dengan SKU, cost, harga, barcode, image, dan antrian stok FIFO sendiri.
- **Packaging** (1 pcs / 6-pak / dus 24) dengan entry pricing + barcode sendiri.
- **Attribute** (Warna, Ukuran) menggerakkan generator varian; `regenerateVariants` pertahankan edit manual.
- **Extras / modifier** (extra shot, susu almond) — add-on opsional dengan delta harga + pengurangan komponen opsional.
- **Chain fallback pajak:** produk → kategori → default.
- **Default supplier** soft reference; dipakai autofill saat buat PO + math reorder forecast.

</details>

### Inventory: batches + locations
**Surfaces:** `/inventory`, `/inventory/[id]/history`, `/locations`, `/inventory/move/scan`, `/inventory/move/bulk`, `/inventory/batches/[id]/label`, `/inventory/po/[poId]/labels`.

- **Batches** are SoT: `{ id, code (BATCH-YYYY-NNN), productId, variantId?, ownership, supplierId?, unitCost, qtyReceived, qtyRemaining, receivedAt, expiresAt?, locationId, notes }`.
- **FIFO depletion** sorts by `expiresAt` ASC then `receivedAt` ASC.
- **Locations** (opt-in): Etalase / Rak Belakang / Gudang, each with `customerVisible` + `kind`. One flagged `isDefaultReceipt`.
- **Three move flows** ([decision](#three-move-flows-not-one)): per-row modal, scan basket, bulk picker.
- **Stock adjustments** — Atur stok modal with required reason enum + optional photo (FileReader → data URL).
- **Expiry tracking** — `requiresExpiration` products require date at receive/adjust. Per-product expiry-soon warning on inventory.
- **Per-product history** — `/inventory/[id]/history` with timeline + stats (Diterima, Terjual, Penyesuaian, Pemindahan, Shrinkage value).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Surface:** `/inventory`, `/inventory/[id]/history`, `/locations`, `/inventory/move/scan`, `/inventory/move/bulk`, `/inventory/batches/[id]/label`, `/inventory/po/[poId]/labels`.

- **Batch** adalah SoT: `{ id, code (BATCH-YYYY-NNN), productId, variantId?, ownership, supplierId?, unitCost, qtyReceived, qtyRemaining, receivedAt, expiresAt?, locationId, notes }`.
- **Penipisan FIFO** sortir `expiresAt` ASC lalu `receivedAt` ASC.
- **Lokasi** (opt-in): Etalase / Rak Belakang / Gudang, masing-masing dengan `customerVisible` + `kind`. Satu di-flag `isDefaultReceipt`.
- **Tiga flow pindah** ([keputusan](#three-move-flows-not-one)): modal per-row, basket scan, picker massal.
- **Penyesuaian stok** — modal Atur stok dengan enum alasan wajib + foto opsional (FileReader → data URL).
- **Tracking kedaluwarsa** — produk `requiresExpiration` wajib isi tanggal saat receive/adjust. Peringatan expiry-soon per-produk di inventory.
- **History per-produk** — `/inventory/[id]/history` dengan timeline + stat (Diterima, Terjual, Penyesuaian, Pemindahan, nilai Shrinkage).

</details>

### Audit trail & opname
**Surfaces:** `/stock-movements`, `/stock-opname`, `/stock-opname/new`, `/stock-opname/[id]`.

- **StockMovement ledger** — every mutation logs `{ kind, qtyDelta, qtyAfter, unitCost, reference, performedBy, at, reason?, imageUrl?, notes }`. Nine kinds: `receive`, `sale`, `sale-cancel`, `adjust-in`, `adjust-out`, `move-out`, `move-in`, `move-relocate`, `return-consignor`.
- **Opname workflow** — admin picks location + category + product subset → system snapshots `expectedQty` per (product, variant) → admin enters `countedQty` → system reconciles non-zero variance via `batches.adjustStock` with opname reference.
- **Multi-packaging count input** — per-row unit selector on opname count screen. Admin counts "3 trays" → system records `30 pcs` + shows "= 30 pcs" hint.
- **Selidiki investigation** — per-row button → side panel with `MovementTimeline` (last 30 days for that product/variant at that location). For tracing missing units.
- **Reusable `<MovementTimeline>`** component shared by Selidiki + per-product history page.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Surface:** `/stock-movements`, `/stock-opname`, `/stock-opname/new`, `/stock-opname/[id]`.

- **Ledger StockMovement** — tiap mutasi log `{ kind, qtyDelta, qtyAfter, unitCost, reference, performedBy, at, reason?, imageUrl?, notes }`. Sembilan kind: `receive`, `sale`, `sale-cancel`, `adjust-in`, `adjust-out`, `move-out`, `move-in`, `move-relocate`, `return-consignor`.
- **Workflow opname** — admin pilih lokasi + kategori + subset produk → sistem snapshot `expectedQty` per (produk, varian) → admin input `countedQty` → sistem rekonsiliasi varian non-nol via `batches.adjustStock` dengan reference ke opname.
- **Input count multi-packaging** — selector unit per-row di layar count opname. Admin hitung "3 tray" → sistem catat `30 pcs` + tampilkan hint "= 30 pcs".
- **Selidiki** — tombol per-row → panel samping dengan `MovementTimeline` (30 hari terakhir untuk produk/varian itu di lokasi itu). Untuk trace unit yang hilang.
- **Komponen `<MovementTimeline>` reusable** — dipakai Selidiki + halaman history per-produk.

</details>

### POS terminal (Kasir)
**Surface:** `/pos`.

- **Multi-tab cart sessions** — tab strip with customer name + line count + close.
- **Product grid** — click adds 1 base unit.
- **Quick-pick buttons:**
  - Packagings: button strip (`+ pcs`, `+ Box ·24`). One tap = new cart line at that unit.
  - Variants: button strip (`+ White`, `+ Black`). One tap = new cart line for that variant. Variants win when both present (packaging switched on cart line).
- **+ Tambah** customer button next to Pelanggan label → inline add-customer modal, auto-selects new customer.
- **Pricelist resolution** — customer's `pricelistId` drives `priceForQty`. Pricelist name shown.
- **Scan/search** — Enter resolves to product SKU / variant SKU / batch code.
- **Tax-inclusive line totals.**
- **Payment methods:** Tunai, QRIS, Kartu, Transfer.
- **Cash partial payment** ([decision](#piutang-requires-per-customer-permission)):
  - Walk-in → blocked.
  - Customer without `creditAllowed` → blocked.
  - Customer with `creditAllowed` → order saved as `'credit'`, `paidAmount = paymentAmount`, sisa = piutang.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Surface:** `/pos`.

- **Sesi cart multi-tab** — strip tab dengan nama customer + jumlah line + tombol close.
- **Grid produk** — klik tambah 1 base unit.
- **Tombol quick-pick:**
  - Packaging: strip tombol (`+ pcs`, `+ Box ·24`). Satu tap = line cart baru di unit itu.
  - Varian: strip tombol (`+ White`, `+ Black`). Satu tap = line cart baru untuk varian itu. Varian menang saat keduanya ada (packaging di-switch di line cart).
- Tombol **+ Tambah** customer di samping label Pelanggan → modal add-customer inline, otomatis pilih customer baru.
- **Resolusi pricelist** — `pricelistId` customer menggerakkan `priceForQty`. Nama pricelist ditampilkan.
- **Scan/search** — Enter resolusi ke SKU produk / SKU varian / kode batch.
- **Total line tax-inclusive.**
- **Metode pembayaran:** Tunai, QRIS, Kartu, Transfer.
- **Pembayaran cash parsial** ([keputusan](#piutang-requires-per-customer-permission)):
  - Walk-in → diblokir.
  - Customer tanpa `creditAllowed` → diblokir.
  - Customer dengan `creditAllowed` → order disimpan sebagai `'credit'`, `paidAmount = paymentAmount`, sisa = piutang.

</details>

### Procurement: Purchase Orders
**Surfaces:** `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/[id]`, `/purchase-orders/[id]/edit`.

- **PO types:** `standard` (utang per PO total) and `consignment` (utang per-sale via `/payouts`).
- **Statuses:** `draft` → `sent` → `partial`/`received` → `cancelled`. Transitions explicit.
- **Goods receipt** creates one `Batch` per line, snapshotting unit cost / supplier / source PO line. Supports partial fulfillment. Auto-flips status.
- **Per-line expiry** — `requiresExpiration` products require `expiresAt` at receive.
- **Label printing** — single-batch + per-PO bulk for thermal-printer output.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Surface:** `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/[id]`, `/purchase-orders/[id]/edit`.

- **Tipe PO:** `standard` (utang per total PO) dan `consignment` (utang per-sale via `/payouts`).
- **Status:** `draft` → `sent` → `partial`/`received` → `cancelled`. Transisi eksplisit.
- **Penerimaan barang** buat satu `Batch` per line, snapshot unit cost / supplier / line PO sumber. Mendukung partial fulfillment. Auto-flip status.
- **Kedaluwarsa per-line** — produk `requiresExpiration` wajib isi `expiresAt` saat receive.
- **Cetak label** — single-batch + bulk per-PO untuk output thermal printer.

</details>

### Finance: Utang, Piutang, Konsinyasi
**`/utang` — Accounts Payable to suppliers (standard POs):**
- Lists every `standard` PO with `paidAmount < poTotal`.
- Stat cards: committed / paid / outstanding. Filter by supplier / status / date.
- **Catat pembayaran** modal → `purchaseOrders.recordPayment` with amount + method.
- Detail modal: full payment timeline.

**`/piutang` — Accounts Receivable from customers:**
- Lists orders with `status: 'credit'` OR `status: 'paid'` with multi-payment lifecycle.
- Per-customer rekap card (sorted by outstanding desc; click to filter table).
- Stat cards: dijual / received / outstanding.
- **Catat penerimaan** modal → `orders.recordPayment`. Flips to `paid` when fully covered.
- Detail modal: full payment timeline per order.

**`/payouts` — Consignment-specific payable:**
- Reads `consignmentOwedBySupplier` (walks paid orders' `batchAllocations` where `ownership === 'consignment'`).
- Outstanding = total per supplier − sum of payouts.
- Return-to-consignor flow (`batches.returnToConsignor`) decrements without payable impact.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**`/utang` — utang ke supplier (PO standard):**
- Daftar tiap PO `standard` dengan `paidAmount < poTotal`.
- Stat card: committed / paid / outstanding. Filter via supplier / status / tanggal.
- Modal **Catat pembayaran** → `purchaseOrders.recordPayment` dengan amount + method.
- Modal detail: timeline pembayaran lengkap.

**`/piutang` — piutang dari customer:**
- Daftar order dengan `status: 'credit'` ATAU `status: 'paid'` yang punya lifecycle multi-payment.
- Card rekap per-customer (terurut outstanding desc; klik untuk filter tabel).
- Stat card: dijual / received / outstanding.
- Modal **Catat penerimaan** → `orders.recordPayment`. Flip ke `paid` saat terlunasi.
- Modal detail: timeline pembayaran lengkap per order.

**`/payouts` — utang spesifik konsinyasi:**
- Membaca `consignmentOwedBySupplier` (walk `batchAllocations` order paid di mana `ownership === 'consignment'`).
- Outstanding = total per-supplier − sum payout.
- Flow Retur-ke-konsinyor (`batches.returnToConsignor`) mengurangi stok tanpa dampak utang.

</details>

### Forecasting
**Surface:** `/forecast`.

- **Simple moving-average daily rate** over a window (7/14/30/60/90 days).
- **Bands:** 🔴 Kritis (≤3d), 🟠 Menipis (≤7d), 🟡 Perhatikan (≤14d), 🟢 Aman (>14d), ⚪ Tidak ada penjualan.
- **Suggested reorder qty** = `ceil(rate × (supplier.leadTimeDays + bufferDays))`. Buffer tunable inline.
- **Filter** by category / location / urgency / hide-no-sales. Composite products forecast via `producibleStock` ÷ composite-line velocity.
- **Inventory row badge** mirrors runway (only when band is critical/low/watch).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Surface:** `/forecast`.

- **Rate harian moving-average sederhana** lintas window (7/14/30/60/90 hari).
- **Band:** Kritis (≤3 hari), Menipis (≤7 hari), Perhatikan (≤14 hari), Aman (>14 hari), Tidak ada penjualan.
- **Saran qty reorder** = `ceil(rate × (supplier.leadTimeDays + bufferDays))`. Buffer bisa di-tune inline.
- **Filter** via kategori / lokasi / urgency / sembunyikan tanpa penjualan. Produk komposit forecast via `producibleStock` ÷ velocity line komposit.
- **Badge di row inventory** mirror runway (hanya saat band critical/low/watch).

</details>

### Master data
`/employees`, `/suppliers`, `/categories`, `/units`, `/pricelists`, `/taxes`, `/locations` (opt-in), `/products`, `/customers`. List page with search/filter + modal CRUD (products and POs use dedicated `/new` and `/[id]/edit` pages when forms get tall).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Resource master-data: `/employees`, `/suppliers`, `/categories`, `/units`, `/pricelists`, `/taxes`, `/locations` (opt-in), `/products`, `/customers`. Halaman list dengan search/filter + CRUD berbasis modal (produk dan PO pakai halaman dedicated `/new` dan `/[id]/edit` saat form-nya panjang).

</details>

## Key design decisions

### Consignment as PO type, not product flag
**Decision:** Product is "on consignment" iff at least one non-cancelled consignment-type PO references it.
**Why:** Reality. Same SKU can be retailed (owned) AND consigned (titipan) from different suppliers. A product-level flag forces an artificial decision.
**Alternative considered:** `Product.isConsigned: boolean`. Rejected as too coarse.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Produk "on consignment" kalau ada minimal satu PO tipe konsinyasi non-cancelled yang mereferensikannya.
**Kenapa:** Realitas. SKU yang sama bisa dijual retail (owned) DAN dititipkan (konsinyasi) dari supplier berbeda. Flag level-produk memaksa keputusan artifisial.
**Alternatif yang dipertimbangkan:** `Product.isConsigned: boolean`. Ditolak karena terlalu kasar.

</details>

### Batches as single source of truth (no scalar stock)
**Decision:** Stock lives on `Batch.qtyRemaining`. No scalar `Product.stock` / `Variant.stock`.
**Why:** Removes "displayed ≠ actual" bug class. FIFO depletion, cost-per-batch, consignment flag fall out naturally.
**Alternative:** Scalar updated on every sale/receive. Rejected for sync bugs.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Stok ada di `Batch.qtyRemaining`. Tidak ada skalar `Product.stock` / `Variant.stock`.
**Kenapa:** Hilangkan kelas bug "tampilan ≠ aktual". Penipisan FIFO, cost-per-batch, flag konsinyasi jatuh natural.
**Alternatif:** Skalar yang di-update tiap sale/receive. Ditolak karena bug sinkronisasi.

</details>

### Locations as opt-in feature
**Decision:** `Location` resource + `Batch.locationId` always present in data layer; UI gated by `settings.inventory.locationsEnabled`.
**Why:** Small stores keep everything in one place. Multi-zone adds real cognitive overhead.
**Alternative:** Always show locations. Rejected for friction.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Resource `Location` + `Batch.locationId` selalu hadir di data layer; UI di-gate `settings.inventory.locationsEnabled`.
**Kenapa:** Toko kecil menyimpan semua di satu tempat. Multi-zona menambah overhead kognitif yang nyata.
**Alternatif:** Selalu tampilkan lokasi. Ditolak karena friction.

</details>

### Three move flows (not one)
**Decision:** Per-row modal (review and decide) + scan basket (phone in warehouse) + bulk picker (weekly refill).
**Why:** Different physical contexts call for different inputs. Unifying makes all three worse.
**Alternative:** One unified UI. Rejected.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Modal per-row (review-and-decide) + basket scan (HP di gudang) + picker massal (pengisian mingguan).
**Kenapa:** Konteks fisik berbeda butuh input berbeda. Menyatukan semuanya bikin ketiganya lebih buruk.
**Alternatif:** Satu UI seragam. Ditolak.

</details>

### Required reason + photo on manual adjustments
**Decision:** Atur stok requires typed reason (`damaged`/`expired`/`lost`/`sample`/`found`/`initial-seed`/`correction`/`other`). Optional photo upload via FileReader → data URL.
**Why:** Audit value. Without reason, "manual adjust" rows are unqueryable. Photo proof matters for insurance / disputes / supplier returns.
**Alternative:** Free-text notes only. Rejected as not queryable.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Atur stok wajib pilih alasan terketik (`damaged`/`expired`/`lost`/`sample`/`found`/`initial-seed`/`correction`/`other`). Upload foto opsional via FileReader → data URL.
**Kenapa:** Nilai audit. Tanpa alasan, row "manual adjust" tidak bisa di-query. Bukti foto penting untuk asuransi / dispute / retur supplier.
**Alternatif:** Notes free-text saja. Ditolak karena tidak queryable.

</details>

### Atur stok and opname coexist
**Decision:** Keep both. Atur surgical ("known cause, known qty"); Opname procedural ("count and discover").
**Why:** Forcing single broken egg through multi-step opname is friction staff will skip by faking numbers. Atur is 3 clicks; Opname for one item is ~7.
**Alternative:** Remove Atur, route everything through Opname. Rejected.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Pertahankan keduanya. Atur sifatnya bedah ("penyebab dan qty diketahui"); Opname prosedural ("hitung lalu temukan selisih").
**Kenapa:** Memaksa satu telur pecah lewat opname multi-step adalah friction yang akan di-skip staf dengan memalsukan angka. Atur cukup 3 klik; Opname untuk satu item ~7 klik.
**Alternatif:** Hapus Atur, route semuanya via Opname. Ditolak.

</details>

### Quick-pick buttons on POS cards
**Decision:** Variant or packaging button strip on product cards. Main click still adds first variant + base unit.
**Why:** Tap-twice (open dropdown, change unit) is slow during a queue.
**Alternative:** Dropdown-only. Rejected for queue speed.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Strip tombol varian/packaging di card produk. Klik utama tetap menambah varian pertama + base unit.
**Kenapa:** Tap-dua-kali (buka dropdown, ganti unit) lambat saat antrian.
**Alternatif:** Dropdown saja. Ditolak demi kecepatan antrian.

</details>

### Separate /utang and /piutang pages
**Decision:** Dedicated pages, not extension of `/payouts`.
**Why:** They model different things. Utang = standard PO payables. Piutang = customer receivables. Payouts = consignment-specific (consignor owns the goods).
**Alternative:** Extend `/payouts`. Rejected.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Halaman dedicated, bukan ekstensi `/payouts`.
**Kenapa:** Tiga hal berbeda. Utang = utang PO standard. Piutang = piutang dari customer. Payouts = spesifik konsinyasi (konsinyor masih punya barangnya).
**Alternatif:** Perluas `/payouts`. Ditolak.

</details>

### Piutang requires per-customer permission
**Decision:** `Customer.creditAllowed: boolean` (default `false`). Walk-in cannot do piutang. POS rejects partial cash for customers without the flag.
**Why:** Without explicit permission, every walk-in could rack up uncollectable debt.
**Alternative:** Allow for any selected customer. Rejected as too leaky.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** `Customer.creditAllowed: boolean` (default `false`). Walk-in tidak bisa piutang. POS tolak cash parsial untuk customer tanpa flag ini.
**Kenapa:** Tanpa izin eksplisit, tiap walk-in bisa menumpuk hutang yang tidak tertagih.
**Alternatif:** Izinkan untuk customer mana pun yang dipilih. Ditolak karena terlalu bocor.

</details>

### Simple moving average for forecast
**Decision:** Daily rate = `sum(qty over window) / windowDays`. No seasonality, trend, or exponential smoothing.
**Why:** Accurate enough at warmindo scale. Day-of-week / seasonality fix specific issues but add complexity not yet justified. Forecast page labels itself "panduan, bukan kebenaran absolut."
**Alternative:** Exponential smoothing / weekday weights / ML. Deferred until simple-average is failing.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** Daily rate = `sum(qty selama window) / windowDays`. Tidak ada seasonality, trend, atau exponential smoothing.
**Kenapa:** Cukup akurat di skala warmindo. Day-of-week / seasonality memperbaiki isu spesifik tapi nambah kompleksitas yang belum justified. Halaman forecast pun melabeli diri "panduan, bukan kebenaran absolut."
**Alternatif:** Exponential smoothing / weekday weights / ML. Ditunda sampai simple-average gagal.

</details>

### Opt-in toggle defaults
**Decision:** `locationsEnabled` and `auditTrailEnabled` currently default `true` for dev convenience.
**Why for production:** Should flip to `false` before first real deploy so small stores see simple flow first. Release-prep checklist item.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

**Keputusan:** `locationsEnabled` dan `auditTrailEnabled` sekarang default `true` untuk kenyamanan dev.
**Kenapa untuk produksi:** Sebelum deploy nyata pertama, harus flip ke `false` supaya toko kecil melihat flow sederhana dulu. Item checklist release-prep.

</details>

## Opt-in toggles (in `/settings`)

### `inventory.locationsEnabled`
- **On:** "Lokasi" sidebar entry; `/inventory` gains location filter + breakdown chips + Pindahkan action + Scan/Bulk move pages; `/products` location breakdown; `/pos` location chips ("Etalase · 5 / Gudang · 90" or "Ambil dari: Gudang · 80"); Atur stok modal location Select.
- **Off:** All location UI hidden. Stock still tracked per batch with `locationId: 'loc_gudang'`. Toggle on later = instant unlock.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- **On:** entry sidebar "Lokasi"; `/inventory` dapat filter lokasi + chip breakdown + aksi Pindahkan + halaman Scan/Bulk move; breakdown lokasi di `/products`; chip lokasi di `/pos` ("Etalase · 5 / Gudang · 90" atau "Ambil dari: Gudang · 80"); Select lokasi di modal Atur stok.
- **Off:** Semua UI lokasi disembunyikan. Stok tetap di-track per batch dengan `locationId: 'loc_gudang'`. Toggle on kemudian = unlock instan.

</details>

### `inventory.auditTrailEnabled`
- **On:** "Opname Stok" + "Riwayat Stok" sidebar; every batch mutation logs `StockMovement`; Atur stok requires reason; opname workflow available; investigation panels and per-product history populated.
- **Off:** No log writes. Pages accessible direct via URL but show "Aktifkan di Pengaturan" empty state.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- **On:** sidebar "Opname Stok" + "Riwayat Stok"; tiap mutasi batch log `StockMovement`; Atur stok wajib pilih alasan; workflow opname tersedia; panel Selidiki dan history per-produk terisi.
- **Off:** Tidak ada penulisan log. Halaman tetap aksesible lewat URL tapi tampilkan empty state "Aktifkan di Pengaturan".

</details>

### `operations.shiftsEnabled`
- **On:** "Operasional → Shift Kasir" sidebar entry; `/pos` shows shift banner (active or "Buka shift" CTA); new orders auto-stamp `shiftId` + `employeeId`; shift templates editor visible in `/settings`.
- **Off:** No shift UI in POS; sidebar group hidden. Existing shift data preserved.

**Future toggles to add:**
- `inventory.compositeEnabled` — hide BOM / recipe products for stores that only resell.
- `sales.piutangEnabled` — hide customer credit flow for cash-only stores.
- `sales.taxEnabled` — for non-PKP stores that don't charge PPN.
- `operations.multiCashier` — allow parallel open shifts on different registers (future).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- **On:** entry sidebar "Operasional → Shift Kasir"; `/pos` tampilkan banner shift (aktif atau CTA "Buka shift"); order baru auto-stamp `shiftId` + `employeeId`; editor template shift terlihat di `/settings`.
- **Off:** Tidak ada UI shift di POS; group sidebar hidden. Data shift yang sudah ada dipertahankan.

**Toggle masa depan yang akan ditambah:**
- `inventory.compositeEnabled` — sembunyikan produk BOM / recipe untuk toko yang hanya resell.
- `sales.piutangEnabled` — sembunyikan flow kredit customer untuk toko cash-only.
- `sales.taxEnabled` — untuk toko non-PKP yang tidak menarik PPN.
- `operations.multiCashier` — izinkan shift terbuka paralel di register berbeda (masa depan).

</details>

## Data model decisions (for backend planning)

### Variants in separate table
When backend lands: `products` and `product_variants` as separate tables with FK. Every `variantId` slot in current code becomes a real FK.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Saat backend masuk: `products` dan `product_variants` jadi tabel terpisah dengan FK. Tiap slot `variantId` di code saat ini jadi FK nyata.

</details>

### Polymorphic pricelist entries
Pricing exists at three scopes today: product, variant, packaging. Backend: one `pricelist_entries` table with polymorphic scope (`scope_kind`, `scope_id`) + `pricelist_id` + JSONB `pricing` + JSONB `tiers`.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Pricing hari ini ada di tiga scope: product, variant, packaging. Backend: satu tabel `pricelist_entries` dengan scope polimorfik (`scope_kind`, `scope_id`) + `pricelist_id` + JSONB `pricing` + JSONB `tiers`.

</details>

### Polymorphic composite components
`product.components`, `variant.components`, `extra.components` are the same shape. Backend: single `composite_components` table with polymorphic parent.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`product.components`, `variant.components`, `extra.components` punya bentuk sama. Backend: satu tabel `composite_components` dengan parent polimorfik.

</details>

### Global SKU uniqueness
SKU unique across `products.sku` and `product_variants.sku` so POS scan resolver matches without ambiguity. Partial unique index OR app-level overlap check.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

SKU unik lintas `products.sku` dan `product_variants.sku` supaya resolver scan POS match tanpa ambiguitas. Partial unique index ATAU pengecekan overlap di level app.

</details>

### JSONB for attributes config
`Product.attributes` and `variant.values` as JSONB columns. Less normalized but always whole-blob read/write.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`Product.attributes` dan `variant.values` sebagai kolom JSONB. Kurang ternormalisasi tapi selalu read/write whole-blob.

</details>

### BatchAllocation snapshot for audit
Every order line carries `batchAllocations` snapshotted at sale time. Survives batch mutations / deletions / supplier renames. Keeps consignor payout correct, cancellation restock accurate, per-product history reconstructible.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Tiap order line bawa `batchAllocations` yang di-snapshot saat sale. Bertahan dari mutasi/penghapusan batch / penggantian nama supplier. Jaga payout konsinyor tetap benar, restock saat cancel tetap akurat, history per-produk tetap bisa direkonstruksi.

</details>

### Audit log append-only
`stockMovements.items` is conceptually immutable. Store doesn't expose update/remove. Backend: append-only table with tamper-evident hash-chain for real audit (out of scope for scaffold).

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`stockMovements.items` secara konsep imutable. Store tidak mengekspos update/remove. Backend: tabel append-only dengan hash-chain tamper-evident untuk audit nyata (di luar scope scaffold).

</details>

### Performer via name string
`StockMovement.performedBy` is a string snapshot. Becomes `employeeId` FK when auth lands.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

`StockMovement.performedBy` adalah snapshot string. Akan jadi FK `employeeId` saat auth nyata masuk.

</details>

## Roadmap & deferred

### Near-term (2–4 weeks)
| Item | Why now | Effort |
|---|---|---|
| localStorage persistence | Refresh wipes everything; biggest dev-UX gap. | S |
| Receipt printing | POS sale loop incomplete. | S–M |
| Line-level refunds | Currently only whole-order cancel. | M |
| Per-customer outstanding view on `/customers/[id]` | Customer-side piutang history. | S |
| Forecast → "Buat PO" action | One-click prefill PO from forecast row. | M |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

| Item | Kenapa sekarang | Effort |
|---|---|---|
| Persistence localStorage | Refresh hapus semuanya; gap dev-UX terbesar. | S |
| Cetak struk | Loop sale POS belum komplit. | S–M |
| Refund per-line | Saat ini hanya bisa cancel whole-order. | M |
| View outstanding per-customer di `/customers/[id]` | History piutang sisi customer. | S |
| Aksi Forecast → "Buat PO" | Prefill PO satu klik dari row forecast. | M |

</details>

### Mid-term (1–3 months)
| Item | Why | Effort |
|---|---|---|
| Backend integration | Production persistence. Supabase (Postgres + Auth + Storage) target. | XL |
| Auth + per-employee permissions | Real performer tracking; role-based access. | L |
| Reports / Laporan | Sales summary, top products, shrinkage trend, expiring batches. | M |
| Image upload backend | Replace data-URLs with object storage. | M |
| Mobile-optimized POS | Thumb-friendly `/pos` and scan flow. | M |
| CSV import for products | Bulk SKU load via SheetJS. | M |
| Order discounts | Line + order level. | M |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

| Item | Kenapa | Effort |
|---|---|---|
| Integrasi backend | Persistence produksi. Target Supabase (Postgres + Auth + Storage). | XL |
| Auth + permission per-karyawan | Tracking performer nyata; akses role-based. | L |
| Reports / Laporan | Ringkasan penjualan, top product, tren shrinkage, batch mau expired. | M |
| Backend upload gambar | Ganti data-URL dengan object storage. | M |
| POS mobile-optimized | `/pos` dan flow scan yang thumb-friendly. | M |
| Import CSV produk | Load SKU massal via SheetJS. | M |
| Diskon di order | Level line + order. | M |

</details>

### Long-term (3–12 months)
| Item | Why | Effort |
|---|---|---|
| Multi-branch / multi-store | `Store` axis above `Location`. | XL |
| Accounting integration | GL entries from sales/PO/payout. | XL |
| Per-location reorder points | "Etalase low for X, auto-suggest transfer." | M |
| Transfer audit log | Dedicated Transfer entity. | M |
| Tamper-evident ledger | Hash-chain on movement rows. | M |
| Customer pricing auto-apply at checkout | Currently half-built. | S |
| Loyalty / points | Per-customer balance + redemption. | L |
| Day-of-week weighted forecast | Weekend spikes matter. | M |

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

| Item | Kenapa | Effort |
|---|---|---|
| Multi-cabang / multi-toko | Sumbu `Store` di atas `Location`. | XL |
| Integrasi akuntansi | Entry GL dari sale/PO/payout. | XL |
| Reorder point per-lokasi | "Etalase X menipis, otomatis saran transfer." | M |
| Audit log transfer | Entity Transfer dedicated. | M |
| Ledger tamper-evident | Hash-chain di row movement. | M |
| Auto-apply pricing customer di checkout | Saat ini setengah jadi. | S |
| Loyalty / poin | Saldo per-customer + redemption. | L |
| Forecast berbobot day-of-week | Lonjakan weekend penting. | M |

</details>

### Explicitly out of scope (won't build)
- Restaurant table service / reservations / kitchen tickets — different domain.
- Multi-currency — IDR only.
- Multi-tenant SaaS — single-tenant deployment per store.
- Built-in payment processing — cashier records method; reconciliation external.
- Built-in printer driver — browser print + ESC/POS via separate tooling.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

- Layanan meja restoran / reservasi / kitchen ticket — domain berbeda.
- Multi-currency — IDR saja.
- SaaS multi-tenant — deployment single-tenant per toko.
- Payment processing built-in — kasir hanya catat metode; rekonsiliasi di luar.
- Driver printer built-in — browser print + ESC/POS lewat tooling terpisah.

</details>

## Additional Bahasa Indonesia terms

(Supplements the technical glossary above with business-flavored terms.)

| Term | English | Meaning here |
|---|---|---|
| Warmindo | "warung makan Indonesia mie" | Small Indonesian eatery serving instant noodles + light meals. Primary persona. |
| Warung | small shop / kiosk | Generic small Indonesian retail. |
| Etalase | display case / shelf | Customer-facing storage zone. Default `customerVisible: true`. |
| Gudang | warehouse / storeroom | Bulk storage, not customer-facing. Default location for PO receipts. |
| Rak (Belakang) | back rack | Behind-counter storage, cashier-accessible. |
| Pindahkan / Pindah | move | Stock transfer between locations. |
| Opname / Stok opname | cycle count | Physical audit reconciling system vs reality. |
| Selidiki | investigate | Opname row action → movement history side panel. |
| Shrinkage | shrinkage | Negative variance from opname (theft / breakage / miscount). |
| Bon / Piutang | tab / receivable | Customer credit; requires `creditAllowed`. |
| Utang | payable | Money owed to suppliers from standard POs. |
| Konsinyasi / Titipan | consignment | Vendor-supplied inventory; we owe per-unit on sale. |
| PPN | VAT | Pajak Pertambahan Nilai, default 11% per UU HPP. |
| Net-30 / Net-14 | net-30 / net-14 | Pay within N days of invoice. |
| Kasir | cashier | POS terminal user; also `/pos` route title. |
| Pelanggan walk-in | walk-in | Customer not in system. Cannot do piutang. |
| Atur stok | adjust stock | Surgical manual change (write-off / found / sample). |
| DP / Down payment | DP | Initial partial payment on a credit order. |
| Kedaluwarsa | expired | Past expiry date. |
| Penyesuaian | adjustment | Manual stock change (`adjust-in` / `adjust-out` movements). |
| Penerimaan | receipt / receiving | Goods receipt at PO time OR customer payment receipt for piutang. |
| Lokasi default penerimaan | default receipt location | Where new PO receipts land (typically Gudang). |
| Catat pembayaran / penerimaan | record payment / receipt | Logging supplier payment (utang) / customer payment (piutang). |
| Berjenjang | tiered | Pricing with quantity thresholds. |
| Komposit | composite | Product built from components. |
| Varian | variant | Sellable variation (color/size). |

## Open questions

Things to decide later. None block current development.

1. **When to flip toggle defaults to `false`?** Both `locationsEnabled` and `auditTrailEnabled` default `true` today. Should flip before first real deploy so small stores see the simple flow.
2. **Receipt printing approach.** Browser print to PDF? ESC/POS over WebUSB? Local print service? Each has tradeoffs for warmindo hardware reality (cheap thermal printers shared via USB).
3. **Auth approach.** Email/password? PIN-per-employee (faster shift change)? Magic link? PIN seems right for the persona.
4. **Multi-currency support — never?** Designed IDR-only; revisit only if expanding into tourist-area markets.
5. **Where does Laporan land?** User pivoted away from reports toward utang/piutang. May stay deferred indefinitely.
6. **Refund vs cancellation.** Currently only whole-order cancel restocks. Line-level partial refund deferred (proportional batch restock + payment record).
7. **Composite product forecast.** Today uses `producibleStock` ÷ composite-velocity. Doesn't reflect "8 sold direct, 2 via combo" subtleties. Component-level forecast already counts both implicitly — confirm with real usage.
8. **Image storage when backend lands.** Today: data-URLs embedded. Backend: object storage with URL. Migration path TBD.
9. **Lead-time variability.** Currently `Supplier.leadTimeDays` is a single number. Per-product override (`Product.defaultSupplierLeadTimeDays`) more accurate but deferred.
10. **Opname for composite products.** Today excluded (no batches). Real warmindo counts components implicitly. Admin can opname components individually for now.

<details>
<summary>🇮🇩 Bahasa Indonesia</summary>

Hal-hal yang ditunda untuk diputuskan. Tidak ada yang memblokir pengembangan saat ini.

1. **Kapan flip default toggle ke `false`?** Hari ini `locationsEnabled` dan `auditTrailEnabled` keduanya default `true`. Sebaiknya flip sebelum deploy nyata pertama supaya toko kecil melihat flow sederhana lebih dulu.
2. **Pendekatan cetak struk.** Browser print ke PDF? ESC/POS via WebUSB? Print service lokal? Masing-masing punya trade-off untuk realitas hardware warmindo (printer thermal murah yang dibagi via USB).
3. **Pendekatan auth.** Email/password? PIN-per-karyawan (cepat saat ganti shift)? Magic link? PIN tampaknya cocok untuk persona ini.
4. **Dukungan multi-currency — tidak pernah?** Didesain IDR-only; ditinjau ulang hanya kalau ekspansi ke daerah turis.
5. **Di mana Laporan mendarat?** User pivot menjauh dari laporan ke utang/piutang. Mungkin tetap ditunda tanpa batas.
6. **Refund vs cancellation.** Hari ini hanya cancel whole-order yang restock. Refund parsial per-line ditunda (restock batch proporsional + record payment).
7. **Forecast produk komposit.** Hari ini pakai `producibleStock` ÷ velocity komposit. Belum cerminkan nuansa "8 terjual langsung, 2 via combo." Forecast level-komponen sudah hitung keduanya implisit — konfirmasi via pemakaian nyata.
8. **Storage gambar saat backend masuk.** Hari ini: data-URL ter-embed. Backend: object storage dengan URL. Path migrasi TBD.
9. **Variabilitas lead-time.** Saat ini `Supplier.leadTimeDays` single number. Override per-produk (`Product.defaultSupplierLeadTimeDays`) lebih akurat tapi ditunda.
10. **Opname untuk produk komposit.** Hari ini dikecualikan (tidak ada batch). Warmindo nyata hitung komponen secara implisit. Admin bisa opname komponen secara individu untuk saat ini.

</details>

---

*This Part II is a living document. Update when load-bearing decisions change, when toggles are added, when defaults flip, or when persona shifts. Keep it in sync with the technical sections above at major checkpoints.*
