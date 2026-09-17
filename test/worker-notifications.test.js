import { afterEach, describe, expect, it, vi } from 'vitest';
import { __testables } from '../workers/discord-bot/worker.js';

function getSourceForParser(parser) {
    const source = __testables.SOURCES.find(function(item) {
        return item.parser === parser;
    });

    if (!source) {
        throw new Error('Notification source was not configured for parser.');
    }

    return source;
}

function createFixtureDate() {
    const now = new Date();

    return new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds()
    ));
}

function offsetFixtureDate(baseDate, dayOffset) {
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() + dayOffset);

    return date;
}

function padFixtureDatePart(value) {
    return String(value).padStart(2, '0');
}

function formatGenshinFixtureDate(date) {
    return `${date.getUTCFullYear()}-${padFixtureDatePart(date.getUTCMonth() + 1)}-${padFixtureDatePart(date.getUTCDate())} ${padFixtureDatePart(date.getUTCHours())}:${padFixtureDatePart(date.getUTCMinutes())}:${padFixtureDatePart(date.getUTCSeconds())}`;
}

function formatOverwatchFixtureDate(date) {
    return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatOverwatchEnglishFixtureDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function createGenshinOfficialNewsFixture() {
    const source = getSourceForParser(__testables.parseGenshinOfficialNews);
    const baseDate = createFixtureDate();
    const dates = [
        offsetFixtureDate(baseDate, -2),
        baseDate,
        offsetFixtureDate(baseDate, -1)
    ];
    const entries = dates.map(function(date, index) {
        const id = `${date.getTime()}${index}`;

        return {
            iInfoId: id,
            sTitle: `fixture-notice-${id}`,
            dtStartTime: formatGenshinFixtureDate(date)
        };
    });
    const expectedIds = [entries[1].iInfoId, entries[2].iInfoId];

    return {
        response: {
            data: {
                list: entries
            }
        },
        source: {
            ...source,
            maxItems: expectedIds.length
        },
        expectedIds: expectedIds
    };
}

function createOverwatchJapanesePatchFixture(date) {
    const formattedDate = formatOverwatchFixtureDate(date);

    return {
        date: formattedDate,
        title: `${formattedDate} 配信パッチ内容のお知らせ`
    };
}

function createOverwatchEnglishPatchHtml(date) {
    return `<div>Overwatch 2 Retail Patch Notes - ${formatOverwatchEnglishFixtureDate(date)}</div>`;
}

function createOverwatchStructuredPatchFixture() {
    const source = getSourceForParser(__testables.parseOverwatchPatchNotes);
    const date = createFixtureDate();
    const title = `fixture-patch-${date.getTime()}`;

    return {
        source: source,
        html: [
            `<div class="PatchNotes-patch" id="patch-${date.toISOString().slice(0, 10)}">`,
            `<h2 class="PatchNotes-patchTitle">${title}</h2>`,
            `<span class="PatchNotes-date">${formatOverwatchEnglishFixtureDate(date)}</span>`,
            '</div>'
        ].join(''),
        expectedPatchNote: {
            title: title,
            date: formatOverwatchFixtureDate(date),
            url: source.url
        }
    };
}

function createPoe2ForumFixture(kinds) {
    const source = getSourceForParser(__testables.parsePoe2PatchNotes);
    const date = createFixtureDate();
    const version = [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    ].join('.');
    const notificationKinds = kinds || ['ホットフィックス', 'パッチノート'];
    const expectedNotes = notificationKinds.map(function(kind, index) {
        const articleId = `${date.getTime()}-${index}`;
        const url = new URL(`/forum/view-thread/${articleId}`, source.url).href;

        return {
            title: `fixture ${version} ${kind}`,
            url: url
        };
    });

    return {
        source: source,
        html: expectedNotes.map(function(note) {
            return `<a href="${new URL(note.url).pathname}">${note.title}</a>`;
        }).join(''),
        expectedNotes: expectedNotes
    };
}

function createGenshinArticleFixture(source, externalUrl) {
    const date = createFixtureDate();
    const id = String(date.getTime());

    return {
        iInfoId: id,
        sTitle: `fixture-notice-${id}`,
        sUrl: externalUrl,
        dtStartTime: formatGenshinFixtureDate(date),
        sIntro: `fixture-content-${id}`,
        categoryName: source.categoryName
    };
}

function createFf14MaintenanceFixture(isEmergency) {
    const source = getSourceForParser(__testables.parseFf14WorldMaintenance);
    const articleId = `fixture-${createFixtureDate().getTime()}`;
    const maintenanceType = isEmergency ? '緊急メンテナンス作業' : 'メンテナンス作業';
    const title = `全ワールド ${maintenanceType}のお知らせ`;
    const path = `/lodestone/news/detail/${articleId}`;

    return {
        source: source,
        title: title,
        url: new URL(path, source.url).href,
        html: `<a href="${path}">[続報] ${title}</a>`
    };
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
        const source = getSourceForParser(__testables.parseOverwatchPatchNotes);
        const date = createFixtureDate();
        const patchNote = __testables.applySourceDedupeOptions(source, {
            id: `fixture-patch-${date.getTime()}`,
            url: source.url
        });

        expect(__testables.getStoredPatchNoteIds(patchNote)).toEqual([
            `id:${patchNote.id}`
        ]);
        expect(__testables.isPostedPatchNote(new Set([
            `url:${source.url}`
        ]), patchNote)).toBe(false);
    });

    it('OW の日本語と英語の同一ページ更新から最新日付を拾う', async function() {
        const source = getSourceForParser(__testables.parseOverwatchPatchNotes);
        const latestDate = createFixtureDate();
        const japanesePatch = createOverwatchJapanesePatchFixture(latestDate);
        const html = [
            createOverwatchEnglishPatchHtml(offsetFixtureDate(latestDate, -1)),
            `<div>${japanesePatch.title}</div>`
        ].join('');

        const result = await __testables.parseOverwatchPatchNotes(html, source.url);

        expect(result).toEqual([expect.objectContaining({
            id: `${japanesePatch.date}:${japanesePatch.title}`,
            title: japanesePatch.title,
            date: japanesePatch.date,
            url: source.url
        })]);
    });

    it('OW はキャッシュを回避し英語公式ページからも最新更新を補完する', async function() {
        const source = getSourceForParser(__testables.parseOverwatchPatchNotes);
        const latestDate = createFixtureDate();
        const latestDateText = formatOverwatchFixtureDate(latestDate);
        const requests = [];

        vi.stubGlobal('fetch', async function(url, options) {
            const requestUrl = String(url);
            requests.push({
                url: requestUrl,
                options: options
            });

            const body = requestUrl.includes('/en-us/')
                ? createOverwatchEnglishPatchHtml(latestDate)
                : `<div>${createOverwatchJapanesePatchFixture(offsetFixtureDate(latestDate, -1)).title}</div>`;

            return {
                ok: true,
                text: async function() {
                    return body;
                }
            };
        });

        const html = await __testables.fetchSourceText(source);
        const result = await __testables.parseOverwatchPatchNotes(html, source.url);
        const expectedTitle = `[オーバーウォッチ] ${latestDateText}配信パッチ内容`;

        expect(result).toEqual([expect.objectContaining({
            id: `${latestDateText}:${expectedTitle}`,
            title: expectedTitle,
            date: latestDateText,
            url: source.url
        })]);
        const expectedRequestUrls = [source.url].concat(source.supplementalUrls || []);
        expect(requests.map(function(request) {
            return request.url;
        })).toEqual(expectedRequestUrls);

        for (const request of requests) {
            expect(request.options.cache).toBe('no-store');
            expect(request.options.cf).toBeUndefined();
        }
    });

    it('PoE2はフォーラム一覧のCDNキャッシュを回避して最新記事を拾う', async function() {
        const fixture = createPoe2ForumFixture(['コンテンツアップデート']);
        const requests = [];

        vi.stubGlobal('fetch', async function(url, options) {
            requests.push({
                url: String(url),
                options: options
            });

            return {
                ok: true,
                text: async function() {
                    return fixture.html;
                }
            };
        });

        const html = await __testables.fetchSourceText(fixture.source);
        const result = await __testables.parsePoe2PatchNotes(html, fixture.source.url, fixture.source.game, fixture.source);

        expect(result).toEqual([expect.objectContaining({
            id: fixture.expectedNotes[0].url,
            title: fixture.expectedNotes[0].title,
            url: fixture.expectedNotes[0].url
        })]);
        expect(requests).toHaveLength(1 + (fixture.source.supplementalUrls || []).length);
        expect(requests[0].url).toBe(fixture.source.url);
        expect(requests[0].options.cache).toBe('no-store');
        expect(requests[0].options.cf).toBeUndefined();
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

        const expectedRequestUrls = __testables.SOURCES.reduce(function(urls, source) {
            return urls.concat([source.url], source.supplementalUrls || []);
        }, []);

        expect(requests.map(function(request) {
            return request.url;
        })).toEqual(expectedRequestUrls);

        for (const request of requests) {
            expect(request.options.cache).toBe('no-store');
            expect(request.options.cf).toBeUndefined();
        }
    });

    it('原神APIの外部sUrlでも公式記事URLを優先する', function() {
        const source = getSourceForParser(__testables.parseGenshinOfficialNews);
        const externalUrl = new URL(`/external-video/${createFixtureDate().getTime()}`, 'https://example.test').href;
        const article = createGenshinArticleFixture(source, externalUrl);
        const result = __testables.parseGenshinContentListApi(JSON.stringify({
            data: {
                list: [article]
            }
        }), source);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: article.iInfoId,
            title: article.sTitle,
            category: source.categoryName
        });
        expect(result[0].url).not.toBe(externalUrl);
        expect(new URL(result[0].url).pathname).toContain(article.iInfoId);
    });

    it('原神は公式APIの複数記事を公開日時順に保持する', async function() {
        const fixture = createGenshinOfficialNewsFixture();
        const result = await __testables.parseGenshinOfficialNews(
            JSON.stringify(fixture.response),
            fixture.source.url,
            fixture.source.game,
            fixture.source
        );

        expect(result.map(function(item) {
            return item.id;
        })).toEqual(fixture.expectedIds);
    });
    it('FF14メンテナンスは通常・緊急を拾い、アプリ系は除外する', function() {
        const normalMaintenance = createFf14MaintenanceFixture(false);
        const emergencyMaintenance = createFf14MaintenanceFixture(true);

        expect(__testables.isFf14MaintenanceNewsTitle(normalMaintenance.title)).toBe(true);
        expect(__testables.isFf14MaintenanceNewsTitle(emergencyMaintenance.title)).toBe(true);
        expect(__testables.isFf14MaintenanceNewsTitle('コンパニオンアプリ 緊急メンテナンス作業のお知らせ')).toBe(false);
    });

    it('FF14通常メンテは記事詳細取得に失敗しても一覧タイトルで通知対象を作る', async function() {
        const fixture = createFf14MaintenanceFixture(false);

        vi.stubGlobal('fetch', async function() {
            throw new Error('network timeout');
        });

        const result = await __testables.parseFf14WorldMaintenance(fixture.html, fixture.source.url);

        expect(result).toEqual([
            expect.objectContaining({
                id: fixture.url,
                title: fixture.title,
                url: fixture.url
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
                message: expect.stringContaining('source fetch failed (FF14_MAINTENANCE):')
            }));
            expect(secondResults).toContainEqual(expect.objectContaining({
                game: 'FF14_MAINTENANCE',
                status: 'error',
                message: expect.stringContaining('source fetch failed (FF14_MAINTENANCE):')
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

    it('通知元の一覧取得は接続上限内に収まる再試行回数にする', function() {
        const ff14Maintenance = __testables.SOURCES.find(function(source) {
            return source.game === 'FF14_MAINTENANCE';
        });
        const lol = __testables.SOURCES.find(function(source) {
            return source.game === 'LoL';
        });

        expect(__testables.getSourceFetchOptions(lol).attempts).toBe(2);
        expect(__testables.getSourceFetchOptions(ff14Maintenance).attempts).toBe(3);
    });

    it('通知元の確認は同時に2件までに制限して結果順を保持する', async function() {
        const items = Array.from({ length: 6 }, function(_value, index) {
            return index;
        });
        let activeCount = 0;
        let maxActiveCount = 0;

        const results = await __testables.mapWithConcurrency(items, 2, async function(item) {
            activeCount += 1;
            maxActiveCount = Math.max(maxActiveCount, activeCount);
            await new Promise(function(resolve) {
                setTimeout(resolve, 5);
            });
            activeCount -= 1;
            return item * 2;
        });

        expect(maxActiveCount).toBe(2);
        expect(results).toEqual(items.map(function(item) {
            return item * 2;
        }));
    });

    it('一覧取得が全て失敗した場合は実際の取得エラーを返す', async function() {
        const fixtureId = createFixtureDate().getTime();
        const source = {
            game: `fixture-${fixtureId}`,
            url: `https://example.test/source/${fixtureId}`,
            forceFreshFetch: true,
            fetchAttempts: 1,
            fetchRetryWaitMilliseconds: 0
        };

        vi.stubGlobal('fetch', async function() {
            return new Response(null, { status: 503 });
        });

        await expect(__testables.fetchSourceText(source)).rejects.toThrow(
            `source fetch failed (${source.game}): fetch failed: 503 ${source.url}`
        );
    });

    it('OWは構造化された公式パッチ一覧を解析できる', async function() {
        const fixture = createOverwatchStructuredPatchFixture();
        const result = await __testables.parseOverwatchPatchNotes(
            fixture.html,
            fixture.source.url,
            fixture.source.game,
            fixture.source
        );

        expect(result).toEqual([expect.objectContaining(fixture.expectedPatchNote)]);
    });

    it('PoE2は公式フォーラムのホットフィックスも通知対象にする', async function() {
        const fixture = createPoe2ForumFixture();
        const result = await __testables.parsePoe2PatchNotes(
            fixture.html,
            fixture.source.url,
            fixture.source.game,
            fixture.source
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
