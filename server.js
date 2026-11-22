const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const CONFIG = {
  BOT_TOKEN: '9049997738:AAGgB6hc5MBs7GdmcTLH7A3kREGvyaOpoxE',
  ADMIN_TG_ID: 6938068102, 
  DATABASE_URL: 'postgresql://neondb_owner:npg_xN9OFsw6uCMe@ep-solitary-cloud-bahn17dh-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
};

const pool = new Pool({
  connectionString: CONFIG.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, username TEXT, display_name TEXT, avatar_url TEXT, role TEXT DEFAULT 'user', is_paid BOOLEAN DEFAULT false);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE, icon TEXT);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS articles (id SERIAL PRIMARY KEY, category TEXT, title TEXT, content TEXT, image_url TEXT, updated_at TIMESTAMPTZ DEFAULT now());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS payment_requests (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS calc_history (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, buy_rate NUMERIC, sell_rate NUMERIC, amount NUMERIC, profit NUMERIC, created_at TIMESTAMPTZ DEFAULT now());`);
    
    // Новые таблицы
    await pool.query(`CREATE TABLE IF NOT EXISTS requisites (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, bank_name TEXT, card_number TEXT, created_at TIMESTAMPTZ DEFAULT now());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, type TEXT, amount NUMERIC, description TEXT, created_at TIMESTAMPTZ DEFAULT now());`);

    const checkCats = await pool.query('SELECT count(*) FROM categories');
    if (parseInt(checkCats.rows[0].count) === 0) {
      await pool.query(`INSERT INTO categories (name, icon) VALUES ('Мануалы', '🏦'), ('Связки', '🔗'), ('Термины', '📚'), ('Безопасность', '🛡️');`);
    }
    console.log('✅ База данных готова');
  } catch (e) { console.error('❌ Ошибка БД:', e.message); }
}
initDB();

function validateTelegramData(initData) {
  if (!initData) return false;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    const dataCheckString = Array.from(urlParams.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(CONFIG.BOT_TOKEN).digest();
    return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex') === hash;
  } catch (e) { return false; }
}

app.post('/api/auth/telegram', async (req, res) => {
  const { initData } = req.body;
  if (!validateTelegramData(initData)) return res.status(401).json({ error: 'Invalid initData' });
  
  try {
    const tgUserStr = new URLSearchParams(initData).get('user');
    const tgUser = JSON.parse(tgUserStr);
    const isAdmin = Number(tgUser.id) === Number(CONFIG.ADMIN_TG_ID);
    
    const result = await pool.query(`
      INSERT INTO users (id, username, display_name, avatar_url, role) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name 
      RETURNING *;
    `, [tgUser.id, tgUser.username || `user_${tgUser.id}`, tgUser.first_name || 'User', tgUser.photo_url || null, isAdmin ? 'admin' : 'user']);
    
    res.json({ token: 'token_' + tgUser.id, user: result.rows[0] });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const cats = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    const arts = await pool.query('SELECT * FROM articles ORDER BY updated_at DESC');
    res.json({ categories: cats.rows, articles: arts.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- РЕКВИЗИТЫ ---
app.get('/api/requisites/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requisites WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
    res.json({ items: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/requisites', async (req, res) => {
  const { userId, bank_name, card_number } = req.body;
  try {
    await pool.query('INSERT INTO requisites (user_id, bank_name, card_number) VALUES ($1, $2, $3)', [userId, bank_name, card_number]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- ТРАНЗАКЦИИ ---
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
    res.json({ items: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/transactions', async (req, res) => {
  const { userId, type, amount, description } = req.body;
  try {
    await pool.query('INSERT INTO transactions (user_id, type, amount, description) VALUES ($1, $2, $3, $4)', [userId, type, amount, description]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- СТАТЬИ ---
app.post('/api/articles', async (req, res) => {
  const { category, title, content, image_url } = req.body;
  try {
    await pool.query('INSERT INTO articles (category, title, content, image_url) VALUES ($1, $2, $3, $4)', [category, title, content, image_url]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/articles/:id', async (req, res) => {
  const { title, content, image_url } = req.body;
  try {
    await pool.query('UPDATE articles SET title = $1, content = $2, image_url = $3, updated_at = now() WHERE id = $4', [title, content, image_url, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/categories', async (req, res) => {
  const { name, icon } = req.body;
  try {
    await pool.query('INSERT INTO categories (name, icon) VALUES ($1, $2)', [name, icon || '📄']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Exists' }); }
});

// --- ОПЛАТА ---
app.post('/api/payment-request', async (req, res) => {
  const { userId } = req.body;
  try {
    const check = await pool.query('SELECT * FROM payment_requests WHERE user_id = $1 AND status = $2', [userId, 'pending']);
    if (check.rows.length > 0) return res.json({ success: true });
    await pool.query('INSERT INTO payment_requests (user_id) VALUES ($1)', [userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.created_at, u.display_name, u.username, u.id as user_id
      FROM payment_requests pr JOIN users u ON pr.user_id = u.id
      WHERE pr.status = 'pending' ORDER BY pr.created_at DESC
    `);
    res.json({ requests: result.rows });
  } catch (e) { res.json({ requests: [] }); }
});

app.post('/api/admin/approve-payment', async (req, res) => {
  const { requestId, userId } = req.body;
  try {
    await pool.query('UPDATE users SET is_paid = true WHERE id = $1', [userId]);
    await pool.query('UPDATE payment_requests SET status = $1 WHERE id = $2', ['approved', requestId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- КАЛЬКУЛЯТОР (ИСТОРИЯ) ---
app.post('/api/calc-save', async (req, res) => {
  const { userId, buy_rate, sell_rate, amount, profit } = req.body;
  try {
    await pool.query('INSERT INTO calc_history (user_id, buy_rate, sell_rate, amount, profit) VALUES ($1, $2, $3, $4, $5)', [userId, buy_rate, sell_rate, amount, profit]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/calc-history/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calc_history WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
    res.json({ history: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));