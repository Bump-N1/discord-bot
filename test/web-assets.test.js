import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function readAsset(path) {
    return await readFile(new URL(path, import.meta.url), 'utf8');
}

describe('web assets', function() {
    it('PoE2編集画面は固定ヘッダー、カテゴリー開閉、投稿頻度、保存履歴を持つ', async function() {
        const html = await readAsset('../src/web/poe2-market/index.html');

        expect(html).toContain('id="categoryToggle"');
        expect(html).toContain('id="categoryBackdrop"');
        expect(html).toContain('id="postIntervalHours"');
        expect(html).toContain('時間ごと');
        expect(html).toContain('id="searchInput"');
        expect(html).toContain('id="historyList"');
    });

    it('ARK編集画面はMOD検証、削除確認、変更履歴、MOD一覧リンクを持つ', async function() {
        const html = await readAsset('../src/web/ark-edit/index.html');

        expect(html).toContain('id="modErrorDialog"');
        expect(html).toContain('id="removeModDialog"');
        expect(html).toContain('id="modCatalogLink"');
        expect(html).toContain('id="historyList"');
        expect(html).toContain('変更を保存');
    });

    it('募集Web画面はdatetime-local入力と希望制フォームを持つ', async function() {
        const html = await readAsset('../src/web/act/index.html');

        expect(html).toContain('type="datetime-local"');
        expect(html).toContain('id="firstChoices"');
        expect(html).toContain('id="fixedChoice"');
        expect(html).toContain('第1希望必須');
        expect(html).toContain('id="secondJobChoice"');
    });

    it('ARK復元画面は確認ダイアログと完了画面を持つ', async function() {
        const html = await readAsset('../src/web/ark-backup/index.html');

        expect(html).toContain('id="confirmDialog"');
        expect(html).toContain('復元する');
        expect(html).toContain('この画面は閉じてください。');
        expect(html).toContain('id="backupList"');
    });
});
