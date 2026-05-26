export type PermissionDef = {
  key: string;
  label: string;
  description?: string;
};

export type PermissionGroup = {
  title: string;
  description?: string;
  permissions: PermissionDef[];
};

export const ALL_PERMISSIONS_WILDCARD = '*' as const;

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    title: 'Beranda',
    permissions: [{ key: 'menu.dashboard', label: 'Lihat Beranda' }]
  },
  {
    title: 'Operasi',
    description: 'Aktivitas harian: kasir, pesanan, promo, shift.',
    permissions: [
      { key: 'menu.pos', label: 'Akses terminal Kasir' },
      { key: 'menu.orders', label: 'Lihat daftar Pesanan' },
      {
        key: 'feature.orders.refund',
        label: 'Lakukan refund/pengembalian',
        description: 'Membatalkan atau mengembalikan pesanan setelah selesai.'
      },
      { key: 'menu.promotions', label: 'Lihat Diskon & Promo' },
      {
        key: 'feature.promotions.manage',
        label: 'Buat & ubah promo',
        description: 'Hanya peran yang berhak mengubah aturan diskon.'
      },
      { key: 'menu.shifts', label: 'Kelola Shift Kasir' },
      {
        key: 'feature.shifts.open-adhoc',
        label: 'Buka shift tanpa jadwal (ad-hoc)',
        description:
          'Boleh membuka shift saat tidak ada jadwal hari ini. Tanpa izin ini, shift hanya bisa dibuka sesuai jadwal yang sudah dibuat admin.'
      }
    ]
  },
  {
    title: 'Data Master',
    description: 'Pengaturan dasar yang jarang berubah.',
    permissions: [
      { key: 'menu.employees', label: 'Kelola Pegawai' },
      {
        key: 'menu.roles',
        label: 'Kelola Peran & Akses',
        description: 'Akses ke halaman ini sebaiknya hanya untuk admin.'
      },
      { key: 'menu.suppliers', label: 'Kelola Pemasok' },
      { key: 'menu.categories', label: 'Kelola Kategori' },
      { key: 'menu.brands', label: 'Kelola Brand' },
      { key: 'menu.tags', label: 'Kelola Tag' },
      { key: 'menu.units', label: 'Kelola Satuan' },
      { key: 'menu.products', label: 'Kelola Produk' },
      { key: 'menu.pricelists', label: 'Kelola Daftar Harga' },
      { key: 'menu.pricing', label: 'Pengaturan Harga' },
      { key: 'menu.taxes', label: 'Tarif Pajak' },
      { key: 'menu.locations', label: 'Kelola Lokasi' }
    ]
  },
  {
    title: 'Pengadaan & Keuangan',
    permissions: [
      { key: 'menu.purchase-orders', label: 'Order Pembelian' },
      { key: 'menu.payouts', label: 'Pembayaran Konsinyasi' },
      { key: 'menu.utang', label: 'Utang Pembelian' },
      { key: 'menu.piutang', label: 'Piutang Pelanggan' }
    ]
  },
  {
    title: 'Inventaris & Katalog',
    permissions: [
      { key: 'menu.inventory', label: 'Lihat Inventaris' },
      { key: 'menu.production', label: 'Produksi' },
      { key: 'menu.stock-opname', label: 'Opname Stok' },
      { key: 'menu.customers', label: 'Pelanggan' }
    ]
  },
  {
    title: 'Wawasan',
    permissions: [
      { key: 'menu.reports', label: 'Lihat Laporan Penjualan' },
      { key: 'menu.reports.laba', label: 'Lihat Laba Rugi' },
      { key: 'menu.forecast', label: 'Prediksi Stok' },
      { key: 'menu.price-history', label: 'Riwayat Harga' },
      { key: 'menu.stock-movements', label: 'Riwayat Stok' }
    ]
  },
  {
    title: 'Sistem',
    description: 'Pengaturan global aplikasi. Hati-hati saat memberikan akses.',
    permissions: [
      { key: 'menu.components', label: 'Showcase Komponen' },
      { key: 'menu.settings', label: 'Pengaturan Sistem' }
    ]
  }
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

const labelMap = new Map<string, string>(
  PERMISSION_CATALOG.flatMap((g) => g.permissions.map((p) => [p.key, p.label] as const))
);

export function permissionLabel(key: string): string {
  return labelMap.get(key) ?? key;
}

/**
 * Route pathname → permission key. Used to gate direct URL access.
 * Order matters: longer/more-specific paths must come first because we use
 * a "startsWith" match.
 */
export const ROUTE_PERMISSIONS: Array<{ path: string; permission: string }> = [
  { path: '/reports/laba', permission: 'menu.reports.laba' },
  { path: '/reports', permission: 'menu.reports' },
  { path: '/pos', permission: 'menu.pos' },
  { path: '/orders', permission: 'menu.orders' },
  { path: '/promotions', permission: 'menu.promotions' },
  { path: '/shifts', permission: 'menu.shifts' },
  { path: '/employees', permission: 'menu.employees' },
  { path: '/roles', permission: 'menu.roles' },
  { path: '/suppliers', permission: 'menu.suppliers' },
  { path: '/categories', permission: 'menu.categories' },
  { path: '/brands', permission: 'menu.brands' },
  { path: '/tags', permission: 'menu.tags' },
  { path: '/units', permission: 'menu.units' },
  { path: '/products', permission: 'menu.products' },
  { path: '/pricelists', permission: 'menu.pricelists' },
  { path: '/pengaturan-harga', permission: 'menu.pricing' },
  { path: '/taxes', permission: 'menu.taxes' },
  { path: '/locations', permission: 'menu.locations' },
  { path: '/purchase-orders', permission: 'menu.purchase-orders' },
  { path: '/payouts', permission: 'menu.payouts' },
  { path: '/utang', permission: 'menu.utang' },
  { path: '/piutang', permission: 'menu.piutang' },
  { path: '/inventory', permission: 'menu.inventory' },
  { path: '/production', permission: 'menu.production' },
  { path: '/stock-opname', permission: 'menu.stock-opname' },
  { path: '/stock-movements', permission: 'menu.stock-movements' },
  { path: '/customers', permission: 'menu.customers' },
  { path: '/forecast', permission: 'menu.forecast' },
  { path: '/riwayat-harga', permission: 'menu.price-history' },
  { path: '/components', permission: 'menu.components' },
  { path: '/settings', permission: 'menu.settings' }
];

export function permissionForPath(pathname: string): string | undefined {
  const match = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.path || pathname.startsWith(r.path + '/')
  );
  return match?.permission;
}
