const API_URL = 'https://vxomanual.onrender.com'; 

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const initData = tg.initData;

const appDiv = document.getElementById('app');

// 1. Проверяем, открыто ли приложение внутри Telegram
if (!initData) {
    appDiv.innerHTML = `
        <div class="state-screen">
            <div class="error-card">
                <div class="card-icon">✈️</div>
                <h2>Откройте в Telegram</h2>
                <p>Это приложение работает только внутри Telegram.</p>
            </div>
            <a href="https://t.me/ТВОЙ_БОТ" style="display:block; width:100%; padding:16px; background:#22d3ee; color:#000; border-radius:14px; text-decoration:none; font-weight:600; box-sizing:border-box;">Открыть в Telegram</a>
        </div>
    `;
    throw new Error('Приложение открыто вне Telegram');
}

// Рендер шапки (как в iOS Library)
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
    // Красивый экран загрузки
    appDiv.innerHTML = `
        <div class="state-screen">
            <div class="spinner"></div>
            <div class="state-text">Синхронизация...</div>
        </div>
    `;
    
    fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(async res => {
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
        // Красивый экран ошибки
        appDiv.innerHTML = `
            <div class="state-screen">
                <div class="error-card">
                    <div class="card-icon">⚠️</div>
                    <h2>Ошибка подключения</h2>
                    <p>Не удалось получить данные от сервера.</p>
                    <div class="error-details">${err.message}</div>
                </div>
                <button class="btn btn-outline" onclick="checkAccess()">Попробовать снова</button>
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
        renderPage(`
            <div class="error-card" style="margin-top: 20px;">
                <div class="card-icon">⚠️</div>
                <h2>Ошибка контента</h2>
                <div class="error-details">${err.message}</div>
            </div>
            <button class="btn btn-outline" onclick="loadContent()">Обновить</button>
        `);
    });
}

// Кнопки
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