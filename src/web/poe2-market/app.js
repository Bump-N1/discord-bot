const token = new URLSearchParams(window.location.search).get('token') || '';
const state = {
    session: null,
    category: 'all',
    categoryMenuOpen: false,
    selected: new Set()
};
let productIconObserver = null;
const mobileCategoryQuery = window.matchMedia('(max-width: 680px)');

const elements = {
    loadingView: document.querySelector('#loadingView'),
    errorView: document.querySelector('#errorView'),
    errorText: document.querySelector('#errorText'),
    settingsForm: document.querySelector('#settingsForm'),
    leagueBadge: document.querySelector('#leagueBadge'),
    postIntervalHours: document.querySelector('#postIntervalHours'),
    categoryToggle: document.querySelector('#categoryToggle'),
    categoryBackdrop: document.querySelector('#categoryBackdrop'),
    categorySidebar: document.querySelector('.category-sidebar'),
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
    elements.categoryToggle.addEventListener('click', toggleCategoryMenu);
    elements.categoryBackdrop.addEventListener('click', closeCategoryMenu);
    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeydown);
    mobileCategoryQuery.addEventListener('change', syncCategoryMenu);

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
    syncCategoryMenu();
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
        key: 'all',
        label: '全て'
    }, {
        key: 'selected',
        label: '選択中'
    }, ...state.session.categories];

    elements.categoryTabs.replaceChildren();

    for (const category of categories) {
        const button = document.createElement('button');
        const label = document.createElement('span');
        const count = document.createElement('span');

        button.type = 'button';
        button.className = 'category-tab';
        button.dataset.category = category.key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(state.category === category.key));
        label.className = 'category-label';
        label.textContent = category.label;
        count.className = 'category-count';
        button.append(label, count);
        button.addEventListener('click', function() {
            state.category = category.key;
            if (mobileCategoryQuery.matches) {
                state.categoryMenuOpen = false;
                syncCategoryMenu();
            }
            updateCategorySelection();
            renderProducts();
        });
        elements.categoryTabs.append(button);
    }

    updateCategoryCounts();
}

function toggleCategoryMenu() {
    state.categoryMenuOpen = !state.categoryMenuOpen;
    syncCategoryMenu();
}

function closeCategoryMenu() {
    if (!state.categoryMenuOpen) {
        return;
    }

    state.categoryMenuOpen = false;
    syncCategoryMenu();
}

function handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
        closeCategoryMenu();
    }
}

function handleDocumentPointerDown(event) {
    if (!mobileCategoryQuery.matches || !state.categoryMenuOpen) {
        return;
    }

    if (
        elements.categorySidebar.contains(event.target)
        || elements.categoryToggle.contains(event.target)
    ) {
        return;
    }

    closeCategoryMenu();
}

function syncCategoryMenu() {
    const isMobile = mobileCategoryQuery.matches;
    const open = !isMobile || state.categoryMenuOpen;

    elements.categorySidebar?.classList.toggle('open', open);
    elements.categoryBackdrop.hidden = !isMobile || !state.categoryMenuOpen;
    elements.categoryBackdrop.classList.toggle('open', isMobile && state.categoryMenuOpen);
    document.body.classList.toggle('category-menu-open', isMobile && state.categoryMenuOpen);
    elements.categoryToggle.setAttribute('aria-expanded', String(state.categoryMenuOpen));
    elements.categoryToggle.setAttribute(
        'aria-label',
        state.categoryMenuOpen ? 'カテゴリーを閉じる' : 'カテゴリーを開く'
    );
}

function updateCategorySelection() {
    for (const button of elements.categoryTabs.querySelectorAll('.category-tab')) {
        button.setAttribute('aria-selected', String(button.dataset.category === state.category));
    }
}

function updateCategoryCounts() {
    const counts = new Map();

    counts.set('all', state.session.products.length);
    counts.set('selected', state.selected.size);

    for (const product of state.session.products) {
        counts.set(product.category, (counts.get(product.category) || 0) + 1);
    }

    for (const button of elements.categoryTabs.querySelectorAll('.category-tab')) {
        const count = counts.get(button.dataset.category) || 0;
        const countElement = button.querySelector('.category-count');

        if (countElement) {
            countElement.textContent = `(${count})`;
        }
    }
}

function renderProducts() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const products = state.session.products.filter(function(product) {
        const matchesCategory = state.category === 'all'
            || (state.category === 'selected' && state.selected.has(product.id))
            || product.category === state.category;
        const matchesQuery = !query
            || product.label.toLowerCase().includes(query)
            || getProductGroupLabel(product).toLowerCase().includes(query);

        return matchesCategory && matchesQuery;
    });
    const groups = groupProducts(products);

    resetProductIconObserver();
    elements.productList.replaceChildren();
    elements.selectedCount.textContent = `${state.selected.size} / ${state.session.maxProducts}`;

    if (products.length === 0) {
        appendEmptyProductMessage();
        return;
    }

    for (const group of groups) {
        elements.productList.append(buildProductGroup(group));
    }

    observeProductIcons();
}

function groupProducts(products) {
    const groups = [];
    const groupByLabel = new Map();

    for (const product of products) {
        const label = getProductGroupLabel(product);
        let group = groupByLabel.get(label);

        if (!group) {
            group = {
                label: label,
                products: []
            };
            groupByLabel.set(label, group);
            groups.push(group);
        }

        group.products.push(product);
    }

    return groups;
}

function getProductGroupLabel(product) {
    const subCategory = product.subCategory || getCategoryLabel(product.category);

    if (state.category === 'all' || state.category === 'selected') {
        const category = getCategoryLabel(product.category);

        return subCategory && subCategory !== category
            ? `${category} / ${subCategory}`
            : category;
    }

    return subCategory;
}

function getCategoryLabel(categoryKey) {
    const category = state.session.categories.find(function(candidate) {
        return candidate.key === categoryKey;
    });

    return category?.label || categoryKey;
}

function buildProductGroup(group) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    const grid = document.createElement('div');

    section.className = 'product-group';
    heading.className = 'product-group-title';
    heading.textContent = group.label;
    grid.className = 'product-grid';

    for (const product of group.products) {
        grid.append(buildProductOption(product));
    }

    section.append(heading, grid);

    return section;
}

function buildProductOption(product) {
    const option = document.createElement('button');
    const icon = document.createElement('img');
    const name = document.createElement('span');
    const selected = state.selected.has(product.id);
    const disabled = !selected && state.selected.size >= state.session.maxProducts;

    option.type = 'button';
    option.className = `product-option${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`;
    option.dataset.productId = product.id;
    option.disabled = disabled;
    option.title = getProductTooltip(product);
    option.setAttribute('aria-pressed', String(selected));
    option.addEventListener('click', function() {
        updateProductSelection(product.id, !state.selected.has(product.id));
    });
    icon.className = `product-icon${product.iconUrl ? '' : ' fallback'}`;
    icon.alt = '';
    icon.decoding = 'async';
    icon.src = emptyIconDataUrl();
    if (product.iconUrl) {
        icon.dataset.src = product.iconUrl;
    }
    icon.addEventListener('error', function() {
        handleProductIconError(icon);
    });
    name.className = 'product-name';
    name.textContent = product.label;
    option.append(icon, name);

    return option;
}

function getProductTooltip(product) {
    return product.description
        ? `${product.label}\n${product.description}`
        : product.label;
}

function resetProductIconObserver() {
    if (!productIconObserver) {
        return;
    }

    productIconObserver.disconnect();
    productIconObserver = null;
}

function observeProductIcons() {
    const icons = Array.from(elements.productList.querySelectorAll('.product-icon[data-src]'));

    if (icons.length === 0) {
        return;
    }

    if (!('IntersectionObserver' in window)) {
        icons.forEach(loadProductIcon);
        return;
    }

    productIconObserver = new IntersectionObserver(function(entries, observer) {
        for (const entry of entries) {
            if (!entry.isIntersecting) {
                continue;
            }

            loadProductIcon(entry.target);
            observer.unobserve(entry.target);
        }
    }, {
        root: elements.productList,
        rootMargin: '160px 0px'
    });

    icons.forEach(function(icon) {
        productIconObserver.observe(icon);
    });
}

function loadProductIcon(icon) {
    const source = icon.dataset.src;

    if (!source || icon.dataset.loaded === 'true') {
        return;
    }

    const retryCount = Number(icon.dataset.retryCount || 0);

    icon.dataset.loaded = 'true';
    icon.classList.remove('fallback');
    icon.src = retryCount > 0
        ? withRetryParam(source, retryCount)
        : source;
}

function handleProductIconError(icon) {
    const source = icon.dataset.src;
    const retryCount = Number(icon.dataset.retryCount || 0);

    icon.dataset.loaded = 'false';
    icon.src = emptyIconDataUrl();
    icon.classList.add('fallback');

    if (!source || retryCount >= 1) {
        return;
    }

    icon.dataset.retryCount = String(retryCount + 1);
    window.setTimeout(function() {
        if (icon.isConnected) {
            loadProductIcon(icon);
        }
    }, 700);
}

function withRetryParam(source, retryCount) {
    try {
        const url = new URL(source, window.location.href);

        url.searchParams.set('_retry', String(retryCount));
        return `${url.pathname}${url.search}${url.hash}`;
    } catch (error) {
        return source;
    }
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

    updateCategoryCounts();
    refreshVisibleProductOptions();
}

function refreshVisibleProductOptions() {
    elements.selectedCount.textContent = `${state.selected.size} / ${state.session.maxProducts}`;

    for (const option of elements.productList.querySelectorAll('.product-option')) {
        const selected = state.selected.has(option.dataset.productId);
        const disabled = !selected && state.selected.size >= state.session.maxProducts;

        option.disabled = disabled;
        option.setAttribute('aria-pressed', String(selected));
        option.classList.toggle('selected', selected);
        option.classList.toggle('disabled', disabled);
    }
}

function removeVisibleProductOption(productId) {
    const options = elements.productList.querySelectorAll('.product-option');

    for (const option of options) {
        if (option.dataset.productId === productId) {
            const group = option.closest('.product-group');

            option.remove();
            if (group && group.querySelectorAll('.product-option').length === 0) {
                group.remove();
            }
            break;
        }
    }

    if (elements.productList.querySelectorAll('.product-option').length === 0) {
        appendEmptyProductMessage();
    }

    updateCategoryCounts();
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
        renderCategories();
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
