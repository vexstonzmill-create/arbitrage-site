// === ТВОИ МАНУАЛЫ (Структурированные) ===
const KB_DATA = [
    {
        category: "Банки",
        title: "Мануал ПСБ и Альфа",
        content: "Стабильные банки. Приём по СБП до момента реза. 4-5 платежей в день. Остаток на карте 2-4к. Траты 1500р/день. Прогрев 3-4 дня. ПСБ блок снимается за 15 дней. Альфа - 14+ лет, день отлеги, прогрев 10-15 категорий, запуск с 9 до 00."
    },
    {
        category: "Банки",
        title: "Мануал Т-Банк",
        content: "Включаемся от 10к по СБП. Интервал от 20 мин. Ровно 6 платежей. Далее по С2С 2 платежа. Снимаемся по 30-40к. Работа 10:00-20:00 (5/2). На ночь оставляем ~3к. Дроп 16+, лучше 18+."
    },
    {
        category: "Связки",
        title: "Связка Bybit-HTX",
        content: "Мейкер на Bybit, Тейкер на HTX. Объявление на Bybit по 80.6, на HTX продажа по 83.8. Передаем реквизиты. Перевод 30-40 мин. Чистыми ~4-4.5%. HTX в санкционном списке!"
    },
    {
        category: "Связки",
        title: "Обменник + Карты",
        content: "Берем нал 12к, покупаем USDT по 80. Ищем покупателей по 85-88. Считаем: 150 USDT * 85 = 12750. Прибыль +750р. Сняли - повторили. 3 круга = 2250р."
    },
    {
        category: "Безопасность",
        title: "Почему карты блокируют",
        content: "1. Короткий прогрев. 2. Дробление операций. 3. Резкое прекращение трат. 4. Переводы заграницу. 5. Переводы незнакомым. Всегда сохраняйте номер получателя в контакты перед переводом!"
    },
    {
        category: "Термины",
        title: "Словарь Арбитражника",
        content: "КА - контрагент. Ферма - 1-3 чека в сутки. Агроферма - от 50к в сутки. Материал - карта/симка. Гном - дроп. Откуп - отправка средств после приема. Круг - работа с входящими и исходящими. Стяг - переводы между своими счетами."
    },
    {
        category: "Апелляции",
        title: "Как выигрывать споры",
        content: "Перевод не на тот банк = почти гарантированная потеря. Рисуйте видео, что платеж не поступал. Не выдумывайте данные и не подделывайте видео с 'единым переводом' - это бан."
    }
];

const API_URL = window.location.origin; // Будет работать и локально, и на Render

const API = {
    token: () => localStorage.getItem('vexo_token'),
    user: () => { try { return JSON.parse(localStorage.getItem('vexo_user')); } catch { return null; } },
    async req(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token()) headers.Authorization = 'Bearer ' + this.token();
        const res = await fetch(API_URL + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Error');
        return data;
    }
};

function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// Тема
let currentTheme = localStorage.getItem('vexo_theme') || 'dark';
document.body.setAttribute('data-theme', currentTheme);
window.toggleTheme = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('vexo_theme', currentTheme);
};

// Авторизация
function updateAuthUI() {
    const u = API.user();
    const adminBtn = document.getElementById('adminBnBtn');
    if (u && u.role === 'admin') {
        adminBtn.style.display = 'flex';
    } else {
        adminBtn.style.display = 'none';
    }
}

document.getElementById('tgLoginBtn').onclick = async () => {
    if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
        return toast('Откройте приложение в Telegram', 'error');
    }
    try {
        const res = await API.req('POST', '/auth/telegram', { initData: window.Telegram.WebApp.initData });
        localStorage.setItem('vexo_token', res.token);
        localStorage.setItem('vexo_user', JSON.stringify(res.user));
        document.getElementById('authModal').classList.remove('active');
        updateAuthUI();
        renderProfile();
        toast('Вход выполнен!', 'success');
    } catch(e) { toast(e.message, 'error'); }
};

document.getElementById('emailLoginBtn').onclick = async () => {
    const login = document.getElementById('loginInput').value;
    const password = document.getElementById('passInput').value;
    try {
        const res = await API.req('POST', '/auth/login', { login, password });
        localStorage.setItem('vexo_token', res.token);
        localStorage.setItem('vexo_user', JSON.stringify(res.user));
        document.getElementById('authModal').classList.remove('active');
        updateAuthUI();
        renderProfile();
        toast('Вход выполнен!', 'success');
    } catch(e) { toast('Неверный логин или пароль', 'error'); }
};

// Рендер Базы Знаний
let currentCategory = 'all';
function renderKB() {
    const container = document.getElementById('kbContent');
    const filtered = currentCategory === 'all' ? KB_DATA : KB_DATA.filter(k => k.category === currentCategory);
    
    container.innerHTML = filtered.map(k => `
        <div class="glass-card" style="margin-bottom: 12px;">
            <span class="badge-face" style="margin-bottom: 8px; display: inline-block;">${k.category}</span>
            <h3 style="font-size: 18px; margin-bottom: 8px;">${k.title}</h3>
            <p style="font-size: 14px; color: var(--dim); line-height: 1.5;">${k.content}</p>
        </div>
    `).join('');
}

document.querySelectorAll('#kbCategories .icon-chip').forEach(chip => {
    chip.onclick = () => {
        document.querySelectorAll('#kbCategories .icon-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentCategory = chip.dataset.cat;
        renderKB();
    };
});

// Рендер Профиля
async function renderProfile() {
    const container = document.getElementById('profileContent');
    let u = API.user();
    
    if (!u) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 40px; margin-bottom: 16px;">🔒</div>
                <p style="margin-bottom: 16px;">Войдите, чтобы получить доступ</p>
                <button class="btn btn-primary" onclick="document.getElementById('authModal').classList.add('active')">Войти</button>
            </div>
        `;
        return;
    }

    // Обновляем данные с сервера
    try {
        const res = await API.req('GET', '/users/me');
        localStorage.setItem('vexo_user', JSON.stringify(res.user));
        u = res.user;
    } catch(e) {}

    const isPaid = u.isPaid || u.role === 'admin';

    container.innerHTML = `
        <div class="glass-card profile-header-card">
            <div class="profile-info-left">
                <div class="avatar lg">${u.displayName[0].toUpperCase()}</div>
                <div>
                    <h2 class="profile-name-row">${u.displayName}</h2>
                    <div style="font-size:13px;color:var(--dim);">@${u.username}</div>
                </div>
            </div>
        </div>

        <div class="glass-card" style="text-align: center; padding: 24px;">
            <h3 style="margin-bottom: 12px;">Статус доступа</h3>
            <div style="font-size: 24px; font-weight: 900; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; margin-bottom: 16px;">
                ${isPaid ? 'ОПЛАЧЕНО' : 'ЗАКРЫТ'}
            </div>
            ${!isPaid ? `
                <p style="font-size: 14px; color: var(--dim); margin-bottom: 16px;">Отправьте заявку на покупку доступа. Админ подтвердит оплату и откроет базу.</p>
                <button class="btn btn-primary btn-block" onclick="requestAccess()">Купить доступ (30$)</button>
            ` : `
                <p style="font-size: 14px; color: var(--grn);">Вам доступны все материалы!</p>
            `}
        </div>

        <button class="btn btn-ghost btn-block" style="margin-top: 24px; color: var(--red);" onclick="localStorage.clear(); location.reload();">Выйти</button>
    `;
}

// Создание заявки
window.requestAccess = async () => {
    const u = API.user();
    try {
        await API.req('POST', '/requests/access', { userId: u.id, userName: u.username });
        toast('Заявка отправлена админу!', 'success');
    } catch(e) { toast('Ошибка отправки', 'error'); }
};

// Админка
async function renderAdmin() {
    const container = document.getElementById('adminRequestsList');
    try {
        const { requests } = await API.req('GET', '/admin/requests');
        if (!requests.length) {
            container.innerHTML = '<div class="empty-state">Нет активных заявок</div>';
            return;
        }
        
        container.innerHTML = requests.map(r => `
            <div class="ad-card" style="padding: 16px; margin-bottom: 12px;">
                <div style="font-weight: 800; margin-bottom: 4px;">@${r.userName} (ID: ${r.userId})</div>
                <div style="font-size: 12px; color: var(--dim); margin-bottom: 12px;">${new Date(r.date).toLocaleString('ru-RU')}</div>
                <button class="btn btn-primary btn-sm" onclick="approveUser(${r.userId})">Одобрить</button>
            </div>
        `).join('');
    } catch(e) { container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>'; }
}

window.approveUser = async (userId) => {
    try {
        await API.req('POST', '/admin/approve', { userId });
        toast('Доступ выдан!', 'success');
        renderAdmin();
    } catch(e) { toast('Ошибка', 'error'); }
};

// Навигация
window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    
    document.querySelectorAll('.bn-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.bn-btn[data-screen="${screenId}"]`)?.classList.add('active');

    if (screenId === 'profile') renderProfile();
    if (screenId === 'admin') renderAdmin();
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden-loader');
    }, 800);

    renderKB();
    updateAuthUI();
    
    // Автовход через ТГ
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        document.getElementById('tgLoginBtn').click();
    }
});d.icon}</div>
                <div class="card-text">
                    <div class="status-pill pill-cyan">${mod.category}</div>
                    <h3>${mod.title}</h3>
                    <p style="font-size: 13px; line-height: 1.5; margin-top: 8px;">${mod.content}</p>
                </div>
            </div>
        `;
    });

    // Кнопка в конце
    html += `
        <button class="btn btn-outline" style="margin-top: 30px;" onclick="initApp()">
            Обновить страницу
        </button>
    `;

    appDiv.innerHTML = html;
}

// Запуск при открытии сайта
initApp();