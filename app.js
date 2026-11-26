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
        state.user = { id: 6938068102, display_name: 'Админ', username: 'admin', role: 'admin', is_paid: true, goal_amount: 100000, start_capital: 10000, current_balance: 15000, goal_date: '2025-01-01', goal_mode: 'rub', goal_daily_rate: 30 };
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
    
    const avLarge = document.getElementById('userAvatarLarge');
    const banner = document.getElementById('userBanner');
    
    avLarge.replaceChildren();
    if (state.user.avatar_url) {
        const avatarImg = document.createElement('img');
        avatarImg.src = state.user.avatar_url;
        avatarImg.alt = 'Аватар профиля';
        avatarImg.onerror = () => { avLarge.textContent = (name[0] || 'U').toUpperCase(); };
        avLarge.appendChild(avatarImg);
    } else avLarge.textContent = (name[0] || 'U').toUpperCase();
    if (state.user.banner_url) banner.style.backgroundImage = `url(${state.user.banner_url})`; else banner.style.backgroundImage = `url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop')`;

    document.getElementById('userName').textContent = name;
    document.getElementById('userHandle').textContent = '@' + (state.user.username || 'user');
    
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

// НАСТРОЙКИ ПРОФИЛЯ (АВАТАРКА/БАННЕР)
window.openSettingsModal = () => {
    document.getElementById('setName').value = state.user.display_name || '';
    document.getElementById('avatarPreview').style.display = 'none';
    document.getElementById('bannerPreview').style.display = 'none';
    tempAvatarBase64 = state.user.avatar_url;
    tempBannerBase64 = state.user.banner_url;
    document.getElementById('settingsModal').classList.add('active');
};

async function previewImage(input, previewId) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Выберите изображение', 'error'); input.value = ''; return; }
    try {
        const result = await resizeImageData(file, previewId === 'avatarPreview' ? 720 : 1800);
        const preview = document.getElementById(previewId);
        preview.replaceChildren();
        const image = document.createElement('img'); image.src = result; image.alt = 'Предпросмотр';
        preview.appendChild(image); preview.style.display = 'flex';
        if (previewId === 'avatarPreview') tempAvatarBase64 = result;
        if (previewId === 'bannerPreview') tempBannerBase64 = result;
    } catch (e) { console.error(e); showToast('Ошибка обработки изображения', 'error'); }
}
function resizeImageData(file, maxEdge) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = reject;
        reader.onload = () => {
            const img = new Image(); img.onerror = reject;
            img.onload = () => {
                const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
                const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff';
                ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
                let quality = .82, data = canvas.toDataURL('image/jpeg',quality);
                while (data.length > 1500000 && quality > .45) { quality -= .07; data = canvas.toDataURL('image/jpeg',quality); }
                if (data.length > 1900000) return reject(new Error('Image too large'));
                resolve(data);
            }; img.src = reader.result;
        }; reader.readAsDataURL(file);
    });
}

window.saveProfileSettings = async () => {
    const newName = document.getElementById('setName').value.trim();
    if (!newName) return showToast('Введите ник', 'error');
    try {
        const payload = { userId: state.user.id, display_name: newName };
        // Send image fields only when changed; backend preserves current DB values otherwise.
        if (tempAvatarBase64 && tempAvatarBase64 !== state.user.avatar_url) payload.avatar_url = tempAvatarBase64;
        if (tempBannerBase64 && tempBannerBase64 !== state.user.banner_url) payload.banner_url = tempBannerBase64;
        const response = await fetch(`${API_URL}/api/user/update-profile`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
        });
        const result = await response.json().catch(()=>({}));
        if (!response.ok || result.success !== true) throw new Error(result.error || 'Save failed');
        state.user.display_name = newName;
        if (payload.avatar_url) state.user.avatar_url = payload.avatar_url;
        if (payload.banner_url) state.user.banner_url = payload.banner_url;
        closeModal('settingsModal'); showToast('Профиль сохранен', 'success'); updateUIForUser();
    } catch (e) { console.error(e); showToast('Не удалось сохранить профиль. Проверь интернет.', 'error'); }
};

// КАЛЕНДАРЬ И ЦЕЛИ
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
    document.getElementById('dayModalTarget').textContent = `${currentDayPlan.toFixed(0)} ₽`;
    document.getElementById('dayCustomAmount').value = '';
    document.getElementById('dayModal').classList.add('active');
};

window.markDay = async (isDone) => {
    if (isDone) { await addToBalance(currentDayPlan); showToast(`Добавлено ${currentDayPlan.toFixed(0)} ₽!`, 'success'); }
    else { showToast('День отмечен', 'info'); }
    closeModal('dayModal');
};

window.addCustomDay = async () => {
    const val = parseFloat(document.getElementById('dayCustomAmount').value);
    if (!val) return showToast('Введите сумму', 'error');
    await addToBalance(val); showToast(`Добавлено ${val} ₽`, 'success');
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
    document.getElementById('goalTargetDisplay').textContent = target.toLocaleString('ru-RU');
    document.getElementById('goalProgressDisplay').textContent = current.toLocaleString('ru-RU');
    document.getElementById('goalProgressBar').style.width = `${progress}%`;
    const left = target - current;
    document.getElementById('goalLeftDisplay').textContent = left > 0 ? `${left.toLocaleString('ru-RU')} ₽` : 'Достигнута!';
    const goalDate = new Date(state.user.goal_date + 'T00:00:00'); const today = new Date(); today.setHours(0,0,0,0);
    const daysLeft = Math.max(0, Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 3600 * 24)));
    document.getElementById('goalDaysDisplay').textContent = daysLeft;
    let daily = 0; if (daysLeft > 0 && left > 0) daily = left / daysLeft;
    document.getElementById('goalDailyDisplay').textContent = `${daily.toFixed(0)} ₽`;
}

window.openBalanceModal = () => { document.getElementById('dailyProfit').value = ''; document.getElementById('balanceModal').classList.add('active'); };
window.addBalance = async () => {
    const amount = parseFloat(document.getElementById('dailyProfit').value);
    if (!amount) return showToast('Введите сумму', 'error');
    await addToBalance(amount); closeModal('balanceModal'); showToast('Баланс обновлен!', 'success');
};

async function loadData() {
    try {
        const res = await fetch(`${API_URL}/api/data`); const data = await res.json();
        state.categories = data.categories || []; state.articles = data.articles || []; renderCategories();
    } catch(e) { console.error('Load error', e); }
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    grid.innerHTML = state.categories.map(cat => {
        const catName = String(cat.name || '');
        const count = state.articles.filter(a => a.category === catName).length;
        return `<div class="cat-item" onclick="openCategory(${JSON.stringify(catName).replace(/</g,'\\u003c')})"><div class="icon">${cat.icon || '📁'}</div><div class="info"><h4>${catName}</h4><span>${count} статей</span></div><div class="arrow">›</div></div>`;
    }).join('');
}

window.openCategory = (catName) => {
    state.currentCategory = catName; document.getElementById('categoryTitle').textContent = catName;
    const filtered = state.articles.filter(a => a.category === catName); const isPaid = state.user.is_paid || state.user.role === 'admin';
    document.getElementById('articlesList').innerHTML = filtered.length ? filtered.map(art => {
        const isLocked = art.tier === 'pro' && !isPaid;
        if (isLocked) return `<div class="article-item locked" onclick="showPaywall()"><div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div><div class="pro-badge">Нужен план PRO</div></div><button class="btn-locked">Недоступно</button></div>`;
        else return `<div class="article-item" onclick="openArticle(${art.id})"><div class="art-info"><h4>${art.title}</h4><div class="date">${new Date(art.updated_at).toLocaleDateString()}</div>${art.tier === 'pro' ? '<div class="pro-badge">PRO</div>' : ''}</div><button class="btn-read">Ознакомиться</button></div>`;
    }).join('') : '<p style="text-align:center; color:var(--dim);">Здесь пока пусто...</p>';
    show('category');
};

window.openArticle = (id) => {
    const art = state.articles.find(a => a.id === id); state.currentArticle = art;
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
    if (screenId === 'admin') loadAdminTab('payments', document.querySelector('.tab-btn'));
};

async function renderProfile() {
    const container = document.getElementById('profileContent');
    const isPaid = state.user.is_paid || state.user.role === 'admin';
    container.innerHTML = `
        <div class="card" style="text-align:center; padding: 24px; background:var(--card-bg); border-radius:24px; box-shadow: var(--shadow); border: 1px solid var(--card-border); margin-bottom: 16px;">
            <div class="avatar" style="width:70px; height:70px; font-size:28px; margin: 0 auto 16px; background:var(--primary); color:var(--primary-txt);">${(state.user.display_name || 'U')[0]}</div>
            <h3 style="font-size: 20px;">${state.user.display_name}</h3>
            <p style="color:var(--dim); margin-bottom: 20px;">@${state.user.username || 'unknown'}</p>
            <div style="background: ${isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; padding: 12px; border-radius: 16px; font-weight: 800; font-size: 15px;">
                ${isPaid ? '✅ Доступ открыт' : '🔒 Требуется подписка'}
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

// АДМИН ПАНЕЛЬ
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
        await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, category: state.currentCategory, tier }) });
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
    if (tab === 'moderation') {
        const res = await fetch(`${API_URL}/api/admin/moderation`); const data = await res.json();
        document.getElementById('adminModerationList').innerHTML = data.articles.length ? data.articles.map(a => `
            <div class="stat-item" style="flex-direction:column; align-items:flex-start;">
                <div style="font-weight:800;">${a.title} <span style="color:var(--accent); font-size:12px;">[${a.category}]</span></div>
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

window.moderateArticle = (articleId, action) => showConfirm('Модерация', 'Вы уверены?', async () => {
    await fetch(`${API_URL}/api/admin/moderate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId, action }) });
    showToast(action === 'approve' ? 'Опубликовано!' : 'Удалено', 'success'); loadAdminTab('moderation');
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