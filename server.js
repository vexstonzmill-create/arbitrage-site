const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ccxt = require('ccxt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const EXCHANGES = ['binance', 'bybit', 'okx', 'mexc'];
const FEE_PCT = 0.2; // 0.1% + 0.1% = 0.2% total fee

let spotPrices = {};

// --- 1. Init Spot WebSockets (CCXT) ---
async function initSpot() {
    for (const exName of EXCHANGES) {
        try {
            const exchange = new ccxt.pro[exName]();
            
            for (const symbol of PAIRS) {
                (async () => {
                    while (true) {
                        try {
                            const orderbook = await exchange.watchOrderBook(symbol);
                            const bestBid = orderbook.bids[0][0];
                            const bestAsk = orderbook.asks[0][0];

                            if (!spotPrices[symbol]) spotPrices[symbol] = {};
                            spotPrices[symbol][exName] = { bid: bestBid, ask: bestAsk };
                        } catch (e) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }
                })();
            }
            console.log(exName + ' connected');
        } catch (e) {
            console.log(exName + ' init error: ' + e.message);
        }
    }
}

// --- 2. Fetch Binance P2P ---
async function fetchBinanceP2P(fiat, tradeType) {
    try {
        const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page: 1, rows: 5, payTypes: [], countries: [],
                publisherType: null, asset: 'USDT', fiat: fiat, tradeType: tradeType
            })
        });
        const json = await res.json();
        if (json.data && json.data.length > 0) {
            return parseFloat(json.data[0].adv.price);
        }
        return null;
    } catch (e) { return null; }
}

// --- 3. Fetch Fiat Cross Rate ---
async function fetchFiatRate(base, quote) {
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=' + base + '&to=' + quote);
        const data = await res.json();
        return data.rates[quote] || null;
    } catch (e) { return null; }
}

// --- 4. Scan P2P ---
async function scanP2P() {
    const countries = [
        { fiat: 'MDL', label: 'Moldova' },
        { fiat: 'CAD', label: 'Canada' },
        { fiat: 'RUB', label: 'Russia' },
        { fiat: 'TRY', label: 'Turkey' }
    ];

    const usdtPrices = {};
    for (const c of countries) {
        usdtPrices[c.fiat] = await fetchBinanceP2P(c.fiat, 'BUY');
    }

    let bestP2P = null;

    for (let i = 0; i < countries.length; i++) {
        for (let j = 0; j < countries.length; j++) {
            if (i === j) continue;
            const cBuy = countries[i];
            const cSell = countries[j];
            const priceBuy = usdtPrices[cBuy.fiat];
            const priceSell = usdtPrices[cSell.fiat];

            if (!priceBuy || !priceSell) continue;

            let fiatRate = 1;
            if (cBuy.fiat !== cSell.fiat) {
                fiatRate = await fetchFiatRate(cBuy.fiat, cSell.fiat);
            }
            if (!fiatRate) continue;

            // Cost of 1 USDT in Sell Country's fiat
            const costInSellFiat = priceBuy * fiatRate;
            const profitPct = ((priceSell - costInSellFiat) / costInSellFiat) * 100 - FEE_PCT;

            if (!bestP2P || profitPct > bestP2P.profit) {
                bestP2P = {
                    type: 'P2P', pair: 'USDT',
                    buyEx: cBuy.label + ' (' + cBuy.fiat + ')', 
                    sellEx: cSell.label + ' (' + cSell.fiat + ')',
                    buyPrice: priceBuy, sellPrice: priceSell, profit: profitPct
                };
            }
        }
    }

    if (bestP2P && bestP2P.profit > 0) {
        io.emit('arbitrageData', [bestP2P]);
    }
}

// --- 5. Scan Spot ---
function scanSpot() {
    let bestSpot = null;

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

                if (!bestSpot || profitPct > bestSpot.profit) {
                    bestSpot = {
                        type: 'SPOT', pair: symbol, 
                        buyEx: exBuy, sellEx: exSell,
                        buyPrice: buyPrice, sellPrice: sellPrice, profit: profitPct
                    };
                }
            }
        }
    }

    if (bestSpot && bestSpot.profit > 0.1) {
        io.emit('arbitrageData', [bestSpot]);
    }
}

setInterval(scanSpot, 1000);
setInterval(scanP2P, 30000);

initSpot();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));