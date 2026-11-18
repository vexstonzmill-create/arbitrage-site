const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const { Pool } = require('pg');

// ==========================================
// ⚠️ ВСТАВЬ СВОИ ДАННЫЕ СЮДА:
const CONFIG = {
  BOT_TOKEN: '9049997738:AAGgB6hc5MBs7GdmcTLH7A3kREGvyaOpoxE', // Перевыпусти через BotFather /revoke!
  CHANNEL_ID: '-1004468086212',
  DATABASE_URL: 'postgresql://neondb_owner:****************@ep-icy-hall-b9m7t2bk-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  PROVIDER_TOKEN: '' // Вставь токен провайдера платежей из BotFather -> Payments
};
// ==========================================

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  connectionString: CONFIG.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Проверка подписки на канал
async function checkSubscription(userId) {
  try {
    const res = await axios.get(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/getChatMember`, {
      params: { chat_id: CONFIG.CHANNEL_ID, user_id: userId }
    });
    return ['member', 'administrator', 'creator'].includes(res.data.result.status);
  } catch (e) {
    console.error('Ошибка проверки подписки:', e.message);
    return false;
  }
}

// Валидация данных от Telegram
function validateTelegramData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(CONFIG.BOT_TOKEN).digest();
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex') === hash;
}

// API: Авторизация
app.post('/api/auth', async (req, res) => {
  const { initData } = req.body;
  if (!validateTelegramData(initData)) return res.status(401).json({ error: 'Invalid data' });

  const tgUser = JSON.parse(new URLSearchParams(initData).get('user'));

  try {
    let userRes = await pool.query('SELECT * FROM users WHERE tg_id = $1', [tgUser.id]);
    let user = userRes.rows[0];

    if (!user) {
      const insert = await pool.query(
        'INSERT INTO users (tg_id, username, first_name) VALUES ($1, $2, $3) RETURNING *',
        [tgUser.id, tgUser.username || '', tgUser.first_name || '']
      );
      user = insert.rows[0];
    }

    const isSubscribed = await checkSubscription(tgUser.id);
    res.json({ subscribed: isSubscribed, paid: user.is_paid });
  } catch (e) {
    console.error('Auth error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Получение контента
app.post('/api/content', async (req, res) => {
  const { initData } = req.body;
  if (!validateTelegramData(initData)) return res.status(401).json({ error: 'Invalid data' });

  const tgUser = JSON.parse(new URLSearchParams(initData).get('user'));
  try {
    const userRes = await pool.query('SELECT is_paid FROM users WHERE tg_id = $1', [tgUser.id]);
    if (!userRes.rows[0]?.is_paid) return res.status(403).json({ error: 'Need payment' });

    const modules = await pool.query('SELECT * FROM modules ORDER BY sort_order ASC');
    res.json({ modules: modules.rows });
  } catch (e) {
    console.error('Content error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Создание счета на оплату
app.post('/api/invoice', async (req, res) => {
  const { initData } = req.body;
  if (!validateTelegramData(initData)) return res.status(401).json({ error: 'Invalid data' });
  const tgUser = JSON.parse(new URLSearchParams(initData).get('user'));

  try {
    const response = await axios.post(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/createInvoiceLink`, {
      title: 'Доступ к vxo | 767',
      description: 'Пожизненный доступ к базе знаний P2P',
      payload: `user_${tgUser.id}`,
      provider_token: CONFIG.PROVIDER_TOKEN,
      currency: 'USD',
      prices: [{ label: 'Доступ', amount: 3000 }] // 30.00 USD в центах
    });
    res.json({ link: response.data.result });
  } catch (e) {
    console.error('Invoice error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Ошибка создания счета' });
  }
});

// API: Вебхук от Telegram (успешные платежи)
app.post('/api/webhook', async (req, res) => {
  const message = req.body;

  if (message.pre_checkout_query) {
    try {
      await axios.post(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/answerPreCheckoutQuery`, {
        pre_checkout_query_id: message.pre_checkout_query.id,
        ok: true
      });
    } catch (e) {
      console.error('PreCheckout error:', e.message);
    }
  }

  if (message.message?.successful_payment) {
    try {
      const payload = message.message.successful_payment.invoice_payload; // "user_12345"
      const tgId = payload.split('_')[1];
      await pool.query('UPDATE users SET is_paid = true WHERE tg_id = $1', [tgId]);
      console.log(`Payment success for user ${tgId}`);
    } catch (e) {
      console.error('Payment save error:', e.message);
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`vxo | 767 Backend running on port ${PORT}`));