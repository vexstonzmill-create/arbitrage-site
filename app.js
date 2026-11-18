const API_URL = 'https://vxomanual.onrender.com'; // Ссылка на твой Render

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Разворачиваем на весь экран
const initData = tg.initData;

const appDiv = document.getElementById('app');

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

// 1. Проверка доступа
function checkAccess() {
    fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(res => {
        if (!res.ok) throw new Error('Network error');
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
    .catch(() => {
        appDiv.innerHTML = `<div class="error">Ошибка подключения. Проверьте интернет.</div>`;
    });
}

// 2. Загрузка контента
function loadContent() {
    fetch(`${API_URL}/api/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(res => {
        if (!res.ok) throw new Error('Access denied');
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
    .catch(() => {
        renderPage(`<div class="error">Ошибка загрузки контента</div>`);
    });
}

// Кнопки
function subscribe() {
    tg.openTelegramLink('https://t.me/vxo_767'); // Замени на ссылку канала
}

function pay() {
    tg.showPopup({
        title: 'Оплата',
        message: 'Переход к оплате...',
        buttons: [{type: 'close'}]
    });
    
    fetch(`${API_URL}/api/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(res => res.json())
    .then(data => {
        if (data.link) tg.openInvoice(data.link, (status) => {
            if (status === 'paid') checkAccess(); // Обновляем экран после оплаты
        });
    })
    .catch(() => tg.showAlert('Ошибка создания счета'));
}

// Старт
checkAccess();