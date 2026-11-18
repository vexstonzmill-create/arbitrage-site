const API_URL = 'https://vxomanual.onrender.com'; 

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const initData = tg.initData;

const appDiv = document.getElementById('app');

// 1. Проверяем, открыто ли приложение внутри Telegram
if (!initData) {
    appDiv.innerHTML = `
        <div style="text-align:center; padding: 40px 20px;">
            <h1 style="color:#fff; font-size:24px;">Откройте в Telegram</h1>
            <p style="color:#8e8e93; font-size:16px;">Это приложение работает только внутри Telegram.</p>
            <a href="https://t.me/ТВОЙ_БОТ" style="display:inline-block; margin-top:20px; padding:14px 28px; background:#22d3ee; color:#000; border-radius:12px; text-decoration:none; font-weight:600;">Открыть в Telegram</a>
        </div>
    `;
    throw new Error('Приложение открыто вне Telegram');
}

// Рендер шапки
function renderHeader() {
    const user = tg.initDataUnsafe?.user || {};
    const avatar = user.photo_url 
        ? `<img src="${user.photo_url}" class="avatar" alt="avatar">` 
        : `<div class="avatar-placeholder">${user.first_name ? user.first_name[0] : 'U'}</div>`;

    return `
        <div class="header">
            <div>
                <h1 class="title">Library</h1>
                <div class="subtitle">vxo | 767 P2P</div>
            </div>
            ${avatar}
        </div>
    `;
}

function renderPage(contentHTML) {
    appDiv.innerHTML = renderHeader() + contentHTML;
}

// 2. Проверка доступа
function checkAccess() {
    appDiv.innerHTML = `<div class="loading" style="color:#22d3ee; text-align:center; margin-top:50px;">Загрузка...</div>`;
    
    fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(async res => {
        // Если сервер вернул ошибку, читаем её
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Ошибка сервера: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        if (!data.subscribed) {
            renderPage(`
                <div class="library-card card-gradient-red">
                    <div class="card-icon">📡</div>
                    <div class="card-text">
                        <h2>Шаг 1: Подписка</h2>
                        <p>Подпишись на канал, чтобы получить доступ</p>
                    </div>
                </div>
                <button class="btn btn-cyan" onclick="subscribe()">Подписаться</button>
                <button class="btn btn-outline" onclick="checkAccess()">Я уже подписался</button>
            `);
        } else if (!data.paid) {
            renderPage(`
                <div class="library-card card-gradient-orange">
                    <div class="card-icon">🔓</div>
                    <div class="card-text">
                        <h2>Шаг 2: Доступ</h2>
                        <p>Подписка есть! Осталось купить доступ к базе</p>
                    </div>
                </div>
                <div class="price-tag">$30 <span>пожизненно</span></div>
                <button class="btn btn-pink" onclick="pay()">Купить доступ</button>
            `);
        } else {
            loadContent();
        }
    })
    .catch((err) => {
        // Показываем РЕАЛЬНУЮ ошибку на экране
        appDiv.innerHTML = `
            <div class="error" style="text-align:center; margin-top:50px;">
                <p style="color:#ef4444; font-weight:bold; margin-bottom:10px;">Ошибка:</p>
                <p style="color:#fff; background:rgba(255,255,255,0.1); padding:10px; border-radius:8px; font-size:14px;">${err.message}</p>
                <button class="btn btn-outline" onclick="checkAccess()" style="margin-top:20px;">Попробовать снова</button>
            </div>
        `;
    });
}

// Загрузка контента
function loadContent() {
    fetch(`${API_URL}/api/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(async res => {
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Ошибка: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        let html = `<h2 class="section-title">Your Modules</h2>`;
        
        if (!data.modules || data.modules.length === 0) {
            html += `<p class="text-gray">Пока нет материалов.</p>`;
        } else {
            data.modules.forEach(mod => {
                html += `
                    <div class="library-card card-gradient-blue">
                        <div class="card-text">
                            <div class="status-pill pill-cyan">${mod.category}</div>
                            <h3>${mod.title}</h3>
                            <p>${mod.content}</p>
                        </div>
                    </div>
                `;
            });
        }
        renderPage(html);
    })
    .catch((err) => {
        renderPage(`<div class="error">Ошибка загрузки: ${err.message}</div>`);
    });
}

function subscribe() {
    tg.openTelegramLink('https://t.me/vxo_767'); 
}

function pay() {
    fetch(`${API_URL}/api/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(async res => {
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Ошибка: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        if (data.link) tg.openInvoice(data.link, (status) => {
            if (status === 'paid') checkAccess();
        });
    })
    .catch((err) => {
        tg.showAlert(err.message || 'Ошибка создания счета');
    });
}

// Старт
checkAccess();