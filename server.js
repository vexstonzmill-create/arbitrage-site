const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ================= НАСТРОЙКИ =================
const CONFIG = {
  BOT_TOKEN: '9049997738:AAGgB6hc5MBs7GdmcTLH7A3kREGvyaOpoxE', // Твой токен бота
  ADMIN_TG_ID: 123456789, // ВСТАВЬ СВОЙ TG ID (узнать у @userinfobot)
  DATABASE_URL: 'postgresql://neondb_owner:npg_xN9OFsw6uCMe@ep-solitary-cloud-bahn17dh-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
};
// ============================================

const pool = new Pool({
  connectionString: CONFIG.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создаем таблицы при старте, если их нет
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username TEXT,
        display_name TEXT,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        is_paid BOOLEAN DEFAULT false
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_requests (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id)
      );
    `);
    console.log('✅ База данных инициализирована (таблицы готовы)');
  } catch (e) {
    console.error('❌ Ошибка инициализации БД:', e.message);
  }
}
initDB();

// Валидация Telegram
function validateTelegramData(initData) {
  if (!initData) return false;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(CONFIG.BOT_TOKEN).digest();
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex') === hash;
}

// 1. Авторизация через Telegram
app.post('/api/auth/telegram', async (req, res) => {
  const { initData } = req.body;
  if (!validateTelegramData(initData)) return res.status(401).json({ error: 'Invalid data' });

  const tgUser = JSON.parse(new URLSearchParams(initData).get('user'));
  const isAdmin = Number(tgUser.id) === Number(CONFIG.ADMIN_TG_ID);

  try {
    // Вставляем или обновляем пользователя
    const upsertQuery = `
      INSERT INTO users (id, username, display_name, avatar_url, role) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (id) DO UPDATE SET 
        username = EXCLUDED.username, 
        display_name = EXCLUDED.display_name, 
        avatar_url = EXCLUDED.avatar_url,
        role = CASE WHEN users.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END
      RETURNING *;
    `;
    const role = isAdmin ? 'admin' : 'user';
    const result = await pool.query(upsertQuery, [
      tgUser.id, 
      tgUser.username || `user_${tgUser.id}`, 
      tgUser.first_name || 'User', 
      tgUser.photo_url || null,
      role
    ]);
    
    const user = result.rows[0];
    res.json({ token: 'mock_token_' + user.id, user: mapUser(user) });
  } catch (e) {
    console.error('Auth Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Обычная авторизация (для браузера)
app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  if (login === 'admin' && password === 'admin') {
    try {
      const result = await pool.query(`
        INSERT INTO users (id, username, display_name, role, is_paid) 
        VALUES ($1, 'admin', 'Admin', 'admin', true) 
        ON CONFLICT (id) DO UPDATE SET role = 'admin', is_paid = true
        RETURNING *;
      `, [CONFIG.ADMIN_TG_ID]);
      res.json({ token: 'mock_token_' + CONFIG.ADMIN_TG_ID, user: mapUser(result.rows[0]) });
    } catch(e) { res.status(500).json({ error: 'DB error' }); }
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// 3. Создание заявки на доступ
app.post('/api/requests/access', async (req, res) => {
  const { userId } = req.body;
  try {
    await pool.query(
      'INSERT INTO access_requests (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Error creating request' }); }
});

// 4. Получить заявки (для админа)
app.get('/api/admin/requests', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ar.user_id, ar.created_at, u.username, u.display_name 
      FROM access_requests ar
      JOIN users u ON ar.user_id = u.id
      ORDER BY ar.created_at DESC
    `);
    res.json({ requests: result.rows });
  } catch(e) { res.status(500).json({ error: 'DB error' }); }
});

// 5. Одобрить заявку (для админа)
app.post('/api/admin/approve', async (req, res) => {
  const { userId } = req.body;
  try {
    // Выдаем доступ
    await pool.query('UPDATE users SET is_paid = true WHERE id = $1', [userId]);
    // Удаляем заявку
    await pool.query('DELETE FROM access_requests WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'DB error' }); }
});

// 6. Проверка профиля
app.get('/api/users/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = parseInt(token?.replace('mock_token_', ''));
  
  if (!userId || isNaN(userId)) return res.json({ user: { id: 0, role: 'guest', isPaid: false } });

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.json({ user: { id: 0, role: 'guest', isPaid: false } });
    res.json({ user: mapUser(result.rows[0]) });
  } catch(e) { res.status(500).json({ error: 'DB error' }); }
});

// Маппер для фронтенда (чтобы поля совпадали с app.js)
function mapUser(dbUser) {
  return {
    id: Number(dbUser.id),
    username: dbUser.username,
    displayName: dbUser.display_name,
    avatarUrl: dbUser.avatar_url,
    role: dbUser.role,
    isPaid: dbUser.is_paid
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`vxo Backend running on port ${PORT}`));