const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Отдаем index.html из корневой папки
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- НАСТРОЙКИ ---
const FEE_BINANCE = 0.1; // 0.1%
const FEE_BYBIT = 0.1;   // 0.1%

const PAIRS = [
    { binance: 'btcusdt', bybit: 'BTCUSDT', name: 'BTC/USDT' },
    { binance: 'ethusdt', bybit: 'ETHUSDT', name: 'ETH/USDT' },
    { binance: 'solusdt', bybit: 'SOLUSDT', name: 'SOL/USDT' }
];

let prices = {};
PAIRS.forEach(p => {
    prices[p.name] = {
        binance: { bid: 0, ask: 0 },
        bybit: { bid: 0, ask: 0 }
    };
});

// --- 1. Binance WebSocket ---
function connectBinance() {
    const streams = PAIRS.map(p => `${p.binance}@bookTicker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.on('open', () => console.log('🟢 Подключено к Binance'));
    ws.on('message', (data) => {
        const msg = JSON.parse(data).data;
        if (!msg || !msg.s) return;
        
        const symbol = msg.s.replace('USDT', '/USDT');
        if (prices[symbol]) {
            prices[symbol].binance.bid = parseFloat(msg.b);
            prices[symbol].binance.ask = parseFloat(msg.a);
        }
    });
    ws.on('close', () => { 
        console.log('🔴 Binance отключен. Реконнект...'); 
        setTimeout(connectBinance, 3000); 
    });
    ws.on('error', (err) => console.log('Ошибка Binance:', err.message));
}

// --- 2. Bybit WebSocket ---
function connectBybit() {
    const ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');

    ws.on('open', () => {
        console.log('🟢 Подключено к Bybit');
        const args = PAIRS.map(p => `orderbook.1.${p.bybit}`);
        ws.send(JSON.stringify({ op: "subscribe", args: args }));
    });
    
    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        
        if (msg.op === 'ping') {
            ws.send(JSON.stringify({ op: 'pong' }));
            return;
        }

        if (msg.data && msg.topic && msg.data.b && msg.data.a) {
            const symbol = msg.data.s.replace('USDT', '/USDT');
            if (prices[symbol]) {
                prices[symbol].bybit.bid = parseFloat(msg.data.b[0][0]);
                prices[symbol].bybit.ask = parseFloat(msg.data.a[0][0]);
            }
        }
    });
    ws.on('close', () => { 
        console.log('🔴 Bybit отключен. Реконнект...'); 
        setTimeout(connectBybit, 3000); 
    });
    ws.on('error', (err) => console.log('Ошибка Bybit:', err.message));
}

// --- 3. Расчет арбитража ---
setInterval(() => {
    let results = [];
    
    for (const pair of PAIRS) {
        const p = prices[pair.name];
        if (!p.binance.bid || !p.bybit.bid) continue;

        // Купить на Binance -> Продать на Bybit
        const buy1 = p.binance.ask;
        const sell1 = p.bybit.bid;
        const net1 = ((sell1 - buy1) / buy1) * 100 - FEE_BINANCE - FEE_BYBIT;

        // Купить на Bybit -> Продать на Binance
        const buy2 = p.bybit.ask;
        const sell2 = p.binance.bid;
        const net2 = ((sell2 - buy2) / buy2) * 100 - FEE_BINANCE - FEE_BYBIT;

        if (net1 > net2) {
            results.push({
                pair: pair.name, direction: 'BINANCE ➔ BYBIT',
                buyEx: 'Binance', sellEx: 'Bybit',
                buyPrice: buy1, sellPrice: sell1, profit: net1
            });
        } else {
            results.push({
                pair: pair.name, direction: 'BYBIT ➔ BINANCE',
                buyEx: 'Bybit', sellEx: 'Binance',
                buyPrice: buy2, sellPrice: sell2, profit: net2
            });
        }
    }

    if (results.length > 0) {
        io.emit('arbitrageData', results);
    }
}, 1000);

// Запуск
connectBinance();
connectBybit();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер работает на порту ${PORT}`);
});       }
    }

    // Отправляем данные на фронтенд каждую секунду
    if (results.length > 0) {
        io.emit('arbitrageData', results);
    }
}, 1000);

// Запуск
connectBinance();
connectBybit();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер работает на порту ${PORT}`);
});