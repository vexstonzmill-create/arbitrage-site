const express = require('express');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// Кэш для защиты от лимитов (20 секунд)
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 20000; 

// Настройка прокси (добавьте переменную PROXY_URL в настройках Render)
const proxyAgent = process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : null;

app.get('/api/p2p', async (req, res) => {
    const amount = req.query.amount || 50000;

    if (Date.now() - cache.timestamp < CACHE_TTL && cache.data) {
        return res.json(filterData(cache.data, amount));
    }

    try {
        // Реальный эндпоинт Bybit P2P
        const url = 'https://api2.bybit.com/fiat/otc/item/online';
        
        // Тело запроса (параметры подобраны под USDT/RUB, покупка)
        const payload = {
            userId: "",
            tokenId: "USDT",
            currencyId: "RUB",
            payment: [], // Пустой массив означает "любой способ оплаты"
            side: "1",   // 1 = Покупка (вы покупаете USDT), 0 = Продажа
            size: "10",  // Количество объявлений
            page: "1",
            amount: amount.toString(),
            authMaker: false,
            canTrade: true
        };

        const config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Content-Type': 'application/json',
                'Origin': 'https://www.bybit.com',
                'Referer': 'https://www.bybit.com/'
            },
            timeout: 10000 // Таймаут 10 секунд
        };

        if (proxyAgent) {
            config.httpsAgent = proxyAgent;
        }

        const response = await axios.post(url, payload, config);

        if (response.data && response.data.result && response.data.result.items) {
            const items = response.data.result.items;
            cache = { data: items, timestamp: Date.now() };
            res.json(filterData(items, amount));
        } else {
            throw new Error('Неверный формат ответа от Bybit');
        }

    } catch (error) {
        console.error('Ошибка парсинга Bybit:', error.message);
        res.status(500).json({ error: 'Не удалось получить данные. Возможно, требуется прокси.' });
    }
});

// Функция фильтрации (осталась без изменений)
function filterData(items, amount) {
    if (!items) return [];
    return items.filter(item => {
        const min = parseFloat(item.minAmount);
        const max = parseFloat(item.maxAmount);
        return amount >= min && amount <= max;
    }).map(item => ({
        id: item.id,
        nickname: item.nickName,
        price: item.price,
        minLimit: item.minAmount,
        maxLimit: item.maxAmount,
        // В реальном ответе Bybit payments - это массив ID. 
        // Для простоты выводим как есть, либо нужно будет маппить ID на названия.
        methods: Array.isArray(item.payments) ? item.payments.join(', ') : item.payments,
        tradeUrl: `https://www.bybit.com/p2p/trade/${item.id}`
    }));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});