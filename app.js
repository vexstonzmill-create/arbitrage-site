const API_URL = window.location.origin;
let state = { user: null, categories: [], articles: [], currentCategory: null, currentArticle: null };
let tg = window.Telegram?.WebApp;

document.addEventListener('DOMContentLoaded', async () => {
    if (tg) { tg.ready(); tg.expand(); }
    
    // Скрываем лоадер через 500мс, чтобы не висел вечно
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);
    
    await authUser();
    await loadData();
});

async function authUser() {
    // Если мы внутри Telegram и есть данные
    if (tg && tg.initData) {
        try {
            const res = await fetch(`${API_URL}/api/auth/telegram`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });
            
            if (res.ok) {
                const data = await res.json();
                state.user = data.user;
                updateUIForUser();
            } else {
                // Если сервер вернул ошибку (например, 401)
                console.warn('Сервер отклонил авторизацию Telegram');
                fallbackUser('Ошибка входа в ТГ');
            }
        } catch(e) { 
            console.error('Ошибка сети при авторизации:', e); 
            fallbackUser('Нет связи с сервером');
        }
    } else {
        // Если мы в браузере (для тестов)
        console.log('Открыто в браузере. Включаем режим Админа.');
        state.user = { id: 6938068102, display_name: 'Админ (Браузер)', role: 'admin', avatar_url: null, is_paid: true };
        updateUIForUser();
    }
}

// Функция-спасатель, если ТГ не авторизовал
function fallbackUser(reason) {
    state.user = { display_name: 'Гость', username: 'guest', role: 'user', avatar_url: null, is_paid: false };
    updateUIForUser();
    alert('Не удалось войти через Telegram: ' + reason + '\nПопробуйте перезапустить приложение.');
}

function updateUIForUser() {
    if (!state.user) return;
    
    // Убираем "Загрузка..."
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = state.user.display_name || state.user.displayName || 'Гость';
    
    const av = document.getElementById('userAvatar');
    if (av) {
        if (state.user.avatar_url || state.user.avatarUrl) {
            av.innerHTML = `<img src="${state.user.avatar_url || state.user.avatarUrl}">`;
        } else {
            const initial = (state.user.display_name || state.user.displayName || 'U')[0].toUpperCase();
            av.textContent = initial;
        }
    }

    // Показываем кнопки админа, если роль позволяет
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
    if (!grid) return;
    
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

// === КАЛЬКУЛЯТОР С КОМИССИЯМИ ===
window.calcP2P = () => {
    const buy = parseFloat(document.getElementById('calcBuy').value) || 0;
    const sell = parseFloat(document.getElementById('calcSell').value) || 0;
    const amount = parseFloat(document.getElementById('calcAmount').value) || 0;
    const buyFee = parseFloat(document.getElementById('calcBuyFee').value) || 0;
    const sellFee = parseFloat(document.getElementById('calcSellFee').value) || 0;

    const resSpread = document.getElementById('resSpread');
    const resProfit = document.getElementById('resProfit');

    if(!buy || !sell || !amount) {
        resSpread.textContent = '0 ₽ (0%)';
        resProfit.textContent = '0 ₽';
        resProfit.style.color = 'var(--grn)';
        return;
    }

    const usdtGross = amount / buy;
    const usdtNet = usdtGross * (1 - (buyFee / 100));
    const rubGross = usdtNet * sell;
    const rubNet = rubGross * (1 - (sellFee / 100));

    const profit = rubNet - amount;
    const spreadPct = ((sell - buy) / buy) * 100;

    resSpread.textContent = `${(sell - buy).toFixed(2)} ₽ (${spreadPct.toFixed(2)}%)`;
    resProfit.textContent = `${profit.toFixed(2)} ₽`;
    resProfit.style.color = profit >= 0 ? 'var(--grn)' : '#ef4444';
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
    
    // ЗАЩИТА: Если юзера нет, показываем заглушку, а не пустоту
    if (!state.user) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <p style="color:var(--red); font-weight: 800; margin-bottom: 10px;">Ошибка авторизации</p>
                <p style="color:var(--dim);">Не удалось загрузить данные пользователя. Попробуйте перезайти в приложение.</p>
            </div>
        `;
        return;
    }
    
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    const displayName = state.user.display_name || state.user.displayName || 'Пользователь';

    container.innerHTML = `
        <div class="glass-card" style="text-align:center; padding: 30px;">
            <div class="avatar" style="width:80px; height:80px; font-size:32px; margin: 0 auto 16px;">
                ${state.user.avatar_url || state.user.avatarUrl ? `<img src="${state.user.avatar_url || state.user.avatarUrl}">` : displayName[0].toUpperCase()}
            </div>
            <h3>${displayName}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username || 'unknown'}</p>
            
            <div style="background: ${isPaid ? '#dcfce7' : '#fee2e2'}; color: ${isPaid ? '#166534' : '#991b1b'}; padding: 12px; border-radius: 12px; font-weight: 800; margin-bottom: 20px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Доступ закрыт'}
            </div>

            ${!isPaid ? `<button class="btn btn-primary" onclick="requestPayment()">Купить доступ (30$)</button>` : ''}
        </div>
    `;
}

window.requestPayment = async () => {
    if (!state.user || !state.user.id) return alert('Ошибка: нет ID пользователя');
    try {
        await fetch(`${API_URL}/api/payment-request`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.user.id })
        });
        alert('Заявка отправлена! Ожидайте подтверждения от админа.');
    } catch(e) { alert('Ошибка отправки'); }
};

// ... ОСТАЛЬНОЙ КОД (АДМИНКА, МОДАЛКИ) ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ ...
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