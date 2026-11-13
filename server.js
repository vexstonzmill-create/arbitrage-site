const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ccxt = require('ccxt');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const JWT_SECRET = "super_secret_crypto_key_123";

const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_xN9OFsw6uCMe@ep-solitary-cloud-bahn17dh-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL, tier VARCHAR(50) DEFAULT 'free',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const hashedPass = await bcrypt.hash("123456", 8);
        await pool.query(`
            INSERT INTO users (email, password, tier) VALUES ('test@test.com', $1, 'premium') 
            ON CONFLICT (email) DO NOTHING;
        `, [hashedPass]);
    } catch (err) { console.error('DB Init Error:', err.message); }
}
initDB();

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) return res.status(400).json({ error: "Email exists" });
        const hashedPassword = await bcrypt.hash(password, 8);
        await pool.query('INSERT INTO users (email, password, tier) VALUES ($1, $2, $3)', [email, hashedPassword, 'free']);
        res.json({ message: "Registered" });
    } catch (err) { res.status(500).json({ error: "DB error" }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Not found" });
        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Invalid" });
        const token = jwt.sign({ email: user.email, tier: user.tier }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true }).json({ success: true, tier: user.tier });
    } catch (err) { res.status(500).json({ error: "DB error" }); }
});

app.get('/api/me', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ loggedIn: false });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ loggedIn: true, email: decoded.email, tier: decoded.tier });
    } catch (e) { res.json({ loggedIn: false }); }
});

app.post('/api/logout', (req, res) => res.clearCookie('token').json({ success: true }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- SCANNER LOGIC (DEEP ORDERBOOK) ---
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'];
const EXCHANGES = ['binance', 'bybit', 'okx', 'mexc'];
const FEE_PCT = 0.2; 

let spotPrices = {};
let allSpotOpportunities = [];
let allP2POpportunities = [];
let opportunityTimestamps = {}; // Отслеживаем время жизни связки

async function initSpot() {
    for (const exName of EXCHANGES) {
        try {
            const exchange = new ccxt.pro[exName]();
            for (const symbol of PAIRS) {
                (async () => {
                    while (true) {
                        try {
                            const orderbook = await exchange.watchOrderBook(symbol);
                            if (!spotPrices[symbol]) spotPrices[symbol] = {};
                            
                            // Берем топ-5 уровней стакана для расчета реального объема
                            const topBids = orderbook.bids.slice(0, 5);
                            const topAsks = orderbook.asks.slice(0, 5);
                            
                            spotPrices[symbol][exName] = { 
                                bid: topBids[0][0], ask: topAsks[0][0],
                                bidVolume: topBids.reduce((sum, b) => sum + (b[0] * b[1]), 0), // Объем в USDT
                                askVolume: topAsks.reduce((sum, a) => sum + (a[0] * a[1]), 0),
                                bidsCount: orderbook.bids.length,
                                asksCount: orderbook.asks.length
                            };
                        } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
                    }
                })();
            }
        } catch (e) { console.log(exName + ' error'); }
    }
}

function scanSpot() {
    let results = [];
    const now = Date.now();

    for (const symbol of PAIRS) {
        const prices = spotPrices[symbol];
        if (!prices) continue;
        const exchanges = Object.keys(prices);

        for (let i = 0; i < exchanges.length; i++) {
            for (let j = 0; j < exchanges.length; j++) {
                if (i === j) continue;
                const exBuy = exchanges[i];
                const exSell = exchanges[j];

                const buyPrice = prices[exBuy].ask;
                const sellPrice = prices[exSell].bid;
                const profitPct = ((sellPrice - buyPrice) / buyPrice) * 100 - FEE_PCT;

                if (profitPct > 0.05) {
                    // Считаем реальный объем сделки (лимитируется меньшим из стаканов)
                    const maxTradeUsdt = Math.min(prices[exBuy].askVolume, prices[exSell].bidVolume);
                    const profitUsd = maxTradeUsdt * (profitPct / 100);

                    const oppId = `${symbol}-${exBuy}-${exSell}`;
                    
                    // Фиксируем время появления связки
                    if (!opportunityTimestamps[oppId]) {
                        opportunityTimestamps[oppId] = now;
                    }
                    const aliveTimeSeconds = Math.floor((now - opportunityTimestamps[oppId]) / 1000);

                    results.push({
                        id: oppId, type: 'SPOT', pair: symbol, 
                        buyEx: exBuy.toUpperCase(), sellEx: exSell.toUpperCase(),
                        buyPrice: buyPrice, sellPrice: sellPrice, 
                        profitPct: profitPct, profitUsd: profitUsd,
                        liquidityUsdt: maxTradeUsdt, 
                        depth: `${prices[exBuy].asksCount} orders`,
                        aliveTime: aliveTimeSeconds,
                        url: exBuy === 'binance' ? `https://www.binance.com/en/trade/${symbol.split('/')[0]}_USDT?type=spot` : 
                             exBuy === 'bybit' ? `https://www.bybit.com/en/trade/spot/${symbol.split('/')[0]}/USDT` : 
                             exBuy === 'okx' ? `https://www.okx.com/trade-spot/${symbol.split('/')[0].toLowerCase()}-usdt` : 
                             `https://www.mexc.com/exchange/${symbol.split('/')[0]}_USDT`
                    });
                }
            }
        }
    }
    
    // Очищаем старые ID, которых больше нет
    const activeIds = results.map(r => r.id);
    Object.keys(opportunityTimestamps).forEach(id => {
        if (!activeIds.includes(id)) delete opportunityTimestamps[id];
    });

    allSpotOpportunities = results.sort((a, b) => b.profitPct - a.profitPct);
}

// P2P Логика (без изменений)
async function fetchBinanceP2P(fiat) {
    try {
        const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: 1, rows: 1, payTypes: [], countries: [], publisherType: null, asset: 'USDT', fiat: fiat, tradeType: 'BUY' })
        });
        const json = await res.json();
        return json.data?.length > 0 ? parseFloat(json.data[0].adv.price) : null;
    } catch (e) { return null; }
}
async function fetchFiatRate(base, quote) {
    try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`);
        const data = await res.json();
        return data.rates[quote] || null;
    } catch (e) { return null; }
}
async function scanP2P() {
    const countries = [{ fiat: 'MDL', label: 'Moldova' }, { fiat: 'CAD', label: 'Canada' }, { fiat: 'RUB', label: 'Russia' }];
    const usdtPrices = {};
    for (const c of countries) usdtPrices[c.fiat] = await fetchBinanceP2P(c.fiat);

    let results = [];
    for (let i = 0; i < countries.length; i++) {
        for (let j = 0; j < countries.length; j++) {
            if (i === j) continue;
            const cBuy = countries[i], cSell = countries[j];
            if (!usdtPrices[cBuy.fiat] || !usdtPrices[cSell.fiat]) continue;
            let fiatRate = cBuy.fiat === cSell.fiat ? 1 : await fetchFiatRate(cBuy.fiat, cSell.fiat);
            if (!fiatRate) continue;
            const costInSellFiat = usdtPrices[cBuy.fiat] * fiatRate;
            const profitPct = ((usdtPrices[cSell.fiat] - costInSellFiat) / costInSellFiat) * 100 - FEE_PCT;
            if (profitPct > 0.5) {
                results.push({
                    id: `P2P-${cBuy.fiat}-${cSell.fiat}`, type: 'P2P', pair: 'USDT', 
                    buyEx: cBuy.label, sellEx: cSell.label, buyPrice: usdtPrices[cBuy.fiat], sellPrice: usdtPrices[cSell.fiat], 
                    profitPct: profitPct, profitUsd: 0, liquidityUsdt: 0, depth: 'P2P Ads', aliveTime: 0, url: 'https://p2p.binance.com/en/trade/buy/USDT'
                });
            }
        }
    }
    allP2POpportunities = results.sort((a, b) => b.profitPct - a.profitPct);
}

// --- SOCKET ---
io.on('connection', (socket) => {
    let userTier = 'free';
    const cookies = socket.handshake.headers.cookie;
    if (cookies && cookies.includes('token=')) {
        try {
            const token = cookies.split('token=')[1].split(';')[0];
            const decoded = jwt.verify(token, JWT_SECRET);
            userTier = decoded.tier;
        } catch (e) {}
    }

    const interval = setInterval(() => {
        const allOpps = [...allSpotOpportunities, ...allP2POpportunities].sort((a, b) => b.profitPct - a.profitPct);
        let payload = [];

        if (userTier === 'free') {
            payload = allOpps.filter(o => o.profitPct <= 3.0).slice(0, 4);
        } else if (userTier === 'standard') {
            payload = allOpps.filter(o => o.profitPct <= 7.0).slice(0, 15);
        } else if (userTier === 'premium') {
            payload = allOpps.slice(0, 20);
        }

        socket.emit('data', { tier: userTier, opportunities: payload });
    }, 1000);

    socket.on('disconnect', () => clearInterval(interval));
});

setInterval(scanSpot, 1000);
setInterval(scanP2P, 30000);
initSpot();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));