require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_vexo_key_that_is_long_enough_12345';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8859024431:AAF9vvyC0AGHJNZfjhQ989yryflRMtXYvoQ'; 
const APP_URL = process.env.APP_URL || 'https://vexo-p2p.onrender.com'; 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_UDtaHhd5Zr6s@ep-divine-sun-bawvlsl5-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, display_name VARCHAR(50), email VARCHAR(100) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'user', kyc_status VARCHAR(20) DEFAULT 'none', avatar_url TEXT, favorites INT[] DEFAULT '{}', volume_usd NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS ads (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), side VARCHAR(10), face_type VARCHAR(20), asset VARCHAR(20), price NUMERIC, amount_total NUMERIC, amount_left NUMERIC, min_rub NUMERIC, max_rub NUMERIC, payment_methods TEXT[], terms TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, public_id VARCHAR(20) UNIQUE, ad_id INT REFERENCES ads(id), buyer_id INT REFERENCES users(id), seller_id INT REFERENCES users(id), asset VARCHAR(20), price NUMERIC, amount_rub NUMERIC, amount_asset NUMERIC, face_type VARCHAR(20), payment_method VARCHAR(50), status VARCHAR(20) DEFAULT 'pending', history JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP, receipt_data TEXT);
      CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, order_id INT REFERENCES orders(id), sender_id INT REFERENCES users(id), text TEXT, media_data TEXT, media_type VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, order_id INT REFERENCES orders(id), author_id INT REFERENCES users(id), target_id INT REFERENCES users(id), rating INT, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS requests (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), type VARCHAR(50), amount NUMERIC, currency VARCHAR(10), status VARCHAR(20) DEFAULT 'pending', details JSONB, admin_comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    
    await pool.query(`ALTER TABLE ads ADD COLUMN IF NOT EXISTS payment_time INT DEFAULT 30;`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_time INT DEFAULT 30;`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_data TEXT;`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_data TEXT;`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_rub NUMERIC DEFAULT 0;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_usdt NUMERIC DEFAULT 0;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_merchant BOOLEAN DEFAULT false;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_maker BOOLEAN DEFAULT false;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;`);
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS admin_comment TEXT;`);
    
    console.log('✓ Database tables initialized');
  } catch (err) {
    console.error('❌ DB Init Error:', err);
  }
}
initDB();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function sendTG(tgId, text, buttons = null) {
  if (!BOT_TOKEN || !tgId) return;
  try {
    const payload = { chat_id: tgId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (buttons) payload.reply_markup = { inline_keyboard: buttons };
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
  } catch (e) { console.error('TG Send Error:', e); }
}

async function notifyUser(userId, text, buttons = null) {
    try {
        const res = await pool.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
        if (res.rows[0] && res.rows[0].telegram_id) await sendTG(res.rows[0].telegram_id, text, buttons);
    } catch (e) { console.error('Notify error:', e); }
}

function formatOrderMsg(order, title) {
    return `
🔥 <b>${title}</b>

🆔 Ордер: <code>#${order.public_id}</code>
🪙 Актив: <b>${Number(order.amount_asset).toFixed(2)} ${order.asset}</b>
💵 Сумма: <b>${new Intl.NumberFormat('ru-RU').format(order.amount_rub)} ₽</b>
💳 Оплата: <b>${order.payment_method}</b>
📝 Тип: <b>${order.face_type === 'first' ? '1-е лицо' : '3-е лицо'}</b>
    `.trim();
}

function validateTelegramWebAppData(telegramInitData) {
  const urlParams = new URLSearchParams(telegramInitData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  urlParams.sort();
  let dataCheckString = '';
  for (const [key, value] of urlParams) dataCheckString += `${key}=${value}\n`;
  dataCheckString = dataCheckString.slice(0, -1);
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return calculatedHash === hash;
}

app.post('/api/telegram/webhook', async (req, res) => {
    try {
        if (req.body.message) {
            const msg = req.body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            if (text === '/start') {
                const replyMarkup = {
                    inline_keyboard: [
                        [{ text: "🚀 Открыть VEXO", web_app: { url: APP_URL } }],
                        [
                            { text: "📈 Маркет", web_app: { url: APP_URL + '/?screen=market' } },
                            { text: "👤 Профиль", web_app: { url: APP_URL + '/?screen=profile' } }
                        ],
                        [{ text: "💰 Кошелёк", web_app: { url: APP_URL + '/?screen=wallet' } }]
                    ]
                };
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        chat_id: chatId, 
                        text: "👋 <b>Добро пожаловать в VEXO P2P!</b>\n\nЗдесь вы можете безопасно обменивать криптовалюту на рубли.\nНажмите на кнопку ниже, чтобы открыть приложение:", 
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup 
                    })
                });
            }
            return res.sendStatus(200);
        }

        const { callback_query } = req.body;
        if (!callback_query) return res.sendStatus(200);

        const data = callback_query.data;
        const tgId = callback_query.from.id;
        const messageId = callback_query.message.message_id;
        const chatId = callback_query.message.chat.id;
        
        const [action, orderIdStr] = data.split(':');
        const orderId = parseInt(orderIdStr);

        const userRes = await pool.query('SELECT id, role FROM users WHERE telegram_id = $1', [tgId]);
        if (userRes.rows.length === 0) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callback_query.id, text: "Вы не авторизованы. Откройте приложение через /start", show_alert: true })
            });
            return res.sendStatus(200);
        }
        const userId = userRes.rows[0].id;

        const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        const o = orderRes.rows[0];
        if (!o) return res.sendStatus(200);

        const adRes = await pool.query('SELECT user_id FROM ads WHERE id = $1', [o.ad_id]);
        const adCreatorId = adRes.rows[0]?.user_id;

        let successText = "";
        let success = false;

        if (action === 'accept' && o.status === 'pending' && userId === adCreatorId) {
            await transition(o.id, 'accepted', 'Заявка принята');
            success = true; successText = "✅ Заявка принята!";
            const targetId = o.buyer_id === userId ? o.seller_id : o.buyer_id;
            const isRequesterBuyer = targetId === o.buyer_id;
            const btn = isRequesterBuyer ? [[{ text: "💸 Я оплатил", callback_data: `paid:${o.id}` }]] : [];
            notifyUser(targetId, formatOrderMsg({...o, counterparty_username: 'Контрагент'}, "✅ Заявка принята!"), btn);
        } 
        else if (action === 'decline' && o.status === 'pending' && userId === adCreatorId) {
            await transition(o.id, 'declined', 'Заявка отклонена');
            success = true; successText = "❌ Заявка отклонена!";
            const targetId = o.buyer_id === userId ? o.seller_id : o.buyer_id;
            notifyUser(targetId, formatOrderMsg({...o, counterparty_username: 'Контрагент'}, "❌ Заявка отклонена"));
        }
        else if (action === 'paid' && o.buyer_id === userId && o.status === 'accepted') {
            await transition(o.id, 'paid', 'Оплата отправлена');
            success = true; successText = "💰 Оплата отправлена!";
            const btn = [[{ text: "✅ Подтвердить получение", callback_data: `confirm:${o.id}` }], [{ text: "🛡 Открыть спор", callback_data: `dispute:${o.id}` }]];
            notifyUser(o.seller_id, formatOrderMsg({...o, counterparty_username: 'Покупатель'}, "💰 Покупатель нажал 'Оплатил'!"), btn);
        }
        else if (action === 'confirm' && o.seller_id === userId && o.status === 'paid') {
            await transition(o.id, 'completed', 'Завершён');
            const volumeToAdd = Number(o.amount_rub) / 90;
            await pool.query('UPDATE users SET volume_usd = volume_usd + $1 WHERE id = $2', [volumeToAdd, o.buyer_id]);
            await pool.query('UPDATE users SET volume_usd = volume_usd + $1 WHERE id = $2', [volumeToAdd, o.seller_id]);
            await pool.query('UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2', [o.amount_asset, o.buyer_id]);
            await pool.query('UPDATE users SET balance_rub = balance_rub + $1 WHERE id = $2', [o.amount_rub, o.seller_id]);
            success = true; successText = "🎉 Сделка завершена!";
            notifyUser(o.buyer_id, formatOrderMsg({...o, counterparty_username: 'Продавец'}, "🎉 Сделка завершена!"));
        }
        else if (action === 'dispute' && (o.buyer_id === userId || o.seller_id === userId) && ['accepted', 'paid'].includes(o.status)) {
            await transition(o.id, 'dispute', 'Открыт спор через TG');
            success = true; successText = "🛡 Спор открыт!";
            const targetId = o.buyer_id === userId ? o.seller_id : o.buyer_id;
            notifyUser(targetId, formatOrderMsg({...o, counterparty_username: 'Контрагент'}, "🛑 Открыт спор!"));
        }

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callback_query.id, text: success ? successText : "Действие недоступно", show_alert: !success })
        });

        if (success) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
            });
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: `✅ <i>Статус обновлен: ${successText}</i>`, parse_mode: 'HTML' })
            });
        }

        res.sendStatus(200);
    } catch (e) {
        console.error('Webhook error:', e);
        res.sendStatus(500);
    }
});

async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [p.sub]);
    const user = result.rows[0];
    if (!user || user.blocked) return res.status(401).json({ error: 'unauthorized' });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: 'unauthorized' }); }
}

function publicUser(u) {
  return { 
    id: u.id, username: u.username, displayName: u.display_name || u.username, 
    email: u.email, role: u.role, kycStatus: u.kyc_status, avatarUrl: u.avatar_url || '', 
    volumeUsd: Number(u.volume_usd), createdAt: u.created_at,
    balanceRub: Number(u.balance_rub || 0), balanceUsdt: Number(u.balance_usdt || 0),
    isPro: u.is_pro || false, isMerchant: u.is_merchant || false, isMaker: u.is_maker || false,
    telegramId: u.telegram_id
  };
}

async function getUserStats(userId) {
  const completedRes = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'completed' AND (buyer_id = $1 OR seller_id = $1)", [userId]);
  const cancelledRes = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'cancelled' AND (buyer_id = $1 OR seller_id = $1)", [userId]);
  const reviewsRes = await pool.query("SELECT rating FROM reviews WHERE target_id = $1", [userId]);
  const volumeRes = await pool.query("SELECT volume_usd FROM users WHERE id = $1", [userId]);
  const completed = parseInt(completedRes.rows[0].count);
  const cancelled = parseInt(cancelledRes.rows[0].count);
  const total = completed + cancelled;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const ratings = reviewsRes.rows.map(r => r.rating);
  const avg = ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 0;
  const volumeUsd = Number(volumeRes.rows[0]?.volume_usd || 0);
  
  return { dealsTotal: total, dealsCompleted: completed, successRate, reviewsCount: ratings.length, ratingAvg: avg, volumeUsd };
}

app.post('/api/auth/telegram', async (req, res) => {
  const { initData } = req.body;
  if (!initData || !validateTelegramWebAppData(initData)) return res.status(401).json({ error: 'invalid_telegram_data' });
  try {
    const urlParams = new URLSearchParams(initData);
    const tgUser = JSON.parse(urlParams.get('user'));
    let userRes = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [tgUser.id]);
    let user = userRes.rows[0];
    if (!user) {
      userRes = await pool.query('SELECT * FROM users WHERE username = $1', [tgUser.username || 'tg_' + tgUser.id]);
      user = userRes.rows[0];
      if (user) {
        await pool.query('UPDATE users SET telegram_id = $1 WHERE id = $2', [tgUser.id, user.id]);
        user.telegram_id = tgUser.id;
      } else {
        const dummyEmail = `tg_${tgUser.id}@vexo.local`;
        const dummyPass = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Telegram User';
        const newUserRes = await pool.query(
          'INSERT INTO users (username, display_name, email, password_hash, telegram_id, avatar_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [tgUser.username || 'tg_' + tgUser.id, displayName, dummyEmail, dummyPass, tgUser.id, tgUser.photo_url || null]
        );
        user = newUserRes.rows[0];
      }
    }
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(user) });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || username.length < 3) return res.status(400).json({ error: 'short_username' });
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'bad_email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'short_password' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email.toLowerCase()]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'user_exists' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (username, display_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *', [username, username, email.toLowerCase(), hash]);
    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [String(login).toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'invalid_credentials' });
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(user) });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.get('/api/users/me', auth, async (req, res) => {
  const stats = await getUserStats(req.user.id);
  res.json({ user: publicUser(req.user), stats });
});

app.get('/api/users/:id', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  const u = result.rows[0];
  if (!u) return res.status(404).json({ error: 'not_found' });
  const stats = await getUserStats(u.id);
  const isFavorite = req.user.favorites?.includes(u.id) || false;
  res.json({ user: publicUser(u), stats, isFavorite });
});

app.patch('/api/users/me', auth, async (req, res) => {
  const { email, displayName, avatarUrl, password, currentPassword } = req.body || {};
  try {
    if (email && email !== req.user.email) {
      const check = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), req.user.id]);
      if (check.rows.length > 0) return res.status(409).json({ error: 'email_taken' });
    }
    let newHash = req.user.password_hash;
    if (password) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, req.user.password_hash))) return res.status(400).json({ error: 'wrong_password' });
      newHash = await bcrypt.hash(password, 10);
    }
    const result = await pool.query('UPDATE users SET email = COALESCE($1, email), display_name = COALESCE($2, display_name), avatar_url = COALESCE($3, avatar_url), password_hash = $4 WHERE id = $5 RETURNING *', [email ? email.toLowerCase() : null, displayName, avatarUrl, newHash, req.user.id]);
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/users/apply', auth, async (req, res) => {
  const { type } = req.body; 
  try {
    const existing = await pool.query("SELECT * FROM requests WHERE user_id = $1 AND type = $2 AND status = 'pending'", [req.user.id, type + '_req']);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Заявка уже на рассмотрении' });
    await pool.query("INSERT INTO requests (user_id, type, status) VALUES ($1, $2, 'pending')", [req.user.id, type + '_req']);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/requests/finance', auth, async (req, res) => {
  const { type, amount, currency, requisites, tg_username, network, user_id, comment } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'bad_amount' });
  if (!requisites || !tg_username) return res.status(400).json({ error: 'Заполните все поля' });
  
  if (type === 'withdraw_usdt' && Number(req.user.balance_usdt) < Number(amount)) return res.status(400).json({ error: 'Недостаточно средств' });
  if (type === 'withdraw_rub' && Number(req.user.balance_rub) < Number(amount)) return res.status(400).json({ error: 'Недостаточно средств' });

  try {
    await pool.query("INSERT INTO requests (user_id, type, amount, currency, details, status, admin_comment) VALUES ($1, $2, $3, $4, $5, 'pending', $6)", 
      [req.user.id, type, amount, currency, JSON.stringify({ requisites, tg_username, network, user_id: req.user.id }), comment || null]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'db_error' }); }
});

app.get('/api/requests/my', auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
    res.json({ items: result.rows });
  } catch(e) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/users/:id/favorite', auth, async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'self_fav' });
  let favs = req.user.favorites || [];
  const idx = favs.indexOf(targetId);
  if (idx > -1) favs.splice(idx, 1); else favs.push(targetId);
  await pool.query('UPDATE users SET favorites = $1 WHERE id = $2', [favs, req.user.id]);
  res.json({ isFavorite: idx === -1 });
});

async function shapeAd(a) {
  const uRes = await pool.query('SELECT * FROM users WHERE id = $1', [a.user_id]);
  const u = uRes.rows[0];
  const stats = await getUserStats(a.user_id);
  const realMaxRub = Math.min(Number(a.max_rub), Number(a.amount_left) * Number(a.price));
  return { id: a.id, userId: a.user_id, username: u?.username || '?', displayName: u?.display_name || u?.username || '?', avatarUrl: u?.avatar_url || '', side: a.side, faceType: a.face_type, asset: a.asset, price: Number(a.price), amountTotal: Number(a.amount_total), amountLeft: Number(a.amount_left), totalRub: (Number(a.amount_left) * Number(a.price)).toFixed(2), minRub: Number(a.min_rub), maxRub: realMaxRub.toFixed(2), paymentMethods: a.payment_methods, terms: a.terms, active: a.active, paymentTime: Number(a.payment_time) || 30, createdAt: a.created_at, ...stats, isPro: u?.is_pro, isMerchant: u?.is_merchant, isMaker: u?.is_maker };
}

app.get('/api/ads', async (req, res) => {
  let query = "SELECT * FROM ads WHERE active = true AND amount_left > 0";
  const params = [];
  if (req.query.side) { params.push(req.query.side); query += ` AND side = $${params.length}`; }
  if (req.query.asset) { params.push(req.query.asset); query += ` AND asset = $${params.length}`; }
  if (req.query.face_type) { params.push(req.query.face_type); query += ` AND face_type = $${params.length}`; }
  if (req.query.payment) { params.push(req.query.payment); query += ` AND $${params.length} = ANY(payment_methods)`; }
  if (req.query.min_amount) { params.push(req.query.min_amount); query += ` AND max_rub >= $${params.length}`; }
  if (req.query.max_amount) { params.push(req.query.max_amount); query += ` AND min_rub <= $${params.length}`; }
  if (req.query.price_sort === 'asc') query += " ORDER BY price ASC";
  else if (req.query.price_sort === 'desc') query += " ORDER BY price DESC";
  else query += " ORDER BY created_at DESC";
  query += " LIMIT 50";
  try {
    const result = await pool.query(query, params);
    const items = await Promise.all(result.rows.map(shapeAd));
    res.json({ items });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.get('/api/ads/my', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ads WHERE user_id = $1 AND active = true ORDER BY created_at DESC', [req.user.id]);
    const items = await Promise.all(result.rows.map(shapeAd));
    res.json({ items });
  } catch(e) { res.json({ items: [] }); }
});

app.get('/api/ads/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ads WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(await shapeAd(result.rows[0]));
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/ads', auth, async (req, res) => {
  const { side, face_type, asset, price, amount_total, min_rub, max_rub, payment_methods, terms, payment_time } = req.body;
  const p = Number(price), at = Number(amount_total), mn = Number(min_rub), mx = Number(max_rub);
  if (!(p > 0) || !(at > 0) || !(mn > 0) || !(mx > 0) || mn > mx || mx > at * p) return res.status(400).json({ error: 'bad_amounts' });
  
  if (side === 'buy') {
    const isStaff = ['admin', 'owner', 'deputy'].includes(req.user.role);
    const canCreateBuyAd = isStaff || req.user.is_maker || req.user.is_merchant;
    if (!canCreateBuyAd) return res.status(403).json({ error: 'Только мейкеры и мерчанты могут создавать объявления о покупке' });
    if (!isStaff && Number(req.user.balance_rub) < at * p) return res.status(400).json({ error: 'Недостаточно RUB' });
  }
  if (side === 'sell') {
    if (Number(req.user.balance_usdt) < at) return res.status(400).json({ error: 'Недостаточно USDT' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO ads (user_id, side, face_type, asset, price, amount_total, amount_left, min_rub, max_rub, payment_methods, terms, payment_time) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11) RETURNING *', 
      [req.user.id, side, face_type, asset, p, at, mn, mx, payment_methods, terms, payment_time || 30]
    );
    res.status(201).json(await shapeAd(result.rows[0]));
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.delete('/api/ads/:id', auth, async (req, res) => {
  try {
    const adRes = await pool.query('SELECT * FROM ads WHERE id = $1', [req.params.id]);
    const ad = adRes.rows[0];
    if (!ad || ad.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    
    try {
      await pool.query('DELETE FROM ads WHERE id = $1', [req.params.id]);
    } catch(e) {
      await pool.query('UPDATE ads SET active = false, amount_left = 0 WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.patch('/api/ads/:id', auth, async (req, res) => {
  const { price, min_rub, max_rub, payment_methods, terms, amount_total, active } = req.body;
  try {
    const adRes = await pool.query('SELECT * FROM ads WHERE id = $1', [req.params.id]);
    const ad = adRes.rows[0];
    if (!ad || ad.user_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    if (active !== undefined && !price) {
       const result = await pool.query('UPDATE ads SET active = $1 WHERE id = $2 RETURNING *', [active, req.params.id]);
       return res.json(await shapeAd(result.rows[0]));
    }
    const p = Number(price), mn = Number(min_rub), mx = Number(max_rub), at = Number(amount_total);
    if (!(p > 0) || !(mn > 0) || !(mx > 0) || mn > mx || !(at > 0)) return res.status(400).json({ error: 'bad_amounts' });
    const diff = at - Number(ad.amount_total);
    const newAmountLeft = Number(ad.amount_left) + diff;
    if (newAmountLeft < 0) return res.status(400).json({ error: 'Недостаточно средств' });
    const result = await pool.query(
      'UPDATE ads SET price = $1, min_rub = $2, max_rub = $3, payment_methods = $4, terms = $5, amount_total = $6, amount_left = $7 WHERE id = $8 RETURNING *',
      [p, mn, mx, payment_methods, terms, at, newAmountLeft, req.params.id]
    );
    res.json(await shapeAd(result.rows[0]));
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/exchange', auth, async (req, res) => {
  const { type, amount, rate } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'bad_amount' });
  if (type === 'buy' && Number(req.user.balance_rub) < Number(amount)) return res.status(400).json({ error: 'Недостаточно RUB' });
  if (type === 'sell' && Number(req.user.balance_usdt) < Number(amount)) return res.status(400).json({ error: 'Недостаточно USDT' });
  try {
    await pool.query("INSERT INTO requests (user_id, type, amount, currency, details, status) VALUES ($1, $2, $3, $4, $5, 'pending')", 
      [req.user.id, 'exchange', amount, type === 'buy' ? 'RUB' : 'USDT', JSON.stringify({ rate, exchange_type: type })]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'db_error' }); }
});

const STATUS_LABEL = { pending: 'Ожидает', accepted: 'К оплате', paid: 'Оплачено', completed: 'Завершён', cancelled: 'Отменён', declined: 'Отклонён', dispute: 'Спор' };

async function shapeOrder(o) {
  const bRes = await pool.query('SELECT * FROM users WHERE id = $1', [o.buyer_id]);
  const sRes = await pool.query('SELECT * FROM users WHERE id = $1', [o.seller_id]);
  const adRes = await pool.query('SELECT user_id FROM ads WHERE id = $1', [o.ad_id]);
  const adUserId = adRes.rows[0]?.user_id || null;
  
  const buyer = bRes.rows[0]; const seller = sRes.rows[0];
  return { id: o.id, publicId: o.public_id, adId: o.ad_id, adUserId: adUserId, asset: o.asset, price: Number(o.price), amountRub: Number(o.amount_rub), amountAsset: Number(o.amount_asset), faceType: o.face_type, paymentMethod: o.payment_method, paymentTime: Number(o.payment_time) || 30, status: o.status, statusLabel: STATUS_LABEL[o.status] || o.status, buyer: { id: o.buyer_id, username: buyer?.username, displayName: buyer?.display_name || buyer?.username, avatarUrl: buyer?.avatar_url }, seller: { id: o.seller_id, username: seller?.username, displayName: seller?.display_name || seller?.username, avatarUrl: seller?.avatar_url }, createdAt: o.created_at, expiresAt: o.expires_at, buyer_id: o.buyer_id, seller_id: o.seller_id, amount_rub: o.amount_rub, amount_asset: o.amount_asset, public_id: o.public_id, payment_method: o.payment_method, face_type: o.face_type, receipt_data: o.receipt_data };
}

app.post('/api/orders', auth, async (req, res) => {
  const { ad_id, amount_rub, payment_method } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adRes = await client.query('SELECT * FROM ads WHERE id = $1 FOR UPDATE', [ad_id]);
    const ad = adRes.rows[0];
    if (!ad || !ad.active) throw new Error('Объявление неактивно');
    if (ad.user_id === req.user.id) throw new Error('Нельзя торговать с собой');
    if (!ad.payment_methods.includes(payment_method)) throw new Error('Способ оплаты недоступен');
    const rub = Number(amount_rub);
    const realMaxRub = Math.min(Number(ad.max_rub), Number(ad.amount_left) * Number(ad.price));
    if (rub < ad.min_rub) throw new Error('Сумма ниже минимума');
    if (rub > realMaxRub) throw new Error('Сумма выше доступного лимита');
    const assetQty = rub / ad.price;
    if (assetQty > ad.amount_left) throw new Error('Недостаточно актива');
    const buyerId = ad.side === 'sell' ? req.user.id : ad.user_id;
    const sellerId = ad.side === 'sell' ? ad.user_id : req.user.id;
    await client.query('UPDATE ads SET amount_left = amount_left - $1 WHERE id = $2', [assetQty, ad.id]);
    const publicId = 'VX-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const history = JSON.stringify([{ status: 'pending', at: new Date().toISOString(), note: 'Заявка создана' }]);
    const orderRes = await client.query(
      'INSERT INTO orders (public_id, ad_id, buyer_id, seller_id, asset, price, amount_rub, amount_asset, face_type, payment_method, history, payment_time, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *', 
      [publicId, ad.id, buyerId, sellerId, ad.asset, ad.price, rub, assetQty, ad.face_type, payment_method, history, ad.payment_time || 30, 'pending']
    );
    await client.query('COMMIT');
    const orderData = { ...orderRes.rows[0], counterparty_username: req.user.username };
    
    const targetTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [ad.user_id])).rows[0]?.telegram_id;
    if (targetTgId) {
        const msg = formatOrderMsg(orderData, "🔥 Новая заявка!");
        const buttons = [[{ text: "✅ Принять", callback_data: `accept:${orderData.id}` }], [{ text: "❌ Отклонить", callback_data: `decline:${orderData.id}` }]];
        await sendTG(targetTgId, msg, buttons);
    }
    res.status(201).json(await shapeOrder(orderRes.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK'); res.status(400).json({ error: err.message || 'order_error' });
  } finally { client.release(); }
});

app.get('/api/orders/my', auth, async (req, res) => {
  let query = "SELECT * FROM orders"; let params = [];
  if (req.user.role !== 'admin') { query += " WHERE buyer_id = $1 OR seller_id = $1"; params.push(req.user.id); }
  else { query += " WHERE 1=1"; }
  const f = req.query.status;
  if (f === 'active') query += " AND status IN ('pending', 'accepted', 'paid', 'dispute')";
  else if (f === 'completed') query += " AND status = 'completed'";
  else if (f === 'cancelled') query += " AND status IN ('cancelled', 'declined')";
  query += " ORDER BY created_at DESC";
  const result = await pool.query(query, params);
  const items = await Promise.all(result.rows.map(shapeOrder));
  res.json({ items });
});

app.get('/api/orders/:id', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const o = result.rows[0];
  if (!o) return res.status(404).json({ error: 'not_found' });
  if (o.buyer_id !== req.user.id && o.seller_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const adRes = await pool.query('SELECT terms FROM ads WHERE id = $1', [o.ad_id]);
  res.json({ order: await shapeOrder(o), history: o.history, terms: adRes.rows[0]?.terms });
});

async function transition(orderId, to, note, client = pool) {
  const oRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const o = oRes.rows[0];
  const newHistory = [...(o.history || []), { status: to, at: new Date().toISOString(), note }];
  await client.query('UPDATE orders SET status = $1, history = $2 WHERE id = $3', [to, JSON.stringify(newHistory), orderId]);
  if (to === 'cancelled' || to === 'declined') await client.query('UPDATE ads SET amount_left = amount_left + $1 WHERE id = $2', [o.amount_asset, o.ad_id]);
  return o;
}

app.post('/api/orders/:id/accept', auth, async (req, res) => {
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const o = oRes.rows[0];
  const adRes = await pool.query('SELECT user_id FROM ads WHERE id = $1', [o.ad_id]);
  if (adRes.rows[0].user_id !== req.user.id || o.status !== 'pending') return res.status(403).json({ error: 'Доступ запрещен' });
  await transition(o.id, 'accepted', 'Заявка принята');
  
  const targetId = o.buyer_id === req.user.id ? o.seller_id : o.buyer_id;
  const targetTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [targetId])).rows[0]?.telegram_id;
  if (targetTgId) {
     const isRequesterBuyer = targetId === o.buyer_id;
     const msg = formatOrderMsg({...o, counterparty_username: req.user.username}, "✅ Заявка принята!");
     const btn = isRequesterBuyer ? [[{ text: "💸 Я оплатил", callback_data: `paid:${o.id}` }]] : [];
     await sendTG(targetTgId, msg, btn);
  }
  res.json({ ok: true });
});

app.post('/api/orders/:id/decline', auth, async (req, res) => {
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const o = oRes.rows[0];
  const adRes = await pool.query('SELECT user_id FROM ads WHERE id = $1', [o.ad_id]);
  if (adRes.rows[0].user_id !== req.user.id || o.status !== 'pending') return res.status(403).json({ error: 'Доступ запрещен' });
  await transition(o.id, 'declined', 'Заявка отклонена');
  
  const targetId = o.buyer_id === req.user.id ? o.seller_id : o.buyer_id;
  const targetTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [targetId])).rows[0]?.telegram_id;
  if (targetTgId) {
     const oData = {...o, counterparty_username: req.user.username};
     await sendTG(targetTgId, formatOrderMsg(oData, "❌ Заявка отклонена"));
  }
  res.json({ ok: true });
});

app.post('/api/orders/:id/paid', auth, async (req, res) => {
  const { receipt_data } = req.body;
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const o = oRes.rows[0];
  if (o.buyer_id !== req.user.id || o.status !== 'accepted') return res.status(409).json({ error: 'Неверный статус' });
  
  await transition(o.id, 'paid', 'Оплата отправлена'); 
  if (receipt_data) {
      await pool.query('UPDATE orders SET receipt_data = $1 WHERE id = $2', [receipt_data, o.id]);
  }

  const sellerTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [o.seller_id])).rows[0]?.telegram_id;
  if (sellerTgId) {
     const oData = {...o, counterparty_username: req.user.username};
     const msg = formatOrderMsg(oData, "💰 Покупатель нажал 'Оплатил'!");
     const btn = [[{ text: "✅ Подтвердить получение", callback_data: `confirm:${o.id}` }], [{ text: "🛡 Открыть спор", callback_data: `dispute:${o.id}` }]];
     await sendTG(sellerTgId, msg, btn);
  }
  res.json({ ok: true });
});

app.post('/api/orders/:id/confirm', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    const o = oRes.rows[0];
    if (o.seller_id !== req.user.id || o.status !== 'paid') throw new Error('bad');
    await transition(o.id, 'completed', 'Завершён', client);
    const volumeToAdd = Number(o.amount_rub) / 90;
    await client.query('UPDATE users SET volume_usd = volume_usd + $1 WHERE id = $2', [volumeToAdd, o.buyer_id]);
    await client.query('UPDATE users SET volume_usd = volume_usd + $1 WHERE id = $2', [volumeToAdd, o.seller_id]);
    await client.query('UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2', [o.amount_asset, o.buyer_id]);
    await client.query('UPDATE users SET balance_rub = balance_rub + $1 WHERE id = $2', [o.amount_rub, o.seller_id]);
    await client.query('COMMIT');
    const buyerTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [o.buyer_id])).rows[0]?.telegram_id;
    if (buyerTgId) {
       const oData = {...o, counterparty_username: req.user.username};
       await sendTG(buyerTgId, formatOrderMsg(oData, "🎉 Сделка завершена! Средства зачислены."));
    }
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(409).json({ error: 'Ошибка' }); }
  finally { client.release(); }
});

app.post('/api/orders/:id/cancel', auth, async (req, res) => {
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const o = oRes.rows[0];
  if (!['pending', 'accepted', 'paid'].includes(o.status)) return res.status(409).json({ error: 'bad' });
  if (o.buyer_id !== req.user.id && o.seller_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  await transition(o.id, 'cancelled', 'Отменён пользователем'); 
  const targetId = o.buyer_id === req.user.id ? o.seller_id : o.buyer_id;
  const targetTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [targetId])).rows[0]?.telegram_id;
  if (targetTgId) {
      const oData = {...o, counterparty_username: req.user.username};
      await sendTG(targetTgId, formatOrderMsg(oData, "⚠️ Контрагент отменил сделку."));
  }
  res.json({ ok: true });
});

app.post('/api/orders/:id/dispute', auth, async (req, res) => {
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const o = oRes.rows[0];
  if (!o || !['pending', 'accepted', 'paid'].includes(o.status)) return res.status(409).json({ error: 'bad' });
  if (o.buyer_id !== req.user.id && o.seller_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  await transition(o.id, 'dispute', 'Открыт спор: ' + (req.body?.reason || '')); 
  const targetId = o.buyer_id === req.user.id ? o.seller_id : o.buyer_id;
  const targetTgId = (await pool.query('SELECT telegram_id FROM users WHERE id = $1', [targetId])).rows[0]?.telegram_id;
  if (targetTgId) {
      const oData = {...o, counterparty_username: req.user.username};
      await sendTG(targetTgId, formatOrderMsg(oData, "🛑 Внимание! Открыт спор."));
  }
  res.json({ ok: true });
});

app.post('/api/orders/:id/resolve', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const { resolution } = req.body;
  if (!['completed', 'cancelled'].includes(resolution)) return res.status(400).json({ error: 'bad' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const oRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    const o = oRes.rows[0];
    if (o.status !== 'dispute') throw new Error('bad');
    const note = resolution === 'completed' ? 'Спор решен: в пользу продавца' : 'Спор решен: в пользу покупателя';
    await transition(o.id, resolution, note, client);
    if (resolution === 'completed') {
      const volumeToAdd = Number(o.amount_rub) / 90;
      await client.query('UPDATE users SET volume_usd = volume_usd + $1 WHERE id = $2', [volumeToAdd, o.buyer_id]);
      await client.query('UPDATE users SET volume_usd = volume_usd + $1 WHERE id = $2', [volumeToAdd, o.seller_id]);
      await client.query('UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2', [o.amount_asset, o.buyer_id]);
      await client.query('UPDATE users SET balance_rub = balance_rub + $1 WHERE id = $2', [o.amount_rub, o.seller_id]);
    }
    await client.query('COMMIT');
    notifyUser(o.buyer_id, `⚖️ <b>Спор решен!</b>\nАдминистрация вынесла решение.`);
    notifyUser(o.seller_id, `⚖️ <b>Спор решен!</b>\nАдминистрация вынесла решение.`);
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(409).json({ error: 'bad' }); }
  finally { client.release(); }
});

app.get('/api/chat/:orderId', auth, async (req, res) => {
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.orderId]);
  const o = oRes.rows[0];
  if (!o || (o.buyer_id !== req.user.id && o.seller_id !== req.user.id && req.user.role !== 'admin')) return res.status(403).json({ error: 'forbidden' });
  const result = await pool.query(`SELECT m.*, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.order_id = $1 ORDER BY m.created_at ASC`, [o.id]);
  res.json({ items: result.rows.map(m => ({ id: m.id, senderId: m.sender_id, senderUsername: m.username, text: m.text, media_data: m.media_data, media_type: m.media_type, createdAt: m.created_at, isMine: m.sender_id === req.user.id })) });
});

app.post('/api/chat/:orderId', auth, async (req, res) => {
  const { text, media_data, media_type } = req.body;
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.orderId]);
  const o = oRes.rows[0];
  if (!o || ['completed', 'cancelled', 'declined'].includes(o.status)) return res.status(409).json({ error: 'closed' });
  if (o.buyer_id !== req.user.id && o.seller_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const result = await pool.query('INSERT INTO messages (order_id, sender_id, text, media_data, media_type) VALUES ($1, $2, $3, $4, $5) RETURNING *', [o.id, req.user.id, text || '', media_data || null, media_type || null]);
  res.status(201).json({ ...result.rows[0], isMine: true });
});

app.post('/api/reviews', auth, async (req, res) => {
  const { order_id, rating, comment } = req.body;
  const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
  const o = oRes.rows[0];
  if (!o || o.status !== 'completed') return res.status(409).json({ error: 'not_completed' });
  const targetId = o.buyer_id === req.user.id ? o.seller_id : o.buyer_id;
  await pool.query('INSERT INTO reviews (order_id, author_id, target_id, rating, comment) VALUES ($1, $2, $3, $4, $5)', [o.id, req.user.id, targetId, rating, comment]);
  res.status(201).json({ ok: true });
});

app.get('/api/reviews/user/:userId', async (req, res) => {
  const result = await pool.query(`SELECT r.*, u.display_name FROM reviews r JOIN users u ON r.author_id = u.id WHERE r.target_id = $1 ORDER BY r.created_at DESC`, [req.params.userId]);
  res.json({ items: result.rows.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, author: r.display_name, createdAt: r.created_at })) });
});

app.get('/api/admin/users', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const items = await Promise.all(result.rows.map(async u => {
      const stats = await getUserStats(u.id);
      return { ...publicUser(u), stats };
    }));
    res.json({ items });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.patch('/api/admin/users/:id/status', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const { is_pro, is_merchant, is_maker } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET is_pro = COALESCE($1, is_pro), is_merchant = COALESCE($2, is_merchant), is_maker = COALESCE($3, is_maker) WHERE id = $4 RETURNING *',
      [is_pro, is_merchant, is_maker, req.params.id]
    );
    res.json({ ok: true, user: publicUser(result.rows[0]) });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/admin/users/:id/balance', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const { currency, amount, action } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'bad_amount' });
  const field = currency === 'rub' ? 'balance_rub' : 'balance_usdt';
  const operator = action === 'add' ? '+' : '-';
  try {
    await pool.query(`UPDATE users SET ${field} = ${field} ${operator} $1 WHERE id = $2`, [amt, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'db_error' }); }
});

app.get('/api/admin/orders', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query("SELECT * FROM orders WHERE status = 'dispute' OR status = 'pending' OR status = 'paid' ORDER BY created_at DESC");
    const items = await Promise.all(result.rows.map(shapeOrder));
    res.json({ items });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.get('/api/admin/requests', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query(`SELECT r.*, u.username FROM requests r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC`);
    res.json({ items: result.rows });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.patch('/api/admin/requests/:id', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const { status, admin_comment } = req.body; 
  const reqId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rRes = await client.query('SELECT * FROM requests WHERE id = $1 FOR UPDATE', [reqId]);
    const request = rRes.rows[0];
    if (!request || ['completed', 'rejected', 'cancelled'].includes(request.status)) throw new Error('Заявка уже завершена');
    
    await client.query('UPDATE requests SET status = $1, admin_comment = COALESCE($2, admin_comment) WHERE id = $3', [status, admin_comment, reqId]);
    
    if (status === 'approved') {
      if (request.type === 'maker_req') await client.query('UPDATE users SET is_maker = true WHERE id = $1', [request.user_id]);
      else if (request.type === 'merchant_req') await client.query('UPDATE users SET is_merchant = true WHERE id = $1', [request.user_id]);
      else if (request.type === 'deposit_rub') await client.query('UPDATE users SET balance_rub = balance_rub + $1 WHERE id = $2', [request.amount, request.user_id]);
      else if (request.type === 'withdraw_rub') await client.query('UPDATE users SET balance_rub = balance_rub - $1 WHERE id = $2', [request.amount, request.user_id]);
      else if (request.type === 'deposit_usdt') await client.query('UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2', [request.amount, request.user_id]);
      else if (request.type === 'withdraw_usdt') await client.query('UPDATE users SET balance_usdt = balance_usdt - $1 WHERE id = $2', [request.amount, request.user_id]);
      else if (request.type === 'exchange') {
        const details = request.details;
        if (details.exchange_type === 'buy') {
          const rubAmount = Number(request.amount); const usdtAmount = rubAmount / details.rate;
          await client.query('UPDATE users SET balance_rub = balance_rub - $1, balance_usdt = balance_usdt + $2 WHERE id = $3', [rubAmount, usdtAmount, request.user_id]);
        } else {
          const usdtAmount = Number(request.amount); const rubAmount = usdtAmount * details.rate;
          await client.query('UPDATE users SET balance_usdt = balance_usdt - $1, balance_rub = balance_rub + $2 WHERE id = $3', [usdtAmount, rubAmount, request.user_id]);
        }
      }
    }
    await client.query('COMMIT');
    const statusText = status === 'approved' ? 'одобрена ✅' : status === 'rejected' ? 'отклонена ❌' : 'отменена';
    notifyUser(request.user_id, `📄 <b>Статус заявки обновлен</b>\nВаша заявка была ${statusText}.${admin_comment ? `\n💬 Комментарий: ${admin_comment}` : ''}`);
    res.json({ ok: true });
  } catch(e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message || 'error' }); }
  finally { client.release(); }
});

// --- ADMIN STATISTICS ---
app.get('/api/admin/stats', auth, async (req, res) => {
  if (!['admin', 'owner', 'deputy'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const { period } = req.query; // day, week, month, year, all
  
  let timeCondition = "";
  if (period === 'day') timeCondition = "AND created_at >= NOW() - INTERVAL '1 day'";
  else if (period === 'week') timeCondition = "AND created_at >= NOW() - INTERVAL '7 days'";
  else if (period === 'month') timeCondition = "AND created_at >= NOW() - INTERVAL '1 month'";
  else if (period === 'year') timeCondition = "AND created_at >= NOW() - INTERVAL '1 year'";

  try {
    const reqRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM requests WHERE type LIKE 'withdraw%' AND status = 'approved' ${timeCondition}`);
    const count = parseInt(reqRes.rows[0].count);
    const total = Number(reqRes.rows[0].total);
    
    let avg = 0;
    if (period === 'day') avg = total;
    else if (period === 'week') avg = total / 7;
    else if (period === 'month') avg = total / 30;
    else if (period === 'year') avg = total / 365;
    else {
        // Для all time считаем среднее в день от первой заявки
        const daysRes = await pool.query(`SELECT EXTRACT(DAY FROM NOW() - MIN(created_at)) as days FROM requests WHERE type LIKE 'withdraw%' AND status = 'approved'`);
        const days = parseInt(daysRes.rows[0].days) || 1;
        avg = total / (days || 1);
    }

    res.json({ count, total, avg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('VEXO P2P running on port ' + PORT));