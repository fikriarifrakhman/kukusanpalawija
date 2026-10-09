/**
 * Application Controller & UI Logic untuk KUKUSAN PALAWIJA
 * Mengendalikan antarmuka, event form, modal, kalkulasi real-time,
 * kasir POS, dan laporan keuangan komprehensif.
 */

class PalawijaApp {
  constructor() {
    this.currentView = 'dashboard';
    this.posCart = [];
    this.showAllRekapProducts = false;
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
      pos: { title: '📝 Rekap Penjualan Lapak', sub: 'Catat total omset uang hari ini dan sisa stok fisik. Selisih produksi vs sisa dihitung otomatis.' },
      gofood: { title: '🛵 Penjualan GoFood', sub: 'Catat total uang bersih yang murni Anda terima di aplikasi GoPay / GoBiz.' },
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
      const netInput = document.getElementById('gfNetSales');
      if (netInput) netInput.value = '';
      const countInput = document.getElementById('gfOrderCount');
      if (countInput) countInput.value = '1';
      const notesInput = document.getElementById('gfNotes');
      if (notesInput) notesInput.value = '';
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
    ['pchDate', 'prdDate', 'gfDate', 'expDate', 'wstDate', 'soDate', 'rekapDate'].forEach(id => {
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
          type: 'Rekap Lapak',
          badge: 'badge-success',
          date: `${s.date} ${s.time || ''}`,
          desc: `${s.invoiceNo} (Laba: ${this.formatRupiah(s.grossProfit)})`,
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
  // VIEW: REKAP PENJUALAN LAPAK (TUTUP HARIAN)
  // ==========================================

  renderDailyClosing() {
    const tbody = document.getElementById('dailyClosingTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const dateInput = document.getElementById('rekapDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = this.getTodayDateString();
    }

    const allProducts = store.getFinishedGoods();
    const products = this.showAllRekapProducts 
      ? allProducts 
      : allProducts.filter(p => Number(p.currentStock) > 0);

    const toggleBtn = document.getElementById('btnToggleShowAllRekap');
    if (toggleBtn) {
      toggleBtn.textContent = this.showAllRekapProducts 
        ? '🎯 Sembunyikan Menu Stok 0' 
        : `👁️ Tampilkan Semua Menu (${allProducts.length})`;
    }

    const subHint = document.getElementById('rekapTableSubHint');
    if (subHint) {
      subHint.textContent = this.showAllRekapProducts
        ? `Menampilkan seluruh ${allProducts.length} menu makanan (termasuk yang stoknya 0).`
        : `Menampilkan ${products.length} menu yang memiliki stok siap jual hari ini. Cukup isi sisa fisik di lapak.`;
    }

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center" style="padding:28px 16px; color:var(--text-muted);">
            <div style="font-size:1.8rem; margin-bottom:8px;">🍠</div>
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Tidak Ada Produk dengan Stok Siap Jual Hari Ini</div>
            <div style="font-size:0.82rem; margin-bottom:12px;">Pastikan Anda sudah mencatat hasil masak di menu <strong>♨️ Dapur Kukus</strong>.</div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="app.toggleShowAllRekapProducts()">
              👁️ Buka Semua Menu (Termasuk Stok 0)
            </button>
          </td>
        </tr>
      `;
    } else {
      products.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'rekap-item-row';
        tr.setAttribute('data-id', p.id);

        const currentStock = Number(p.currentStock) || 0;
        const avgHpp = Number(p.avgHpp) || 0;

        tr.innerHTML = `
          <td>
            <div class="item-tag">
              <span class="item-icon">${p.icon || '🍠'}</span>
              <div>
                <div class="item-title" style="font-size:0.95rem; font-weight:700;">${p.name}</div>
                <div class="item-sub">Harga Jual: ${this.formatRupiah(p.sellingPrice)} / ${p.unit}</div>
              </div>
            </div>
          </td>
          <td class="text-center">
            <span class="badge ${currentStock > 0 ? 'badge-success' : 'badge-danger'}" style="font-size:0.9rem; padding:6px 12px;">
              ${currentStock} ${p.unit}
            </span>
          </td>
          <td class="text-center" style="background:rgba(64,145,108,0.04);">
            <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
              <input type="number" 
                class="form-control rekap-remaining-input" 
                data-id="${p.id}" 
                data-stock="${currentStock}" 
                data-hpp="${avgHpp}" 
                data-name="${p.name}"
                data-unit="${p.unit}"
                value="0" 
                min="0" 
                max="${Math.max(0, currentStock)}" 
                oninput="app.recalcDailyClosingTotals()" 
                style="width:90px; text-align:center; font-weight:700; font-size:1.05rem; padding:8px; border-color:var(--primary-400);">
              <span style="font-size:0.82rem; color:var(--text-secondary); font-weight:600;">${p.unit}</span>
            </div>
          </td>
          <td class="text-center">
            <span class="rekap-sold-val" style="font-weight:800; color:var(--primary-700); font-size:1.15rem;">${currentStock}</span> 
            <span style="font-size:0.8rem; color:var(--text-muted);">${p.unit}</span>
          </td>
          <td class="text-center">
            <button type="button" class="btn btn-secondary btn-sm" onclick="app.setSingleRekapZero('${p.id}')" title="Set sisa = 0 (habis terjual)">
              Habis (0)
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    this.recalcDailyClosingTotals();
    this.renderDailyClosingHistory();
  }

  // Toggle filter menu stok 0
  toggleShowAllRekapProducts() {
    this.showAllRekapProducts = !this.showAllRekapProducts;
    this.renderDailyClosing();
  }

  // Alias for backward compatibility
  renderPos() {
    this.renderDailyClosing();
  }

  setSingleRekapZero(fgId) {
    const input = document.querySelector(`.rekap-remaining-input[data-id="${fgId}"]`);
    if (input) {
      input.value = 0;
      this.recalcDailyClosingTotals();
    }
  }

  setAllRekapZero() {
    const inputs = document.querySelectorAll('.rekap-remaining-input');
    inputs.forEach(input => {
      input.value = 0;
    });
    this.recalcDailyClosingTotals();
    this.showToast('Semua sisa produk lapak diatur menjadi 0 (terjual habis).', 'info');
  }

  recalcDailyClosingTotals() {
    const revenueInput = document.getElementById('rekapTotalRevenue');
    const totalRevenue = Number(revenueInput ? revenueInput.value : 0) || 0;

    let totalSoldQty = 0;
    let totalHpp = 0;

    const rows = document.querySelectorAll('.rekap-item-row');
    rows.forEach(row => {
      const input = row.querySelector('.rekap-remaining-input');
      if (!input) return;

      const currentStock = Number(input.getAttribute('data-stock')) || 0;
      const unitHpp = Number(input.getAttribute('data-hpp')) || 0;
      let remainingVal = Number(input.value);

      if (isNaN(remainingVal) || remainingVal < 0) {
        remainingVal = 0;
      }

      // Validasi sisa tidak boleh melebihi stok siap jual
      if (remainingVal > currentStock) {
        remainingVal = currentStock;
        input.value = currentStock;
      }

      const soldQty = Math.max(0, currentStock - remainingVal);
      const itemHpp = soldQty * unitHpp;

      totalSoldQty += soldQty;
      totalHpp += itemHpp;

      // Update teks di baris tabel
      const soldEl = row.querySelector('.rekap-sold-val');
      if (soldEl) soldEl.textContent = soldQty;
    });

    // Update KPI summary cards
    const liveOmsetEl = document.getElementById('rekapLiveOmset');
    if (liveOmsetEl) liveOmsetEl.textContent = this.formatRupiah(totalRevenue);

    const liveQtySoldEl = document.getElementById('rekapLiveQtySold');
    if (liveQtySoldEl) liveQtySoldEl.textContent = `${totalSoldQty} porsi`;

    const liveHppEl = document.getElementById('rekapLiveHpp');
    if (liveHppEl) liveHppEl.textContent = this.formatRupiah(totalHpp);

    const liveGrossEl = document.getElementById('rekapLiveGrossProfit');
    const liveMarginEl = document.getElementById('rekapLiveMarginPct');

    if (totalRevenue === 0) {
      if (liveGrossEl) {
        liveGrossEl.textContent = 'Rp 0';
        liveGrossEl.style.color = 'var(--text-muted)';
      }
      if (liveMarginEl) {
        liveMarginEl.textContent = totalSoldQty > 0 ? 'Ketik uang hasil jual di atas' : 'Menunggu input omset';
      }
    } else {
      const grossProfit = totalRevenue - totalHpp;
      const marginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
      if (liveGrossEl) {
        liveGrossEl.textContent = this.formatRupiah(grossProfit);
        liveGrossEl.style.color = grossProfit >= 0 ? 'var(--primary-700)' : 'var(--danger-600)';
      }
      if (liveMarginEl) {
        liveMarginEl.textContent = `Margin Keuntungan: ${marginPct}%`;
      }
    }
  }

  handleDailyClosingSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('rekapDate').value || this.getTodayDateString();
    const revenueInput = document.getElementById('rekapTotalRevenue');
    const totalRevenue = Number(revenueInput.value);
    const paymentMethod = document.getElementById('rekapPaymentMethod').value || 'Tunai';
    const notes = document.getElementById('rekapNotes').value || '';

    if (isNaN(totalRevenue) || totalRevenue < 0) {
      this.showToast('Harap masukkan nominal pendapatan total lapak hari ini!', 'error');
      return;
    }

    const items = [];
    const inputs = document.querySelectorAll('.rekap-remaining-input');
    inputs.forEach(inp => {
      const finishedGoodId = inp.getAttribute('data-id');
      const remainingStock = Math.max(0, Number(inp.value) || 0);
      items.push({
        finishedGoodId,
        remainingStock
      });
    });

    try {
      const record = store.recordDailyClosingLapak({
        date,
        totalRevenue,
        paymentMethod,
        items,
        notes: notes || 'Rekap Penjualan Harian Lapak'
      });

      revenueInput.value = '';
      const notesInput = document.getElementById('rekapNotes');
      if (notesInput) notesInput.value = '';

      this.showToast(`Rekap harian ${record.invoiceNo} berhasil disimpan! Laba kotor: ${this.formatRupiah(record.grossProfit)}`, 'success');

      // Tampilkan popup rincian rekap
      this.showReceiptModal(record);

      this.renderDailyClosing();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderDailyClosingHistory() {
    const tbody = document.getElementById('dailyClosingHistoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = store.getSalesLapak();
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding:22px; color:var(--text-muted);">
            Belum ada riwayat rekap penjualan harian yang disimpan.
          </td>
        </tr>
      `;
      return;
    }

    list.forEach(s => {
      const tr = document.createElement('tr');

      // Summary of sold items
      const itemsDesc = (s.items || [])
        .filter(it => (it.soldQty || it.qty || 0) > 0)
        .map(it => `${it.productName} (${it.soldQty || it.qty} ${it.unit})`)
        .join(', ') || 'Semua sisa utuh (0 terjual)';

      tr.innerHTML = `
        <td><strong style="color:var(--primary-700)">${s.invoiceNo}</strong></td>
        <td>
          <div>${s.date}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${s.time || ''}</div>
        </td>
        <td style="max-width:280px; font-size:0.82rem; color:var(--text-secondary); line-height:1.35;">
          ${itemsDesc}
        </td>
        <td class="text-right num" style="font-weight:700; color:var(--primary-800);">
          ${this.formatRupiah(s.totalRevenue)}
        </td>
        <td class="text-right num" style="color:var(--accent-terracotta);">
          ${this.formatRupiah(s.totalHpp)}
        </td>
        <td class="text-right num" style="font-weight:700; color:${s.grossProfit >= 0 ? 'var(--success-600)' : 'var(--danger-600)'};">
          ${this.formatRupiah(s.grossProfit)}
        </td>
        <td><span class="badge badge-info">${s.paymentMethod || 'Tunai'}</span></td>
        <td class="text-center">
          <div style="display:flex; justify-content:center; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick='app.showReceiptModal(${JSON.stringify(s)})' title="Lihat Rincian Rekap">
              📑 Detail
            </button>
            <button class="btn btn-danger btn-sm" onclick="app.deleteSaleLapakConfirm('${s.id}')" title="Hapus Rekap">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  showReceiptModal(sale) {
    const area = document.getElementById('receiptPrintArea');
    if (!area) return;

    let itemsRows = '';
    (sale.items || []).forEach(it => {
      const sold = it.soldQty !== undefined ? it.soldQty : (it.qty || 0);
      const stockBefore = it.stockBefore !== undefined ? it.stockBefore : '-';
      const remaining = it.remainingStock !== undefined ? it.remainingStock : '-';
      const itemHpp = it.totalHpp !== undefined ? it.totalHpp : (sold * (it.hppPerUnit || 0));

      itemsRows += `
        <tr>
          <td style="padding:6px 8px; border-bottom:1px solid #e2e8e5;"><strong>${it.productName}</strong></td>
          <td class="text-center" style="padding:6px 8px; border-bottom:1px solid #e2e8e5;">${stockBefore}</td>
          <td class="text-center" style="padding:6px 8px; border-bottom:1px solid #e2e8e5; color:#d97706; font-weight:700;">${remaining}</td>
          <td class="text-center" style="padding:6px 8px; border-bottom:1px solid #e2e8e5; color:#1b4332; font-weight:700;">${sold} ${it.unit || ''}</td>
          <td class="text-right num" style="padding:6px 8px; border-bottom:1px solid #e2e8e5;">${this.formatRupiah(it.hppPerUnit || 0)}</td>
          <td class="text-right num font-weight-bold" style="padding:6px 8px; border-bottom:1px solid #e2e8e5; color:#e76f51;">${this.formatRupiah(itemHpp)}</td>
        </tr>
      `;
    });

    area.innerHTML = `
      <div style="text-align:center; border-bottom:2px solid #0d281e; padding-bottom:12px; margin-bottom:14px;">
        <h3 style="margin:0; font-size:1.2rem; color:#0d281e; letter-spacing:0.5px;">KUKUSAN PALAWIJA</h3>
        <div style="font-size:0.85rem; color:#475569; font-weight:600;">REKAP PENJUALAN & TUTUP HARIAN LAPAK</div>
        <div style="font-size:0.8rem; color:#94a3b8; margin-top:4px;">
          No: <strong>${sale.invoiceNo}</strong> | Tanggal: ${sale.date} ${sale.time || ''}
        </div>
      </div>

      <div style="margin-bottom:14px; font-size:0.85rem; display:flex; justify-content:space-between; background:#f8fafc; padding:8px 12px; border-radius:6px;">
        <div><strong>Metode Kas:</strong> ${sale.paymentMethod || 'Tunai'}</div>
        <div><strong>Keterangan:</strong> ${sale.notes || 'Penjualan Lapak'}</div>
      </div>

      <div class="table-responsive" style="margin-bottom:14px;">
        <table style="width:100%; border-collapse:collapse; font-size:0.84rem;">
          <thead>
            <tr style="background:#f1f5f3; text-transform:uppercase; font-size:0.72rem; color:#475569;">
              <th style="padding:6px 8px; text-align:left;">Produk</th>
              <th style="padding:6px 8px; text-align:center;">Stok Awal</th>
              <th style="padding:6px 8px; text-align:center;">Sisa</th>
              <th style="padding:6px 8px; text-align:center;">Terjual</th>
              <th style="padding:6px 8px; text-align:right;">HPP Satuan</th>
              <th style="padding:6px 8px; text-align:right;">Total HPP</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>

      <div style="border-top:2px solid #e2e8e5; padding-top:10px; font-size:0.92rem; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#475569;">Total Omset (Uang Masuk Lapak):</span>
          <strong class="num" style="font-size:1.05rem; color:#1b4332;">${this.formatRupiah(sale.totalRevenue)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#475569;">Total Beban Modal (HPP Terjual):</span>
          <strong class="num" style="color:#e76f51;">${this.formatRupiah(sale.totalHpp)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:8px; margin-top:2px;">
          <span style="font-weight:800; color:#0d281e; font-size:1.05rem;">LABA KOTOR LAPAK:</span>
          <strong class="num" style="font-size:1.2rem; color:${sale.grossProfit >= 0 ? '#10b981' : '#e63946'};">${this.formatRupiah(sale.grossProfit)}</strong>
        </div>
      </div>
    `;

    this.openModal('modalReceipt');
  }

  deleteSaleLapakConfirm(id) {
    if (confirm('Hapus data rekap penjualan ini? Stok produk jadi akan dikembalikan ke kondisi sebelum penutupan lapak.')) {
      store.deleteSaleLapak(id);
      this.showToast('Data rekap dihapus dan stok produk berhasil dipulihkan.', 'info');
      this.renderDailyClosing();
    }
  }

  // ==========================================
  // VIEW: GOFOOD
  // ==========================================

  renderGoFood() {
    const list = store.getSalesGoFood();
    let totalNet = 0;
    let totalOrders = 0;

    const tbody = document.getElementById('gofoodTableBody');
    if (tbody) tbody.innerHTML = '';

    if (list.length === 0 && tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="padding:22px; color:var(--text-muted);">
            Belum ada catatan penjualan GoFood.
          </td>
        </tr>
      `;
    } else {
      list.forEach(g => {
        const net = Number(g.netReceived !== undefined ? g.netReceived : g.grossSales) || 0;
        const orders = Number(g.orderCount) || 1;
        totalNet += net;
        totalOrders += orders;

        if (tbody) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong style="color:var(--gofood-green);">${g.orderNo}</strong></td>
            <td>${g.date}</td>
            <td class="text-center font-weight-bold">${orders} order</td>
            <td class="text-right num font-weight-bold" style="color:var(--gofood-green); font-size:0.95rem;">
              ${this.formatRupiah(net)}
            </td>
            <td><span class="badge badge-brand">${g.paymentMethod || 'Saldo GoPay'}</span></td>
            <td style="font-size:0.82rem; color:var(--text-secondary);">${g.notes || '-'}</td>
            <td class="text-center">
              <button class="btn btn-danger btn-sm" onclick="app.deleteGoFoodConfirm('${g.id}')" title="Hapus">🗑️</button>
            </td>
          `;
          tbody.appendChild(tr);
        }
      });
    }

    const netEl = document.getElementById('gfTotalNet');
    if (netEl) netEl.textContent = this.formatRupiah(totalNet);

    const ordersEl = document.getElementById('gfTotalOrders');
    if (ordersEl) ordersEl.textContent = `${totalOrders} order`;
  }

  handleGoFoodSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('gfDate').value || this.getTodayDateString();
    const orderCount = document.getElementById('gfOrderCount').value || 1;
    const netInput = document.getElementById('gfNetSales');
    const netReceived = Number(netInput ? netInput.value : 0);
    const paymentMethod = document.getElementById('gfPaymentMethod').value;
    const notes = document.getElementById('gfNotes').value;

    if (isNaN(netReceived) || netReceived <= 0) {
      this.showToast('Harap masukkan nominal uang bersih yang diterima dari GoFood!', 'error');
      return;
    }

    try {
      const record = store.recordSaleGoFood({
        date,
        orderCount,
        netReceived,
        paymentMethod,
        notes
      });

      this.closeModal('modalGoFood');
      this.showToast(`Penjualan GoFood ${record.orderNo} sebesar ${this.formatRupiah(record.netReceived)} berhasil dicatat!`, 'success');
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

  // Helper untuk mencocokkan bahan baku mentah dengan produk jadi pasangannya
  getDefaultFinishedGoodForRaw(rawId) {
    const raw = store.getRawMaterialById(rawId);
    if (!raw) return store.getFinishedGoods()[0]?.id || '';

    // Cek kecocokan ID (raw-1 -> prod-1, dst.)
    const directProdId = raw.id.replace('raw-', 'prod-');
    if (store.getFinishedGoodById(directProdId)) {
      return directProdId;
    }

    // Cek kecocokan kata kunci nama
    const rawNameLower = raw.name.toLowerCase();
    const fgList = store.getFinishedGoods();
    const found = fgList.find(f => {
      const fNameLower = f.name.toLowerCase();
      if (rawNameLower.includes('telur') && fNameLower.includes('telur')) return true;
      if (rawNameLower.includes('kacang') && fNameLower.includes('kacang')) return true;
      if (rawNameLower.includes('edamame') && fNameLower.includes('edamame')) return true;
      if (rawNameLower.includes('jagung manis') && fNameLower.includes('jagung manis')) return true;
      if (rawNameLower.includes('jagung ungu') && fNameLower.includes('jagung ungu')) return true;
      if (rawNameLower.includes('pisang') && fNameLower.includes('pisang')) return true;
      if (rawNameLower.includes('singkong') && fNameLower.includes('singkong')) return true;
      if (rawNameLower.includes('labu') && fNameLower.includes('labu')) return true;
      if (rawNameLower.includes('ubi madu') && fNameLower.includes('ubi madu')) return true;
      if (rawNameLower.includes('ubi ungu') && fNameLower.includes('ubi ungu')) return true;
      if (rawNameLower.includes('ubi oren') && fNameLower.includes('ubi oren')) return true;
      if (rawNameLower.includes('gembili') && fNameLower.includes('gembili')) return true;
      if (rawNameLower.includes('sukun') && fNameLower.includes('sukun')) return true;
      return false;
    });

    return found ? found.id : (fgList[0]?.id || '');
  }

  setupProductionModal() {
    document.getElementById('prdDate').value = this.getTodayDateString();
    document.getElementById('prdAdditionalCost').value = '0';
    document.getElementById('prdNotes').value = '';

    const container = document.getElementById('prdUnifiedRowsContainer');
    if (container) {
      container.innerHTML = '';
      this.addProductionRow();
    }
    this.recalcProductionTotals();
  }

  addProductionRow() {
    const container = document.getElementById('prdUnifiedRowsContainer');
    if (!container) return;

    const rawMaterials = store.getRawMaterials();
    const finishedGoods = store.getFinishedGoods();
    if (rawMaterials.length === 0 || finishedGoods.length === 0) {
      this.showToast('Master bahan atau produk belum tersedia.', 'error');
      return;
    }

    const firstRaw = rawMaterials[0];
    const defaultFgId = this.getDefaultFinishedGoodForRaw(firstRaw.id);
    const defaultFg = store.getFinishedGoodById(defaultFgId) || finishedGoods[0];

    const tr = document.createElement('tr');
    tr.className = 'prd-row';

    let rawOptions = '';
    rawMaterials.forEach(m => {
      rawOptions += `<option value="${m.id}" data-unit="${m.unit}" data-cost="${m.avgPrice}">${m.name} (Stok: ${m.currentStock} ${m.unit})</option>`;
    });

    let fgOptions = '';
    finishedGoods.forEach(f => {
      const isSelected = f.id === defaultFgId ? 'selected' : '';
      fgOptions += `<option value="${f.id}" data-unit="${f.unit}" ${isSelected}>${f.name}</option>`;
    });

    tr.innerHTML = `
      <td>
        <select class="form-select prd-raw-select" style="font-size:0.85rem;" onchange="app.onProductionRawChange(this)">
          ${rawOptions}
        </select>
        <div class="prd-raw-subcost num" style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
          Biaya: Rp 0 (@ ${this.formatRupiah(firstRaw.avgPrice)}/${firstRaw.unit})
        </div>
      </td>
      <td>
        <input type="number" step="0.01" class="form-control prd-raw-qty" style="text-align:center; font-weight:700;" placeholder="0" oninput="app.onProductionRawQtyInput(this)" required>
        <div class="prd-raw-unit" style="font-size:0.72rem; text-align:center; color:var(--text-muted); margin-top:2px;">${firstRaw.unit}</div>
      </td>
      <td>
        <select class="form-select prd-fg-select" style="font-size:0.85rem;" onchange="app.onProductionFgChange(this)">
          ${fgOptions}
        </select>
      </td>
      <td>
        <input type="number" step="0.01" class="form-control prd-out-qty" data-manually-changed="false" style="text-align:center; font-weight:800; color:var(--primary-800);" placeholder="0" oninput="app.onProductionOutQtyInput(this)" required>
        <div class="prd-out-unit" style="font-size:0.72rem; text-align:center; color:var(--text-muted); margin-top:2px;">${defaultFg.unit}</div>
      </td>
      <td class="text-right num font-weight-bold prd-row-hpp" style="color:var(--primary-700); vertical-align:middle; font-size:0.88rem;">
        Rp 0
      </td>
      <td class="text-center" style="vertical-align:middle;">
        <button type="button" class="btn-remove-row" style="cursor:pointer;" onclick="app.removeProductionRow(this)">✕</button>
      </td>
    `;

    container.appendChild(tr);
    this.recalcProductionTotals();
  }

  removeProductionRow(btn) {
    const row = btn.closest('.prd-row');
    const container = document.getElementById('prdUnifiedRowsContainer');
    if (row && container) {
      if (container.querySelectorAll('.prd-row').length > 1) {
        row.remove();
      } else {
        // Jika tinggal 1 baris, cukup reset nilainya
        row.querySelector('.prd-raw-qty').value = '';
        row.querySelector('.prd-out-qty').value = '';
        row.querySelector('.prd-out-qty').setAttribute('data-manually-changed', 'false');
      }
      this.recalcProductionTotals();
    }
  }

  onProductionRawChange(selectEl) {
    const row = selectEl.closest('.prd-row');
    if (!row) return;

    const rawId = selectEl.value;
    const raw = store.getRawMaterialById(rawId);
    if (!raw) return;

    // Update label satuan mentah
    row.querySelector('.prd-raw-unit').textContent = raw.unit;

    // Otomatis pilih pasangan produk jadi yang sesuai
    const autoFgId = this.getDefaultFinishedGoodForRaw(rawId);
    const fgSelect = row.querySelector('.prd-fg-select');
    if (fgSelect && autoFgId) {
      fgSelect.value = autoFgId;
      const fg = store.getFinishedGoodById(autoFgId);
      if (fg) {
        row.querySelector('.prd-out-unit').textContent = fg.unit;
      }
    }

    this.recalcProductionTotals();
  }

  onProductionFgChange(selectEl) {
    const row = selectEl.closest('.prd-row');
    if (!row) return;

    const fg = store.getFinishedGoodById(selectEl.value);
    if (fg) {
      row.querySelector('.prd-out-unit').textContent = fg.unit;
    }
    this.recalcProductionTotals();
  }

  onProductionRawQtyInput(inputEl) {
    const row = inputEl.closest('.prd-row');
    if (!row) return;

    const rawQtyVal = inputEl.value;
    const outQtyInput = row.querySelector('.prd-out-qty');

    // Jika hasil matang belum pernah diubah manual oleh pengguna,
    // OTOMATIS IKUT TERISI PERSIS SAMA DENGAN JUMLAH BAHAN!
    if (outQtyInput && outQtyInput.getAttribute('data-manually-changed') !== 'true') {
      outQtyInput.value = rawQtyVal;
    }

    this.recalcProductionTotals();
  }

  onProductionOutQtyInput(inputEl) {
    // Tandai bahwa pengguna mengubah hasil matang secara manual (misal jika ada yang susut/rusak)
    inputEl.setAttribute('data-manually-changed', 'true');
    this.recalcProductionTotals();
  }

  recalcProductionTotals() {
    let totalRawCost = 0;
    const rows = document.querySelectorAll('#prdUnifiedRowsContainer .prd-row');
    const rowCalculations = [];

    rows.forEach(row => {
      const rawSelect = row.querySelector('.prd-raw-select');
      const rawQtyInput = row.querySelector('.prd-raw-qty');
      const fgSelect = row.querySelector('.prd-fg-select');
      const outQtyInput = row.querySelector('.prd-out-qty');
      const rawSubcostEl = row.querySelector('.prd-raw-subcost');
      const hppEl = row.querySelector('.prd-row-hpp');

      if (!rawSelect || !rawQtyInput || !fgSelect || !outQtyInput) return;

      const raw = store.getRawMaterialById(rawSelect.value);
      const fg = store.getFinishedGoodById(fgSelect.value);
      const rawQty = Number(rawQtyInput.value) || 0;
      const outQty = Number(outQtyInput.value) || 0;

      const unitCost = raw ? (Number(raw.avgPrice) || 0) : 0;
      const lineCost = Math.round(rawQty * unitCost);
      totalRawCost += lineCost;

      if (rawSubcostEl && raw) {
        rawSubcostEl.textContent = `Biaya: ${this.formatRupiah(lineCost)} (@ ${this.formatRupiah(unitCost)}/${raw.unit})`;
      }

      rowCalculations.push({
        row,
        lineCost,
        outQty,
        fgUnit: fg ? fg.unit : 'unit',
        hppEl
      });
    });

    const addCost = Number(document.getElementById('prdAdditionalCost').value) || 0;
    const totalBatchCost = totalRawCost + addCost;
    document.getElementById('prdTotalCostDisplay').textContent = this.formatRupiah(totalBatchCost);

    // Hitung HPP tiap baris dengan membagi proporsional biaya tambahan jika ada
    const breakdownTexts = [];
    rowCalculations.forEach(item => {
      const extraShare = totalRawCost > 0
        ? Math.round((item.lineCost / totalRawCost) * addCost)
        : (rowCalculations.length > 0 ? Math.round(addCost / rowCalculations.length) : 0);

      const totalLineCost = item.lineCost + extraShare;
      const unitHpp = item.outQty > 0 ? Math.round(totalLineCost / item.outQty) : 0;

      if (item.hppEl) {
        item.hppEl.innerHTML = `${this.formatRupiah(unitHpp)} <span style="font-size:0.74rem; font-weight:normal; color:var(--text-muted);">/${item.fgUnit}</span>`;
      }

      if (item.outQty > 0) {
        breakdownTexts.push(`HPP: <strong>${this.formatRupiah(unitHpp)}/${item.fgUnit}</strong>`);
      }
    });

    const breakdownEl = document.getElementById('prdResultHppBreakdown');
    if (breakdownEl) {
      if (breakdownTexts.length > 0) {
        breakdownEl.innerHTML = breakdownTexts.join(' &bull; ');
      } else {
        breakdownEl.textContent = 'HPP dihitung otomatis tanpa perlu repot mengisi persentase biaya.';
      }
    }
  }

  handleProductionSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('prdDate').value;
    const additionalCost = Number(document.getElementById('prdAdditionalCost').value) || 0;
    const notes = document.getElementById('prdNotes').value;

    const rows = document.querySelectorAll('#prdUnifiedRowsContainer .prd-row');
    const items = [];

    rows.forEach(row => {
      const rawSelect = row.querySelector('.prd-raw-select');
      const rawQtyInput = row.querySelector('.prd-raw-qty');
      const fgSelect = row.querySelector('.prd-fg-select');
      const outQtyInput = row.querySelector('.prd-out-qty');

      const rawId = rawSelect?.value;
      const rawQty = Number(rawQtyInput?.value) || 0;
      const fgId = fgSelect?.value;
      const outputQty = Number(outQtyInput?.value) || 0;

      if (rawId && fgId && rawQty > 0 && outputQty > 0) {
        items.push({
          rawMaterialId: rawId,
          rawQty,
          finishedGoodId: fgId,
          outputQty
        });
      }
    });

    if (items.length === 0) {
      this.showToast('Harap isi jumlah bahan dan hasil matang minimal 1 menu!', 'error');
      return;
    }

    try {
      const record = store.recordProduction({
        date,
        items,
        additionalCost,
        notes
      });

      this.closeModal('modalProduction');
      this.showToast(`Batch produksi ${record.batchNo} berhasil disimpan! Stok makanan siap jual telah diperbarui.`, 'success');
      this.renderProduction();
      this.renderFinishedGoods();
      this.renderRawMaterials();
      this.renderDashboard();
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
