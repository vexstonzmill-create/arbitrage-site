const API_URL = window.location.origin;
let state = { user: null, categories: [], articles: [], currentCategory: null, currentArticle: null };
let tg = window.Telegram?.WebApp;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (tg) { tg.ready(); tg.expand(); }
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
    await authUser();
    await loadData();
});

async function authUser() {
    if (!tg || !tg.initData) {
        state.user = { id: 6938068102, display_name: 'Админ (Браузер)', role: 'admin', avatar_url: null, is_paid: true };
        updateUIForUser();
        return;
    }
    try {
        const res = await fetch(`${API_URL}/api/auth/telegram`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });
        if (res.ok) {
            const data = await res.json();
            state.user = data.user;
            updateUIForUser();
        } else {
            fallbackUser();
        }
    } catch(e) { fallbackUser(); }
}

function fallbackUser() {
    state.user = { display_name: 'Гость', username: 'guest', role: 'user', avatar_url: null, is_paid: false };
    updateUIForUser();
}

function updateUIForUser() {
    if (!state.user) return;
    const av = document.getElementById('userAvatar');
    if (av) {
        if (state.user.avatar_url || state.user.avatarUrl) {
            av.innerHTML = `<img src="${state.user.avatar_url || state.user.avatarUrl}">`;
        } else {
            av.textContent = (state.user.display_name || state.user.displayName || 'U')[0].toUpperCase();
        }
    }
    const isAdmin = state.user.role === 'admin' || state.user.id === 6938068102;
    if (isAdmin) {
        document.getElementById('adminAddCatBtn').style.display = 'flex';
        document.getElementById('navAdminBtn').style.display = 'flex';
        document.getElementById('adminAddArtBtn').style.display = 'flex';
    }
}

async function loadData() {
    try {
        const res = await fetch(`${API_URL}/api/data`);
        const data = await res.json();
        state.categories = data.categories || [];
        state.articles = data.articles || [];
        renderCategories();
    } catch(e) { console.error(e); }
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = state.categories.map(cat => {
        const count = state.articles.filter(a => a.category === cat.name).length;
        return `
        <div class="cat-card" onclick="openCategory('${cat.name}')">
            <div class="icon">${cat.icon}</div>
            <div>
                <h4>${cat.name}</h4>
                <span>${count} статей</span>
            </div>
        </div>`;
    }).join('');
}

window.openCategory = (catName) => {
    state.currentCategory = catName;
    state.currentArticle = null;
    document.getElementById('categoryTitle').textContent = catName;
    const list = document.getElementById('articlesList');
    const filtered = state.articles.filter(a => a.category === catName);
    list.innerHTML = filtered.length ? filtered.map(art => `
        <div class="article-item" onclick="openArticle(${art.id})">
            <div>
                <h4>${art.title}</h4>
                <div class="date">Обновлено: ${new Date(art.updated_at).toLocaleDateString('ru-RU')}</div>
            </div>
            <div class="arrow">›</div>
        </div>
    `).join('') : '<p style="text-align:center; color:var(--dim);">Здесь пока пусто...</p>';
    show('category');
};

window.openArticle = (id) => {
    // ПРОВЕРКА ПОДПИСКИ
    if (!state.user.is_paid && state.user.role !== 'admin') {
        document.getElementById('paywallModal').classList.add('active');
        return;
    }

    const art = state.articles.find(a => a.id === id);
    if (!art) return;
    state.currentArticle = art;

    document.getElementById('articleTitle').textContent = art.title;
    document.getElementById('articleDate').textContent = `Обновлено: ${new Date(art.updated_at).toLocaleString('ru-RU')}`;
    document.getElementById('articleText').textContent = art.content;
    
    const img = document.getElementById('articleImage');
    if (art.image_url) { img.src = art.image_url; img.style.display = 'block'; } else { img.style.display = 'none'; }

    const isAdmin = state.user?.role === 'admin' || state.user?.id === 6938068102;
    document.getElementById('adminEditArtBtn').style.display = isAdmin ? 'flex' : 'none';
    show('article');
};

window.backToCategory = () => openCategory(state.currentCategory);

// === КАЛЬКУЛЯТОР ===
window.calcP2P = () => {
    const buy = parseFloat(document.getElementById('calcBuy').value) || 0;
    const sell = parseFloat(document.getElementById('calcSell').value) || 0;
    const amount = parseFloat(document.getElementById('calcAmount').value) || 0;
    const buyFee = parseFloat(document.getElementById('calcBuyFee').value) || 0;
    const sellFee = parseFloat(document.getElementById('calcSellFee').value) || 0;

    const resSpread = document.getElementById('resSpread');
    const resProfit = document.getElementById('resProfit');

    if(!buy || !sell || !amount) {
        resSpread.textContent = '0 ₽ (0%)'; resProfit.textContent = '0 ₽'; resProfit.style.color = 'var(--grn)'; return;
    }
    const usdtGross = amount / buy; const usdtNet = usdtGross * (1 - (buyFee / 100));
    const rubGross = usdtNet * sell; const rubNet = rubGross * (1 - (sellFee / 100));
    const profit = rubNet - amount; const spreadPct = ((sell - buy) / buy) * 100;

    resSpread.textContent = `${(sell - buy).toFixed(2)} ₽ (${spreadPct.toFixed(2)}%)`;
    resProfit.textContent = `${profit.toFixed(2)} ₽`;
    resProfit.style.color = profit >= 0 ? 'var(--grn)' : 'var(--red)';
};

window.resetCalc = () => {
    document.getElementById('calcBuy').value = ''; document.getElementById('calcSell').value = ''; document.getElementById('calcAmount').value = ''; document.getElementById('calcBuyFee').value = ''; document.getElementById('calcSellFee').value = ''; calcP2P();
};

window.saveCalc = async () => {
    if (!state.user || !state.user.id) return showToast('Ошибка: нет ID', 'error');
    const buy = parseFloat(document.getElementById('calcBuy').value); const sell = parseFloat(document.getElementById('calcSell').value); const amount = parseFloat(document.getElementById('calcAmount').value);
    const buyFee = parseFloat(document.getElementById('calcBuyFee').value) || 0; const sellFee = parseFloat(document.getElementById('calcSellFee').value) || 0;
    if(!buy || !sell || !amount) return showToast('Заполните поля', 'error');

    const usdtGross = amount / buy; const usdtNet = usdtGross * (1 - (buyFee / 100));
    const rubGross = usdtNet * sell; const rubNet = rubGross * (1 - (sellFee / 100));
    const profit = rubNet - amount;

    try {
        const res = await fetch(`${API_URL}/api/calc-save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, buy_rate: buy, sell_rate: sell, amount: amount, profit: profit }) });
        if (res.ok) { showToast('Расчет добавлен!', 'success'); resetCalc(); } else { showToast('Ошибка', 'error'); }
    } catch(e) { showToast('Ошибка сети', 'error'); }
};

// === НАВИГАЦИЯ И ПРОФИЛЬ ===
window.show = async (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${screenId}"]`)?.classList.add('active');

    if (screenId === 'profile') {
        renderProfile();
        if (state.user && state.user.is_paid) {
            document.getElementById('financeSection').style.display = 'block';
            loadTransactions(); loadRequisites();
        } else {
            document.getElementById('financeSection').style.display = 'none';
        }
    }
    if (screenId === 'admin') loadAdminPayments();
};

window.openExchange = () => { showToast('Биржа в разработке, ожидается! 🛠', 'info'); };

// Центральная кнопка
window.openQuickAction = () => {
    if (!state.user.is_paid) return showToast('Купите доступ для использования', 'error');
    const isAdmin = state.user.role === 'admin';
    if (isAdmin) { openArticleModal(); } else { openTransModal(); }
};

async function renderProfile() {
    const container = document.getElementById('profileContent');
    if (!state.user) return;
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    const displayName = state.user.display_name || state.user.displayName || 'Пользователь';

    container.innerHTML = `
        <div class="card" style="text-align:center; padding: 24px; background:#fff; border-radius:24px; box-shadow: var(--shadow);">
            <div class="avatar" style="width:70px; height:70px; font-size:28px; margin: 0 auto 16px; background:#f0f0f0; color:#000;">
                ${state.user.avatar_url || state.user.avatarUrl ? `<img src="${state.user.avatar_url || state.user.avatarUrl}">` : displayName[0].toUpperCase()}
            </div>
            <h3 style="color:#000; font-size: 20px;">${displayName}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username || 'unknown'}</p>
            
            <div style="background: ${isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; padding: 12px; border-radius: 16px; font-weight: 800; font-size: 15px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Требуется подписка'}
            </div>
            ${!isPaid ? `<button class="btn btn-primary" onclick="requestPayment()" style="margin-top:16px;">Купить доступ</button>` : ''}
        </div>
    `;
}

window.requestPayment = async () => {
    if (!state.user || !state.user.id) return showToast('Ошибка', 'error');
    try {
        await fetch(`${API_URL}/api/payment-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id }) });
        showToast('Заявка отправлена админу!', 'success');
    } catch(e) { showToast('Ошибка', 'error'); }
};

// === ФИНАНСЫ ===
window.openTransModal = () => document.getElementById('transModal').classList.add('active');
window.openReqModal = () => document.getElementById('reqModal').classList.add('active');

window.saveTransaction = async () => {
    const type = document.getElementById('transType').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const desc = document.getElementById('transDesc').value;
    if (!amount || !desc) return showToast('Заполните все поля', 'error');

    await fetch(`${API_URL}/api/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, type, amount, description: desc }) });
    closeModal('transModal'); showToast('Операция добавлена', 'success'); loadTransactions();
};

window.saveRequisite = async () => {
    const bank = document.getElementById('reqBank').value;
    const card = document.getElementById('reqCard').value;
    if (!bank || !card) return showToast('Заполните все поля', 'error');

    await fetch(`${API_URL}/api/requisites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: state.user.id, bank_name: bank, card_number: card }) });
    closeModal('reqModal'); showToast('Реквизиты добавлены', 'success'); loadRequisites();
};

async function loadTransactions() {
    const list = document.getElementById('transactionsList');
    const res = await fetch(`${API_URL}/api/transactions/${state.user.id}`);
    const data = await res.json();
    let inc = 0, exp = 0;

    list.innerHTML = data.items.length ? data.items.map(t => {
        const isInc = t.type === 'income';
        if (isInc) inc += parseFloat(t.amount); else exp += parseFloat(t.amount);
        return `<div class="stat-item">
            <div><div style="font-weight:800;">${t.description}</div><div class="info">${new Date(t.created_at).toLocaleDateString()}</div></div>
            <div class="profit ${isInc ? 'positive' : 'negative'}">${isInc ? '+' : '-'}${t.amount} ₽</div>
        </div>`;
    }).join('') : '<p style="color:var(--dim); font-size:14px;">Нет операций</p>';

    document.getElementById('totalIncome').textContent = `+${inc} ₽`;
    document.getElementById('totalExpense').textContent = `-${exp} ₽`;
    document.getElementById('netProfit').textContent = `${inc - exp} ₽`;
    document.getElementById('netProfit').style.color = (inc - exp) >= 0 ? 'var(--grn)' : 'var(--red)';
}

async function loadRequisites() {
    const list = document.getElementById('requisitesList');
    const res = await fetch(`${API_URL}/api/requisites/${state.user.id}`);
    const data = await res.json();
    list.innerHTML = data.items.length ? data.items.map(r => `
        <div class="stat-item">
            <div><div style="font-weight:800;">${r.bank_name}</div><div class="info">${r.card_number}</div></div>
            <div style="font-size:24px; cursor:pointer;" onclick="navigator.clipboard.writeText('${r.card_number}'); showToast('Скопировано', 'success')">📋</div>
        </div>
    `).join('') : '<p style="color:var(--dim); font-size:14px;">Нет реквизитов</p>';
}

// === АДМИНКА ===
async function loadAdminPayments() {
    const container = document.getElementById('adminPaymentsList');
    try {
        const res = await fetch(`${API_URL}/api/admin/payments`);
        const data = await res.json();
        if(!data.requests || data.requests.length === 0) { container.innerHTML = '<p style="text-align:center; color:var(--dim);">Нет заявок</p>'; return; }
        container.innerHTML = data.requests.map(r => `
            <div class="article-item" style="flex-direction: column; align-items: flex-start;">
                <h4>@${r.username} (${r.display_name})</h4>
                <div class="date" style="margin-bottom: 12px;">${new Date(r.created_at).toLocaleString()}</div>
                <button class="btn btn-primary" onclick="approvePayment(${r.id}, ${r.user_id})" style="padding: 10px;">Одобрить</button>
            </div>
        `).join('');
    } catch(e) { container.innerHTML = '<p style="text-align:center; color:var(--red);">Ошибка</p>'; }
}

window.approvePayment = async (requestId, userId) => {
    await fetch(`${API_URL}/api/admin/approve-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, userId }) });
    showToast('Оплата подтверждена!', 'success'); loadAdminPayments();
};

// === УПРАВЛЕНИЕ СТАТЬЯМИ ===
window.openCatModal = () => document.getElementById('catModal').classList.add('active');
window.openArticleModal = (isEdit = false) => {
    if(isEdit && state.currentArticle) {
        document.getElementById('modalArtTitle').textContent = 'Редактировать';
        document.getElementById('editTitle').value = state.currentArticle.title;
        document.getElementById('editImage').value = state.currentArticle.image_url || '';
        document.getElementById('editContent').value = state.currentArticle.content;
        document.getElementById('deleteArtBtn').style.display = 'block';
    } else {
        state.currentArticle = null;
        document.getElementById('modalArtTitle').textContent = 'Новая статья';
        document.getElementById('editTitle').value = ''; document.getElementById('editImage').value = ''; document.getElementById('editContent').value = '';
        document.getElementById('deleteArtBtn').style.display = 'none';
    }
    document.getElementById('articleModal').classList.add('active');
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');

window.saveCategory = async () => {
    const name = document.getElementById('newCatName').value; const icon = document.getElementById('newCatIcon').value || '📄';
    if(!name) return showToast('Введите название', 'error');
    const res = await fetch(`${API_URL}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, icon }) });
    if(res.ok) { closeModal('catModal'); showToast('Категория создана', 'success'); loadData(); } else { showToast('Ошибка', 'error'); }
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value; const content = document.getElementById('editContent').value; const image_url = document.getElementById('editImage').value;
    if(!title || !content) return showToast('Заполните поля', 'error');
    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    const payload = { title, content, image_url }; if (!isEdit) payload.category = state.currentCategory;

    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
        closeModal('articleModal'); showToast(isEdit ? 'Обновлено!' : 'Создано!', 'success'); await loadData();
        if(isEdit) openArticle(state.currentArticle.id); else openCategory(state.currentCategory);
    } else { showToast('Ошибка', 'error'); }
};

window.deleteArticle = async () => {
    if (!confirm('Точно удалить статью?')) return;
    await fetch(`${API_URL}/api/articles/${state.currentArticle.id}`, { method: 'DELETE' });
    closeModal('articleModal'); showToast('Удалено', 'success'); await loadData(); openCategory(state.currentCategory);
};