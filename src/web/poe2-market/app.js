const token = new URLSearchParams(window.location.search).get('token') || '';
const state = {
    session: null,
    category: 'Currency',
    selected: new Set()
};

const elements = {
    loadingView: document.querySelector('#loadingView'),
    errorView: document.querySelector('#errorView'),
    errorText: document.querySelector('#errorText'),
    settingsForm: document.querySelector('#settingsForm'),
    leagueBadge: document.querySelector('#leagueBadge'),
    categoryTabs: document.querySelector('#categoryTabs'),
    searchInput: document.querySelector('#searchInput'),
    productList: document.querySelector('#productList'),
    selectedCount: document.querySelector('#selectedCount'),
    saveButton: document.querySelector('#saveButton'),
    notice: document.querySelector('#notice')
};

boot();

async function boot() {
    elements.settingsForm.addEventListener('submit', saveSettings);
    elements.searchInput.addEventListener('input', renderProducts);

    if (!token) {
        showFatalError('リンクが正しくありません。Discordから開き直してください。');
        return;
    }

    try {
        state.session = await request(`/api/poe2-market/session?token=${encodeURIComponent(token)}`);
        state.selected = new Set(state.session.selectedProductIds);
        render();
    } catch (error) {
        showFatalError(error.message);
    }
}

function render() {
    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.add('hidden');
    elements.settingsForm.classList.remove('hidden');
    elements.leagueBadge.textContent = state.session.league;
    renderCategories();
    renderProducts();
}

function renderCategories() {
    const categories = [{
        key: 'all',
        label: 'すべて'
    }, {
        key: 'selected',
        label: '選択中'
    }, ...state.session.categories];

    elements.categoryTabs.replaceChildren();

    for (const category of categories) {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'category-tab';
        button.textContent = category.label;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(state.category === category.key));
        button.addEventListener('click', function() {
            state.category = category.key;
            renderCategories();
            renderProducts();
        });
        elements.categoryTabs.append(button);
    }
}

function renderProducts() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const products = state.session.products.filter(function(product) {
        const matchesCategory = state.category === 'all'
            || (state.category === 'selected' && state.selected.has(product.id))
            || product.category === state.category;
        const matchesQuery = !query || product.label.toLowerCase().includes(query);

        return matchesCategory && matchesQuery;
    });

    elements.productList.replaceChildren();
    elements.selectedCount.textContent = `${state.selected.size} / ${state.session.maxProducts}`;

    if (products.length === 0) {
        const empty = document.createElement('p');

        empty.className = 'empty-list';
        empty.textContent = '該当するアイテムがありません。';
        elements.productList.append(empty);
        return;
    }

    for (const product of products) {
        elements.productList.append(buildProductOption(product));
    }
}

function buildProductOption(product) {
    const option = document.createElement('label');
    const checkbox = document.createElement('input');
    const icon = document.createElement('img');
    const name = document.createElement('span');
    const selected = state.selected.has(product.id);
    const disabled = !selected && state.selected.size >= state.session.maxProducts;

    option.className = `product-option${disabled ? ' disabled' : ''}`;
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    checkbox.disabled = disabled;
    checkbox.addEventListener('change', function() {
        if (checkbox.checked) {
            state.selected.add(product.id);
        } else {
            state.selected.delete(product.id);
        }

        renderProducts();
    });
    icon.className = `product-icon${product.iconUrl ? '' : ' fallback'}`;
    icon.alt = '';
    icon.loading = 'lazy';
    icon.src = product.iconUrl || emptyIconDataUrl();
    icon.addEventListener('error', function() {
        icon.src = emptyIconDataUrl();
        icon.classList.add('fallback');
    }, {
        once: true
    });
    name.className = 'product-name';
    name.textContent = product.label;
    name.title = product.label;
    option.append(checkbox, icon, name);

    return option;
}

async function saveSettings(event) {
    event.preventDefault();
    elements.saveButton.disabled = true;

    try {
        state.session = await request('/api/poe2-market/settings', {
            method: 'POST',
            body: {
                token: token,
                selectedProductIds: Array.from(state.selected)
            }
        });
        state.selected = new Set(state.session.selectedProductIds);
        renderProducts();
        showNotice(
            state.selected.size === 0
                ? '表示アイテムを未設定にしました。'
                : '表示アイテムを保存しました。',
            false
        );
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        elements.saveButton.disabled = false;
    }
}

async function request(url, options = {}) {
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.body ? {
            'Content-Type': 'application/json'
        } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error || '処理に失敗しました。');
    }

    return payload;
}

function emptyIconDataUrl() {
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2236%22 height=%2236%22/%3E';
}

function showNotice(message, isError) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle('error', isError);
    elements.notice.classList.remove('hidden');
    window.setTimeout(function() {
        elements.notice.classList.add('hidden');
    }, 4000);
}

function showFatalError(message) {
    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.remove('hidden');
    elements.errorText.textContent = message;
}
