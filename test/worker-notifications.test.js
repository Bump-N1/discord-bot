import { afterEach, describe, expect, it, vi } from 'vitest';
import { __testables } from '../workers/discord-bot/worker.js';

describe('patch note Worker', function() {
    afterEach(function() {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('FF14メンテナンスは他の通知元より先に確認する', function() {
        expect(__testables.SOURCES[0].game).toBe('FF14_MAINTENANCE');
    });

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

    it('OW はキャッシュを回避し英語公式ページからも最新更新を補完する', async function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'OW';
        });
        const requests = [];

        vi.stubGlobal('fetch', async function(url, options) {
            const requestUrl = String(url);
            requests.push({
                url: requestUrl,
                options: options
            });

            const body = requestUrl.includes('/en-us/')
                ? '<div>Overwatch 2 Retail Patch Notes - August 21, 2026</div>'
                : '<div>[オーバーウォッチ]2026年8月15日配信パッチ内容</div>';

            return {
                ok: true,
                text: async function() {
                    return body;
                }
            };
        });

        const html = await __testables.fetchSourceText(source);
        const result = await __testables.parseOverwatchPatchNotes(html, source.url);

        expect(result).toMatchObject({
            id: '2026年8月21日:[オーバーウォッチ] 2026年8月21日配信パッチ内容',
            title: '[オーバーウォッチ] 2026年8月21日配信パッチ内容',
            date: '2026年8月21日',
            url: 'https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        });
        expect(requests).toHaveLength(2);

        for (const request of requests) {
            expect(new URL(request.url).searchParams.has('_patchnote_check')).toBe(true);
            expect(request.options.cache).toBe('no-store');
            expect(request.options.cf).toEqual({
                cacheEverything: false,
                cacheTtl: 0
            });
        }
    });

    it('PoE2はフォーラム一覧のCDNキャッシュを回避して最新記事を拾う', async function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'PoE2';
        });
        const requests = [];

        vi.stubGlobal('fetch', async function(url, options) {
            requests.push({
                url: String(url),
                options: options
            });

            return {
                ok: true,
                text: async function() {
                    return '<a href="/forum/view-thread/4000875">コンテンツアップデート 0.5.5 — Path of Exile 2: Forbidden Rites</a>';
                }
            };
        });

        const html = await __testables.fetchSourceText(source);
        const result = await __testables.parsePoe2PatchNotes(html, source.url);

        expect(result).toMatchObject({
            id: 'https://jp.pathofexile.com/forum/view-thread/4000875',
            title: 'コンテンツアップデート 0.5.5 — Path of Exile 2: Forbidden Rites',
            url: 'https://jp.pathofexile.com/forum/view-thread/4000875'
        });
        expect(requests).toHaveLength(1);
        expect(new URL(requests[0].url).searchParams.has('_patchnote_check')).toBe(true);
        expect(requests[0].options.cache).toBe('no-store');
        expect(requests[0].options.cf).toEqual({
            cacheEverything: false,
            cacheTtl: 0
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

    it('FF14メンテナンスは記事詳細取得に失敗しても一覧タイトルで通知対象を作る', async function() {
        const fallbackTitle = '全ワールド 緊急メンテナンス作業 終了時間変更のお知らせ';
        const fallbackUrl = 'https://jp.finalfantasyxiv.com/lodestone/news/detail/maintenance-change-test';

        vi.stubGlobal('fetch', async function() {
            throw new Error('network timeout');
        });

        const result = await __testables.parseFf14WorldMaintenance(
            `<a href="/lodestone/news/detail/maintenance-change-test">[続報] ${fallbackTitle}</a>`,
            'https://jp.finalfantasyxiv.com/lodestone/news/category/2'
        );

        expect(result).toEqual([
            expect.objectContaining({
                id: fallbackUrl,
                title: fallbackTitle,
                url: fallbackUrl
            })
        ]);
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
