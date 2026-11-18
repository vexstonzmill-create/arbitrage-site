const API_URL = window.location.origin;
let state = { user: null, articles: [], currentCategory: null, currentArticle: null };
let tg = window.Telegram?.WebApp;

document.addEventListener('DOMContentLoaded', async () => {
    if (tg) { tg.ready(); tg.expand(); }
    
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 500);

    await authUser();
    await loadArticles();
});

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
        // Фейковый админ для теста в браузере
        state.user = { displayName: 'Гость', role: 'admin', avatarUrl: null };
        updateUIForUser();
    }
}

function updateUIForUser() {
    if (!state.user) return;
    document.getElementById('userName').textContent = state.user.display_name || state.user.displayName || 'Пользователь';
    
    const av = document.getElementById('userAvatar');
    if (state.user.avatar_url || state.user.avatarUrl) {
        av.innerHTML = `<img src="${state.user.avatar_url || state.user.avatarUrl}">`;
    } else {
        const name = state.user.display_name || state.user.displayName || 'U';
        av.textContent = name[0].toUpperCase();
    }

    if (state.user.role === 'admin') {
        document.getElementById('adminAddBtn').style.display = 'flex';
    }
}

async function loadArticles() {
    try {
        const res = await fetch(`${API_URL}/api/articles`);
        const data = await res.json();
        state.articles = data.articles || [];
        renderCategories();
    } catch(e) { console.error('Load error', e); }
}

function renderCategories() {
    const categories = [...new Set(state.articles.map(a => a.category))];
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    
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

window.openArticle = (id) => {
    const art = state.articles.find(a => a.id === id);
    if (!art) return;
    state.currentArticle = art;

    document.getElementById('articleTitle').textContent = art.title;
    document.getElementById('articleDate').textContent = `Обновлено: ${new Date(art.updated_at).toLocaleString('ru-RU')}`;
    document.getElementById('articleText').textContent = art.content;

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

window.show = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    window.scrollTo(0, 0);
};

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
        await loadArticles();
        
        if (isEdit) {
            const updatedArt = state.articles.find(a => a.id === state.currentArticle.id);
            if (updatedArt) openArticle(updatedArt.id);
        } else {
            openCategory(state.currentCategory);
        }
    } catch(e) { alert('Ошибка сохранения'); }
};