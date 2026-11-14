const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const crypto = require('crypto');

const PORT = process.env.PORT || 3002;

// ==========================================
// !!! НАСТРОЙКИ (ЗАМЕНИТЬ НА СВОИ) !!!
// ==========================================
const BOT_TOKEN = '9049997738:AAGgB6hc5MBs7GdmcTLH7A3kREGvyaOpoxE'; 
const CHANNEL_ID = '-1004468086212'; // !!! ЗАМЕНИТЬ на юзернейм твоего канала
const APP_URL = 'https://vxomanual.onrender.com'; // !!! ЗАМЕНИТЬ на домен этого сайта на Render
const ADMIN_IDS = [6938068102]; // !!! ЗАМЕНИТЬ на твой Telegram ID (цифры)
// ==========================================

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_UDtaHhd5Zr6s@ep-divine-sun-bawvlsl5-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false }
});

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json({ limit: '2mb' }));

// --- ИНИЦИАЛИЗАЦИЯ БД ---
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hub_users (
        tg_id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        first_name VARCHAR(100)
      );
      CREATE TABLE IF NOT EXISTS hub_bl (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100), reason TEXT, severity VARCHAR(20) DEFAULT 'bad'
      );
      CREATE TABLE IF NOT EXISTS hub_manuals (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200), content TEXT
      );
      CREATE TABLE IF NOT EXISTS hub_terms (
        id SERIAL PRIMARY KEY,
        term VARCHAR(100), definition TEXT
      );
      CREATE TABLE IF NOT EXISTS hub_market (
        id SERIAL PRIMARY KEY,
        author_tg_id BIGINT,
        author_username VARCHAR(100),
        category VARCHAR(20), 
        title VARCHAR(200), 
        description TEXT,
        price VARCHAR(50),
        contact VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS hub_purchases (
        id SERIAL PRIMARY KEY,
        market_id INT REFERENCES hub_market(id) ON DELETE CASCADE,
        buyer_tg_id BIGINT,
        buyer_username VARCHAR(100),
        payment_method VARCHAR(50),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Миграция: добавляем колонки оплаты, если их ещё нет
    await pool.query(`ALTER TABLE hub_market ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT '{}';`);
    await pool.query(`ALTER TABLE hub_market ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}';`);

    // Сид базовых данных
    if ((await pool.query('SELECT COUNT(*) FROM hub_terms')).rows[0].count === '0') {
      await pool.query(`INSERT INTO hub_terms (term, definition) VALUES 
        ('P2P', 'Peer-to-peer — прямой обмен между людьми'),
        ('Спред', 'Разница между ценой покупки и продажи'),
        ('Мейкер', 'Создатель объявления'),
        ('Тейкер', 'Тот, кто откликается на объявление');`);
    }
    if ((await pool.query('SELECT COUNT(*) FROM hub_bl')).rows[0].count === '0') {
      await pool.query(`INSERT INTO hub_bl (name, reason) VALUES ('Example Exchange', 'Заблокировали вывод средств');`);
    }
    
    console.log('✓ Hub DB initialized');
  } catch (e) { console.error('DB Error', e); }
}
initDB();

// --- TELEGRAM WEB APP AUTH ---
function validateTGData(initData) {
  const urlParams = new URLSearchParams(initData);
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

async function checkSubscription(tgId) {
  try {
    const member = await bot.getChatMember(CHANNEL_ID, tgId);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (e) { return false; }
}

// --- API ---
app.post('/api/auth', async (req, res) => {
  const { initData } = req.body;
  if (!initData || !validateTGData(initData)) return res.status(401).json({ error: 'invalid_data' });
  
  const urlParams = new URLSearchParams(initData);
  const tgUser = JSON.parse(urlParams.get('user'));
  
  try {
    const isSubbed = await checkSubscription(tgUser.id);

    await pool.query(`
      INSERT INTO hub_users (tg_id, username, first_name) VALUES ($1, $2, $3)
      ON CONFLICT (tg_id) DO UPDATE SET username = $2, first_name = $3
    `, [tgUser.id, tgUser.username || null, tgUser.first_name || null]);

    res.json({ isSubbed, user: tgUser, isAdmin: ADMIN_IDS.includes(tgUser.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'server_error' }); }
});

app.get('/api/data', async (req, res) => {
  try {
    const bl = await pool.query('SELECT * FROM hub_bl');
    const manuals = await pool.query('SELECT * FROM hub_manuals');
    const terms = await pool.query('SELECT * FROM hub_terms');
    const market = await pool.query("SELECT * FROM hub_market WHERE status = 'approved' ORDER BY created_at DESC");
    
    res.json({
      bl: bl.rows, manuals: manuals.rows, terms: terms.rows, market: market.rows
    });
  } catch (err) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/market/submit', async (req, res) => {
  const { tg_id, username, category, title, description, price, contact, payment_methods, payment_details } = req.body;
  if (!tg_id || !title || !description || !contact) return res.status(400).json({ error: 'fill_all' });
  if (!Array.isArray(payment_methods) || !payment_methods.length) return res.status(400).json({ error: 'no_payment_methods' });
  if (!payment_details || !Object.keys(payment_details).length) return res.status(400).json({ error: 'no_details' });
  
  const isSubbed = await checkSubscription(tg_id);
  if (!isSubbed) return res.status(403).json({ error: 'not_subscribed' });

  try {
    await pool.query(`
      INSERT INTO hub_market (author_tg_id, author_username, category, title, description, price, contact, payment_methods, payment_details, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    `, [tg_id, username, category, title, description, price || 'Договорная', contact, payment_methods, JSON.stringify(payment_details)]);
    
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/market/buy', async (req, res) => {
  const { market_id, tg_id, username, payment_method } = req.body;
  if (!market_id || !tg_id || !payment_method) return res.status(400).json({ error: 'bad_data' });
  
  try {
    const m = await pool.query("SELECT * FROM hub_market WHERE id = $1 AND status = 'approved'", [market_id]);
    if (!m.rows[0]) return res.status(404).json({ error: 'not_found' });
    const product = m.rows[0];
    
    if (product.author_tg_id === tg_id) return res.status(400).json({ error: 'self_buy' });
    if (!product.payment_methods || !product.payment_methods.includes(payment_method)) 
      return res.status(400).json({ error: 'method_not_available' });
    
    // Проверка дубликата
    const dup = await pool.query(
      "SELECT id FROM hub_purchases WHERE market_id = $1 AND buyer_tg_id = $2 AND status = 'pending'",
      [market_id, tg_id]
    );
    if (dup.rows.length > 0) {
      // Уже есть открытая заявка — возвращаем реквизиты
      const details = (product.payment_details || {})[payment_method];
      return res.json({ ok: true, already: true, details, author_contact: product.contact, author_username: product.author_username });
    }
    
    await pool.query(`
      INSERT INTO hub_purchases (market_id, buyer_tg_id, buyer_username, payment_method) 
      VALUES ($1, $2, $3, $4)
    `, [market_id, tg_id, username || null, payment_method]);
    
    // Уведомление автору
    const methodLabel = payment_method;
    bot.sendMessage(product.author_tg_id, 
      `💰 <b>Покупка твоего товара!</b>\n\n` +
      `📦 Товар: <b>${product.title}</b>\n` +
      `👤 Покупатель: @${username || tg_id}\n` +
      `💳 Способ оплаты: <b>${methodLabel}</b>\n` +
      `💵 Цена: <b>${product.price}</b>\n\n` +
      `Ожидай оплату и свяжись с покупателем в Telegram.`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    
    const details = (product.payment_details || {})[payment_method];
    res.json({ ok: true, details, author_contact: product.contact, author_username: product.author_username });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db_error' }); }
});

app.get('/api/admin/pending', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM hub_market WHERE status = 'pending' ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'db_error' }); }
});

app.post('/api/admin/approve', async (req, res) => {
  const { id, action } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';
  try {
    const m = await pool.query('SELECT * FROM hub_market WHERE id = $1', [id]);
    await pool.query('UPDATE hub_market SET status = $1 WHERE id = $2', [status, id]);
    
    if (m.rows[0]) {
      const product = m.rows[0];
      const msg = status === 'approved' 
        ? `✅ <b>Твой товар одобрен!</b>\n\n` +
          `Категория: ${product.category}\n` +
          `Название: <b>${product.title}</b>\n` +
          `Цена: <b>${product.price}</b>\n\n` +
          `Он уже виден в маркете VEXO Hub.`
        : `❌ <b>Твой товар отклонён</b>\n\n` +
          `Название: <b>${product.title}</b>\n\n` +
          `Свяжись с админом для уточнения причин.`;
      
      bot.sendMessage(product.author_tg_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }
    
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'db_error' }); }
});

// --- BOT COMMANDS ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const isSubbed = await checkSubscription(msg.from.id);

  if (!isSubbed) {
    bot.sendMessage(chatId, 
      `👋 <b>Привет!</b>\n\nДля доступа к VEXO Hub подпишись на наш канал:`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📢 Подписаться', url: CHANNEL_ID.startsWith('@') ? `https://t.me/${CHANNEL_ID.slice(1)}` : 'https://t.me/vexo_channel' }],
            [{ text: '✅ Я подписался', callback_data: 'check_sub' }]
          ]
        }
      }
    );
  } else {
    bot.sendMessage(chatId,
      `👋 <b>Добро пожаловать в VEXO Hub!</b>\n\nЖми кнопку ниже, чтобы открыть приложение:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🚀 Открыть VEXO Hub', web_app: { url: APP_URL } }]]
        }
      }
    );
  }
});

bot.on('callback_query', async (query) => {
  if (query.data === 'check_sub') {
    const chatId = query.message.chat.id;
    const isSubbed = await checkSubscription(query.from.id);
    
    if (isSubbed) {
      bot.answerCallbackQuery(query.id, { text: '✅ Подписка подтверждена!' });
      bot.editMessageText(
        `✅ <b>Доступ разрешен!</b>\n\nЖми, чтобы открыть VEXO Hub:`,
        {
          chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🚀 Открыть VEXO Hub', web_app: { url: APP_URL } }]] }
        }
      );
    } else {
      bot.answerCallbackQuery(query.id, { text: '❌ Вы всё еще не подписаны!', show_alert: true });
    }
  }
});

// --- STATIC & START ---
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`✓ VEXO Hub running on port ${PORT}`));