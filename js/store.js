/**
 * Store & Business Logic Engine untuk KUKUSAN PALAWIJA
 * Mengelola state, persistensi LocalStorage, dan rumus akuntansi bisnis:
 * 1. Moving Weighted Average (MWA) Bahan Baku & Produk Jadi
 * 2. Alokasi Biaya Produksi Multi-Hasil (100% split)
 * 3. HPP & Laba Kotor Penjualan Lapak
 * 4. Penerimaan GoFood Ringkas (Gross, Fee, Net)
 * 5. Kerugian Waste/Basi
 * 6. Stock Opname Kemasan Berkala
 * 7. Pembagian Beban Gas Rumah vs Usaha
 * 8. Arus Kas vs Laba Bersih
 */

const STORAGE_KEY = 'kukusan_palawija_db_clean_v1';

class PalawijaStore {
  constructor() {
    this.data = this.loadData();
    this.listeners = [];
  }

  loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Gagal membaca localStorage, memuat data bersih awal:', e);
    }
    const clean = getCleanInitialData();
    this.saveData(clean);
    return clean;
  }

  saveData(data = this.data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.notifyListeners();
    } catch (e) {
      console.error('Gagal menyimpan ke localStorage:', e);
    }
  }

  clearAllToZero() {
    this.data = getCleanInitialData();
    this.saveData();
    return this.data;
  }

  resetToSampleData() {
    this.data = getCleanInitialData();
    this.saveData();
    return this.data;
  }

  exportDataJson() {
    return JSON.stringify(this.data, null, 2);
  }

  importDataJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.rawMaterials || !parsed.finishedGoods) {
        throw new Error('Format data cadangan tidak sesuai.');
      }
      this.data = parsed;
      this.saveData();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(fn => fn(this.data));
  }

  generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  // ==========================================
  // 1. MANAJEMEN BAHAN BAKU & PEMBELIAN (MWA)
  // ==========================================

  getRawMaterials() {
    return this.data.rawMaterials || [];
  }

  getRawMaterialById(id) {
    return this.data.rawMaterials.find(item => item.id === id);
  }

  addRawMaterial(material) {
    const newMat = {
      id: this.generateId('raw'),
      name: material.name.trim(),
      unit: material.unit.trim() || 'kg',
      currentStock: Number(material.currentStock) || 0,
      avgPrice: Number(material.avgPrice) || 0,
      minStock: Number(material.minStock) || 0,
      icon: material.icon || '🌾'
    };
    this.data.rawMaterials.push(newMat);
    this.saveData();
    return newMat;
  }

  updateRawMaterial(id, updates) {
    const index = this.data.rawMaterials.findIndex(m => m.id === id);
    if (index !== -1) {
      this.data.rawMaterials[index] = { ...this.data.rawMaterials[index], ...updates };
      this.saveData();
      return this.data.rawMaterials[index];
    }
    return null;
  }

  deleteRawMaterial(id) {
    this.data.rawMaterials = this.data.rawMaterials.filter(m => m.id !== id);
    this.saveData();
  }

  /**
   * Catat Pembelian Bahan Baku atau Kemasan
   * Menggunakan Metode Moving Weighted Average (MWA)
   */
  recordPurchase({ date, type, itemId, qty, unitPrice, supplier, paymentMethod, notes }) {
    qty = Number(qty);
    unitPrice = Number(unitPrice);
    const totalPrice = qty * unitPrice;
    let itemName = '';
    let unit = '';

    if (type === 'raw') {
      const raw = this.getRawMaterialById(itemId);
      if (!raw) throw new Error('Bahan baku tidak ditemukan.');
      itemName = raw.name;
      unit = raw.unit;

      // Moving Weighted Average calculation:
      // (Stok lama * harga lama + stok baru * harga beli baru) / (total stok baru)
      const oldStock = Number(raw.currentStock) || 0;
      const oldAvgPrice = Number(raw.avgPrice) || 0;
      const newStock = oldStock + qty;

      let newAvgPrice = oldAvgPrice;
      if (newStock > 0) {
        const oldTotalValue = oldStock * oldAvgPrice;
        const newPurchaseValue = qty * unitPrice;
        newAvgPrice = Math.round((oldTotalValue + newPurchaseValue) / newStock);
      } else {
        newAvgPrice = unitPrice;
      }

      raw.currentStock = parseFloat(newStock.toFixed(3));
      raw.avgPrice = newAvgPrice;
    } else if (type === 'packaging') {
      const pack = this.getPackagingById(itemId);
      if (!pack) throw new Error('Kemasan tidak ditemukan.');
      itemName = pack.name;
      unit = pack.unit;

      const oldStock = Number(pack.currentStock) || 0;
      const oldAvgCost = Number(pack.avgCost) || 0;
      const newStock = oldStock + qty;

      let newAvgCost = oldAvgCost;
      if (newStock > 0) {
        newAvgCost = Math.round(((oldStock * oldAvgCost) + (qty * unitPrice)) / newStock);
      } else {
        newAvgCost = unitPrice;
      }

      pack.currentStock = parseFloat(newStock.toFixed(2));
      pack.avgCost = newAvgCost;
    }

    const purchaseRecord = {
      id: this.generateId('pch'),
      date: date || new Date().toISOString().split('T')[0],
      type, // 'raw' | 'packaging'
      itemId,
      itemName,
      qty,
      unit,
      unitPrice,
      totalPrice,
      supplier: supplier || '-',
      paymentMethod: paymentMethod || 'Tunai',
      notes: notes || ''
    };

    this.data.purchases.unshift(purchaseRecord);
    this.saveData();
    return purchaseRecord;
  }

  getPurchases() {
    return this.data.purchases || [];
  }

  deletePurchase(id) {
    this.data.purchases = this.data.purchases.filter(p => p.id !== id);
    this.saveData();
  }

  // ==========================================
  // 2. MANAJEMEN PRODUK JADI & PENJUALAN
  // ==========================================

  getFinishedGoods() {
    return this.data.finishedGoods || [];
  }

  getFinishedGoodById(id) {
    return this.data.finishedGoods.find(item => item.id === id);
  }

  addFinishedGood(product) {
    const newProd = {
      id: this.generateId('prod'),
      name: product.name.trim(),
      unit: product.unit.trim() || 'biji',
      currentStock: Number(product.currentStock) || 0,
      avgHpp: Number(product.avgHpp) || 0,
      sellingPrice: Number(product.sellingPrice) || 0,
      minStock: Number(product.minStock) || 0,
      icon: product.icon || '🍠'
    };
    this.data.finishedGoods.push(newProd);
    this.saveData();
    return newProd;
  }

  updateFinishedGood(id, updates) {
    const index = this.data.finishedGoods.findIndex(p => p.id === id);
    if (index !== -1) {
      this.data.finishedGoods[index] = { ...this.data.finishedGoods[index], ...updates };
      this.saveData();
      return this.data.finishedGoods[index];
    }
    return null;
  }

  deleteFinishedGood(id) {
    this.data.finishedGoods = this.data.finishedGoods.filter(p => p.id !== id);
    this.saveData();
  }

  // ==========================================
  // 3. PROSES PRODUKSI (DAPUR KUKUS)
  // ==========================================

  /**
   * Catat Produksi Dapur Kukus
   * Mendukung mode satu tabel praktis (items: [{ rawMaterialId, rawQty, finishedGoodId, outputQty }])
   * atau mode klasik (ingredients + outputs).
   * Alokasi biaya otomatis dihitung proporsional tanpa mengharuskan input persen manual.
   */
  recordProduction({ date, items, ingredients, additionalCost = 0, outputs, notes }) {
    additionalCost = Number(additionalCost) || 0;

    const resolvedIngredients = [];
    const resolvedOutputs = [];
    let totalProductionCost = 0;

    // 1. JIKA MENGGUNAKAN MODE TERPADU (ITEMS)
    if (items && Array.isArray(items) && items.length > 0) {
      let totalRawCost = 0;
      const intermediateRows = [];

      for (const row of items) {
        const raw = this.getRawMaterialById(row.rawMaterialId);
        if (!raw) throw new Error(`Bahan baku ID "${row.rawMaterialId}" tidak ditemukan.`);
        
        const rawQty = Number(row.rawQty);
        if (rawQty <= 0) throw new Error(`Jumlah bahan mentah "${raw.name}" harus lebih dari 0.`);

        const fg = this.getFinishedGoodById(row.finishedGoodId);
        if (!fg) throw new Error(`Produk jadi ID "${row.finishedGoodId}" tidak ditemukan.`);

        const outputQty = Number(row.outputQty);
        if (outputQty <= 0) throw new Error(`Hasil matang produk "${fg.name}" harus lebih dari 0.`);

        const unitCost = Number(raw.avgPrice) || 0;
        const lineRawCost = Math.round(rawQty * unitCost);
        totalRawCost += lineRawCost;

        // Kurangi stok bahan mentah
        raw.currentStock = Math.max(0, parseFloat((raw.currentStock - rawQty).toFixed(3)));

        intermediateRows.push({
          raw,
          fg,
          rawQty,
          outputQty,
          unitCost,
          lineRawCost
        });

        resolvedIngredients.push({
          rawMaterialId: raw.id,
          rawMaterialName: raw.name,
          qty: rawQty,
          unit: raw.unit,
          unitCost,
          totalCost: lineRawCost
        });
      }

      totalProductionCost = totalRawCost + additionalCost;

      // Alokasikan biaya dan perbarui stok produk jadi
      for (const row of intermediateRows) {
        // Porsi biaya tambahan dibagi proporsional berdasarkan biaya bahan masing-masing
        const extraShare = totalRawCost > 0 
          ? Math.round((row.lineRawCost / totalRawCost) * additionalCost)
          : Math.round(additionalCost / intermediateRows.length);

        const allocatedCost = row.lineRawCost + extraShare;
        const unitHpp = Math.round(allocatedCost / row.outputQty);
        const costPercent = totalProductionCost > 0 
          ? Math.round((allocatedCost / totalProductionCost) * 100)
          : Math.round(100 / intermediateRows.length);

        // Update stok produk jadi & Moving Weighted Average HPP
        const oldStock = Number(row.fg.currentStock) || 0;
        const oldHpp = Number(row.fg.avgHpp) || 0;
        const newStock = oldStock + row.outputQty;

        let newAvgHpp = unitHpp;
        if (newStock > 0) {
          newAvgHpp = Math.round(((oldStock * oldHpp) + allocatedCost) / newStock);
        }

        row.fg.currentStock = newStock;
        row.fg.avgHpp = newAvgHpp;

        resolvedOutputs.push({
          finishedGoodId: row.fg.id,
          productName: row.fg.name,
          qty: row.outputQty,
          unit: row.fg.unit,
          costPercent,
          allocatedCost,
          unitHpp
        });
      }
    } else {
      // 2. MODE FALLBACK (KLASIK INGREDIENTS & OUTPUTS)
      if (!ingredients || ingredients.length === 0) {
        throw new Error('Bahan baku yang dimasak belum dipilih.');
      }
      if (!outputs || outputs.length === 0) {
        throw new Error('Hasil produk jadi belum ditentukan.');
      }

      // Hitung biaya bahan baku dan kurangi stok bahan baku
      let rawMaterialTotalCost = 0;
      for (const ing of ingredients) {
        const raw = this.getRawMaterialById(ing.rawMaterialId);
        if (!raw) throw new Error(`Bahan baku ID "${ing.rawMaterialId}" tidak ditemukan.`);
        
        const qtyUsed = Number(ing.qty);
        if (qtyUsed <= 0) throw new Error(`Jumlah bahan "${raw.name}" harus lebih dari 0.`);
        
        const costPerUnit = Number(raw.avgPrice) || 0;
        const totalCost = Math.round(qtyUsed * costPerUnit);
        rawMaterialTotalCost += totalCost;

        raw.currentStock = Math.max(0, parseFloat((raw.currentStock - qtyUsed).toFixed(3)));

        resolvedIngredients.push({
          rawMaterialId: raw.id,
          rawMaterialName: raw.name,
          qty: qtyUsed,
          unit: raw.unit,
          unitCost: costPerUnit,
          totalCost
        });
      }

      totalProductionCost = rawMaterialTotalCost + additionalCost;

      // Otomatis hitung costPercent jika tidak ada atau tidak 100%
      const givenTotalPercent = outputs.reduce((sum, o) => sum + (Number(o.costPercent) || 0), 0);
      const needAutoPercent = Math.round(givenTotalPercent) !== 100;

      for (let i = 0; i < outputs.length; i++) {
        const out = outputs[i];
        const fg = this.getFinishedGoodById(out.finishedGoodId);
        if (!fg) throw new Error(`Produk jadi ID "${out.finishedGoodId}" tidak ditemukan.`);
        
        const outputQty = Number(out.qty);
        if (outputQty <= 0) throw new Error(`Hasil produksi produk "${fg.name}" harus lebih dari 0.`);

        const costPercent = needAutoPercent 
          ? (i === outputs.length - 1 ? (100 - Math.round(100 / outputs.length) * (outputs.length - 1)) : Math.round(100 / outputs.length))
          : Number(out.costPercent);

        const allocatedCost = Math.round(totalProductionCost * (costPercent / 100));
        const unitHpp = Math.round(allocatedCost / outputQty);

        const oldStock = Number(fg.currentStock) || 0;
        const oldHpp = Number(fg.avgHpp) || 0;
        const newStock = oldStock + outputQty;

        let newAvgHpp = unitHpp;
        if (newStock > 0) {
          newAvgHpp = Math.round(((oldStock * oldHpp) + allocatedCost) / newStock);
        }

        fg.currentStock = newStock;
        fg.avgHpp = newAvgHpp;

        resolvedOutputs.push({
          finishedGoodId: fg.id,
          productName: fg.name,
          qty: outputQty,
          unit: fg.unit,
          costPercent,
          allocatedCost,
          unitHpp
        });
      }
    }

    // 5. Simpan riwayat produksi
    const batchCount = (this.data.productions || []).length + 1;
    const batchNo = `BATCH-${String(batchCount).padStart(3, '0')}`;

    const productionRecord = {
      id: this.generateId('prd'),
      batchNo,
      date: date || new Date().toISOString().split('T')[0],
      ingredients: resolvedIngredients,
      additionalCost,
      totalProductionCost,
      outputs: resolvedOutputs,
      notes: notes || ''
    };

    if (!this.data.productions) this.data.productions = [];
    this.data.productions.unshift(productionRecord);
    this.saveData();
    return productionRecord;
  }

  getProductions() {
    return this.data.productions || [];
  }

  deleteProduction(id) {
    this.data.productions = this.data.productions.filter(p => p.id !== id);
    this.saveData();
  }

  // ==========================================
  // 4. PENJUALAN LAPAK (REKAP HARIAN & SISA STOK)
  // ==========================================

  /**
   * Catat Rekap Penjualan Harian Lapak
   * Pengguna cukup memasukkan total pendapatan uang hari ini dan stok sisa fisik di lapak.
   * Terjual = Stok Sebelum Tutup - Sisa Fisik.
   * Total HPP = sum(Terjual * HPP).
   * Laba Kotor = Total Pendapatan - Total HPP.
   */
  recordDailyClosingLapak({ date, totalRevenue, paymentMethod, items, notes }) {
    totalRevenue = Number(totalRevenue) || 0;
    if (totalRevenue < 0) throw new Error('Total pendapatan tidak boleh kurang dari 0.');

    let totalHpp = 0;
    const processedItems = [];

    for (const item of items) {
      const fg = this.getFinishedGoodById(item.finishedGoodId);
      if (!fg) continue;

      const stockBefore = Number(fg.currentStock) || 0;
      const remainingStock = Math.max(0, Number(item.remainingStock) || 0);
      const soldQty = Math.max(0, stockBefore - remainingStock);
      const hppPerUnit = Number(fg.avgHpp) || 0;
      const itemTotalHpp = soldQty * hppPerUnit;

      // Update stok produk jadi menjadi sisa fisik di lapak
      fg.currentStock = remainingStock;
      totalHpp += itemTotalHpp;

      processedItems.push({
        finishedGoodId: fg.id,
        productName: fg.name,
        unit: fg.unit,
        unitPrice: fg.sellingPrice,
        stockBefore,
        remainingStock,
        soldQty,
        qty: soldQty,
        hppPerUnit,
        totalHpp: itemTotalHpp
      });
    }

    const grossProfit = totalRevenue - totalHpp;
    const count = (this.data.salesLapak || []).length + 1;
    const dStr = (date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const invoiceNo = `REKAP-${dStr}-${String(count).padStart(3, '0')}`;

    const saleRecord = {
      id: this.generateId('slp'),
      invoiceNo,
      date: date || new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      items: processedItems,
      totalRevenue,
      totalHpp,
      grossProfit,
      paymentMethod: paymentMethod || 'Tunai',
      cashReceived: totalRevenue,
      changeAmount: 0,
      notes: notes || 'Rekap Penjualan Harian Lapak'
    };

    if (!this.data.salesLapak) this.data.salesLapak = [];
    this.data.salesLapak.unshift(saleRecord);
    this.saveData();
    return saleRecord;
  }

  recordSaleLapak({ date, time, items, paymentMethod, cashReceived, notes }) {
    if (!items || items.length === 0) {
      throw new Error('Keranjang penjualan lapak masih kosong.');
    }

    let totalRevenue = 0;
    let totalHpp = 0;
    const processedItems = [];

    for (const item of items) {
      const fg = this.getFinishedGoodById(item.finishedGoodId);
      if (!fg) throw new Error(`Produk ID "${item.finishedGoodId}" tidak ditemukan.`);

      const qty = Number(item.qty);
      if (qty <= 0) continue;

      const unitPrice = Number(item.unitPrice || fg.sellingPrice);
      const subtotal = qty * unitPrice;
      const hppPerUnit = Number(fg.avgHpp) || 0;
      const itemTotalHpp = qty * hppPerUnit;

      // Kurangi stok produk jadi
      fg.currentStock = Math.max(0, fg.currentStock - qty);

      totalRevenue += subtotal;
      totalHpp += itemTotalHpp;

      processedItems.push({
        finishedGoodId: fg.id,
        productName: fg.name,
        qty,
        unit: fg.unit,
        unitPrice,
        subtotal,
        hppPerUnit,
        totalHpp: itemTotalHpp
      });
    }

    const grossProfit = totalRevenue - totalHpp;
    const count = (this.data.salesLapak || []).length + 1;
    const invoiceNo = `LPK-${String(count).padStart(4, '0')}`;
    const received = Number(cashReceived) || totalRevenue;
    const changeAmount = Math.max(0, received - totalRevenue);

    const saleRecord = {
      id: this.generateId('slp'),
      invoiceNo,
      date: date || new Date().toISOString().split('T')[0],
      time: time || new Date().toTimeString().split(' ')[0].substring(0, 5),
      items: processedItems,
      totalRevenue,
      totalHpp,
      grossProfit,
      paymentMethod: paymentMethod || 'Tunai',
      cashReceived: received,
      changeAmount,
      notes: notes || ''
    };

    if (!this.data.salesLapak) this.data.salesLapak = [];
    this.data.salesLapak.unshift(saleRecord);
    this.saveData();
    return saleRecord;
  }

  getSalesLapak() {
    return this.data.salesLapak || [];
  }

  deleteSaleLapak(id) {
    const sale = (this.data.salesLapak || []).find(s => s.id === id);
    if (sale && sale.items) {
      sale.items.forEach(it => {
        const fg = this.getFinishedGoodById(it.finishedGoodId);
        if (fg) {
          if (it.stockBefore !== undefined) {
            fg.currentStock = it.stockBefore;
          } else if (it.qty) {
            fg.currentStock += it.qty;
          }
        }
      });
    }
    this.data.salesLapak = this.data.salesLapak.filter(s => s.id !== id);
    this.saveData();
  }

  // ==========================================
  // 5. PENJUALAN GOFOOD (Metode Ringkas & Simpel)
  // ==========================================

  recordSaleGoFood({ date, netReceived, totalSales, grossSales, appFee, paymentMethod, orderCount, notes }) {
    // Pengguna langsung memasukkan uang bersih yang murni diterima di GoPay/GoBiz
    const net = Number(netReceived !== undefined ? netReceived : (totalSales !== undefined ? totalSales : (Number(grossSales || 0) - Number(appFee || 0)))) || 0;

    if (net <= 0) {
      throw new Error('Total uang penjualan GoFood harus lebih dari 0.');
    }

    const count = (this.data.salesGoFood || []).length + 1;
    const orderNo = `GF-${String(count).padStart(4, '0')}`;

    const goFoodRecord = {
      id: this.generateId('gof'),
      orderNo,
      date: date || new Date().toISOString().split('T')[0],
      grossSales: net,
      appFee: 0,
      netReceived: net,
      paymentMethod: paymentMethod || 'Saldo GoPay Partner',
      orderCount: Number(orderCount) || 1,
      notes: notes || ''
    };

    if (!this.data.salesGoFood) this.data.salesGoFood = [];
    this.data.salesGoFood.unshift(goFoodRecord);
    this.saveData();
    return goFoodRecord;
  }

  getSalesGoFood() {
    return this.data.salesGoFood || [];
  }

  deleteSaleGoFood(id) {
    this.data.salesGoFood = this.data.salesGoFood.filter(g => g.id !== id);
    this.saveData();
  }

  // ==========================================
  // 6. KERUGIAN / WASTE (Produk Rusak / Basi)
  // ==========================================

  recordWaste({ date, finishedGoodId, qty, reason, notes }) {
    const fg = this.getFinishedGoodById(finishedGoodId);
    if (!fg) throw new Error('Produk jadi tidak ditemukan.');

    qty = Number(qty);
    if (qty <= 0) throw new Error('Jumlah produk waste harus lebih dari 0.');

    const unitHpp = Number(fg.avgHpp) || 0;
    const totalLoss = Math.round(qty * unitHpp);

    // Kurangi stok produk jadi
    fg.currentStock = Math.max(0, fg.currentStock - qty);

    const wasteRecord = {
      id: this.generateId('wst'),
      date: date || new Date().toISOString().split('T')[0],
      finishedGoodId: fg.id,
      productName: fg.name,
      qty,
      unit: fg.unit,
      unitHpp,
      totalLoss,
      reason: reason || 'Rusak / Tidak Layak Jual',
      notes: notes || ''
    };

    if (!this.data.waste) this.data.waste = [];
    this.data.waste.unshift(wasteRecord);
    this.saveData();
    return wasteRecord;
  }

  getWaste() {
    return this.data.waste || [];
  }

  deleteWaste(id) {
    this.data.waste = this.data.waste.filter(w => w.id !== id);
    this.saveData();
  }

  // ==========================================
  // 7. KEMASAN & STOCK OPNAME BERKALA
  // ==========================================

  getPackaging() {
    return this.data.packaging || [];
  }

  getPackagingById(id) {
    return this.data.packaging.find(p => p.id === id);
  }

  addPackaging(item) {
    const newPack = {
      id: this.generateId('pack'),
      name: item.name.trim(),
      unit: item.unit.trim() || 'pcs',
      currentStock: Number(item.currentStock) || 0,
      avgCost: Number(item.avgCost) || 0,
      minStock: Number(item.minStock) || 0,
      icon: item.icon || '📦'
    };
    this.data.packaging.push(newPack);
    this.saveData();
    return newPack;
  }

  updatePackaging(id, updates) {
    const idx = this.data.packaging.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.data.packaging[idx] = { ...this.data.packaging[idx], ...updates };
      this.saveData();
      return this.data.packaging[idx];
    }
    return null;
  }

  deletePackaging(id) {
    this.data.packaging = this.data.packaging.filter(p => p.id !== id);
    this.saveData();
  }

  /**
   * Catat Stock Opname Kemasan Berkala
   * Rumus: Pemakaian = Stok Terakhir + Pembelian Baru - Stok Fisik Aktual
   */
  recordPackagingAudit({ date, periodName, audits, notes }) {
    let totalUsageCost = 0;
    const processedItems = [];

    for (const audit of audits) {
      const pack = this.getPackagingById(audit.packagingId);
      if (!pack) continue;

      const physicalStock = Number(audit.actualStock);
      const currentStockBefore = Number(pack.currentStock);
      // Pemakaian diperkirakan dari selisih jika stok berkurang
      const estimatedUsed = Math.max(0, currentStockBefore - physicalStock);
      const unitCost = Number(pack.avgCost) || 0;
      const usageCost = Math.round(estimatedUsed * unitCost);

      totalUsageCost += usageCost;

      // Sesuaikan stok di master kemasan ke stok fisik hasil opname
      pack.currentStock = physicalStock;

      processedItems.push({
        packagingId: pack.id,
        packagingName: pack.name,
        unit: pack.unit,
        initialStock: currentStockBefore,
        actualStock: physicalStock,
        estimatedUsed,
        unitCost,
        totalUsageCost: usageCost
      });
    }

    const auditRecord = {
      id: this.generateId('so'),
      date: date || new Date().toISOString().split('T')[0],
      periodName: periodName || 'Stock Opname Berkala',
      items: processedItems,
      totalUsageCost,
      notes: notes || ''
    };

    if (!this.data.packagingAudits) this.data.packagingAudits = [];
    this.data.packagingAudits.unshift(auditRecord);
    this.saveData();
    return auditRecord;
  }

  getPackagingAudits() {
    return this.data.packagingAudits || [];
  }

  // ==========================================
  // 8. PENGELUARAN USAHA & GAS PERSENTASE
  // ==========================================

  recordExpense({ date, category, totalAmount, paymentMethod, location, businessPercent, notes }) {
    totalAmount = Number(totalAmount) || 0;
    if (totalAmount <= 0) throw new Error('Nominal pengeluaran harus lebih dari 0.');

    let bizPct = 100;
    let loc = location || '-';

    if (category === 'Gas') {
      if (location === 'Dalam Rumah') {
        bizPct = businessPercent !== undefined ? Number(businessPercent) : 60;
      } else {
        bizPct = 100; // Teras / Lapak default 100%
      }
    } else if (businessPercent !== undefined) {
      bizPct = Number(businessPercent);
    }

    const businessAmount = Math.round(totalAmount * (bizPct / 100));
    const personalAmount = totalAmount - businessAmount;

    const expenseRecord = {
      id: this.generateId('exp'),
      date: date || new Date().toISOString().split('T')[0],
      category,
      totalAmount, // Kas keluar riil 100%
      paymentMethod: paymentMethod || 'Tunai',
      location: loc,
      businessPercent: bizPct,
      businessAmount, // Beban operasional usaha
      personalAmount, // Prive / bukan beban usaha
      notes: notes || ''
    };

    if (!this.data.expenses) this.data.expenses = [];
    this.data.expenses.unshift(expenseRecord);
    this.saveData();
    return expenseRecord;
  }

  getExpenses() {
    return this.data.expenses || [];
  }

  deleteExpense(id) {
    this.data.expenses = this.data.expenses.filter(e => e.id !== id);
    this.saveData();
  }

  // ==========================================
  // 9. KALKULASI ARUS KAS, LABA RUGI & LAPORAN
  // ==========================================

  /**
   * Filter transaksi berdasarkan rentang tanggal
   */
  filterByDateRange(list, startDate, endDate) {
    if (!startDate && !endDate) return list;
    return list.filter(item => {
      const itemDate = item.date;
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      return true;
    });
  }

  /**
   * Hitung Ringkasan Finansial untuk Periode Tertentu
   */
  getFinancialSummary(startDate, endDate) {
    const salesLapak = this.filterByDateRange(this.data.salesLapak || [], startDate, endDate);
    const salesGoFood = this.filterByDateRange(this.data.salesGoFood || [], startDate, endDate);
    const purchases = this.filterByDateRange(this.data.purchases || [], startDate, endDate);
    const expenses = this.filterByDateRange(this.data.expenses || [], startDate, endDate);
    const wasteList = this.filterByDateRange(this.data.waste || [], startDate, endDate);
    const packagingAudits = this.filterByDateRange(this.data.packagingAudits || [], startDate, endDate);

    // 1. PENDAPATAN
    const lapakRevenue = salesLapak.reduce((sum, s) => sum + s.totalRevenue, 0);
    const lapakHpp = salesLapak.reduce((sum, s) => sum + s.totalHpp, 0);
    const lapakGrossProfit = lapakRevenue - lapakHpp;

    const goFoodGross = salesGoFood.reduce((sum, g) => sum + g.grossSales, 0);
    const goFoodFee = salesGoFood.reduce((sum, g) => sum + g.appFee, 0);
    const goFoodNet = salesGoFood.reduce((sum, g) => sum + g.netReceived, 0);

    const totalRevenue = lapakRevenue + goFoodNet;
    const totalGrossProfit = lapakGrossProfit + goFoodNet; // GoFood HPP dianggap 0 per requirements #13

    // 2. BEBAN OPERASIONAL (Hanya bagian porsi usaha!)
    const expenseByCategory = {};
    EXPENSE_CATEGORIES.forEach(cat => { expenseByCategory[cat] = 0; });

    let totalBusinessExpense = 0;
    expenses.forEach(e => {
      const cat = e.category || 'Lainnya';
      if (!expenseByCategory[cat]) expenseByCategory[cat] = 0;
      expenseByCategory[cat] += e.businessAmount;
      totalBusinessExpense += e.businessAmount;
    });

    // Tambahkan estimasi biaya pemakaian kemasan dari audit opname
    const packagingUsageCost = packagingAudits.reduce((sum, a) => sum + a.totalUsageCost, 0);
    expenseByCategory['Kemasan (Opname)'] = packagingUsageCost;
    totalBusinessExpense += packagingUsageCost;

    // 3. KERUGIAN WASTE
    const totalWasteLoss = wasteList.reduce((sum, w) => sum + w.totalLoss, 0);

    // 4. LABA BERSIH
    const netProfit = totalGrossProfit - totalBusinessExpense - totalWasteLoss;

    // 5. ARUS KAS (CASH FLOW - UANG NYATA KELUAR MASUK)
    const cashInLapak = lapakRevenue;
    const cashInGoFood = goFoodNet;
    const totalCashIn = cashInLapak + cashInGoFood;

    // Kas keluar riil: Pembelian bahan + Pembelian kemasan + 100% Pengeluaran riil
    const cashOutPurchasesRaw = purchases.filter(p => p.type === 'raw').reduce((sum, p) => sum + p.totalPrice, 0);
    const cashOutPurchasesPack = purchases.filter(p => p.type === 'packaging').reduce((sum, p) => sum + p.totalPrice, 0);
    const cashOutExpensesTotal = expenses.reduce((sum, e) => sum + e.totalAmount, 0); // 100% kas keluar

    const totalCashOut = cashOutPurchasesRaw + cashOutPurchasesPack + cashOutExpensesTotal;
    const netCashFlow = totalCashIn - totalCashOut;

    // 6. NILAI PERSEDIAAN (MODAL TERSIMPAN DI STOK SAAT INI)
    const rawInventoryValue = this.data.rawMaterials.reduce((sum, r) => sum + (r.currentStock * r.avgPrice), 0);
    const finishedGoodsInventoryValue = this.data.finishedGoods.reduce((sum, f) => sum + (f.currentStock * f.avgHpp), 0);
    const packagingInventoryValue = this.data.packaging.reduce((sum, p) => sum + (p.currentStock * p.avgCost), 0);
    const totalInventoryValue = rawInventoryValue + finishedGoodsInventoryValue + packagingInventoryValue;

    return {
      period: { startDate, endDate },
      incomeStatement: {
        lapakRevenue,
        lapakHpp,
        lapakGrossProfit,
        goFoodGross,
        goFoodFee,
        goFoodNet,
        totalRevenue,
        totalHpp: lapakHpp,
        totalGrossProfit,
        expenseByCategory,
        totalBusinessExpense,
        totalWasteLoss,
        netProfit
      },
      cashFlow: {
        cashInLapak,
        cashInGoFood,
        totalCashIn,
        cashOutPurchasesRaw,
        cashOutPurchasesPack,
        cashOutExpensesTotal,
        totalCashOut,
        netCashFlow
      },
      inventory: {
        rawInventoryValue: Math.round(rawInventoryValue),
        finishedGoodsInventoryValue: Math.round(finishedGoodsInventoryValue),
        packagingInventoryValue: Math.round(packagingInventoryValue),
        totalInventoryValue: Math.round(totalInventoryValue)
      },
      counts: {
        salesLapakCount: salesLapak.length,
        salesGoFoodCount: salesGoFood.length,
        purchasesCount: purchases.length,
        expensesCount: expenses.length,
        wasteCount: wasteList.length
      }
    };
  }

  /**
   * Cek Peringatan Pengeluaran Rutin (Gaji tgl 19, Sewa tgl 16)
   */
  getRecurringAlerts() {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.toISOString().substring(0, 7); // YYYY-MM

    const alerts = [];

    // Cek Sewa Lapak (tgl 16, Rp150.000)
    const rentPaidThisMonth = (this.data.expenses || []).some(e => 
      e.category === 'Sewa Lapak' && e.date.startsWith(currentMonth)
    );
    if (!rentPaidThisMonth) {
      alerts.push({
        type: 'rent',
        title: 'Sewa Lapak Bulanan',
        day: this.data.settings.rentDueDay || 16,
        amount: this.data.settings.rentAmount || 150000,
        isDue: currentDay >= (this.data.settings.rentDueDay || 16),
        desc: `Jatuh tempo setiap tanggal 16 (Rp${(this.data.settings.rentAmount || 150000).toLocaleString('id-ID')})`
      });
    }

    // Cek Gaji Karyawan (tgl 19, Rp1.000.000)
    const salaryPaidThisMonth = (this.data.expenses || []).some(e => 
      e.category === 'Gaji' && e.date.startsWith(currentMonth)
    );
    if (!salaryPaidThisMonth) {
      alerts.push({
        type: 'salary',
        title: 'Gaji Karyawan',
        day: this.data.settings.salaryDueDay || 19,
        amount: this.data.settings.salaryAmount || 1000000,
        isDue: currentDay >= (this.data.settings.salaryDueDay || 19),
        desc: `Jatuh tempo setiap tanggal 19 (Rp${(this.data.settings.salaryAmount || 1000000).toLocaleString('id-ID')})`
      });
    }

    return alerts;
  }

  /**
   * Cek Stok Menipis (Bahan & Produk Jadi)
   */
  getLowStockItems() {
    const lowRaw = this.data.rawMaterials.filter(r => r.currentStock <= r.minStock);
    const lowFinished = this.data.finishedGoods.filter(f => f.currentStock <= f.minStock);
    const lowPackaging = this.data.packaging.filter(p => p.currentStock <= p.minStock);
    return { lowRaw, lowFinished, lowPackaging };
  }
}

// Inisialisasi store tunggal
const store = new PalawijaStore();
