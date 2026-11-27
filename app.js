const API_URL = window.location.origin;
let state = { user: null, categories: [], articles: [], currentCategory: null, currentArticle: null };
let currentReqId = null;
let currentDayPlan = 0;
let tempAvatarBase64 = null;
let tempBannerBase64 = null;

if (localStorage.getItem('theme') === 'light') document.body.setAttribute('data-theme', 'light');
else document.body.setAttribute('data-theme', 'dark');

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

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
    setTimeout(() => { const loader = document.getElementById('loader'); if (loader) loader.classList.add('hidden'); }, 800);
    await authUser();
    await loadData();
    renderCalendar();
});

async function authUser() {
    if (!window.Telegram || !window.Telegram.WebApp.initData) {
        state.user = { id: 6938068102, display_name: 'Админ', username: 'admin', role: 'admin', is_paid: true, goal_amount: 100000, start_capital: 10000, current_balance: 15000, goal_date: '2025-01-01', goal_mode: 'rub', goal_daily_rate: 30, subscribers: 150, subscriptions: 20, likes: 500 };
        updateUIForUser(); return;
    }
    try {
        const res = await fetch(`${API_URL}/api/auth/telegram`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: window.Telegram.WebApp.initData }) });
        if (res.ok) {
            const data = await res.json(); state.user = data.user; updateUIForUser();
        } else {
            const err = await res.json(); showToast(err.error || 'Ошибка входа', 'error'); fallbackUser();
        }
    } catch(e) { fallbackUser(); }
}

function fallbackUser() { state.user = { display_name: 'Гость', username: 'guest', role: 'user', is_paid: false }; updateUIForUser(); }

function updateUIForUser() {
    if (!state.user) return;
    const name = state.user.display_name || 'User';
    
    // Баннер и Аватарка в шапке
    const avLarge = document.getElementById('userAvatarLarge');
    const banner = document.getElementById('userBanner');
    
    if (state.user.avatar_url) avLarge.innerHTML = `<img src="${state.user.avatar_url}">`; 
    else avLarge.textContent = name[0].toUpperCase();
    
    if (state.user.banner_url) banner.style.backgroundImage = `url(${state.user.banner_url})`; 
    else banner.style.backgroundImage = `url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop')`;

    document.getElementById('userName').textContent = name;
    document.getElementById('userHandle').textContent = '@' + (state.user.username || 'user');
    
    document.getElementById('statSubs').textContent = state.user.subscriptions || 0;
    document.getElementById('statFollowers').textContent = state.user.subscribers || 0;
    document.getElementById('statLikes').textContent = state.user.likes || 0;

    const isAdmin = state.user.role === 'admin';
    if (isAdmin) {
        document.getElementById('navAdminBtn').style.display = 'flex';
        document.getElementById('adminAddCatBtn').style.display = 'flex';
        document.getElementById('adminAddArtBtn').style.display = 'flex';
    }
    if (state.user.is_paid) document.getElementById('financeSection').style.display = 'block';

    if (state.user.goal_amount > 0) {
        document.getElementById('createGoalBtn').style.display = 'none';
        document.getElementById('goalCard').style.display = 'block';
        updateGoalUI();
    } else {
        document.getElementById('createGoalBtn').style.display = 'block';
        document.getElementById('goalCard').style.display = 'none';
    }
}

// НАСТРОЙКИ
window.openSettingsModal = () => {
    document.getElementById('setName').value = state.user.display_name || '';
    document.getElementById('avatarPreview').style.display = 'none';
    document.getElementById('bannerPreview').style.display = 'none';
    tempAvatarBase64 = state.user.avatar_url;
    tempBannerBase64 = state.user.banner_url;
    document.getElementById('settingsModal').classList.add('active');
};

function previewImage(input, previewId) {
    if (input.files && input.files[0]) {
        if (input.files[0].size > 5 * 1024 * 1024) return showToast('Файл слишком большой (макс 5MB)', 'error');
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            preview.innerHTML = `<img src="${e.target.result}">`;
            preview.style.display = 'flex';
            if (previewId === 'avatarPreview') tempAvatarBase64 = e.target.result;
            if (previewId === 'bannerPreview') tempBannerBase64 = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.saveProfileSettings = async () => {
    const newName = document.getElementById('setName').value;
    if (!newName) return showToast('Введите ник', 'error');
    
    await fetch(`${API_URL}/api/user/profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, display_name: newName, avatar_url: tempAvatarBase64, banner_url: tempBannerBase64 })
    });
    
    // Обновляем локальный стейт сразу
    state.user.display_name = newName;
    state.user.avatar_url = tempAvatarBase64;
    state.user.banner_url = tempBannerBase64;
    
    closeModal('settingsModal');
    showToast('Профиль обновлен!', 'success');
    updateUIForUser(); 
    if (document.getElementById('screen-profile').classList.contains('active')) renderProfile();
};

// КАЛЕНДАРЬ
function renderCalendar() {
    const strip = document.getElementById('calendarStrip');
    const today = new Date();
    const currentDay = today.getDay() === 0 ? 7 : today.getDay();
    const startOfWeek = new Date(today.setDate(today.getDate() - currentDay + 1));
    const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    strip.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const isToday = d.toDateString() === new Date().toDateString();
        strip.innerHTML += `<div class="day ${isToday ? 'active' : ''}" onclick="openDayModal(${d.getDate()}, '${d.toISOString().split('T')[0]}')"><span>${days[i]}</span><div class="date">${d.getDate()}</div>${isToday ? '<div class="dot"></div>' : ''}</div>`;
    }
}

window.openDayModal = (dayNum, dateStr) => {
    if (!state.user.goal_amount) return showToast('Сначала создайте цель', 'info');
    const goalDate = new Date(state.user.goal_date + 'T00:00:00');
    const targetDate = new Date(dateStr + 'T00:00:00');
    const daysLeft = Math.ceil((goalDate.getTime() - targetDate.getTime()) / (1000 * 3600 * 24));
    if (daysLeft < 0) return showToast('Эта дата уже прошла', 'error');
    const needed = state.user.goal_amount - state.user.start_capital;
    currentDayPlan = needed / (daysLeft || 1);
    document.getElementById('dayModalTitle').textContent = `${dayNum}-е число`;
    document.getElementById('dayModalTarget').textContent = `${currentDayPlan.toFixed(2)} ₽`;
    document.getElementById('dayCustomAmount').value = '';
    document.getElementById('dayModal').classList.add('active');
};

window.markDay = async (isDone) => {
    if (isDone) { await addToBalance(currentDayPlan); showToast(`Добавлено ${currentDayPlan.toFixed(2)} ₽!`, 'success'); }
    else { showToast('День отмечен', 'info'); }
    closeModal('dayModal');
};

window.addCustomDay = async () => {
    const val = parseFloat(document.getElementById('dayCustomAmount').value);
    if (!val) return showToast('Введите сумму', 'error');
    await addToBalance(val); showToast(`Добавлено ${val.toFixed(2)} ₽`, 'success');
    closeModal('dayModal');
};

async function addToBalance(amount) {
    if (!state.user.id) return;
    await fetch(`${API_URL}/api/user/update-balance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, amount }) });
    state.user.current_balance = (state.user.current_balance || 0) + amount;
    updateGoalUI(); loadTransactions();
}

window.openGoalModal = () => {
    document.getElementById('goalAmount').value = state.user.goal_amount || '';
    document.getElementById('goalStart').value = state.user.start_capital || '';
    document.getElementById('goalDate').value = state.user.goal_date ? state.user.goal_date.split('T')[0] : '';
    document.getElementById('goalMode').value = state.user.goal_mode || 'rub';
    document.getElementById('goalRate').value = state.user.goal_daily_rate || '';
    updateGoalRateLabel(); document.getElementById('goalModal').classList.add('active');
};
window.updateGoalRateLabel = () => { const mode = document.getElementById('goalMode').value; document.getElementById('goalRateLabel').textContent = mode === 'rub' ? 'План в день (₽)' : 'План в день (%)'; };

window.saveGoal = async () => {
    const amount = parseFloat(document.getElementById('goalAmount').value); const start = parseFloat(document.getElementById('goalStart').value) || 0;
    const date = document.getElementById('goalDate').value; const mode = document.getElementById('goalMode').value; const rate = parseFloat(document.getElementById('goalRate').value) || 0;
    if (!amount || !date) return showToast('Заполните цель и дату', 'error');
    await fetch(`${API_URL}/api/user/goal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, goal_amount: amount, start_capital: start, current_balance: state.user.current_balance || start, goal_date: date, goal_daily_rate: rate, goal_mode: mode }) });
    state.user.goal_amount = amount; state.user.start_capital = start; state.user.goal_date = date; state.user.goal_mode = mode; state.user.goal_daily_rate = rate; state.user.current_balance = state.user.current_balance || start;
    closeModal('goalModal'); showToast('Цель сохранена!', 'success'); updateUIForUser();
};

function updateGoalUI() {
    const target = state.user.goal_amount; const current = state.user.current_balance || state.user.start_capital;
    const progress = Math.min(100, (current / target) * 100);
    document.getElementById('goalTargetDisplay').textContent = target.toFixed(2);
    document.getElementById('goalProgressDisplay').textContent = current.toFixed(2);
    document.getElementById('goalProgressBar').style.width = `${progress}%`;
    const left = target - current;
    document.getElementById('goalLeftDisplay').textContent = left > 0 ? `${left.toFixed(2)} ₽` : 'Достигнута!';
    const goalDate = new Date(state.user.goal_date + 'T00:00:00'); const today = new Date(); today.setHours(0,0,0,0);
    const daysLeft = Math.max(0, Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 3600 * 24)));
    document.getElementById('goalDaysDisplay').textContent = daysLeft;
    let daily = 0; if (daysLeft > 0 && left > 0) daily = left / daysLeft;
    document.getElementById('goalDailyDisplay').textContent = `${daily.toFixed(2)} ₽`;
}

window.openBalanceModal = () => { document.getElementById('dailyProfit').value = ''; document.getElementById('balanceModal').classList.add('active'); };
window.addBalance = async () => {
    const amount = parseFloat(document.getElementById('dailyProfit').value);
    if (!amount) return showToast('Введите сумму', 'error');
    await addToBalance(amount); closeModal('balanceModal'); showToast('Баланс обновлен!', 'success');
};

// ДАННЫЕ
async function loadData() {
    try {
        const res = await fetch(`${API_URL}/api/data`); const data = await res.json();
        state.categories = data.categories || []; state.articles = data.articles || []; renderCategories();
        loadMyArticles();
    } catch(e) { console.error('Load error', e); }
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!state.categories || state.categories.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:var(--dim);">Нет разделов</p>';
        return;
    }
    grid.innerHTML = state.categories.map(cat => {
        let count = state.articles.filter(a => a.category === cat.name).length;
        if (cat.name === 'Пользовательское') {
            count = state.articles.filter(a => a.author_id != 6938068102 && a.author_id != null).length;
        }
        return `<div class="cat-item" onclick="openCategory('${cat.name}')"><div class="icon">${cat.icon}</div><div class="info"><h4>${cat.name}</h4><span>${count} статей</span></div><div class="arrow">›</div></div>`;
    }).join('');
}

window.openCategory = (catName) => {
    state.currentCategory = catName; document.getElementById('categoryTitle').textContent = catName;
    let filtered = [];
    if (catName === 'Пользовательское') {
        filtered = state.articles.filter(a => a.author_id != 6938068102 && a.author_id != null);
    } else {
        filtered = state.articles.filter(a => a.category === catName);
    }
    
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    document.getElementById('articlesList').innerHTML = filtered.length ? filtered.map(art => {
        const isLocked = art.tier === 'pro' && !isPaid;
        if (isLocked) return `<div class="article-item locked" onclick="showPaywall()"><div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div><div class="pro-badge">Нужен план PRO</div></div><button class="btn-locked">Недоступно</button></div>`;
        else return `<div class="article-item" onclick="openArticle(${art.id})"><div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div>${art.tier === 'pro' ? '<div class="pro-badge">PRO</div>' : ''}</div><button class="btn-read">Ознакомиться</button></div>`;
    }).join('') : '<p style="text-align:center; color:var(--dim);">Здесь пока пусто...</p>';
    show('category');
};

// СТАТЬЯ И КОММЕНТАРИИ
window.openArticle = (id) => {
    const art = state.articles.find(a => a.id === id); state.currentArticle = art;
    document.getElementById('articleTitle').textContent = art.title;
    document.getElementById('articleDate').textContent = `Обновлено: ${new Date(art.updated_at).toLocaleString()}`;
    document.getElementById('articleText').textContent = art.content;
    document.getElementById('adminEditArtBtn').style.display = (state.user?.role === 'admin') ? 'flex' : 'none';
    loadComments(id);
    show('article');
};

async function loadComments(articleId) {
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="color:var(--dim); font-size:14px;">Загрузка...</p>';
    const res = await fetch(`${API_URL}/api/comments/${articleId}`);
    const data = await res.json();
    list.innerHTML = data.comments.length ? data.comments.map(c => `
        <div class="comment-item">
            <div class="comment-avatar">${c.avatar_url ? `<img src="${c.avatar_url}">` : c.display_name[0].toUpperCase()}</div>
            <div class="comment-body">
                <div class="comment-author">${c.display_name}</div>
                <div class="comment-text">${c.text}</div>
            </div>
        </div>
    `).join('') : '<p style="color:var(--dim); font-size:14px;">Комментариев нет. Будьте первым!</p>';
}

window.sendComment = async () => {
    const text = document.getElementById('commentText').value;
    if (!text) return showToast('Введите комментарий', 'error');
    await fetch(`${API_URL}/api/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ article_id: state.currentArticle.id, user_id: state.user.id, text }) });
    document.getElementById('commentText').value = '';
    loadComments(state.currentArticle.id);
};

window.backToCategory = () => openCategory(state.currentCategory);

// МОИ СТАТЬИ
async function loadMyArticles() {
    if (!state.user || !state.user.id) return;
    const list = document.getElementById('myArticlesList');
    const res = await fetch(`${API_URL}/api/user/articles/${state.user.id}`);
    const data = await res.json();
    
    list.innerHTML = data.articles.length ? data.articles.map(art => `
        <div class="article-item" onclick="openArticle(${art.id})">
            <div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div></div>
            <button class="btn-read">Открыть</button>
        </div>
    `).join('') : '<p style="color:var(--dim); font-size:14px;">У вас пока нет статей</p>';
}

// ТРАНЗАКЦИИ
window.openTransModal = () => document.getElementById('transModal').classList.add('active');
window.saveTransaction = async () => {
    const type = document.getElementById('transType').value; const amount = parseFloat(document.getElementById('transAmount').value); const desc = document.getElementById('transDesc').value;
    if (!amount || !desc) return showToast('Заполните поля', 'error');
    await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, type, amount, description: desc }) });
    closeModal('transModal'); showToast('Добавлено', 'success'); loadTransactions();
    if (type === 'income') { await addToBalance(amount); }
};

async function loadTransactions() {
    if (!state.user.id) return;
    const list = document.getElementById('transactionsList');
    const res = await fetch(`${API_URL}/api/transactions/${state.user.id}`); const data = await res.json();
    let inc = 0, exp = 0;
    list.innerHTML = data.items.length ? data.items.map(t => {
        const isInc = t.type === 'income';
        if (isInc) inc += parseFloat(t.amount); else exp += parseFloat(t.amount);
        return `<div class="stat-item"><div><div style="font-weight:800;">${t.description}</div><div class="info">${new Date(t.created_at).toLocaleDateString()}</div></div><div class="profit ${isInc ? 'positive' : 'negative'}">${isInc ? '+' : '-'}${parseFloat(t.amount).toFixed(2)} ₽</div></div>`;
    }).join('') : '<p style="color:var(--dim); font-size:14px;">Нет операций</p>';
    
    document.getElementById('totalIncome').textContent = `+${inc.toFixed(2)} ₽`;
    document.getElementById('totalExpense').textContent = `-${exp.toFixed(2)} ₽`;
    document.getElementById('netProfit').textContent = `${(inc - exp).toFixed(2)} ₽`;
    document.getElementById('netProfit').style.color = (inc - exp) >= 0 ? 'var(--grn)' : 'var(--red)';
}

window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${screenId}"]`)?.classList.add('active');
    if (screenId === 'profile') { renderProfile(); loadTransactions(); loadMyArticles(); }
    if (screenId === 'admin') loadAdminTab('payments', document.querySelector('.tab-btn'));
};

// ПРОФИЛЬ (НОВЫЙ ДИЗАЙН)
async function renderProfile() {
    const container = document.getElementById('profileContent');
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    
    let bannerStyle = state.user.banner_url ? `background-image: url('${state.user.banner_url}');` : `background: linear-gradient(135deg, #a78bfa, #3b82f6);`;
    let avatarHtml = state.user.avatar_url ? `<img src="${state.user.avatar_url}">` : (state.user.display_name || 'U')[0].toUpperCase();

    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-banner-bg" style="${bannerStyle}"></div>
            <div class="profile-avatar-wrap">${avatarHtml}</div>
            <div class="profile-info-wrap">
                <h2>${state.user.display_name}</h2>
                <p>@${state.user.username || 'unknown'}</p>
                <div class="profile-status-badge" style="background: ${isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${isPaid ? 'var(--grn)' : 'var(--red)'};">
                    ${isPaid ? '✅ Доступ открыт' : '🔒 Требуется подписка'}
                </div>
            </div>
        </div>
    `;
}

window.openQuickAction = () => { if (state.user.role === 'admin') { openArticleModal(); } else { showPaywall(); } };
window.closeModal = (id) => document.getElementById(id).classList.remove('active');
window.showPaywall = () => document.getElementById('paywallModal').classList.add('active');
window.requestPayment = async () => {
    await fetch(`${API_URL}/api/payment-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id }) });
    showToast('Заявка отправлена!', 'success'); closeModal('paywallModal');
};

// АДМИН
window.openCatModal = () => document.getElementById('catModal').classList.add('active');
window.saveCategory = async () => {
    const name = document.getElementById('newCatName').value; const icon = document.getElementById('newCatIcon').value || '📄';
    if(!name) return showToast('Введите название', 'error');
    try {
        const res = await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon }) });
        if(!res.ok) throw new Error();
        closeModal('catModal'); showToast('Категория добавлена', 'success'); await loadData();
    } catch(e) { showToast('Ошибка или категория уже есть', 'error'); }
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
    try {
        await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category: state.currentCategory || 'Мануалы', tier, author_id: state.user.id }) });
        closeModal('articleModal'); showToast('Сохранено!', 'success'); await loadData(); 
        if(isEdit) openCategory(state.currentCategory); else backToCategory();
    } catch(e) { showToast('Ошибка при сохранении', 'error'); }
};

window.deleteArticle = () => showConfirm('Удалить?', 'Действие необратимо', async () => {
    await fetch(`${API_URL}/api/articles/${state.currentArticle.id}`, { method: 'DELETE' });
    closeModal('articleModal'); showToast('Удалено', 'success'); await loadData(); backToCategory();
});

window.switchAdminTab = (tab, el) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('adminTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    loadAdminTab(tab);
};

async function loadAdminTab(tab) {
    if (tab === 'payments') {
        const res = await fetch(`${API_URL}/api/admin/payments`); const data = await res.json();
        document.getElementById('adminPaymentsList').innerHTML = data.requests.length ? data.requests.map(r => `
            <div class="stat-item" style="flex-direction:column; align-items:flex-start;">
                <div style="font-weight:800;">@${r.username} (${r.display_name})</div>
                <div style="font-size:12px; color:var(--dim); margin-bottom:10px;">Статус: <b>${r.status}</b></div>
                ${r.status === 'pending' ? `<button class="btn btn-primary" onclick="promptRequisites(${r.id})" style="padding:10px; font-size:14px;">Выслать реквизиты</button>` : ''}
                ${r.status === 'paid' ? `<button class="btn btn-primary" onclick="approvePayment(${r.id}, ${r.user_id})" style="padding:10px; font-size:14px; background:var(--grn);">Подтвердить оплату</button>` : ''}
            </div>
        `).join('') : '<p>Нет заявок</p>';
    }
    if (tab === 'users') {
        const res = await fetch(`${API_URL}/api/admin/users`); const data = await res.json();
        document.getElementById('adminUsersList').innerHTML = data.users.map(u => `
            <div class="stat-item" style="flex-wrap:wrap; gap:10px;">
                <div><div style="font-weight:800;">${u.display_name}</div><div style="font-size:12px; color:var(--dim);">@${u.username}</div></div>
                <div style="display:flex; gap:6px;">
                    <button class="btn ${u.is_paid ? 'btn-danger' : 'btn-primary'}" style="padding:8px; font-size:12px; width:auto;" onclick="togglePaid(${u.id}, ${!u.is_paid})">${u.is_paid ? 'Забрать' : 'Выдать'}</button>
                    <button class="btn btn-ghost" style="padding:8px; font-size:12px; width:auto;" onclick="toggleBlock(${u.id}, ${!u.is_blocked})">${u.is_blocked ? 'Разблок.' : 'Блок'}</button>
                </div>
            </div>
        `).join('');
    }
}

window.promptRequisites = (reqId) => { currentReqId = reqId; document.getElementById('adminReqText').value = ''; document.getElementById('sendReqModal').classList.add('active'); };
window.sendRequisitesToUser = async () => {
    const text = document.getElementById('adminReqText').value;
    if (!text) return showToast('Введите реквизиты', 'error');
    await fetch(`${API_URL}/api/admin/send-requisites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: currentReqId, requisites: text }) });
    closeModal('sendReqModal'); showToast('Отправлено!', 'success'); loadAdminTab('payments');
};

window.approvePayment = (reqId, userId) => showConfirm('Подтвердить?', 'Выдать доступ?', async () => {
    await fetch(`${API_URL}/api/admin/approve-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: reqId, userId }) });
    showToast('Доступ выдан!', 'success'); loadAdminTab('payments');
});

window.togglePaid = (userId, isPaid) => showConfirm('Изменить доступ?', '', async () => {
    await fetch(`${API_URL}/api/admin/users/toggle-paid`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, isPaid }) });
    loadAdminTab('users');
});

window.toggleBlock = (userId, isBlocked) => showConfirm('Блокировка', '', async () => {
    await fetch(`${API_URL}/api/admin/users/toggle-block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, isBlocked }) });
    loadAdminTab('users');
});

// КАЛЬКУЛЯТОР
window.calcP2P = () => {
    const buy = parseFloat(document.getElementById('calcBuy').value) || 0; const sell = parseFloat(document.getElementById('calcSell').value) || 0;
    const amount = parseFloat(document.getElementById('calcAmount').value) || 0; const buyFee = parseFloat(document.getElementById('calcBuyFee').value) || 0; const sellFee = parseFloat(document.getElementById('calcSellFee').value) || 0;
    const resSpread = document.getElementById('resSpread'); const resProfit = document.getElementById('resProfit');
    if(!buy || !sell || !amount) { resSpread.textContent = '0 ₽ (0%)'; resProfit.textContent = '0 ₽'; return; }
    const usdtGross = amount / buy; const usdtNet = usdtGross * (1 - (buyFee / 100));
    const rubGross = usdtNet * sell; const rubNet = rubGross * (1 - (sellFee / 100));
    const profit = rubNet - amount; const spreadPct = ((sell - buy) / buy) * 100;
    resSpread.textContent = `${(sell - buy).toFixed(2)} ₽ (${spreadPct.toFixed(2)}%)`;
    resProfit.textContent = `${profit.toFixed(2)} ₽`;
    resProfit.style.color = profit >= 0 ? 'var(--grn)' : 'var(--red)';
    window._lastCalculatedProfit = profit;
};

window.resetCalc = () => { ['calcBuy','calcSell','calcAmount','calcBuyFee','calcSellFee'].forEach(id=>document.getElementById(id).value=''); calcP2P(); };
window.saveCalc = async () => {
    if (!window._lastCalculatedProfit || window._lastCalculatedProfit <= 0) return showToast('Нет прибыли для сохранения', 'error');
    await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, type: 'income', amount: window._lastCalculatedProfit, description: 'P2P Сделка (Калькулятор)' }) });
    await addToBalance(window._lastCalculatedProfit);
    showToast('Профит добавлен в статистику!', 'success'); window._lastCalculatedProfit = 0; resetCalc();
};