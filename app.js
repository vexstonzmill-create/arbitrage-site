let tgUser = null;
let isAdmin = false;
let cachedData = null;
let currentBuyProduct = null;
let currentBuyMethod = null;

document.addEventListener('DOMContentLoaded', async () => {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  
  const themeBtn = document.getElementById('themeBtn');
  let currentTheme = localStorage.getItem('hub_theme') || 'dark';
  document.body.setAttribute('data-theme', currentTheme);
  themeBtn.onclick = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('hub_theme', currentTheme);
  };

  if (!tg.initData) {
    document.getElementById('loader').innerHTML = '<div style="color:red; padding:20px; text-align:center;">Откройте через Telegram</div>';
    return;
  }

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData })
    });
    const data = await res.json();

    document.getElementById('loader').style.display = 'none';

    if (!data.isSubbed) {
      document.getElementById('sub-screen').style.display = 'flex';
      return;
    }

    tgUser = data.user;
    isAdmin = data.isAdmin;
    
    document.getElementById('main-app').style.display = 'block';
    if (isAdmin) {
      document.getElementById('adminBtn').style.display = 'inline-flex';
      document.getElementById('adminBtn').onclick = () => { show('admin'); loadAdmin(); };
    }
    
    loadData();
  } catch (e) {
    document.getElementById('loader').innerHTML = '<div style="color:red; padding:20px; text-align:center;">Ошибка загрузки</div>';
  }
});

function subscribe() {
  const channel = '@vexo_channel';
  window.Telegram.WebApp.openTelegramLink(`https://t.me/${channel.replace('@','')}`);
}

function checkSub() { window.location.reload(); }

async function loadData() {
  const res = await fetch('/api/data');
  cachedData = await res.json();
  renderMarket(cachedData.market);
  renderBL(cachedData.bl);
  renderManuals(cachedData.manuals);
  renderTerms(cachedData.terms);
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

// --- ИКОНКИ МЕТОДОВ ОПЛАТЫ ---
const METHOD_LABELS = {
  'RUB': { label: 'RUB (₽)', icon: '₽', cls: 'rub' },
  'USDT_TRC20': { label: 'USDT TRC-20', icon: '₮', cls: 'usdt' },
  'USDT_ERC20': { label: 'USDT ERC-20', icon: '₮', cls: 'usdt' },
  'BTC': { label: 'BTC', icon: '₿', cls: 'btc' },
  'TON': { label: 'TON', icon: 'T', cls: 'ton' }
};

function methodBadge(code) {
  const m = METHOD_LABELS[code];
  if (!m) return `<span class="pay-tag">${code}</span>`;
  return `<span class="pay-tag"><span class="coin-icon ${m.cls}" style="width:16px;height:16px;font-size:9px;">${m.icon}</span> ${m.label}</span>`;
}

// --- РЕНДЕР ---
function renderMarket(items) {
  const list = document.getElementById('market-list');
  if (!items.length) { list.innerHTML = '<div class="empty">Пока пусто</div>'; return; }
  list.innerHTML = items.map(i => {
    const methods = (i.payment_methods || []).map(methodBadge).join('');
    return `
    <div class="glass-card" style="margin-bottom:12px; padding:16px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="font-size:10px; background:rgba(59,130,246,0.2); color:#60a5fa; padding:2px 6px; border-radius:4px; font-weight:800;">${i.category}</span>
        <strong style="color:var(--grn);">${i.price}</strong>
      </div>
      <h3 style="font-size:16px; margin-bottom:4px;">${i.title}</h3>
      <p style="font-size:12px; color:var(--dim); margin-bottom:12px;">${i.description}</p>
      ${methods ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px;">${methods}</div>` : ''}
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:11px; color:var(--dim);">от @${i.author_username || 'аноним'}</span>
        <button class="btn btn-primary btn-sm" onclick="openBuyModal(${i.id})">🛒 Купить</button>
      </div>
    </div>
  `}).join('');
}

function renderBL(items) {
  const list = document.getElementById('bl-list');
  if (!items.length) { list.innerHTML = '<div class="empty">Пусто</div>'; return; }
  list.innerHTML = items.map(i => `
    <div class="glass-card" style="margin-bottom:8px; padding:12px; border-left:4px solid var(--red);">
      <strong>${i.name}</strong>
      <p style="font-size:12px; color:var(--dim); margin-top:4px;">${i.reason}</p>
    </div>
  `).join('');
}

function renderManuals(items) {
  const list = document.getElementById('manuals-list');
  if (!items.length) { list.innerHTML = '<div class="empty">Пусто</div>'; return; }
  list.innerHTML = items.map(i => `
    <div class="glass-card" style="margin-bottom:8px; padding:16px;">
      <strong style="display:block; margin-bottom:8px;">${i.title}</strong>
      <p style="font-size:13px; color:var(--dim);">${i.content}</p>
    </div>
  `).join('');
}

function renderTerms(items) {
  const list = document.getElementById('terms-list');
  if (!items.length) { list.innerHTML = '<div class="empty">Пусто</div>'; return; }
  list.innerHTML = items.map(i => `
    <div class="glass-card" style="margin-bottom:8px; padding:12px;">
      <strong style="color:var(--primary);">${i.term}</strong>
      <p style="font-size:13px; color:var(--dim); margin-top:4px;">${i.definition}</p>
    </div>
  `).join('');
}

// --- КАЛЬКУЛЯТОР ---
document.getElementById('calc-buy').oninput = calc;
document.getElementById('calc-sell').oninput = calc;
document.getElementById('calc-amount').oninput = calc;

function calc() {
  const b = parseFloat(document.getElementById('calc-buy').value) || 0;
  const s = parseFloat(document.getElementById('calc-sell').value) || 0;
  const a = parseFloat(document.getElementById('calc-amount').value) || 0;
  const spread = s - b;
  const pct = b > 0 ? (spread / b * 100) : 0;
  const profit = spread * a;
  document.getElementById('res-spread').textContent = spread.toFixed(2) + ' ₽';
  document.getElementById('res-pct').textContent = pct.toFixed(2) + ' %';
  document.getElementById('res-profit').textContent = profit.toLocaleString('ru-RU') + ' ₽';
}

// --- ФОРМА ПРОДАЖИ: ВЫБОР МЕТОДОВ ---
document.querySelectorAll('#sell-methods .pay-method').forEach(el => {
  el.onclick = () => {
    el.classList.toggle('active');
    renderPaymentDetailsFields();
  };
});

function renderPaymentDetailsFields() {
  const active = [...document.querySelectorAll('#sell-methods .pay-method.active')].map(el => el.dataset.method);
  const container = document.getElementById('payment-details-container');
  
  if (!active.length) { container.innerHTML = ''; return; }
  
  const labels = {
    'RUB': 'Реквизиты для RUB (номер карты / телефон СБП)',
    'USDT_TRC20': 'Адрес USDT TRC-20',
    'USDT_ERC20': 'Адрес USDT ERC-20',
    'BTC': 'Адрес BTC',
    'TON': 'Адрес TON'
  };
  
  container.innerHTML = active.map(m => `
    <div class="field">
      <label>${labels[m] || m}</label>
      <input type="text" class="input detail-input" data-method="${m}" placeholder="Введи реквизиты">
    </div>
  `).join('');
}

// --- ОТПРАВКА ТОВАРА ---
async function submitProduct() {
  const cat = document.getElementById('sell-cat').value;
  const title = document.getElementById('sell-title').value.trim();
  const desc = document.getElementById('sell-desc').value.trim();
  const price = document.getElementById('sell-price').value.trim();
  const contact = document.getElementById('sell-contact').value.trim();
  const err = document.getElementById('sell-error');

  const payment_methods = [...document.querySelectorAll('#sell-methods .pay-method.active')].map(el => el.dataset.method);
  
  if (!title || !desc || !contact) { err.textContent = 'Заполните все поля'; return; }
  if (!payment_methods.length) { err.textContent = 'Выбери минимум один способ оплаты'; return; }
  
  const payment_details = {};
  let detailsOk = true;
  document.querySelectorAll('.detail-input').forEach(inp => {
    const v = inp.value.trim();
    if (!v) detailsOk = false;
    payment_details[inp.dataset.method] = v;
  });
  if (!detailsOk) { err.textContent = 'Заполни реквизиты для всех выбранных методов'; return; }

  const res = await fetch('/api/market/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tg_id: tgUser.id, username: tgUser.username, category: cat,
      title, description: desc, price, contact, payment_methods, payment_details
    })
  });

  if (res.ok) {
    alert('Товар отправлен на модерацию!');
    ['sell-title','sell-desc','sell-price','sell-contact'].forEach(id => document.getElementById(id).value = '');
    document.querySelectorAll('#sell-methods .pay-method').forEach(el => el.classList.remove('active'));
    document.getElementById('payment-details-container').innerHTML = '';
    err.textContent = '';
    show('market');
  } else {
    const data = await res.json();
    err.textContent = data.error === 'not_subscribed' ? 'Подпишись на канал для публикации' : 'Ошибка отправки';
  }
}

// --- МОДАЛКА ПОКУПКИ ---
function openBuyModal(marketId) {
  const product = cachedData.market.find(p => p.id === marketId);
  if (!product) return;
  
  currentBuyProduct = product;
  currentBuyMethod = null;
  
  document.getElementById('buy-title').textContent = product.title;
  document.getElementById('buy-price').textContent = `Цена: ${product.price}`;
  document.getElementById('buy-step-1').style.display = 'block';
  document.getElementById('buy-step-2').style.display = 'none';
  document.getElementById('buy-step-3').style.display = 'none';
  
  const list = document.getElementById('buy-methods-list');
  const methods = product.payment_methods || [];
  list.innerHTML = methods.map(m => {
    const meta = METHOD_LABELS[m] || { label: m, icon: '?', cls: 'rub' };
    return `
      <button class="pay-method" style="padding:12px; justify-content:flex-start;" onclick="selectBuyMethod('${m}')">
        <div class="coin-icon ${meta.cls}">${meta.icon}</div>
        <span style="font-weight:700;">${meta.label}</span>
        <span style="margin-left:auto; color:var(--dim);">→</span>
      </button>
    `;
  }).join('');
  
  document.getElementById('buy-modal').classList.add('active');
}

function selectBuyMethod(method) {
  currentBuyMethod = method;
  const details = (currentBuyProduct.payment_details || {})[method] || 'Не указаны';
  
  document.getElementById('buy-details').textContent = details;
  document.getElementById('buy-contact').innerHTML = `@${(currentBuyProduct.contact || '').replace('@','')} · <span style="color:var(--dim);font-weight:500;">автор: @${currentBuyProduct.author_username || 'аноним'}</span>`;
  
  document.getElementById('buy-step-1').style.display = 'none';
  document.getElementById('buy-step-2').style.display = 'block';
}

async function confirmPaid() {
  if (!currentBuyProduct || !currentBuyMethod) return;
  
  const res = await fetch('/api/market/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      market_id: currentBuyProduct.id,
      tg_id: tgUser.id,
      username: tgUser.username,
      payment_method: currentBuyMethod
    })
  });
  
  if (res.ok) {
    document.getElementById('buy-step-2').style.display = 'none';
    document.getElementById('buy-step-3').style.display = 'block';
    setTimeout(() => closeBuyModal(), 3000);
  } else {
    alert('Ошибка. Попробуй позже.');
  }
}

function closeBuyModal() {
  document.getElementById('buy-modal').classList.remove('active');
  currentBuyProduct = null;
  currentBuyMethod = null;
}

// --- АДМИНКА ---
async function loadAdmin() {
  const res = await fetch('/api/admin/pending');
  const items = await res.json();
  const list = document.getElementById('admin-list');
  
  if (!items.length) { list.innerHTML = '<div class="empty">Нет заявок</div>'; return; }
  
  list.innerHTML = items.map(i => {
    const methods = (i.payment_methods || []).map(methodBadge).join('');
    const details = i.payment_details || {};
    const detailsStr = Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('<br>');
    
    return `
    <div class="glass-card" style="margin-bottom:12px; padding:16px;">
      <div style="margin-bottom:8px;"><strong>${i.category}: ${i.title}</strong></div>
      <p style="font-size:12px; color:var(--dim); margin-bottom:8px;">${i.description}</p>
      <div style="font-size:11px; margin-bottom:8px;">Цена: <b>${i.price}</b> | От: @${i.author_username}</div>
      <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">${methods}</div>
      <div style="font-size:10px; color:var(--dim); font-family:monospace; margin-bottom:8px;">${detailsStr}</div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="moderate(${i.id}, 'approve')">Одобрить</button>
        <button class="btn btn-ghost btn-sm" style="flex:1; color:var(--red); border-color:var(--red);" onclick="moderate(${i.id}, 'reject')">Отклонить</button>
      </div>
    </div>
  `}).join('');
}

async function moderate(id, action) {
  await fetch('/api/admin/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action })
  });
  loadAdmin();
  loadData();
}