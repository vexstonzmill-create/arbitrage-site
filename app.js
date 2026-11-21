document.addEventListener('contextmenu', e => { 
  if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault(); 
});

window.addEventListener('error', (e) => {
  console.error('VEXO CRASH:', e.message, 'at', e.filename, ':', e.lineno);
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) {
        loader.classList.add('hidden-loader');
        loader.style.display = 'none';
      }
      
      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if(['dialogOverlay', 'receiptViewModal', 'orderModal', 'chatModal', 'requestDetailModal', 'assignRequisiteModal'].includes(overlay.id)) return;
        const modal = overlay.querySelector('.modal');
        if (modal && !modal.querySelector('.global-back-btn')) {
          const btn = document.createElement('button');
          btn.className = 'global-back-btn';
          btn.innerHTML = '←';
          btn.onclick = () => overlay.classList.remove('active');
          modal.style.position = 'relative';
          btn.style.cssText = 'position:absolute;top:16px;left:16px;width:36px;height:36px;border-radius:50%;background:var(--btn-bg);border:1px solid var(--card-border);color:var(--txt);font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;';
          modal.appendChild(btn);
        }
      });
    }, 800);

    const PAY_ICONS = {
      'СБП': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><rect width="12" height="12" fill="#5B57A7"/><rect x="12" width="12" height="12" fill="#EE2D2A"/><rect y="12" width="12" height="12" fill="#1C9F6E"/><rect x="12" y="12" width="12" height="12" fill="#FFB800"/></svg>`,
      'Тинькофф': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><rect width="24" height="24" fill="#FFDD2D"/><text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="900" fill="#000" font-family="Arial, Helvetica, sans-serif">Т</text></svg>`,
      'Сбербанк': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><rect width="24" height="24" fill="#21A038"/><text x="12" y="17.5" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif">С</text></svg>`,
      'Альфа-Банк': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><rect width="24" height="24" fill="#EF3124"/><text x="12" y="17.5" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif">А</text></svg>`,
      'ВТБ': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><rect width="24" height="24" fill="#0A2896"/><text x="12" y="17" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif">ВТБ</text></svg>`,
      'Райффайзен': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><rect width="24" height="24" fill="#FEE600"/><text x="12" y="17.5" text-anchor="middle" font-size="13" font-weight="900" fill="#000" font-family="Arial, Helvetica, sans-serif">R</text></svg>`,
      'USDT': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><circle cx="12" cy="12" r="12" fill="#26A17B"/><text x="12" y="18" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif">₮</text></svg>`,
      'BTC': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><circle cx="12" cy="12" r="12" fill="#F7931A"/><text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif">₿</text></svg>`,
      'TON': `<svg viewBox="0 0 24 24" width="20" height="20" style="flex-shrink:0; border-radius:50%; overflow:hidden; display:block;"><circle cx="12" cy="12" r="12" fill="#0098EA"/><text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif">T</text></svg>`
    };
    
    const getPayIcon = (name) => {
      if (!name) return '';
      if (name.includes('USDT')) return PAY_ICONS['USDT'];
      if (name.includes('BTC')) return PAY_ICONS['BTC'];
      if (name.includes('TON')) return PAY_ICONS['TON'];
      if (name.includes('СБП')) return PAY_ICONS['СБП'];
      if (name.includes('Тинькофф')) return PAY_ICONS['Тинькофф'];
      if (name.includes('Сбер')) return PAY_ICONS['Сбербанк'];
      if (name.includes('Альфа')) return PAY_ICONS['Альфа-Банк'];
      if (name.includes('ВТБ')) return PAY_ICONS['ВТБ'];
      if (name.includes('Райф')) return PAY_ICONS['Райффайзен'];
      return '';
    };

    const API = {
      token: () => localStorage.getItem('vexo_token'),
      user: () => { try { return JSON.parse(localStorage.getItem('vexo_user')); } catch { return null; } },
      async req(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token()) headers.Authorization = 'Bearer ' + this.token();
        const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          localStorage.removeItem('vexo_token');
          localStorage.removeItem('vexo_user');
          window.location.reload();
        }
        if (!res.ok) { const e = new Error(data.error || 'error'); e.code = data.error; e.status = res.status; throw e; }
        return data;
      }
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    async function initTelegramAuth() {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        const tg = window.Telegram.WebApp;
        document.body.classList.add('tg-fullscreen');
        try { tg.ready(); } catch(e) {}
        try { tg.expand(); } catch(e) {}
        try { if (tg.requestFullscreen) tg.requestFullscreen(); } catch(e) { console.log('FS err', e); }
        try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch(e) {}
        try { tg.setHeaderColor('#09090b'); } catch(e) {}
        try { tg.setBackgroundColor('#09090b'); } catch(e) {}

        const initData = tg.initData;
        if (API.token()) return; 

        try {
          const res = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
          });
          
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('vexo_token', data.token);
            localStorage.setItem('vexo_user', JSON.stringify(data.user));
            updateAuthUI();
            loadHomeDashboard();
            screenCache.profile = false; screenCache.wallet = false;
            toast('Вход через Telegram выполнен!', 'success');
          }
        } catch(e) { console.error('TG Auth Error:', e); }
      }
    }

    function initDeepLink() {
      const urlParams = new URLSearchParams(window.location.search);
      const targetScreen = urlParams.get('screen');
      if (targetScreen) setTimeout(() => show(targetScreen), 300);
    }

    initTelegramAuth();
    initDeepLink();

    const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n || 0);
    const fmtDec = (n, d = 2) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

    const ICONS = {
      pro: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      merchant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
      maker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`
    };

    function toast(msg, type = 'info') {
      try {
        const c = document.getElementById('toastContainer');
        if (!c) return;
        const existing = Array.from(c.children).find(el => el.textContent === msg);
        if (existing) return;
        if (c.children.length >= 2) c.removeChild(c.firstElementChild);
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = msg;
        c.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, 3000);
      } catch(e) { console.error(e); }
    }
    window.toast = toast;

    function confirmAsync(title, message, okText = 'OK') {
      return new Promise(resolve => {
        const overlay = document.getElementById('dialogOverlay');
        const content = document.getElementById('dialogContent');
        if (!overlay || !content) return resolve(false);
        content.innerHTML = `<h3 style="font-size:18px;font-weight:800;color:var(--txt)">${title}</h3><p style="font-size:15px;color:var(--dim);margin:10px 0;font-weight:500;">${message}</p><div style="display:flex;gap:12px;margin-top:16px"><button class="btn btn-ghost" style="flex:1;border:1px solid var(--glass-border);height:44px;font-size:14px;" id="dlgCancel">Отмена</button><button class="btn btn-primary" style="flex:1;height:44px;font-size:14px;" id="dlgOk">${okText}</button></div>`;
        overlay.classList.add('active');
        document.getElementById('dlgCancel').onclick = () => { overlay.classList.remove('active'); resolve(false); };
        document.getElementById('dlgOk').onclick = () => { overlay.classList.remove('active'); resolve(true); };
      });
    }

    function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('active'); }
    window.closeModal = closeModal;

    window.toggleSidebar = function(open) {
      const sidebar = document.querySelector('.sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (open) { sidebar.classList.add('mobile-open'); backdrop.classList.add('active'); }
      else { sidebar.classList.remove('mobile-open'); backdrop.classList.remove('active'); }
    };
    document.getElementById('menuBtn')?.addEventListener('click', () => toggleSidebar(true));

    function initBannerCarousel() {
      const viewport = document.getElementById('bannerViewport');
      const dots = document.querySelectorAll('.banner-dot');
      const banners = document.querySelectorAll('.banner');
      if (!viewport || !dots.length || !banners.length) return;
      viewport.addEventListener('scroll', () => {
        const scrollLeft = viewport.scrollLeft;
        const bannerWidth = banners[0].offsetWidth + 12;
        const index = Math.round(scrollLeft / bannerWidth);
        dots.forEach((dot, i) => { dot.classList.toggle('active', i === index); });
      });
      dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
          const bannerWidth = banners[0].offsetWidth + 12;
          viewport.scrollTo({ left: index * bannerWidth, behavior: 'smooth' });
        });
      });
    }

    async function loadHomeRate() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub');
        const data = await res.json();
        if (data && data.tether && data.tether.rub) {
          const el = document.getElementById('homeUsdtRate');
          if (el) el.textContent = fmtDec(data.tether.rub, 2) + ' ₽';
        }
      } catch(e) {
        const el = document.getElementById('homeUsdtRate');
        if (el) el.textContent = '90.00 ₽'; 
      }
    }

    async function loadHomeDashboard() {
      const u = API.user();
      if (!u) {
        document.getElementById('topbarName').textContent = 'Гость';
        document.getElementById('greetingText').textContent = 'Добро пожаловать!';
        document.getElementById('homeBalanceValue').textContent = '0.00 ₽';
        document.getElementById('homeUserName').textContent = 'Авторизуйтесь';
        document.getElementById('homeDealsCount').textContent = '0 сделок';
        document.getElementById('homeRating').textContent = '—';
        document.getElementById('homeAvatarLetter').textContent = '?';
        document.getElementById('homeAvatar').style.display = 'none';
        return;
      }
      
      try {
        const { user, stats } = await API.req('GET', '/users/me');
        localStorage.setItem('vexo_user', JSON.stringify(user));
        
        document.getElementById('topbarName').textContent = user.displayName || user.username;
        document.getElementById('greetingText').textContent = 'Готовы к работе!';
        
        let usdtRate = 90;
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub');
          const rdata = await res.json();
          if (rdata && rdata.tether && rdata.tether.rub) usdtRate = rdata.tether.rub;
        } catch(e) {}
        
        const totalBal = user.balanceRub + (user.balanceUsdt * usdtRate);
        document.getElementById('homeBalanceValue').textContent = fmtDec(totalBal, 2) + ' ₽';
        document.getElementById('homeUserName').textContent = user.displayName || user.username;
        document.getElementById('homeDealsCount').textContent = stats.dealsTotal + ' сделок';
        document.getElementById('homeRating').textContent = stats.ratingAvg || '0';
        
        const avImg = document.getElementById('homeAvatar');
        const avLet = document.getElementById('homeAvatarLetter');
        if (user.avatarUrl) {
          avImg.src = user.avatarUrl;
          avImg.style.display = 'block';
          avLet.style.display = 'none';
        } else {
          avImg.style.display = 'none';
          avLet.style.display = 'block';
          avLet.textContent = (user.displayName || user.username || '?')[0].toUpperCase();
        }
      } catch(e) { console.error('Dashboard load error', e); }
    }

    let notifications = JSON.parse(localStorage.getItem('vexo_notifs')) || [];
    notifications = notifications.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);

    function addNotification(text, type = 'info') {
      const now = Date.now();
      const isDuplicate = notifications.some(n => n.text === text && (now - new Date(n.date).getTime() < 3000));
      if (isDuplicate) return;
      notifications.unshift({ id: now, text, type, date: new Date().toISOString() });
      if (notifications.length > 20) notifications.pop();
      localStorage.setItem('vexo_notifs', JSON.stringify(notifications));
      updateNotifUI();
    }
    
    window.clearNotifications = () => {
      notifications = [];
      localStorage.setItem('vexo_notifs', JSON.stringify([]));
      updateNotifUI();
    };

    function updateNotifUI() {
      const dot = document.getElementById('notifDot');
      const list = document.getElementById('notificationsList');
      if (dot) dot.classList.toggle('hidden', notifications.length === 0);
      if (list) {
        list.innerHTML = notifications.length ? notifications.map(n => `
          <div class="notif-item ${n.type || 'info'}">
            <div class="notif-date">${new Date(n.date).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</div>
            <div class="notif-text">${n.text}</div>
          </div>
        `).join('') : '<div class="empty-state">Нет новых уведомлений</div>';
      }
    }

    document.getElementById('notifBtn')?.addEventListener('click', () => {
      document.getElementById('notificationsModal').classList.add('active');
      updateNotifUI();
    });

    let previousScreen = 'home';
    const screenCache = {};

    function initCreateScreen() {
      const u = API.user();
      if (!u) return;
      const isStaff = ['admin', 'owner', 'deputy'].includes(u.role);
      const canBuy = isStaff || u.isMaker || u.isMerchant;
      const sellBtn = document.querySelector('#f-side .seg-btn[data-val="sell"]');
      const buyBtn  = document.querySelector('#f-side .seg-btn[data-val="buy"]');
      if (!sellBtn || !buyBtn) return;
      
      if (!sellBtn.dataset.origText) sellBtn.dataset.origText = sellBtn.textContent;
      if (!buyBtn.dataset.origText) buyBtn.dataset.origText = buyBtn.textContent;

      if (!canBuy) {
        buyBtn.disabled = true;
        buyBtn.style.opacity = '0.4';
        buyBtn.style.cursor = 'not-allowed';
        if (buyBtn.classList.contains('active')) {
          buyBtn.classList.remove('active');
          sellBtn.classList.add('active');
        }
      } else {
        buyBtn.disabled = false;
        buyBtn.style.opacity = '1';
        buyBtn.style.cursor = '';
      }

      const priceEl = document.getElementById('f-price');
      if (priceEl && !window._marketRateLoaded) {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub')
          .then(r => r.json())
          .then(d => {
            const rate = d?.tether?.rub;
            if (rate) {
              priceEl.placeholder = rate.toFixed(2);
              window._marketRateLoaded = true;
            }
          }).catch(() => {});
      }

      const amountEl = document.getElementById('f-amount');
      const minEl = document.getElementById('f-min');
      const maxEl = document.getElementById('f-max');

      if (priceEl && amountEl && minEl && maxEl && !priceEl.dataset.limitsBound) {
        priceEl.dataset.limitsBound = '1';
        const recalcLimits = () => {
          const price = parseFloat(priceEl.value) || 0;
          const amount = parseFloat(amountEl.value) || 0;
          if (price > 0 && amount > 0) {
            const total = Math.floor(price * amount);
            const minTotal = Math.max(100, Math.floor(total * 0.1));
            minEl.value = minTotal;
            maxEl.value = total;
            minEl.placeholder = minTotal;
            maxEl.placeholder = total;
          }
        };
        priceEl.addEventListener('input', recalcLimits);
        amountEl.addEventListener('input', recalcLimits);
      }
    }

    function show(name) {
      if (window.orderPollInterval) clearInterval(window.orderPollInterval);
      if (window.orderTimerInterval) clearInterval(window.orderTimerInterval);
      toggleSidebar(false);
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const target = document.getElementById('screen-' + name);
      if (target) target.classList.add('active');
      document.querySelectorAll('.nav-btn, .bn-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-screen="${name}"]`).forEach(b => b.classList.add('active'));
      
      try {
        if (name === 'market') { 
          if (!screenCache.market) { loadMarket(); screenCache.market = true; }
          document.querySelector('.mode-btn[data-mode="p2p"]')?.click();
        }
        if (name === 'profile' && !screenCache.profile) { loadProfile(); screenCache.profile = true; }
        if (name === 'home') { loadHomeRate(); loadHomeDashboard(); initBannerCarousel(); }
        if (name === 'wallet') { loadWallet(); screenCache.wallet = true; }
        if (name === 'admin') { loadAdmin(); } 
        if (name === 'create') { initCreateScreen(); }
      } catch(e) { console.error('show error:', e); }
      window.scrollTo(0, 0);
    }
    window.show = show;

    document.querySelectorAll('[data-screen]').forEach(b => {
      b.onclick = e => {
        e.preventDefault();
        const s = b.dataset.screen;
        if (!['order', 'admin'].includes(s)) previousScreen = s;
        show(s);
      };
    });

    let currentTheme = localStorage.getItem('vexo_theme') || 'dark';
    function applyTheme(theme) {
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('vexo_theme', theme);
    }
    applyTheme(currentTheme);

    document.getElementById('themeBtn')?.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(currentTheme);
      toast('Тема: ' + (currentTheme === 'dark' ? 'Тёмная' : 'Светлая'), 'info');
    });

    document.querySelectorAll('.mm-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.mm-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.mtab;
        document.querySelectorAll('.market-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('mtab-' + target).classList.add('active');
        if (target === 'ads') loadMyAds();
        if (target === 'orders') loadOrders('active');
      };
    });

    let authMode = 'login';
    function setAuthMode(mode) {
      authMode = mode;
      document.getElementById('tabLogin')?.classList.toggle('active', mode === 'login');
      document.getElementById('tabRegister')?.classList.toggle('active', mode === 'register');
      document.getElementById('emailField')?.classList.toggle('hidden', mode !== 'register');
      const l = document.getElementById('loginLabel');
      if (l) l.textContent = mode === 'register' ? 'Никнейм' : 'Логин или Email';
      const b = document.getElementById('authSubmit');
      if (b) b.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
      const er = document.getElementById('authError');
      if (er) er.textContent = '';
    }

    document.getElementById('tabLogin')?.addEventListener('click', () => setAuthMode('login'));
    document.getElementById('tabRegister')?.addEventListener('click', () => setAuthMode('register'));
    document.getElementById('loginBtn')?.addEventListener('click', () => { setAuthMode('login'); document.getElementById('authModal')?.classList.add('active'); });
    document.getElementById('avatarBtn')?.addEventListener('click', () => show('profile'));

    document.getElementById('authForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('authError');
      const btn = document.getElementById('authSubmit');
      if (errEl) errEl.textContent = '';
      if (btn) { btn.disabled = true; btn.textContent = '...'; }
      try {
        const body = { password: document.getElementById('authPass')?.value || '' };
        let path;
        if (authMode === 'login') { path = '/auth/login'; body.login = document.getElementById('authLogin')?.value || ''; }
        else { path = '/auth/register'; body.username = document.getElementById('authLogin')?.value || ''; body.email = document.getElementById('authEmail')?.value || ''; }
        const data = await API.req('POST', path, body);
        localStorage.setItem('vexo_token', data.token);
        localStorage.setItem('vexo_user', JSON.stringify(data.user));
        closeModal('authModal'); updateAuthUI(); loadHomeDashboard();
        toast(authMode === 'login' ? 'Добро пожаловать!' : 'Аккаунт создан!', 'success');
        screenCache.profile = false; 
        show('market');
      } catch (err) {
        const map = { invalid_credentials: 'Неверный логин или пароль', user_exists: 'Никнейм занят', email_exists: 'Email занят', short_password: 'Пароль мин. 8 символов' };
        if (errEl) errEl.textContent = map[err.code] || err.message;
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = authMode === 'login' ? 'Войти' : 'Зарегистрироваться'; }
      }
    });

    function updateAuthUI() {
      const u = API.user();
      const lb = document.getElementById('loginBtn');
      const ab = document.getElementById('avatarBtn');
      const isStaff = u && ['admin', 'owner', 'deputy'].includes(u.role);
      const admNav = document.getElementById('adminNavBtn');
      const admBn = document.getElementById('adminBnBtn');

      if (u) {
        if (lb) lb.style.display = 'none'; 
        if (ab) {
          ab.classList.remove('hidden');
          ab.style.background = 'var(--primary)'; ab.style.color = '#fff'; ab.style.width = '32px'; ab.style.height = '32px';
          ab.style.borderRadius = '50%'; ab.style.display = 'flex'; ab.style.alignItems = 'center'; ab.style.justifyContent = 'center';
          ab.style.fontWeight = '800'; ab.style.fontSize = '14px';
          if (u.avatarUrl) { ab.innerHTML = `<img src="${u.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'; this.parentElement.innerHTML='${(u.displayName || u.username || '?')[0].toUpperCase()}';">`; }
          else { ab.innerHTML = (u.displayName || u.username || '?')[0].toUpperCase(); }
        }
        if (isStaff) {
          if (admNav) admNav.style.display = 'block';
          if (admBn) admBn.style.display = 'flex';
        } else {
          if (admNav) admNav.style.display = 'none';
          if (admBn) admBn.style.display = 'none';
        }
      } else {
        if (lb) lb.style.display = 'inline-flex'; 
        if (ab) ab.classList.add('hidden');
        if (admNav) admNav.style.display = 'none';
        if (admBn) admBn.style.display = 'none';
      }
    }

    async function loadWallet() {
      const u = API.user();
      const screen = document.getElementById('screen-wallet');
      if (!u) {
        screen.innerHTML = `<div class="empty-state" style="margin-top:20px;"><div style="font-size:30px;margin-bottom:10px;">🔒</div>Войдите в аккаунт.<br><br><button class="btn btn-primary btn-sm" onclick="document.getElementById('authModal').classList.add('active')">Войти</button></div>`;
      } else {
        screen.innerHTML = '<div class="empty-state">Загрузка...</div>';
        let usdtRate = 90;
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub');
          const data = await res.json();
          if (data && data.tether && data.tether.rub) usdtRate = data.tether.rub;
        } catch(e) {}

        API.req('GET', '/users/me').then(data => {
          localStorage.setItem('vexo_user', JSON.stringify(data.user));
          const freshUser = data.user;
          const estimatedRub = freshUser.balanceUsdt * usdtRate;
          const totalBalanceRub = freshUser.balanceRub + estimatedRub; 

          screen.innerHTML = `
            <h2 style="margin-bottom: 6px; font-size: 22px; font-weight: 800;">Кошелёк</h2>
            <p style="color: var(--dim); font-size: 13px; margin-bottom: 16px;">Балансы и история</p>
            <div class="glass-card" style="padding: 24px; text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border: none; color: #fff;">
              <div style="font-size: 13px; opacity: 0.8; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Общий баланс</div>
              <div style="font-size: 38px; font-weight: 900; margin-bottom: 20px;">${fmtDec(totalBalanceRub, 2)} <span>₽</span></div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm" id="btnDeposit" style="flex:1; background: rgba(255,255,255,0.2); border: none; color: #fff; backdrop-filter: blur(10px);">Пополнить</button>
                <button class="btn btn-sm" id="btnWithdraw" style="flex:1; background: rgba(255,255,255,0.2); border: none; color: #fff; backdrop-filter: blur(10px);">Вывести</button>
              </div>
            </div>
            <h3 style="margin-top: 16px; font-size: 16px; margin-bottom: 12px; font-weight: 800;">Активы</h3>
            <div class="wallet-list">
              <div class="wallet-item">
                <div class="coin-icon rub">₽</div>
                <div class="w-info"><div class="w-name" style="font-weight:700; font-size:15px;">Российский рубль</div><div class="w-sub" style="font-size:12px;color:var(--dim);">RUB · фиат</div></div>
                <div class="w-bal" style="margin-left:auto; font-weight:800; font-size:16px;">${fmtDec(freshUser.balanceRub, 2)} ₽</div>
              </div>
              <div class="wallet-item">
                <div class="coin-icon usdt">₮</div>
                <div class="w-info"><div class="w-name" style="font-weight:700; font-size:15px;">Tether</div><div class="w-sub" style="font-size:12px;color:var(--dim);">USDT · TRC-20</div></div>
                <div class="w-bal" style="margin-left:auto; font-weight:800; font-size:16px;">${fmtDec(freshUser.balanceUsdt, 2)} <span style="font-size:12px;color:var(--dim);">≈ ${fmtDec(estimatedRub, 2)} ₽</span></div>
              </div>
            </div>`;
            
          document.getElementById('btnDeposit').onclick = () => { 
            walletActionType = 'deposit'; 
            document.getElementById('walletActionTitle').textContent = 'Пополнение'; 
            document.querySelectorAll('#walletAssetSelect .seg-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('#walletAssetSelect .seg-btn[data-val="RUB"]').classList.add('active');
            document.getElementById('walletActionModal').classList.add('active'); 
            toggleWalletFields();
          };
          document.getElementById('btnWithdraw').onclick = () => { 
            walletActionType = 'withdraw'; 
            document.getElementById('walletActionTitle').textContent = 'Вывод'; 
            document.querySelectorAll('#walletAssetSelect .seg-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('#walletAssetSelect .seg-btn[data-val="RUB"]').classList.add('active');
            document.getElementById('walletActionModal').classList.add('active'); 
            toggleWalletFields();
          };
        });
      }
    }

    document.querySelectorAll('#walletAssetSelect .seg-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#walletAssetSelect .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        toggleWalletFields();
      };
    });

    function toggleWalletFields() {
      const currency = document.querySelector('#walletAssetSelect .seg-btn.active').dataset.val;
      const bankGroup = document.getElementById('walletBankGroup');
      const usdtFields = document.getElementById('usdtWithdrawFields');
      if (currency === 'RUB') { bankGroup.style.display = 'block'; usdtFields.style.display = 'none'; }
      else { bankGroup.style.display = 'none'; usdtFields.style.display = 'block'; }
    }

    let walletActionType = 'deposit';
    document.getElementById('walletActionSubmit')?.addEventListener('click', async () => {
      const u = API.user();
      if (!u) { closeModal('walletActionModal'); document.getElementById('authModal')?.classList.add('active'); return; }
      
      const amount = document.getElementById('walletActionAmount')?.value;
      const tg = document.getElementById('walletActionTg')?.value.trim();
      const currency = document.querySelector('#walletAssetSelect .seg-btn.active').dataset.val;
      
      if (!amount || Number(amount) <= 0) return toast('Введите сумму', 'error');
      if (!tg) return toast('Введите Telegram', 'error');

      let payload = { type: walletActionType === 'deposit' ? `deposit_${currency.toLowerCase()}` : `withdraw_${currency.toLowerCase()}`, amount: Number(amount), currency, tg_username: tg, user_id: u.id };

      if (currency === 'RUB') {
        const bank = document.getElementById('walletBankSelect').value;
        payload.requisites = bank; 
      } else {
        const network = document.getElementById('walletNetwork').value;
        const address = document.getElementById('walletAddress').value.trim();
        if (!address) return toast('Введите адрес кошелька', 'error');
        payload.requisites = address;
        payload.network = network;
      }
      
      const btn = document.getElementById('walletActionSubmit'); btn.disabled = true; btn.textContent = '...';
      try {
        await API.req('POST', '/requests/finance', payload); 
        toast('Заявка создана!', 'success');
        addNotification('Заявка на ' + (walletActionType === 'deposit' ? 'пополнение' : 'вывод') + ' создана', 'info');
        closeModal('walletActionModal'); 
      } catch(e) { toast(e.message || 'Ошибка', 'error'); }
      finally { btn.disabled = false; btn.textContent = 'Отправить'; }
    });

    async function loadMarket() {
      const filters = {};
      const activeTab = document.querySelector('#marketSideTabs .trade-tab.active');
      if (activeTab && activeTab.dataset.side) filters.side = activeTab.dataset.side === 'buy' ? 'sell' : 'buy';
      const assetChip = document.querySelector('#filterAsset .icon-chip.active'); if (assetChip && assetChip.dataset.val) filters.asset = assetChip.dataset.val;
      const faceChip = document.querySelector('#filterFace .icon-chip.active'); if (faceChip && faceChip.dataset.val) filters.face_type = faceChip.dataset.val;
      const payChip = document.querySelector('#filterPayment .icon-chip.active'); if (payChip && payChip.dataset.val) filters.payment = payChip.dataset.val;
      const priceSort = document.querySelector('#filterPriceSort .icon-chip.active'); if (priceSort && priceSort.dataset.val) filters.price_sort = priceSort.dataset.val;
      const fMin = document.getElementById('filterMinAmount')?.value;
      const fMax = document.getElementById('filterMaxAmount')?.value;
      if (fMin) filters.min_amount = fMin;
      if (fMax) filters.max_amount = fMax;

      const list = document.getElementById('adsList');
      if (!list) return;
      list.innerHTML = '<div class="empty-state">Загрузка...</div>';

      try {
        const { items } = await API.req('GET', '/ads?' + new URLSearchParams(filters));
        list.innerHTML = items.length ? items.map(renderAd).join('') : '<div class="empty-state">Объявлений не найдено</div>';
        bindAdButtons();
      } catch (e) { list.innerHTML = '<div class="empty-state">Ошибка загрузки</div>'; }
    }

    document.querySelectorAll('#marketSideTabs .trade-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('#marketSideTabs .trade-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active'); screenCache.market = false; loadMarket();
      };
    });

    document.querySelectorAll('#filterAsset .icon-chip').forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll('#filterAsset .icon-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active'); screenCache.market = false; loadMarket();
      };
    });

    document.getElementById('openFilterBtn')?.addEventListener('click', () => { document.getElementById('filterModal').classList.add('active'); });
    document.getElementById('applyFiltersBtn')?.addEventListener('click', () => { closeModal('filterModal'); screenCache.market = false; loadMarket(); });

    document.querySelectorAll('#marketModeSwitch .mode-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#marketModeSwitch .mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mainTabs = document.getElementById('marketMainTabs');
        const fastContent = document.getElementById('fast-exchange-content');
        const p2pContent = document.getElementById('p2p-market-content');

        if (btn.dataset.mode === 'p2p') {
          mainTabs.style.display = 'flex';
          document.querySelectorAll('.market-tab-content').forEach(c => c.classList.remove('active'));
          document.querySelectorAll('.mm-tab').forEach(t => t.classList.remove('active'));
          document.getElementById('mtab-p2p')?.classList.add('active');
          document.querySelector('.mm-tab[data-mtab="p2p"]')?.classList.add('active');
          if (p2pContent) p2pContent.style.display = 'block';
          if (fastContent) fastContent.style.display = 'none';
        } else {
          mainTabs.style.display = 'none';
          document.querySelectorAll('.market-tab-content').forEach(c => c.classList.remove('active'));
          document.querySelectorAll('.mm-tab').forEach(t => t.classList.remove('active'));
          document.getElementById('mtab-p2p')?.classList.add('active');
          if (p2pContent) p2pContent.style.display = 'none';
          if (fastContent) fastContent.style.display = 'block';
          initFastExchange();
        }
      };
    });

    let exMode = 'buy';
    let basePrice = 90;
    let isPriceLoaded = false;
    let fastExchangeInited = false;

    async function initFastExchange() {
      if (fastExchangeInited) return;
      fastExchangeInited = true;

      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub');
        const data = await res.json();
        if (data && data.tether && data.tether.rub) basePrice = data.tether.rub;
      } catch(e) { basePrice = 92.50; }
      isPriceLoaded = true;
      
      const updateExchangeUI = () => {
          const input = document.getElementById('exAmount');
          const amount = parseFloat(input.value) || 0;
          let rate = 0, result = 0;
          const buyRate = basePrice * 1.05;
          const sellRate = buyRate * 0.995;

          if (exMode === 'buy') {
              rate = buyRate; result = amount / rate; 
              document.getElementById('exInputLabel').textContent = 'Сумма в RUB';
              document.getElementById('exResultDisplay').textContent = `${fmtDec(result, 4)} USDT`;
              document.getElementById('exSubmitBtn').style.background = 'var(--grn)';
              document.getElementById('exSubmitBtn').textContent = 'Купить USDT';
          } else {
              rate = sellRate; result = amount * rate; 
              document.getElementById('exInputLabel').textContent = 'Сумма в USDT';
              document.getElementById('exResultDisplay').textContent = `${fmtDec(result, 2)} RUB`;
              document.getElementById('exSubmitBtn').style.background = 'var(--red)';
              document.getElementById('exSubmitBtn').textContent = 'Продать USDT';
          }
          document.getElementById('exRateDisplay').textContent = `1 USDT = ${fmtDec(rate, 2)} ₽`;
      };

      document.getElementById('exTabBuy').onclick = () => { exMode = 'buy'; document.getElementById('exTabBuy').classList.add('active'); document.getElementById('exTabSell').classList.remove('active'); document.getElementById('exAmount').value = ''; updateExchangeUI(); };
      document.getElementById('exTabSell').onclick = () => { exMode = 'sell'; document.getElementById('exTabSell').classList.add('active'); document.getElementById('exTabBuy').classList.remove('active'); document.getElementById('exAmount').value = ''; updateExchangeUI(); };
      document.getElementById('exAmount').oninput = updateExchangeUI;

      document.getElementById('exSubmitBtn').onclick = async () => {
          if (!isPriceLoaded) return toast('Загрузка курса...', 'info');
          const amount = parseFloat(document.getElementById('exAmount').value);
          if (!amount || amount <= 0) return toast('Введите сумму', 'error');
          if (!API.user()) { document.getElementById('authModal').classList.add('active'); return; }
          
          const btn = document.getElementById('exSubmitBtn'); btn.disabled = true; btn.textContent = '...';
          try {
              const buyRate = basePrice * 1.05;
              const finalRate = exMode === 'buy' ? buyRate : buyRate * 0.995;
              await API.req('POST', '/exchange', { type: exMode, amount: amount, rate: finalRate });
              toast('Заявка создана!', 'success'); document.getElementById('exAmount').value = '';
              updateExchangeUI(); screenCache.wallet = false; screenCache.profile = false;
          } catch(e) { toast(e.message || 'Ошибка', 'error'); }
          finally { btn.disabled = false; updateExchangeUI(); }
      };
      updateExchangeUI();
    }
    function renderAd(ad) {
  const isSell = ad.side === 'sell';
  const faceLabel = ad.faceType === 'first' ? '1-е лицо' : '3-е лицо';
  window._ads = window._ads || {}; window._ads[ad.id] = ad;
  
  const pays = (ad.paymentMethods || []).map(p => `<span class="pay-tag" style="background:rgba(255,255,255,0.1); border:1px solid var(--card-border); padding:4px 8px; border-radius:6px; font-size:11px; font-weight:600; color:var(--txt); display:inline-flex; align-items:center; gap:4px;">${getPayIcon(p)} ${p}</span>`).join('');
  
  let avatarHtml = `<div class="avatar">${ad.displayName[0].toUpperCase()}</div>`;
  if (ad.avatarUrl) avatarHtml = `<div class="avatar"><img src="${ad.avatarUrl}" onerror="this.style.display='none'; this.parentElement.innerHTML='${ad.displayName[0].toUpperCase()}'"></div>`;
  
  const merchantBadge = ad.isMerchant ? `<span class="badge-merchant" title="Merchant">${ICONS.merchant}</span>` : '';
  const makerBadge = ad.isMaker ? `<span class="badge-maker" title="Maker">${ICONS.maker}</span>` : '';
  const proBadge = ad.isPro ? `<span class="badge-pro" title="PRO">${ICONS.pro}</span>` : '';

  return `<div class="ad-card">
    <div class="ad-head" onclick="openPublicProfile(${ad.userId})">
      ${avatarHtml}
      <div class="ad-user">
        <div class="ad-name">${ad.displayName} ${merchantBadge} ${makerBadge} ${proBadge} <span class="badge-face">${faceLabel}</span></div>
        <div class="ad-meta"><span>★ ${ad.ratingAvg || '—'}</span> <span>${ad.dealsCompleted || 0} сделок</span></div>
      </div>
    </div>
    <div class="ad-body">
      <div class="ad-price-block">
         <div class="ad-price">${fmtDec(ad.price, 2)} ₽</div>
         <div class="ad-limits">Лимиты: ${fmt(ad.minRub)} - ${fmt(ad.maxRub)} RUB</div>
         <div class="ad-amount">Доступно: ${fmtDec(ad.amountLeft, 2)} ${ad.asset}</div>
         ${pays ? `<div class="ad-pay-methods" style="justify-content:flex-start;margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${pays}</div>` : ''}
      </div>
      <div class="ad-action">
         <button class="btn ${isSell ? 'btn-buy' : 'btn-sell'} btn-sm" data-ad-id="${ad.id}" style="min-width:80px;">${isSell ? 'Купить' : 'Продать'}</button>
      </div>
    </div>
  </div>`;
}

function bindAdButtons() {
  document.querySelectorAll('[data-ad-id]').forEach(b => {
    b.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!API.user()) { document.getElementById('authModal')?.classList.add('active'); return; }
      openOrderModal(+b.dataset.adId);
    };
  });
}

window.openPublicProfile = async function(userId) {
  const m = document.getElementById('publicProfileModal'); const c = document.getElementById('publicProfileContent');
  if (!m || !c) return; c.innerHTML = '<div class="empty-state">Загрузка...</div>'; m.classList.add('active');
  try {
    const { user, stats, isFavorite } = await API.req('GET', '/users/' + userId);
    let avatarHtml = `<div class="avatar lg" style="margin:0 auto 8px;">${user.displayName[0].toUpperCase()}</div>`;
    if (user.avatarUrl) avatarHtml = `<div class="avatar lg" style="margin:0 auto 8px;"><img src="${user.avatarUrl}" onerror="this.style.display='none'; this.parentElement.innerHTML='${user.displayName[0].toUpperCase()}'"></div>`;
    let favBtn = '';
    if (API.user() && API.user().id !== user.id) favBtn = `<button class="btn-fav ${isFavorite ? 'active' : ''}" onclick="toggleFavorite(${user.id}, this)" style="position:absolute;top:15px;right:15px;font-size:24px;background:none;border:none;">${isFavorite ? '❤️' : '🤍'}</button>`;
    
    const merchantBadge = user.isMerchant ? `<span class="badge-merchant" style="margin-left:4px; width:20px; height:20px;" title="Merchant">${ICONS.merchant}</span>` : '';
    const makerBadge = user.isMaker ? `<span class="badge-maker" style="margin-left:4px; width:20px; height:20px;" title="Maker">${ICONS.maker}</span>` : '';
    const proBadge = user.isPro ? `<span class="badge-pro" style="margin-left:4px; width:20px; height:20px;" title="PRO">${ICONS.pro}</span>` : '';

    c.innerHTML = `
      ${favBtn}
      <div style="text-align:center; margin-bottom: 16px; margin-top:8px;">
        ${avatarHtml}
        <h2 style="font-size:20px;font-weight:800;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:var(--txt);">${user.displayName} ${merchantBadge} ${makerBadge} ${proBadge}</h2>
        <div style="font-size:13px;color:var(--dim);font-weight:600;">@${user.username}</div>
      </div>
      <div class="stats" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="glass-card" style="padding:12px;text-align:center;border-radius:12px;"><div style="font-size:12px;color:var(--dim);">Сделок</div><div style="font-size:16px;font-weight:800;color:var(--txt);">${stats.dealsTotal}</div></div>
        <div class="glass-card" style="padding:12px;text-align:center;border-radius:12px;"><div style="font-size:12px;color:var(--dim);">Успешных</div><div style="font-size:16px;font-weight:800;color:var(--txt);">${stats.successRate !== null ? stats.successRate + '%' : '—'}</div></div>
      </div>
      <div id="publicReviewsList" style="margin-top:16px;">Загрузка отзывов...</div>`;
    loadPublicReviews(user.id);
  } catch(e) { c.innerHTML = '<div class="empty-state">Ошибка</div>'; }
};

window.toggleFavorite = async function(targetId, btnEl) {
  if (!API.user()) { document.getElementById('authModal')?.classList.add('active'); return; }
  try {
    const res = await API.req('POST', '/users/' + targetId + '/favorite');
    if (res.isFavorite) { btnEl.innerHTML = '❤️'; toast('В избранном', 'success'); }
    else { btnEl.innerHTML = '🤍'; toast('Удалено', 'info'); }
  } catch(e) { toast('Ошибка', 'error'); }
};

async function loadPublicReviews(userId) {
  const list = document.getElementById('publicReviewsList'); if (!list) return;
  try {
    const data = await API.req('GET', '/reviews/user/' + userId);
    const items = data.items || [];
    list.innerHTML = `<div style="font-size:14px;font-weight:800;margin-bottom:8px;color:var(--txt);text-transform:uppercase;">Отзывы</div>` + 
      (items.length ? items.map(r => `<div class="glass-card" style="padding:12px;margin-bottom:8px;border-radius:10px;"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><strong style="font-size:14px;color:var(--txt);">${r.author}</strong><span style="color:var(--txt);font-size:14px;">${'★'.repeat(r.rating)}</span></div><p style="font-size:13px;color:var(--dim);font-weight:500;">${r.comment || 'Без комментария'}</p></div>`).join('') : '<div class="empty-state" style="padding:10px;">Отзывов пока нет</div>');
  } catch(e) { list.innerHTML = ''; }
}

document.querySelectorAll('#f-payments .pay-chip').forEach(c => { c.onclick = () => c.classList.toggle('active'); });
document.querySelectorAll('#f-time .pay-chip').forEach(c => { c.onclick = () => { document.querySelectorAll('#f-time .pay-chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); }; });
document.querySelectorAll('#f-asset-select .icon-chip').forEach(c => {
  c.onclick = () => {
    document.querySelectorAll('#f-asset-select .icon-chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    const lbl = document.getElementById('f-asset-label');
    if (lbl) lbl.textContent = c.dataset.val;
  };
});

document.querySelectorAll('#f-side .seg-btn').forEach(b => {
  b.onclick = () => {
    if (b.disabled) return;
    document.querySelectorAll('#f-side .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  };
});

document.querySelectorAll('#f-face .seg-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#f-face .seg-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  };
});

document.getElementById('createBtn')?.addEventListener('click', async () => {
  const errEl = document.getElementById('createError'); if (errEl) errEl.textContent = '';
  const u = API.user();
  if (!u) { if (errEl) errEl.textContent = 'Войдите в аккаунт'; setTimeout(() => document.getElementById('authModal')?.classList.add('active'), 500); return; }
  
  const payments = [...document.querySelectorAll('#f-payments .pay-chip.active')].map(c => c.dataset.val);
  if (!payments.length) { if (errEl) errEl.textContent = 'Выберите способ оплаты'; return; }
  
  const price = document.getElementById('f-price')?.value;
  const amount = document.getElementById('f-amount')?.value;
  const min = document.getElementById('f-min')?.value;
  const max = document.getElementById('f-max')?.value;
  if (!price || !amount || !min || !max) { if (errEl) errEl.textContent = 'Заполните поля'; return; }
  
  const payment_time = document.querySelector('#f-time .pay-chip.active')?.dataset.val || 30;
  const side = document.querySelector('#f-side .seg-btn.active')?.dataset.val;
  const asset = document.querySelector('#f-asset-select .icon-chip.active')?.dataset.val;

  if (side === 'buy') {
     const isStaff = ['admin', 'owner', 'deputy'].includes(u.role);
     if (!isStaff && !u.isMaker && !u.isMerchant) {
         toast('Только мейкеры и мерчанты могут создавать объявления о покупке', 'error');
         return;
     }
     if (u.balanceRub < Number(max)) {
         toast(`Недостаточно RUB на балансе (Нужно: ${fmt(max)} ₽)`, 'error');
         return;
     }
  } else if (side === 'sell') {
     if (u.balanceUsdt < Number(amount)) {
         toast(`Недостаточно ${asset} на балансе (Нужно: ${fmtDec(amount, 2)})`, 'error');
         return;
     }
  }

  const btn = document.getElementById('createBtn'); btn.disabled = true; btn.textContent = '...';
  
  try {
    await API.req('POST', '/ads', {
      side: side,
      face_type: document.querySelector('#f-face .seg-btn.active')?.dataset.val,
      asset: asset, price: price, amount_total: amount,
      min_rub: min, max_rub: max,
      payment_methods: payments, terms: document.getElementById('f-terms')?.value || '',
      payment_time: Number(payment_time)
    });
    toast('Объявление опубликовано!', 'success');
    addNotification('Вы создали новое объявление.', 'success');
    screenCache.market = false; screenCache.home = false;
    show('market');
    setTimeout(() => document.querySelector('.mm-tab[data-mtab="ads"]')?.click(), 100);
  } catch (err) {
    const map = { max_exceeds_total: 'Макс. лимит больше объема', min_gt_max: 'Мин больше макс', bad_amounts: 'Проверьте числа' };
    if (errEl) errEl.textContent = map[err.code] || err.message;
  } finally { btn.disabled = false; btn.textContent = 'Опубликовать'; }
});

async function loadOrders(filter) {
  const list = document.getElementById('ordersList'); if (!list) return;
  if (!API.user()) { list.innerHTML = '<div class="empty-state">Войдите</div>'; return; }
  try {
    const { items } = await API.req('GET', '/orders/my?status=' + filter);
    const sc = { pending: 'var(--yellow)', accepted: 'var(--blue)', paid: 'var(--grn)', completed: 'var(--grn)', cancelled: 'var(--red)', declined: 'var(--red)', dispute: 'var(--gold)' };
    list.innerHTML = items.length ? items.map(o => `
      <div class="ad-card" style="cursor:pointer;border-left:4px solid ${sc[o.status] || 'var(--dim)'}; padding:16px; margin-bottom:12px;" data-order-id="${o.id}">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <strong style="font-family:Inter,monospace;font-size:15px;color:var(--txt);">#${o.publicId}</strong>
          <span style="color:${sc[o.status] || 'var(--txt)'};font-size:12px;font-weight:800">${o.statusLabel}</span>
        </div>
        <div class="ad-body">
          <div><div style="font-size:12px;color:var(--dim);">Сумма</div><div style="font-size:15px;font-weight:800;color:var(--txt);">${fmtDec(o.amountRub, 2)} ₽</div></div>
          <div><div style="font-size:12px;color:var(--dim);">Актив</div><div style="font-size:15px;font-weight:800;color:var(--txt);">${fmtDec(o.amountAsset, 2)} ${o.asset}</div></div>
        </div>
        <div style="font-size:12px;color:var(--dim);display:flex;justify-content:space-between;font-weight:600;margin-top:12px;">
          <span>${new Date(o.createdAt).toLocaleString('ru-RU')}</span>
          <span>${o.buyer.displayName} ↔ ${o.seller.displayName}</span>
        </div>
      </div>`).join('') : '<div class="empty-state">Ордеров нет</div>';
    list.querySelectorAll('[data-order-id]').forEach(el => { el.onclick = () => openOrderPage(+el.dataset.orderId); });
  } catch(e) { list.innerHTML = '<div class="empty-state">Ошибка</div>'; }
}

document.querySelectorAll('#ordersFilter .tab').forEach(c => {
  c.onclick = () => {
    document.querySelectorAll('#ordersFilter .tab').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    loadOrders(c.dataset.val);
  };
});

async function openOrderPage(orderId) {
  if (!API.user()) { document.getElementById('authModal')?.classList.add('active'); return; }
  previousScreen = 'market'; show('order');
  const container = document.getElementById('orderDetailContent'); if (!container) return;
  container.innerHTML = '<div class="empty-state">Загрузка...</div>';
  try {
    const { order, history, terms } = await API.req('GET', '/orders/' + orderId);
    renderOrderPage(order, history, terms);

    if (window.orderPollInterval) clearInterval(window.orderPollInterval);
    window.orderPollInterval = setInterval(async () => {
       try {
           const freshData = await API.req('GET', '/orders/' + orderId);
           if (freshData.order.status !== order.status) {
               renderOrderPage(freshData.order, freshData.history, freshData.terms);
               toast(`Статус обновлен: ${freshData.order.statusLabel}`, 'info');
               addNotification(`Статус ордера #${freshData.order.publicId} изменился на: ${freshData.order.statusLabel}`, 'info');
           }
       } catch(e) {}
    }, 5000);

  } catch (e) { container.innerHTML = '<div class="empty-state">Ошибка</div>'; }
}

window.openAdminOrder = function(orderId) { previousScreen = 'admin'; openOrderPage(orderId); };

window.viewReceipt = function(data) {
    if (!data) return toast('Чек не прикреплен', 'error');
    const content = document.getElementById('receiptViewContent');
    content.innerHTML = `<img src="${data}" style="max-width:100%; max-height:80vh; border-radius:8px;">`;
    document.getElementById('receiptViewModal').classList.add('active');
};

function renderOrderPage(order, history, terms) {
  const u = API.user(), isBuyer = order.buyer_id === u.id, isSeller = order.seller_id === u.id, isAdmin = ['admin', 'owner', 'deputy'].includes(u.role);
  const isAdCreator = u.id === order.adUserId;
  
  const sc = { pending: '#FFD60A', accepted: '#3b82f6', paid: '#22c55e', completed: '#22c55e', cancelled: '#ef4444', declined: '#ef4444', dispute: '#D4AF37' };
  let progress = 20;
  if (order.status === 'accepted') progress = 40;
  if (order.status === 'paid') progress = 70;
  if (order.status === 'completed') progress = 100;
  if (order.status === 'cancelled' || order.status === 'dispute' || order.status === 'declined') progress = 0;

  const counterparty = isBuyer ? order.seller : order.buyer;
  const counterpartyRole = isBuyer ? 'Продавец' : 'Покупатель';

  let actionsHtml = '';
  
  if (order.status === 'pending') {
    if (isAdCreator) {
      actionsHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><button class="btn btn-primary btn-sm" onclick="doAction(${order.id},'accept')" style="background:var(--grn);color:#fff;border:none;height:44px;font-size:14px;">Принять</button><button class="btn btn-ghost btn-sm" style="color:var(--red);border:1px solid var(--red);height:44px;font-size:14px;" onclick="doAction(${order.id},'decline')">Отклонить</button></div>`;
    } else {
      actionsHtml = `<div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:14px;text-align:center;color:var(--dim);font-size:14px;margin-bottom:10px;font-weight:600;">Ожидайте подтверждения</div>
      <button class="btn btn-ghost btn-block btn-sm" style="color:var(--red);height:44px;font-size:14px;" onclick="doAction(${order.id},'cancel')">Отменить</button>`;
    }
  } 
  else if (order.status === 'accepted') {
    if (isBuyer) {
      actionsHtml = `
      <div style="background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);border-radius:12px;padding:16px;text-align:center;margin-bottom:12px;">
        <div style="font-size:13px;color:var(--dim);margin-bottom:8px;">Время на оплату:</div>
        <div id="paymentTimerDisplay" style="font-size:24px;font-weight:900;color:var(--yellow);margin-bottom:12px;">--:--</div>
        <input type="file" id="receiptFile" style="display:none;" accept="image/*,application/pdf">
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('receiptFile').click()" style="margin-bottom:8px;height:36px;font-size:13px;">Прикрепить чек</button>
        <div id="fileName" style="font-size:12px;color:var(--grn);margin-bottom:12px;font-weight:600;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
           <button class="btn btn-primary btn-sm" onclick="doAction(${order.id},'paid')" style="height:44px;font-size:14px;">Я оплатил</button>
           <button class="btn btn-ghost btn-sm" style="color:var(--red);height:44px;font-size:14px;" onclick="doAction(${order.id},'cancel')">Отменить</button>
        </div>
      </div>`;
    } else {
      actionsHtml = `<div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:14px;text-align:center;color:var(--dim);font-size:14px;margin-bottom:10px;font-weight:600;">Ожидайте оплаты</div><button class="btn btn-ghost btn-block btn-sm" style="color:var(--gold);height:44px;font-size:14px;" onclick="doAction(${order.id},'dispute')">Спор</button>`;
    }
  } 
  else if (order.status === 'paid') {
    if (isSeller) {
      actionsHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px"><button class="btn btn-primary btn-sm" onclick="doAction(${order.id},'confirm')" style="height:44px;font-size:14px;">Оплата получена</button><button class="btn btn-ghost btn-sm" style="color:var(--red);height:44px;font-size:14px;" onclick="doAction(${order.id},'dispute')">Спор</button></div>`;
    } else {
      actionsHtml = `<div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:12px;padding:14px;text-align:center;color:var(--dim);font-size:14px;margin-bottom:10px;font-weight:600;">Ожидайте подтверждения</div><button class="btn btn-ghost btn-block btn-sm" style="color:var(--red);height:44px;font-size:14px;" onclick="doAction(${order.id},'dispute')">Спор</button>`;
    }
  } 
  else if (order.status === 'completed') {
    actionsHtml = `<div style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:12px;padding:14px;text-align:center;color:var(--grn);font-size:15px;font-weight:800;margin-bottom:12px">✓ Сделка завершена</div><button class="btn btn-primary btn-block btn-sm" onclick="openReview(${order.id})" style="margin-bottom:16px;height:44px;font-size:14px;">Оставить отзыв</button>`;
  } 
  else if (order.status === 'cancelled' || order.status === 'declined') {
    actionsHtml = `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:14px;text-align:center;color:var(--red);font-size:15px;margin-bottom:16px;font-weight:800;">Заявка ${order.status === 'declined' ? 'отклонена' : 'отменена'}</div>`;
  } 
  else if (order.status === 'dispute') {
    if (isAdmin) actionsHtml = `<div style="background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.3);border-radius:12px;padding:14px;text-align:center;color:var(--gold);font-size:15px;margin-bottom:12px;font-weight:800;">Решите спор:</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px"><button class="btn btn-primary btn-sm" onclick="resolveDispute(${order.id}, 'completed')" style="height:44px;font-size:14px;">Завершить</button><button class="btn btn-ghost btn-sm" style="color:var(--red);height:44px;font-size:14px;" onclick="resolveDispute(${order.id}, 'cancelled')">Отменить</button></div>`;
    else actionsHtml = `<div style="background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.3);border-radius:12px;padding:14px;text-align:center;color:var(--gold);font-size:15px;margin-bottom:16px;font-weight:800;">Спор рассматривается</div>`;
  }

  let adminReceiptHtml = '';
  if ((isAdmin || isSeller) && ['paid', 'dispute'].includes(order.status) && order.receipt_data) {
    adminReceiptHtml = `
    <div class="glass-card" style="padding:14px;margin-bottom:16px;border:1px dashed var(--primary);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:12px;color:var(--dim);font-weight:700;margin-bottom:4px;">Чек об оплате</div>
          <div style="font-size:14px;font-weight:800;color:var(--txt);">Прикреплен</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="viewReceipt('${order.receipt_data}')" style="height:32px;font-size:12px;">Посмотреть</button>
      </div>
    </div>`;
  }

  const timelineHtml = (history || []).map(h => `<div style="display:flex;gap:12px;padding:8px 0"><div style="width:12px;height:12px;border-radius:50%;background:var(--txt);flex-shrink:0;margin-top:4px"></div><div style="flex:1"><div style="font-size:14px;font-weight:700;color:var(--txt);">${h.note || h.status}</div><div style="font-size:12px;color:var(--dim);font-weight:600;">${new Date(h.at).toLocaleString('ru-RU')}</div></div></div>`).join('');
  
  const container = document.getElementById('orderDetailContent');
  container.innerHTML = `
    <div class="glass-card" style="padding: 20px; margin-bottom: 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
         <div style="font-size:13px;color:var(--dim);font-family:monospace;font-weight:700;">#${order.public_id}</div>
         <div style="background:var(--glass-bg);color:${sc[order.status]};font-size:13px;font-weight:800;padding:4px 10px;border-radius:6px">${order.statusLabel}</div>
      </div>
      <h2 style="font-size:22px;font-weight:900;margin-bottom:6px;color:var(--txt)">${isBuyer ? 'Покупка ' : 'Продажа '}${order.asset}</h2>
      <div style="font-size:32px;font-weight:900;color:var(--txt);font-variant-numeric:tabular-nums;">${fmtDec(order.amount_rub, 2)}<span style="font-size:16px;color:var(--dim);font-weight:600;margin-left:4px">₽</span></div>
      <div style="width:100%;height:6px;background:var(--glass-border);border-radius:3px;margin-top:16px;overflow:hidden"><div style="height:100%;width:${progress}%;background:${sc[order.status]};transition:0.3s"></div></div>
    </div>
    
    <div class="glass-card" style="padding:14px;margin-bottom:16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;" onclick="openPublicProfile(${counterparty.id})">
      <div style="display:flex;align-items:center;gap:12px;">
         <div class="avatar" style="width:40px;height:40px;font-size:14px;">${counterparty.avatarUrl ? `<img src="${counterparty.avatarUrl}">` : counterparty.displayName[0].toUpperCase()}</div>
         <div>
           <div style="font-size:12px;color:var(--dim);font-weight:600;">${counterpartyRole}</div>
           <div style="font-size:15px;font-weight:800;color:var(--txt);">${counterparty.displayName}</div>
         </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="border:1px solid var(--glass-border);height:32px;font-size:12px;">Профиль</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="glass-card" style="padding:14px;"><div style="font-size:12px;color:var(--dim);font-weight:700;margin-bottom:4px;">Количество</div><div style="font-size:15px;font-weight:800;color:var(--txt);">${fmtDec(order.amount_asset, 2)} ${order.asset}</div></div>
      <div class="glass-card" style="padding:14px;"><div style="font-size:12px;color:var(--dim);font-weight:700;margin-bottom:4px;">Курс</div><div style="font-size:15px;font-weight:800;color:var(--txt);">${fmtDec(order.price, 2)} ₽</div></div>
    </div>
    
    <div class="glass-card" style="padding:16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
         <div style="font-size: 12px; font-weight: 800; color: var(--dim); text-transform: uppercase;">Время на оплату</div>
         <div style="font-size: 13px; font-weight: 800; color: var(--yellow);">${order.paymentTime} мин</div>
      </div>
      <div style="font-size: 12px; font-weight: 800; color: var(--dim); text-transform: uppercase; margin-bottom: 6px;">Условия</div>
      <div style="font-size: 14px; color: var(--txt); line-height: 1.4; font-weight: 500;">${terms || 'Стандартные условия.'}</div>
    </div>
    
    ${adminReceiptHtml}
    ${actionsHtml}
    
    <button style="width:100%;display:flex;align-items:center;justify-content:space-between;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:14px;margin-bottom:16px;color:var(--txt);font-size:14px; cursor:pointer;" onclick="openChatModal(${order.id})">
      <div style="display:flex;align-items:center;gap:12px"><div class="avatar" style="width:32px;height:32px;font-size:16px">💬</div><div style="text-align:left;"><div style="font-weight:800; color:var(--txt);">Чат по сделке</div></div></div>
    </button>
    <div class="glass-card" style="padding:16px"><div style="font-size:13px;font-weight:800;margin-bottom:12px;color:var(--dim);text-transform:uppercase">История</div>${timelineHtml}</div>`;

  if (order.status === 'accepted') {
    const timerEl = document.getElementById('paymentTimerDisplay');
    if (timerEl) {
       const createdAt = new Date(order.createdAt).getTime();
       const limitMs = order.paymentTime * 60000;
       const expiresAt = createdAt + limitMs;
       if (window.orderTimerInterval) clearInterval(window.orderTimerInterval);
       window.orderTimerInterval = setInterval(() => {
         const now = Date.now();
         const diff = expiresAt - now;
         if (diff <= 0) {
           clearInterval(window.orderTimerInterval);
           timerEl.textContent = '00:00';
           timerEl.style.color = 'var(--red)';
         } else {
           const m = Math.floor(diff / 60000).toString().padStart(2, '0');
           const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
           timerEl.textContent = `${m}:${s}`;
         }
       }, 1000);
    }
  }

  let tempReceiptData = null;
  const fileInput = document.getElementById('receiptFile');
  if (fileInput) {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('fileName').textContent = `Загрузка...`;
        try {
            tempReceiptData = await fileToBase64(file);
            document.getElementById('fileName').textContent = `✓ Чек прикреплен`;
            toast('Чек прикреплен!', 'success');
        } catch(err) { toast('Ошибка чтения файла', 'error'); }
      }
    };
  }

  window.doAction = async function(orderId, action) {
    if (action === 'cancel' && !await confirmAsync('Отмена', 'Отменить заявку?', 'Да')) return;
    if (action === 'confirm' && !await confirmAsync('Подтверждение', 'Подтвердить оплату?', 'Да')) return;
    if (action === 'dispute' && !await confirmAsync('Спор', 'Вы уверены?', 'Да')) return;
    if (action === 'decline' && !await confirmAsync('Отклонение', 'Отклонить заявку?', 'Да')) return;
    
    try { 
      const body = {};
      if (action === 'paid' && tempReceiptData) body.receipt_data = tempReceiptData;

      await API.req('POST', `/orders/${orderId}/${action}`, body); 
      toast('Статус обновлён', 'success'); 
      
      const msgMap = {
         accept: 'Заявка принята',
         decline: 'Заявка отклонена',
         paid: 'Оплата отправлена',
         confirm: 'Сделка завершена',
         cancel: 'Заявка отменена',
         dispute: 'Спор открыт'
      };
      
      addNotification(`Ордер #${order.publicId}: ${msgMap[action] || 'Действие'}`, 'info');
      screenCache.orders = false; screenCache.wallet = false;
      openOrderPage(orderId); 
    }
    catch (e) { toast(e.message, 'error'); }
  };
}

window.resolveDispute = async function(orderId, resolution) {
  if (!await confirmAsync('Решение спора', 'Вы уверены?', 'Да')) return;
  try { await API.req('POST', `/orders/${orderId}/resolve`, { resolution }); toast('Спор решен', 'success'); openOrderPage(orderId); }
  catch (e) { toast(e.message, 'error'); }
};
    let currentChatOrderId = null, chatPollTimer = null;
    window.openChatModal = async function(orderId) {
      currentChatOrderId = orderId;
      const m = document.getElementById('chatModal'); if (m) m.classList.add('active');
      await loadChat(orderId, true);
      if (chatPollTimer) clearInterval(chatPollTimer);
      chatPollTimer = setInterval(() => loadChat(orderId, false), 3000);
    };
    window.closeChatModal = function() {
      const m = document.getElementById('chatModal'); if (m) m.classList.remove('active');
      if (chatPollTimer) clearInterval(chatPollTimer); chatPollTimer = null;
    };

    document.getElementById('chatAttachBtn')?.addEventListener('click', () => { document.getElementById('chatFileInput').click(); });
    document.getElementById('chatFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentChatOrderId) return;
        try {
            const base64 = await fileToBase64(file);
            await API.req('POST', '/chat/' + currentChatOrderId, { media_data: base64, media_type: file.type, text: '' });
            loadChat(currentChatOrderId, false);
            e.target.value = '';
        } catch(err) { toast('Ошибка загрузки файла', 'error'); }
    });
    document.getElementById('chatSend')?.addEventListener('click', async () => {
      const input = document.getElementById('chatInput');
      const text = input?.value.trim();
      if (!text || !currentChatOrderId) return;
      if (input) input.value = '';
      try { await API.req('POST', '/chat/' + currentChatOrderId, { text }); loadChat(currentChatOrderId, false); }
      catch (e) { toast(e.message, 'error'); }
    });
    document.getElementById('chatInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('chatSend')?.click(); });

    async function loadChat(orderId, reset = true) {
      try {
        const { items } = await API.req('GET', '/chat/' + orderId);
        const body = document.getElementById('chatBody'); if (!body) return;
        if (reset) body.innerHTML = '<div style="text-align:center;font-size:13px;color:var(--dim);font-weight:600;margin-bottom:12px;">Сделка создана.</div>';
        const rendered = body.querySelectorAll('[data-msg-id]').length;
        items.slice(rendered).forEach(m => {
          const div = document.createElement('div');
          div.className = 'msg' + (m.isMine ? ' me' : '');
          div.dataset.msgId = m.id;
          
          let mediaHtml = '';
          if (m.media_data && m.media_type) {
              if (m.media_type.startsWith('image/')) {
                  mediaHtml = `<img src="${m.media_data}" style="max-width:100%; border-radius:8px; margin-bottom:6px; cursor:pointer;" onclick="viewReceipt('${m.media_data}')">`;
              } else if (m.media_type.startsWith('video/')) {
                  mediaHtml = `<video src="${m.media_data}" controls style="max-width:100%; border-radius:8px; margin-bottom:6px;"></video>`;
              } else if (m.media_type === 'application/pdf') {
                  mediaHtml = `<a href="${m.media_data}" download="document.pdf" style="display:inline-block; padding:10px; background:var(--btn-glass-bg); color:var(--txt); border-radius:10px; text-decoration:none; font-size:13px; margin-bottom:6px;">📄 Скачать PDF</a>`;
              }
          }

          div.innerHTML = `<div class="avatar" style="width:32px;height:32px;font-size:14px">${m.senderUsername[0].toUpperCase()}</div><div><div class="msg-bubble" style="font-size:14px; padding:10px 14px;">${mediaHtml}${m.text ? m.text.replace(/</g, '&lt;') : ''}</div><div style="font-size:11px;color:var(--dim);margin-top:4px;font-weight:600; text-align: ${m.isMine ? 'right' : 'left'}">${new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div></div>`;
          body.appendChild(div);
        });
        body.scrollTop = body.scrollHeight;
      } catch (e) {}
    }

    let currentReviewOrderId = null, currentRating = 5;
    window.openReview = function(orderId) {
      currentReviewOrderId = orderId; currentRating = 5;
      const c = document.getElementById('reviewComment'); if (c) c.value = '';
      const er = document.getElementById('reviewError'); if (er) er.textContent = '';
      updateStars();
      document.getElementById('reviewModal')?.classList.add('active');
    };
    function updateStars() { document.querySelectorAll('#ratingStars .rating-star').forEach(s => s.classList.toggle('active', +s.dataset.r <= currentRating)); }
    document.querySelectorAll('#ratingStars .rating-star').forEach(s => { 
      s.onclick = () => { 
        currentRating = +s.dataset.r; updateStars(); 
        document.querySelectorAll('#ratingStars .rating-star').forEach(el => el.style.color = +el.dataset.r <= currentRating ? '#FFD60A' : 'var(--dim)');
      }; 
    });
    document.getElementById('reviewSubmitBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('reviewSubmitBtn'); btn.disabled = true;
      try {
        await API.req('POST', '/reviews', { order_id: currentReviewOrderId, rating: currentRating, comment: document.getElementById('reviewComment')?.value || '' });
        toast('Отзыв добавлен!', 'success'); closeModal('reviewModal'); screenCache.profile = false; loadProfile();
      } catch (e) { const er = document.getElementById('reviewError'); if (er) er.textContent = e.message; }
      finally { btn.disabled = false; }
    });

    let profileTab = 'history'; 
    async function loadProfile() {
      const u = API.user();
      const content = document.getElementById('profileContent');
      if (!content) return;
      if (!u) { content.innerHTML = '<div class="empty-state"><button class="btn btn-primary btn-sm" onclick="document.getElementById(\'authModal\').classList.add(\'active\')">Войти</button></div>'; return; }
      
      try {
        const { user, stats } = await API.req('GET', '/users/me');
        localStorage.setItem('vexo_user', JSON.stringify(user));
        
        const proBadge = user.isPro ? `<span class="badge-pro" title="PRO">${ICONS.pro}</span>` : '';
        const merchantBadge = user.isMerchant ? `<span class="badge-merchant" title="Merchant">${ICONS.merchant}</span>` : '';
        const makerBadge = user.isMaker ? `<span class="badge-maker" title="Maker">${ICONS.maker}</span>` : '';

        const successRateStr = stats.successRate !== null ? `${stats.successRate}%` : '0%';
        const ratingAvgStr = stats.ratingAvg !== null ? stats.ratingAvg : '—';

        let contentHtml = '';
        if (profileTab === 'history') contentHtml = '<div id="myHistoryList"><div class="empty-state">Загрузка...</div></div>';
        else if (profileTab === 'reviews') contentHtml = '<div id="myReviewsList"><div class="empty-state">Загрузка...</div></div>';
        else if (profileTab === 'requests') contentHtml = '<div id="myRequestsList"><div class="empty-state">Загрузка...</div></div>';
        
        let avatarHtml = `<div class="avatar lg">${user.displayName[0].toUpperCase()}</div>`;
        if (user.avatarUrl) avatarHtml = `<div class="avatar lg"><img src="${user.avatarUrl}" onerror="this.style.display='none'; this.parentElement.innerHTML='${user.displayName[0].toUpperCase()}'"></div>`;

        content.innerHTML = `
          <div class="glass-card profile-header-card">
            <div class="profile-info-left">
              ${avatarHtml}
              <div style="flex:1;min-width:0">
                <h2 class="profile-name-row">${user.displayName} ${merchantBadge} ${makerBadge} ${proBadge}</h2>
                <div style="font-size:13px;color:var(--dim);font-weight:600;">@${user.username} (ID: ${user.id})</div>
              </div>
            </div>
            <button class="profile-settings-btn" onclick="openSettings()">⚙️</button>
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:14px;text-align:center;">
              <div style="font-size:12px;color:var(--dim);font-weight:600;margin-bottom:4px;">Сделок</div>
              <div style="font-size:18px;font-weight:800;">${stats.dealsTotal}</div>
            </div>
            <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:14px;text-align:center;">
              <div style="font-size:12px;color:var(--dim);font-weight:600;margin-bottom:4px;">Успешных</div>
              <div style="font-size:18px;font-weight:800;">${successRateStr}</div>
            </div>
            <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:14px;text-align:center;">
              <div style="font-size:12px;color:var(--dim);font-weight:600;margin-bottom:4px;">Отзывов</div>
              <div style="font-size:18px;font-weight:800;">${stats.reviewsCount}</div>
            </div>
            <div style="background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:16px;padding:14px;text-align:center;">
              <div style="font-size:12px;color:var(--dim);font-weight:600;margin-bottom:4px;">Рейтинг</div>
              <div style="font-size:18px;font-weight:800;">${ratingAvgStr}</div>
            </div>
          </div>
          
          <div class="profile-tabs">
            <button class="profile-tab ${profileTab === 'history' ? 'active' : ''}" onclick="switchProfileTab('history')">История</button>
            <button class="profile-tab ${profileTab === 'reviews' ? 'active' : ''}" onclick="switchProfileTab('reviews')">Отзывы</button>
            <button class="profile-tab ${profileTab === 'requests' ? 'active' : ''}" onclick="switchProfileTab('requests')">Заявки</button>
          </div>
          <div id="profileTabContent">${contentHtml}</div>

          <!-- ТГ БОТ ПЛАШКА -->
          <a href="https://t.me/vxomanualbot" target="_blank" class="tg-promo-card">
            <div class="tg-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/></svg>
            </div>
            <div class="tg-content">
              <h3>P2P Инструменты</h3>
              <p>Перейти в бот @vxomanualbot</p>
            </div>
            <div style="font-size:20px;">→</div>
          </a>

          <div style="margin-top:24px"><button class="btn btn-ghost btn-block btn-sm" onclick="logoutAction()" style="color:#ef4444 !important;border:1px solid rgba(239,68,68,.3) !important; height:44px; font-size:14px;">Выйти</button></div>`;

        if (profileTab === 'history') loadMyHistory();
        else if (profileTab === 'reviews') loadMyReviews();
        else if (profileTab === 'requests') loadMyRequests();
      } catch (e) { content.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }
    window.switchProfileTab = function(tab) { profileTab = tab; loadProfile(); };

    async function loadMyAds() {
      const list = document.getElementById('myAdsList'); if (!list) return;
      if (!API.user()) { list.innerHTML = '<div class="empty-state">Войдите</div>'; return; }
      try {
        const { items } = await API.req('GET', '/ads/my');
        const activeItems = items.filter(ad => ad.active); 

        list.innerHTML = activeItems.length ? activeItems.map(ad => `
          <div class="glass-card" style="margin-bottom:12px; padding:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px">
              <strong style="font-size:16px;">${ad.side === 'sell' ? 'Продажа' : 'Покупка'} ${ad.asset}</strong>
              <span style="color:var(--grn);font-size:12px;font-weight:700;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;">Активно</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div><div style="font-size:12px;color:var(--dim);font-weight:600;">Курс</div><div style="font-size:15px;font-weight:800;">${fmt(ad.price)} ₽</div></div>
              <div><div style="font-size:12px;color:var(--dim);font-weight:600;">Остаток</div><div style="font-size:15px;font-weight:800;">${fmtDec(ad.amountLeft, 2)} ${ad.asset}</div></div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-ghost btn-sm" style="flex:1; border:1px solid var(--glass-border); height:40px; font-size:13px;" onclick="toggleAdStatus(${ad.id}, ${ad.active})">Снять</button>
              <button class="btn btn-primary btn-sm" style="flex:1; height:40px; font-size:13px;" onclick="openEditAdModal(${ad.id})">Изменить</button>
              <button class="btn btn-ghost btn-sm" style="width:40px; border:1px solid var(--red); height:40px; color: var(--red); padding:0;" onclick="deleteAd(${ad.id})">🗑</button>
            </div>
          </div>
        `).join('') : '<div class="empty-state">Нет активных объявлений</div>';
      } catch (e) { list.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    window.deleteAd = async function(adId) {
      if (!await confirmAsync('Удаление', 'Удалить объявление? Действие необратимо.', 'Удалить')) return;
      try { await API.req('DELETE', '/ads/' + adId); toast('Объявление удалено', 'success'); loadMyAds(); screenCache.market = false; }
      catch(e) { toast(e.message || 'Ошибка', 'error'); }
    };

    window.toggleAdStatus = async function(adId, currentStatus) {
      try { await API.req('PATCH', '/ads/' + adId, { active: !currentStatus }); toast(currentStatus ? 'Снято' : 'Активировано', 'success'); screenCache.market = false; loadMyAds(); }
      catch(e) { toast('Ошибка', 'error'); }
    };

    window.openEditAdModal = function(adId) {
      API.req('GET', '/ads/' + adId).then(ad => {
        document.getElementById('edit-price').value = ad.price;
        document.getElementById('edit-amount').value = ad.amountTotal;
        document.getElementById('edit-min').value = ad.minRub;
        document.getElementById('edit-max').value = ad.maxRub;
        document.getElementById('edit-terms').value = ad.terms || '';
        
        const payBox = document.getElementById('edit-payments');
        payBox.innerHTML = '';
        const allPayments = ['СБП', 'Тинькофф', 'Сбербанк', 'Альфа-Банк', 'ВТБ', 'Райффайзен'];
        allPayments.forEach(p => {
           const el = document.createElement('div');
           el.className = 'pay-chip' + (ad.paymentMethods.includes(p) ? ' active' : '');
           el.innerHTML = `${getPayIcon(p)} ${p}`;
           el.style.display = 'inline-flex'; el.style.alignItems = 'center'; el.style.gap = '4px';
           el.onclick = () => el.classList.toggle('active');
           payBox.appendChild(el);
        });

        document.getElementById('editError').textContent = '';
        document.getElementById('editSaveBtn').onclick = async () => {
          const btn = document.getElementById('editSaveBtn'); btn.disabled = true; btn.textContent = '...';
          const selectedPayments = [...payBox.querySelectorAll('.pay-chip.active')].map(c => c.dataset.val || c.textContent.trim());
          if (!selectedPayments.length) { document.getElementById('editError').textContent = 'Выберите хотя бы один способ оплаты'; btn.disabled = false; btn.textContent = 'Сохранить'; return; }
          try {
            await API.req('PATCH', '/ads/' + adId, { price: document.getElementById('edit-price').value, amount_total: document.getElementById('edit-amount').value, min_rub: document.getElementById('edit-min').value, max_rub: document.getElementById('edit-max').value, payment_methods: selectedPayments, terms: document.getElementById('edit-terms').value });
            toast('Обновлено!', 'success'); closeModal('editAdModal'); screenCache.market = false; loadMyAds();
          } catch (err) { document.getElementById('editError').textContent = err.message; }
          finally { btn.disabled = false; btn.textContent = 'Сохранить'; }
        };
        document.getElementById('editAdModal').classList.add('active');
      });
    };

    async function loadMyHistory() {
      const list = document.getElementById('myHistoryList'); if (!list) return;
      try {
        const { items } = await API.req('GET', '/orders/my?status=completed');
        list.innerHTML = items.length ? items.map(o => `<div class="glass-card" style="margin-bottom:12px; border-left:4px solid var(--grn); padding:16px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong style="font-size:15px;">#${o.publicId}</strong><span style="color:var(--grn);font-size:12px;font-weight:700;">Завершен</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><div style="font-size:12px;color:var(--dim);font-weight:600;">Сумма</div><div style="font-size:15px;font-weight:800;">${fmtDec(o.amountRub, 2)} ₽</div></div><div><div style="font-size:12px;color:var(--dim);font-weight:600;">Актив</div><div style="font-size:15px;font-weight:800;">${fmtDec(o.amountAsset, 2)} ${o.asset}</div></div></div></div>`).join('') : '<div class="empty-state">Пусто</div>';
      } catch (e) { list.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    async function loadMyReviews() {
      const list = document.getElementById('myReviewsList'); if (!list) return;
      try {
        const u = API.user();
        const data = await API.req('GET', '/reviews/user/' + u.id);
        const items = data.items || [];
        list.innerHTML = items.length ? items.map(r => `<div class="glass-card" style="margin-bottom:12px; padding:14px;"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong style="font-size:14px;">${r.author}</strong><span style="color:var(--yellow);font-size:14px;">${'★'.repeat(r.rating)}</span></div><p style="font-size:13px;color:var(--dim);font-weight:500;">${r.comment || 'Без комментария'}</p></div>`).join('') : '<div class="empty-state">Нет отзывов</div>';
      } catch (e) { list.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    // === НОВАЯ ЛОГИКА ЗАЯВОК ===
    async function loadMyRequests() {
      const list = document.getElementById('myRequestsList'); if (!list) return;
      try {
        const { items } = await API.req('GET', '/requests/my');
        
        const statusMap = {
          pending: { l: 'На рассмотрении', c: 'var(--yellow)' },
          processing: { l: 'В обработке', c: 'var(--blue)' },
          success: { l: 'Успешно', c: 'var(--grn)' },
          failed: { l: 'Не выполнено', c: 'var(--red)' },
          cancelled: { l: 'Отменено', c: 'var(--dim)' }
        };

        list.innerHTML = items.length ? items.map(r => {
          const st = statusMap[r.status] || { l: r.status, c: 'var(--txt)' };
          let typeLabel = r.type;
          if (r.type === 'exchange') typeLabel = r.details?.exchange_type === 'buy' ? 'Покупка USDT' : 'Продажа USDT';
          if (r.type === 'deposit_rub') typeLabel = 'Пополнение RUB';
          if (r.type === 'withdraw_rub') typeLabel = 'Вывод RUB';
          if (r.type === 'deposit_usdt') typeLabel = 'Пополнение USDT';
          if (r.type === 'withdraw_usdt') typeLabel = 'Вывод USDT';

          const reqData = encodeURIComponent(JSON.stringify(r));

          return `<div class="glass-card" style="margin-bottom:12px; border-left:4px solid ${st.c}; padding:16px; cursor:pointer;" onclick="openRequestDetails('${reqData}')">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <strong style="font-size:15px; color:var(--txt);">#${r.id + 1000} <span style="font-size:12px;color:var(--dim);font-weight:500;">${typeLabel}</span></strong>
              <span style="color:${st.c}; font-size:12px; font-weight:800; text-transform:uppercase;">${st.l}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;">
              <div style="font-size:14px; color:var(--txt); font-weight:700;">${fmtDec(r.amount, 2)} ${r.currency}</div>
              <div style="font-size:11px; color:var(--dim);">${new Date(r.created_at).toLocaleDateString('ru-RU')}</div>
            </div>
          </div>`;
        }).join('') : '<div class="empty-state">Нет заявок</div>';
      } catch (e) { list.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    window.openRequestDetails = function(encodedData) {
      const r = JSON.parse(decodeURIComponent(encodedData));
      const details = r.details || {};
      const m = document.getElementById('requestDetailModal');
      const c = document.getElementById('requestDetailContent');
      
      const reqId = r.id + 1000;
      
      const statusMap = {
        pending: { l: 'На рассмотрении', class: 'processing', icon: '⏱' },
        processing: { l: 'В обработке', class: 'processing', icon: '⏳' },
        success: { l: 'Успешно', class: 'success', icon: '✓' },
        failed: { l: 'Не выполнено', class: 'failed', icon: '✕' },
        cancelled: { l: 'Отменено', class: 'rejected', icon: '✕' }
      };
      const st = statusMap[r.status] || statusMap.pending;

      let fromAmount = fmtDec(r.amount, 2);
      let fromCurr = r.currency;
      let toAmount = '—';
      let toCurr = '';
      let rateVal = details.rate || 90; 

      if (r.type === 'withdraw_usdt') { toAmount = fmtDec(r.amount * rateVal, 0); toCurr = '₽'; }
      else if (r.type === 'deposit_rub') { toAmount = fmtDec(r.amount / rateVal, 2); toCurr = 'USDT'; }
      else if (r.type === 'exchange') {
          if (details.exchange_type === 'buy') { fromAmount = fmtDec(r.amount, 0); fromCurr = '₽'; toAmount = fmtDec(r.amount / rateVal, 2); toCurr = 'USDT'; }
          else { fromAmount = fmtDec(r.amount, 2); fromCurr = 'USDT'; toAmount = fmtDec(r.amount * rateVal, 0); toCurr = '₽'; }
      } else if (r.type === 'deposit_usdt') { toAmount = fmtDec(r.amount * rateVal, 0); toCurr = '₽'; }
      else if (r.type === 'withdraw_rub') { toAmount = fmtDec(r.amount / rateVal, 2); toCurr = 'USDT'; }

      const rateStr = `${fmtDec(rateVal, 2)} ₽ / USDT`;

      let userActionHtml = '';
      if (r.status === 'processing') {
          userActionHtml = `
            <div style="margin-top:20px; padding:16px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); border-radius:16px;">
              <div style="font-size:14px; font-weight:800; color:var(--txt); margin-bottom:8px;">Оплатите по реквизитам:</div>
              <div style="font-size:16px; font-weight:900; color:var(--primary); margin-bottom:4px; word-break:break-all;">${r.assigned_requisite || 'Ожидайте'}</div>
              <div style="font-size:12px; color:var(--dim); margin-bottom:12px;">${r.admin_comment || ''}</div>
              <input type="file" id="reqReceiptFile" style="display:none;" accept="image/*,application/pdf">
              <button class="btn btn-primary btn-block btn-sm" onclick="document.getElementById('reqReceiptFile').click()" style="margin-bottom:8px; height:40px;">Прикрепить чек</button>
              <div id="reqReceiptName" style="font-size:12px; color:var(--grn); margin-bottom:8px; font-weight:600; text-align:center;"></div>
              <button class="btn btn-primary btn-block" id="confirmReqPayBtn" style="height:44px;">Подтвердить оплату</button>
            </div>
          `;
      } else if (r.status === 'success' || r.status === 'failed' || r.status === 'cancelled') {
          userActionHtml = `
            <div style="margin-top:20px; padding:16px; background:rgba(255,255,255,0.05); border:1px solid var(--card-border); border-radius:16px; text-align:center;">
              <div style="font-size:14px; font-weight:800; color:${st.class === 'success' ? 'var(--grn)' : 'var(--red)'}; margin-bottom:4px;">${st.l}</div>
              <div style="font-size:12px; color:var(--dim);">${r.admin_comment || 'Заявка обработана'}</div>
              ${r.receipt_data ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="viewReceipt('${r.receipt_data}')">Посмотреть чек</button>` : ''}
            </div>
          `;
      }

      c.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding: 0 4px;">
          <button class="btn btn-ghost" style="width:44px; height:44px; border-radius:50%; padding:0; flex-shrink:0; border: none !important; background: transparent !important;" onclick="closeModal('requestDetailModal')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h2 style="font-size:22px; font-weight:800; color:var(--txt); margin:0; letter-spacing: -0.5px;">Заявка #${reqId}</h2>
        </div>

        <div class="request-card">
          <div class="req-status ${st.class}">
            <div class="req-status-icon">${st.icon}</div>
            ${st.l}
          </div>

          <div class="req-amount-block">
            <div class="req-label">ВЫ ОТДАЁТЕ</div>
            <div class="req-value">${fromAmount} <span>${fromCurr}</span></div>
          </div>

          <div class="ticket-divider"></div>

          <div class="req-amount-block">
            <div class="req-label">ВЫ ПОЛУЧИТЕ</div>
            <div class="req-value">${toAmount} <span>${toCurr}</span></div>
          </div>

          <div class="req-details" style="margin-top: 28px;">
            <div class="req-detail-row"><span class="label">заявка</span><span class="value">#${reqId}</span></div>
            <div class="req-detail-row"><span class="label">курс</span><span class="value">${rateStr}</span></div>
            <div class="req-detail-row"><span class="label">оператор</span><span class="value">${r.processed_by ? '@' + r.processed_by : '—'}</span></div>
          </div>
        </div>

        ${userActionHtml}

        <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px;">
          <button class="btn btn-ghost" style="margin-top:8px; height:50px; font-size:15px; border:none !important; color:var(--dim);" onclick="closeModal('requestDetailModal')">Готово</button>
        </div>
      `;
      
      if (r.status === 'processing') {
        let tempReqReceipt = null;
        const fileInput = document.getElementById('reqReceiptFile');
        if (fileInput) {
           fileInput.onchange = async (e) => {
             const file = e.target.files[0];
             if (file) {
               document.getElementById('reqReceiptName').textContent = 'Загрузка...';
               try { tempReqReceipt = await fileToBase64(file); document.getElementById('reqReceiptName').textContent = '✓ Чек прикреплен'; }
               catch(err) { toast('Ошибка', 'error'); }
             }
           };
        }
        
        document.getElementById('confirmReqPayBtn').onclick = async () => {
           if (!tempReqReceipt && !r.receipt_data) return toast('Прикрепите чек', 'error');
           const btn = document.getElementById('confirmReqPayBtn'); btn.disabled = true; btn.textContent = '...';
           try {
              await API.req('PATCH', `/requests/${r.id}/receipt`, { receipt_data: tempReqReceipt || r.receipt_data });
              toast('Чек отправлен! Ожидайте проверки.', 'success');
              closeModal('requestDetailModal');
              loadProfile();
           } catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Подтвердить оплату'; }
        };
      }

      m.classList.add('active');
    };

    window.openSettings = async function() {
      const u = API.user(); if (!u) return;
      document.getElementById('settingsAvatarUrl').value = u.avatarUrl || '';
      document.getElementById('settingsName').value = u.displayName || '';
      document.getElementById('settingsEmail').value = u.email;
      document.getElementById('settingsCurrentPass').value = '';
      document.getElementById('settingsNewPass').value = '';
      document.getElementById('settingsError').textContent = '';
      
      try {
        const { user, stats } = await API.req('GET', '/users/me');
        const container = document.getElementById('statusProgressContainer');
        let progressHtml = '';
        if (user.isMaker) { progressHtml += `<div style="font-size:14px; color:var(--txt); font-weight:700; display:flex; align-items:center; gap:8px;"><span class="badge-maker" style="width:24px;height:24px;">${ICONS.maker}</span> Мейкер активен</div>`; }
        else {
          progressHtml += `
            <div style="background:var(--glass-bg); padding:12px; border-radius:12px; border:1px solid var(--card-border);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:13px; font-weight:800; color:var(--gold);">Статус Мейкера</div>
                <button class="btn btn-primary btn-sm" onclick="applyStatus('maker')" style="padding:4px 8px; font-size:12px; height:28px;">Подать</button>
              </div>
              <div style="font-size:12px; color:var(--dim); margin-bottom:2px;">Оборот: $${fmtDec(stats.volumeUsd, 2)} / $3k</div>
              <div style="font-size:12px; color:var(--dim);">Успешных: ${stats.successRate}% / 80%</div>
            </div>
          `;
        }
        if (user.isMerchant) { progressHtml += `<div style="font-size:14px; color:var(--txt); font-weight:700; display:flex; align-items:center; gap:8px;"><span class="badge-merchant" style="width:24px;height:24px;">${ICONS.merchant}</span> Мерчант активен</div>`; }
        else {
          progressHtml += `
            <div style="background:var(--glass-bg); padding:12px; border-radius:12px; border:1px solid var(--card-border);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:13px; font-weight:800; color:var(--blue);">Статус Мерчанта</div>
                <button class="btn btn-primary btn-sm" onclick="applyStatus('merchant')" style="padding:4px 8px; font-size:12px; height:28px;">Подать</button>
              </div>
            </div>
          `;
        }
        container.innerHTML = progressHtml;
      } catch (e) { console.error(e); }
      document.getElementById('settingsModal').classList.add('active');
    };

    window.applyStatus = async function(type) {
      try { await API.req('POST', '/users/apply', { type }); toast('Заявка отправлена!', 'success'); closeModal('settingsModal'); }
      catch(e) { toast(e.message, 'error'); }
    };

    document.getElementById('settingsSaveBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('settingsSaveBtn'); btn.disabled = true; btn.textContent = '...';
      try {
        const payload = { displayName: document.getElementById('settingsName').value, avatarUrl: document.getElementById('settingsAvatarUrl').value, email: document.getElementById('settingsEmail').value };
        const curPass = document.getElementById('settingsCurrentPass').value;
        const newPass = document.getElementById('settingsNewPass').value;
        if (newPass) { if (!curPass) throw new Error('Введите текущий пароль'); payload.currentPassword = curPass; payload.password = newPass; }
        const { user } = await API.req('PATCH', '/users/me', payload);
        localStorage.setItem('vexo_user', JSON.stringify(user));
        closeModal('settingsModal'); toast('Сохранено', 'success'); addNotification('Настройки обновлены.', 'success');
        updateAuthUI(); screenCache.profile = false; loadProfile();
      } catch (e) { const er = document.getElementById('settingsError'); if (er) er.textContent = e.message === 'wrong_password' ? 'Неверный пароль' : e.message; }
      finally { btn.disabled = false; btn.textContent = 'Сохранить'; }
    });

    let currentAd = null, selectedPay = null, priceTimerInterval = null;
    window.openOrderModal = function(adId) {
      const ad = (window._ads || {})[adId];
      if (!ad) return;
      currentAd = ad; selectedPay = ad.paymentMethods?.[0] || null; window.currentAd = ad;
      const isBuy = ad.side === 'sell';
      const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      
      setText('orderTitle', (isBuy ? 'Покупка ' : 'Продажа ') + ad.asset);
      setText('orderUsername', ad.displayName);
      setText('orderUserMeta', (ad.faceType === 'first' ? '1-е лицо' : '3-е лицо') + ' · ★ ' + (ad.ratingAvg || '—'));
      setText('orderRate', fmt(ad.price) + ' ₽');
      setText('orderAvailable', fmtDec(ad.amountLeft, 2) + ' ' + ad.asset);
      setText('orderLimit', `Лимит: ${fmt(ad.minRub)} - ${fmt(ad.maxRub)} ₽`);
      setText('orderResultLabel', isBuy ? 'Вы получите' : 'Вы отдадите');
      setText('orderResult', '0 ' + ad.asset);
      setText('orderTotalBottom', '0 RUB');
      setText('orderTerms', ad.terms || 'Стандартные условия сделки.');
      setText('orderError', '');

      const ownerProfileEl = document.getElementById('orderAdOwnerProfile');
      if (ownerProfileEl) { ownerProfileEl.onclick = () => openPublicProfile(ad.userId); }

      const amountInput = document.getElementById('orderAmount');
      if (amountInput) {
        amountInput.value = '';
        const realMaxRub = Math.min(ad.maxRub, ad.amountLeft * ad.price);
        setText('orderLimit', `Лимит: ${fmt(ad.minRub)} - ${fmt(realMaxRub)} ₽`);
        amountInput.oninput = e => {
          const rub = parseFloat(e.target.value) || 0;
          setText('orderResult', fmtDec(rub / ad.price, 4) + ' ' + ad.asset);
          setText('orderTotalBottom', fmt(rub) + ' RUB');
          const errEl = document.getElementById('orderError'); const btn = document.getElementById('orderSubmit');
          if (rub > 0 && (rub < ad.minRub || rub > realMaxRub)) {
             if (errEl) errEl.textContent = `Сумма от ${fmt(ad.minRub)} до ${fmt(realMaxRub)} ₽`;
             if (btn) { btn.style.opacity = '0.5'; btn.disabled = true; }
             amountInput.style.borderColor = 'var(--red)';
          } else {
             if (errEl) errEl.textContent = '';
             if (btn) { btn.style.opacity = '1'; btn.disabled = false; }
             amountInput.style.borderColor = 'var(--primary)';
          }
        };
      }
      
      document.getElementById('btnOrderMax').onclick = () => {
        const realMaxRub = Math.min(ad.maxRub, ad.amountLeft * ad.price);
        amountInput.value = realMaxRub.toFixed(2); amountInput.dispatchEvent(new Event('input'));
      };

      const payBox = document.getElementById('orderPayments');
      if (!payBox) return;
      payBox.innerHTML = '';
      (ad.paymentMethods || []).forEach(p => {
        const el = document.createElement('div');
        el.className = 'pay-chip' + (p === selectedPay ? ' active' : ''); 
        el.innerHTML = `${getPayIcon(p)} ${p}`;
        el.style.display = 'inline-flex'; el.style.alignItems = 'center'; el.style.gap = '4px';
        el.onclick = () => { payBox.querySelectorAll('.pay-chip').forEach(x => x.classList.remove('active')); el.classList.add('active'); selectedPay = p; };
        payBox.appendChild(el);
      });
      
      const btn = document.getElementById('orderSubmit');
      btn.className = 'btn ' + (isBuy ? 'btn-buy' : 'btn-sell');
      btn.textContent = isBuy ? 'Купить' : 'Продать';
      btn.disabled = false; btn.style.opacity = '1'; btn.onclick = submitOrder;
      
      let timeLeft = 60; const timerEl = document.getElementById('priceTimer');
      if (timerEl) timerEl.textContent = timeLeft + 's';
      if (priceTimerInterval) clearInterval(priceTimerInterval);
      priceTimerInterval = setInterval(async () => {
        timeLeft--; if (timerEl) timerEl.textContent = timeLeft + 's';
        if (timeLeft <= 0) {
          clearInterval(priceTimerInterval); if (timerEl) timerEl.textContent = 'Обновление...';
          try {
            const freshAd = await API.req('GET', '/ads/' + ad.id);
            if (freshAd.price !== ad.price) {
              currentAd = freshAd; window._ads[ad.id] = freshAd; ad.price = freshAd.price;
              setText('orderRate', fmt(ad.price) + ' ₽'); toast('Курс обновился!', 'error');
              if (amountInput.value) amountInput.dispatchEvent(new Event('input'));
            }
          } catch(e) { console.log('Ошибка обновления', e); }
          timeLeft = 60; if (timerEl) timerEl.textContent = timeLeft + 's';
        }
      }, 1000);
      document.getElementById('orderModal').classList.add('active');
    };

    async function submitOrder() {
      const errEl = document.getElementById('orderError'); if (errEl) errEl.textContent = '';
      const rub = parseFloat(document.getElementById('orderAmount').value) || 0;
      if (!selectedPay) { if (errEl) errEl.textContent = 'Выберите способ оплаты'; return; }
      const realMaxRub = Math.min(currentAd.maxRub, currentAd.amountLeft * currentAd.price);
      if (rub < currentAd.minRub) { if (errEl) errEl.textContent = 'Минимум ' + fmt(currentAd.minRub) + ' ₽'; return; }
      if (rub > realMaxRub) { if (errEl) errEl.textContent = 'Максимум ' + fmt(realMaxRub) + ' ₽'; return; }
      
      const btn = document.getElementById('orderSubmit'); btn.disabled = true; btn.textContent = '...';
      try {
        const order = await API.req('POST', '/orders', { ad_id: currentAd.id, amount_rub: rub, payment_method: selectedPay });
        closeModal('orderModal'); toast('Заявка создана!', 'success'); addNotification(`Создана новая заявка #${order.publicId}`, 'success');
        screenCache.orders = false; screenCache.market = false; openOrderPage(order.id);
      } catch (err) { if (errEl) errEl.textContent = err.message; }
      finally { btn.disabled = false; btn.textContent = currentAd ? (currentAd.side === 'sell' ? 'Купить' : 'Продать') : 'OK'; }
    }

    window.logoutAction = async function() {
      if (await confirmAsync('Выход', 'Выйти из аккаунта?', 'Выйти')) { localStorage.removeItem('vexo_token'); localStorage.removeItem('vexo_user'); location.reload(); }
    };

    // === АДМИНКА ===
    let adminTab = 'users';
    let currentAdminUserId = null;
    let allAdminUsers = []; 
    let allRequisites = [];

    async function loadAdmin() {
      const u = API.user();
      if (!u || !['admin', 'owner', 'deputy'].includes(u.role)) return;
      
      const content = document.getElementById('adminContent');
      const searchInput = document.getElementById('adminUserSearch');
      if (!content) return;

      try {
        if (adminTab === 'users') {
          searchInput.style.display = 'block'; content.innerHTML = 'Загрузка...';
          const { items } = await API.req('GET', '/admin/users'); allAdminUsers = items;
          const renderUsers = (query = '') => {
            let filtered = allAdminUsers;
            if (query) {
               const q = query.toLowerCase();
               filtered = allAdminUsers.filter(user => user.id.toString() === q || user.username.toLowerCase().includes(q) || (user.displayName || '').toLowerCase().includes(q));
            }
            if (!filtered.length) { content.innerHTML = '<div class="empty-state">Не найдено</div>'; return; }
            content.innerHTML = filtered.map(user => `
              <div class="admin-user-card">
                <div class="admin-user-info">
                  <div class="admin-user-name">ID: ${user.id} | ${user.displayName} (@${user.username})</div>
                  <div class="admin-user-meta">Роль: ${user.role} | Бал: ${fmtDec(user.balanceRub, 2)} ₽</div>
                </div>
                <button class="btn btn-primary btn-sm" style="border-radius: 8px; padding: 6px 12px; height:32px; font-size:13px;" onclick="openAdminUserModal(${user.id})">⚙️</button>
              </div>
            `).join('');
          };
          renderUsers(searchInput.value); searchInput.oninput = () => renderUsers(searchInput.value);
        } 
        else if (adminTab === 'disputes') {
          searchInput.style.display = 'none'; content.innerHTML = 'Загрузка...';
          const { items } = await API.req('GET', '/admin/orders');
          if (!items.length) { content.innerHTML = '<div class="empty-state">Нет споров</div>'; return; }
          content.innerHTML = items.map(o => `
            <div class="ad-card" style="cursor:pointer; border-left:4px solid ${o.status === 'dispute' ? 'var(--gold)' : 'var(--blue)'}; padding:14px; margin-bottom:12px;" onclick="openAdminOrder(${o.id})">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <strong style="font-family:Inter,monospace;font-size:15px;">#${o.publicId}</strong>
                <span style="color:var(--txt);font-size:12px;font-weight:800">${o.statusLabel}</span>
              </div>
              <div class="ad-body">
                <div><div class="ad-lbl" style="font-size:12px;color:var(--dim);">Сумма</div><div class="ad-val" style="font-size:15px;font-weight:800;">${fmtDec(o.amountRub, 2)} ₽</div></div>
                <div><div class="ad-lbl" style="font-size:12px;color:var(--dim);">Актив</div><div class="ad-val" style="font-size:15px;font-weight:800;">${fmtDec(o.amountAsset, 2)} ${o.asset}</div></div>
              </div>
            </div>
          `).join('');
        }
        else if (adminTab === 'requests') {
          searchInput.style.display = 'none'; content.innerHTML = 'Загрузка...';
          const { items } = await API.req('GET', '/admin/requests');
          if (!items.length) { content.innerHTML = '<div class="empty-state">Нет заявок</div>'; return; }

          content.innerHTML = items.map(req => {
            const statusMap = {
              pending: { l: 'На рассмотрении', c: 'var(--yellow)' },
              processing: { l: 'В обработке', c: 'var(--blue)' },
              success: { l: 'Успешно', c: 'var(--grn)' },
              failed: { l: 'Не выполнено', c: 'var(--red)' },
              cancelled: { l: 'Отменено', c: 'var(--dim)' }
            };
            const st = statusMap[req.status] || { l: req.status, c: 'var(--txt)' };
            
            let typeLabel = req.type;
            if (req.type === 'exchange') typeLabel = 'Обмен';
            if (req.type === 'deposit_rub') typeLabel = 'Деп RUB';
            if (req.type === 'withdraw_rub') typeLabel = 'Выв RUB';
            if (req.type === 'deposit_usdt') typeLabel = 'Деп USDT';
            if (req.type === 'withdraw_usdt') typeLabel = 'Выв USDT';
            
            const details = req.details || {};
            
            return `
            <div class="glass-card" style="padding:14px; margin-bottom:12px; border-left:4px solid ${st.c};">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <strong style="font-size:15px; color:var(--txt);">${typeLabel} #${req.id + 1000}</strong>
                <span style="font-size:12px; font-weight:800; color:${st.c}; text-transform:uppercase;">${st.l}</span>
              </div>
              <div style="font-size:13px; color:var(--dim); margin-bottom:6px;">@${req.username}</div>
              ${req.amount ? `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;"><div style="font-size:12px; color:var(--dim);">Сумма:</div><div style="font-size:15px; font-weight:800; color:var(--txt);">${fmtDec(req.amount, 2)} ${req.currency}</div></div>` : ''}
              
              <button class="btn btn-primary btn-block btn-sm" style="margin-top:8px; height:36px; font-size:12px;" onclick="openAssignRequisite(${req.id}, ${req.amount}, '${req.currency}')">Обработать / Назначить</button>
            </div>
          `}).join('');
        }
        else if (adminTab === 'requisites') {
          searchInput.style.display = 'none';
          content.innerHTML = `
            <button class="btn btn-primary btn-block" style="margin-bottom: 16px; height: 48px;" onclick="openRequisiteModal()">+ Добавить реквизит</button>
            <div id="adminRequisitesList">Загрузка...</div>
          `;
          loadAdminRequisites();
        }
        else if (adminTab === 'stats') {
          searchInput.style.display = 'none';
          content.innerHTML = `
            <div class="tabs" id="statsFilter" style="margin-bottom: 16px;">
              <button class="tab active" data-val="day">День</button><button class="tab" data-val="week">Неделя</button><button class="tab" data-val="month">Месяц</button><button class="tab" data-val="all">Все</button>
            </div>
            <div id="statsResult" class="glass-card" style="padding: 20px;"><div class="empty-state">Загрузка...</div></div>
          `;
          document.querySelectorAll('#statsFilter .tab').forEach(t => {
             t.onclick = () => { document.querySelectorAll('#statsFilter .tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); fetchStats(t.dataset.val); }
          });
          fetchStats('day');
        }
      } catch(e) { content.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    async function loadAdminRequisites() {
      const list = document.getElementById('adminRequisitesList'); if (!list) return;
      try {
        const { items } = await API.req('GET', '/admin/requisites');
        allRequisites = items;
        list.innerHTML = items.length ? items.map(r => `
          <div class="glass-card" style="padding:16px; margin-bottom:12px; opacity: ${r.active ? 1 : 0.5}; transition: 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div>
                <strong style="font-size:16px; color:var(--txt); display:flex; align-items:center; gap:6px;">${getPayIcon(r.type)} ${r.name}</strong>
                <div style="font-size:14px; font-weight:800; color:var(--primary); margin-top:4px;">${r.value}</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" ${r.active ? 'checked' : ''} onchange="toggleRequisiteStatus(${r.id}, this.checked)">
                <span class="slider"></span>
              </label>
            </div>
            <div style="font-size:12px; color:var(--dim); display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:12px;">
              <div>Лимит: ${fmt(r.min_limit)} - ${fmt(r.max_limit)}</div>
              <div>Оборот: ${fmt(r.turnover)} ₽</div>
              <div>Депозиты: ${r.stats_dep_count || 0} / ${r.total_dep_count || 0}</div>
              <div>Выводы: ${r.stats_wd_count || 0} / ${r.total_wd_count || 0}</div>
            </div>
            <div style="display:flex; gap:8px;">
               <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="openRequisiteModal(${r.id})">Изменить</button>
               <button class="btn btn-ghost btn-sm" style="border-color:var(--red); color:var(--red);" onclick="deleteRequisite(${r.id})">🗑</button>
            </div>
          </div>
        `).join('') : '<div class="empty-state">Реквизитов нет</div>';
      } catch(e) { list.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    window.toggleRequisiteStatus = async function(id, isActive) {
      try {
        await API.req('PATCH', '/admin/requisites/' + id, { active: isActive });
        toast(isActive ? 'Реквизит активен' : 'Реквизит скрыт', 'success');
        loadAdminRequisites();
      } catch(e) { toast('Ошибка', 'error'); }
    };

    window.openRequisiteModal = function(id = null) {
      const r = id ? allRequisites.find(x => x.id === id) : null;
      document.getElementById('requisiteModalTitle').textContent = id ? 'Редактировать реквизит' : 'Добавить реквизит';
      document.getElementById('req-type').value = r?.type || '';
      document.getElementById('req-name').value = r?.name || '';
      document.getElementById('req-value').value = r?.value || '';
      document.getElementById('req-min').value = r?.min_limit || '';
      document.getElementById('req-max').value = r?.max_limit || '';
      document.getElementById('req-total-dep-count').value = r?.total_dep_count || '';
      document.getElementById('req-total-dep-sum').value = r?.total_dep_sum || '';
      document.getElementById('req-total-wd-count').value = r?.total_wd_count || '';
      document.getElementById('req-total-wd-sum').value = r?.total_wd_sum || '';
      document.getElementById('req-turnover').value = r?.turnover || '';
      document.getElementById('req-active').checked = r ? r.active : true;
      document.getElementById('req-error').textContent = '';
      
      document.getElementById('req-save-btn').onclick = async () => {
        const btn = document.getElementById('req-save-btn'); btn.disabled = true; btn.textContent = '...';
        const payload = {
          type: document.getElementById('req-type').value,
          name: document.getElementById('req-name').value,
          value: document.getElementById('req-value').value,
          min_limit: Number(document.getElementById('req-min').value),
          max_limit: Number(document.getElementById('req-max').value),
          total_dep_count: Number(document.getElementById('req-total-dep-count').value),
          total_dep_sum: Number(document.getElementById('req-total-dep-sum').value),
          total_wd_count: Number(document.getElementById('req-total-wd-count').value),
          total_wd_sum: Number(document.getElementById('req-total-wd-sum').value),
          turnover: Number(document.getElementById('req-turnover').value),
          active: document.getElementById('req-active').checked
        };
        if(!payload.name || !payload.value) { document.getElementById('req-error').textContent = 'Заполните название и сам реквизит'; btn.disabled = false; btn.textContent = 'Сохранить'; return; }
        try {
          if (id) await API.req('PATCH', '/admin/requisites/' + id, payload);
          else await API.req('POST', '/admin/requisites', payload);
          toast('Сохранено', 'success'); closeModal('requisiteModal'); loadAdminRequisites();
        } catch(err) { document.getElementById('req-error').textContent = err.message; }
        finally { btn.disabled = false; btn.textContent = 'Сохранить'; }
      };
      
      document.getElementById('requisiteModal').classList.add('active');
    };

    window.deleteRequisite = async function(id) {
      if (!await confirmAsync('Удаление', 'Удалить реквизит?', 'Удалить')) return;
      try { await API.req('DELETE', '/admin/requisites/' + id); toast('Удалено', 'success'); loadAdminRequisites(); }
      catch(e) { toast('Ошибка', 'error'); }
    };

    // Назначение реквизита для заявки
    window.openAssignRequisite = async function(reqId, amount, currency) {
      document.getElementById('assign-req-id').textContent = reqId + 1000;
      const select = document.getElementById('assign-requisite-select');
      select.innerHTML = '<option value="">Выберите...</option>';
      
      // Фильтруем активные реквизиты, подходящие по лимитам
      const suitable = allRequisites.filter(r => r.active && amount >= r.min_limit && amount <= r.max_limit);
      suitable.forEach(r => {
         const opt = document.createElement('option');
         opt.value = r.id;
         opt.textContent = `${r.name} (${r.value})`;
         select.appendChild(opt);
      });

      if (!suitable.length) {
         select.innerHTML = '<option value="">Нет подходящих активных реквизитов</option>';
      }

      document.getElementById('assign-comment').value = '';
      document.getElementById('assign-status').value = 'processing';
      
      document.getElementById('assign-save-btn').onclick = async () => {
        const reqIdActual = reqId; // Берем реальный ID
        const reqToFind = allRequisites.find(r => r.id == select.value);
        if (!select.value || !reqToFind) return toast('Выберите реквизит', 'error');
        
        const btn = document.getElementById('assign-save-btn'); btn.disabled = true; btn.textContent = '...';
        try {
          await API.req('PATCH', '/admin/requests/' + reqIdActual, {
            status: document.getElementById('assign-status').value,
            admin_comment: document.getElementById('assign-comment').value,
            assigned_requisite: reqToFind.value
          });
          toast('Заявка обновлена', 'success');
          closeModal('assignRequisiteModal');
          loadAdmin();
        } catch(e) { toast(e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Сохранить'; }
      };
      
      document.getElementById('assignRequisiteModal').classList.add('active');
    };

    async function fetchStats(period) {
      const resEl = document.getElementById('statsResult'); if (!resEl) return;
      resEl.innerHTML = 'Загрузка...';
      try {
         const { count, total, avg } = await API.req('GET', '/admin/stats?period=' + period);
         resEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;"><div style="font-size:14px; font-weight:700; color:var(--dim);">Кол-во выводов:</div><div style="font-size:24px; font-weight:900; color:var(--txt);">${count}</div></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;"><div style="font-size:14px; font-weight:700; color:var(--dim);">Общая сумма:</div><div style="font-size:20px; font-weight:900; color:var(--grn);">${fmt(total)}</div></div>
            <div style="display:flex; justify-content:space-between; align-items:center;"><div style="font-size:14px; font-weight:700; color:var(--dim);">Среднее в день:</div><div style="font-size:20px; font-weight:900; color:var(--blue);">${fmtDec(avg, 2)}</div></div>
         `;
      } catch(e) { resEl.innerHTML = '<div class="empty-state">Ошибка</div>'; }
    }

    window.openAdminUserModal = async function(userId) {
      currentAdminUserId = userId;
      const m = document.getElementById('adminUserModal'); const info = document.getElementById('adminUserInfo');
      if (!m || !info) return; info.innerHTML = 'Загрузка...'; m.classList.add('active');
      try {
        const { user, stats } = await API.req('GET', '/users/' + userId);
        let avatarHtml = `<div class="avatar" style="width:36px;height:36px;font-size:16px;">${user.displayName[0].toUpperCase()}</div>`;
        if (user.avatarUrl) avatarHtml = `<div class="avatar" style="width:36px;height:36px;"><img src="${user.avatarUrl}"></div>`;
        info.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            ${avatarHtml}
            <div><h3 style="font-size:16px; font-weight:800; margin:0;">${user.displayName} (ID: ${user.id})</h3><div style="font-size:12px; color:var(--dim);">@${user.username}</div></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px;"><div style="font-size:11px; color:var(--dim);">RUB</div><div style="font-size:14px; font-weight:800; color:var(--txt);">${fmtDec(user.balanceRub, 2)} ₽</div></div>
            <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px;"><div style="font-size:11px; color:var(--dim);">USDT</div><div style="font-size:14px; font-weight:800; color:var(--txt);">${fmtDec(user.balanceUsdt, 2)} ₮</div></div>
          </div>
        `;
        const updBtn = (id, isActive) => {
          const btn = document.getElementById(id); if (!btn) return;
          if (isActive) { btn.classList.add('btn-primary'); btn.classList.remove('btn-ghost'); btn.style.background = 'var(--grn)'; btn.style.color = '#fff'; }
          else { btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); btn.style.background = ''; btn.style.color = ''; }
        };
        updBtn('admTogglePro', user.isPro); updBtn('admToggleMerchant', user.isMerchant); updBtn('admToggleMaker', user.isMaker);
      } catch (e) { info.innerHTML = 'Ошибка'; }
    };

    window.toggleAdminUserStatus = async function(field) {
      if (!currentAdminUserId) return;
      const u = await API.req('GET', '/users/' + currentAdminUserId);
      const payload = {};
      payload[field] = !u.user[field === 'is_pro' ? 'isPro' : field === 'is_merchant' ? 'isMerchant' : 'isMaker'];
      try { await API.req('PATCH', '/admin/users/' + currentAdminUserId + '/status', payload); toast('Статус обновлен', 'success'); openAdminUserModal(currentAdminUserId); }
      catch(e) { toast('Ошибка', 'error'); }
    };

    window.adminChangeBalance = async function(action) {
      if (!currentAdminUserId) return;
      const currency = document.getElementById('admBalanceCurrency').value;
      const amount = parseFloat(document.getElementById('admBalanceAmount').value);
      if (!amount || amount <= 0) return toast('Введите сумму', 'error');
      try {
        await API.req('POST', '/admin/users/' + currentAdminUserId + '/balance', { currency, amount, action });
        toast('Баланс изменен', 'success'); document.getElementById('admBalanceAmount').value = ''; openAdminUserModal(currentAdminUserId); 
      } catch(e) { toast(e.message || 'Ошибка', 'error'); }
    };

    document.querySelectorAll('#adminTabs .tab').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('#adminTabs .tab').forEach(x => x.classList.remove('active'));
        c.classList.add('active'); adminTab = c.dataset.val; loadAdmin();
      };
    });

    // СТАРТ
    initBannerCarousel();
    updateAuthUI();
    loadHomeDashboard();
    updateNotifUI();
    try { loadHomeRate(); } catch(e) { console.error('Initial load error:', e); }

  } catch (err) {
    console.error('VEXO: КРИТИЧЕСКАЯ ОШИБКА', err);
  }
});