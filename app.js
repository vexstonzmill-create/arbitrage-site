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
});

async function authUser() {
    if (!window.Telegram || !window.Telegram.WebApp.initData) {
        state.user = { id: 6938068102, display_name: 'Админ (Браузер)', role: 'admin', is_paid: true };
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
    if (isAdmin) document.getElementById('navAdminBtn').style.display = 'flex';
    if (state.user.is_paid) document.getElementById('financeSection').style.display = 'block';

    if (state.user.goal_amount) {
        document.getElementById('goalAmount').value = state.user.goal_amount;
        document.getElementById('goalStart').value = state.user.start_capital;
        document.getElementById('goalDate').value = state.user.goal_date ? state.user.goal_date.split('T')[0] : '';
        document.getElementById('goalRate').value = state.user.goal_daily_rate;
        calculateGoalUI();
    }
}

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
            <div class="info">
                <h4>${cat.name}</h4>
                <span>${count} статей</span>
            </div>
            <div class="arrow">›</div>
        </div>`;
    }).join('');
}

window.openCategory = (catName) => {
    state.currentCategory = catName; state.currentArticle = null;
    document.getElementById('categoryTitle').textContent = catName;
    const filtered = state.articles.filter(a => a.category === catName);
    
    const isPaid = state.user.is_paid || state.user.role === 'admin';

    document.getElementById('articlesList').innerHTML = filtered.length ? filtered.map(art => {
        const isPro = art.tier === 'pro';
        const isLocked = isPro && !isPaid;

        if (isLocked) {
            return `
            <div class="article-item locked" onclick="showPaywall()">
                <div class="art-info">
                    <h4>${art.title}</h4>
                    <div class="date">Обновлено: ${new Date(art.updated_at).toLocaleDateString()}</div>
                    <div class="pro-badge">Нужен план PRO</div>
                </div>
                <button class="btn-locked">Недоступно</button>
            </div>`;
        } else {
            return `
            <div class="article-item" onclick="openArticle(${art.id})">
                <div class="art-info">
                    <h4>${art.title}</h4>
                    <div class="date">Обновлено: ${new Date(art.updated_at).toLocaleDateString()}</div>
                    ${isPro ? '<div class="pro-badge" style="background:#ede9fe; color:#7c3aed;">PRO</div>' : ''}
                </div>
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
    if (art.image_url) { document.getElementById('articleImage').src = art.image_url; document.getElementById('articleImage').style.display = 'block'; } 
    else { document.getElementById('articleImage').style.display = 'none'; }
    document.getElementById('adminEditArtBtn').style.display = (state.user?.role === 'admin') ? 'flex' : 'none';
    show('article');
};

window.backToCategory = () => openCategory(state.currentCategory);

// === ЦЕЛИ ===
window.saveGoal = async () => {
    if (!state.user || !state.user.id) return showToast('Войдите для сохранения', 'error');
    const amount = parseFloat(document.getElementById('goalAmount').value);
    const start = parseFloat(document.getElementById('goalStart').value) || 0;
    const date = document.getElementById('goalDate').value;
    const rate = parseFloat(document.getElementById('goalRate').value) || 0;

    if (!amount || !date) return showToast('Заполните цель и дату', 'error');

    await fetch(`${API_URL}/api/user/goal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, goal_amount: amount, start_capital: start, goal_date: date, goal_daily_rate: rate })
    });
    showToast('Цель сохранена!', 'success');
    state.user.goal_amount = amount;
    calculateGoalUI();
};

window.calculateGoalUI = () => {
    const amount = parseFloat(document.getElementById('goalAmount').value) || 0;
    const start = parseFloat(document.getElementById('goalStart').value) || 0;
    const dateStr = document.getElementById('goalDate').value;

    if (!amount || !dateStr) {
        document.getElementById('goalResult').style.display = 'none';
        return;
    }

    const goalDate = new Date(dateStr);
    const today = new Date();
    goalDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
    const daysLeft = Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysLeft <= 0) {
        showToast('Дата должна быть в будущем!', 'error');
        return;
    }

    const needed = amount - start;
    const dailyRub = needed / daysLeft;
    let dailyPct = 0;
    if (start > 0) dailyPct = (Math.pow(amount / start, 1 / daysLeft) - 1) * 100;

    document.getElementById('resDays').textContent = `${daysLeft} дн.`;
    document.getElementById('resDailyRub').textContent = `${dailyRub.toFixed(0)} ₽`;
    document.getElementById('resDailyPct').textContent = start > 0 ? `${dailyPct.toFixed(1)} %` : '—';
    document.getElementById('goalResult').style.display = 'block';
};

// === ОПЛАТА ===
window.showPaywall = () => document.getElementById('paywallModal').classList.add('active');
window.requestPayment = async () => {
    if (!state.user || !state.user.id) return showToast('Ошибка', 'error');
    await fetch(`${API_URL}/api/payment-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id }) });
    showToast('Заявка отправлена!', 'success');
    closeModal('paywallModal');
};

// === КАЛЬКУЛЯТОР ===
window.calcP2P = () => {
    const buy = parseFloat(document.getElementById('calcBuy').value) || 0;
    const sell = parseFloat(document.getElementById('calcSell').value) || 0;
    const amount = parseFloat(document.getElementById('calcAmount').value) || 0;
    if(!buy || !sell || !amount) return;
    const spread = sell - buy; const profit = (amount / buy) * spread;
    document.getElementById('resSpread').textContent = `${spread.toFixed(2)} ₽ (${((spread/buy)*100).toFixed(2)}%)`;
    document.getElementById('resProfit').textContent = `${profit.toFixed(2)} ₽`;
};
window.resetCalc = () => { ['calcBuy','calcSell','calcAmount','calcBuyFee','calcSellFee'].forEach(id=>document.getElementById(id).value=''); calcP2P(); };
window.saveCalc = () => showToast('Расчет сохранен!', 'success');

// === НАВИГАЦИЯ ===
window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${screenId}"]`)?.classList.add('active');
    if (screenId === 'profile') renderProfile();
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
    if (state.user.role === 'admin') { showToast('Админ-панель', 'info'); } 
    else { showPaywall(); }
};

// === АДМИНКА ===
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

// === УПРАВЛЕНИЕ СТАТЬЯМИ (АДМИН) ===
window.openCatModal = () => document.getElementById('catModal').classList.add('active');
window.saveCategory = async () => {
    const name = document.getElementById('newCatName').value; const icon = document.getElementById('newCatIcon').value || '📄';
    if(!name) return;
    await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon }) });
    closeModal('catModal'); showToast('Категория добавлена', 'success'); loadData();
};

window.openArticleModal = (isEdit = false) => {
    if(isEdit && state.currentArticle) {
        document.getElementById('modalArtTitle').textContent = 'Редактировать статью';
        document.getElementById('editTitle').value = state.currentArticle.title;
        document.getElementById('editContent').value = state.currentArticle.content;
        document.getElementById('editTier').value = state.currentArticle.tier || 'free';
        document.getElementById('deleteArtBtn').style.display = 'block';
    } else {
        state.currentArticle = null;
        document.getElementById('modalArtTitle').textContent = 'Новая статья';
        document.getElementById('editTitle').value = ''; 
        document.getElementById('editContent').value = '';
        document.getElementById('editTier').value = 'free';
        document.getElementById('deleteArtBtn').style.display = 'none';
    }
    document.getElementById('articleModal').classList.add('active');
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value; 
    const content = document.getElementById('editContent').value;
    const tier = document.getElementById('editTier').value;
    
    if(!title || !content) return showToast('Заполните поля', 'error');
    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    
    await fetch(url, { 
        method: isEdit ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ title, content, category: state.currentCategory, tier }) 
    });
    
    closeModal('articleModal'); showToast('Сохранено!', 'success'); await loadData(); 
    if(isEdit) openCategory(state.currentCategory); 
    else backToCategory();
};

window.deleteArticle = () => showConfirm('Удалить?', 'Действие необратимо', async () => {
    await fetch(`${API_URL}/api/articles/${state.currentArticle.id}`, { method: 'DELETE' });
    closeModal('articleModal'); showToast('Удалено', 'success'); await loadData(); backToCategory();
});

window.closeModal = (id) => document.getElementById(id).classList.remove('active'); loadAdminTab('moderation');
});

// === ФУНКЦИИ СТАТЕЙ ===
window.openCatModal = () => document.getElementById('catModal').classList.add('active');
window.saveCategory = async () => {
    const name = document.getElementById('newCatName').value; const icon = document.getElementById('newCatIcon').value || '📄';
    if(!name) return;
    await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon }) });
    closeModal('catModal'); showToast('Категория добавлена', 'success'); loadData();
};

window.openArticleModal = (isEdit = false) => {
    if(isEdit && state.currentArticle) {
        document.getElementById('editTitle').value = state.currentArticle.title;
        document.getElementById('editContent').value = state.currentArticle.content;
        document.getElementById('deleteArtBtn').style.display = 'block';
    } else {
        state.currentArticle = null;
        document.getElementById('editTitle').value = ''; document.getElementById('editContent').value = '';
        document.getElementById('deleteArtBtn').style.display = 'none';
    }
    document.getElementById('articleModal').classList.add('active');
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value; const content = document.getElementById('editContent').value;
    if(!title || !content) return showToast('Заполните поля', 'error');
    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category: state.currentCategory }) });
    closeModal('articleModal'); showToast('Сохранено!', 'success'); await loadData(); show('home');
};

window.deleteArticle = () => showConfirm('Удалить?', 'Действие необратимо', async () => {
    await fetch(`${API_URL}/api/articles/${state.currentArticle.id}`, { method: 'DELETE' });
    closeModal('articleModal'); showToast('Удалено', 'success'); await loadData(); backToCategory();
});

window.openSubmitArticleModal = () => document.getElementById('submitArticleModal').classList.add('active');
window.submitArticle = async () => {
    const cat = document.getElementById('subCat').value; const title = document.getElementById('subTitle').value;
    const content = document.getElementById('subContent').value; const price = parseFloat(document.getElementById('subPrice').value) || 0;
    if(!title || !content) return showToast('Заполните поля', 'error');
    await fetch(`${API_URL}/api/articles/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, category: cat, title, content, price }) });
    closeModal('submitArticleModal'); showToast('Отправлено на модерацию!', 'success');
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');