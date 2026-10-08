/**
 * Data Master Awal Bersih (Stok 0 & Catatan Bersih)
 * KUKUSAN PALAWIJA
 * 
 * Master produk dan bahan baku siap digunakan untuk operasional dari awal.
 * Seluruh riwayat transaksi (pembelian, produksi, penjualan, pengeluaran, waste)
 * berstatus KOSONG (0) sehingga pengguna dapat mencatat dari awal dengan rapi.
 */

const DEFAULT_RAW_MATERIALS = [
  { id: 'raw-1', name: 'Telur Ayam', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 2.0, icon: '🥚' },
  { id: 'raw-2', name: 'Kacang Tanah Mentah', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 2.0, icon: '🥜' },
  { id: 'raw-3', name: 'Edamame Mentah', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 2.0, icon: '🫛' },
  { id: 'raw-4', name: 'Jagung Manis', unit: 'biji', currentStock: 0, avgPrice: 0, minStock: 10, icon: '🌽' },
  { id: 'raw-5', name: 'Jagung Ungu', unit: 'biji', currentStock: 0, avgPrice: 0, minStock: 10, icon: '🌽' },
  { id: 'raw-6', name: 'Pisang Kepok', unit: 'biji', currentStock: 0, avgPrice: 0, minStock: 10, icon: '🍌' },
  { id: 'raw-7', name: 'Singkong', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 3.0, icon: '🪵' },
  { id: 'raw-8', name: 'Labu Kuning', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 2.0, icon: '🎃' },
  { id: 'raw-9', name: 'Ubi Madu', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 3.0, icon: '🍠' },
  { id: 'raw-10', name: 'Ubi Ungu', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 3.0, icon: '🍠' },
  { id: 'raw-11', name: 'Ubi Oren', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 3.0, icon: '🍠' },
  { id: 'raw-12', name: 'Gembili', unit: 'kg', currentStock: 0, avgPrice: 0, minStock: 2.0, icon: '🥔' },
  { id: 'raw-13', name: 'Sukun', unit: 'biji', currentStock: 0, avgPrice: 0, minStock: 5, icon: '🍈' }
];

const DEFAULT_FINISHED_GOODS = [
  { id: 'prod-1', name: 'Telur Ayam Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 3000, minStock: 5, icon: '🥚' },
  { id: 'prod-2', name: 'Kacang Rebus', unit: 'porsi', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🥜' },
  { id: 'prod-3', name: 'Edamame Kukus', unit: 'porsi', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🫛' },
  { id: 'prod-4', name: 'Jagung Manis Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🌽' },
  { id: 'prod-5', name: 'Jagung Ungu Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🌽' },
  { id: 'prod-6', name: 'Pisang Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🍌' },
  { id: 'prod-7', name: 'Singkong Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🪵' },
  { id: 'prod-8', name: 'Labu Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🎃' },
  { id: 'prod-9', name: 'Ubi Madu Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🍠' },
  { id: 'prod-10', name: 'Ubi Ungu Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🍠' },
  { id: 'prod-11', name: 'Ubi Oren Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🍠' },
  { id: 'prod-12', name: 'Gembili Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🥔' },
  { id: 'prod-13', name: 'Sukun Kukus', unit: 'biji', currentStock: 0, avgHpp: 0, sellingPrice: 2000, minStock: 5, icon: '🍈' }
];

const DEFAULT_PACKAGING = [
  { id: 'pack-1', name: 'Kotak Mika Sedang', unit: 'pcs', currentStock: 0, avgCost: 0, minStock: 20, icon: '🥡' },
  { id: 'pack-2', name: 'Sticker Logo Kukusan', unit: 'lembar', currentStock: 0, avgCost: 0, minStock: 50, icon: '🏷️' },
  { id: 'pack-3', name: 'Kertas Nasi / Pembungkus', unit: 'lembar', currentStock: 0, avgCost: 0, minStock: 30, icon: '📜' },
  { id: 'pack-4', name: 'Kantong Plastik / Kresek', unit: 'pack', currentStock: 0, avgCost: 0, minStock: 2, icon: '🛍️' },
  { id: 'pack-5', name: 'Staples & Isi', unit: 'kotak', currentStock: 0, avgCost: 0, minStock: 1, icon: '📎' }
];

const GAS_LOCATIONS = [
  { id: 'loc-1', name: 'Dalam Rumah', defaultBusinessPercent: 60, desc: '60% beban usaha, 40% keperluan dapur rumah' },
  { id: 'loc-2', name: 'Teras', defaultBusinessPercent: 100, desc: '100% beban usaha (area persiapan/kukus)' },
  { id: 'loc-3', name: 'Lapak', defaultBusinessPercent: 100, desc: '100% beban usaha (kompor hangat di lapak)' }
];

const EXPENSE_CATEGORIES = [
  'Gaji',
  'Gas',
  'Kemasan',
  'Sewa Lapak',
  'Listrik',
  'Peralatan',
  'Transportasi',
  'Lainnya'
];

/**
 * Data Bersih Awal: Seluruh stok dan transaksi berstatus 0.
 */
function getCleanInitialData() {
  return {
    rawMaterials: JSON.parse(JSON.stringify(DEFAULT_RAW_MATERIALS)),
    finishedGoods: JSON.parse(JSON.stringify(DEFAULT_FINISHED_GOODS)),
    packaging: JSON.parse(JSON.stringify(DEFAULT_PACKAGING)),
    
    // Transaksi kosong (0)
    purchases: [],
    productions: [],
    salesLapak: [],
    salesGoFood: [],
    expenses: [],
    waste: [],
    packagingAudits: [],

    settings: {
      businessName: 'Kukusan Palawija',
      tagline: 'Camilan Sehat Tradisional Kukus',
      currency: 'Rp',
      salaryDueDay: 19,
      salaryAmount: 1000000,
      rentDueDay: 16,
      rentAmount: 150000,
      openingCash: 0
    }
  };
}

// Default data pemula adalah data bersih 0
function getSampleData() {
  return getCleanInitialData();
}
