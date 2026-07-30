/* ============================================
   衣橱女装工作室 · 商家工作台
   核心业务逻辑
   ============================================ */

// ===== 数据层 =====
const DB = {
  KEY: 'yichu_studio_db_v1',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) { console.error('加载数据失败', e); }
    return { products: [], sales: [] };
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(store));
  },

  export() {
    const data = JSON.stringify(store, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `衣橱工作室_备份_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('数据已导出备份');
  },

  import(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.products || !data.sales) throw new Error('格式不符');
        store = data;
        this.save();
        App.renderAll();
        Toast.show('数据导入成功');
      } catch(err) {
        Toast.show('导入失败：文件格式不正确', 'error');
      }
    };
    reader.readAsText(file);
  }
};

// 全局数据
let store = DB.load();

// ===== 工具函数 =====
const Utils = {
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  fmt(n) {
    return '¥' + (Number(n) || 0).toFixed(2);
  },

  fmtDate(d) {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.getMonth()+1}月${date.getDate()}日`;
  },

  todayStr() {
    const d = new Date();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${day}`;
  },

  isToday(dateStr) {
    return dateStr === this.todayStr();
  },

  isThisMonth(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  },

  inRange(dateStr, range) {
    if (range === 'today') return this.isToday(dateStr);
    if (range === 'month') return this.isThisMonth(dateStr);
    return true;
  },

  unitCost(product) {
    return (Number(product.cost) || 0) + (Number(product.freight) || 0);
  },

  escape(s) {
    if (!s) return '';
    return String(s).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }
};

// ===== Toast 提示 =====
const Toast = {
  el: null,
  timer: null,
  show(msg, type='success') {
    if (!this.el) this.el = document.getElementById('toast');
    this.el.textContent = msg;
    this.el.style.background = type === 'error'
      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
      : 'linear-gradient(135deg, #f472b6, #db2777)';
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('show'), 2500);
  }
};

// ===== 确认弹窗 =====
const Confirm = {
  show(title, msg, onOk) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    const modal = document.getElementById('modalConfirm');
    modal.classList.add('show');
    const okBtn = document.getElementById('btnConfirmOk');
    okBtn.onclick = () => {
      modal.classList.remove('show');
      onOk();
    };
  }
};

// ===== 图片处理 =====
const ImageTool = {
  compress(file, maxW=600, quality=0.75) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxW) { h = h * maxW / w; w = maxW; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
};

// ===== 主应用 =====
const App = {
  currentPage: 'dashboard',
  currentImage: '',

  init() {
    this.bindNav();
    this.bindSidebar();
    this.bindProduct();
    this.bindSale();
    this.bindDataIO();
    this.bindFilters();
    this.setDate();
    this.renderAll();
  },

  bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchPage(item.dataset.page);
      });
    });

    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchPage(el.dataset.nav);
      });
    });
  },

  switchPage(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item[data-page]').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    const titles = {
      dashboard: { title: '经营首页', sub: '今日经营概览' },
      purchase: { title: '进货档案', sub: '管理货品进货信息' },
      sales: { title: '多平台销售台账', sub: '记录各平台销售数据' },
      inventory: { title: '货品库存', sub: '实时库存监控' },
      analytics: { title: '经营数据分析', sub: '多维度数据洞察' }
    };
    const t = titles[page] || { title: '', sub: '' };
    document.getElementById('pageTitle').textContent = t.title;
    document.getElementById('pageSubtitle').textContent = t.sub;

    this.closeSidebar();
    this.renderPage(page);
  },

  bindSidebar() {
    document.getElementById('hamburger').addEventListener('click', () => this.openSidebar());
    document.getElementById('overlay').addEventListener('click', () => this.closeSidebar());
  },

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  },

  setDate() {
    const now = new Date();
    const week = ['日','一','二','三','四','五','六'][now.getDay()];
    document.getElementById('dateBadge').textContent = `${now.getMonth()+1}月${now.getDate()}日 · 周${week}`;
  },

  bindFilters() {
    document.querySelectorAll('#page-dashboard .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#page-dashboard .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderDashboard(btn.dataset.range);
      });
    });

    document.querySelectorAll('#page-analytics .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#page-analytics .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderAnalytics(btn.dataset.range);
      });
    });

    document.querySelectorAll('#page-sales .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#page-sales .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderSales(btn.dataset.platform);
      });
    });

    document.querySelectorAll('#page-inventory .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#page-inventory .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderInventory(btn.dataset.stock);
      });
    });

    document.getElementById('searchPurchase').addEventListener('input', (e) => this.renderProducts(e.target.value));
    document.getElementById('searchInventory').addEventListener('input', (e) => this.renderInventory(null, e.target.value));
  },

  bindDataIO() {
    document.getElementById('btnExport').addEventListener('click', () => DB.export());
    document.getElementById('importFile').addEventListener('change', (e) => {
      if (e.target.files[0]) DB.import(e.target.files[0]);
      e.target.value = '';
    });
  },

  renderAll() {
    this.renderPage(this.currentPage);
  },

  renderPage(page) {
    switch(page) {
      case 'dashboard': this.renderDashboard('today'); break;
      case 'purchase': this.renderProducts(); break;
      case 'sales': this.renderSales('all'); break;
      case 'inventory': this.renderInventory('all'); break;
      case 'analytics': this.renderAnalytics('today'); break;
    }
  },

  // ===== 经营首页 =====
  renderDashboard(range) {
    const stats = this.calcStats(range);
    document.getElementById('dashRevenue').textContent = Utils.fmt(stats.revenue);
    document.getElementById('dashCost').textContent = Utils.fmt(stats.cost);
    document.getElementById('dashProfit').textContent = Utils.fmt(stats.profit);
    document.getElementById('dashOrders').textContent = stats.orderCount;

    const profitEl = document.getElementById('dashProfit');
    profitEl.style.color = stats.profit >= 0 ? 'var(--green)' : 'var(--red)';

    document.getElementById('dashRevenueSub').textContent = stats.orderCount > 0 ? `${stats.orderCount}笔订单` : '暂无销售记录';
    document.getElementById('dashCostSub').textContent = stats.productCount > 0 ? `${stats.productCount}个货品` : '暂无进货记录';
    document.getElementById('dashProfitSub').textContent = stats.profit >= 0 ? '盈利中' : '亏损中';

    this.renderPlatformChart(range);
    this.renderRecentPurchase();
    this.renderRecentSales();
    this.renderStockAlert();
  },

  renderPlatformChart(range) {
    const container = document.getElementById('platformChart');
    const platforms = ['拼多多', '抖音', '淘宝', '其他'];
    const data = platforms.map(p => {
      const sales = store.sales.filter(s => s.platform === p && Utils.inRange(s.date, range));
      const revenue = sales.reduce((sum, s) => sum + Number(s.price) * Number(s.qty), 0);
      return { name: p, revenue, count: sales.length };
    });

    const maxRev = Math.max(...data.map(d => d.revenue), 1);

    if (data.every(d => d.revenue === 0)) {
      container.innerHTML = `<div class="empty-state">暂无销售数据</div>`;
      return;
    }

    const fillClass = { '拼多多': 'fill-pdd', '抖音': 'fill-dy', '淘宝': 'fill-tb', '其他': 'fill-other' };

    container.innerHTML = data.map(d => `
      <div class="platform-bar-item">
        <div class="platform-bar-header">
          <span class="platform-bar-name">${d.name} <span style="font-weight:400;color:var(--text-light);font-size:11px;">(${d.count}笔)</span></span>
          <span class="platform-bar-value">${Utils.fmt(d.revenue)}</span>
        </div>
        <div class="platform-bar-track">
          <div class="platform-bar-fill ${fillClass[d.name]}" style="width:${(d.revenue/maxRev*100).toFixed(1)}%"></div>
        </div>
      </div>
    `).join('');
  },

  renderRecentPurchase() {
    const container = document.getElementById('recentPurchase');
    const items = [...store.products].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0, 5);

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state">暂无进货记录</div>`;
      return;
    }

    container.innerHTML = items.map(p => `
      <div class="recent-item">
          <div class="inv-img-placeholder" style="width:32px;height:32px;">
            ${p.image ? `<img src="${p.image}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;">` : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/></svg>'}
          </div>
        <div class="recent-info">
          <div class="recent-name">${Utils.escape(p.name)}</div>
          <div class="recent-sub">${Utils.fmtDate(p.date)} · ${Utils.escape(p.stall||'未记录档口')}</div>
        </div>
        <div class="recent-value" style="color:var(--primary);">${Utils.fmt(Utils.unitCost(p) * (p.qty||1))}</div>
      </div>
    `).join('');
  },

  renderRecentSales() {
    const container = document.getElementById('recentSales');
    const items = [...store.sales].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0, 5);

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state">暂无销售记录</div>`;
      return;
    }

    const tagClass = { '拼多多': 'tag-pdd', '抖音': 'tag-dy', '淘宝': 'tag-tb', '其他': 'tag-other' };
    container.innerHTML = items.map(s => {
      const product = store.products.find(p => p.id === s.productId);
      const amt = Number(s.price) * Number(s.qty);
      return `
        <div class="recent-item">
          <div class="recent-info">
            <div class="recent-name">${Utils.escape(product?.name || '已删除货品')}</div>
            <div class="recent-sub">
              <span class="tag ${tagClass[s.platform]||'tag-other'}" style="font-size:10px;">${s.platform}</span>
              ${Utils.fmtDate(s.date)} · ${s.qty}件
            </div>
          </div>
          <div class="recent-value text-green">${Utils.fmt(amt)}</div>
        </div>
      `;
    }).join('');
  },

  renderStockAlert() {
    const container = document.getElementById('stockAlert');
    const items = store.products.map(p => {
      const sold = store.sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + Number(s.qty), 0);
      const stock = (Number(p.qty) || 0) - sold;
      return { ...p, stock, sold };
    }).filter(p => p.stock <= 3);

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state">库存充足，暂无预警</div>`;
      return;
    }

    container.innerHTML = items.map(p => {
      const cls = p.stock <= 0 ? 'text-red' : 'text-orange';
      const label = p.stock <= 0 ? '缺货' : `仅剩${p.stock}件`;
      return `
        <div class="recent-item">
          <div class="recent-info">
            <div class="recent-name">${Utils.escape(p.name)}</div>
            <div class="recent-sub">拿货${p.qty}件 · 已售${p.sold}件</div>
          </div>
          <div class="recent-value ${cls}">${label}</div>
        </div>
      `;
    }).join('');
  },

  // ===== 进货档案 =====
  renderProducts(search='') {
    const grid = document.getElementById('productGrid');
    let items = [...store.products].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        (p.name||'').toLowerCase().includes(q) ||
        (p.stall||'').toLowerCase().includes(q)
      );
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;" class="empty-state">
          <div style="font-size:36px;margin-bottom:8px;opacity:0.3;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          </div>
          <p style="font-size:14px;font-weight:700;">${search ? '未找到匹配的货品' : '还没有进货记录'}</p>
          <p style="font-size:12px;">${search ? '' : '点击右上角「新增货品」开始记录'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(p => {
      const sold = store.sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + Number(s.qty), 0);
      const stock = (Number(p.qty) || 0) - sold;
      const stockCls = stock <= 0 ? 'badge-out' : (stock <= 3 ? 'badge-low' : 'badge-in');
      const stockLabel = stock <= 0 ? '缺货' : `库存${stock}`;

      return `
        <div class="product-card">
          <div class="product-image">
            ${p.image
              ? `<img src="${p.image}" alt="${Utils.escape(p.name)}">`
              : `<span class="no-img"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg></span>`
            }
            <span class="product-badge ${stockCls}">${stockLabel}</span>
          </div>
          <div class="product-info">
            <div class="product-name">${Utils.escape(p.name)}</div>
            <div class="product-meta">
              <span>📅 ${Utils.fmtDate(p.date)}</span>
              <span>📍 ${Utils.escape(p.stall || '未记录')}</span>
            </div>
            <div class="product-meta">
              <span>拿货 ${p.qty}件 · 已售 ${sold}件</span>
            </div>
            <div class="product-cost">
              <div>
                <span class="cost-label">单件成本</span>
                <div class="cost-value">${Utils.fmt(Utils.unitCost(p))}</div>
              </div>
              <div style="text-align:right;">
                <span class="cost-label">总成本</span>
                <div style="font-size:13px;font-weight:800;color:var(--text);">${Utils.fmt(Utils.unitCost(p) * (p.qty||1))}</div>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <button class="btn-icon" onclick="App.editProduct('${p.id}')">✏️ 编辑</button>
            <button class="btn-icon danger" onclick="App.deleteProduct('${p.id}')">🗑️ 删除</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // ===== 货品弹窗 =====
  bindProduct() {
    document.getElementById('btnAddProduct').addEventListener('click', () => this.openProductModal());

    document.getElementById('imageUpload').addEventListener('click', () => {
      document.getElementById('productImage').click();
    });

    document.getElementById('productImage').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        Toast.show('图片不能超过10MB', 'error');
        return;
      }
      this.currentImage = await ImageTool.compress(file);
      const preview = document.getElementById('imagePreview');
      preview.innerHTML = `<img src="${this.currentImage}">`;
      preview.classList.add('has-img');
    });

    document.getElementById('btnSaveProduct').addEventListener('click', () => this.saveProduct());

    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => {
        el.closest('.modal').classList.remove('show');
      });
    });
    document.querySelectorAll('.modal-backdrop').forEach(el => {
      el.addEventListener('click', () => {
        el.closest('.modal').classList.remove('show');
      });
    });
  },

  openProductModal(id=null) {
    const modal = document.getElementById('modalProduct');
    const form = document.getElementById('formProduct');
    form.reset();
    this.currentImage = '';

    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `<span class="upload-icon">📷</span><span>点击上传图片</span>`;
    preview.classList.remove('has-img');

    if (id) {
      const p = store.products.find(x => x.id === id);
      if (!p) return;
      document.getElementById('modalProductTitle').textContent = '编辑货品';
      document.getElementById('productId').value = p.id;
      document.getElementById('productName').value = p.name || '';
      document.getElementById('productCost').value = p.cost || '';
      document.getElementById('productFreight').value = p.freight || 0;
      document.getElementById('productQty').value = p.qty || 1;
      document.getElementById('productDate').value = p.date || Utils.todayStr();
      document.getElementById('productStall').value = p.stall || '';
      document.getElementById('productNote').value = p.note || '';
      if (p.image) {
        this.currentImage = p.image;
        preview.innerHTML = `<img src="${p.image}">`;
        preview.classList.add('has-img');
      }
    } else {
      document.getElementById('modalProductTitle').textContent = '新增货品';
      document.getElementById('productId').value = '';
      document.getElementById('productDate').value = Utils.todayStr();
    }

    modal.classList.add('show');
  },

  editProduct(id) { this.openProductModal(id); },

  saveProduct() {
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const cost = parseFloat(document.getElementById('productCost').value) || 0;
    const freight = parseFloat(document.getElementById('productFreight').value) || 0;
    const qty = parseInt(document.getElementById('productQty').value) || 1;
    const date = document.getElementById('productDate').value;
    const stall = document.getElementById('productStall').value.trim();
    const note = document.getElementById('productNote').value.trim();

    if (!name) { Toast.show('请输入款式名称', 'error'); return; }
    if (cost <= 0) { Toast.show('请输入有效的拿货价', 'error'); return; }
    if (!date) { Toast.show('请选择拿货时间', 'error'); return; }

    if (id) {
      const p = store.products.find(x => x.id === id);
      if (p) {
        Object.assign(p, { name, cost, freight, qty, date, stall, note, image: this.currentImage || p.image, updatedAt: new Date().toISOString() });
      }
      Toast.show('货品已更新');
    } else {
      store.products.push({
        id: Utils.uid(), name, cost, freight, qty, date, stall, note,
        image: this.currentImage,
        createdAt: new Date().toISOString()
      });
      Toast.show('货品已添加');
    }

    DB.save();
    document.getElementById('modalProduct').classList.remove('show');
    this.renderProducts();
    this.renderDashboard('today');
  },

  deleteProduct(id) {
    const p = store.products.find(x => x.id === id);
    if (!p) return;
    const hasSales = store.sales.some(s => s.productId === id);
    Confirm.show('删除货品', `确定删除「${p.name}」吗？${hasSales ? '该货品有关联的销售记录，删除后销售记录将保留但显示为"已删除货品"。' : ''}`, () => {
      store.products = store.products.filter(x => x.id !== id);
      DB.save();
      this.renderProducts();
      Toast.show('货品已删除');
    });
  },

  // ===== 销售弹窗 =====
  bindSale() {
    document.getElementById('btnAddSale').addEventListener('click', () => this.openSaleModal());
    document.getElementById('btnSaveSale').addEventListener('click', () => this.saveSale());

    ['saleProduct', 'salePrice', 'saleQty'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateProfitPreview());
      document.getElementById(id).addEventListener('change', () => this.updateProfitPreview());
    });
  },

  openSaleModal(id=null) {
    if (store.products.length === 0) {
      Toast.show('请先添加进货货品', 'error');
      this.switchPage('purchase');
      return;
    }

    const modal = document.getElementById('modalSale');
    const form = document.getElementById('formSale');
    form.reset();
    document.getElementById('saleId').value = '';
    document.getElementById('saleDate').value = Utils.todayStr();
    document.getElementById('profitPreview').style.display = 'none';

    const sel = document.getElementById('saleProduct');
    sel.innerHTML = '<option value="">请选择货品</option>' +
      store.products.map(p => `<option value="${p.id}">${Utils.escape(p.name)} (成本${Utils.fmt(Utils.unitCost(p))})</option>`).join('');

    if (id) {
      const s = store.sales.find(x => x.id === id);
      if (!s) return;
      document.getElementById('saleId').value = s.id;
      document.getElementById('salePlatform').value = s.platform;
      document.getElementById('saleProduct').value = s.productId;
      document.getElementById('salePrice').value = s.price;
      document.getElementById('saleQty').value = s.qty;
      document.getElementById('saleDate').value = s.date;
      document.getElementById('saleNote').value = s.note || '';
      this.updateProfitPreview();
    }

    modal.classList.add('show');
  },

  updateProfitPreview() {
    const productId = document.getElementById('saleProduct').value;
    const price = parseFloat(document.getElementById('salePrice').value) || 0;
    const qty = parseInt(document.getElementById('saleQty').value) || 1;

    if (!productId || price <= 0) {
      document.getElementById('profitPreview').style.display = 'none';
      return;
    }

    const product = store.products.find(p => p.id === productId);
    if (!product) return;

    const unitCost = Utils.unitCost(product);
    const unitProfit = price - unitCost;
    const totalProfit = unitProfit * qty;

    document.getElementById('ppCost').textContent = Utils.fmt(unitCost);
    const ppUnit = document.getElementById('ppUnitProfit');
    const ppTotal = document.getElementById('ppTotalProfit');
    ppUnit.textContent = Utils.fmt(unitProfit);
    ppTotal.textContent = Utils.fmt(totalProfit);
    ppUnit.className = unitProfit >= 0 ? 'text-green' : 'text-red';
    ppTotal.className = totalProfit >= 0 ? 'text-green' : 'text-red';

    document.getElementById('profitPreview').style.display = 'block';
  },

  saveSale() {
    const id = document.getElementById('saleId').value;
    const platform = document.getElementById('salePlatform').value;
    const productId = document.getElementById('saleProduct').value;
    const price = parseFloat(document.getElementById('salePrice').value) || 0;
    const qty = parseInt(document.getElementById('saleQty').value) || 1;
    const date = document.getElementById('saleDate').value;
    const note = document.getElementById('saleNote').value.trim();

    if (!productId) { Toast.show('请选择货品', 'error'); return; }
    if (price <= 0) { Toast.show('请输入有效售价', 'error'); return; }
    if (!date) { Toast.show('请选择销售日期', 'error'); return; }

    const product = store.products.find(p => p.id === productId);
    if (product) {
      const sold = store.sales.filter(s => s.productId === productId && s.id !== id).reduce((sum, s) => sum + Number(s.qty), 0);
      const stock = (Number(product.qty) || 0) - sold;
      if (qty > stock) {
        Toast.show(`库存不足！当前库存仅剩 ${stock} 件`, 'error');
        return;
      }
    }

    if (id) {
      const s = store.sales.find(x => x.id === id);
      if (s) Object.assign(s, { platform, productId, price, qty, date, note, updatedAt: new Date().toISOString() });
      Toast.show('销售记录已更新');
    } else {
      store.sales.push({
        id: Utils.uid(), platform, productId, price, qty, date, note,
        createdAt: new Date().toISOString()
      });
      Toast.show('销售记录已添加');
    }

    DB.save();
    document.getElementById('modalSale').classList.remove('show');
    this.renderSales(document.querySelector('#page-sales .filter-btn.active')?.dataset.platform || 'all');
    this.renderDashboard('today');
  },

  // ===== 销售台账 =====
  renderSales(platformFilter='all') {
    const tbody = document.getElementById('salesTbody');
    let items = [...store.sales].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

    if (platformFilter !== 'all') {
      items = items.filter(s => s.platform === platformFilter);
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-light);">暂无销售记录</td></tr>`;
      return;
    }

    const tagClass = { '拼多多': 'tag-pdd', '抖音': 'tag-dy', '淘宝': 'tag-tb', '其他': 'tag-other' };

    tbody.innerHTML = items.map(s => {
      const product = store.products.find(p => p.id === s.productId);
      const unitCost = product ? Utils.unitCost(product) : 0;
      const unitProfit = Number(s.price) - unitCost;
      const totalProfit = unitProfit * Number(s.qty);
      const amount = Number(s.price) * Number(s.qty);

      return `
        <tr>
          <td>${Utils.fmtDate(s.date)}</td>
          <td><span class="tag ${tagClass[s.platform]||'tag-other'}">${s.platform}</span></td>
          <td>${Utils.escape(product?.name || '<span style="color:var(--text-light)">已删除</span>')}</td>
          <td>${Utils.fmt(s.price)}</td>
          <td>${s.qty}</td>
          <td style="font-weight:800;">${Utils.fmt(amount)}</td>
          <td class="${totalProfit >= 0 ? 'text-green' : 'text-red'}">${Utils.fmt(totalProfit)}</td>
          <td>
            <button class="btn-icon" style="padding:3px 8px;" onclick="App.openSaleModal('${s.id}')">编辑</button>
            <button class="btn-icon danger" style="padding:3px 8px;margin-left:3px;" onclick="App.deleteSale('${s.id}')">删除</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  deleteSale(id) {
    Confirm.show('删除销售记录', '确定删除这条销售记录吗？', () => {
      store.sales = store.sales.filter(s => s.id !== id);
      DB.save();
      this.renderSales(document.querySelector('#page-sales .filter-btn.active')?.dataset.platform || 'all');
      Toast.show('销售记录已删除');
    });
  },

  // ===== 库存 =====
  renderInventory(stockFilter='all', search='') {
    const tbody = document.getElementById('inventoryTbody');
    let items = store.products.map(p => {
      const sold = store.sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + Number(s.qty), 0);
      const stock = (Number(p.qty) || 0) - sold;
      return { ...p, stock, sold };
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p => (p.name||'').toLowerCase().includes(q));
    }

    if (stockFilter === 'in') items = items.filter(p => p.stock > 3);
    else if (stockFilter === 'low') items = items.filter(p => p.stock > 0 && p.stock <= 3);
    else if (stockFilter === 'out') items = items.filter(p => p.stock <= 0);

    items.sort((a,b) => a.stock - b.stock);

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-light);">暂无库存数据</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(p => {
      const status = p.stock <= 0
        ? '<span class="tag" style="background:var(--red-bg);color:var(--red);">缺货</span>'
        : p.stock <= 3
          ? '<span class="tag" style="background:var(--orange-bg);color:var(--orange);">不足</span>'
          : '<span class="tag" style="background:var(--green-bg);color:var(--green);">充足</span>';

      return `
        <tr>
          <td>${p.image
            ? `<img src="${p.image}" class="inv-img">`
            : `<div class="inv-img-placeholder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/></svg></div>`
          }</td>
          <td style="font-weight:700;">${Utils.escape(p.name)}</td>
          <td style="font-weight:700;color:var(--primary);">${Utils.fmt(Utils.unitCost(p))}</td>
          <td>${p.qty}</td>
          <td>${p.sold}</td>
          <td style="font-weight:800;font-size:14px;">${p.stock}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join('');
  },

  // ===== 数据统计 =====
  calcStats(range) {
    const salesInRange = store.sales.filter(s => Utils.inRange(s.date, range));
    const revenue = salesInRange.reduce((sum, s) => sum + Number(s.price) * Number(s.qty), 0);
    const productsInRange = store.products.filter(p => Utils.inRange(p.date, range));
    const cost = productsInRange.reduce((sum, p) => sum + Utils.unitCost(p) * (Number(p.qty)||1), 0);
    const orderCount = salesInRange.length;
    const productCount = productsInRange.length;

    const soldCost = salesInRange.reduce((sum, s) => {
      const product = store.products.find(p => p.id === s.productId);
      return sum + (product ? Utils.unitCost(product) * Number(s.qty) : 0);
    }, 0);
    const profit = revenue - soldCost;

    return { revenue, cost, profit, orderCount, productCount };
  },

  renderAnalytics(range) {
    const stats = this.calcStats(range);
    document.getElementById('anaRevenue').textContent = Utils.fmt(stats.revenue);
    document.getElementById('anaCost').textContent = Utils.fmt(stats.cost);
    document.getElementById('anaProfit').textContent = Utils.fmt(stats.profit);
    const margin = stats.revenue > 0 ? (stats.profit / stats.revenue * 100) : 0;
    document.getElementById('anaMargin').textContent = margin.toFixed(1) + '%';

    const profitEl = document.getElementById('anaProfit');
    profitEl.style.color = stats.profit >= 0 ? 'var(--green)' : 'var(--red)';
    const marginEl = document.getElementById('anaMargin');
    marginEl.style.color = margin >= 0 ? 'var(--green)' : 'var(--red)';

    this.renderAnaPlatformChart(range);
    this.renderAnaPlatformTable(range);
    this.renderAnaProductRank(range);
    this.renderAnaTrend(range);
  },

  renderAnaPlatformChart(range) {
    const container = document.getElementById('anaPlatformChart');
    const platforms = ['拼多多', '抖音', '淘宝', '其他'];
    const data = platforms.map(p => {
      const sales = store.sales.filter(s => s.platform === p && Utils.inRange(s.date, range));
      const revenue = sales.reduce((sum, s) => sum + Number(s.price) * Number(s.qty), 0);
      const cost = sales.reduce((sum, s) => {
        const product = store.products.find(pr => pr.id === s.productId);
        return sum + (product ? Utils.unitCost(product) * Number(s.qty) : 0);
      }, 0);
      return { name: p, revenue, cost, profit: revenue - cost, count: sales.length };
    });

    const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.cost]), 1);
    const fillClass = { '拼多多': 'fill-pdd', '抖音': 'fill-dy', '淘宝': 'fill-tb', '其他': 'fill-other' };

    if (data.every(d => d.revenue === 0 && d.cost === 0)) {
      container.innerHTML = `<div class="empty-state">暂无数据</div>`;
      return;
    }

    container.innerHTML = data.map(d => `
      <div class="platform-bar-item">
        <div class="platform-bar-header">
          <span class="platform-bar-name">${d.name} <span style="font-weight:400;color:var(--text-light);font-size:11px;">(${d.count}笔)</span></span>
          <span class="platform-bar-value">营收${Utils.fmt(d.revenue)} · 利润<span style="color:${d.profit>=0?'var(--green)':'var(--red)'}">${Utils.fmt(d.profit)}</span></span>
        </div>
        <div style="display:flex;gap:2px;">
          <div class="platform-bar-track" style="flex:1;">
            <div class="platform-bar-fill ${fillClass[d.name]}" style="width:${(d.revenue/maxVal*100).toFixed(1)}%"></div>
          </div>
          <div class="platform-bar-track" style="flex:1;">
            <div class="platform-bar-fill" style="width:${(d.cost/maxVal*100).toFixed(1)}%;background:linear-gradient(90deg,#fbbf24,#d97706);"></div>
          </div>
        </div>
      </div>
    `).join('') + `<div style="font-size:10px;color:var(--text-light);margin-top:6px;">左条=营收 · 右条=成本（橙色）</div>`;
  },

  renderAnaPlatformTable(range) {
    const container = document.getElementById('anaPlatformTable');
    const platforms = ['拼多多', '抖音', '淘宝', '其他'];
    const data = platforms.map(p => {
      const sales = store.sales.filter(s => s.platform === p && Utils.inRange(s.date, range));
      const revenue = sales.reduce((sum, s) => sum + Number(s.price) * Number(s.qty), 0);
      const soldQty = sales.reduce((sum, s) => sum + Number(s.qty), 0);
      const cost = sales.reduce((sum, s) => {
        const product = store.products.find(pr => pr.id === s.productId);
        return sum + (product ? Utils.unitCost(product) * Number(s.qty) : 0);
      }, 0);
      return { name: p, revenue, cost, profit: revenue - cost, count: sales.length, soldQty };
    }).filter(d => d.count > 0);

    if (data.length === 0) {
      container.innerHTML = `<div class="empty-state">暂无销售数据</div>`;
      return;
    }

    container.innerHTML = `
      <table class="data-table" style="min-width:auto;">
        <thead>
          <tr><th>平台</th><th>订单</th><th>件数</th><th>营收</th><th>成本</th><th>毛利</th></tr>
        </thead>
        <tbody>
          ${data.map(d => `
            <tr>
              <td><span class="tag ${d.name==='拼多多'?'tag-pdd':d.name==='抖音'?'tag-dy':d.name==='淘宝'?'tag-tb':'tag-other'}">${d.name}</span></td>
              <td>${d.count}</td>
              <td>${d.soldQty}</td>
              <td style="font-weight:700;">${Utils.fmt(d.revenue)}</td>
              <td style="color:var(--orange);">${Utils.fmt(d.cost)}</td>
              <td class="${d.profit>=0?'text-green':'text-red'}" style="font-weight:800;">${Utils.fmt(d.profit)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderAnaProductRank(range) {
    const container = document.getElementById('anaProductRank');
    const productMap = {};

    store.sales.filter(s => Utils.inRange(s.date, range)).forEach(s => {
      if (!productMap[s.productId]) {
        const product = store.products.find(p => p.id === s.productId);
        productMap[s.productId] = { name: product?.name || '已删除货品', revenue: 0, cost: 0, qty: 0 };
      }
      const product = store.products.find(p => p.id === s.productId);
      const unitCost = product ? Utils.unitCost(product) : 0;
      productMap[s.productId].revenue += Number(s.price) * Number(s.qty);
      productMap[s.productId].cost += unitCost * Number(s.qty);
      productMap[s.productId].qty += Number(s.qty);
    });

    const items = Object.values(productMap).map(d => ({
      ...d, profit: d.revenue - d.cost
    })).sort((a,b) => b.profit - a.profit).slice(0, 10);

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state">暂无数据</div>`;
      return;
    }

    container.innerHTML = items.map((d, i) => `
      <div class="rank-item">
        <div class="rank-num">${i+1}</div>
        <div class="rank-name">${Utils.escape(d.name)} <span style="color:var(--text-light);font-size:11px;">(${d.qty}件)</span></div>
        <div class="rank-value">${Utils.fmt(d.profit)}</div>
      </div>
    `).join('');
  },

  renderAnaTrend(range) {
    const container = document.getElementById('anaTrendChart');
    const days = range === 'today' ? 7 : (range === 'month' ? 30 : 30);
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const revenue = store.sales
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + Number(s.price) * Number(s.qty), 0);
      data.push({ date: dateStr, revenue, label: `${d.getMonth()+1}/${d.getDate()}` });
    }

    const maxRev = Math.max(...data.map(d => d.revenue), 1);

    if (data.every(d => d.revenue === 0)) {
      container.innerHTML = `<div class="empty-state">暂无销售数据</div>`;
      return;
    }

    container.innerHTML = `
      <div class="trend-chart">
        ${data.map(d => `
          <div class="trend-bar">
            <div class="trend-bar-fill" style="height:${Math.max(d.revenue/maxRev*100, 2).toFixed(1)}%;" data-val="${Utils.fmt(d.revenue)}"></div>
            <div class="trend-bar-label">${d.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => App.init());
