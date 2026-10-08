/**
 * Application Controller & UI Logic untuk KUKUSAN PALAWIJA
 * Mengendalikan antarmuka, event form, modal, kalkulasi real-time,
 * kasir POS, dan laporan keuangan komprehensif.
 */

class PalawijaApp {
  constructor() {
    this.currentView = 'dashboard';
    this.posCart = [];
    this.reportPeriod = 'this_month';
    this.reportCustomStart = null;
    this.reportCustomEnd = null;

    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindModals();
    this.populateInitialDateFields();

    // Subscribe store changes to re-render
    store.subscribe(() => {
      this.renderCurrentView();
      this.updateSidebarMetrics();
      this.renderRecurringAlerts();
    });

    // Initial render
    this.renderCurrentView();
    this.updateSidebarMetrics();
    this.renderRecurringAlerts();
  }

  // ==========================================
  // NAVIGATION & VIEW SWITCHING
  // ==========================================

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        const targetView = item.getAttribute('data-view');
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });

    const btnQuick = document.getElementById('btnQuickActionOpen');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => {
        // Default quick modal: Beli Bahan atau Jual
        this.openModal('modalSaleLapakQuick');
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(`view${this.capitalize(viewName)}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update header titles
    const headings = {
      dashboard: { title: '📊 Dashboard Ringkasan', sub: 'Pantau penjualan hari ini, HPP, stok bahan, dan arus kas bisnis secara seketika.' },
      pos: { title: '🛒 Kasir Lapak (POS Cepat)', sub: 'Pencatatan transaksi jual langsung di lapak dengan perhitungan HPP dan laba otomatis.' },
      gofood: { title: '🛵 Penjualan GoFood', sub: 'Catat omset kotor, potongan komisi aplikasi, dan uang bersih diterima.' },
      production: { title: '♨️ Dapur Kukus & Produksi', sub: 'Konversi bahan baku mentah menjadi produk jadi matang dengan MWA HPP.' },
      raw: { title: '🧺 Stok Bahan Baku', sub: 'Manajemen persediaan bahan mentah menggunakan Moving Weighted Average.' },
      finished: { title: '🍠 Produk Jadi Siap Jual', sub: 'Daftar makanan kukus siap saji beserta HPP rata-rata dan harga jual.' },
      waste: { title: '🗑️ Kerugian Waste & Basi', sub: 'Pencatatan produk rusak yang mengurangi stok dan menjadi beban kerugian usaha.' },
      packaging: { title: '📦 Kemasan & Opname Berkala', sub: 'Audit berkala pemakaian mika, plastik, dan sticker tanpa merepotkan transaksi.' },
      expenses: { title: '💸 Pengeluaran Operasional', sub: 'Pencatatan beban usaha termasuk pemisahan gas rumah tangga vs usaha.' },
      reports: { title: '📑 Laporan Keuangan Lengkap', sub: 'Laporan Laba Rugi, Arus Kas (Cash Flow), dan Nilai Persediaan multi-periode.' },
      settings: { title: '⚙️ Pengaturan & Backup Data', sub: 'Kelola konfigurasi usaha, pengingat tagihan, dan ekspor/impor data lokal.' }
    };

    const h = headings[viewName] || { title: 'Kukusan Palawija', sub: '' };
    document.getElementById('pageMainHeading').textContent = h.title;
    document.getElementById('pageMainSub').textContent = h.sub;

    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'pos':
        this.renderPos();
        break;
      case 'gofood':
        this.renderGoFood();
        break;
      case 'production':
        this.renderProduction();
        break;
      case 'raw':
        this.renderRawMaterials();
        break;
      case 'finished':
        this.renderFinishedGoods();
        break;
      case 'waste':
        this.renderWaste();
        break;
      case 'packaging':
        this.renderPackaging();
        break;
      case 'expenses':
        this.renderExpenses();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  // ==========================================
  // MODAL CONTROLLERS
  // ==========================================

  bindModals() {
    // Backdrop click close
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });
  }

  openModal(modalId) {
    // Shortcut special handlers
    if (modalId === 'modalSaleLapakQuick') {
      this.switchView('pos');
      return;
    }

    if (modalId === 'modalPurchase') {
      this.populatePurchaseItemsDropdown();
      document.getElementById('pchDate').value = this.getTodayDateString();
      document.getElementById('pchQty').value = '';
      document.getElementById('pchUnitPrice').value = '';
      document.getElementById('pchTotalDisplay').textContent = 'Rp 0';
    } else if (modalId === 'modalProduction') {
      this.setupProductionModal();
    } else if (modalId === 'modalGoFood') {
      document.getElementById('gfDate').value = this.getTodayDateString();
      document.getElementById('gfGrossSales').value = '';
      document.getElementById('gfAppFee').value = '';
      document.getElementById('gfNetDisplay').textContent = 'Rp 0';
    } else if (modalId === 'modalExpense') {
      document.getElementById('expDate').value = this.getTodayDateString();
      document.getElementById('expTotalAmount').value = '';
      document.getElementById('expCategory').value = 'Gas';
      this.handleExpenseCategoryChange();
    } else if (modalId === 'modalWaste') {
      this.setupWasteModal();
    } else if (modalId === 'modalPackagingAudit') {
      this.setupPackagingAuditModal();
    }

    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
    }
  }

  populateInitialDateFields() {
    const today = this.getTodayDateString();
    ['pchDate', 'prdDate', 'gfDate', 'expDate', 'wstDate', 'soDate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = today;
    });
  }

  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  formatRupiah(num) {
    if (num === undefined || num === null || isNaN(num)) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  // ==========================================
  // DASHBOARD & SIDEBAR
  // ==========================================

  updateSidebarMetrics() {
    const summaryMonth = store.getFinancialSummary();
    const netCash = summaryMonth.cashFlow.netCashFlow;
    const sidebarCashEl = document.getElementById('sidebarCashVal');
    if (sidebarCashEl) {
      sidebarCashEl.textContent = this.formatRupiah(netCash);
      sidebarCashEl.style.color = netCash >= 0 ? '#a7f3d0' : '#fca5a5';
    }

    // Low stock badge
    const lowStock = store.getLowStockItems();
    const totalLow = lowStock.lowRaw.length + lowStock.lowFinished.length;
    const badgeEl = document.getElementById('badgeLowRaw');
    if (badgeEl) {
      if (totalLow > 0) {
        badgeEl.style.display = 'inline-block';
        badgeEl.textContent = totalLow;
        badgeEl.className = 'nav-badge danger';
      } else {
        badgeEl.style.display = 'none';
      }
    }
  }

  renderRecurringAlerts() {
    const container = document.getElementById('recurringAlertContainer');
    if (!container) return;
    container.innerHTML = '';

    const alerts = store.getRecurringAlerts();
    alerts.forEach(alert => {
      const alertDiv = document.createElement('div');
      alertDiv.className = `alert-card ${alert.isDue ? 'warning' : 'info'}`;
      alertDiv.innerHTML = `
        <div class="alert-card-left">
          <span class="alert-icon">${alert.isDue ? '⚠️' : '📅'}</span>
          <div class="alert-card-text">
            <h4>${alert.title} ${alert.isDue ? '(Jatuh Tempo Hari Ini/Terlewat!)' : '(Pengingat)'}</h4>
            <p>${alert.desc}</p>
          </div>
        </div>
        <div>
          <button class="btn btn-sm ${alert.isDue ? 'btn-danger' : 'btn-primary'}" onclick="app.quickPayRecurring('${alert.type}', ${alert.amount})">
            💳 Bayar & Catat Kas Sekarang
          </button>
        </div>
      `;
      container.appendChild(alertDiv);
    });
  }

  quickPayRecurring(type, amount) {
    const category = type === 'salary' ? 'Gaji' : 'Sewa Lapak';
    const notes = type === 'salary' ? 'Pembayaran rutin gaji bulanan karyawan' : 'Pembayaran rutin sewa lapak bulanan';

    store.recordExpense({
      date: this.getTodayDateString(),
      category,
      totalAmount: amount,
      paymentMethod: 'Transfer',
      location: '-',
      businessPercent: 100,
      notes
    });

    this.showToast(`Pengeluaran ${category} sebesar ${this.formatRupiah(amount)} berhasil dicatat!`, 'success');
  }

  renderDashboard() {
    const today = this.getTodayDateString();
    const todaySummary = store.getFinancialSummary(today, today);
    const monthSummary = store.getFinancialSummary();

    // Hari Ini
    document.getElementById('dashTodaySales').textContent = this.formatRupiah(todaySummary.incomeStatement.totalRevenue);
    document.getElementById('dashTodaySalesSub').textContent = 
      `Lapak: ${this.formatRupiah(todaySummary.incomeStatement.lapakRevenue)} | GoFood: ${this.formatRupiah(todaySummary.incomeStatement.goFoodNet)}`;

    document.getElementById('dashTodayGrossProfit').textContent = this.formatRupiah(todaySummary.incomeStatement.totalGrossProfit);
    document.getElementById('dashTodayHppSub').textContent = `HPP Lapak: ${this.formatRupiah(todaySummary.incomeStatement.lapakHpp)}`;

    // Arus Kas & Modal
    document.getElementById('dashNetCashFlow').textContent = this.formatRupiah(monthSummary.cashFlow.netCashFlow);
    document.getElementById('dashCashInOutSub').textContent = 
      `Masuk: ${this.formatRupiah(monthSummary.cashFlow.totalCashIn)} | Keluar: ${this.formatRupiah(monthSummary.cashFlow.totalCashOut)}`;

    document.getElementById('dashTotalInventoryVal').textContent = this.formatRupiah(monthSummary.inventory.totalInventoryValue);
    document.getElementById('dashInventorySplitSub').textContent = 
      `Bahan: ${this.formatRupiah(monthSummary.inventory.rawInventoryValue)} | Siap: ${this.formatRupiah(monthSummary.inventory.finishedGoodsInventoryValue)}`;

    // Laba Bersih & Waste
    const netProfitEl = document.getElementById('dashNetProfitVal');
    netProfitEl.textContent = this.formatRupiah(monthSummary.incomeStatement.netProfit);
    netProfitEl.style.color = monthSummary.incomeStatement.netProfit >= 0 ? 'var(--primary-700)' : 'var(--danger-600)';

    document.getElementById('dashWasteLossVal').textContent = this.formatRupiah(monthSummary.incomeStatement.totalWasteLoss);
    document.getElementById('dashWasteItemsCount').textContent = `${monthSummary.counts.wasteCount} transaksi waste tercatat`;

    // Top Finished Goods table
    const fgTable = document.getElementById('dashTopFinishedGoodsTable');
    if (fgTable) {
      fgTable.innerHTML = '';
      const items = store.getFinishedGoods().slice(0, 5);
      items.forEach(item => {
        const tr = document.createElement('tr');
        const isLow = item.currentStock <= item.minStock;
        tr.innerHTML = `
          <td>
            <div class="item-tag">
              <span class="item-icon">${item.icon || '🍠'}</span>
              <div>
                <div class="item-title">${item.name}</div>
                <div class="item-sub">${item.unit}</div>
              </div>
            </div>
          </td>
          <td class="text-center">
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${item.currentStock} ${item.unit}</span>
          </td>
          <td class="text-right num">${this.formatRupiah(item.avgHpp)}</td>
          <td class="text-right num" style="font-weight:700;">${this.formatRupiah(item.sellingPrice)}</td>
        `;
        fgTable.appendChild(tr);
      });
    }

    // Recent activity stream
    const recentTable = document.getElementById('dashRecentActivityTable');
    if (recentTable) {
      recentTable.innerHTML = '';
      const activities = [];

      // Combine sales, productions, purchases, expenses
      (store.getSalesLapak() || []).slice(0, 3).forEach(s => {
        activities.push({
          type: 'Penjualan Lapak',
          badge: 'badge-success',
          date: `${s.date} ${s.time || ''}`,
          desc: `${s.invoiceNo} (${s.items.length} item terjual)`,
          amount: `+${this.formatRupiah(s.totalRevenue)}`,
          rawDate: s.date
        });
      });

      (store.getSalesGoFood() || []).slice(0, 2).forEach(g => {
        activities.push({
          type: 'GoFood',
          badge: 'badge-brand',
          date: g.date,
          desc: `${g.orderNo} (Bersih diterima)`,
          amount: `+${this.formatRupiah(g.netReceived)}`,
          rawDate: g.date
        });
      });

      (store.getProductions() || []).slice(0, 2).forEach(p => {
        activities.push({
          type: 'Produksi Kukus',
          badge: 'badge-info',
          date: p.date,
          desc: `${p.batchNo}: ${p.outputs.map(o => `${o.qty} ${o.productName}`).join(', ')}`,
          amount: `Biaya ${this.formatRupiah(p.totalProductionCost)}`,
          rawDate: p.date
        });
      });

      (store.getPurchases() || []).slice(0, 2).forEach(pch => {
        activities.push({
          type: 'Beli Bahan/Kemasan',
          badge: 'badge-warning',
          date: pch.date,
          desc: `${pch.itemName} (${pch.qty} ${pch.unit})`,
          amount: `-${this.formatRupiah(pch.totalPrice)}`,
          rawDate: pch.date
        });
      });

      (store.getExpenses() || []).slice(0, 2).forEach(e => {
        activities.push({
          type: `Beban ${e.category}`,
          badge: 'badge-danger',
          date: e.date,
          desc: `${e.notes || e.category} (Kas keluar)`,
          amount: `-${this.formatRupiah(e.totalAmount)}`,
          rawDate: e.date
        });
      });

      // Sort by date desc
      activities.sort((a, b) => (b.rawDate > a.rawDate ? 1 : -1));
      activities.slice(0, 6).forEach(act => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <span class="badge ${act.badge}">${act.type}</span>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">${act.date}</div>
          </td>
          <td>${act.desc}</td>
          <td class="text-right num" style="font-weight:700;">${act.amount}</td>
        `;
        recentTable.appendChild(tr);
      });
    }
  }

  // ==========================================
  // VIEW: KASIR LAPAK (POS)
  // ==========================================

  renderPos() {
    const grid = document.getElementById('posProductGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const products = store.getFinishedGoods();
    products.forEach(p => {
      const isOut = p.currentStock <= 0;
      const card = document.createElement('div');
      card.className = `product-card-pos ${isOut ? 'out-of-stock' : ''}`;
      card.onclick = () => {
        if (!isOut) this.posAddToCart(p.id);
      };

      card.innerHTML = `
        <div class="product-card-icon">${p.icon || '🍠'}</div>
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-price num">${this.formatRupiah(p.sellingPrice)} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">/${p.unit}</span></div>
        <div class="product-card-stock">
          ${isOut ? '<span style="color:var(--danger-600); font-weight:700;">Stok Habis</span>' : `Stok: <strong>${p.currentStock}</strong> ${p.unit}`}
        </div>
      `;
      grid.appendChild(card);
    });

    this.renderPosCart();
    this.renderPosHistory();
  }

  filterPosProducts(query) {
    const term = (query || '').toLowerCase();
    const cards = document.querySelectorAll('.product-card-pos');
    cards.forEach(card => {
      const name = card.querySelector('.product-card-name').textContent.toLowerCase();
      if (name.includes(term)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  posAddToCart(productId) {
    const prod = store.getFinishedGoodById(productId);
    if (!prod) return;

    const existing = this.posCart.find(i => i.finishedGoodId === productId);
    if (existing) {
      if (existing.qty + 1 > prod.currentStock) {
        this.showToast(`Stok ${prod.name} tidak mencukupi (sisa ${prod.currentStock})`, 'error');
        return;
      }
      existing.qty += 1;
    } else {
      this.posCart.push({
        finishedGoodId: prod.id,
        name: prod.name,
        unit: prod.unit,
        unitPrice: prod.sellingPrice,
        avgHpp: prod.avgHpp,
        qty: 1
      });
    }

    this.renderPosCart();
  }

  posChangeQty(productId, delta) {
    const existing = this.posCart.find(i => i.finishedGoodId === productId);
    if (!existing) return;

    const prod = store.getFinishedGoodById(productId);
    const newQty = existing.qty + delta;

    if (newQty <= 0) {
      this.posCart = this.posCart.filter(i => i.finishedGoodId !== productId);
    } else {
      if (prod && newQty > prod.currentStock) {
        this.showToast(`Stok ${prod.name} tidak mencukupi (sisa ${prod.currentStock})`, 'error');
        return;
      }
      existing.qty = newQty;
    }

    this.renderPosCart();
  }

  posClearCart() {
    this.posCart = [];
    this.renderPosCart();
  }

  renderPosCart() {
    const listEl = document.getElementById('posCartItemsList');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.posCart.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:0.85rem;">
          🛒 Keranjang masih kosong.<br>Klik menu produk di sebelah kiri untuk menambah.
        </div>
      `;
      document.getElementById('posCartItemCount').textContent = '0 item';
      document.getElementById('posCartHppTotal').textContent = 'Rp 0';
      document.getElementById('posCartTotalAmount').textContent = 'Rp 0';
      document.getElementById('posChangeDisplay').textContent = 'Rp 0';
      return;
    }

    let totalAmount = 0;
    let totalHpp = 0;
    let totalCount = 0;

    this.posCart.forEach(item => {
      const subtotal = item.qty * item.unitPrice;
      const subHpp = item.qty * (item.avgHpp || 0);
      totalAmount += subtotal;
      totalHpp += subHpp;
      totalCount += item.qty;

      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price-unit num">${this.formatRupiah(item.unitPrice)} × ${item.qty} ${item.unit}</div>
        </div>
        <div class="cart-qty-ctrl">
          <button class="btn-qty" onclick="app.posChangeQty('${item.finishedGoodId}', -1)">-</button>
          <span style="font-weight:700; min-width:20px; text-align:center;">${item.qty}</span>
          <button class="btn-qty" onclick="app.posChangeQty('${item.finishedGoodId}', 1)">+</button>
        </div>
        <div class="num" style="font-weight:700; min-width:70px; text-align:right;">
          ${this.formatRupiah(subtotal)}
        </div>
      `;
      listEl.appendChild(row);
    });

    document.getElementById('posCartItemCount').textContent = `${totalCount} item`;
    document.getElementById('posCartHppTotal').textContent = this.formatRupiah(totalHpp);
    document.getElementById('posCartTotalAmount').textContent = this.formatRupiah(totalAmount);

    this.calculatePosChange();
  }

  calculatePosChange() {
    let total = 0;
    this.posCart.forEach(item => {
      total += item.qty * item.unitPrice;
    });

    const receivedInput = document.getElementById('posCashReceived');
    const receivedVal = Number(receivedInput.value) || 0;
    const change = Math.max(0, receivedVal - total);
    document.getElementById('posChangeDisplay').textContent = this.formatRupiah(change);
  }

  posSubmitSale() {
    if (this.posCart.length === 0) {
      this.showToast('Keranjang belanja masih kosong!', 'error');
      return;
    }

    let total = 0;
    this.posCart.forEach(i => { total += i.qty * i.unitPrice; });

    const paymentMethod = document.getElementById('posPaymentMethod').value;
    const receivedInput = document.getElementById('posCashReceived');
    let cashReceived = Number(receivedInput.value) || total;

    if (paymentMethod === 'Tunai' && cashReceived < total) {
      this.showToast(`Uang diterima (${this.formatRupiah(cashReceived)}) kurang dari total tagihan (${this.formatRupiah(total)})!`, 'error');
      return;
    }

    try {
      const sale = store.recordSaleLapak({
        date: this.getTodayDateString(),
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        items: this.posCart,
        paymentMethod,
        cashReceived,
        notes: 'Penjualan Lapak POS'
      });

      this.posCart = [];
      receivedInput.value = '';
      this.renderPosCart();
      this.renderPos();

      this.showToast(`Nota ${sale.invoiceNo} berhasil disimpan! Total: ${this.formatRupiah(sale.totalRevenue)}`, 'success');

      // Tampilkan struk
      this.showReceiptModal(sale);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  showReceiptModal(sale) {
    const area = document.getElementById('receiptPrintArea');
    if (!area) return;

    let itemsHtml = '';
    sale.items.forEach(it => {
      itemsHtml += `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>${it.productName} (${it.qty}x)</span>
          <span>${this.formatRupiah(it.subtotal)}</span>
        </div>
      `;
    });

    area.innerHTML = `
      <div style="text-align:center; border-bottom:1px dashed #ccc; padding-bottom:10px; margin-bottom:10px;">
        <h3 style="margin:0; font-size:1.1rem;">KUKUSAN PALAWIJA</h3>
        <div>Camilan Sehat Tradisional Kukus</div>
        <div style="font-size:0.75rem; color:#666;">No: ${sale.invoiceNo} | ${sale.date} ${sale.time || ''}</div>
      </div>
      <div>
        ${itemsHtml}
      </div>
      <div style="border-top:1px dashed #ccc; margin-top:10px; padding-top:8px;">
        <div style="display:flex; justify-content:space-between; font-weight:bold;">
          <span>TOTAL:</span>
          <span>${this.formatRupiah(sale.totalRevenue)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Bayar (${sale.paymentMethod}):</span>
          <span>${this.formatRupiah(sale.cashReceived)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Kembalian:</span>
          <span>${this.formatRupiah(sale.changeAmount)}</span>
        </div>
      </div>
      <div style="text-align:center; margin-top:14px; font-size:0.75rem; color:#666;">
        Terima kasih atas kunjungan Anda!<br>Kukusan Sehat Alami Setiap Hari
      </div>
    `;

    this.openModal('modalReceipt');
  }

  renderPosHistory() {
    const tbody = document.getElementById('posSalesHistoryTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sales = store.getSalesLapak();
    sales.forEach(s => {
      const itemsDesc = s.items.map(i => `${i.productName} (${i.qty})`).join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:var(--primary-700)">${s.invoiceNo}</strong></td>
        <td>${s.time || '-'}</td>
        <td style="max-width:280px; font-size:0.82rem;">${itemsDesc}</td>
        <td class="text-right num" style="font-weight:700;">${this.formatRupiah(s.totalRevenue)}</td>
        <td class="text-right num" style="color:var(--text-muted);">${this.formatRupiah(s.totalHpp)}</td>
        <td class="text-right num" style="color:var(--success-600); font-weight:700;">${this.formatRupiah(s.grossProfit)}</td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" onclick='app.showReceiptModal(${JSON.stringify(s)})'>🧾 Struk</button>
          <button class="btn btn-danger btn-sm" onclick="app.deleteSaleLapakConfirm('${s.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  deleteSaleLapakConfirm(id) {
    if (confirm('Hapus transaksi nota lapak ini? Stok produk jadi akan disesuaikan kembali.')) {
      store.deleteSaleLapak(id);
      this.showToast('Nota lapak dihapus.', 'info');
      this.renderPos();
    }
  }

  // ==========================================
  // VIEW: GOFOOD
  // ==========================================

  renderGoFood() {
    const list = store.getSalesGoFood();
    let totalGross = 0;
    let totalFee = 0;
    let totalNet = 0;

    const tbody = document.getElementById('gofoodTableBody');
    if (tbody) tbody.innerHTML = '';

    list.forEach(g => {
      totalGross += g.grossSales;
      totalFee += g.appFee;
      totalNet += g.netReceived;

      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${g.orderNo}</strong></td>
          <td>${g.date}</td>
          <td class="text-center">${g.orderCount} order</td>
          <td class="text-right num">${this.formatRupiah(g.grossSales)}</td>
          <td class="text-right num" style="color:var(--danger-600);">-${this.formatRupiah(g.appFee)}</td>
          <td class="text-right num" style="color:var(--gofood-green); font-weight:800;">${this.formatRupiah(g.netReceived)}</td>
          <td><span class="badge badge-brand">${g.paymentMethod}</span></td>
          <td style="font-size:0.82rem; color:var(--text-secondary);">${g.notes || '-'}</td>
          <td class="text-center">
            <button class="btn btn-danger btn-sm" onclick="app.deleteGoFoodConfirm('${g.id}')">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
    });

    document.getElementById('gfTotalGross').textContent = this.formatRupiah(totalGross);
    document.getElementById('gfTotalFee').textContent = this.formatRupiah(totalFee);
    document.getElementById('gfTotalNet').textContent = this.formatRupiah(totalNet);
  }

  calculateGoFoodNet() {
    const gross = Number(document.getElementById('gfGrossSales').value) || 0;
    const fee = Number(document.getElementById('gfAppFee').value) || 0;
    const net = Math.max(0, gross - fee);
    document.getElementById('gfNetDisplay').textContent = this.formatRupiah(net);
  }

  handleGoFoodSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('gfDate').value;
    const orderCount = document.getElementById('gfOrderCount').value;
    const grossSales = document.getElementById('gfGrossSales').value;
    const appFee = document.getElementById('gfAppFee').value;
    const paymentMethod = document.getElementById('gfPaymentMethod').value;
    const notes = document.getElementById('gfNotes').value;

    try {
      const record = store.recordSaleGoFood({
        date,
        orderCount,
        grossSales,
        appFee,
        paymentMethod,
        notes
      });

      this.closeModal('modalGoFood');
      this.showToast(`Rekap GoFood ${record.orderNo} disimpan! Diterima bersih: ${this.formatRupiah(record.netReceived)}`, 'success');
      this.renderGoFood();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  deleteGoFoodConfirm(id) {
    if (confirm('Hapus pencatatan GoFood ini?')) {
      store.deleteSaleGoFood(id);
      this.showToast('Data GoFood dihapus.', 'info');
      this.renderGoFood();
    }
  }

  // ==========================================
  // VIEW: DAPUR KUKUS (PRODUKSI & MWA)
  // ==========================================

  setupProductionModal() {
    document.getElementById('prdDate').value = this.getTodayDateString();
    document.getElementById('prdAdditionalCost').value = '0';
    document.getElementById('prdNotes').value = '';

    const ingContainer = document.getElementById('prdIngredientsContainer');
    const outContainer = document.getElementById('prdOutputsContainer');
    ingContainer.innerHTML = '';
    outContainer.innerHTML = '';

    // Add 1 default ingredient and 1 default output
    this.addProductionIngredientRow();
    this.addProductionOutputRow();
    this.recalcProductionTotals();
  }

  addProductionIngredientRow() {
    const container = document.getElementById('prdIngredientsContainer');
    const rawMaterials = store.getRawMaterials();

    const row = document.createElement('div');
    row.className = 'repeater-row';

    let options = '';
    rawMaterials.forEach(m => {
      options += `<option value="${m.id}" data-unit="${m.unit}" data-cost="${m.avgPrice}">${m.name} (Stok: ${m.currentStock} ${m.unit} @ ${this.formatRupiah(m.avgPrice)})</option>`;
    });

    row.innerHTML = `
      <select class="form-select prd-ing-select" onchange="app.recalcProductionTotals()">
        ${options}
      </select>
      <input type="number" step="0.01" class="form-control prd-ing-qty" placeholder="Jumlah Dipakai" oninput="app.recalcProductionTotals()" required>
      <div class="prd-ing-subcost num" style="font-size:0.8rem; font-weight:700; text-align:right;">Rp 0</div>
      <button type="button" class="btn-remove-row" onclick="this.parentElement.remove(); app.recalcProductionTotals();">✕</button>
    `;

    container.appendChild(row);
  }

  addProductionOutputRow() {
    const container = document.getElementById('prdOutputsContainer');
    const finishedGoods = store.getFinishedGoods();

    const row = document.createElement('div');
    row.className = 'repeater-row';

    let options = '';
    finishedGoods.forEach(f => {
      options += `<option value="${f.id}" data-unit="${f.unit}">${f.name} (${f.unit})</option>`;
    });

    // Default cost percent = 100 divided by number of rows
    const currentRows = container.querySelectorAll('.repeater-row').length + 1;
    const defaultPct = currentRows === 1 ? 100 : 50;

    row.innerHTML = `
      <select class="form-select prd-out-select">
        ${options}
      </select>
      <input type="number" class="form-control prd-out-qty" placeholder="Hasil Jadi Aktual" oninput="app.recalcProductionTotals()" required>
      <div style="display:flex; align-items:center; gap:4px;">
        <input type="number" class="form-control prd-out-pct" value="${defaultPct}" min="1" max="100" placeholder="%" oninput="app.recalcProductionTotals()" required>
        <span style="font-size:0.8rem; font-weight:700;">%</span>
      </div>
      <button type="button" class="btn-remove-row" onclick="this.parentElement.remove(); app.recalcProductionTotals();">✕</button>
    `;

    container.appendChild(row);
  }

  recalcProductionTotals() {
    let rawTotalCost = 0;
    const ingRows = document.querySelectorAll('#prdIngredientsContainer .repeater-row');
    ingRows.forEach(row => {
      const select = row.querySelector('.prd-ing-select');
      const qtyInput = row.querySelector('.prd-ing-qty');
      const subcostEl = row.querySelector('.prd-ing-subcost');

      const selectedOpt = select.options[select.selectedIndex];
      const unitCost = selectedOpt ? Number(selectedOpt.getAttribute('data-cost')) || 0 : 0;
      const qty = Number(qtyInput.value) || 0;
      const sub = qty * unitCost;

      rawTotalCost += sub;
      subcostEl.textContent = this.formatRupiah(sub);
    });

    const addCost = Number(document.getElementById('prdAdditionalCost').value) || 0;
    const totalBatchCost = rawTotalCost + addCost;
    document.getElementById('prdTotalCostDisplay').textContent = this.formatRupiah(totalBatchCost);

    // Outputs cost percent calculation
    let totalPct = 0;
    const outRows = document.querySelectorAll('#prdOutputsContainer .repeater-row');
    const breakdownTexts = [];

    outRows.forEach(row => {
      const select = row.querySelector('.prd-out-select');
      const qtyInput = row.querySelector('.prd-out-qty');
      const pctInput = row.querySelector('.prd-out-pct');

      const prodName = select.options[select.selectedIndex]?.text || '';
      const qty = Number(qtyInput.value) || 0;
      const pct = Number(pctInput.value) || 0;
      totalPct += pct;

      const allocated = totalBatchCost * (pct / 100);
      const unitHpp = qty > 0 ? Math.round(allocated / qty) : 0;

      if (qty > 0) {
        breakdownTexts.push(`${prodName}: Est HPP ${this.formatRupiah(unitHpp)}/unit`);
      }
    });

    const pctDisplay = document.getElementById('prdTotalAllocationDisplay');
    pctDisplay.textContent = `${totalPct}%`;
    if (Math.round(totalPct) === 100) {
      pctDisplay.className = 'badge badge-success';
    } else {
      pctDisplay.className = 'badge badge-danger';
    }

    const breakdownEl = document.getElementById('prdResultHppBreakdown');
    if (breakdownTexts.length > 0) {
      breakdownEl.textContent = breakdownTexts.join(' | ');
    } else {
      breakdownEl.textContent = 'Masukkan hasil aktual dan persentase alokasi untuk melihat estimasi HPP per unit.';
    }
  }

  handleProductionSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('prdDate').value;
    const additionalCost = Number(document.getElementById('prdAdditionalCost').value) || 0;
    const notes = document.getElementById('prdNotes').value;

    const ingredients = [];
    document.querySelectorAll('#prdIngredientsContainer .repeater-row').forEach(row => {
      const select = row.querySelector('.prd-ing-select');
      const qtyInput = row.querySelector('.prd-ing-qty');
      ingredients.push({
        rawMaterialId: select.value,
        qty: Number(qtyInput.value) || 0
      });
    });

    const outputs = [];
    document.querySelectorAll('#prdOutputsContainer .repeater-row').forEach(row => {
      const select = row.querySelector('.prd-out-select');
      const qtyInput = row.querySelector('.prd-out-qty');
      const pctInput = row.querySelector('.prd-out-pct');
      outputs.push({
        finishedGoodId: select.value,
        qty: Number(qtyInput.value) || 0,
        costPercent: Number(pctInput.value) || 0
      });
    });

    try {
      const record = store.recordProduction({
        date,
        ingredients,
        additionalCost,
        outputs,
        notes
      });

      this.closeModal('modalProduction');
      this.showToast(`Batch produksi ${record.batchNo} berhasil dicatat! Stok & HPP produk telah diperbarui.`, 'success');
      this.renderProduction();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderProduction() {
    const tbody = document.getElementById('productionTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = store.getProductions();
    list.forEach(p => {
      const ingText = p.ingredients.map(i => `${i.rawMaterialName} (${i.qty} ${i.unit})`).join(', ');
      const outText = p.outputs.map(o => `${o.productName} (${o.qty} ${o.unit} - ${o.costPercent}%)`).join(', ');
      const hppText = p.outputs.map(o => `${o.productName}: <strong>${this.formatRupiah(o.unitHpp)}</strong>`).join('<br>');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:var(--primary-700);">${p.batchNo}</strong></td>
        <td>${p.date}</td>
        <td style="font-size:0.84rem;">${ingText}</td>
        <td class="num">${this.formatRupiah(p.additionalCost)}</td>
        <td class="text-right num" style="font-weight:700;">${this.formatRupiah(p.totalProductionCost)}</td>
        <td style="font-size:0.84rem;">${outText}</td>
        <td style="font-size:0.84rem;">${hppText}</td>
        <td class="text-center">
          <button class="btn btn-danger btn-sm" onclick="app.deleteProductionConfirm('${p.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  deleteProductionConfirm(id) {
    if (confirm('Hapus catatan produksi ini? Catatan: tidak membatalkan otomatis stok masa lalu.')) {
      store.deleteProduction(id);
      this.showToast('Catatan produksi dihapus.', 'info');
      this.renderProduction();
    }
  }

  // ==========================================
  // VIEW: BAHAN BAKU & PEMBELIAN (MWA)
  // ==========================================

  renderRawMaterials() {
    const tbody = document.getElementById('rawMaterialsTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      const list = store.getRawMaterials();
      list.forEach(r => {
        const isLow = r.currentStock <= r.minStock;
        const totalVal = r.currentStock * r.avgPrice;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="item-tag">
              <span class="item-icon">${r.icon || '🌾'}</span>
              <div>
                <div class="item-title">${r.name}</div>
                <div class="item-sub">Min stok: ${r.minStock} ${r.unit}</div>
              </div>
            </div>
          </td>
          <td>${r.unit}</td>
          <td class="text-center font-weight-bold">
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${r.currentStock} ${r.unit}</span>
          </td>
          <td class="text-right num font-weight-bold">${this.formatRupiah(r.avgPrice)}</td>
          <td class="text-right num">${this.formatRupiah(totalVal)}</td>
          <td class="text-center">
            ${isLow ? '<span class="badge badge-danger">Menipis</span>' : '<span class="badge badge-success">Aman</span>'}
          </td>
          <td class="text-center">
            <button class="btn btn-secondary btn-sm" onclick="app.quickBuyRaw('${r.id}')">+ Beli</button>
            <button class="btn btn-danger btn-sm" onclick="app.deleteRawConfirm('${r.id}')">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Purchases table
    const pchTbody = document.getElementById('purchasesTableBody');
    if (pchTbody) {
      pchTbody.innerHTML = '';
      const purchases = store.getPurchases();
      purchases.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${p.date}</td>
          <td><span class="badge ${p.type === 'raw' ? 'badge-brand' : 'badge-info'}">${p.type === 'raw' ? 'Bahan Baku' : 'Kemasan'}</span></td>
          <td><strong>${p.itemName}</strong></td>
          <td class="text-center">${p.qty} ${p.unit}</td>
          <td class="text-right num">${this.formatRupiah(p.unitPrice)}</td>
          <td class="text-right num" style="font-weight:700; color:var(--danger-600);">-${this.formatRupiah(p.totalPrice)}</td>
          <td>${p.supplier || '-'}</td>
          <td>${p.paymentMethod || 'Tunai'}</td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${p.notes || '-'}</td>
          <td class="text-center">
            <button class="btn btn-danger btn-sm" onclick="app.deletePurchaseConfirm('${p.id}')">🗑️</button>
          </td>
        `;
        pchTbody.appendChild(tr);
      });
    }
  }

  quickBuyRaw(rawId) {
    this.openModal('modalPurchase');
    document.getElementById('pchType').value = 'raw';
    this.populatePurchaseItemsDropdown();
    document.getElementById('pchItemId').value = rawId;
    this.updatePurchaseUnitLabel();
  }

  deleteRawConfirm(id) {
    if (confirm('Hapus bahan baku ini dari master data?')) {
      store.deleteRawMaterial(id);
      this.showToast('Bahan baku dihapus.', 'info');
      this.renderRawMaterials();
    }
  }

  deletePurchaseConfirm(id) {
    if (confirm('Hapus catatan pembelian ini?')) {
      store.deletePurchase(id);
      this.showToast('Catatan pembelian dihapus.', 'info');
      this.renderRawMaterials();
    }
  }

  populatePurchaseItemsDropdown() {
    const type = document.getElementById('pchType').value;
    const select = document.getElementById('pchItemId');
    select.innerHTML = '';

    if (type === 'raw') {
      const items = store.getRawMaterials();
      items.forEach(r => {
        select.innerHTML += `<option value="${r.id}" data-unit="${r.unit}">${r.name} (satuan: ${r.unit})</option>`;
      });
    } else {
      const items = store.getPackaging();
      items.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-unit="${p.unit}">${p.name} (satuan: ${p.unit})</option>`;
      });
    }

    this.updatePurchaseUnitLabel();
  }

  updatePurchaseUnitLabel() {
    const select = document.getElementById('pchItemId');
    const selected = select.options[select.selectedIndex];
    const unit = selected ? selected.getAttribute('data-unit') : 'unit';
    document.getElementById('pchUnitDisplay').textContent = unit;
    this.calculatePurchaseTotal();
  }

  calculatePurchaseTotal() {
    const qty = Number(document.getElementById('pchQty').value) || 0;
    const price = Number(document.getElementById('pchUnitPrice').value) || 0;
    const total = qty * price;
    document.getElementById('pchTotalDisplay').textContent = this.formatRupiah(total);
  }

  handlePurchaseSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('pchDate').value;
    const type = document.getElementById('pchType').value;
    const itemId = document.getElementById('pchItemId').value;
    const qty = document.getElementById('pchQty').value;
    const unitPrice = document.getElementById('pchUnitPrice').value;
    const supplier = document.getElementById('pchSupplier').value;
    const paymentMethod = document.getElementById('pchPaymentMethod').value;
    const notes = document.getElementById('pchNotes').value;

    try {
      const record = store.recordPurchase({
        date,
        type,
        itemId,
        qty,
        unitPrice,
        supplier,
        paymentMethod,
        notes
      });

      this.closeModal('modalPurchase');
      this.showToast(`Pembelian ${record.itemName} (${record.qty} ${record.unit}) berhasil dicatat! Rata-rata harga terbarui.`, 'success');
      this.renderRawMaterials();
      this.renderPackaging();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  handleAddRawSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newRawName').value;
    const unit = document.getElementById('newRawUnit').value;
    const icon = document.getElementById('newRawIcon').value;
    const currentStock = document.getElementById('newRawStock').value;
    const avgPrice = document.getElementById('newRawPrice').value;
    const minStock = document.getElementById('newRawMinStock').value;

    try {
      const newMat = store.addRawMaterial({
        name,
        unit,
        icon,
        currentStock,
        avgPrice,
        minStock
      });

      this.closeModal('modalAddRaw');
      this.showToast(`Bahan baku baru "${newMat.name}" berhasil ditambahkan!`, 'success');
      this.renderRawMaterials();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // VIEW: PRODUK JADI
  // ==========================================

  renderFinishedGoods() {
    const tbody = document.getElementById('finishedGoodsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const products = store.getFinishedGoods();
    products.forEach(p => {
      const isLow = p.currentStock <= p.minStock;
      const marginUnit = p.sellingPrice - p.avgHpp;
      const marginPct = p.sellingPrice > 0 ? Math.round((marginUnit / p.sellingPrice) * 100) : 0;
      const totalVal = p.currentStock * p.avgHpp;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="item-tag">
            <span class="item-icon">${p.icon || '🍠'}</span>
            <div>
              <div class="item-title">${p.name}</div>
              <div class="item-sub">Batas min: ${p.minStock} ${p.unit}</div>
            </div>
          </div>
        </td>
        <td>${p.unit}</td>
        <td class="text-center font-weight-bold">
          <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${p.currentStock} ${p.unit}</span>
        </td>
        <td class="text-right num">${this.formatRupiah(p.avgHpp)}</td>
        <td class="text-right num" style="font-weight:700;">${this.formatRupiah(p.sellingPrice)}</td>
        <td class="text-right num" style="color:${marginUnit >= 0 ? 'var(--primary-700)' : 'var(--danger-600)'}; font-weight:700;">
          ${this.formatRupiah(marginUnit)} (${marginPct}%)
        </td>
        <td class="text-right num">${this.formatRupiah(totalVal)}</td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" onclick="app.editProductPrice('${p.id}')">✏️ Ubah Harga</button>
          <button class="btn btn-danger btn-sm" onclick="app.deleteFinishedConfirm('${p.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  editProductPrice(id) {
    const p = store.getFinishedGoodById(id);
    if (!p) return;

    const newPrice = prompt(`Ubah harga jual "${p.name}" (saat ini ${this.formatRupiah(p.sellingPrice)}):`, p.sellingPrice);
    if (newPrice !== null && !isNaN(Number(newPrice))) {
      store.updateFinishedGood(id, { sellingPrice: Number(newPrice) });
      this.showToast(`Harga jual ${p.name} diperbarui menjadi ${this.formatRupiah(Number(newPrice))}`, 'success');
      this.renderFinishedGoods();
    }
  }

  deleteFinishedConfirm(id) {
    if (confirm('Hapus produk ini dari katalog menu?')) {
      store.deleteFinishedGood(id);
      this.showToast('Produk dihapus.', 'info');
      this.renderFinishedGoods();
    }
  }

  handleAddProductSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newProdName').value;
    const unit = document.getElementById('newProdUnit').value;
    const icon = document.getElementById('newProdIcon').value;
    const sellingPrice = document.getElementById('newProdPrice').value;
    const currentStock = document.getElementById('newProdStock').value;
    const minStock = document.getElementById('newProdMinStock').value;

    try {
      const newProd = store.addFinishedGood({
        name,
        unit,
        icon,
        sellingPrice,
        currentStock,
        minStock,
        avgHpp: 0
      });

      this.closeModal('modalAddProduct');
      this.showToast(`Menu baru "${newProd.name}" berhasil ditambahkan!`, 'success');
      this.renderFinishedGoods();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // VIEW: WASTE / KERUGIAN
  // ==========================================

  setupWasteModal() {
    document.getElementById('wstDate').value = this.getTodayDateString();
    document.getElementById('wstQty').value = '';
    document.getElementById('wstNotes').value = '';

    const select = document.getElementById('wstProductId');
    select.innerHTML = '';
    const products = store.getFinishedGoods();
    products.forEach(p => {
      select.innerHTML += `<option value="${p.id}" data-unit="${p.unit}" data-hpp="${p.avgHpp}">${p.name} (Stok: ${p.currentStock} ${p.unit} @ HPP ${this.formatRupiah(p.avgHpp)})</option>`;
    });

    this.handleWasteProductChange();
  }

  handleWasteProductChange() {
    const select = document.getElementById('wstProductId');
    const opt = select.options[select.selectedIndex];
    const unit = opt ? opt.getAttribute('data-unit') : 'biji';
    document.getElementById('wstUnitDisplay').textContent = unit;
    this.recalcWasteLoss();
  }

  recalcWasteLoss() {
    const select = document.getElementById('wstProductId');
    const opt = select.options[select.selectedIndex];
    const hpp = opt ? Number(opt.getAttribute('data-hpp')) || 0 : 0;
    const qty = Number(document.getElementById('wstQty').value) || 0;
    const loss = qty * hpp;
    document.getElementById('wstLossDisplay').textContent = this.formatRupiah(loss);
  }

  handleWasteSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('wstDate').value;
    const finishedGoodId = document.getElementById('wstProductId').value;
    const qty = document.getElementById('wstQty').value;
    const reason = document.getElementById('wstReason').value;
    const notes = document.getElementById('wstNotes').value;

    try {
      const record = store.recordWaste({
        date,
        finishedGoodId,
        qty,
        reason,
        notes
      });

      this.closeModal('modalWaste');
      this.showToast(`Waste dicatat! Kerugian sebesar ${this.formatRupiah(record.totalLoss)} dibebankan ke laporan keuangan.`, 'success');
      this.renderWaste();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderWaste() {
    const tbody = document.getElementById('wasteTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let totalLoss = 0;
    let totalQty = 0;
    const wasteList = store.getWaste();

    wasteList.forEach(w => {
      totalLoss += w.totalLoss;
      totalQty += w.qty;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${w.date}</td>
        <td><strong>${w.productName}</strong></td>
        <td class="text-center font-weight-bold" style="color:var(--danger-600);">${w.qty} ${w.unit}</td>
        <td class="text-right num">${this.formatRupiah(w.unitHpp)}</td>
        <td class="text-right num font-weight-bold" style="color:var(--danger-600);">${this.formatRupiah(w.totalLoss)}</td>
        <td><span class="badge badge-danger">${w.reason}</span></td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${w.notes || '-'}</td>
        <td class="text-center">
          <button class="btn btn-danger btn-sm" onclick="app.deleteWasteConfirm('${w.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('wasteTotalLossVal').textContent = this.formatRupiah(totalLoss);
    document.getElementById('wasteTotalQtyVal').textContent = `${totalQty} item`;
  }

  deleteWasteConfirm(id) {
    if (confirm('Hapus pencatatan waste ini?')) {
      store.deleteWaste(id);
      this.showToast('Data waste dihapus.', 'info');
      this.renderWaste();
    }
  }

  // ==========================================
  // VIEW: KEMASAN & STOCK OPNAME BERKALA
  // ==========================================

  renderPackaging() {
    const tbody = document.getElementById('packagingTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      const list = store.getPackaging();
      list.forEach(p => {
        const isLow = p.currentStock <= p.minStock;
        const totalVal = p.currentStock * p.avgCost;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="item-tag">
              <span class="item-icon">${p.icon || '📦'}</span>
              <div>
                <div class="item-title">${p.name}</div>
                <div class="item-sub">Min stok: ${p.minStock} ${p.unit}</div>
              </div>
            </div>
          </td>
          <td>${p.unit}</td>
          <td class="text-center font-weight-bold">
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${p.currentStock} ${p.unit}</span>
          </td>
          <td class="text-right num">${this.formatRupiah(p.avgCost)}</td>
          <td class="text-right num">${this.formatRupiah(totalVal)}</td>
          <td class="text-center">
            ${isLow ? '<span class="badge badge-danger">Menipis</span>' : '<span class="badge badge-success">Aman</span>'}
          </td>
          <td class="text-center">
            <button class="btn btn-secondary btn-sm" onclick="app.quickBuyPackaging('${p.id}')">+ Beli</button>
            <button class="btn btn-danger btn-sm" onclick="app.deletePackagingConfirm('${p.id}')">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Audits table
    const auditTbody = document.getElementById('packagingAuditTableBody');
    if (auditTbody) {
      auditTbody.innerHTML = '';
      const audits = store.getPackagingAudits();
      audits.forEach(a => {
        const detail = a.items.map(it => 
          `<strong>${it.packagingName}</strong>: Awal ${it.initialStock} → Fisik ${it.actualStock} = Terpakai <strong>${it.estimatedUsed} ${it.unit}</strong> (${this.formatRupiah(it.totalUsageCost)})`
        ).join('<br>');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${a.date}</td>
          <td><strong>${a.periodName}</strong></td>
          <td style="font-size:0.82rem;">${detail}</td>
          <td class="text-right num font-weight-bold" style="color:var(--primary-800);">${this.formatRupiah(a.totalUsageCost)}</td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${a.notes || '-'}</td>
        `;
        auditTbody.appendChild(tr);
      });
    }
  }

  quickBuyPackaging(packId) {
    this.openModal('modalPurchase');
    document.getElementById('pchType').value = 'packaging';
    this.populatePurchaseItemsDropdown();
    document.getElementById('pchItemId').value = packId;
    this.updatePurchaseUnitLabel();
  }

  deletePackagingConfirm(id) {
    if (confirm('Hapus jenis kemasan ini?')) {
      store.deletePackaging(id);
      this.showToast('Kemasan dihapus.', 'info');
      this.renderPackaging();
    }
  }

  setupPackagingAuditModal() {
    document.getElementById('soDate').value = this.getTodayDateString();
    document.getElementById('soPeriodName').value = 'Stock Opname ' + new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    document.getElementById('soNotes').value = '';

    const tbody = document.getElementById('soAuditRowsContainer');
    tbody.innerHTML = '';

    const items = store.getPackaging();
    items.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = 'so-row';
      tr.setAttribute('data-id', p.id);
      tr.setAttribute('data-cost', p.avgCost);
      tr.setAttribute('data-current', p.currentStock);

      tr.innerHTML = `
        <td><strong>${p.name}</strong></td>
        <td class="text-center font-weight-bold">${p.currentStock} ${p.unit}</td>
        <td class="text-center">
          <input type="number" class="form-control so-actual-input" value="${p.currentStock}" min="0" style="text-align:center; padding:4px;" oninput="app.recalcPackagingAuditTotal()">
        </td>
        <td class="text-center font-weight-bold so-estimated-used">0 ${p.unit}</td>
        <td class="text-right num font-weight-bold so-usage-cost">Rp 0</td>
      `;
      tbody.appendChild(tr);
    });

    this.recalcPackagingAuditTotal();
  }

  recalcPackagingAuditTotal() {
    let totalCost = 0;
    const rows = document.querySelectorAll('.so-row');
    rows.forEach(row => {
      const currentStock = Number(row.getAttribute('data-current')) || 0;
      const unitCost = Number(row.getAttribute('data-cost')) || 0;
      const actualInput = row.querySelector('.so-actual-input');
      const actualStock = Number(actualInput.value) || 0;

      const estimatedUsed = Math.max(0, currentStock - actualStock);
      const usageCost = estimatedUsed * unitCost;
      totalCost += usageCost;

      row.querySelector('.so-estimated-used').textContent = `${estimatedUsed}`;
      row.querySelector('.so-usage-cost').textContent = this.formatRupiah(usageCost);
    });

    document.getElementById('soTotalUsageCostDisplay').textContent = this.formatRupiah(totalCost);
  }

  handlePackagingAuditSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('soDate').value;
    const periodName = document.getElementById('soPeriodName').value;
    const notes = document.getElementById('soNotes').value;

    const audits = [];
    document.querySelectorAll('.so-row').forEach(row => {
      const packagingId = row.getAttribute('data-id');
      const actualInput = row.querySelector('.so-actual-input');
      audits.push({
        packagingId,
        actualStock: Number(actualInput.value) || 0
      });
    });

    try {
      const record = store.recordPackagingAudit({
        date,
        periodName,
        audits,
        notes
      });

      this.closeModal('modalPackagingAudit') ;
      this.showToast(`Stock Opname selesai! Estimasi biaya kemasan terpakai: ${this.formatRupiah(record.totalUsageCost)}`, 'success');
      this.renderPackaging();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  handleAddPackagingSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newPackName').value;
    const unit = document.getElementById('newPackUnit').value;
    const icon = document.getElementById('newPackIcon').value;
    const currentStock = document.getElementById('newPackStock').value;
    const avgCost = document.getElementById('newPackCost').value;

    try {
      const newPack = store.addPackaging({
        name,
        unit,
        icon,
        currentStock,
        avgCost
      });

      this.closeModal('modalAddPackaging');
      this.showToast(`Kemasan baru "${newPack.name}" berhasil ditambahkan!`, 'success');
      this.renderPackaging();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // VIEW: PENGELUARAN USAHA & GAS PERSENTASE
  // ==========================================

  handleExpenseCategoryChange() {
    const cat = document.getElementById('expCategory').value;
    const gasFields = document.getElementById('expGasSpecialFields');

    if (cat === 'Gas') {
      gasFields.style.display = 'block';
      this.handleGasLocationChange();
    } else {
      gasFields.style.display = 'none';
      document.getElementById('expBusinessPercent').value = '100';
      this.recalcExpenseSplit();
    }
  }

  handleGasLocationChange() {
    const loc = document.getElementById('expGasLocation').value;
    const pctInput = document.getElementById('expBusinessPercent');

    if (loc === 'Dalam Rumah') {
      pctInput.value = '60'; // Sesuai spesifikasi prompt!
    } else {
      pctInput.value = '100';
    }
    this.recalcExpenseSplit();
  }

  recalcExpenseSplit() {
    const totalAmount = Number(document.getElementById('expTotalAmount').value) || 0;
    const pct = Number(document.getElementById('expBusinessPercent').value) || 100;

    const biz = Math.round(totalAmount * (pct / 100));
    const pers = totalAmount - biz;

    document.getElementById('expBizSplitDisplay').textContent = this.formatRupiah(biz);
    document.getElementById('expPersonalSplitDisplay').textContent = this.formatRupiah(pers);
  }

  handleExpenseSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('expDate').value;
    const category = document.getElementById('expCategory').value;
    const totalAmount = document.getElementById('expTotalAmount').value;
    const paymentMethod = document.getElementById('expPaymentMethod').value;
    const location = category === 'Gas' ? document.getElementById('expGasLocation').value : '-';
    const businessPercent = category === 'Gas' ? document.getElementById('expBusinessPercent').value : 100;
    const notes = document.getElementById('expNotes').value;

    try {
      const record = store.recordExpense({
        date,
        category,
        totalAmount,
        paymentMethod,
        location,
        businessPercent,
        notes
      });

      this.closeModal('modalExpense');
      this.showToast(`Pengeluaran ${record.category} dicatat! Beban usaha: ${this.formatRupiah(record.businessAmount)} (Kas keluar: ${this.formatRupiah(record.totalAmount)})`, 'success');
      this.renderExpenses();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderExpenses() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = store.getExpenses();
    list.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.date}</td>
        <td><strong>${e.category}</strong></td>
        <td>${e.location || '-'}</td>
        <td class="text-center font-weight-bold">${e.businessPercent}%</td>
        <td class="text-right num font-weight-bold" style="color:var(--danger-600);">${this.formatRupiah(e.totalAmount)}</td>
        <td class="text-right num font-weight-bold" style="color:var(--primary-800);">${this.formatRupiah(e.businessAmount)}</td>
        <td class="text-right num" style="color:var(--text-muted);">${this.formatRupiah(e.personalAmount)}</td>
        <td>${e.paymentMethod}</td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${e.notes || '-'}</td>
        <td class="text-center">
          <button class="btn btn-danger btn-sm" onclick="app.deleteExpenseConfirm('${e.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  deleteExpenseConfirm(id) {
    if (confirm('Hapus catatan pengeluaran ini?')) {
      store.deleteExpense(id);
      this.showToast('Pengeluaran dihapus.', 'info');
      this.renderExpenses();
    }
  }

  // ==========================================
  // VIEW: LAPORAN KEUANGAN LENGKAP
  // ==========================================

  setReportPeriod(period) {
    this.reportPeriod = period;
    document.querySelectorAll('.report-filter-bar .btn').forEach(b => b.classList.remove('active'));
    
    if (period === 'today') document.getElementById('btnFilterToday')?.classList.add('active');
    if (period === 'this_week') document.getElementById('btnFilterWeek')?.classList.add('active');
    if (period === 'this_month') document.getElementById('btnFilterMonth')?.classList.add('active');
    if (period === 'all') document.getElementById('btnFilterAll')?.classList.add('active');

    const periodDisplay = {
      today: 'Hari Ini',
      this_week: '7 Hari Terakhir',
      this_month: 'Bulan Ini',
      all: 'Semua Transaksi'
    };
    document.getElementById('reportPeriodDisplay').textContent = periodDisplay[period] || period;

    this.renderReports();
  }

  setReportCustomDate() {
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;
    if (start && end) {
      this.reportPeriod = 'custom';
      this.reportCustomStart = start;
      this.reportCustomEnd = end;
      document.getElementById('reportPeriodDisplay').textContent = `${start} s/d ${end}`;
      this.renderReports();
    }
  }

  getDateRangeForPeriod() {
    const now = new Date();
    const todayStr = this.getTodayDateString();

    if (this.reportPeriod === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (this.reportPeriod === 'this_week') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: past7.toISOString().split('T')[0], end: todayStr };
    }
    if (this.reportPeriod === 'this_month') {
      const monthPrefix = todayStr.substring(0, 7); // YYYY-MM
      return { start: `${monthPrefix}-01`, end: todayStr };
    }
    if (this.reportPeriod === 'custom' && this.reportCustomStart && this.reportCustomEnd) {
      return { start: this.reportCustomStart, end: this.reportCustomEnd };
    }
    return { start: null, end: null };
  }

  renderReports() {
    const { start, end } = this.getDateRangeForPeriod();
    const summary = store.getFinancialSummary(start, end);

    // 1. Laba Rugi
    const is = summary.incomeStatement;
    document.getElementById('repLapakRev').textContent = this.formatRupiah(is.lapakRevenue);
    document.getElementById('repGofoodNet').textContent = this.formatRupiah(is.goFoodNet);
    document.getElementById('repTotalRev').textContent = this.formatRupiah(is.totalRevenue);

    document.getElementById('repHppLapak').textContent = this.formatRupiah(is.lapakHpp);
    document.getElementById('repTotalHpp').textContent = this.formatRupiah(is.totalHpp);

    document.getElementById('repGrossProfit').textContent = this.formatRupiah(is.totalGrossProfit);

    // Breakdown Pengeluaran Usaha
    const expBreakdownContainer = document.getElementById('repExpenseBreakdownRows');
    if (expBreakdownContainer) {
      expBreakdownContainer.innerHTML = '';
      Object.entries(is.expenseByCategory).forEach(([cat, amount]) => {
        if (amount > 0) {
          const row = document.createElement('div');
          row.className = 'statement-row indent';
          row.innerHTML = `<span>Beban ${cat}</span><span class="num">${this.formatRupiah(amount)}</span>`;
          expBreakdownContainer.appendChild(row);
        }
      });
    }

    document.getElementById('repTotalExpenses').textContent = this.formatRupiah(is.totalBusinessExpense);
    document.getElementById('repWasteLoss').textContent = this.formatRupiah(is.totalWasteLoss);

    const netProfitEl = document.getElementById('repNetProfit');
    const netProfitRow = document.getElementById('repNetProfitRow');
    netProfitEl.textContent = this.formatRupiah(is.netProfit);
    if (is.netProfit >= 0) {
      netProfitRow.classList.remove('loss');
      netProfitEl.style.color = 'var(--primary-700)';
    } else {
      netProfitRow.classList.add('loss');
      netProfitEl.style.color = 'var(--danger-600)';
    }

    // 2. Arus Kas
    const cf = summary.cashFlow;
    document.getElementById('repCashInLapak').textContent = this.formatRupiah(cf.cashInLapak);
    document.getElementById('repCashInGofood').textContent = this.formatRupiah(cf.cashInGoFood);
    document.getElementById('repTotalCashIn').textContent = this.formatRupiah(cf.totalCashIn);

    document.getElementById('repCashOutRaw').textContent = this.formatRupiah(cf.cashOutPurchasesRaw);
    document.getElementById('repCashOutPack').textContent = this.formatRupiah(cf.cashOutPurchasesPack);
    document.getElementById('repCashOutExp').textContent = this.formatRupiah(cf.cashOutExpensesTotal);
    document.getElementById('repTotalCashOut').textContent = this.formatRupiah(cf.totalCashOut);

    const netCashEl = document.getElementById('repNetCashFlow');
    const netCashRow = document.getElementById('repNetCashRow');
    netCashEl.textContent = this.formatRupiah(cf.netCashFlow);
    if (cf.netCashFlow >= 0) {
      netCashRow.classList.remove('loss');
      netCashEl.style.color = 'var(--primary-700)';
    } else {
      netCashRow.classList.add('loss');
      netCashEl.style.color = 'var(--danger-600)';
    }

    // 3. Persediaan (Valuasi Modal)
    const inv = summary.inventory;
    document.getElementById('repValRaw').textContent = this.formatRupiah(inv.rawInventoryValue);
    document.getElementById('repValFinished').textContent = this.formatRupiah(inv.finishedGoodsInventoryValue);
    document.getElementById('repValPackaging').textContent = this.formatRupiah(inv.packagingInventoryValue);
    document.getElementById('repValTotal').textContent = this.formatRupiah(inv.totalInventoryValue);
  }

  exportReportCsv() {
    const { start, end } = this.getDateRangeForPeriod();
    const s = store.getFinancialSummary(start, end);

    let csv = `LAPORAN KEUANGAN KUKUSAN PALAWIJA\n`;
    csv += `Periode,${start || 'Semua'} s/d ${end || 'Sekarang'}\n\n`;
    csv += `KOMPONEN,NOMINAL\n`;
    csv += `Penjualan Lapak,${s.incomeStatement.lapakRevenue}\n`;
    csv += `Penerimaan Bersih GoFood,${s.incomeStatement.goFoodNet}\n`;
    csv += `TOTAL PENDAPATAN,${s.incomeStatement.totalRevenue}\n`;
    csv += `HPP Penjualan Lapak,${s.incomeStatement.lapakHpp}\n`;
    csv += `LABA KOTOR,${s.incomeStatement.totalGrossProfit}\n`;
    csv += `Total Beban Operasional Usaha,${s.incomeStatement.totalBusinessExpense}\n`;
    csv += `Kerugian Waste Makanan Rusak,${s.incomeStatement.totalWasteLoss}\n`;
    csv += `LABA BERSIH,${s.incomeStatement.netProfit}\n\n`;
    csv += `ARUS KAS MASUK,${s.cashFlow.totalCashIn}\n`;
    csv += `ARUS KAS KELUAR,${s.cashFlow.totalCashOut}\n`;
    csv += `SURPLUS/DEFISIT KAS,${s.cashFlow.netCashFlow}\n\n`;
    csv += `MODAL DALAM STOK BAHAN BAKU,${s.inventory.rawInventoryValue}\n`;
    csv += `MODAL DALAM STOK PRODUK JADI,${s.inventory.finishedGoodsInventoryValue}\n`;
    csv += `MODAL DALAM STOK KEMASAN,${s.inventory.packagingInventoryValue}\n`;
    csv += `TOTAL MODAL DI STOK,${s.inventory.totalInventoryValue}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Kukusan_Palawija_${this.getTodayDateString()}.csv`;
    link.click();
    this.showToast('Laporan CSV berhasil diunduh.', 'success');
  }

  // ==========================================
  // VIEW: PENGATURAN & BACKUP
  // ==========================================

  renderSettings() {
    const set = store.data.settings || {};
    document.getElementById('settingBizName').value = set.businessName || 'Kukusan Palawija';
    document.getElementById('settingSalaryDay').value = set.salaryDueDay || 19;
    document.getElementById('settingSalaryAmount').value = set.salaryAmount || 1000000;
    document.getElementById('settingRentDay').value = set.rentDueDay || 16;
    document.getElementById('settingRentAmount').value = set.rentAmount || 150000;
  }

  saveSettings(e) {
    e.preventDefault();
    store.data.settings = {
      ...store.data.settings,
      businessName: document.getElementById('settingBizName').value,
      salaryDueDay: Number(document.getElementById('settingSalaryDay').value) || 19,
      salaryAmount: Number(document.getElementById('settingSalaryAmount').value) || 1000000,
      rentDueDay: Number(document.getElementById('settingRentDay').value) || 16,
      rentAmount: Number(document.getElementById('settingRentAmount').value) || 150000
    };
    store.saveData();
    this.showToast('Pengaturan usaha berhasil disimpan.', 'success');
  }

  downloadBackupJson() {
    const json = store.exportDataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Kukusan_Palawija_${this.getTodayDateString()}.json`;
    link.click();
    this.showToast('Berkas cadangan JSON berhasil diunduh.', 'success');
  }

  importBackupJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const res = store.importDataJson(evt.target.result);
      if (res.success) {
        this.showToast('Data berhasil dipulihkan dari cadangan!', 'success');
        this.renderCurrentView();
      } else {
        this.showToast(`Gagal memulihkan: ${res.error}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  resetToCleanConfirm() {
    if (confirm('Kosongkan semua transaksi dan set semua stok ke 0? Tindakan ini akan membuat buku catatan bersih dari awal.')) {
      store.clearAllToZero();
      this.showToast('Semua catatan dan stok berhasil dibersihkan menjadi 0.', 'success');
      this.renderCurrentView();
    }
  }

  resetSampleDataConfirm() {
    this.resetToCleanConfirm();
  }
}

// Inisialisasi App
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new PalawijaApp();
});
