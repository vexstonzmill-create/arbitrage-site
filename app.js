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
    document.getElementById('userAvatar').textContent = (state.user.display_name || 'U')[0].toUpperCase();
    const isAdmin = state.user.role === 'admin';
    if (isAdmin) {
        document.getElementById('adminAddCatBtn').style.display = 'flex';
        document.getElementById('navAdminBtn').style.display = 'flex';
        document.getElementById('adminAddArtBtn').style.display = 'flex';
    }
    if (state.user.is_paid) document.getElementById('financeSection').style.display = 'block';
}

async function loadData() {
    const res = await fetch(`${API_URL}/api/data`);
    const data = await res.json();
    state.categories = data.categories || [];
    state.articles = data.articles || [];
    
    // Обновляем верхнюю статистику
    const countEl = document.getElementById('statArticlesCount');
    if (countEl) countEl.textContent = state.articles.length;

    renderCategories();
    const subCat = document.getElementById('subCat');
    if (subCat) subCat.innerHTML = state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
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
    document.getElementById('articlesList').innerHTML = filtered.length ? filtered.map(art => `
        <div class="article-item" onclick="openArticle(${art.id})">
            <div><h4>${art.title}</h4><div class="date">Обновлено: ${new Date(art.updated_at).toLocaleDateString()}</div></div><div class="arrow">›</div>
        </div>`).join('') : '<p style="text-align:center; color:var(--dim);">Здесь пока пусто...</p>';
    show('category');
};

window.openArticle = (id) => {
    if (!state.user.is_paid && state.user.role !== 'admin') { checkPaymentStatus(); return; }
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

// === ОПЛАТА ===
async function checkPaymentStatus() {
    const res = await fetch(`${API_URL}/api/user/payment-status/${state.user.id}`);
    const data = await res.json();
    const content = document.getElementById('paywallContent');

    if (data.request && data.request.status === 'requisites_sent') {
        content.innerHTML = `
            <p style="font-size:14px; margin-bottom:10px; font-weight:700;">Оплатите по реквизитам:</p>
            <div style="background:var(--bg); padding:12px; border-radius:12px; font-weight:800; font-size:16px; margin-bottom:16px; border:1px dashed var(--primary);">${data.request.requisites}</div>
            <button class="btn btn-primary" onclick="userPaid(${data.request.id})">Я оплатил</button>
        `;
    } else if (data.request && data.request.status === 'paid') {
        content.innerHTML = `<p style="color:var(--grn); font-weight:800; padding: 20px 0;">Ожидайте подтверждения от админа!</p>`;
    } else {
        content.innerHTML = `
            <div style="background:var(--bg); padding:16px; border-radius:16px; text-align:left; margin-bottom:16px;">
                <p style="font-weight:800; margin-bottom:10px; font-size:16px;">За 30$ вы получаете:</p>
                <ul style="font-size:14px; color:var(--dim); line-height:1.6; padding-left:20px; margin-bottom:10px;">
                    <li>Доступ ко всем мануалам</li>
                    <li>Актуальные связки</li>
                    <li>Возможность продавать свои статьи</li>
                    <li>Личный кабинет и статистику</li>
                </ul>
            </div>
            <button class="btn btn-primary" onclick="requestPayment()">Купить за 30$</button>
        `;
    }
    document.getElementById('paywallModal').classList.add('active');
}

window.requestPayment = async () => {
    await fetch(`${API_URL}/api/payment-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id }) });
    showToast('Заявка отправлена! Ожидайте реквизиты.', 'success');
    closeModal('paywallModal');
};

window.userPaid = async (reqId) => {
    await fetch(`${API_URL}/api/user/payment-paid/${reqId}`, { method: 'POST' });
    showToast('Админ уведомлен об оплате!', 'success');
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
window.show = async (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${screenId}"]`)?.classList.add('active');

    if (screenId === 'profile') { renderProfile(); if (state.user.is_paid) loadTransactions(); }
    if (screenId === 'admin') loadAdminTab('payments', document.querySelector('.tab-btn'));
};

async function renderProfile() {
    const container = document.getElementById('profileContent');
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    container.innerHTML = `
        <div class="card" style="text-align:center; padding: 24px; background:#fff; border-radius:24px; box-shadow: var(--shadow); border: 1px solid var(--card-border); margin-bottom: 16px;">
            <div class="avatar" style="width:70px; height:70px; font-size:28px; margin: 0 auto 16px; background:#f0f0f0; color:#000;">${state.user.display_name[0]}</div>
            <h3 style="font-size: 20px;">${state.user.display_name}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username || 'unknown'}</p>
            <div style="background: ${isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; padding: 12px; border-radius: 16px; font-weight: 800; font-size: 15px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Требуется подписка'}
            </div>
            ${!isPaid ? `<button class="btn btn-primary" onclick="checkPaymentStatus()" style="margin-top:16px;">Купить доступ</button>` : ''}
        </div>
        ${isPaid ? `<button class="btn btn-ghost" onclick="openSubmitArticleModal()" style="border: 1px solid var(--card-border); margin-bottom: 16px;">Предложить статью на продажу</button>` : ''}
    `;
}

window.openQuickAction = () => {
    if (state.user.role === 'admin') { openArticleModal(); } 
    else if (state.user.is_paid) { openSubmitArticleModal(); } 
    else { checkPaymentStatus(); }
};

window.openTransModal = () => document.getElementById('transModal').classList.add('active');
window.saveTransaction = async () => {
    const type = document.getElementById('transType').value; const amount = parseFloat(document.getElementById('transAmount').value); const desc = document.getElementById('transDesc').value;
    if (!amount || !desc) return showToast('Заполните поля', 'error');
    await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, type, amount, description: desc }) });
    closeModal('transModal'); showToast('Операция добавлена', 'success'); loadTransactions();
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
    if (tab === 'moderation') {
        const res = await fetch(`${API_URL}/api/admin/moderation`); const data = await res.json();
        document.getElementById('adminModerationList').innerHTML = data.articles.length ? data.articles.map(a => `
            <div class="stat-item" style="flex-direction:column; align-items:flex-start;">
                <div style="font-weight:800;">${a.title} <span style="color:var(--primary); font-size:12px;">[${a.category}]</span></div>
                <div style="font-size:12px; color:var(--dim); margin-bottom:10px;">Автор: ${a.author_name} | Цена: ${a.price} ₽</div>
                <div style="display:flex; gap:10px; width:100%;">
                    <button class="btn btn-primary" style="padding:8px; font-size:12px; flex:1;" onclick="moderateArticle(${a.id}, 'approve')">Одобрить</button>
                    <button class="btn btn-danger" style="padding:8px; font-size:12px; flex:1;" onclick="moderateArticle(${a.id}, 'reject')">Отклонить</button>
                </div>
            </div>
        `).join('') : '<p>Нет статей на модерации</p>';
    }
}

window.promptRequisites = (reqId) => { currentReqId = reqId; document.getElementById('adminReqText').value = ''; document.getElementById('sendReqModal').classList.add('active'); };
window.sendRequisitesToUser = async () => {
    const text = document.getElementById('adminReqText').value;
    if (!text) return showToast('Введите реквизиты', 'error');
    await fetch(`${API_URL}/api/admin/send-requisites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: currentReqId, requisites: text }) });
    closeModal('sendReqModal'); showToast('Отправлено юзеру!', 'success'); loadAdminTab('payments');
};

window.approvePayment = (reqId, userId) => showConfirm('Подтвердить?', 'Выдать доступ пользователю?', async () => {
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

window.moderateArticle = (articleId, action) => showConfirm('Модерация', 'Вы уверены?', async () => {
    await fetch(`${API_URL}/api/admin/moderate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId, action }) });
    showToast(action === 'approve' ? 'Опубликовано!' : 'Удалено', 'success'); loadAdminTab('moderation');
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

window.closeModal = (id) => document.getElementById(id).classList.remove('active');); backToCategory();
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