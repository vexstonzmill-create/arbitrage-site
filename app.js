const API_URL = window.location.origin;
let state = { user: null, categories: [], articles: [], currentCategory: null, currentArticle: null };
let tg = window.Telegram?.WebApp;

document.addEventListener('DOMContentLoaded', async () => {
    if (tg) { tg.ready(); tg.expand(); }
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
    await authUser();
    await loadData();
});

async function authUser() {
    if (tg && tg.initData) {
        try {
            const res = await fetch(`${API_URL}/api/auth/telegram`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });
            const data = await res.json();
            if (res.ok) {
                state.user = data.user;
                updateUIForUser();
            }
        } catch(e) { console.error('Auth error', e); }
    } else {
        state.user = { id: 6938068102, displayName: 'Админ (Браузер)', role: 'admin', avatarUrl: null, is_paid: true };
        updateUIForUser();
    }
}

function updateUIForUser() {
    if (!state.user) return;
    document.getElementById('userName').textContent = state.user.display_name || state.user.displayName;
    const av = document.getElementById('userAvatar');
    if (state.user.avatar_url || state.user.avatarUrl) {
        av.innerHTML = `<img src="${state.user.avatar_url || state.user.avatarUrl}">`;
    } else {
        av.textContent = (state.user.display_name || state.user.displayName)[0].toUpperCase();
    }

    if (state.user.role === 'admin') {
        document.getElementById('adminAddCatBtn').style.display = 'block';
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
    } catch(e) { console.error('Load error', e); }
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = state.categories.map(cat => {
        const count = state.articles.filter(a => a.category === cat.name).length;
        return `
        <div class="cat-card ${cat.color || 'g1'}" onclick="openCategory('${cat.name}')">
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
    const art = state.articles.find(a => a.id === id);
    if (!art) return;
    state.currentArticle = art;

    document.getElementById('articleTitle').textContent = art.title;
    document.getElementById('articleDate').textContent = `Обновлено: ${new Date(art.updated_at).toLocaleString('ru-RU')}`;
    document.getElementById('articleText').textContent = art.content;
    
    const img = document.getElementById('articleImage');
    if (art.image_url) {
        img.src = art.image_url;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }

    if (state.user?.role === 'admin') {
        document.getElementById('adminEditArtBtn').style.display = 'block';
    } else {
        document.getElementById('adminEditArtBtn').style.display = 'none';
    }
    show('article');
};

window.backToCategory = () => openCategory(state.currentCategory);

window.calcP2P = () => {
    const buy = parseFloat(document.getElementById('calcBuy').value) || 0;
    const sell = parseFloat(document.getElementById('calcSell').value) || 0;
    const amount = parseFloat(document.getElementById('calcAmount').value) || 0;
    
    if(!buy || !sell || !amount) return;
    
    const spread = sell - buy;
    const pct = (spread / buy) * 100;
    const profit = (amount / buy) * spread;

    document.getElementById('resSpread').textContent = `${spread.toFixed(2)} ₽ (${pct.toFixed(2)}%)`;
    document.getElementById('resProfit').textContent = `${profit.toFixed(2)} ₽`;
};

window.show = async (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${screenId}"]`)?.classList.add('active');

    if (screenId === 'profile') renderProfile();
    if (screenId === 'admin') loadAdminPayments();
};

async function renderProfile() {
    const container = document.getElementById('profileContent');
    if (!state.user) return;
    
    const isPaid = state.user.is_paid || state.user.role === 'admin';

    container.innerHTML = `
        <div class="glass-card" style="text-align:center; padding: 30px;">
            <div class="avatar" style="width:80px; height:80px; font-size:32px; margin: 0 auto 16px;">${(state.user.display_name || state.user.displayName)[0].toUpperCase()}</div>
            <h3>${state.user.display_name || state.user.displayName}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username}</p>
            
            <div style="background: ${isPaid ? '#dcfce7' : '#fee2e2'}; color: ${isPaid ? '#166534' : '#991b1b'}; padding: 12px; border-radius: 12px; font-weight: 800; margin-bottom: 20px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Доступ закрыт'}
            </div>

            ${!isPaid ? `<button class="btn btn-primary" onclick="requestPayment()">Купить доступ (30$)</button>` : ''}
        </div>
    `;
}

window.requestPayment = async () => {
    try {
        await fetch(`${API_URL}/api/payment-request`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.user.id })
        });
        alert('Заявка отправлена! Ожидайте подтверждения от админа.');
    } catch(e) { alert('Ошибка'); }
};

async function loadAdminPayments() {
    const container = document.getElementById('adminPaymentsList');
    try {
        const res = await fetch(`${API_URL}/api/admin/payments`);
        const data = await res.json();
        
        if(!data.requests.length) {
            container.innerHTML = '<p style="text-align:center; color:var(--dim);">Нет новых заявок</p>';
            return;
        }

        container.innerHTML = data.requests.map(r => `
            <div class="article-item" style="flex-direction: column; align-items: flex-start;">
                <h4>@${r.username} (${r.display_name})</h4>
                <div class="date" style="margin-bottom: 12px;">${new Date(r.created_at).toLocaleString('ru-RU')}</div>
                <button class="btn btn-primary" onclick="approvePayment(${r.id}, ${r.user_id})" style="padding: 10px;">Подтвердить оплату</button>
            </div>
        `).join('');
    } catch(e) { container.innerHTML = 'Ошибка загрузки'; }
}

window.approvePayment = async (requestId, userId) => {
    try {
        await fetch(`${API_URL}/api/admin/approve-payment`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, userId })
        });
        alert('Оплата подтверждена!');
        loadAdminPayments();
    } catch(e) { alert('Ошибка'); }
};

window.openCatModal = () => document.getElementById('catModal').classList.add('active');
window.openArticleModal = (isEdit = false) => {
    document.getElementById('modalArtTitle').textContent = isEdit ? 'Редактировать' : 'Новая статья';
    if(isEdit && state.currentArticle) {
        document.getElementById('editTitle').value = state.currentArticle.title;
        document.getElementById('editImage').value = state.currentArticle.image_url || '';
        document.getElementById('editContent').value = state.currentArticle.content;
    } else {
        document.getElementById('editTitle').value = '';
        document.getElementById('editImage').value = '';
        document.getElementById('editContent').value = '';
    }
    document.getElementById('articleModal').classList.add('active');
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');

window.saveCategory = async () => {
    const name = document.getElementById('newCatName').value;
    const icon = document.getElementById('newCatIcon').value || '📄';
    if(!name) return alert('Введите название');
    
    await fetch(`${API_URL}/api/categories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
    });
    closeModal('catModal');
    loadData(); 
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value;
    const content = document.getElementById('editContent').value;
    const image_url = document.getElementById('editImage').value;
    if(!title || !content) return alert('Заполните поля');

    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    
    await fetch(url, {
        method: isEdit ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, image_url, category: state.currentCategory })
    });
    
    closeModal('articleModal');
    await loadData();
    if(isEdit) openArticle(state.currentArticle.id);
    else openCategory(state.currentCategory);
};