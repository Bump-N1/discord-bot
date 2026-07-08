const token = new URLSearchParams(window.location.search).get('token') || '';
const state = {
    session: null,
    pendingBackupId: ''
};

const elements = {
    loadingView: document.querySelector('#loadingView'),
    errorView: document.querySelector('#errorView'),
    completeView: document.querySelector('#completeView'),
    restoreView: document.querySelector('#restoreView'),
    errorText: document.querySelector('#errorText'),
    completeSummary: document.querySelector('#completeSummary'),
    backupCount: document.querySelector('#backupCount'),
    backupList: document.querySelector('#backupList'),
    confirmDialog: document.querySelector('#confirmDialog'),
    confirmText: document.querySelector('#confirmText'),
    cancelRestoreButton: document.querySelector('#cancelRestoreButton'),
    confirmRestoreButton: document.querySelector('#confirmRestoreButton')
};

boot();

async function boot() {
    elements.cancelRestoreButton.addEventListener('click', closeConfirmDialog);
    elements.confirmRestoreButton.addEventListener('click', restoreBackup);
    elements.confirmDialog.addEventListener('click', function(event) {
        if (event.target === elements.confirmDialog) {
            closeConfirmDialog();
        }
    });

    if (!token) {
        showFatalError('リンクが正しくありません。Discordから開き直してください。');
        return;
    }

    try {
        state.session = await request(`/api/ark-backup/session?token=${encodeURIComponent(token)}`);
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
    const backups = state.session.backups || [];

    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.add('hidden');
    elements.restoreView.classList.remove('hidden');
    elements.backupCount.textContent = `${backups.length}件`;
    elements.backupList.replaceChildren();

    if (backups.length === 0) {
        const empty = document.createElement('p');

        empty.className = 'empty-text';
        empty.textContent = 'バックアップはまだ作成されていません。';
        elements.backupList.append(empty);
        return;
    }

    for (const backup of backups) {
        elements.backupList.append(createBackupCard(backup));
    }
}

function createBackupCard(backup) {
    const article = document.createElement('article');
    const main = document.createElement('div');
    const title = document.createElement('h3');
    const meta = document.createElement('p');
    const details = document.createElement('div');
    const button = document.createElement('button');

    article.className = 'backup-card';
    main.className = 'backup-main';
    title.textContent = formatBackupTitle(backup);
    meta.className = 'muted';
    meta.textContent = backup.reason || 'バックアップ';

    details.className = 'backup-details';
    details.append(
        createDetail('MAP', backup.mapLabel || backup.map || '未取得'),
        createDetail('サイズ', formatBytes(backup.totalBytes)),
        createDetail('ファイル', `${backup.fileCount}件`),
        createDetail('MOD', `${(backup.activeMods || []).length}件`)
    );

    main.append(title, meta, details);

    button.type = 'button';
    button.className = 'danger-button';
    button.textContent = '復元';
    button.addEventListener('click', function() {
        openConfirmDialog(backup.id);
    });

    article.append(main, button);

    return article;
}

function createDetail(label, value) {
    const item = document.createElement('p');
    const name = document.createElement('span');
    const text = document.createElement('strong');

    name.textContent = label;
    text.textContent = value;
    item.append(name, text);

    return item;
}

function openConfirmDialog(backupId) {
    const backup = findBackup(backupId);

    if (!backup) {
        return;
    }

    state.pendingBackupId = backupId;
    elements.confirmText.textContent = `${formatBackupTitle(backup)} のデータで現在のARKデータを置き換えます。バックアップに含まれない対象ファイルは削除されます。実行後はこの画面から再実行できません。`;

    if (typeof elements.confirmDialog.showModal === 'function') {
        elements.confirmDialog.showModal();
        return;
    }

    if (window.confirm(elements.confirmText.textContent)) {
        restoreBackup();
    }
}

function closeConfirmDialog() {
    state.pendingBackupId = '';

    if (elements.confirmDialog.open) {
        elements.confirmDialog.close();
    }
}

async function restoreBackup() {
    const backupId = state.pendingBackupId;

    if (!backupId) {
        return;
    }

    elements.confirmRestoreButton.disabled = true;
    elements.confirmRestoreButton.textContent = '復元中';

    try {
        const response = await request('/api/ark-backup/restore', {
            method: 'POST',
            body: {
                token: token,
                backupId: backupId
            }
        });

        showComplete(response.result);
    } catch (error) {
        elements.confirmRestoreButton.disabled = false;
        elements.confirmRestoreButton.textContent = '復元する';
        elements.confirmText.textContent = error.message;
    }
}

function showComplete(result) {
    if (elements.confirmDialog.open) {
        elements.confirmDialog.close();
    }

    elements.restoreView.classList.add('hidden');
    elements.completeView.classList.remove('hidden');
    elements.completeSummary.replaceChildren();

    for (const line of buildResultLines(result)) {
        const item = document.createElement('p');

        item.textContent = line;
        elements.completeSummary.append(item);
    }
}

function buildResultLines(result) {
    const lines = [
        `バックアップ：${formatBackupTitle(result.backup)}`,
        `復元：${result.restoredFileCount}件 / ${formatBytes(result.restoredBytes)}`,
        `削除：${result.deletedFileCount || 0}件 / ${formatBytes(result.deletedBytes || 0)}`
    ];

    if (result.reboot.status === 'restarted') {
        lines.push('サーバーを再起動します。');
    } else if (result.reboot.status === 'started') {
        lines.push('サーバーを起動します。');
    } else {
        lines.push('復元は完了しましたが、再起動に失敗しました。');
    }

    return lines;
}

function findBackup(backupId) {
    return (state.session.backups || []).find(function(backup) {
        return backup.id === backupId;
    });
}

function formatBackupTitle(backup) {
    return `${formatDateTime(backup.createdAt)} / ${backup.serverName || 'ARK Server'}`;
}

function formatDateTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '未取得';
    }

    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatBytes(value) {
    const bytes = Number(value) || 0;
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
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
