// Моковые данные для теста (потом сюда можно вставить реальные)
const MOCK_MODULES = [
    {
        category: 'P2P Basics',
        title: 'Введение в P2P',
        content: 'Основы работы с P2P арбитражем. Как искать объявления и безопасно проводить сделки.'
    },
    {
        category: 'Security',
        title: 'Безопасность аккаунтов',
        content: 'Как не потерять средства. Настройка 2FA, антидетект-браузеры и защита от скама.'
    },
    {
        category: 'Strategy',
        title: 'Стратегии 2024',
        content: 'Актуальные связки, работа с банками и методы обхода лимитов.'
    },
    {
        category: 'Guides',
        title: 'Гайд по Binance',
        content: 'Пошаговая инструкция по верификации и работе с P2P на крупнейшей бирже.'
    }
];

const appDiv = document.getElementById('app');

// Безопасная инициализация Telegram (если открыто в браузере — не упадет)
let tg = null;
let user = { first_name: 'U', photo_url: null };

if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    if (tg.initDataUnsafe?.user) {
        user = tg.initDataUnsafe.user;
    }
}

// Рендер шапки (как в iOS Library)
function renderHeader() {
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

// Главная функция запуска
function initApp() {
    // Показываем красивый спиннер
    appDiv.innerHTML = `
        <div class="state-screen">
            <div class="spinner"></div>
            <div class="state-text">Загрузка библиотеки...</div>
        </div>
    `;

    // Имитация загрузки (чтобы ты увидел спиннер)
    setTimeout(() => {
        try {
            // Вместо запроса к серверу просто берем моковые данные
            renderContent(MOCK_MODULES);
        } catch (err) {
            showError(err.message);
        }
    }, 800); 
}

// Отрисовка контента
function renderContent(modules) {
    let html = `<h2 class="section-title">Your Modules</h2>`;
    
    if (!modules || modules.length === 0) {
        html += `<p class="text-gray">Пока нет материалов.</p>`;
    } else {
        modules.forEach(mod => {
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
    
    // Имитируем, что доступ открыт
    renderPage(`
        <div style="margin-bottom: 15px; display:flex; justify-content:flex-end;">
            <span class="status-pill" style="color:#4ade80; border-color:#4ade80; background:rgba(74,222,128,0.1);">ДОСТУП ОТКРЫТ</span>
        </div>
        ${html}
    `);
}

// Показ ошибки (в едином стиле)
function showError(message) {
    appDiv.innerHTML = `
        <div class="state-screen">
            <div class="error-card">
                <div class="card-icon">⚠️</div>
                <h2>Упс...</h2>
                <p>Не удалось загрузить данные.</p>
                <div class="error-details">${message}</div>
            </div>
            <button class="btn btn-outline" onclick="initApp()">Попробовать снова</button>
        </div>
    `;
}

// Запуск приложения
initApp();aders: { 'Content-Type': 'application/json' },
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