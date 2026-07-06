const token = new URLSearchParams(window.location.search).get('token') || '';
const state = {
    session: null,
    mods: []
};

const elements = {
    loadingView: document.querySelector('#loadingView'),
    errorView: document.querySelector('#errorView'),
    completeView: document.querySelector('#completeView'),
    errorText: document.querySelector('#errorText'),
    completeSummary: document.querySelector('#completeSummary'),
    settingsForm: document.querySelector('#settingsForm'),
    serverName: document.querySelector('#serverName'),
    playerCount: document.querySelector('#playerCount'),
    currentMapText: document.querySelector('#currentMapText'),
    mapSelect: document.querySelector('#mapSelect'),
    modInput: document.querySelector('#modInput'),
    addModButton: document.querySelector('#addModButton'),
    modCount: document.querySelector('#modCount'),
    modList: document.querySelector('#modList'),
    saveButton: document.querySelector('#saveButton'),
    notice: document.querySelector('#notice'),
    historyList: document.querySelector('#historyList')
};

boot();

async function boot() {
    elements.settingsForm.addEventListener('submit', saveSettings);
    elements.addModButton.addEventListener('click', addModsFromInput);
    elements.modInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addModsFromInput();
        }
    });

    if (!token) {
        showFatalError('リンクが正しくありません。Discordから開き直してください。');
        return;
    }

    try {
        state.session = await request(`/api/ark-edit/session?token=${encodeURIComponent(token)}`);
        state.mods = [...state.session.server.activeMods];
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
    elements.serverName.textContent = state.session.server.name || 'ARK Server';
    elements.playerCount.textContent = formatPlayers(state.session.server);
    elements.currentMapText.textContent = `現在：${state.session.server.mapLabel}`;
    renderMapOptions();
    renderMods();
    renderHistory();
}

function renderMapOptions() {
    elements.mapSelect.replaceChildren();

    for (const option of state.session.mapOptions) {
        const optionElement = document.createElement('option');

        optionElement.value = option.value;
        optionElement.textContent = option.label;
        optionElement.selected = option.value === state.session.server.map;
        elements.mapSelect.append(optionElement);
    }
}

function renderMods() {
    elements.modCount.textContent = `${state.mods.length}件`;
    elements.modList.replaceChildren();

    if (state.mods.length === 0) {
        const empty = document.createElement('p');

        empty.className = 'empty-text';
        empty.textContent = 'MODは登録されていません。';
        elements.modList.append(empty);
        return;
    }

    for (const modId of state.mods) {
        const item = document.createElement('div');
        const id = document.createElement('span');
        const button = document.createElement('button');

        item.className = 'mod-item';
        id.className = 'mod-id';
        id.textContent = modId;
        button.type = 'button';
        button.className = 'remove-button';
        button.textContent = '削除';
        button.addEventListener('click', function() {
            state.mods = state.mods.filter(function(value) {
                return value !== modId;
            });
            renderMods();
        });
        item.append(id, button);
        elements.modList.append(item);
    }
}

function renderHistory() {
    elements.historyList.replaceChildren();

    if (!state.session.history.length) {
        const empty = document.createElement('p');

        empty.className = 'empty-text';
        empty.textContent = 'まだ変更履歴はありません。';
        elements.historyList.append(empty);
        return;
    }

    for (const entry of state.session.history) {
        const item = document.createElement('article');
        const title = document.createElement('p');
        const detail = document.createElement('p');

        item.className = 'history-item';
        title.className = 'history-title';
        title.textContent = `${entry.actorName || entry.actorId || 'ユーザー'} / ${formatDateTime(entry.createdAt)}`;
        detail.className = 'history-detail';
        detail.textContent = buildHistoryText(entry);
        item.append(title, detail);
        elements.historyList.append(item);
    }
}

function addModsFromInput() {
    const modIds = normalizeModIds(elements.modInput.value);

    if (modIds.length === 0) {
        showNotice('MOD IDを入力してください。', true);
        return;
    }

    state.mods = Array.from(new Set([...state.mods, ...modIds]));
    elements.modInput.value = '';
    showNotice('');
    renderMods();
}

async function saveSettings(event) {
    event.preventDefault();
    showNotice('');
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = '保存中';

    try {
        const response = await request('/api/ark-edit/save', {
            method: 'POST',
            body: {
                token: token,
                map: elements.mapSelect.value,
                activeMods: state.mods
            }
        });

        showComplete(response.result);
    } catch (error) {
        elements.saveButton.disabled = false;
        elements.saveButton.textContent = '変更を保存';
        showNotice(error.message, true);
    }
}

function showComplete(result) {
    elements.settingsForm.classList.add('hidden');
    elements.completeView.classList.remove('hidden');
    elements.completeSummary.replaceChildren();

    for (const line of buildResultLines(result)) {
        const item = document.createElement('p');

        item.textContent = line;
        elements.completeSummary.append(item);
    }
}

function buildResultLines(result) {
    const lines = [];

    if (result.diff.mapChanged) {
        lines.push(`MAP：${result.before.mapLabel} → ${result.after.mapLabel}`);
    }

    if (result.diff.addedMods.length > 0) {
        lines.push(`MOD追加：${result.diff.addedMods.join(', ')}`);
    }

    if (result.diff.removedMods.length > 0) {
        lines.push(`MOD削除：${result.diff.removedMods.join(', ')}`);
    }

    if (result.reboot.status === 'restarted') {
        lines.push('サーバーを再起動します。');
    } else if (result.reboot.status === 'skipped_players') {
        lines.push('プレイヤーがいるため、再起動は行われません。');
    } else if (result.reboot.status === 'skipped_unknown_players') {
        lines.push('プレイヤー数を確認できないため、再起動は行われません。');
    } else {
        lines.push('設定は保存されましたが、再起動に失敗しました。');
    }

    return lines;
}

function normalizeModIds(value) {
    return String(value || '')
        .split(/[,\s]+/u)
        .map(function(modId) {
            return modId.trim();
        })
        .filter(function(modId) {
            return /^\d+$/u.test(modId);
        });
}

function buildHistoryText(entry) {
    const lines = [];

    if (entry.diff?.mapChanged) {
        lines.push(`MAP ${entry.before.mapLabel} → ${entry.after.mapLabel}`);
    }

    if (entry.diff?.addedMods?.length) {
        lines.push(`追加 ${entry.diff.addedMods.join(', ')}`);
    }

    if (entry.diff?.removedMods?.length) {
        lines.push(`削除 ${entry.diff.removedMods.join(', ')}`);
    }

    return lines.join(' / ') || '変更なし';
}

function formatPlayers(server) {
    if (server.playerCount === null || server.playerCount === undefined) {
        return '人数：?';
    }

    if (server.maxPlayers === null || server.maxPlayers === undefined) {
        return `人数：${server.playerCount}`;
    }

    return `人数：${server.playerCount} / ${server.maxPlayers}`;
}

function formatDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function showNotice(message, isError = false) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle('error', Boolean(isError));
}

function showFatalError(message) {
    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.remove('hidden');
    elements.errorText.textContent = message;
}

async function request(url, options = {}) {
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.body ? {
            'Content-Type': 'application/json'
        } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(function() {
        return {};
    });

    if (!response.ok) {
        throw new Error(payload.error || '通信に失敗しました。');
    }

    return payload;
}
