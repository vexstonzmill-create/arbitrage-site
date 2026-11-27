const API_URL = '/api/p2p';
const TARGET_AMOUNT = 50000; // Сумма в рублях, которую ищем
const REFRESH_INTERVAL = 20000; // 20 секунд
let countdownValue = 20;
let countdownInterval;

async function fetchData() {
    const btn = document.getElementById('refreshBtn');
    const text = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    const results = document.getElementById('results');
    const timerText = document.getElementById('timerText');
    const countdownEl = document.getElementById('countdown');

    // UI загрузки
    btn.disabled = true;
    text.style.display = 'none';
    spinner.style.display = 'block';
    timerText.style.opacity = '0';
    
    // Сброс таймера
    clearInterval(countdownInterval);
    countdownValue = 20;
    countdownEl.innerText = countdownValue;

    try {
        const res = await fetch(`${API_URL}?amount=${TARGET_AMOUNT}`);
        
        // Если сервер вернул ошибку (например, 500 из-за бана Bybit)
        if (!res.ok) {
            throw new Error(`Ошибка сервера: ${res.status}`);
        }

        const data = await res.json();
        results.innerHTML = ''; 

        if (data.length === 0) {
            results.innerHTML = '<p style="text-align:center;color:#ffaa00;margin-top:20px;font-size:14px;">Объявлений не найдено.<br>Возможно, изменились лимиты или Bybit заблокировал IP.</p>';
        }

        data.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            // Каскадная анимация появления
            card.style.animationDelay = `${index * 0.1}s`; 
            
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="price">${item.price} RUB</div>
                        <div class="limits">Лимиты: ${item.minLimit} - ${item.maxLimit} RUB</div>
                    </div>
                    <span class="nickname">${item.nickname}</span>
                </div>
                <div class="methods">
                    ${item.methods}
                </div>
                <a href="${item.tradeUrl}" target="_blank" class="btn-buy">Перейти к сделке</a>
            `;
            results.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        results.innerHTML = '<p style="color:#ff5555;text-align:center;margin-top:20px;font-size:14px;">Ошибка получения данных.<br>Bybit блокирует запросы с Render. Нужен прокси (PROXY_URL).</p>';
    } finally {
        // Возвращаем UI в исходное состояние
        btn.disabled = false;
        text.style.display = 'block';
        spinner.style.display = 'none';
        timerText.style.opacity = '1'; 
        
        startCountdown();
    }
}

function startCountdown() {
    const countdownEl = document.getElementById('countdown');
    clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue >= 0) {
            countdownEl.innerText = countdownValue;
        }
    }, 1000);
}

// Запуск автообновления
setInterval(fetchData, REFRESH_INTERVAL);

// Первичный запуск при открытии страницы
fetchData();