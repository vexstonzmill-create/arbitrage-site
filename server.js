const express = require('express');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

// Раздаем статические файлы
app.use(express.static(__dirname));

// Кэш для защиты от лимитов (20 секунд)
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 20000; 

// Настройка прокси (добавьте переменную PROXY_URL в настройках Render)
const proxyAgent = process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : null;

app.get('/api/p2p', async (req, res) => {
    const amount = req.query.amount || 50000;

    // Если данные в кэше свежие - отдаем их
    if (Date.now() - cache.timestamp < CACHE_TTL && cache.data) {
        return res.json(filterData(cache.data, amount));
    }

    try {
        const url = 'https://api2.bybit.com/fiat/otc/item/online';
        
        const payload = {
            userId: "",
            tokenId: "USDT",
            currencyId: "RUB",
            payment: [],
            side: "1", // 1 = Купить USDT (вы платите рубли), 0 = Продать
            size: "10",
            page: "1",
            amount: amount.toString(),
            authMaker: false,
            canTrade: true
        };

        const config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'Origin': 'https://www.bybit.com',
                'Referer': 'https://www.bybit.com/'
            },
            timeout: 10000
        };

        // Если прокси настроен, применяем его
        if (proxyAgent) {
            config.httpsAgent = proxyAgent;
        } else {
            console.warn('ВНИМАНИЕ: PROXY_URL не задан. Bybit скорее всего заблокирует запрос (ошибка 403).');
        }

        console.log(`Запрос к Bybit на сумму: ${amount} RUB...`);
        const response = await axios.post(url, payload, config);

        // Проверка на ошибки в ответе API
        if (response.data && response.data.ret_code !== 0) {
            console.error('Bybit вернул ошибку:', response.data.ret_msg);
            throw new Error(`Bybit API Error: ${response.data.ret_msg}`);
        }

        if (response.data && response.data.result && response.data.result.items) {
            const items = response.data.result.items;
            console.log(`Успех! Получено объявлений: ${items.length}`);
            cache = { data: items, timestamp: Date.now() };
            res.json(filterData(items, amount));
        } else {
            console.error('Неверный формат ответа:', JSON.stringify(response.data));
            throw new Error('Неверный формат ответа от Bybit');
        }

    } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА ПАРСИНГА:', error.message);
        res.status(500).json({ error: 'Ошибка API Bybit' });
    }
});

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
        methods: Array.isArray(item.payments) 
                 ? item.payments.map(p => p.paymentName || p).join(', ') 
                 : 'Не указаны',
        tradeUrl: `https://www.bybit.com/p2p/trade/${item.id}`
    }));
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});