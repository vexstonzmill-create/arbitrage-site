const API_URL = window.location.origin;
let state = { user: null, categories: [], articles: [], currentCategory: null, currentArticle: null };
let currentReqId = null;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function showConfirm(title, text, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    document.getElementById('confirmYesBtn').onclick = () => { closeModal('confirmModal'); onConfirm(); };
    document.getElementById('confirmModal').classList.add('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.Telegram?.WebApp) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); }
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
    await authUser();
    await loadData();
    renderCalendar();
});

async function authUser() {
    if (!window.Telegram || !window.Telegram.WebApp.initData) {
        state.user = { id: 6938068102, display_name: 'Админ (Браузер)', role: 'admin', is_paid: true, goal_amount: 100000, start_capital: 10000, current_balance: 15000, goal_date: '2025-01-01', goal_mode: 'rub', goal_daily_rate: 30 };
        updateUIForUser(); return;
    }
    try {
        const res = await fetch(`${API_URL}/api/auth/telegram`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: window.Telegram.WebApp.initData })
        });
        if (res.ok) {
            const data = await res.json();
            state.user = data.user;
            updateUIForUser();
        } else {
            const err = await res.json();
            showToast(err.error || 'Ошибка входа', 'error');
            fallbackUser();
        }
    } catch(e) { fallbackUser(); }
}

function fallbackUser() { state.user = { display_name: 'Гость', role: 'user', is_paid: false }; updateUIForUser(); }

function updateUIForUser() {
    if (!state.user) return;
    const name = state.user.display_name || 'User';
    document.getElementById('userName').textContent = name.split(' ')[0];
    document.getElementById('userAvatar').textContent = name[0].toUpperCase();
    
    const isAdmin = state.user.role === 'admin';
    if (isAdmin) {
        document.getElementById('navAdminBtn').style.display = 'flex';
        document.getElementById('adminAddCatBtn').style.display = 'flex';
        document.getElementById('adminAddArtBtn').style.display = 'flex';
    }
    if (state.user.is_paid) document.getElementById('financeSection').style.display = 'block';

    // Рендер цели
    if (state.user.goal_amount > 0) {
        document.getElementById('createGoalBtn').style.display = 'none';
        document.getElementById('goalCard').style.display = 'block';
        updateGoalUI();
    } else {
        document.getElementById('createGoalBtn').style.display = 'block';
        document.getElementById('goalCard').style.display = 'none';
    }
}

// === КАЛЕНДАРЬ ===
function renderCalendar() {
    const strip = document.getElementById('calendarStrip');
    const today = new Date();
    const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // Пн = 1
    const startOfWeek = new Date(today.setDate(today.getDate() - currentDay + 1));

    const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    strip.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        
        const isToday = d.toDateString() === new Date().toDateString();
        const dayNum = d.getDate();
        
        strip.innerHTML += `
            <div class="day ${isToday ? 'active' : ''}" onclick="showDayInfo(${dayNum}, '${d.toISOString().split('T')[0]}')">
                <span>${days[i]}</span>
                <div class="date">${dayNum}</div>
                ${isToday ? '<div class="dot"></div>' : ''}
            </div>
        `;
    }
}

window.showDayInfo = (dayNum, dateStr) => {
    if (!state.user.goal_amount) return showToast('Сначала создайте цель', 'info');

    const goalDate = new Date(state.user.goal_date);
    const targetDate = new Date(dateStr);
    const daysLeft = Math.ceil((goalDate.getTime() - targetDate.getTime()) / (1000 * 3600 * 24));
    
    if (daysLeft < 0) return showToast('Эта дата уже прошла', 'error');

    const needed = state.user.goal_amount - state.user.start_capital;
    const dailyTarget = needed / (daysLeft || 1);

    showToast(`${dayNum}-е число. Нужно: ${dailyTarget.toFixed(0)} ₽. Осталось дней: ${daysLeft}`, 'info');
};

// === ЦЕЛИ ===
window.openGoalModal = () => {
    document.getElementById('goalAmount').value = state.user.goal_amount || '';
    document.getElementById('goalStart').value = state.user.start_capital || '';
    document.getElementById('goalDate').value = state.user.goal_date ? state.user.goal_date.split('T')[0] : '';
    document.getElementById('goalMode').value = state.user.goal_mode || 'rub';
    document.getElementById('goalRate').value = state.user.goal_daily_rate || '';
    updateGoalRateLabel();
    document.getElementById('goalModal').classList.add('active');
};

window.updateGoalRateLabel = () => {
    const mode = document.getElementById('goalMode').value;
    document.getElementById('goalRateLabel').textContent = mode === 'rub' ? 'План в день (₽)' : 'План в день (%)';
};

window.saveGoal = async () => {
    const amount = parseFloat(document.getElementById('goalAmount').value);
    const start = parseFloat(document.getElementById('goalStart').value) || 0;
    const date = document.getElementById('goalDate').value;
    const mode = document.getElementById('goalMode').value;
    const rate = parseFloat(document.getElementById('goalRate').value) || 0;

    if (!amount || !date) return showToast('Заполните цель и дату', 'error');

    const payload = { 
        userId: state.user.id, goal_amount: amount, start_capital: start, 
        current_balance: state.user.current_balance || start, // при создании ставим текущий баланс = стартовый
        goal_date: date, goal_daily_rate: rate, goal_mode: mode 
    };

    await fetch(`${API_URL}/api/user/goal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    state.user.goal_amount = amount;
    state.user.start_capital = start;
    state.user.goal_date = date;
    state.user.goal_mode = mode;
    state.user.goal_daily_rate = rate;
    state.user.current_balance = state.user.current_balance || start;

    closeModal('goalModal');
    showToast('Цель сохранена!', 'success');
    updateUIForUser();
};

function updateGoalUI() {
    const target = state.user.goal_amount;
    const current = state.user.current_balance || state.user.start_capital;
    const progress = Math.min(100, (current / target) * 100);

    document.getElementById('goalTargetDisplay').textContent = target.toLocaleString('ru-RU');
    document.getElementById('goalProgressDisplay').textContent = current.toLocaleString('ru-RU');
    document.getElementById('goalProgressBar').style.width = `${progress}%`;

    const left = target - current;
    document.getElementById('goalLeftDisplay').textContent = left > 0 ? `${left.toLocaleString('ru-RU')} ₽` : 'Достигнута!';

    const goalDate = new Date(state.user.goal_date);
    const today = new Date();
    const daysLeft = Math.max(0, Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 3600 * 24)));
    document.getElementById('goalDaysDisplay').textContent = daysLeft;

    let daily = 0;
    if (daysLeft > 0 && left > 0) {
        daily = left / daysLeft;
    }
    document.getElementById('goalDailyDisplay').textContent = `${daily.toFixed(0)} ₽`;
}

window.openBalanceModal = () => {
    document.getElementById('dailyProfit').value = '';
    document.getElementById('balanceModal').classList.add('active');
};

window.addBalance = async () => {
    const amount = parseFloat(document.getElementById('dailyProfit').value);
    if (!amount) return showToast('Введите сумму', 'error');

    await fetch(`${API_URL}/api/user/update-balance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, amount })
    });

    state.user.current_balance = (state.user.current_balance || 0) + amount;
    closeModal('balanceModal');
    showToast('Баланс обновлен!', 'success');
    updateGoalUI();
};

// === ОСТАЛЬНОЕ (ФИНАНСЫ, СТАТЬИ, НАВИГАЦИЯ) ===
async function loadData() {
    const res = await fetch(`${API_URL}/api/data`);
    const data = await res.json();
    state.categories = data.categories || [];
    state.articles = data.articles || [];
    renderCategories();
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = state.categories.map(cat => {
        const count = state.articles.filter(a => a.category === cat.name).length;
        return `
        <div class="cat-item" onclick="openCategory('${cat.name}')">
            <div class="icon">${cat.icon}</div>
            <div class="info"><h4>${cat.name}</h4><span>${count} статей</span></div>
            <div class="arrow">›</div>
        </div>`;
    }).join('');
}

window.openCategory = (catName) => {
    state.currentCategory = catName;
    document.getElementById('categoryTitle').textContent = catName;
    const filtered = state.articles.filter(a => a.category === catName);
    const isPaid = state.user.is_paid || state.user.role === 'admin';

    document.getElementById('articlesList').innerHTML = filtered.length ? filtered.map(art => {
        const isLocked = art.tier === 'pro' && !isPaid;
        if (isLocked) {
            return `<div class="article-item locked" onclick="showPaywall()">
                <div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div><div class="pro-badge">Нужен план PRO</div></div>
                <button class="btn-locked">Недоступно</button>
            </div>`;
        } else {
            return `<div class="article-item" onclick="openArticle(${art.id})">
                <div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div>${art.tier === 'pro' ? '<div class="pro-badge" style="background:#ede9fe; color:#7c3aed;">PRO</div>' : ''}</div>
                <button class="btn-read">Ознакомиться</button>
            </div>`;
        }
    }).join('') : '<p style="text-align:center; color:var(--dim);">Здесь пока пусто...</p>';
    show('category');
};

window.openArticle = (id) => {
    const art = state.articles.find(a => a.id === id);
    state.currentArticle = art;
    document.getElementById('articleTitle').textContent = art.title;
    document.getElementById('articleDate').textContent = `Обновлено: ${new Date(art.updated_at).toLocaleString()}`;
    document.getElementById('articleText').textContent = art.content;
    document.getElementById('adminEditArtBtn').style.display = (state.user?.role === 'admin') ? 'flex' : 'none';
    show('article');
};

window.backToCategory = () => openCategory(state.currentCategory);

window.openTransModal = () => document.getElementById('transModal').classList.add('active');
window.saveTransaction = async () => {
    const type = document.getElementById('transType').value; const amount = parseFloat(document.getElementById('transAmount').value); const desc = document.getElementById('transDesc').value;
    if (!amount || !desc) return showToast('Заполните поля', 'error');
    await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, type, amount, description: desc }) });
    closeModal('transModal'); showToast('Добавлено', 'success'); loadTransactions();
};

async function loadTransactions() {
    const list = document.getElementById('transactionsList');
    const res = await fetch(`${API_URL}/api/transactions/${state.user.id}`); const data = await res.json();
    let inc = 0, exp = 0;
    list.innerHTML = data.items.length ? data.items.map(t => {
        const isInc = t.type === 'income';
        if (isInc) inc += parseFloat(t.amount); else exp += parseFloat(t.amount);
        return `<div class="stat-item"><div><div style="font-weight:800;">${t.description}</div><div class="info">${new Date(t.created_at).toLocaleDateString()}</div></div><div class="profit ${isInc ? 'positive' : 'negative'}">${isInc ? '+' : '-'}${t.amount} ₽</div></div>`;
    }).join('') : '<p style="color:var(--dim); font-size:14px;">Нет операций</p>';
    document.getElementById('totalIncome').textContent = `+${inc} ₽`;
    document.getElementById('totalExpense').textContent = `-${exp} ₽`;
    document.getElementById('netProfit').textContent = `${inc - exp} ₽`;
    document.getElementById('netProfit').style.color = (inc - exp) >= 0 ? 'var(--grn)' : 'var(--red)';
}

window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${screenId}"]`)?.classList.add('active');
    if (screenId === 'profile') { renderProfile(); loadTransactions(); }
};

async function renderProfile() {
    const container = document.getElementById('profileContent');
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    container.innerHTML = `
        <div class="card" style="text-align:center; padding: 24px; background:#fff; border-radius:24px; box-shadow: var(--shadow); border: 1px solid var(--card-border); margin-bottom: 16px;">
            <div class="avatar" style="width:70px; height:70px; font-size:28px; margin: 0 auto 16px; background:var(--primary); color:#fff;">${(state.user.display_name || 'U')[0]}</div>
            <h3 style="font-size: 20px;">${state.user.display_name}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username || 'unknown'}</p>
            <div style="background: ${isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; padding: 12px; border-radius: 16px; font-weight: 800; font-size: 15px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Требуется подписка'}
            </div>
        </div>
    `;
}

window.openQuickAction = () => {
    if (state.user.role === 'admin') { openArticleModal(); } else { showPaywall(); }
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');
window.showPaywall = () => document.getElementById('paywallModal').classList.add('active');
window.requestPayment = async () => {
    await fetch(`${API_URL}/api/payment-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id }) });
    showToast('Заявка отправлена!', 'success'); closeModal('paywallModal');
};

// === АДМИН ===
window.openCatModal = () => document.getElementById('catModal').classList.add('active');
window.saveCategory = async () => {
    const name = document.getElementById('newCatName').value; const icon = document.getElementById('newCatIcon').value || '📄';
    if(!name) return;
    await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon }) });
    closeModal('catModal'); showToast('Категория добавлена', 'success'); loadData();
};

window.openArticleModal = (isEdit = false) => {
    if(isEdit && state.currentArticle) {
        document.getElementById('modalArtTitle').textContent = 'Редактировать';
        document.getElementById('editTitle').value = state.currentArticle.title;
        document.getElementById('editContent').value = state.currentArticle.content;
        document.getElementById('editTier').value = state.currentArticle.tier || 'free';
        document.getElementById('deleteArtBtn').style.display = 'block';
    } else {
        state.currentArticle = null;
        document.getElementById('modalArtTitle').textContent = 'Новая статья';
        document.getElementById('editTitle').value = ''; document.getElementById('editContent').value = '';
        document.getElementById('editTier').value = 'free'; document.getElementById('deleteArtBtn').style.display = 'none';
    }
    document.getElementById('articleModal').classList.add('active');
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value; const content = document.getElementById('editContent').value; const tier = document.getElementById('editTier').value;
    if(!title || !content) return showToast('Заполните поля', 'error');
    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category: state.currentCategory, tier }) });
    closeModal('articleModal'); showToast('Сохранено!', 'success'); await loadData(); 
    if(isEdit) openCategory(state.currentCategory); else backToCategory();
};