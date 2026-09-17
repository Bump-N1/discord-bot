const LOCK_KEY = 'lock:global';
const LOCK_TTL_SECONDS = 180;
const LOCK_TTL_MILLISECONDS = LOCK_TTL_SECONDS * 1000;
const LOCK_CONFIRM_WAIT_MILLISECONDS = 700;
const POSTED_HISTORY_LIMIT = 100;
const FETCH_TIMEOUT_MILLISECONDS = 10000;
const FETCH_RETRY_WAIT_MILLISECONDS = 1000;
const SOURCE_FETCH_ATTEMPTS = 2;
const SOURCE_CHECK_CONCURRENCY = 2;
const SOURCE_FAILURE_ALERT_WEBHOOK_ENV_NAME = 'DISCORD_ALERT_WEBHOOK_URL';
const FF14_MAINTENANCE_ARTICLE_TIMEOUT_MILLISECONDS = 8000;
const ENRICHMENT_FETCH_TIMEOUT_MILLISECONDS = 8000;
const DISCORD_POST_TIMEOUT_MILLISECONDS = 10000;
const GENSHIN_APP_ID = 'a1b1f9d3315447cc';
const GENSHIN_API_ROOT = 'https://sg-public-api-static.hoyoverse.com/content_v2_user';
const GENSHIN_SITE_ROOT = 'https://genshin.hoyoverse.com';
const GENSHIN_LANG_KEY = 'ja-jp';
const DEFAULT_DISCORD_PRESENTATION = {
    embedTitle: '📝 パッチノート更新',
    color: 0x5865F2,
    botName: '📝 PATCHNOTE',
    avatarUrl: ''
};
const DISCORD_PRESENTATIONS = {
    LoL: {
        embedTitle: '📝 LoL パッチノート更新',
        color: 0x5865F2,
        botName: '📝 PATCHNOTE【LoL】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://www.leagueoflegends.com&sz=128'
    },
    TFT: {
        embedTitle: '📝 TFT パッチノート更新',
        color: 0x5865F2,
        botName: '📝 PATCHNOTE【TFT】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://teamfighttactics.leagueoflegends.com&sz=128'
    },
    OW: {
        embedTitle: '📝 OW パッチノート更新',
        color: 0x5865F2,
        botName: '📝 PATCHNOTE【OW】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://overwatch.blizzard.com&sz=128'
    },
    PoE2: {
        embedTitle: '📝 PoE2 パッチノート更新',
        color: 0x5865F2,
        botName: '📝 PATCHNOTE【PoE2】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://jp.pathofexile.com&sz=128'
    },
    FF14: {
        embedTitle: '📝 FF14 パッチノート更新',
        color: 0x5865F2,
        botName: '📝 PATCHNOTE【FF14】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://jp.finalfantasyxiv.com&sz=128'
    },
    FF14_MAINTENANCE: {
        embedTitle: '🔨 FF14 メンテナンス情報更新',
        color: 0xE53935,
        botName: '🔨 MAINTENANCE【FF14】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://jp.finalfantasyxiv.com&sz=128'
    },
    Genshin_NOTICE: {
        embedTitle: '📝 原神 告知更新',
        color: 0x5865F2,
        botName: '📝 NOTICE【Genshin】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://genshin.hoyoverse.com&sz=128'
    },
    Genshin_NEWS: {
        embedTitle: '📝 原神 お知らせ更新',
        color: 0x5865F2,
        botName: '📝 NEWS【Genshin】',
        avatarUrl: 'https://www.google.com/s2/favicons?domain_url=https://genshin.hoyoverse.com&sz=128'
    }
};

const SOURCES = [
    {
        game: 'FF14_MAINTENANCE',
        displayName: 'FF14メンテナンス情報',
        url: 'https://jp.finalfantasyxiv.com/lodestone/news/category/2',
        forceFreshFetch: true,
        webhookEnvName: 'DISCORD_MAINTENANCE_FF14',
        parser: parseFf14WorldMaintenance,
        enrichPatchNote: enrichFf14MaintenancePatchNote,
        checkMultiple: true,
        maxItems: 30,
        postLatestOnFirstRun: true,
        retryUnconfirmedLatest: true,
        fetchAttempts: 3,
        fetchRetryWaitMilliseconds: 1000
    },
    {
        game: 'LoL',
        displayName: 'LoLパッチノート',
        url: 'https://www.leagueoflegends.com/ja-jp/news/tags/patch-notes/',
        forceFreshFetch: true,
        webhookEnvName: 'DISCORD_WEBHOOK_URL_LOL',
        parser: parseRiotPatchNotes,
        enrichPatchNote: enrichRiotPatchNote,
        checkMultiple: true,
        maxItems: 10
    },
    {
        game: 'TFT',
        displayName: 'TFTパッチノート',
        url: 'https://teamfighttactics.leagueoflegends.com/ja-jp/news/tags/patch-notes/',
        forceFreshFetch: true,
        webhookEnvName: 'DISCORD_WEBHOOK_URL_TFT',
        parser: parseRiotPatchNotes,
        enrichPatchNote: enrichRiotPatchNote,
        checkMultiple: true,
        maxItems: 10
    },
    {
        game: 'OW',
        displayName: 'OWパッチノート',
        url: 'https://overwatch.blizzard.com/ja-jp/news/patch-notes/',
        supplementalUrls: [
            'https://overwatch.blizzard.com/en-us/news/patch-notes/'
        ],
        forceFreshFetch: true,
        webhookEnvName: 'DISCORD_WEBHOOK_URL_OW',
        parser: parseOverwatchPatchNotes,
        dedupeByUrl: false,
        checkMultiple: true,
        maxItems: 20
    },
    {
        game: 'PoE2',
        displayName: 'PoE2パッチノート',
        url: 'https://jp.pathofexile.com/forum/view-forum/2294',
        forceFreshFetch: true,
        webhookEnvName: 'DISCORD_WEBHOOK_URL_POE2',
        parser: parsePoe2PatchNotes,
        checkMultiple: true,
        maxItems: 30
    },
    {
        game: 'FF14',
        displayName: 'FF14パッチノート',
        url: 'https://jp.finalfantasyxiv.com/lodestone/special/patchnote_log/',
        forceFreshFetch: true,
        webhookEnvName: 'DISCORD_WEBHOOK_URL_FF14',
        parser: parseFf14PatchNotes,
        enrichPatchNote: enrichFf14PatchNote,
        checkMultiple: true,
        maxItems: 10
    },
    {
        game: 'Genshin_NOTICE',
        displayName: '原神告知',
        url: buildGenshinContentListApiUrl(396, 20),
        forceFreshFetch: true,
        fallbackUrls: [
            'https://genshin.hoyoverse.com/ja/news/396',
            'https://genshin.hoyoverse.com/m/ja/news'
        ],
        webhookEnvName: 'DISCORD_WEBHOOK_URL_GENSHIN_NOTICE',
        parser: parseGenshinOfficialNews,
        enrichPatchNote: enrichGenshinPatchNote,
        checkMultiple: true,
        categoryName: '告知',
        categoryId: 396,
        maxItems: 20
    },
    {
        game: 'Genshin_NEWS',
        displayName: '原神お知らせ',
        url: buildGenshinContentListApiUrl(397, 20),
        forceFreshFetch: true,
        fallbackUrls: [
            'https://genshin.hoyoverse.com/ja/news/397',
            'https://genshin.hoyoverse.com/m/ja/news'
        ],
        webhookEnvName: 'DISCORD_WEBHOOK_URL_GENSHIN_NEWS',
        parser: parseGenshinOfficialNews,
        enrichPatchNote: enrichGenshinPatchNote,
        checkMultiple: true,
        categoryName: 'お知らせ',
        categoryId: 397,
        maxItems: 20
    }
];

export default {
    async scheduled(_controller, env, ctx) {
        ctx.waitUntil(runScheduledCheck(env));
    },

    async fetch(_request, env) {
        const results = await checkPatchNotes(env);

        return new Response(JSON.stringify(results, null, 2), {
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            }
        });
    }
};

async function runScheduledCheck(env) {
    const results = await checkPatchNotes(env);

    console.log(JSON.stringify(results, null, 2));
}

async function checkPatchNotes(env) {
    const lock = await acquireExecutionLock(env);

    if (!lock.acquired) {
        return [{
            game: 'ALL',
            status: 'skipped_locked',
            message: lock.message
        }];
    }

    try {
        return await runPatchNoteChecks(env);
    } finally {
        await releaseExecutionLock(env, lock.token);
    }
}

async function runPatchNoteChecks(env) {
    const sourceResultGroups = await mapWithConcurrency(
        SOURCES,
        SOURCE_CHECK_CONCURRENCY,
        function(source) {
            return runSourceCheck(env, source);
        }
    );

    return sourceResultGroups.flat();
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, function() {
        return runWorker();
    }));

    return results;
}

async function runSourceCheck(env, source) {
    const results = [];
    const webhookUrl = env && source ? env[source.webhookEnvName] : '';

    if (!webhookUrl) {
        results.push({
            game: source.game,
            status: 'skipped',
            message: `${source.webhookEnvName} is not set`
        });
        return results;
    }

    try {
        const listHtml = await fetchSourceText(source);

        if (!listHtml) {
            await recordSourceFailure(results, env, source, webhookUrl, 'failed to fetch source page');
            return results;
        }

        const parsedPatchNotes = await source.parser(listHtml, source.url, source.game, source);
        const patchNotes = getValidPatchNotes(parsedPatchNotes);

        if (patchNotes.length === 0) {
            await recordSourceFailure(results, env, source, webhookUrl, 'latest patch note was not found');
            return results;
        }

        await clearSourceFailureAlert(env, source);

        const resultStartIndex = results.length;
        await processPatchNotes(env, source, webhookUrl, patchNotes, results);
        await updateDeliveryFailureAlert(env, source, webhookUrl, results.slice(resultStartIndex));
    } catch (error) {
        const failureMessage = getSourceFailureMessage(error);
        await recordSourceFailure(results, env, source, webhookUrl, failureMessage);
        console.warn(JSON.stringify({
            game: source.game,
            status: 'source_processing_failed',
            message: failureMessage
        }));
    }

    return results;
}

function getValidPatchNotes(parsedPatchNotes) {
    const patchNotes = Array.isArray(parsedPatchNotes)
        ? parsedPatchNotes
        : [parsedPatchNotes].filter(Boolean);

    return uniquePatchNotes(patchNotes).filter(function(patchNote) {
        return patchNote
            && cleanupText(patchNote.id)
            && cleanupText(patchNote.title)
            && cleanupText(patchNote.url);
    });
}

async function recordSourceFailure(results, env, source, webhookUrl, message) {
    const alertStatus = await notifySourceFailure(env, source, webhookUrl, message);

    results.push({
        game: source.game,
        status: 'error',
        message: message,
        alertStatus: alertStatus
    });
}

async function fetchSourceText(source) {
    const urls = [source.url].concat(source.supplementalUrls || []);
    const responses = await Promise.all(urls.map(async function(url) {
        try {
            return {
                text: await fetchText(url, getSourceFetchOptions(source)),
                error: null
            };
        } catch (error) {
            return {
                text: '',
                error: error
            };
        }
    }));
    const responseText = responses.map(function(response) {
        return response.text;
    }).filter(Boolean).join('\n');

    if (responseText) {
        return responseText;
    }

    const failures = responses.map(function(response) {
        return response.error && response.error.message;
    }).filter(Boolean);

    if (failures.length > 0) {
        throw new Error(`source fetch failed (${source.game}): ${failures.join(' | ')}`);
    }

    return '';
}

function getSourceFailureMessage(error) {
    const message = error && error.message ? String(error.message) : 'unexpected source processing failure';
    return message.slice(0, 500);
}

function getSourceFetchOptions(source, options = {}) {
    return {
        attempts: source && source.fetchAttempts ? source.fetchAttempts : SOURCE_FETCH_ATTEMPTS,
        retryWaitMilliseconds: source && source.fetchRetryWaitMilliseconds,
        ...options,
        forceFreshFetch: source && source.forceFreshFetch === true
    };
}

function getSourceFailureAlertKey(source) {
    return 'source-failure-alert:' + source.game;
}

function getDeliveryFailureAlertKey(source) {
    return 'delivery-failure-alert:' + source.game;
}

function getSourceDisplayName(source) {
    return source.displayName || `${source.game} 更新情報`;
}

async function notifySourceFailure(env, source, sourceWebhookUrl, reason) {
    const webhookUrl = env && (env[SOURCE_FAILURE_ALERT_WEBHOOK_ENV_NAME] || sourceWebhookUrl);

    return sendFailureAlert(
        env,
        source,
        getSourceFailureAlertKey(source),
        webhookUrl,
        `⚠️ ${getSourceDisplayName(source)}を取得できません`,
        '公式サイトから一覧を取得または解析できませんでした。復旧するまで定期的に再試行します。' +
            '\n発生理由: ' + reason
    );
}

async function notifyDeliveryFailure(env, source, reason) {
    const webhookUrl = env && env[SOURCE_FAILURE_ALERT_WEBHOOK_ENV_NAME];

    return sendFailureAlert(
        env,
        source,
        getDeliveryFailureAlertKey(source),
        webhookUrl,
        `⚠️ ${getSourceDisplayName(source)}をDiscordへ送信できません`,
        '更新は検出しましたがDiscordへの送信に失敗しました。次回実行時に再送します。' +
            '\n発生理由: ' + reason
    );
}

async function sendFailureAlert(env, source, alertKey, webhookUrl, title, description) {
    if (!env || !source || !env.PATCHNOTE_KV) {
        return 'disabled';
    }

    try {
        if (await env.PATCHNOTE_KV.get(alertKey)) {
            return 'already_notified';
        }

        if (!webhookUrl) {
            return 'alert_webhook_not_configured';
        }

        await postToDiscord(webhookUrl, source.game, {
            id: alertKey,
            title: title,
            description: description,
            date: '',
            url: source.url,
            imageUrl: ''
        });

        await env.PATCHNOTE_KV.put(alertKey, JSON.stringify({
            alertedAt: new Date().toISOString()
        }));
        return 'sent';
    } catch (error) {
        console.warn(JSON.stringify({
            game: source.game,
            status: 'failure_alert_failed',
            message: error.message
        }));
        return 'failed';
    }
}

async function clearSourceFailureAlert(env, source) {
    await clearFailureAlert(env, source, getSourceFailureAlertKey(source), 'source_failure_alert_reset_failed');
}

async function clearDeliveryFailureAlert(env, source) {
    await clearFailureAlert(env, source, getDeliveryFailureAlertKey(source), 'delivery_failure_alert_reset_failed');
}

async function clearFailureAlert(env, source, alertKey, failureStatus) {
    if (!env || !source || !env.PATCHNOTE_KV) {
        return;
    }

    try {
        await env.PATCHNOTE_KV.delete(alertKey);
    } catch (error) {
        console.warn(JSON.stringify({
            game: source.game,
            status: failureStatus,
            message: error.message
        }));
    }
}

async function updateDeliveryFailureAlert(env, source, webhookUrl, results) {
    const failedResult = results.find(function(result) {
        return result.status === 'post_failed_retry_pending';
    });

    if (failedResult) {
        const alertStatus = await notifyDeliveryFailure(env, source, failedResult.message);
        failedResult.alertStatus = alertStatus;
        return;
    }

    const postedResult = results.find(function(result) {
        return result.status === 'posted';
    });

    if (postedResult) {
        await clearDeliveryFailureAlert(env, source);
    }
}
async function acquireExecutionLock(env) {
    const token = createLockToken();
    const now = Date.now();
    const currentLock = await getJsonValue(env, LOCK_KEY);

    if (currentLock && currentLock.lockedUntil && Number(currentLock.lockedUntil) > now) {
        return {
            acquired: false,
            token: '',
            message: 'another execution is already running'
        };
    }

    await env.PATCHNOTE_KV.put(LOCK_KEY, JSON.stringify({
        token: token,
        lockedUntil: now + LOCK_TTL_MILLISECONDS
    }), {
        expirationTtl: LOCK_TTL_SECONDS
    });

    await sleep(LOCK_CONFIRM_WAIT_MILLISECONDS);

    const confirmedLock = await getJsonValue(env, LOCK_KEY);

    if (!confirmedLock || confirmedLock.token !== token) {
        return {
            acquired: false,
            token: '',
            message: 'another execution acquired the lock'
        };
    }

    return {
        acquired: true,
        token: token,
        message: ''
    };
}

async function releaseExecutionLock(env, token) {
    if (!token) {
        return;
    }

    const currentLock = await getJsonValue(env, LOCK_KEY);

    if (currentLock && currentLock.token === token) {
        await env.PATCHNOTE_KV.delete(LOCK_KEY);
    }
}

function createLockToken() {
    return crypto.randomUUID();
}

async function getJsonValue(env, key) {
    const value = await env.PATCHNOTE_KV.get(key);

    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
}

async function enrichPatchNoteForPosting(source, patchNote) {
    if (!source || typeof source.enrichPatchNote !== 'function') {
        return patchNote;
    }

    try {
        const enrichedPatchNote = await source.enrichPatchNote({ ...patchNote }, source);

        if (!enrichedPatchNote || typeof enrichedPatchNote !== 'object') {
            return patchNote;
        }

        return {
            ...patchNote,
            ...enrichedPatchNote,
            id: patchNote.id,
            url: patchNote.url,
            title: cleanupText(enrichedPatchNote.title) || patchNote.title
        };
    } catch (error) {
        console.warn(JSON.stringify({
            game: source.game,
            status: 'patch_note_enrichment_failed',
            message: error.message
        }));
        return patchNote;
    }
}

async function enrichRiotPatchNote(patchNote, source) {
    const articleHtml = await fetchText(patchNote.url, getSourceFetchOptions(source, {
        attempts: 1,
        timeoutMilliseconds: ENRICHMENT_FETCH_TIMEOUT_MILLISECONDS
    }));

    if (!articleHtml) {
        return patchNote;
    }

    const articleText = htmlToText(articleHtml);
    const title = findFirstMatch(articleText, getRiotTitlePatterns(source.game))
        || getJapaneseFallbackTitle(patchNote.title)
        || extractMetaContent(articleHtml, 'property', 'og:title')
        || extractMetaContent(articleHtml, 'name', 'twitter:title')
        || patchNote.title;
    const metaDescription = extractMetaContent(articleHtml, 'property', 'og:description')
        || extractMetaContent(articleHtml, 'name', 'description')
        || '';
    const description = containsJapaneseText(metaDescription)
        ? metaDescription
        : extractRiotJapaneseDescription(articleHtml);
    const publishedTime = extractMetaContent(articleHtml, 'property', 'article:published_time')
        || extractMetaContent(articleHtml, 'name', 'article:published_time')
        || '';
    const imageUrl = extractRiotPatchHighlightImage(articleHtml, patchNote.url)
        || extractMetaContent(articleHtml, 'property', 'og:image')
        || extractMetaContent(articleHtml, 'name', 'twitter:image')
        || '';

    return {
        ...patchNote,
        title: cleanupText(title),
        description: cleanupText(description),
        date: formatDateText(publishedTime),
        imageUrl: imageUrl ? normalizeUrl(imageUrl, patchNote.url) : ''
    };
}

async function enrichFf14PatchNote(patchNote, source) {
    const articleHtml = await fetchText(patchNote.url, getSourceFetchOptions(source, {
        attempts: 1,
        timeoutMilliseconds: ENRICHMENT_FETCH_TIMEOUT_MILLISECONDS
    }));

    if (!articleHtml) {
        return patchNote;
    }

    const title = extractMetaContent(articleHtml, 'property', 'og:title')
        || extractMetaContent(articleHtml, 'name', 'twitter:title')
        || patchNote.title;
    const description = extractMetaContent(articleHtml, 'property', 'og:description')
        || extractMetaContent(articleHtml, 'name', 'description')
        || '';
    const imageUrl = extractMetaContent(articleHtml, 'property', 'og:image')
        || extractMetaContent(articleHtml, 'name', 'twitter:image')
        || extractFirstImage(articleHtml, patchNote.url)
        || '';

    return {
        ...patchNote,
        title: cleanupText(title),
        description: cleanupText(description),
        imageUrl: imageUrl ? normalizeUrl(imageUrl, patchNote.url) : ''
    };
}

async function enrichFf14MaintenancePatchNote(patchNote, source) {
    const articleHtml = await fetchText(patchNote.url, getSourceFetchOptions(source, {
        attempts: 1,
        timeoutMilliseconds: FF14_MAINTENANCE_ARTICLE_TIMEOUT_MILLISECONDS
    }));

    if (!articleHtml) {
        return patchNote;
    }

    const articleText = htmlToText(articleHtml);
    const title = extractMetaContent(articleHtml, 'property', 'og:title')
        || extractMetaContent(articleHtml, 'name', 'twitter:title')
        || patchNote.title;
    const description = extractFf14MaintenanceDescription(articleText)
        || extractMetaContent(articleHtml, 'property', 'og:description')
        || extractMetaContent(articleHtml, 'name', 'description')
        || '';

    return {
        ...patchNote,
        title: cleanupLodestoneNewsTitle(title),
        description: cleanupText(description)
    };
}

async function enrichGenshinPatchNote(patchNote, source) {
    const imageUrl = await extractGenshinArticleImageUrl(
        patchNote.url,
        patchNote.id,
        patchNote.imageUrl,
        source
    );

    return imageUrl ? {
        ...patchNote,
        imageUrl: imageUrl
    } : patchNote;
}
async function processPatchNotes(env, source, webhookUrl, patchNotes, results) {
    const postedKey = `posted:${source.game}`;
    const latestKey = `latest:${source.game}`;
    const deliveredKey = source.retryUnconfirmedLatest === true
        ? 'delivered:' + source.game
        : '';
    const postedIds = await getPostedIds(env, postedKey);
    const postedIdSet = new Set(postedIds);
    const validPatchNotes = uniquePatchNotes(patchNotes
        .filter(function(patchNote) {
            return patchNote && patchNote.id && patchNote.url;
        })
        .map(function(patchNote) {
            return applySourceDedupeOptions(source, patchNote);
        }));

    if (validPatchNotes.length === 0) {
        results.push({
            game: source.game,
            status: 'error',
            message: 'patch notes were not found'
        });
        return;
    }

    if (postedIds.length === 0 && env.POST_ON_FIRST_RUN !== 'true' && source.postLatestOnFirstRun !== true) {
        await savePostedIds(env, postedKey, collectStoredIds(validPatchNotes));
        await env.PATCHNOTE_KV.put(latestKey, getStoredPatchNoteId(validPatchNotes[0]));

        results.push({
            game: source.game,
            status: 'initialized',
            count: validPatchNotes.length,
            title: validPatchNotes[0].title,
            url: validPatchNotes[0].url,
            imageUrl: validPatchNotes[0].imageUrl || '',
            message: 'first run. saved current entries without posting'
        });
        return;
    }

    if (postedIds.length === 0 && env.POST_ON_FIRST_RUN !== 'true' && source.postLatestOnFirstRun === true) {
        const patchNote = await enrichPatchNoteForPosting(source, validPatchNotes[0]);

        try {
            await postToDiscord(webhookUrl, source.game, patchNote);
        } catch (error) {
            results.push({
                game: source.game,
                status: 'post_failed_retry_pending',
                title: patchNote.title,
                url: patchNote.url,
                imageUrl: patchNote.imageUrl || '',
                message: error.message
            });
            return;
        }

        await savePostedIds(env, postedKey, collectStoredIds(validPatchNotes));
        if (deliveredKey) {
            await savePostedIds(env, deliveredKey, getStoredPatchNoteIds(patchNote));
        }
        await env.PATCHNOTE_KV.put(latestKey, getStoredPatchNoteId(patchNote));

        results.push({
            game: source.game,
            status: 'posted',
            title: patchNote.title,
            url: patchNote.url,
            imageUrl: patchNote.imageUrl || ''
        });
        return;
    }

    if (source.retryUnconfirmedLatest === true) {
        const latestPatchNote = validPatchNotes[0];
        const deliveredIds = await getPostedIds(env, deliveredKey);
        const deliveredIdSet = new Set(deliveredIds);

        if (isPostedPatchNote(postedIdSet, latestPatchNote)
            && !isPostedPatchNote(deliveredIdSet, latestPatchNote)) {
            const enrichedLatestPatchNote = await enrichPatchNoteForPosting(source, latestPatchNote);

            try {
                await postToDiscord(webhookUrl, source.game, enrichedLatestPatchNote);
            } catch (error) {
                results.push({
                    game: source.game,
                    status: 'post_failed_retry_pending',
                    title: enrichedLatestPatchNote.title,
                    url: enrichedLatestPatchNote.url,
                    imageUrl: enrichedLatestPatchNote.imageUrl || '',
                    message: error.message
                });
                return;
            }

            await savePostedIds(env, deliveredKey, mergePostedIds(
                deliveredIds,
                getStoredPatchNoteIds(enrichedLatestPatchNote)
            ));
            await env.PATCHNOTE_KV.put(latestKey, getStoredPatchNoteId(enrichedLatestPatchNote));

            results.push({
                game: source.game,
                status: 'posted',
                title: enrichedLatestPatchNote.title,
                url: enrichedLatestPatchNote.url,
                imageUrl: enrichedLatestPatchNote.imageUrl || ''
            });
            return;
        }
    }    const unpostedPatchNotes = validPatchNotes.filter(function(patchNote) {
        return !isPostedPatchNote(postedIdSet, patchNote);
    });

    if (unpostedPatchNotes.length === 0) {
        results.push({
            game: source.game,
            status: 'no_update',
            count: validPatchNotes.length,
            title: validPatchNotes[0].title,
            url: validPatchNotes[0].url,
            imageUrl: validPatchNotes[0].imageUrl || ''
        });
        return;
    }

    const postingPatchNotes = source.checkMultiple === true
        ? unpostedPatchNotes.slice().reverse()
        : [unpostedPatchNotes[0]];

    for (const sourcePatchNote of postingPatchNotes) {
        const latestPostedIds = await getPostedIds(env, postedKey);
        const latestPostedIdSet = new Set(latestPostedIds);

        if (isPostedPatchNote(latestPostedIdSet, sourcePatchNote)) {
            results.push({
                game: source.game,
                status: 'skipped_duplicate',
                title: sourcePatchNote.title,
                url: sourcePatchNote.url,
                imageUrl: sourcePatchNote.imageUrl || ''
            });
            continue;
        }

        const patchNote = await enrichPatchNoteForPosting(source, sourcePatchNote);

        try {
            await postToDiscord(webhookUrl, source.game, patchNote);
        } catch (error) {
            results.push({
                game: source.game,
                status: 'post_failed_retry_pending',
                title: patchNote.title,
                url: patchNote.url,
                imageUrl: patchNote.imageUrl || '',
                message: error.message
            });
            continue;
        }

        const newPostedIds = mergePostedIds(latestPostedIds, getStoredPatchNoteIds(patchNote));
        await savePostedIds(env, postedKey, newPostedIds);
        if (deliveredKey) {
            await savePostedIds(env, deliveredKey, getStoredPatchNoteIds(patchNote));
        }
        await env.PATCHNOTE_KV.put(latestKey, getStoredPatchNoteId(patchNote));

        results.push({
            game: source.game,
            status: 'posted',
            title: patchNote.title,
            url: patchNote.url,
            imageUrl: patchNote.imageUrl || ''
        });

        await sleep(1000);
    }
}

async function getPostedIds(env, key) {
    const value = await env.PATCHNOTE_KV.get(key);

    if (!value) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(value);

        if (Array.isArray(parsedValue)) {
            return parsedValue.filter(function(item) {
                return typeof item === 'string' && item;
            });
        }

        if (typeof parsedValue === 'string' && parsedValue) {
            return [parsedValue];
        }

        return [];
    } catch (error) {
        return [String(value)];
    }
}

async function savePostedIds(env, key, postedIds) {
    await env.PATCHNOTE_KV.put(key, JSON.stringify(postedIds.slice(-POSTED_HISTORY_LIMIT)));
}

function applySourceDedupeOptions(source, patchNote) {
    if (source.dedupeByUrl !== false) {
        return patchNote;
    }

    return {
        ...patchNote,
        dedupeByUrl: false
    };
}

function collectStoredIds(patchNotes) {
    let storedIds = [];

    for (const patchNote of patchNotes) {
        storedIds = storedIds.concat(getStoredPatchNoteIds(patchNote));
    }

    return Array.from(new Set(storedIds)).slice(-POSTED_HISTORY_LIMIT);
}

function mergePostedIds(postedIds, newIds) {
    return Array.from(new Set([].concat(postedIds, newIds))).slice(-POSTED_HISTORY_LIMIT);
}

function isPostedPatchNote(postedIdSet, patchNote) {
    return getStoredPatchNoteIds(patchNote).some(function(id) {
        return postedIdSet.has(id);
    });
}

function getStoredPatchNoteId(patchNote) {
    return getStoredPatchNoteIds(patchNote)[0] || '';
}

function getStoredPatchNoteIds(patchNote) {
    const ids = [];

    if (patchNote.id) {
        ids.push(`id:${String(patchNote.id)}`);
    }

    if (patchNote.url && patchNote.dedupeByUrl !== false) {
        ids.push(`url:${normalizeComparableUrl(patchNote.url)}`);
    }

    return ids.filter(Boolean);
}

function uniquePatchNotes(patchNotes) {
    const seen = new Set();
    const unique = [];

    for (const patchNote of patchNotes) {
        if (!patchNote) {
            continue;
        }

        const keys = getPatchNoteKeys(patchNote);

        if (keys.length === 0) {
            continue;
        }

        const hasSeenKey = keys.some(function(key) {
            return seen.has(key);
        });

        if (hasSeenKey) {
            continue;
        }

        for (const key of keys) {
            seen.add(key);
        }

        unique.push(patchNote);
    }

    return unique;
}

function getPatchNoteKeys(patchNote) {
    const keys = [];

    if (patchNote.id) {
        keys.push(`id:${String(patchNote.id)}`);
    }

    if (patchNote.url && patchNote.dedupeByUrl !== false) {
        keys.push(`url:${normalizeComparableUrl(patchNote.url)}`);
    }

    return keys.filter(Boolean);
}

function normalizeComparableUrl(url) {
    return String(url || '')
        .split('#')[0]
        .replace(/[?&]utm_[^&]+/g, '')
        .replace(/[?&]utm[^&]+/g, '')
        .replace(/[?&]$/, '')
        .trim();
}

async function parseRiotPatchNotes(listHtml, baseUrl, game, source) {
    const links = extractLinks(listHtml, baseUrl);
    const maxItems = source && source.maxItems ? source.maxItems : 1;
    const patchLinks = links
        .map(function(link) {
            const version = extractRiotVersion(link.url, link.label, game);

            return {
                url: link.url,
                label: cleanupText(link.label),
                version: version
            };
        })
        .filter(function(link) {
            if (!link.version || !link.url.includes('/news/game-updates/')) {
                return false;
            }

            if (game === 'TFT') {
                return /teamfight-tactics-patch-\d+-\d+/i.test(link.url);
            }

            return /patch-\d+-\d+/i.test(link.url);
        })
        .sort(function(a, b) {
            return compareDottedVersionDesc(a.version, b.version);
        })
        .slice(0, maxItems);

    if (patchLinks.length === 0) {
        return null;
    }

    return patchLinks.map(function(patchLink) {
        return {
            id: patchLink.url,
            title: getRiotListTitle(patchLink.label, game) || `${game} パッチノート更新`,
            description: '',
            date: '',
            url: patchLink.url,
            imageUrl: ''
        };
    });
}
async function parseOverwatchPatchNotes(html, baseUrl, _game, source) {
    const text = htmlToText(html);
    const maxItems = source && source.maxItems ? source.maxItems : 1;
    const japaneseCandidates = extractOverwatchTextCandidates(text, [
        /\[(?:オーバーウォッチ 2|オーバーウォッチ)\][^。]{0,220}?(?:お知らせ|おしらせ|パッチ内容|パッチノート|アップデート)/g,
        /(?:オーバーウォッチ 2|オーバーウォッチ)[^。]{0,80}?20\d{2}年\d{1,2}月\d{1,2}日[^。]{0,180}?(?:お知らせ|おしらせ|パッチ内容|パッチノート|アップデート)/g,
        /20\d{2}年\d{1,2}月\d{1,2}日[^。]{0,180}?(?:配信パッチ内容|パッチ内容|パッチノート|アップデート)(?:のお知らせ|のおしらせ)?/g
    ]);
    const candidates = uniqueOverwatchCandidates(
        japaneseCandidates
            .concat(extractOverwatchEnglishCandidates(text))
            .concat(extractOverwatchStructuredCandidates(html))
    ).filter(function(candidate) {
        return candidate.dateValue > 0;
    });

    if (candidates.length === 0) {
        return null;
    }

    return candidates
        .sort(function(a, b) {
            return b.dateValue - a.dateValue;
        })
        .slice(0, maxItems)
        .map(function(candidate) {
            const title = candidate.title || 'オーバーウォッチ パッチノート更新';

            return {
                id: `${candidate.date}:${title}`,
                title: title,
                description: '',
                date: candidate.date || '',
                url: baseUrl,
                imageUrl: ''
            };
        });
}

function extractOverwatchEnglishCandidates(text) {
    const candidates = [];
    const patterns = [
        /Overwatch(?: 2)?(?: Retail)? Patch Notes\s*[-–—:]\s*([A-Z][a-z]+\.? \d{1,2}, 20\d{2})/g,
        /Overwatch(?: 2)?(?: Retail)? Patch Notes\s*[-–—:]\s*(20\d{2}[/-]\d{1,2}[/-]\d{1,2})/g
    ];

    for (const pattern of patterns) {
        for (const match of String(text || '').matchAll(pattern)) {
            const dateText = cleanupText(match[1]);
            const dateValue = convertOverwatchDateToNumber(dateText);

            if (!dateValue) {
                continue;
            }

            candidates.push({
                title: `[オーバーウォッチ] ${formatOverwatchJapaneseDate(dateValue)}配信パッチ内容`,
                date: formatOverwatchJapaneseDate(dateValue),
                dateValue: dateValue
            });
        }
    }

    return candidates;
}

function extractOverwatchStructuredCandidates(html) {
    const candidates = [];
    const patchBlockPattern = /<div\b[^>]*class=["'][^"']*\bPatchNotes-patch(?:\s|["'])[^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\bPatchNotes-patch(?:\s|["'])|<div\b[^>]*class=["'][^"']*\bPatchNotesPagination(?:\s|["'])|<\/main>|$)/gi;

    for (const match of String(html || '').matchAll(patchBlockPattern)) {
        const block = match[0];
        const title = extractOverwatchClassText(block, 'PatchNotes-patchTitle');

        if (!title) {
            continue;
        }

        const dateText = extractOverwatchClassText(block, 'PatchNotes-date')
            || extractOverwatchPatchAnchorDate(block);
        const dateValue = convertOverwatchDateToNumber(dateText);

        if (!dateValue) {
            continue;
        }

        candidates.push({
            title: title,
            date: formatOverwatchJapaneseDate(dateValue),
            dateValue: dateValue
        });
    }

    return candidates;
}

function extractOverwatchClassText(html, className) {
    const pattern = new RegExp(
        `<([a-z][a-z0-9]*)\\b[^>]*class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
        'i'
    );
    const match = String(html || '').match(pattern);

    return match && match[2] ? cleanupText(htmlToText(match[2])) : '';
}

function extractOverwatchPatchAnchorDate(html) {
    const match = String(html || '').match(/id=["']patch-(20\d{2})-(\d{2})-(\d{2})["']/i);

    if (!match) {
        return '';
    }

    return `${match[1]}-${match[2]}-${match[3]}`;
}
function extractOverwatchTextCandidates(text, patterns) {
    const candidates = [];

    for (const pattern of patterns) {
        for (const match of String(text || '').matchAll(pattern)) {
            const title = cleanupText(match[0]);
            const date = findFirstMatch(title, [
                /20\d{2}年\d{1,2}月\d{1,2}日/
            ]);

            candidates.push({
                title: title,
                date: date,
                dateValue: convertOverwatchDateToNumber(date)
            });
        }
    }

    return candidates;
}

function uniqueOverwatchCandidates(candidates) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
        const key = `${candidate.date}:${candidate.title}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        unique.push(candidate);
    }

    return unique;
}

function convertOverwatchDateToNumber(dateText) {
    const japaneseDateValue = convertJapaneseDateToNumber(dateText);

    if (japaneseDateValue) {
        return japaneseDateValue;
    }

    const englishDateMatch = String(dateText || '').match(/^([A-Z][a-z]+) (\d{1,2}), (20\d{2})$/);
    const englishMonths = {
        January: 1,
        February: 2,
        March: 3,
        April: 4,
        May: 5,
        June: 6,
        July: 7,
        August: 8,
        September: 9,
        October: 10,
        November: 11,
        December: 12
    };

    if (englishDateMatch && englishMonths[englishDateMatch[1]]) {
        const year = Number(englishDateMatch[3]);
        const month = englishMonths[englishDateMatch[1]];
        const day = Number(englishDateMatch[2]);

        return year * 10000 + month * 100 + day;
    }

    const timestamp = Date.parse(String(dateText || ''));

    if (Number.isNaN(timestamp)) {
        return 0;
    }

    const date = new Date(timestamp);

    return date.getUTCFullYear() * 10000
        + (date.getUTCMonth() + 1) * 100
        + date.getUTCDate();
}

function formatOverwatchJapaneseDate(dateValue) {
    if (!dateValue) {
        return '';
    }

    const year = Math.floor(dateValue / 10000);
    const month = Math.floor((dateValue % 10000) / 100);
    const day = dateValue % 100;

    return `${year}年${month}月${day}日`;
}

async function parsePoe2PatchNotes(html, baseUrl, _game, source) {
    const links = extractLinks(html, baseUrl);
    const maxItems = source && source.maxItems ? source.maxItems : 1;
    const patchLinks = links
        .map(function(link) {
            const title = cleanupText(link.label);
            const version = extractVersion(title);

            return {
                title: title,
                version: version,
                url: link.url
            };
        })
        .filter(function(link) {
            return link.url.includes('/forum/view-thread/')
                && link.version
                && (
                    link.title.includes('パッチノート')
                    || link.title.includes('コンテンツアップデート')
                    || /ホットフィックス|hotfix/i.test(link.title)
                );
        })
        .slice(0, maxItems);

    if (patchLinks.length === 0) {
        return null;
    }

    return patchLinks.map(function(link) {
        return {
            id: link.url,
            title: link.title || 'Path of Exile 2 パッチノート更新',
            description: '',
            date: '',
            url: link.url,
            imageUrl: ''
        };
    });
}
async function parseFf14PatchNotes(html, baseUrl, _game, source) {
    const links = extractLinks(html, baseUrl);
    const maxItems = source && source.maxItems ? source.maxItems : 1;
    const patchLinks = links
        .map(function(link) {
            const title = cleanupText(link.label);
            const version = extractFf14Version(title);

            return {
                title: title,
                version: version,
                url: link.url
            };
        })
        .filter(function(link) {
            return !!link.version
                && link.title.includes('パッチノート')
                && !link.title.includes('パッチノート＆パッチ特設サイト一覧');
        })
        .sort(function(a, b) {
            return b.version - a.version;
        })
        .slice(0, maxItems);

    if (patchLinks.length === 0) {
        return null;
    }

    return patchLinks.map(function(patchLink) {
        return {
            id: patchLink.url,
            title: patchLink.title || 'FF14 パッチノート更新',
            description: '',
            date: '',
            url: patchLink.url,
            imageUrl: ''
        };
    });
}
async function parseFf14WorldMaintenance(html, baseUrl, _game, source) {
    const maxItems = source && source.maxItems ? source.maxItems : 10;
    const links = extractLinks(html, baseUrl);
    const maintenanceLinks = links
        .map(function(link) {
            return {
                title: cleanupLodestoneNewsTitle(link.label),
                url: link.url
            };
        })
        .filter(function(link) {
            const normalizedTitle = link.title.replace(/\s+/g, ' ');

            return link.url.includes('/lodestone/news/detail/')
                && isFf14MaintenanceNewsTitle(normalizedTitle);
        })
        .slice(0, maxItems);

    if (maintenanceLinks.length === 0) {
        return null;
    }

    return maintenanceLinks.map(function(maintenanceLink) {
        return {
            id: maintenanceLink.url,
            title: maintenanceLink.title || 'FF14 メンテナンス情報更新',
            description: '',
            date: '',
            url: maintenanceLink.url,
            imageUrl: ''
        };
    });
}
async function parseGenshinOfficialNews(text, baseUrl, game, source) {
    const maxItems = source && source.maxItems ? source.maxItems : 3;
    let patchNotes = parseGenshinContentListApi(text, source);

    if (patchNotes.length === 0 && source && Array.isArray(source.fallbackUrls)) {
        for (const fallbackUrl of source.fallbackUrls) {
            try {
                const fallbackHtml = await fetchText(fallbackUrl, getSourceFetchOptions(source));
                patchNotes = parseGenshinOfficialCategoryPage(fallbackHtml, fallbackUrl, source);

                if (patchNotes.length > 0) {
                    break;
                }
            } catch (error) { }
        }
    }


    const latestNotes = uniquePatchNotes(patchNotes)
        .sort(compareGenshinPatchNoteDesc)
        .slice(0, maxItems);

    return latestNotes;
}

function parseGenshinContentListApi(text, source) {
    const parsedValue = parseJson(text);
    const data = parsedValue && parsedValue.data ? parsedValue.data : null;
    const list = data && Array.isArray(data.list) ? data.list : [];
    const patchNotes = [];

    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const id = String(item.iInfoId || item.iInfoIdStr || item.id || item.info_id || '');
        const title = cleanupText(item.sTitle || item.title || item.name || '');
        const dateText = item.dtStartTime || item.sStartTime || item.dtCreateTime || item.created_at || item.pubDate || '';
        const url = buildGenshinArticleUrl(id, item.sUrl);
        const contentHtml = [
            item.sIntro,
            item.sDescription,
            item.sContent,
            item.content,
            item.description,
            JSON.stringify(item)
        ].filter(Boolean).join('\n');
        const imageUrl = extractBestGenshinImageUrl(contentHtml, url);

        if (!id || !title || !url) {
            continue;
        }

        patchNotes.push({
            id: id,
            title: title,
            description: cleanupText(htmlToText(item.sIntro || item.sDescription || item.description || item.sContent || '')),
            date: formatDateText(dateText),
            category: source && source.categoryName ? source.categoryName : cleanupText(item.sCategoryName || ''),
            dateValue: convertGenshinDateToNumber(dateText),
            order: i,
            url: url,
            imageUrl: imageUrl || ''
        });
    }

    return patchNotes;
}

function parseGenshinOfficialCategoryPage(html, baseUrl, source) {
    const normalizedHtml = normalizeEscapedText(decodeHtmlEntities(String(html || '')));
    const articlePattern = /(?:https?:\/\/genshin\.hoyoverse\.com)?\/(?:m\/)?ja\/news\/detail\/(\d+)/gi;
    const patchNotes = [];
    const seen = new Set();
    let order = 0;

    for (const match of normalizedHtml.matchAll(articlePattern)) {
        if (!match || !match[1]) {
            continue;
        }

        const id = match[1];

        if (seen.has(id)) {
            continue;
        }

        seen.add(id);

        const context = getTextContext(normalizedHtml, match.index || 0, 2500);
        const title = extractGenshinTitleFromContext(context) || `原神 ${source && source.categoryName ? source.categoryName : 'ニュース'}更新`;
        const dateText = extractGenshinDateFromContext(context);
        const url = `${GENSHIN_SITE_ROOT}/ja/news/detail/${id}`;
        const imageUrl = extractBestGenshinImageUrl(context, baseUrl);

        patchNotes.push({
            id: id,
            title: title,
            description: '',
            date: formatDateText(dateText),
            category: source && source.categoryName ? source.categoryName : '',
            dateValue: convertGenshinDateToNumber(dateText),
            order: order,
            url: url,
            imageUrl: imageUrl || ''
        });

        order++;
    }

    return patchNotes;
}

function extractGenshinTitleFromContext(context) {
    const patterns = [
        /"sTitle"\s*:\s*"([^"]+)"/,
        /"title"\s*:\s*"([^"]+)"/,
        /<h1[^>]*>([\s\S]*?)<\/h1>/i,
        /<h2[^>]*>([\s\S]*?)<\/h2>/i
    ];

    for (const pattern of patterns) {
        const match = String(context || '').match(pattern);

        if (match && match[1]) {
            return cleanupText(htmlToText(normalizeEscapedText(match[1])));
        }
    }

    return '';
}

function extractGenshinDateFromContext(context) {
    return findFirstMatch(String(context || ''), [
        /20\d{2}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2})?/,
        /20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]+\d{1,2}:\d{2}(?::\d{2})?)?/
    ]);
}

function compareGenshinPatchNoteDesc(a, b) {
    if (a.dateValue !== b.dateValue) {
        return b.dateValue - a.dateValue;
    }

    if (a.order !== b.order) {
        return (a.order || 0) - (b.order || 0);
    }

    const idA = extractNumericId(a.id || a.url);
    const idB = extractNumericId(b.id || b.url);

    if (idA && idB && idA !== idB) {
        return idB - idA;
    }

    return 0;
}

function extractNumericId(value) {
    const match = String(value || '').match(/(\d{5,})/);

    if (!match || !match[1]) {
        return 0;
    }

    return Number(match[1]);
}

async function extractGenshinArticleImageUrl(articleUrl, articleId, fallbackImageUrl, source) {
    const imageCandidates = [];

    if (fallbackImageUrl) {
        imageCandidates.push({
            url: fallbackImageUrl,
            index: 999999,
            context: '',
            source: 'fallback'
        });
    }

    if (articleId) {
        try {
            const detailApiText = await fetchText(
                buildGenshinContentDetailApiUrl(articleId),
                getSourceFetchOptions(source, {
                    attempts: 1,
                    timeoutMilliseconds: ENRICHMENT_FETCH_TIMEOUT_MILLISECONDS
                })
            );
            imageCandidates.push.apply(imageCandidates, extractGenshinImageCandidates(detailApiText, articleUrl));

            const detailImageUrl = chooseBestGenshinImageUrl(imageCandidates);

            if (detailImageUrl) {
                return detailImageUrl;
            }
        } catch (error) { }
    }

    if (articleUrl) {
        try {
            const articleHtml = await fetchText(articleUrl, getSourceFetchOptions(source, {
                attempts: 1,
                timeoutMilliseconds: ENRICHMENT_FETCH_TIMEOUT_MILLISECONDS
            }));
            imageCandidates.push.apply(imageCandidates, extractGenshinImageCandidates(articleHtml, articleUrl));
        } catch (error) { }
    }

    return chooseBestGenshinImageUrl(imageCandidates);
}
function extractBestGenshinImageUrl(html, baseUrl) {
    return chooseBestGenshinImageUrl(extractGenshinImageCandidates(html, baseUrl));
}

function extractGenshinImageCandidates(html, baseUrl) {
    const candidates = [];
    const normalizedHtml = normalizeEscapedText(decodeHtmlEntities(String(html || '')));
    const tagPattern = /<(?:img|source)\b[^>]*>/gi;

    for (const match of normalizedHtml.matchAll(tagPattern)) {
        if (!match || !match[0]) {
            continue;
        }

        const tag = match[0];
        const imageValues = [
            extractAttributeFromTag(tag, 'src'),
            extractAttributeFromTag(tag, 'data-src'),
            extractAttributeFromTag(tag, 'data-original'),
            extractAttributeFromTag(tag, 'srcset'),
            extractAttributeFromTag(tag, 'data-srcset')
        ];

        for (const imageValue of imageValues) {
            const imageUrl = extractFirstSrcFromSrcset(imageValue);

            if (!imageUrl) {
                continue;
            }

            const normalizedUrl = safeNormalizeUrl(imageUrl, baseUrl);

            if (!normalizedUrl) {
                continue;
            }

            candidates.push({
                url: normalizedUrl,
                index: match.index || 0,
                context: getTextContext(normalizedHtml, match.index || 0, 1000),
                source: 'tag'
            });
        }
    }

    const rawUrlPattern = /https?:\/\/[^\s"'<>\\)]+?\.(?:png|jpg|jpeg|webp)(?:\?[^\s"'<>\\)]*)?/gi;

    for (const match of normalizedHtml.matchAll(rawUrlPattern)) {
        if (!match || !match[0]) {
            continue;
        }

        const normalizedUrl = safeNormalizeUrl(match[0], baseUrl);

        if (!normalizedUrl) {
            continue;
        }

        candidates.push({
            url: normalizedUrl,
            index: match.index || 0,
            context: getTextContext(normalizedHtml, match.index || 0, 1000),
            source: 'raw'
        });
    }

    return uniqueImageCandidates(candidates);
}

function chooseBestGenshinImageUrl(candidates) {
    let bestCandidate = null;

    for (const candidate of uniqueImageCandidates(candidates)) {
        if (!candidate.url || !isLikelyGenshinMainImageUrl(candidate.url, candidate.context)) {
            continue;
        }

        const score = getGenshinImageScore(candidate.url, candidate.index, candidate.context, candidate.source);

        if (bestCandidate === null || score > bestCandidate.score || (score === bestCandidate.score && candidate.index < bestCandidate.index)) {
            bestCandidate = {
                url: candidate.url,
                index: candidate.index,
                score: score
            };
        }
    }

    if (!bestCandidate || bestCandidate.score < 70) {
        return '';
    }

    return bestCandidate.url;
}

function uniqueImageCandidates(candidates) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
        const normalizedUrl = normalizeComparableUrl(candidate.url);

        if (!normalizedUrl || seen.has(normalizedUrl)) {
            continue;
        }

        seen.add(normalizedUrl);
        unique.push(candidate);
    }

    return unique;
}

function extractAttributeFromTag(tag, attributeName) {
    const pattern = new RegExp(`${escapeRegex(attributeName)}=["']([^"']+)["']`, 'i');
    const match = String(tag || '').match(pattern);

    if (!match || !match[1]) {
        return '';
    }

    return decodeHtmlEntities(match[1]);
}

function getTextContext(text, index, range) {
    const start = Math.max(0, index - range);
    const end = Math.min(String(text || '').length, index + range);

    return String(text || '').slice(start, end);
}

function normalizeEscapedText(text) {
    return String(text || '')
        .replace(/\\u([0-9a-fA-F]{4})/g, function(match, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&');
}

function isLikelyGenshinMainImageUrl(imageUrl, context) {
    const lowerUrl = String(imageUrl || '').toLowerCase();
    const lowerContext = String(context || '').toLowerCase();

    if (!lowerUrl) {
        return false;
    }

    if (!/\.(png|jpg|jpeg|webp)(\?|$)/i.test(lowerUrl)) {
        return false;
    }

    if (lowerUrl.includes('favicon')
        || lowerUrl.includes('logo')
        || lowerUrl.includes('icon')
        || lowerUrl.includes('avatar')
        || lowerUrl.includes('sprite')
        || lowerUrl.includes('qrcode')
        || lowerUrl.includes('/qr')
        || lowerUrl.includes('emoji')
        || lowerUrl.includes('hoyoverse-account')
        || lowerUrl.includes('mihoyo-logo')
        || lowerUrl.includes('hoyoverse-logo')
        || lowerUrl.includes('youtube.com')
        || lowerUrl.includes('youtu.be')
        || lowerUrl.includes('ytimg.com')) {
        return false;
    }

    if ((lowerUrl.includes('share') || lowerUrl.includes('social'))
        && !lowerContext.includes('scontent')
        && !lowerContext.includes('content')
        && !lowerContext.includes('article')
        && !lowerContext.includes('cover')) {
        return false;
    }

    return true;
}

function getGenshinImageScore(imageUrl, index, context, source) {
    const lowerUrl = String(imageUrl || '').toLowerCase();
    const lowerContext = String(context || '').toLowerCase();
    let score = 0;

    if (lowerUrl.includes('/content-v2/')) {
        score += 220;
    }

    if (lowerUrl.includes('upload-static.hoyoverse.com')) {
        score += 160;
    }

    if (lowerUrl.includes('fastcdn.hoyoverse.com')) {
        score += 160;
    }

    if (lowerUrl.includes('upload-os-bbs.hoyolab.com')) {
        score += 120;
    }

    if (lowerUrl.includes('act-upload.hoyoverse.com')) {
        score += 110;
    }

    if (lowerUrl.includes('webstatic-sea.hoyoverse.com')) {
        score += 90;
    }

    if (lowerUrl.includes('webstatic.hoyoverse.com')) {
        score += 60;
    }

    if (lowerUrl.includes('upload')) {
        score += 40;
    }

    if (lowerUrl.includes('content')) {
        score += 40;
    }

    if (lowerUrl.includes('cover')) {
        score += 50;
    }

    if (lowerUrl.includes('banner')) {
        score += 30;
    }

    if (source === 'tag') {
        score += 15;
    }

    if (lowerContext.includes('scontent')
        || lowerContext.includes('news-detail')
        || lowerContext.includes('article')
        || lowerContext.includes('content')) {
        score += 80;
    }

    if (lowerContext.includes('cover')
        || lowerContext.includes('kv')
        || lowerContext.includes('banner')) {
        score += 60;
    }

    if (lowerContext.includes('body')
        || lowerContext.includes('detail')) {
        score += 30;
    }

    if (lowerContext.includes('share')
        || lowerContext.includes('sns')
        || lowerContext.includes('favicon')
        || lowerContext.includes('logo')) {
        score -= 120;
    }

    if (lowerUrl.includes('share')
        || lowerUrl.includes('sns')
        || lowerUrl.includes('common')
        || lowerUrl.includes('header')
        || lowerUrl.includes('footer')) {
        score -= 120;
    }

    if (lowerUrl.includes('screenshot')
        || lowerUrl.includes('fullpage')
        || lowerUrl.includes('capture')
        || lowerContext.includes('screenshot')
        || lowerContext.includes('fullpage')
        || lowerContext.includes('capture')) {
        score -= 120;
    }

    const dimensionMatch = lowerUrl.match(/(\d{3,4})x(\d{3,4})/);

    if (dimensionMatch) {
        const width = Number(dimensionMatch[1]);
        const height = Number(dimensionMatch[2]);

        if (width >= 600) {
            score += 30;
        }

        if (height >= 300) {
            score += 20;
        }

        score += Math.min(50, Math.floor((width * height) / 100000));
    }

    if (lowerUrl.includes('bg')
        && !lowerContext.includes('scontent')
        && !lowerContext.includes('content')
        && !lowerContext.includes('article')) {
        score -= 30;
    }

    return score;
}

function buildGenshinArticleUrl(articleId, rawUrl) {
    if (articleId) {
        return `${GENSHIN_SITE_ROOT}/ja/news/detail/${articleId}`;
    }

    if (rawUrl) {
        return normalizeUrl(rawUrl, GENSHIN_SITE_ROOT);
    }

    return '';
}

function buildGenshinContentListApiUrl(categoryId, pageSize) {
    return `${GENSHIN_API_ROOT}/app/${GENSHIN_APP_ID}/getContentList?iPage=1&sLangKey=${GENSHIN_LANG_KEY}&iChanId=${categoryId}&iPageSize=${pageSize}`;
}

function buildGenshinContentDetailApiUrl(articleId) {
    return `${GENSHIN_API_ROOT}/app/${GENSHIN_APP_ID}/getContent?iInfoId=${articleId}&sLangKey=${GENSHIN_LANG_KEY}`;
}
async function postToDiscord(webhookUrl, game, patchNote) {
    const descriptionLines = [];
    const presentation = getDiscordPresentation(game);

    descriptionLines.push(`**${patchNote.title}**`);

    if (patchNote.date) {
        descriptionLines.push(`公開日: ${patchNote.date}`);
    }

    if (patchNote.category) {
        descriptionLines.push(`区分: ${patchNote.category}`);
    }

    if (patchNote.description) {
        descriptionLines.push('');
        descriptionLines.push(truncateText(patchNote.description, 500));
    }

    descriptionLines.push('');
    descriptionLines.push(patchNote.url);

    const embed = {
        title: presentation.embedTitle,
        url: patchNote.url,
        description: truncateText(descriptionLines.join('\n'), 3900),
        color: presentation.color,
        timestamp: new Date().toISOString()
    };

    if (patchNote.imageUrl) {
        embed.image = {
            url: patchNote.imageUrl
        };
    }

    const payload = {
        username: presentation.botName,
        avatar_url: presentation.avatarUrl,
        embeds: [embed]
    };

    for (let retryCount = 0; retryCount < 3; retryCount++) {
        let response;

        try {
            response = await fetchWithTimeout(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }, DISCORD_POST_TIMEOUT_MILLISECONDS);
        } catch (error) {
            if (retryCount < 2) {
                await sleep(FETCH_RETRY_WAIT_MILLISECONDS);
                continue;
            }

            throw new Error(`Discord post failed: ${error.message}`);
        }

        if (response.ok) {
            return;
        }

        const responseText = await response.text();

        if (response.status === 429) {
            const retryAfter = extractDiscordRetryAfter(responseText);
            await sleep(retryAfter + 500);
            continue;
        }

        throw new Error(`Discord post failed ${response.status}: ${responseText}`);
    }

    throw new Error('Discord post failed 429: retry limit exceeded');
}

async function fetchText(url, options = {}) {
    const attempts = options.attempts || 3;
    const timeoutMilliseconds = options.timeoutMilliseconds || FETCH_TIMEOUT_MILLISECONDS;
    const retryWaitMilliseconds = options.retryWaitMilliseconds ?? FETCH_RETRY_WAIT_MILLISECONDS;

    for (let retryCount = 0; retryCount < attempts; retryCount++) {
        try {
            const response = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 discord-patchnote-bot',
                    'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.5,en;q=0.3',
                    'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                cache: options.forceFreshFetch === true ? 'no-store' : undefined
            }, timeoutMilliseconds);

            if (response.ok) {
                return await response.text();
            }

            if (response.body && typeof response.body.cancel === 'function') {
                await response.body.cancel().catch(function() {});
            }

            if (retryCount < attempts - 1) {
                await sleep(retryWaitMilliseconds);
                continue;
            }

            throw new Error(`fetch failed: ${response.status} ${url}`);
        } catch (error) {
            if (retryCount < attempts - 1) {
                await sleep(retryWaitMilliseconds);
                continue;
            }

            if (error && String(error.message || '').startsWith('fetch failed:')) {
                throw error;
            }

            throw new Error(`fetch failed: ${error.message} ${url}`);
        }
    }

    return '';
}


async function fetchWithTimeout(url, options, timeoutMilliseconds) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function() {
        controller.abort();
    }, timeoutMilliseconds);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error(`timeout after ${timeoutMilliseconds}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function extractLinks(html, baseUrl) {
    const links = [];
    const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of String(html || '').matchAll(anchorRegex)) {
        const href = match[1];

        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
            continue;
        }

        links.push({
            url: normalizeUrl(href, baseUrl),
            label: htmlToText(match[2]),
            index: match.index || 0
        });
    }

    return uniqueLinks(links);
}

function uniqueLinks(links) {
    const seen = new Set();
    const unique = [];

    for (const link of links) {
        if (seen.has(link.url)) {
            continue;
        }

        seen.add(link.url);
        unique.push(link);
    }

    return unique;
}

function extractMetaContent(html, attributeName, attributeValue) {
    const patterns = [
        new RegExp(`<meta[^>]+${attributeName}=["']${escapeRegex(attributeValue)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attributeName}=["']${escapeRegex(attributeValue)}["'][^>]*>`, 'i')
    ];

    for (const pattern of patterns) {
        const match = String(html || '').match(pattern);

        if (match && match[1]) {
            return cleanupText(match[1]);
        }
    }

    return '';
}

function extractRiotPatchHighlightImage(articleHtml, articleUrl) {
    const highlightPatterns = [
        /パッチハイライト/,
        /Patch Highlights/i
    ];

    for (const pattern of highlightPatterns) {
        const match = pattern.exec(articleHtml);

        if (!match || typeof match.index !== 'number') {
            continue;
        }

        const slice = articleHtml.slice(match.index, Math.min(articleHtml.length, match.index + 30000));
        const imageUrl = extractFirstImage(slice, articleUrl);

        if (imageUrl) {
            return imageUrl;
        }
    }

    return '';
}

function extractFirstImage(html, baseUrl) {
    const imagePatterns = [
        /<img\b[^>]*src=["']([^"']+)["'][^>]*>/i,
        /<img\b[^>]*data-src=["']([^"']+)["'][^>]*>/i,
        /<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/i,
        /<img\b[^>]*srcset=["']([^"']+)["'][^>]*>/i
    ];

    for (const pattern of imagePatterns) {
        const match = String(html || '').match(pattern);

        if (!match || !match[1]) {
            continue;
        }

        const imageUrl = extractFirstSrcFromSrcset(match[1]);

        if (imageUrl) {
            return normalizeUrl(imageUrl, baseUrl);
        }
    }

    return '';
}

function extractFirstArticleImage(html, baseUrl) {
    const imageUrls = extractImageUrls(html, baseUrl);

    for (const imageUrl of imageUrls) {
        if (isLikelyArticleImageUrl(imageUrl)) {
            return imageUrl;
        }
    }

    return imageUrls[0] || '';
}

function extractImageUrls(html, baseUrl) {
    const imageUrls = [];
    const imagePatterns = [
        /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi,
        /<img\b[^>]*data-src=["']([^"']+)["'][^>]*>/gi,
        /<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi,
        /<img\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi
    ];

    for (const pattern of imagePatterns) {
        for (const match of String(html || '').matchAll(pattern)) {
            if (!match || !match[1]) {
                continue;
            }

            const imageUrl = extractFirstSrcFromSrcset(match[1]);

            if (!imageUrl) {
                continue;
            }

            imageUrls.push(normalizeUrl(imageUrl, baseUrl));
        }
    }

    return imageUrls;
}

function isLikelyArticleImageUrl(imageUrl) {
    const lowerUrl = String(imageUrl || '').toLowerCase();

    if (!lowerUrl) {
        return false;
    }

    if (lowerUrl.includes('favicon')) {
        return false;
    }

    if (lowerUrl.includes('logo')) {
        return false;
    }

    if (lowerUrl.includes('sprite')) {
        return false;
    }

    if (lowerUrl.endsWith('.svg')) {
        return false;
    }

    return true;
}

function extractFirstSrcFromSrcset(srcset) {
    if (!srcset) {
        return '';
    }

    return cleanupText(srcset)
        .split(',')
        .map(function(item) {
            return item.trim().split(/\s+/)[0];
        })
        .filter(Boolean)[0] || '';
}

function normalizeUrl(url, baseUrl) {
    return new URL(url, baseUrl).toString();
}

function safeNormalizeUrl(url, baseUrl) {
    try {
        return normalizeUrl(url, baseUrl);
    } catch (error) {
        return '';
    }
}

function htmlToText(html) {
    return cleanupText(
        String(html || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    );
}

function cleanupText(text) {
    return decodeHtmlEntities(String(text || ''))
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanupLodestoneNewsTitle(text) {
    return cleanupText(text)
        .replace(/^\[[^\]]+\]\s*/g, '')
        .replace(/\s*\|\s*FINAL FANTASY XIV.*$/i, '')
        .replace(/\s*-\s*FINAL FANTASY XIV.*$/i, '')
        .replace(/\s*-\s*The Lodestone.*$/i, '')
        .replace(/\s*document\.getElementById[\s\S]*$/g, '')
        .replace(/\s*-\s*$/, '')
        .trim();
}

function isFf14MaintenanceNewsTitle(title) {
    const normalizedTitle = cleanupText(title);
    const isWorldOrDataCenterMaintenance = normalizedTitle.includes('ワールド')
        || normalizedTitle.includes('データセンター');

    return isWorldOrDataCenterMaintenance
        && (
            normalizedTitle.includes('メンテナンス作業')
            || normalizedTitle.includes('緊急メンテナンス')
        );
}

function extractFf14MaintenanceDescription(text) {
    const maintenanceDateText = extractFf14MaintenanceDateText(text);

    if (!maintenanceDateText) {
        return '';
    }

    return `日時: ${maintenanceDateText}`;
}

function extractFf14MaintenanceDateText(text) {
    const normalizedText = cleanupText(text);
    const match = normalizedText.match(/日\s*時[:：]\s*(20\d{2}年\d{1,2}月\d{1,2}日\([^)]+\)\s*\d{1,2}:\d{2}より\d{1,2}:\d{2}頃まで)/);

    if (!match || !match[1]) {
        return '';
    }

    return cleanupText(match[1]);
}

function decodeHtmlEntities(text) {
    return String(text || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x([0-9a-f]+);/gi, function(match, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/&#(\d+);/g, function(match, number) {
            return String.fromCharCode(parseInt(number, 10));
        });
}

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findFirstMatch(text, patterns) {
    for (const pattern of patterns) {
        const match = String(text || '').match(pattern);

        if (match && match[0]) {
            return cleanupText(match[0]);
        }
    }

    return '';
}

function parseJson(text) {
    try {
        return JSON.parse(String(text || ''));
    } catch (error) {
        return null;
    }
}

function getRiotTitlePatterns(game) {
    if (game === 'TFT') {
        return [
            /チームファイト\s*タクティクス\s*パッチノート\s*\d+(?:\.\d+)?/,
            /TFT\s*パッチノート\s*\d+(?:\.\d+)?/,
            /パッチ\s*\d+(?:\.\d+)?/
        ];
    }

    return [
        /リーグ・オブ・レジェンド\s*パッチノート\s*\d+(?:\.\d+)?/,
        /パッチノート\s*\d+(?:\.\d+)?/
    ];
}

function getRiotListTitle(title, game) {
    return findFirstMatch(title, getRiotTitlePatterns(game))
        || getJapaneseFallbackTitle(title);
}
function getJapaneseFallbackTitle(title) {
    const cleanedTitle = cleanupText(title);

    if (!containsJapaneseText(cleanedTitle)) {
        return '';
    }

    return cleanedTitle;
}

function extractRiotJapaneseDescription(articleHtml) {
    const paragraphTexts = extractHtmlTagTexts(articleHtml, 'p');

    for (const paragraphText of paragraphTexts) {
        const cleanedText = cleanupText(paragraphText);

        if (!containsJapaneseText(cleanedText)) {
            continue;
        }

        if (cleanedText.length < 20 || cleanedText.length > 220) {
            continue;
        }

        if (isRiotBoilerplateText(cleanedText)) {
            continue;
        }

        return cleanedText;
    }

    return '';
}

function extractHtmlTagTexts(html, tagName) {
    const texts = [];
    const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, 'gi');

    for (const match of String(html || '').matchAll(pattern)) {
        if (match && match[1]) {
            texts.push(htmlToText(match[1]));
        }
    }

    return texts;
}

function containsJapaneseText(text) {
    return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(text || ''));
}

function isRiotBoilerplateText(text) {
    const cleanedText = cleanupText(text);

    if (/^(パッチノート|チームファイト\s*タクティクス|リーグ・オブ・レジェンド)$/i.test(cleanedText)) {
        return true;
    }

    return cleanedText.includes('この記事を共有')
        || cleanedText.includes('パッチノート一覧')
        || cleanedText.includes('Riot Games')
        || cleanedText.includes('All Rights Reserved');
}

function extractRiotVersion(url, label, game) {
    const combined = `${url} ${label}`;

    if (game === 'TFT') {
        const urlMatch = combined.match(/teamfight-tactics-patch-(\d+)-(\d+)/i);

        if (urlMatch) {
            return `${urlMatch[1]}.${urlMatch[2]}`;
        }

        const labelMatch = combined.match(/パッチ(?:ノート)?\s*(\d+(?:\.\d+)?)/i);

        if (labelMatch) {
            return labelMatch[1];
        }

        return '';
    }

    const urlMatch = combined.match(/patch-(\d+)-(\d+)(?:-notes)?/i);

    if (urlMatch) {
        return `${urlMatch[1]}.${urlMatch[2]}`;
    }

    const labelMatch = combined.match(/パッチ(?:ノート)?\s*(\d+(?:\.\d+)?)/i);

    if (labelMatch) {
        return labelMatch[1];
    }

    return '';
}

function extractFf14Version(text) {
    const match = String(text || '').match(/(\d+\.\d+)\s*パッチノート/);

    if (!match) {
        return 0;
    }

    return Number(match[1]);
}

function formatDateText(text) {
    if (!text) {
        return '';
    }

    const isoMatch = String(text).match(/(20\d{2})-(\d{2})-(\d{2})/);

    if (isoMatch) {
        return `${isoMatch[1]}/${Number(isoMatch[2])}/${Number(isoMatch[3])}`;
    }

    const slashMatch = String(text).match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);

    if (slashMatch) {
        return `${slashMatch[1]}/${Number(slashMatch[2])}/${Number(slashMatch[3])}`;
    }

    const japaneseDateMatch = String(text).match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);

    if (japaneseDateMatch) {
        return `${japaneseDateMatch[1]}/${Number(japaneseDateMatch[2])}/${Number(japaneseDateMatch[3])}`;
    }

    const timestamp = Date.parse(String(text));

    if (!Number.isNaN(timestamp)) {
        return formatTimestampToJapaneseDate(timestamp);
    }

    return cleanupText(text);
}

function formatTimestampToJapaneseDate(timestamp) {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });

    return formatter.format(new Date(timestamp)).replace(/\//g, '/');
}

function convertJapaneseDateToNumber(dateText) {
    if (!dateText) {
        return 0;
    }

    const match = String(dateText).match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);

    if (!match) {
        return 0;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    return year * 10000 + month * 100 + day;
}

function convertGenshinDateToNumber(dateText) {
    if (!dateText) {
        return 0;
    }

    const japaneseDateTimeMatch = String(dateText).match(/(20\d{2})年(\d{1,2})月(\d{1,2})日(?:\s+)?(?:(\d{1,2}):(\d{2}))?/);

    if (japaneseDateTimeMatch) {
        const year = Number(japaneseDateTimeMatch[1]);
        const month = Number(japaneseDateTimeMatch[2]);
        const day = Number(japaneseDateTimeMatch[3]);
        const hour = Number(japaneseDateTimeMatch[4] || 0);
        const minute = Number(japaneseDateTimeMatch[5] || 0);

        return year * 100000000 + month * 1000000 + day * 10000 + hour * 100 + minute;
    }

    const isoDateTimeMatch = String(dateText).match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);

    if (isoDateTimeMatch) {
        const year = Number(isoDateTimeMatch[1]);
        const month = Number(isoDateTimeMatch[2]);
        const day = Number(isoDateTimeMatch[3]);
        const hour = Number(isoDateTimeMatch[4] || 0);
        const minute = Number(isoDateTimeMatch[5] || 0);

        return year * 100000000 + month * 1000000 + day * 10000 + hour * 100 + minute;
    }

    const timestamp = Date.parse(String(dateText || ''));

    if (Number.isNaN(timestamp)) {
        return 0;
    }

    return timestamp;
}

function extractVersion(text) {
    const match = String(text || '').match(/\d+(?:\.\d+)+[a-z]?/i);

    if (!match) {
        return '';
    }

    return match[0];
}

function compareDottedVersionDesc(versionA, versionB) {
    return compareDottedVersion(versionB, versionA);
}

function compareDottedVersion(versionA, versionB) {
    const aParts = String(versionA).split('.').map(Number);
    const bParts = String(versionB).split('.').map(Number);
    const length = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < length; i++) {
        const a = aParts[i] || 0;
        const b = bParts[i] || 0;

        if (a !== b) {
            return a - b;
        }
    }

    return 0;
}

function extractDiscordRetryAfter(responseText) {
    try {
        const parsedResponse = JSON.parse(responseText);

        if (parsedResponse && parsedResponse.retry_after) {
            return Math.ceil(Number(parsedResponse.retry_after) * 1000);
        }

        return 1000;
    } catch (error) {
        return 1000;
    }
}

function sleep(milliseconds) {
    return new Promise(function(resolve) {
        setTimeout(resolve, milliseconds);
    });
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 3)}...`;
}

function getDiscordPresentation(game) {
    return DISCORD_PRESENTATIONS[game] || {
        ...DEFAULT_DISCORD_PRESENTATION,
        embedTitle: `📝 ${game} パッチノート更新`
    };
}

export const __testables = {
    SOURCES,
    applySourceDedupeOptions,
    buildGenshinArticleUrl,
    clearSourceFailureAlert,
    fetchSourceText,
    getDiscordPresentation,
    getSourceFetchOptions,
    getPatchNoteKeys,
    getStoredPatchNoteIds,
    isFf14MaintenanceNewsTitle,
    isPostedPatchNote,
    mapWithConcurrency,
    notifySourceFailure,
    parseGenshinContentListApi,
    parseGenshinOfficialNews,
    parseFf14PatchNotes,
    parseFf14WorldMaintenance,
    parseOverwatchPatchNotes,
    parsePoe2PatchNotes,
    parseRiotPatchNotes,
    processPatchNotes,
    runPatchNoteChecks,
    uniquePatchNotes
};
