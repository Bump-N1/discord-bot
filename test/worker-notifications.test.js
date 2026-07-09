import { describe, expect, it } from 'vitest';
import { __testables } from '../workers/discord-bot/worker.js';

describe('patch note Worker', function() {
    it('OW は同じURLのページ更新でもID差分で再通知できる', function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'OW';
        });
        const patchNote = __testables.applySourceDedupeOptions(source, {
            id: '2026/7/9:オーバーウォッチ パッチノート',
            url: 'https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        });

        expect(__testables.getStoredPatchNoteIds(patchNote)).toEqual([
            'id:2026/7/9:オーバーウォッチ パッチノート'
        ]);
        expect(__testables.isPostedPatchNote(new Set([
            'url:https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        ]), patchNote)).toBe(false);
    });

    it('OW の日本語と英語の同一ページ更新から最新日付を拾う', async function() {
        const html = [
            '<div>Overwatch 2 Retail Patch Notes - May 21, 2026</div>',
            '<div>2026年7月9日 配信パッチ内容のお知らせ</div>'
        ].join('');

        const result = await __testables.parseOverwatchPatchNotes(
            html,
            'https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        );

        expect(result).toMatchObject({
            id: '2026年7月9日:2026年7月9日 配信パッチ内容のお知らせ',
            title: '2026年7月9日 配信パッチ内容のお知らせ',
            date: '2026年7月9日',
            url: 'https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        });
    });

    it('原神APIのsUrlがYouTubeでも公式記事URLを優先する', function() {
        const result = __testables.parseGenshinContentListApi(JSON.stringify({
            data: {
                list: [
                    {
                        iInfoId: '165162',
                        sTitle: '「空月の歌」予告番組のお知らせ',
                        sUrl: 'https://www.youtube.com/watch?v=example',
                        dtStartTime: '2026-07-09 12:00:00',
                        sIntro: '番組告知'
                    }
                ]
            }
        }), {
            categoryName: '告知'
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: '165162',
            title: '「空月の歌」予告番組のお知らせ',
            url: 'https://genshin.hoyoverse.com/ja/news/detail/165162',
            category: '告知'
        });
    });

    it('FF14メンテナンスは緊急メンテを拾い、アプリ系は除外する', function() {
        expect(__testables.isFf14MaintenanceNewsTitle('全ワールド 緊急メンテナンス作業のお知らせ')).toBe(true);
        expect(__testables.isFf14MaintenanceNewsTitle('Meteorデータセンター メンテナンス作業のお知らせ')).toBe(true);
        expect(__testables.isFf14MaintenanceNewsTitle('コンパニオンアプリ 緊急メンテナンス作業のお知らせ')).toBe(false);
    });

    it('通常通知は青、FF14メンテナンスだけ赤にする', function() {
        expect(__testables.getDiscordPresentation('Genshin_NOTICE').color).toBe(0x5865F2);
        expect(__testables.getDiscordPresentation('Genshin_NEWS').color).toBe(0x5865F2);
        expect(__testables.getDiscordPresentation('FF14').color).toBe(0x5865F2);
        expect(__testables.getDiscordPresentation('FF14_MAINTENANCE').color).toBe(0xE53935);
    });

    it('URL重複判定はutmを無視する', function() {
        const unique = __testables.uniquePatchNotes([
            {
                id: '',
                url: 'https://example.com/article?utm_source=x'
            },
            {
                id: '',
                url: 'https://example.com/article'
            }
        ]);

        expect(unique).toHaveLength(1);
    });
});
