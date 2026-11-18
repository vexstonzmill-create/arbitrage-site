const API_URL = window.location.origin;
let state = { user: null, articles: [], currentCategory: null, currentArticle: null };
let tg = window.Telegram?.WebApp;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (tg) { tg.ready(); tg.expand(); }
    
    // Убираем лоадер через 500мс
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);

    await authUser();
    await loadArticles();
});

// Авторизация через ТГ
async function authUser() {
    if (tg && tg.initData) {
        try {
            const res = await fetch(`${API_URL}/api/auth/telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });
            const data = await res.json();
            if (res.ok) {
                state.user = data.user;
                localStorage.setItem('token', data.token);
                updateUIForUser();
            }
        } catch(e) { console.error('Auth error', e); }
    } else {
        // Если открыто в браузере (для тестов), создаем фейкового админа
        state.user = { displayName: 'Гость (Браузер)', role: 'admin', avatarUrl: null };
        updateUIForUser();
    }
}

// Обновляем шапку под юзера
function updateUIForUser() {
    if (!state.user) return;
    document.getElementById('userName').textContent = state.user.displayName;
    
    const av = document.getElementById('userAvatar');
    if (state.user.avatarUrl) {
        av.innerHTML = `<img src="${state.user.avatarUrl}">`;
    } else {
        av.textContent = state.user.displayName[0].toUpperCase();
    }

    // Показываем кнопки админа
    if (state.user.role === 'admin') {
        document.getElementById('adminAddBtn').style.display = 'flex';
    }
}

// Загрузка статей
async function loadArticles() {
    try {
        const res = await fetch(`${API_URL}/api/articles`);
        const data = await res.json();
        state.articles = data.articles || [];
        renderCategories();
    } catch(e) { console.error('Load error', e); }
}

// Рендер главного экрана с категориями
function renderCategories() {
    // Собираем уникальные категории
    const categories = [...new Set(state.articles.map(a => a.category))];
    const grid = document.getElementById('categoriesGrid');
    
    const icons = { 'Мануалы': '🏦', 'Связки': '🔗', 'Термины': '📚', 'Безопасность': '🛡️' };
    const classes = ['g1', 'g2', 'g3', 'g4'];

    grid.innerHTML = categories.map((cat, i) => {
        const count = state.articles.filter(a => a.category === cat).length;
        return `
        <div class="cat-card ${classes[i % 4]}" onclick="openCategory('${cat}')">
            <div class="icon">${icons[cat] || '📄'}</div>
            <div>
                <h4>${cat}</h4>
                <span>${count} статей</span>
            </div>
        </div>
        `;
    }).join('');
}

// Открытие категории (список статей)
window.openCategory = (cat) => {
    state.currentCategory = cat;
    document.getElementById('categoryTitle').textContent = cat;
    
    const list = document.getElementById('articlesList');
    const filtered = state.articles.filter(a => a.category === cat);
    
    list.innerHTML = filtered.map(art => `
        <div class="article-item" onclick="openArticle(${art.id})">
            <div>
                <h4>${art.title}</h4>
                <div class="date">Обновлено: ${new Date(art.updated_at).toLocaleDateString('ru-RU')}</div>
            </div>
            <div class="arrow">›</div>
        </div>
    `).join('');

    show('category');
};

// Открытие статьи
window.openArticle = (id) => {
    const art = state.articles.find(a => a.id === id);
    if (!art) return;
    state.currentArticle = art;

    document.getElementById('articleTitle').textContent = art.title;
    document.getElementById('articleDate').textContent = `Обновлено: ${new Date(art.updated_at).toLocaleString('ru-RU')}`;
    document.getElementById('articleText').textContent = art.content;

    // Если админ, показываем кнопку редактирования
    if (state.user && state.user.role === 'admin') {
        document.getElementById('adminEditBtn').style.display = 'flex';
    } else {
        document.getElementById('adminEditBtn').style.display = 'none';
    }

    show('article');
};

window.backToCategory = () => {
    openCategory(state.currentCategory);
};

// Навигация экранов
window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    window.scrollTo(0, 0);
};

// --- АДМИНКА: Редактирование ---

window.openEditModal = (isEdit = false) => {
    const modal = document.getElementById('editModal');
    const titleInput = document.getElementById('editTitle');
    const contentInput = document.getElementById('editContent');
    const modalTitle = document.getElementById('modalTitle');

    if (isEdit && state.currentArticle) {
        modalTitle.textContent = 'Редактировать статью';
        titleInput.value = state.currentArticle.title;
        contentInput.value = state.currentArticle.content;
    } else {
        modalTitle.textContent = `Новая статья в "${state.currentCategory}"`;
        titleInput.value = '';
        contentInput.value = '';
    }
    
    modal.classList.add('active');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
};

window.saveArticle = async () => {
    const title = document.getElementById('editTitle').value.trim();
    const content = document.getElementById('editContent').value.trim();
    if (!title || !content) return alert('Заполните все поля!');

    const isEdit = !!state.currentArticle;
    const url = isEdit ? `${API_URL}/api/articles/${state.currentArticle.id}` : `${API_URL}/api/articles`;
    const method = isEdit ? 'PUT' : 'POST';
    
    const payload = { title, content };
    if (!isEdit) payload.category = state.currentCategory;

    try {
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        closeModal('editModal');
        await loadArticles(); // Перезагружаем данные
        
        if (isEdit) {
            // Обновляем текущую открытую статью
            const updatedArt = state.articles.find(a => a.id === state.currentArticle.id);
            if (updatedArt) openArticle(updatedArt.id);
        } else {
            // Возвращаемся в категорию
            openCategory(state.currentCategory);
        }
    } catch(e) { alert('Ошибка сохранения'); }
};м отлегу 24 часа.`
    },
    {
        category: "Банки",
        title: "Мануал Т-Банк",
        content: `1. Включаемся от 10 000₽ по СБП.
2. Интервал от 20 минут.
3. Принимаем ровно 6 платежей.
4. Далее включаемся также от 10 000₽, только по С2С.
5. Принимаем 2 платежа с таким же интервалом, от 20 минут.
6. Снимаемся в банкомате Т-Банка по 30 000 - 40 000₽.
7. Если нет возможности работать в нал – откупаемся на Тиньк-Тиньк.
8. Время работы с 10:00 до 20:00 по местному времени, в выходные даем карте отдохнуть (5/2).
9. На ночь оставляем ~3 000₽. Сохраняем порядок действий.

Подготовка: Дроп 16+, лучше 18+. Не делаем перевязы, работаем строго с родного устройства. Греем перед работой 1 день, вносим наличные через банкомат.`
    },
    {
        category: "Банки",
        title: "ТОП 5 банков по оборотам",
        content: `1. СБЕРБАНК: Обороты 5 000–35 000$, срок 1–6 месяцев. Высокий уровень надежности, но повышенный контроль. В ряде случаев блокировки сопровождаются быстрым рассмотрением запросов на вывод.
2. ОТП БАНК: 7 000–20 000$, 1–3 месяца. Чувствителен к изменению финансового поведения. Периодически проводятся массовые проверки.
3. Т БАНК: 10 000–20 000$, 2–5 месяцев. Удобная система ДБО. При ограничениях возможно как дистанционное, так и очное урегулирование.
4. OZON БАНК: 5 000–30 000$, до 4 месяцев. Высокая скорость обработки, но автоматические системы мониторинга.
5. РЕНЕССАНС: до 25 000$, 3–5 месяцев. Традиционная модель, при отклонениях возможны доп. проверки.`
    },
    {
        category: "Банки",
        title: "Банкоматы и снятие",
        content: `Список банков и подходящих для них банкоматов партнеров (без комиссии и с меньшим риском блока):
АЛЬФА-БАНК: БКС, Россельхозбанк, Газпромбанк, Почта Банк, Открытие, Росбанк, ПСБ.
РОСБАНК: Россельхозбанк, Газпромбанк, Альфа-Банк, Райффайзен, Уралсиб, Ак Барс.
ГАЗПРОМ: Райффайзен, Альфа-Банк, Открытие, Росбанк, ПСБ.
УРАЛСИБ: Райффайзен, Альфа-Банк, Открытие, Росбанк, ВТБ.
ОТП: Банк Россия, Альфа-Банк, Сбербанк, ВТБ.
СБЕРБАНК: Россельхозбанк, Альфа-Банк, Свой Банк, Юнистрим, ВТБ, Левобережный.
Т-БАНК: Почта Банк, Открытие, ВТБ.
ВТБ: Озон банк, Почта Банк.
РАЙФАЙЗЕН: МТС, МКБ, Совком, Убрир.`
    },
    {
        category: "Связки",
        title: "Обменник + Постоянные контрагенты",
        content: `1. С КАРТАМИ:
Берём наличные, например 12 000 ₽, и идём в обменник. Покупаем USDT по курсу 80 ₽ (12 000 / 80 = 150 USDT). Ищем покупателей (постоянников), которые берут по 85–88 ₽. 150 × 85 = 12 750 ₽. Прибыль с круга: +750 ₽. Получили деньги на карту -> сняли -> повторили. 3 круга = ~2250 ₽.

2. БЕЗ КАРТ:
Находим постоянного контрагента с курсом 88–91 ₽. Покупаем доступ к обменнику (15–40$). Создаёте приватный ордер на покупку по 87 ₽. Находится продавец -> вы даёте реквизиты постоянника -> перевод проходит напрямую. Итог: 12 000 / 87 = 137.93 USDT. 137.93 × 90 = 12 413 ₽. Прибыль: ~413 ₽.
Работать в активное время. Ордеры закрываются быстро (5–10 мин). Всегда проверяйте чеки.`
    },
    {
        category: "Связки",
        title: "Связка Bybit-HTX",
        content: `Мейкер на Bybit, Тейкер на HTX.
1. Размещается объявление на Bybit на покупку по 80,6 ₽ (лимит 25 000–40 000).
2. На HTX открывается сделка на продажу в режиме тейкера с лимитом 25 000 ₽, оплата СБП (курс например 83,8 ₽).
3. Передаются реквизиты контрагента с Bybit стороне на HTX. Перевод 30–40 минут.
Расчёт: 38 000 ₽ / 80,6 = ~471 USDT. Продажа по 83,8 = ~39 700 ₽. Чистыми ~1700 ₽ (4-4.5%).
HTX в списке санкционных бирж. НЕ ПЕРЕВОДИТЕ С НЕЕ НА БАЙБИТ МОНЕТУ!`
    },
    {
        category: "Связки",
        title: "Связки без карт (Таджикистан, Тай, Грузия)",
        content: `ТАДЖИКИСТАН: Требуется карта Тинькофф и Таджикистана. Ордер на продажу USDT по 81 (получаем рубли на Тбанк). На таджикской карте делаем запрос на получение перевода из Тбанка (получаем сомони). Создаем ордер на покупку USDT по 9 сомони. Спред 4-5%.

ТАИЛАНД (HTX): Ордер на покупку по 33 THB, лимит от 5 000 THB (перевод от 3 лиц). Приходит ордер на 30 000 THB. Создаётся ордер на продажу по 40 THB. Передаются реквизиты. 30к/33 = 909 USDT. 30к/40 = 750 USDT. Разница ~159 USDT (13-14к руб).

ГРУЗИЯ: Биржи Bybit (основная) и HTX. Спред 2-4%. Банки: TBC, BoG, Credo, Liberty. Работа через белый треугольник.`
    },
    {
        category: "Связки",
        title: "Связки с TG Wallet и MEXC",
        content: `TG WALLET + BYBIT: Нужна верификация. В левом стакане Bybit ищем объявления на ровную сумму по низкому курсу. Заходим, берем реквизиты. Выставляем ордер в TG Wallet на продажу и даем реквизиты с байбита. Спред 4-8%.

СВЯЗКА БЕЗ КАРТ (На TON): Покупаем TON на споте, переводим на tg wallet, выставляем на продажу. В правый стакан Bybit/HTX ставим ордер на покупку USDT с оплатой СБП от 3 лиц. Пересылаем чеки из TG Wallet контрагенту.

MEXC / BYBIT: Покупаете USDT на MEXC по 80/82₽ (можно с любой карты). Скидываете на BYBIT. Продаете по 92/93 (постоянникам). Спред 11/12%.`
    },
    {
        category: "Байбит",
        title: "За что прилетает блокировка Т+1",
        content: `1. Отправка PDF-файла или более одного изображения.
2. Отправка видео.
3. Длительное выполнение ордера.
4. Большое количество сообщений в чате.
5. Крупная сумма операции.
6. Аккаунт с повышенным уровнем риска (новый, неактивный, с жалобами).`
    },
    {
        category: "Байбит",
        title: "Как убрать запрос Google Authenticator",
        content: `1. Открыть настройки телефона.
2. Перейти в раздел “Приложения”.
3. Найти приложение Bybit.
4. Открыть настройки вставки из других приложений.
5. Выбрать опцию “Разрешить”.`
    },
    {
        category: "Байбит",
        title: "Удаление негативного отзыва",
        content: `Работает только при отсутствии нарушений.
1. Перейти в справочный центр Bybit -> Раздел: P2P торговля -> Удаление отрицательных отзывов.
2. Указать UID аккаунта, номер ордера, скриншот ордера, краткое пояснение.
3. Если указано “грубость” — приложить переписку. Если “медленный” — указать, что оплата была вовремя. Если задержка из-за банка — приложить подтверждение.
4. Отправить запрос (ответ обычно в течение недели). Финальное решение — 2-3 дня.`
    },
    {
        category: "Байбит",
        title: "Как получить мейкера на HTX",
        content: `Нужно выполнить 1 из 3 требований:
1. 50 ордеров с 25 контрагентами как тейкер за последние 30 дней с оборотом 300к рублей.
2. Опыт торговли на других площадках (доказательства оборота от 500 000 USD).
3. Податься на верифицированного мерчанта и заморозить 500 USDT в страховом депозите (можно с нулевым аккаунтом).
Для торговли нужен уровень верификации L3. Администрация может отказать без объяснения причин.`
    },
    {
        category: "Безопасность",
        title: "Почему карты попадают под блокировку",
        content: `1. Неправильный или слишком короткий “прогрев” (минимум 4–5 дней покупок).
2. Проведение или принятие платежей в несколько частей (лучше 1–2 перевода).
3. Резкое прекращение активности после прогрева.
4. Слишком частые переводы зарубеж.
5. Отправка несохраненным контактам (перед отправкой сохраняйте номер любой буквой русского алфавита).`
    },
    {
        category: "Безопасность",
        title: "Как себя обезопасить без карт",
        content: `1. Выбирайте контрагента внимательно (плохая статистика/отзывы = отказ).
2. Всегда запрашивайте чек в PDF и фиксируйте это в условиях.
3. Не работайте с людьми без доступа к личному кабинету банка.
4. Требования: высокий процент завершённых сделок (от 80%) и 10–20+ операций.
5. При долгих ордерах запрашивайте видеоподтверждение входа в ЛК банка и истории.
6. Выстраивайте долгосрочные отношения с проверенными КА.`
    },
    {
        category: "Безопасность",
        title: "Мошенничество: Бутер и Скам с почтой",
        content: `НИКОГДА не работайте мейкер + мейкер на нулевом аккаунте. Не выставляйте одновременно ордера на покупку и продажу.

СКАМ ЧЕРЕЗ ПРИВАТНЫЙ ОРДЕР / ПОЧТУ:
Мошенник кидает ссылку на ордер и свою почту, просит отправить её в ордер (якобы для клиента). Клиент переводит по почте, вы не получаете деньги, а мошенник забирает их.
ЗАПОМНИТЕ: Невозможно перевести деньги с карты Bybit на банковский кошелек. Если кто-то говорит, что использует карту Bybit — это 100% скам.

ЕСЛИ СРЕДСТВА НА БАЛАНСЕ, НО ИХ НЕЛЬЗЯ ПРОДАТЬ:
Проверьте активы. Если отображается “используются” и нет апелляций или Т+1, нужно подождать 2–5 часов (часто бывает после отмены ордера).`
    },
    {
        category: "Безопасность",
        title: "Как выигрывать апелляции",
        content: `Частые ошибки: неподходящие скрины, фейковые выписки (в 98% запросят видео).

ПЕРЕВОД НЕ НА ТОТ БАНК: Почти гарантированная потеря. Не тяните время. Стратегия: нарисовать видео, что на указанный банк платеж не поступал. Биржа закроет сделку в вашу пользу.

СДЕЛКИ НЕСКОЛЬКИМИ ПЛАТЕЖАМИ: КАТЕГОРИЧЕСКИ НЕ РЕКОМЕНДУЕТСЯ выдумывать данные или подделывать видео с "единым переводом". Это легко проверяется — бан аккаунта и потеря средств.`
    },
    {
        category: "Безопасность",
        title: "115-ФЗ, УКБО и 161-ФЗ (Блокировки)",
        content: `ВЫВОД ИЗ УКБО (7.3.9):
1. Скачать заявление, заполнить, распечатать, подписать в 2 экз.
2. Нужен счет в другом банке (на 3 лица не выводят).
3. Копии паспорта (главная и прописка), нотариально заверить.
4. Отправка СДЭКом/Почтой России от имени владельца счета: 127287, г.Москва, ул.Хуторская 2-я, д.38А, стр. 26.

СНЯТИЕ ОГРАНИЧЕНИЙ 115-ФЗ:
1. Предоставить банку скрины сделок, комментарии, источник средств.
2. При отказе — жалоба в ЦБ через интернет-приемную.
3. ЦБ направляет запрос в банк (ответ до 15-25 дней). Далее повторное рассмотрение.

161-ФЗ:
Узнать, какой банк инициировал блокировку. Направить в СБ банка выписки, скрины сделок, подтверждение P2P. Если отказ — жалоба в ЦБ.`
    },
    {
        category: "Термины",
        title: "Словарь Арбитражника",
        content: `КА - Контрагент (постоянный клиент).
Ферма - вид работы, в котором осуществляется прием в 1-3 чека в сутки и имитация реального пользования.
Агроферма - то же самое, но прием от 50 до 300к в сутки.
Материал - карта, симка, которые вы используете в работе.
Гномовод - поставщик материала.
Гном - дроп (лицо), которое дает вам материал (карту или сим).
Площадка - платежная система для обработки платежей и получения %.
Страховой депозит - средства, замораживаемые на площадке от скама.
Рабочий депозит - оборотные средства для приема/отправки.
СБ - Служба безопасности.
187 УК РФ - Приобретение/передача электронного средства платежа (до 6 лет).
Откуп, выплата, выход - отправка денежных средств после приема.
Круг - работа с входящими и исходящими платежами.
Трейдер - лицо, обрабатывающее платежи.
Сушка, залив - частое поступление платежей (1-2 кк в сутки).
Цупис - букмекерский кошелек.
Госки - материал на чьи-то госуслуги.
Процессинг - обработка платежей.
Гембла - платежи с казино.
Обмен - обмен физических рублей на юсдт.
Обнал - обналичивание (ИП, ООО).
Темщик - ищет схемы заработка.
Компра, Укбо - блокировка из-за передачи ЭСП 3-им лицам.
Лимит - максимальная точка.
Стяг - переводы между своими счетами.
Донор - вторая карта гнома для работы в стяг.
Пластик - пластиковая карта.
Пик - использование пластика в магазинах.
Прогрев - покупки для имитации реальной жизни.
Репро банк - банк, который живет 100 кк за год по лимитам.`
    }
];

const API_URL = window.location.origin;

const API = {
    token: () => localStorage.getItem('vexo_token'),
    user: () => { try { return JSON.parse(localStorage.getItem('vexo_user')); } catch { return null; } },
    async req(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token()) headers.Authorization = 'Bearer ' + this.token();
        const res = await fetch(API_URL + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Error');
        return data;
    }
};

function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// Тема
let currentTheme = localStorage.getItem('vexo_theme') || 'light';
document.body.setAttribute('data-theme', currentTheme);
window.toggleTheme = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('vexo_theme', currentTheme);
};

// Рендер Базы Знаний
let currentCategory = 'all';
window.setCategory = (cat, el) => {
    document.querySelectorAll('#kbCategories .icon-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    currentCategory = cat;
    renderKB();
};

window.showCategory = (cat) => {
    const chip = document.querySelector(`#kbCategories .icon-chip[data-cat="${cat}"]`);
    if (chip) {
        setCategory(cat, chip);
        window.scrollTo({ top: 200, behavior: 'smooth' });
    }
};

function renderKB() {
    const container = document.getElementById('kbContent');
    if (!container) return;
    
    const searchEl = document.getElementById('searchInput');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    let filtered = currentCategory === 'all' ? KB_DATA : KB_DATA.filter(k => k.category === currentCategory);
    if (search) {
        filtered = filtered.filter(k => k.title.toLowerCase().includes(search) || k.content.toLowerCase().includes(search));
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
        return;
    }

    container.innerHTML = filtered.map(k => `
        <div class="glass-card">
            <div class="badge-cat">${k.category}</div>
            <h3>${k.title}</h3>
            <p style="white-space: pre-wrap;">${k.content}</p>
        </div>
    `).join('');
}

// Калькулятор
window.calculateP2P = () => {
    const buy = parseFloat(document.getElementById('calcBuy')?.value) || 0;
    const sell = parseFloat(document.getElementById('calcSell')?.value) || 0;
    const amount = parseFloat(document.getElementById('calcAmount')?.value) || 0;

    const resSpread = document.getElementById('resSpread');
    const resProfit = document.getElementById('resProfit');
    if (!resSpread || !resProfit) return;

    if (!buy || !sell || !amount) {
        resSpread.textContent = '0 ₽ (0%)';
        resProfit.textContent = '0 ₽';
        return;
    }

    const spread = sell - buy;
    const spreadPct = (spread / buy) * 100;
    const profit = (amount / buy) * spread;

    resSpread.textContent = `${spread.toFixed(2)} ₽ (${spreadPct.toFixed(2)}%)`;
    resProfit.textContent = `${profit.toFixed(2)} ₽`;
};

// Авторизация
function initAuthButtons() {
    const tgBtn = document.getElementById('tgLoginBtn');
    if (tgBtn) {
        tgBtn.onclick = async () => {
            if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
                return toast('Откройте через бота в Telegram', 'error');
            }
            try {
                const res = await API.req('POST', '/auth/telegram', { initData: window.Telegram.WebApp.initData });
                localStorage.setItem('vexo_token', res.token);
                localStorage.setItem('vexo_user', JSON.stringify(res.user));
                document.getElementById('authModal')?.classList.remove('active');
                updateAuthUI();
                renderProfile();
                toast('Вход выполнен!', 'success');
            } catch(e) { toast('Ошибка входа: ' + e.message, 'error'); }
        };
    }

    const emailBtn = document.getElementById('emailLoginBtn');
    if (emailBtn) {
        emailBtn.onclick = async () => {
            const login = document.getElementById('loginInput')?.value;
            const password = document.getElementById('passInput')?.value;
            try {
                const res = await API.req('POST', '/auth/login', { login, password });
                localStorage.setItem('vexo_token', res.token);
                localStorage.setItem('vexo_user', JSON.stringify(res.user));
                document.getElementById('authModal')?.classList.remove('active');
                updateAuthUI();
                renderProfile();
                toast('Вход выполнен!', 'success');
            } catch(e) { toast('Неверный логин или пароль', 'error'); }
        };
    }
}

function updateAuthUI() {
    const u = API.user();
    const adminBtn = document.getElementById('adminBnBtn');
    if (adminBtn) {
        if (u && u.role === 'admin') adminBtn.style.display = 'flex';
        else adminBtn.style.display = 'none';
    }
}

async function renderProfile() {
    const container = document.getElementById('profileContent');
    if (!container) return;
    let u = API.user();
    
    if (!u) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 40px; margin-bottom: 16px;">🔒</div>
                <p style="margin-bottom: 16px;">Войдите, чтобы получить доступ</p>
                <button class="btn btn-primary" onclick="document.getElementById('authModal').classList.add('active')">Войти</button>
            </div>
        `;
        return;
    }

    try {
        const res = await API.req('GET', '/users/me');
        localStorage.setItem('vexo_user', JSON.stringify(res.user));
        u = res.user;
    } catch(e) {}

    const isPaid = u.isPaid || u.role === 'admin';

    container.innerHTML = `
        <div class="glass-card" style="display:flex; align-items:center; gap:16px;">
            <div class="avatar lg" style="width:60px;height:60px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;">
                ${u.displayName[0].toUpperCase()}
            </div>
            <div>
                <h2 style="font-size:20px;font-weight:800;">${u.displayName}</h2>
                <div style="font-size:14px;color:var(--dim);">@${u.username}</div>
            </div>
        </div>

        <div class="glass-card" style="text-align: center; padding: 24px;">
            <h3 style="margin-bottom: 12px;">Статус доступа</h3>
            <div style="font-size: 24px; font-weight: 900; color: ${isPaid ? 'var(--grn)' : 'var(--red)'}; margin-bottom: 16px;">
                ${isPaid ? 'ОПЛАЧЕНО' : 'ЗАКРЫТ'}
            </div>
            ${!isPaid ? `
                <p style="font-size: 14px; color: var(--dim); margin-bottom: 16px;">Отправьте заявку на покупку доступа. Админ подтвердит оплату и откроет базу.</p>
                <button class="btn btn-primary btn-block" onclick="requestAccess()">Купить доступ (30$)</button>
            ` : `
                <p style="font-size: 14px; color: var(--grn);">Вам доступны все материалы!</p>
            `}
        </div>

        <button class="btn btn-block" style="margin-top: 24px; color: var(--red); border-color: var(--red);" onclick="localStorage.clear(); location.reload();">Выйти</button>
    `;
}

window.requestAccess = async () => {
    const u = API.user();
    if (!u) return;
    try {
        await API.req('POST', '/requests/access', { userId: u.id, userName: u.username });
        toast('Заявка отправлена админу!', 'success');
    } catch(e) { toast('Ошибка отправки', 'error'); }
};

async function renderAdmin() {
    const container = document.getElementById('adminRequestsList');
    if (!container) return;
    try {
        const { requests } = await API.req('GET', '/admin/requests');
        if (!requests.length) {
            container.innerHTML = '<div class="empty-state">Нет активных заявок</div>';
            return;
        }
        
        container.innerHTML = requests.map(r => `
            <div class="glass-card" style="padding: 16px; margin-bottom: 12px;">
                <div style="font-weight: 800; margin-bottom: 4px;">@${r.username} (ID: ${r.user_id})</div>
                <div style="font-size: 12px; color: var(--dim); margin-bottom: 12px;">${new Date(r.created_at).toLocaleString('ru-RU')}</div>
                <button class="btn btn-primary btn-block" onclick="approveUser(${r.user_id})">Одобрить</button>
            </div>
        `).join('');
    } catch(e) { container.innerHTML = '<div class="empty-state">Ошибка загрузки</div>'; }
}

window.approveUser = async (userId) => {
    try {
        await API.req('POST', '/admin/approve', { userId });
        toast('Доступ выдан!', 'success');
        renderAdmin();
    } catch(e) { toast('Ошибка', 'error'); }
};

window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId)?.classList.add('active');
    
    document.querySelectorAll('.bn-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.bn-btn[data-screen="${screenId}"]`)?.classList.add('active');

    if (screenId === 'profile') renderProfile();
    if (screenId === 'admin') renderAdmin();
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const l = document.getElementById('loader');
        if (l) l.classList.add('hidden-loader');
    }, 800);

    renderKB();
    initAuthButtons();
    updateAuthUI();
    
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        document.getElementById('tgLoginBtn')?.click();
    }
});