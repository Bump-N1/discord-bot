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
    postIntervalHours: document.querySelector('#postIntervalHours'),
    categoryTabs: document.querySelector('#categoryTabs'),
    searchInput: document.querySelector('#searchInput'),
    productList: document.querySelector('#productList'),
    selectedCount: document.querySelector('#selectedCount'),
    saveButton: document.querySelector('#saveButton'),
    historyList: document.querySelector('#historyList'),
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
        clearLinkMessage();
        render();
    } catch (error) {
        showFatalError(error.message);
    }
}

function clearLinkMessage() {
    request('/api/web-link-opened', {
        method: 'POST',
        body: {
            token: token
        }
    }).catch(function() {
        return null;
    });
}

function render() {
    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.add('hidden');
    elements.settingsForm.classList.remove('hidden');
    elements.leagueBadge.textContent = state.session.league;
    renderPostIntervals();
    renderCategories();
    renderProducts();
    renderHistory();
}

function renderPostIntervals() {
    elements.postIntervalHours.replaceChildren();

    for (let hours = 1; hours <= 24; hours++) {
        const option = document.createElement('option');

        option.value = String(hours);
        option.textContent = String(hours);
        option.selected = hours === state.session.postIntervalHours;
        elements.postIntervalHours.append(option);
    }
}

function renderCategories() {
    const categories = [{
        key: 'selected',
        label: '選択中'
    }, {
        key: 'all',
        label: '全て'
    }, ...state.session.categories];

    elements.categoryTabs.replaceChildren();

    for (const category of categories) {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'category-tab';
        button.dataset.category = category.key;
        button.textContent = category.label;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(state.category === category.key));
        button.addEventListener('click', function() {
            state.category = category.key;
            updateCategorySelection();
            renderProducts();
        });
        elements.categoryTabs.append(button);
    }
}

function updateCategorySelection() {
    for (const button of elements.categoryTabs.querySelectorAll('.category-tab')) {
        button.setAttribute('aria-selected', String(button.dataset.category === state.category));
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
        appendEmptyProductMessage();
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
    option.dataset.productId = product.id;
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    checkbox.disabled = disabled;
    checkbox.addEventListener('change', function() {
        updateProductSelection(product.id, checkbox.checked);
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

function updateProductSelection(productId, selected) {
    if (selected) {
        state.selected.add(productId);
    } else {
        state.selected.delete(productId);
    }

    if (state.category === 'selected' && !selected) {
        removeVisibleProductOption(productId);
        return;
    }

    refreshVisibleProductOptions();
}

function refreshVisibleProductOptions() {
    elements.selectedCount.textContent = `${state.selected.size} / ${state.session.maxProducts}`;

    for (const option of elements.productList.querySelectorAll('.product-option')) {
        const checkbox = option.querySelector('input[type="checkbox"]');
        const selected = state.selected.has(option.dataset.productId);
        const disabled = !selected && state.selected.size >= state.session.maxProducts;

        checkbox.checked = selected;
        checkbox.disabled = disabled;
        option.classList.toggle('disabled', disabled);
    }
}

function removeVisibleProductOption(productId) {
    const options = elements.productList.querySelectorAll('.product-option');

    for (const option of options) {
        if (option.dataset.productId === productId) {
            option.remove();
            break;
        }
    }

    if (elements.productList.querySelectorAll('.product-option').length === 0) {
        appendEmptyProductMessage();
    }

    refreshVisibleProductOptions();
}

function appendEmptyProductMessage() {
    const empty = document.createElement('p');

    empty.className = 'empty-list';
    empty.textContent = '該当するアイテムがありません。';
    elements.productList.append(empty);
}

function renderHistory() {
    elements.historyList.replaceChildren();

    if (state.session.history.length === 0) {
        const empty = document.createElement('p');

        empty.className = 'empty-history';
        empty.textContent = '保存履歴はありません。';
        elements.historyList.append(empty);
        return;
    }

    for (const entry of state.session.history) {
        const row = document.createElement('div');
        const actor = document.createElement('span');
        const summary = document.createElement('span');
        const datetime = document.createElement('time');
        const items = document.createElement('span');
        const selectedLabels = Array.isArray(entry.selectedLabels) ? entry.selectedLabels : [];

        row.className = 'history-row';
        actor.className = 'history-actor';
        actor.textContent = entry.updatedByName || '不明なユーザー';
        summary.className = 'history-summary';
        summary.textContent = `表示 ${entry.selectedCount}件 / ${entry.postIntervalHours}時間ごと`;
        datetime.className = 'history-time';
        datetime.dateTime = entry.updatedAt;
        datetime.textContent = formatHistoryDateTime(entry.updatedAt);
        items.className = 'history-items';
        items.textContent = selectedLabels.length > 0
            ? selectedLabels.join(', ')
            : '表示アイテムなし';
        items.title = items.textContent;
        row.append(actor, summary, datetime, items);
        elements.historyList.append(row);
    }
}

async function saveSettings(event) {
    event.preventDefault();
    elements.saveButton.disabled = true;

    try {
        state.session = await request('/api/poe2-market/settings', {
            method: 'POST',
            body: {
                token: token,
                selectedProductIds: Array.from(state.selected),
                postIntervalHours: Number(elements.postIntervalHours.value)
            }
        });
        state.selected = new Set(state.session.selectedProductIds);
        renderPostIntervals();
        renderProducts();
        renderHistory();
        showNotice(
            state.selected.size === 0
                ? '表示アイテムを未設定にして、投稿頻度を保存しました。'
                : '表示アイテムと投稿頻度を保存しました。',
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

function formatHistoryDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
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
