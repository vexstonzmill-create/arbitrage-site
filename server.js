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
  ADMIN_TG_ID: 6938068102, // ✅ Твой ID вписан правильно, без "tg:"
  DATABASE_URL: 'postgresql://neondb_owner:npg_xN9OFsw6uCMe@ep-solitary-cloud-bahn17dh-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
};

const pool = new Pool({
  connectionString: CONFIG.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, username TEXT, display_name TEXT, avatar_url TEXT, role TEXT DEFAULT 'user', is_paid BOOLEAN DEFAULT false);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS articles (id SERIAL PRIMARY KEY, category TEXT, title TEXT, content TEXT, updated_at TIMESTAMPTZ DEFAULT now());`);
    
    const check = await pool.query('SELECT count(*) FROM articles');
    if (parseInt(check.rows[0].count) === 0) {
      console.log('Заполняем базу начальными статьями...');
      await pool.query(`
        INSERT INTO articles (category, title, content) VALUES 
        ('Мануалы', 'Банк ПСБ и Альфа 🏦', 'Самые стабильные банки — ПСБ и Альфа. 
— 4–5 платежей в день.
— Остаток на карте 2000–4000 рублей.
— Траты около 1500 рублей в день (аптеки, магазины).
— Прогрев 3–4 дня, потом 2 дня отлёга.
ПСБ блоки снимаются за 15 дней. Альфа — 14+ лет, запуск с 9 до 00.'),
        ('Связки', 'Связка Таиланд 🇹🇭', 'Ордер на покупку по 33 THB, лимит от 5000 THB. 
Создаётся ордер на продажу по 40 THB. 
30к/33 = 909 USDT. 30к/40 = 750 USDT. 
Разница ~159 USDT (13-14к руб) с одной сделки! 🚀'),
        ('Связки', 'Связка Bybit-HTX 📈', 'Мейкер на Bybit, Тейкер на HTX.
1. Объявление на Bybit на покупку по 80,6 ₽.
2. Сделка на HTX на продажу по 83,8 ₽.
3. Передаются реквизиты. Чистыми ~4-4.5%.
⚠️ HTX в санкционном списке!'),
        ('Термины', 'Словарь Арбитражника 📚', 'КА - Контрагент (постоянный клиент).
Ферма - 1-3 чека в сутки.
Агроферма - от 50 до 300к в сутки.
Гном - дроп (лицо, дающее карту).
Круг - работа с входящими и исходящими.
Стяг - переводы между своими счетами.
Прогрев - покупки для имитации реальной жизни.');
      `);
    }
    console.log('✅ База данных готова');
  } catch (e) { console.error('❌ Ошибка БД:', e.message); }
}
initDB();

function validateTelegramData(initData) {
  if (!initData) return false;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckString = Array.from(urlParams.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(CONFIG.BOT_TOKEN).digest();
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex') === hash;
}

app.post('/api/auth/telegram', async (req, res) => {
  const { initData } = req.body;
  if (!validateTelegramData(initData)) return res.status(401).json({ error: 'Invalid data' });
  const tgUser = JSON.parse(new URLSearchParams(initData).get('user'));
  const isAdmin = Number(tgUser.id) === Number(CONFIG.ADMIN_TG_ID);
  
  try {
    const result = await pool.query(`
      INSERT INTO users (id, username, display_name, avatar_url, role) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name 
      RETURNING *;
    `, [tgUser.id, tgUser.username || `user_${tgUser.id}`, tgUser.first_name || 'User', tgUser.photo_url || null, isAdmin ? 'admin' : 'user']);
    
    res.json({ token: 'token_' + tgUser.id, user: result.rows[0] });
  } catch (e) { 
    console.error('Auth error:', e);
    res.status(500).json({ error: 'Server error' }); 
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM articles ORDER BY updated_at DESC');
    res.json({ articles: result.rows });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/articles', async (req, res) => {
  const { category, title, content } = req.body;
  try {
    await pool.query('INSERT INTO articles (category, title, content) VALUES ($1, $2, $3)', [category, title, content]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/articles/:id', async (req, res) => {
  const { title, content } = req.body;
  try {
    await pool.query('UPDATE articles SET title = $1, content = $2, updated_at = now() WHERE id = $3', [title, content, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));