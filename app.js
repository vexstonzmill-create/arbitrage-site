// ⚠️ ВСТАВЬ ССЫЛКУ НА СВОЙ БЭКЕНД НА RENDER (или оставь localhost для теста)
const API_URL = https://vxomanual.onrender.com; // Если фронт и бэк на одном сервере, можно так

const tg = window.Telegram.WebApp;
tg.ready();
const initData = tg.initData;

const appDiv = document.getElementById('app');

// Функция для отрисовки шапки и контента
function renderPage(contentHTML) {
    appDiv.innerHTML = `
        <div class="header">
            <h1 class="title">vxo | 767</h1>
            <div class="subtitle">P2P Knowledge Base</div>
        </div>
        ${contentHTML}
    `;
}

// 1. Проверка доступа
fetch(`${API_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
})
.then(res => res.json())
.then(data => {
    if (!data.subscribed) {
        // Экран подписки
        renderPage(`
            <div class="card text-center">
                <h2 class="text-cyan" style="margin-top:0;">Шаг 1: Подписка</h2>
                <p class="text-gray">Для доступа к базе знаний необходимо подписаться на наш канал.</p>
                <button class="btn" onclick="subscribe()">Подписаться</button>
            </div>
        `);
    } else if (!data.paid) {
        // Экран оплаты
        renderPage(`
            <div class="card card-pink text-center">
                <h2 class="text-pink" style="margin-top:0;">Шаг 2: Доступ</h2>
                <p class="text-gray">Подписка есть! Осталось приобрести пожизненный доступ к материалам.</p>
                <div style="font-size: 32px; font-weight: bold; margin: 20px 0;">30 $</div>
                <button class="btn btn-pink" onclick="pay()">Купить доступ</button>
            </div>
        `);
    } else {
        // Успешный вход - загрузка контента
        loadContent();
    }
})
.catch(() => {
    appDiv.innerHTML = `<div class="error">Ошибка подключения к серверу.</div>`;
});

// 2. Загрузка контента (если оплачено)
function loadContent() {
    fetch(`${API_URL}/api/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    })
    .then(res => res.json())
    .then(data => {
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 class="text-cyan" style="margin:0; font-size:18px;">База знаний</h2>
                <span class="success-badge">ДОСТУП ОТКРЫТ</span>
            </div>
        `;
        
        data.modules.forEach(mod => {
            html += `
                <div class="card">
                    <div class="category">${mod.category}</div>
                    <div class="mod-title">${mod.title}</div>
                    <div class="mod-content">${mod.content}</div>
                </div>
            `;
        });
        renderPage(html);
    });
}

// 3. Кнопка подписки
function subscribe() {
    tg.openTelegramLink('https://t.me/vxo_767'); // Замени на ссылку своего канала
    setTimeout(() => window.location.reload(), 3000);
}

// 4. Кнопка оплаты (Заглушка)
function pay() {
    tg.showAlert("Здесь будет подключена оплата (30$)");
    // Пример: Отправка запроса на бэкенд для создания счета
}