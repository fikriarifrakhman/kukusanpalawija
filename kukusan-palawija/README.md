# KUKUSAN PALAWIJA — Sistem Operasional & Keuangan Cerdas

Aplikasi web modern, terintegrasi, dan mudah digunakan yang dirancang khusus untuk mengelola operasional harian, persediaan stok, produksi dapur, kasir lapak, GoFood, HPP, laba rugi, dan arus kas usaha **KUKUSAN PALAWIJA**.

---

## 🌟 Ringkasan Fitur & Pemetaan Proses Bisnis

Aplikasi ini menerjemahkan seluruh 28 poin kebutuhan usaha tanpa kompromi:

### 1. Master Bahan Baku & Pembelian (Moving Weighted Average)
- **Multi-Satuan**: Mendukung pembelian dan pencatatan dalam berbagai satuan (kg, biji, ikat, dll.).
- **Metode Moving Weighted Average (MWA)**:
  $$\text{Harga Rata-Rata Baru} = \frac{(\text{Stok Lama} \times \text{Harga Lama}) + (\text{Qty Beli} \times \text{Harga Beli})}{\text{Stok Lama} + \text{Qty Beli}}$$
- Pembelian menambah persediaan dan mengurangi kas, namun **belum menjadi HPP** sampai bahan tersebut digunakan untuk memasak.

### 2. Dapur Kukus & Produksi Multi-Hasil (Yield Aktual & Alokasi 100%)
- **Hasil Aktual Nyata**: Tidak mematok formula kaku (misal 2 kg telur menghasilkan 20 butir matang dicatat sesuai hasil nyata).
- **Alokasi Biaya Multi-Hasil**:
  - Satu proses kukus dapat menghasilkan beberapa menu sekaligus (misal Edamame dan Kacang Rebus).
  - Pengguna memasukkan persentase alokasi biaya (wajib pas 100%, misal 60% Edamame dan 40% Kacang).
  - Sistem otomatis membagi total biaya bahan baku + biaya tambahan, lalu menghitung HPP unit masing-masing produk jadi.
  - HPP produk jadi diperbarui menggunakan Moving Weighted Average ke stok siap jual.

### 3. Kasir Lapak (POS Cepat & Detail)
- Antarmuka visual kasir cepat dengan tombol kartu produk, pencarian menu, dan keranjang belanja.
- Otomatis menghitung:
  - Total omset penjualan
  - HPP produk yang terjual
  - Laba kotor transaksi: $\text{Laba Kotor} = \text{Penjualan} - \text{HPP}$
  - Kembalian tunai
- Mencetak atau menampilkan struk nota pembelian (`LPK-XXXX`).

### 4. Penjualan GoFood (Metode Ringkas)
- Sesuai prinsip kemudahan: pengguna **tidak perlu memasukkan produk satu per satu**.
- Cukup mencatat:
  - Tanggal
  - Total Penjualan Kotor (Gross)
  - Fee / Komisi Aplikasi GoFood
  - Uang Bersih Diterima (Net) = Penjualan Kotor - Fee
- Uang bersih otomatis masuk sebagai arus kas masuk nyata dan pendapatan usaha.

### 5. Kerugian Waste / Makanan Rusak & Basi
- Mencatat produk jadi yang rusak saat dimasak, basi, atau jatuh.
- Mengurangi stok produk jadi secara otomatis.
- Nilai kerugian dihitung dari $\text{Qty} \times \text{HPP Produk}$ dan dicatat sebagai beban kerugian waste pada laporan laba rugi.

### 6. Kemasan & Stock Opname Berkala
- Tidak membebani kasir dengan pencatatan mika/plastik di setiap transaksi penjualan.
- Menggunakan metode **Stock Opname Berkala**:
  $$\text{Estimasi Terpakai} = \text{Stok Awal} + \text{Pembelian Baru} - \text{Stok Fisik Aktual}$$
- Nilai rupiah kemasan terpakai otomatis dibebankan pada laporan keuangan.

### 7. Gas LPG & Pemisahan Beban Usaha vs Rumah Tangga
- Pengguna memilih lokasi tabung gas:
  1. **Dalam Rumah**: Otomatis 60% beban usaha, 40% keperluan dapur keluarga.
  2. **Teras**: 100% beban usaha.
  3. **Lapak**: 100% beban usaha.
- Kas keluar tercatat penuh 100% (uang nyata), namun beban usaha pada laporan laba rugi hanya dicatat sesuai persentase usaha.

### 8. Pengingat Tagihan Rutin (Gaji & Sewa Lapak)
- Banner pengingat otomatis di Dashboard:
  - **Sewa Lapak**: Rp150.000 / bulan (jatuh tempo tanggal 16).
  - **Gaji Karyawan**: Rp1.000.000 / bulan (jatuh tempo tanggal 19).
- Tombol satu klik *"Bayar & Catat Kas Sekarang"* langsung mencatat pengeluaran tanpa input manual berulang.

### 9. Laporan Keuangan Komprehensif & Filter Periode
- **Laporan Laba Rugi**:
  $$\text{Laba Kotor} = \text{Pendapatan (Lapak + GoFood Net)} - \text{HPP Penjualan}$$
  $$\text{Laba Bersih} = \text{Laba Kotor} - \text{Beban Operasional Usaha} - \text{Kerugian Waste}$$
- **Laporan Arus Kas (Cash Flow)**:
  - Memisahkan secara tegas antara uang masuk nyata dan uang keluar nyata dari kas.
- **Valuasi Modal dalam Persediaan**:
  - Mengetahui secara pasti berapa rupiah modal pemilik yang masih tersimpan di bahan mentah, produk jadi siap jual, dan kemasan.
- Fitur **Cetak Laporan (Print)** dan **Ekspor CSV**.

### 10. Penyimpanan Aman & Cadangan Data (Offline-First)
- Data tersimpan otomatis di browser lokal (LocalStorage).
- Fitur **Unduh Cadangan JSON** untuk mem-backup data ke komputer.
- Fitur **Pulihkan Data JSON** untuk memuat data cadangan kapan saja.
- Fitur **Reset ke Data Contoh** untuk mempelajari alur sistem.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibangun murni menggunakan standar web modern (**HTML5 + Vanilla CSS3 + Modular JavaScript**), sehingga:
1. **Sangat Cepat & Ringan** (tanpa ketergantungan node_modules yang berat).
2. **Dapat Dijalankan di Semua Perangkat** (Laptop, Tablet, maupun HP Android/iOS).
3. **Bekerja Sepenuhnya Offline** tanpa perlu koneksi internet konstan.

### Menjalankan Lewat Browser:
1. **Melalui Server Lokal yang Sedang Berjalan**:
   Buka peramban (Chrome / Edge / Firefox) dan kunjungi:
   ```
   http://localhost:8080/
   ```
2. **Atau Buka Langsung Berkas HTML**:
   Buka berkas berikut di browser:
   ```
   C:\Users\FIKRI\.gemini\antigravity-ide\scratch\kukusan-palawija\index.html
   ```

---

## 📂 Struktur Berkas

```
kukusan-palawija/
├── index.html          # Halaman utama aplikasi (Dashboard, POS, Laporan, Modals)
├── assets/
│   └── logo.jpg        # Logo resmi Kukusan Palawija
├── css/
│   └── style.css       # Sistem desain modern, palet warna artisan, responsif
├── js/
│   ├── data.js         # Data master awal & data transaksi simulasi
│   ├── store.js        # Mesin perhitungan akuntansi (MWA, HPP, alokasi, kas)
│   └── app.js          # Controller antarmuka, event POS, modal, dan laporan
└── README.md           # Panduan lengkap sistem
```
