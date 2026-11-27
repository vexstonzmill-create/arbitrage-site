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
    // Основные таблицы
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, username TEXT, display_name TEXT, avatar_url TEXT, banner_url TEXT, role TEXT DEFAULT 'user', is_paid BOOLEAN DEFAULT false, is_blocked BOOLEAN DEFAULT false, goal_amount NUMERIC DEFAULT 0, start_capital NUMERIC DEFAULT 0, current_balance NUMERIC DEFAULT 0, goal_date DATE, goal_daily_rate NUMERIC DEFAULT 0, goal_mode TEXT DEFAULT 'rub');`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE, icon TEXT);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS articles (id SERIAL PRIMARY KEY, category TEXT, title TEXT, content TEXT, image_url TEXT, author_id BIGINT, price NUMERIC DEFAULT 0, status TEXT DEFAULT 'published', tier TEXT DEFAULT 'free', updated_at TIMESTAMPTZ DEFAULT now());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS payment_requests (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, status TEXT DEFAULT 'pending', requisites TEXT, created_at TIMESTAMPTZ DEFAULT now());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, type TEXT, amount NUMERIC, description TEXT, created_at TIMESTAMPTZ DEFAULT now());`);
    
    // Новые таблицы и колонки
    await pool.query(`CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, article_id INT REFERENCES articles(id) ON DELETE CASCADE, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, text TEXT, created_at TIMESTAMPTZ DEFAULT now());`);
    
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscribers INT DEFAULT 0;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscriptions INT DEFAULT 0;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0;`);

    const checkCats = await pool.query('SELECT count(*) FROM categories');
    if (parseInt(checkCats.rows[0].count) === 0) {
      await pool.query(`INSERT INTO categories (name, icon) VALUES ('Мануалы', '🏦'), ('Связки', '🔗'), ('Термины', '📚'), ('Безопасность', '🛡️'), ('Пользовательское', '👥');`);
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
    
    // При конфликте (если юзер уже есть) мы сохраняем его кастомную аватарку и имя, если они заданы
    const result = await pool.query(`
      INSERT INTO users (id, username, display_name, avatar_url, role, subscribers, subscriptions, likes) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      ON CONFLICT (id) DO UPDATE SET 
        username = EXCLUDED.username,
        display_name = COALESCE(users.display_name, EXCLUDED.display_name),
        avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url)
      RETURNING *;
    `, [tgUser.id, tgUser.username || `user_${tgUser.id}`, tgUser.first_name || 'User', tgUser.photo_url || null, isAdmin ? 'admin' : 'user', Math.floor(Math.random() * 500), Math.floor(Math.random() * 200), Math.floor(Math.random() * 1000)]);
    
    const user = result.rows[0];
    if (user.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });
    res.json({ token: 'token_' + tgUser.id, user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/profile', async (req, res) => {
  const { userId, display_name, avatar_url, banner_url } = req.body;
  try {
    await pool.query('UPDATE users SET display_name = $1, avatar_url = $2, banner_url = $3 WHERE id = $4', 
      [display_name, avatar_url, banner_url, userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/goal', async (req, res) => {
  const { userId, goal_amount, start_capital, current_balance, goal_date, goal_daily_rate, goal_mode } = req.body;
  try {
    await pool.query('UPDATE users SET goal_amount = $1, start_capital = $2, current_balance = $3, goal_date = $4, goal_daily_rate = $5, goal_mode = $6 WHERE id = $7', 
      [goal_amount, start_capital, current_balance, goal_date, goal_daily_rate, goal_mode, userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/update-balance', async (req, res) => {
  const { userId, amount } = req.body;
  try {
    await pool.query('UPDATE users SET current_balance = current_balance + $1 WHERE id = $2', [amount, userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/data', async (req, res) => {
  try {
    const cats = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    const arts = await pool.query("SELECT * FROM articles WHERE status = 'published' ORDER BY updated_at DESC");
    res.json({ categories: cats.rows, articles: arts.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- СТАТЬИ И КОММЕНТАРИИ ---
app.post('/api/articles', async (req, res) => {
  const { category, title, content, image_url, tier, author_id } = req.body;
  try {
    await pool.query("INSERT INTO articles (category, title, content, image_url, tier, status, author_id) VALUES ($1, $2, $3, $4, $5, 'published', $6)", 
      [category, title, content, image_url, tier || 'free', author_id || CONFIG.ADMIN_TG_ID]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/articles/:id', async (req, res) => {
  const { title, content, image_url, tier } = req.body;
  try {
    await pool.query('UPDATE articles SET title = $1, content = $2, image_url = $3, tier = $4, updated_at = now() WHERE id = $5', 
      [title, content, image_url, tier || 'free', req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/comments/:articleId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.display_name, u.avatar_url 
      FROM comments c JOIN users u ON c.user_id = u.id 
      WHERE c.article_id = $1 ORDER BY c.created_at ASC
    `, [req.params.articleId]);
    res.json({ comments: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/comments', async (req, res) => {
  const { article_id, user_id, text } = req.body;
  try {
    await pool.query('INSERT INTO comments (article_id, user_id, text) VALUES ($1, $2, $3)', [article_id, user_id, text]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/user/articles/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM articles WHERE author_id = $1 ORDER BY updated_at DESC', [req.params.userId]);
    res.json({ articles: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// --- ОПЛАТА И АДМИНКА ---
app.post('/api/payment-request', async (req, res) => {
  const { userId } = req.body;
  try {
    const check = await pool.query("SELECT * FROM payment_requests WHERE user_id = $1 AND status IN ('pending', 'requisites_sent')", [userId]);
    if (check.rows.length > 0) return res.json({ success: true });
    await pool.query("INSERT INTO payment_requests (user_id, status) VALUES ($1, 'pending')", [userId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/admin/payments', async (req, res) => {
  try {
    const result = await pool.query(`SELECT pr.*, u.display_name, u.username FROM payment_requests pr JOIN users u ON pr.user_id = u.id WHERE pr.status IN ('pending', 'paid', 'requisites_sent') ORDER BY pr.created_at DESC`);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));