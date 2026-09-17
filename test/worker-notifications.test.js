import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { __testables } from '../workers/discord-bot/worker.js';

const NOTIFICATION_FIXTURE_DIRECTORY = new URL('./fixtures/worker-notifications/', import.meta.url);

async function readNotificationFixture(name) {
    return readFile(new URL(name, NOTIFICATION_FIXTURE_DIRECTORY), 'utf8');
}

async function readNotificationJsonFixture(name) {
    return JSON.parse(await readNotificationFixture(name));
}

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

        expect(result).toEqual([expect.objectContaining({
            id: '2026年7月9日:2026年7月9日 配信パッチ内容のお知らせ',
            title: '2026年7月9日 配信パッチ内容のお知らせ',
            date: '2026年7月9日',
            url: 'https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        })]);
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

        expect(result).toEqual([expect.objectContaining({
            id: '2026年8月21日:[オーバーウォッチ] 2026年8月21日配信パッチ内容',
            title: '[オーバーウォッチ] 2026年8月21日配信パッチ内容',
            date: '2026年8月21日',
            url: 'https://overwatch.blizzard.com/ja-jp/news/patch-notes/'
        })]);
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

        expect(result).toEqual([expect.objectContaining({
            id: 'https://jp.pathofexile.com/forum/view-thread/4000875',
            title: 'コンテンツアップデート 0.5.5 — Path of Exile 2: Forbidden Rites',
            url: 'https://jp.pathofexile.com/forum/view-thread/4000875'
        })]);
        expect(requests).toHaveLength(1);
        expect(new URL(requests[0].url).searchParams.has('_patchnote_check')).toBe(true);
        expect(requests[0].options.cache).toBe('no-store');
        expect(requests[0].options.cf).toEqual({
            cacheEverything: false,
            cacheTtl: 0
        });
    });

    it('全通知元の一覧取得でCDNキャッシュを回避する', async function() {
        const requests = [];

        vi.stubGlobal('fetch', async function(url, options) {
            requests.push({
                url: String(url),
                options: options
            });

            return {
                ok: true,
                text: async function() {
                    return '';
                }
            };
        });

        for (const source of __testables.SOURCES) {
            await __testables.fetchSourceText(source);
        }

        const expectedRequestCount = __testables.SOURCES.reduce(function(count, source) {
            return count + 1 + (source.supplementalUrls || []).length;
        }, 0);

        expect(requests).toHaveLength(expectedRequestCount);

        for (const request of requests) {
            expect(new URL(request.url).searchParams.has('_patchnote_check')).toBe(true);
            expect(request.options.cache).toBe('no-store');
            expect(request.options.cf).toEqual({
                cacheEverything: false,
                cacheTtl: 0
            });
        }
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

    it('原神は公式APIの複数記事を公開日時順に保持する', async function() {
        const fixture = await readNotificationJsonFixture('genshin-official-news.json');

        vi.stubGlobal('fetch', async function() {
            return new Response('', { status: 200 });
        });

        const result = await __testables.parseGenshinOfficialNews(
            JSON.stringify(fixture.response),
            fixture.source.url,
            fixture.source.game,
            fixture.source.options
        );

        expect(result.map(function(item) {
            return item.id;
        })).toEqual(fixture.expectedIds);
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

    it('FF14メンテナンスは初回でも最新1件を通知し、現行一覧を重複防止用に保存する', async function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'FF14_MAINTENANCE';
        });
        const patchNotes = ['latest', 'older'].map(function(revision) {
            return {
                id: 'test-' + revision,
                title: 'test maintenance ' + revision,
                description: 'test description ' + revision,
                date: '',
                url: 'https://example.test/maintenance/' + revision,
                imageUrl: ''
            };
        });
        const values = new Map();
        const posts = [];
        const env = {
            PATCHNOTE_KV: {
                get: async function(key) {
                    return values.get(key) || null;
                },
                put: async function(key, value) {
                    values.set(key, value);
                }
            }
        };

        vi.stubGlobal('fetch', async function(_input, options) {
            posts.push(JSON.parse(options.body));
            return new Response('', { status: 200 });
        });

        const results = [];
        await __testables.processPatchNotes(
            env,
            source,
            'https://discord.test/webhook',
            patchNotes,
            results
        );

        expect(posts).toHaveLength(1);
        expect(posts[0].embeds[0].description).toContain(patchNotes[0].title);
        expect(results).toEqual([
            expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'posted',
                url: patchNotes[0].url
            })
        ]);
        expect(JSON.parse(values.get('posted:FF14_MAINTENANCE'))).toEqual(
            patchNotes.flatMap(__testables.getStoredPatchNoteIds)
        );
    });

    it('FF14メンテナンスは送信前に記録された最新履歴を1回だけ再送する', async function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'FF14_MAINTENANCE';
        });
        const patchNotes = ['latest', 'older'].map(function(revision) {
            return {
                id: 'test-' + revision,
                title: 'test maintenance ' + revision,
                description: '',
                date: '',
                url: 'https://example.test/maintenance/' + revision,
                imageUrl: ''
            };
        });
        const values = new Map([
            [
                'posted:FF14_MAINTENANCE',
                JSON.stringify(patchNotes.flatMap(__testables.getStoredPatchNoteIds))
            ]
        ]);
        const posts = [];
        const env = {
            PATCHNOTE_KV: {
                get: async function(key) {
                    return values.get(key) || null;
                },
                put: async function(key, value) {
                    values.set(key, value);
                }
            }
        };

        vi.stubGlobal('fetch', async function(_input, options) {
            posts.push(JSON.parse(options.body));
            return new Response('', { status: 200 });
        });

        const results = [];
        await __testables.processPatchNotes(
            env,
            source,
            'https://discord.test/webhook',
            patchNotes,
            results
        );

        expect(posts).toHaveLength(1);
        expect(posts[0].embeds[0].description).toContain(patchNotes[0].title);
        expect(results).toEqual([
            expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'posted',
                url: patchNotes[0].url
            })
        ]);
        expect(JSON.parse(values.get('delivered:FF14_MAINTENANCE'))).toEqual(
            __testables.getStoredPatchNoteIds(patchNotes[0])
        );

        const secondResults = [];
        await __testables.processPatchNotes(
            env,
            source,
            'https://discord.test/webhook',
            patchNotes,
            secondResults
        );

        expect(posts).toHaveLength(1);
        expect(secondResults).toEqual([
            expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'no_update'
            })
        ]);
    });

    it('FF14メンテナンス取得失敗は一度だけ警告し、復旧後の再発は再通知する', async function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'FF14_MAINTENANCE';
        });
        const originalParser = source.parser;
        const originalFetchAttempts = source.fetchAttempts;
        const originalRetryWaitMilliseconds = source.fetchRetryWaitMilliseconds;
        const values = new Map();
        const webhookPosts = [];
        let sourceAvailable = false;
        let sourceRequestCount = 0;
        source.fetchAttempts = 4;
        source.fetchRetryWaitMilliseconds = 0;

        const env = {
            DISCORD_MAINTENANCE_FF14: 'https://discord.test/webhook',
            PATCHNOTE_KV: {
                get: async function(key) {
                    return values.get(key) || null;
                },
                put: async function(key, value) {
                    values.set(key, value);
                },
                delete: async function(key) {
                    values.delete(key);
                }
            }
        };

        vi.stubGlobal('fetch', async function(input, options) {
            if (String(input).startsWith('https://discord.test/')) {
                webhookPosts.push(JSON.parse(options.body));
                return new Response('', { status: 200 });
            }

            sourceRequestCount += 1;
            return sourceAvailable
                ? new Response('synthetic source response', { status: 200 })
                : new Response('', { status: 503 });
        });

        try {
            const firstResults = await __testables.runPatchNoteChecks(env);
            const secondResults = await __testables.runPatchNoteChecks(env);
            const alertCount = function() {
                return webhookPosts.filter(function(payload) {
                    return payload.embeds[0].description.includes('⚠️ FF14メンテナンス情報を取得できません');
                }).length;
            };

            expect(firstResults).toContainEqual(expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'error',
                message: 'failed to fetch source page'
            }));
            expect(secondResults).toContainEqual(expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'error',
                message: 'failed to fetch source page'
            }));
            expect(sourceRequestCount).toBe(8);
            expect(alertCount()).toBe(1);

            sourceAvailable = true;
            const emptyResults = await __testables.runPatchNoteChecks(env);

            expect(emptyResults).toContainEqual(expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'error',
                message: 'latest patch note was not found'
            }));
            expect(alertCount()).toBe(1);

            source.parser = async function() {
                return [{
                    id: 'synthetic-maintenance',
                    title: 'Synthetic maintenance',
                    description: '',
                    date: '',
                    url: 'https://example.test/maintenance/synthetic',
                    imageUrl: ''
                }];
            };
            const recoveredResults = await __testables.runPatchNoteChecks(env);

            expect(recoveredResults).toContainEqual(expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'posted',
                url: 'https://example.test/maintenance/synthetic'
            }));
            expect(values.has('source-failure-alert:FF14_MAINTENANCE')).toBe(false);

            sourceAvailable = false;
            await __testables.runPatchNoteChecks(env);

            expect(alertCount()).toBe(2);
            expect(sourceRequestCount).toBe(15);
        } finally {
            source.parser = originalParser;
            source.fetchAttempts = originalFetchAttempts;

            if (originalRetryWaitMilliseconds === undefined) {
                delete source.fetchRetryWaitMilliseconds;
            } else {
                source.fetchRetryWaitMilliseconds = originalRetryWaitMilliseconds;
            }
        }
    });

    it('全通知元は公式URL、複数件取得、障害監視の要件を持つ', function() {
        const allowedHosts = new Set([
            'jp.finalfantasyxiv.com',
            'www.leagueoflegends.com',
            'teamfighttactics.leagueoflegends.com',
            'overwatch.blizzard.com',
            'jp.pathofexile.com',
            'sg-public-api-static.hoyoverse.com',
            'genshin.hoyoverse.com'
        ]);

        expect(__testables.SOURCES).toHaveLength(8);

        for (const source of __testables.SOURCES) {
            expect(source.displayName).toBeTruthy();
            expect(source.forceFreshFetch).toBe(true);
            expect(source.checkMultiple).toBe(true);
            expect(source.maxItems).toBeGreaterThan(0);
            expect(source.rssFallbackUrl).toBeUndefined();
            expect(allowedHosts.has(new URL(source.url).hostname)).toBe(true);

            for (const fallbackUrl of source.fallbackUrls || []) {
                expect(allowedHosts.has(new URL(fallbackUrl).hostname)).toBe(true);
            }

            for (const supplementalUrl of source.supplementalUrls || []) {
                expect(allowedHosts.has(new URL(supplementalUrl).hostname)).toBe(true);
            }
        }
    });

    it('通知元の一覧取得は既定4回、FF14メンテナンスは5回再試行する', function() {
        const ff14Maintenance = __testables.SOURCES.find(function(source) {
            return source.game === 'FF14_MAINTENANCE';
        });
        const lol = __testables.SOURCES.find(function(source) {
            return source.game === 'LoL';
        });

        expect(__testables.getSourceFetchOptions(lol).attempts).toBe(4);
        expect(__testables.getSourceFetchOptions(ff14Maintenance).attempts).toBe(5);
    });

    it('OWは構造化された公式パッチ一覧を解析できる', async function() {
        const fixture = await readNotificationJsonFixture('overwatch-structured-patch-note.json');
        const html = await readNotificationFixture(fixture.htmlFile);
        const result = await __testables.parseOverwatchPatchNotes(
            html,
            fixture.source.url,
            fixture.source.game,
            fixture.source.options
        );

        expect(result).toEqual([expect.objectContaining(fixture.expectedPatchNote)]);
    });

    it('PoE2は公式フォーラムのホットフィックスも通知対象にする', async function() {
        const fixture = await readNotificationJsonFixture('poe2-forum-notifications.json');
        const html = await readNotificationFixture(fixture.htmlFile);
        const result = await __testables.parsePoe2PatchNotes(
            html,
            fixture.source.url,
            fixture.source.game,
            fixture.source.options
        );

        expect(result.map(function(item) {
            return {
                title: item.title,
                url: item.url
            };
        })).toEqual(fixture.expectedNotes);
    });

    it('Discord送信失敗は監視Webhookへ一度だけ知らせ、成功後の再発は再通知する', async function() {
        const source = __testables.SOURCES.find(function(item) {
            return item.game === 'LoL';
        });
        const originalParser = source.parser;
        const originalPostLatestOnFirstRun = source.postLatestOnFirstRun;
        const values = new Map();
        const alertPosts = [];
        let sourceWebhookAvailable = false;
        let revision = 1;
        source.postLatestOnFirstRun = true;
        source.parser = async function() {
            return [{
                id: 'synthetic-delivery-' + revision,
                title: 'Synthetic delivery notification',
                description: '',
                date: '',
                url: 'https://example.test/notification/' + revision,
                imageUrl: ''
            }];
        };

        const env = {
            DISCORD_WEBHOOK_URL_LOL: 'https://discord.test/source-webhook',
            DISCORD_ALERT_WEBHOOK_URL: 'https://discord.test/alert-webhook',
            PATCHNOTE_KV: {
                get: async function(key) {
                    return values.get(key) || null;
                },
                put: async function(key, value) {
                    values.set(key, value);
                },
                delete: async function(key) {
                    values.delete(key);
                }
            }
        };

        vi.stubGlobal('fetch', async function(input, options) {
            const requestUrl = String(input);

            if (requestUrl.startsWith('https://discord.test/alert-webhook')) {
                alertPosts.push(JSON.parse(options.body));
                return new Response(null, { status: 204 });
            }

            if (requestUrl.startsWith('https://discord.test/source-webhook')) {
                return sourceWebhookAvailable
                    ? new Response(null, { status: 204 })
                    : new Response('', { status: 500 });
            }

            return new Response('synthetic source list', { status: 200 });
        });

        try {
            const firstResults = await __testables.runPatchNoteChecks(env);
            const secondResults = await __testables.runPatchNoteChecks(env);

            expect(firstResults).toContainEqual(expect.objectContaining({
                game: 'LoL',
                status: 'post_failed_retry_pending',
                alertStatus: 'sent'
            }));
            expect(secondResults).toContainEqual(expect.objectContaining({
                game: 'LoL',
                status: 'post_failed_retry_pending',
                alertStatus: 'already_notified'
            }));
            expect(alertPosts).toHaveLength(1);

            sourceWebhookAvailable = true;
            const recoveredResults = await __testables.runPatchNoteChecks(env);

            expect(recoveredResults).toContainEqual(expect.objectContaining({
                game: 'LoL',
                status: 'posted'
            }));
            expect(values.has('delivery-failure-alert:LoL')).toBe(false);

            revision = 2;
            sourceWebhookAvailable = false;
            const recurringFailureResults = await __testables.runPatchNoteChecks(env);

            expect(recurringFailureResults).toContainEqual(expect.objectContaining({
                game: 'LoL',
                status: 'post_failed_retry_pending',
                alertStatus: 'sent'
            }));
            expect(alertPosts).toHaveLength(2);
        } finally {
            source.parser = originalParser;

            if (originalPostLatestOnFirstRun === undefined) {
                delete source.postLatestOnFirstRun;
            } else {
                source.postLatestOnFirstRun = originalPostLatestOnFirstRun;
            }
        }
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
