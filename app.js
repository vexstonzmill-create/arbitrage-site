const API_URL = window.location.origin;
let state = { user: null, categories: [], articles: [], currentCategory: null, currentArticle: null };
let tg = window.Telegram?.WebApp;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
            showToast(`Ошибка входа. Код: ${res.status}`, 'error');
            fallbackUser();
        }
    } catch(e) { 
        showToast('Ошибка сети при входе.', 'error');
        fallbackUser();
    }
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
    } catch(e) { console.error('Load error', e); }
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
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
    state.currentArticle = null; // СБРОС
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
    resProfit.style.color = profit >= 0 ? 'var(--grn)' : 'var(--red)';
};

window.resetCalc = () => {
    document.getElementById('calcBuy').value = '';
    document.getElementById('calcSell').value = '';
    document.getElementById('calcAmount').value = '';
    document.getElementById('calcBuyFee').value = '';
    document.getElementById('calcSellFee').value = '';
    calcP2P();
};

window.saveCalc = async () => {
    if (!state.user || !state.user.id) return showToast('Нужно авторизоваться!', 'error');
    
    const buy = parseFloat(document.getElementById('calcBuy').value);
    const sell = parseFloat(document.getElementById('calcSell').value);
    const amount = parseFloat(document.getElementById('calcAmount').value);
    const buyFee = parseFloat(document.getElementById('calcBuyFee').value) || 0;
    const sellFee = parseFloat(document.getElementById('calcSellFee').value) || 0;

    if(!buy || !sell || !amount) return showToast('Заполните основные поля', 'error');

    const usdtGross = amount / buy;
    const usdtNet = usdtGross * (1 - (buyFee / 100));
    const rubGross = usdtNet * sell;
    const rubNet = rubGross * (1 - (sellFee / 100));
    const profit = rubNet - amount;

    try {
        const res = await fetch(`${API_URL}/api/calc-save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.user.id, buy_rate: buy, sell_rate: sell, amount: amount, profit: profit })
        });
        if (res.ok) {
            showToast('Расчет добавлен! 📊', 'success');
            resetCalc();
        } else {
            showToast('Ошибка сервера', 'error');
        }
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
        loadCalcHistory();
    }
    if (screenId === 'admin') loadAdminPayments();
};

async function renderProfile() {
    const container = document.getElementById('profileContent');
    if (!state.user) return;
    
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    const displayName = state.user.display_name || state.user.displayName || 'Пользователь';

    container.innerHTML = `
        <div class="dark-card" style="text-align:center; padding: 24px;">
            <div class="avatar" style="width:70px; height:70px; font-size:28px; margin: 0 auto 16px; border: 2px solid var(--dim);">
                ${state.user.avatar_url || state.user.avatarUrl ? `<img src="${state.user.avatar_url || state.user.avatarUrl}">` : displayName[0].toUpperCase()}
            </div>
            <h3 style="color:#fff;">${displayName}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username || 'unknown'}</p>
            
            <div style="background: ${isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; padding: 12px; border-radius: 16px; font-weight: 800; font-size: 15px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Доступ закрыт'}
            </div>
        </div>
    `;
}

async function loadCalcHistory() {
    if (!state.user || !state.user.id) return;
    
    const list = document.getElementById('calcHistoryList');
    const totalEl = document.getElementById('totalProfit');
    
    try {
        const res = await fetch(`${API_URL}/api/calc-history/${state.user.id}`);
        const data = await res.json();
        
        if (!data.history || data.history.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--dim); font-size:14px;">История расчетов пуста</p>';
            totalEl.textContent = '0 ₽';
            totalEl.style.color = 'var(--txt)';
            return;
        }

        let total = 0;
        list.innerHTML = data.history.map(item => {
            const p = parseFloat(item.profit) || 0;
            total += p;
            const isPos = p >= 0;
            return `
                <div class="stat-item">
                    <div>
                        <div style="font-weight: 700; color: #fff;">${item.amount} ₽</div>
                        <div class="info">Куп: ${item.buy_rate} / Прод: ${item.sell_rate}</div>
                    </div>
                    <div class="profit ${isPos ? 'positive' : 'negative'}">
                        ${isPos ? '+' : ''}${p.toFixed(2)} ₽
                    </div>
                </div>
            `;
        }).join('');

        totalEl.textContent = `${total >= 0 ? '+' : ''}${total.toFixed(2)} ₽`;
        totalEl.style.color = total >= 0 ? 'var(--grn)' : 'var(--red)';
    } catch(e) { console.error(e); }
}

// === АДМИНКА ===
async function loadAdminPayments() {
    const container = document.getElementById('adminPaymentsList');
    if (!container) return;
    
    try {
        const res = await fetch(`${API_URL}/api/admin/payments`);
        if (!res.ok) throw new Error('Network error');
        
        const data = await res.json();
        
        if(!data.requests || data.requests.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--dim); padding: 20px;">Нет новых заявок</p>';
            return;
        }

        container.innerHTML = data.requests.map(r => `
            <div class="article-item" style="flex-direction: column; align-items: flex-start;">
                <h4>@${r.username} (${r.display_name})</h4>
                <div class="date" style="margin-bottom: 12px;">${new Date(r.created_at).toLocaleString('ru-RU')}</div>
                <button class="btn btn-primary" onclick="approvePayment(${r.id}, ${r.user_id})" style="padding: 10px;">Подтвердить</button>
            </div>
        `).join('');
    } catch(e) { 
        container.innerHTML = '<p style="text-align:center; color:var(--red); padding: 20px;">Ошибка загрузки</p>'; 
    }
}

window.approvePayment = async (requestId, userId) => {
    try {
        const res = await fetch(`${API_URL}/api/admin/approve-payment`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, userId })
        });
        if (res.ok) {
            showToast('Оплата подтверждена!', 'success');
            loadAdminPayments();
        } else {
            showToast('Ошибка при подтверждении', 'error');
        }
    } catch(e) { showToast('Ошибка сети', 'error'); }
};

// === УПРАВЛЕНИЕ СТАТЬЯМИ ===
window.openCatModal = () => document.getElementById('catModal').classList.add('active');

window.openArticleModal = (isEdit = false) => {
    if(isEdit && state.currentArticle) {
        document.getElementById('modalArtTitle').textContent = 'Редактировать статью';
        document.getElementById('editTitle').value = state.currentArticle.title;
        document.getElementById('editImage').value = state.currentArticle.image_url || '';
        document.getElementById('editContent').value = state.currentArticle.content;
    } else {
        state.currentArticle = null;
        document.getElementById('modalArtTitle').textContent = 'Новая статья';
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
    if(!name) return showToast('Введите название', 'error');
    
    const res = await fetch(`${API_URL}/api/categories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
    });
    
    if(res.ok) {
        closeModal('catModal');
        showToast('Категория создана!', 'success');
        loadData(); 
    } else {
        showToast('Такая категория уже есть', 'error');
    }
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value;
    const content = document.getElementById('editContent').value;
    const image_url = document.getElementById('editImage').value;
    if(!title || !content) return showToast('Заполните заголовок и текст', 'error');

    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    
    const payload = { title, content, image_url };
    if (!isEdit) payload.category = state.currentCategory;

    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            closeModal('articleModal');
            showToast(isEdit ? 'Статья обновлена!' : 'Статья создана!', 'success');
            await loadData(); 
            
            if(isEdit) openArticle(state.currentArticle.id);
            else openCategory(state.currentCategory);
        } else {
            showToast('Ошибка при сохранении', 'error');
        }
    } catch(e) {
        showToast('Ошибка сети', 'error');
    }
};