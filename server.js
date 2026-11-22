const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const CONFIG = {
  BOT_TOKEN: '9049997738:AAGgB6hc5MBs7GdmcTLH7A3kREGvyaOpoxE',
  ADMIN_TG_ID: 6938068102, 
  DATABASE_URL: 'postgresql://neondb_owner:npg_xN9OFsw6uCMe@ep-solitary-cloud-bahn17dh-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
};

const pool = new Pool({ connectionString: CONFIG.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, username TEXT, display_name TEXT, avatar_url TEXT, role TEXT DEFAULT 'user', is_paid BOOLEAN DEFAULT false, is_blocked BOOLEAN DEFAULT false);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE, icon TEXT);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS articles (id SERIAL PRIMARY KEY, category TEXT, title TEXT, content TEXT, image_url TEXT, author_id BIGINT, price NUMERIC DEFAULT 0, status TEXT DEFAULT 'published', updated_at TIMESTAMPTZ DEFAULT now());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS payment_requests (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, status TEXT DEFAULT 'pending', requisites TEXT, created_at TIMESTAMPTZ DEFAULT now());`);
    
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
    const tgUser = JSON.parse(new URLSearchParams(initData).get('user'));
    const isAdmin = Number(tgUser.id) === Number(CONFIG.ADMIN_TG_ID);
    const result = await pool.query(`
      INSERT INTO users (id, username, display_name, avatar_url, role) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name 
      RETURNING *;
    `, [tgUser.id, tgUser.username || `user_${tgUser.id}`, tgUser.first_name || 'User', tgUser.photo_url || null, isAdmin ? 'admin' : 'user']);
    
    const user = result.rows[0];
    if (user.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });

    res.json({ token: 'token_' + tgUser.id, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data', async (req, res) => {
  try {
    const cats = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    const arts = await pool.query("SELECT * FROM articles WHERE status = 'published' ORDER BY updated_at DESC");
    res.json({ categories: cats.rows, articles: arts.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- ЮЗЕР: ОТПРАВКА СТАТЬИ ---
app.post('/api/articles/submit', async (req, res) => {
  const { userId, category, title, content, price } = req.body;
  try {
    await pool.query(
      "INSERT INTO articles (category, title, content, author_id, price, status) VALUES ($1, $2, $3, $4, $5, 'pending')", 
      [category, title, content, userId, price || 0]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- ОПЛАТА ---
app.post('/api/payment-request', async (req, res) => {
  const { userId } = req.body;
  try {
    const check = await pool.query("SELECT * FROM payment_requests WHERE user_id = $1 AND status IN ('pending', 'requisites_sent')", [userId]);
    if (check.rows.length > 0) return res.json({ success: true });
    await pool.query("INSERT INTO payment_requests (user_id, status) VALUES ($1, 'pending')", [userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/user/payment-status/:userId', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM payment_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [req.params.userId]);
    res.json({ request: result.rows[0] || null });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/user/payment-paid/:requestId', async (req, res) => {
  try {
    await pool.query("UPDATE payment_requests SET status = 'paid' WHERE id = $1", [req.params.requestId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- АДМИН: ЗАЯВКИ ---
app.get('/api/admin/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pr.*, u.display_name, u.username 
      FROM payment_requests pr JOIN users u ON pr.user_id = u.id
      WHERE pr.status IN ('pending', 'paid') ORDER BY pr.created_at DESC
    `);
    res.json({ requests: result.rows });
  } catch (e) { res.json({ requests: [] }); }
});

app.post('/api/admin/send-requisites', async (req, res) => {
  const { requestId, requisites } = req.body;
  try {
    await pool.query("UPDATE payment_requests SET status = 'requisites_sent', requisites = $1 WHERE id = $2", [requisites, requestId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/admin/approve-payment', async (req, res) => {
  const { requestId, userId } = req.body;
  try {
    await pool.query('UPDATE users SET is_paid = true WHERE id = $1', [userId]);
    await pool.query("UPDATE payment_requests SET status = 'completed' WHERE id = $1", [requestId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- АДМИН: ПОЛЬЗОВАТЕЛИ ---
app.get('/api/admin/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id DESC');
    res.json({ users: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/admin/users/toggle-paid', async (req, res) => {
  const { userId, isPaid } = req.body;
  try {
    await pool.query('UPDATE users SET is_paid = $1 WHERE id = $2', [isPaid, userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/admin/users/toggle-block', async (req, res) => {
  const { userId, isBlocked } = req.body;
  try {
    await pool.query('UPDATE users SET is_blocked = $1 WHERE id = $2', [isBlocked, userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- АДМИН: МОДЕРАЦИЯ СТАТЕЙ ---
app.get('/api/admin/moderation', async (req, res) => {
  try {
    const result = await pool.query("SELECT a.*, u.display_name as author_name FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE a.status = 'pending'");
    res.json({ articles: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/admin/moderate', async (req, res) => {
  const { articleId, action } = req.body; // action: 'approve' or 'reject'
  try {
    if (action === 'approve') {
      await pool.query("UPDATE articles SET status = 'published' WHERE id = $1", [articleId]);
    } else {
      await pool.query("DELETE FROM articles WHERE id = $1", [articleId]); // Reject = delete for simplicity
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- БАЗОВЫЕ СТАТЬИ АДМИНА ---
app.post('/api/articles', async (req, res) => {
  const { category, title, content, image_url } = req.body;
  try {
    await pool.query("INSERT INTO articles (category, title, content, image_url, status) VALUES ($1, $2, $3, $4, 'published')", [category, title, content, image_url]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));