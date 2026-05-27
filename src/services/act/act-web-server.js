import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
    ACT_STATUS_CLOSED,
    CLOSED_ACT_REOPEN_VISIBLE_MS,
    getActDefinition
} from './act-definitions.js';
import {
    ACT_ASSIGNMENT_PREFERENCE,
    buildPreferencePublicData,
    usesPreferenceComposition
} from './act-composition.js';
import {
    closeAct,
    createFf14Act,
    createLolAct,
    createOwAct,
    getActById,
    joinActList,
    leaveAct,
    reopenAct,
    setActPreference,
    updateActEditableFields
} from './act-service.js';
import { formatDefaultActDateTimeInput } from './act-datetime.js';
import { postActDiscordMessage, updateActDiscordMessage } from './act-discord.js';
import {
    buildActManageUrl,
    getActWebHost,
    getActWebPort,
    isActWebConfigured,
    verifyActWebToken
} from './act-web-auth.js';
import { fetchPoe2MarketCatalog } from '../poe2/poe2-market-client.js';
import { getPoe2MarketConfig } from '../poe2/poe2-market-config.js';
import {
    POE2_MARKET_MAX_POST_INTERVAL_HOURS,
    POE2_MARKET_MAX_PRODUCTS,
    POE2_MARKET_MIN_POST_INTERVAL_HOURS
} from '../poe2/poe2-market-definition.js';
import {
    getPoe2MarketSettings,
    savePoe2MarketSettings
} from '../poe2/poe2-market-store.js';

const WEB_ROOT = path.resolve(process.cwd(), 'src', 'web', 'act');
const POE2_WEB_ROOT = path.resolve(process.cwd(), 'src', 'web', 'poe2-market');
const ASSET_ROOT = path.resolve(process.cwd(), 'assets');
const completedCreateTokens = new Set();
const poe2IconCache = new Map();

export function startActWebServer(client) {
    if (!isActWebConfigured()) {
        console.log('Act web UI is disabled: ACT_WEB_BASE_URL or ACT_WEB_SIGNING_SECRET is not configured.');
        return null;
    }

    const server = createServer(async function(request, response) {
        try {
            await handleRequest(client, request, response);
        } catch (error) {
            console.error('Act web request failed:', error);
            sendJson(response, 500, {
                error: error.message || '処理に失敗しました。'
            });
        }
    });
    const host = getActWebHost();
    const port = getActWebPort();

    server.listen(port, host, function() {
        console.log(`Act web UI listening on ${host}:${port}`);
    });

    return server;
}

async function handleRequest(client, request, response) {
    const url = new URL(request.url || '/', 'http://localhost');

    setSecurityHeaders(response);

    if (request.method === 'GET' && (url.pathname === '/act' || url.pathname === '/act/')) {
        await sendFile(response, path.join(WEB_ROOT, 'index.html'), 'text/html; charset=utf-8');
        return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/act/')) {
        await serveWebStaticFile(url.pathname, response);
        return;
    }

    if (request.method === 'GET' && (url.pathname === '/poe2-market' || url.pathname === '/poe2-market/')) {
        await sendFile(response, path.join(POE2_WEB_ROOT, 'index.html'), 'text/html; charset=utf-8');
        return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/poe2-market/')) {
        await servePoe2MarketStaticFile(url.pathname, response);
        return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
        await serveAssetFile(url.pathname, response);
        return;
    }

    if (request.method === 'GET' && url.pathname === '/api/act/session') {
        await handleSessionRequest(url, response);
        return;
    }

    if (request.method === 'GET' && url.pathname === '/api/poe2-market/session') {
        await handlePoe2MarketSessionRequest(url, response);
        return;
    }

    if (request.method === 'GET' && url.pathname === '/api/poe2-market/icon') {
        await handlePoe2MarketIconRequest(url, response);
        return;
    }

    if (request.method === 'POST' && url.pathname === '/api/poe2-market/settings') {
        await handlePoe2MarketSettingsRequest(request, response);
        return;
    }

    if (request.method === 'POST' && url.pathname === '/api/act/create') {
        await handleCreateRequest(client, request, response);
        return;
    }

    const partyRoute = url.pathname.match(/^\/api\/act\/([^/]+)\/(join|leave|edit|close|reopen)$/u);

    if (request.method === 'POST' && partyRoute) {
        await handlePartyAction(client, request, response, partyRoute[1], partyRoute[2]);
        return;
    }

    sendJson(response, 404, {
        error: 'ページが見つかりません。'
    });
}

async function handlePoe2MarketSessionRequest(url, response) {
    try {
        const payload = verifyActWebToken(url.searchParams.get('token'), 'poe2-market-edit');
        const catalog = await fetchPoe2MarketCatalog();
        const settings = await getPoe2MarketSettings(payload.guildId);

        sendJson(response, 200, buildPoe2MarketSession(payload, catalog, settings, url.searchParams.get('token')));
    } catch (error) {
        sendJson(response, 400, {
            error: error.message
        });
    }
}

async function handlePoe2MarketSettingsRequest(request, response) {
    try {
        const body = await readJsonBody(request);
        const payload = verifyActWebToken(body.token, 'poe2-market-edit');
        const selectedProductIds = Array.from(new Set(
            Array.isArray(body.selectedProductIds)
                ? body.selectedProductIds.map(String)
                : []
        ));
        const postIntervalHours = Number(body.postIntervalHours);

        if (selectedProductIds.length > POE2_MARKET_MAX_PRODUCTS) {
            throw new Error(`表示できるアイテムは${POE2_MARKET_MAX_PRODUCTS}件までです。`);
        }

        if (!Number.isInteger(postIntervalHours)
            || postIntervalHours < POE2_MARKET_MIN_POST_INTERVAL_HOURS
            || postIntervalHours > POE2_MARKET_MAX_POST_INTERVAL_HOURS) {
            throw new Error('投稿頻度は1時間から24時間の範囲で指定してください。');
        }

        const catalog = await fetchPoe2MarketCatalog();
        const productById = new Map(catalog.products.map(function(product) {
            return [product.id, product];
        }));
        const selectedProducts = selectedProductIds.map(function(productId) {
            return productById.get(productId);
        });

        if (selectedProducts.some(function(product) {
            return !product;
        })) {
            throw new Error('選択したアイテムの一部を取得できませんでした。画面を更新してください。');
        }

        const settings = await savePoe2MarketSettings(payload.guildId, selectedProducts, payload.userId, {
            postIntervalHours: postIntervalHours,
            updatedByName: payload.displayName
        });

        sendJson(response, 200, buildPoe2MarketSession(payload, catalog, settings, body.token));
    } catch (error) {
        sendJson(response, 400, {
            error: error.message
        });
    }
}

async function handlePoe2MarketIconRequest(url, response) {
    try {
        verifyActWebToken(url.searchParams.get('token'), 'poe2-market-edit');
        const id = String(url.searchParams.get('id') || '');
        const catalog = await fetchPoe2MarketCatalog();
        const product = catalog.products.find(function(candidate) {
            return candidate.id === id;
        });

        if (!product?.iconUrl) {
            sendJson(response, 404, {
                error: '画像が見つかりません。'
            });
            return;
        }

        await sendPoe2MarketIcon(response, product.iconUrl);
    } catch (error) {
        sendJson(response, 404, {
            error: error.message
        });
    }
}

function buildPoe2MarketSession(payload, catalog, settings, token) {
    return {
        actorName: payload.displayName,
        league: catalog.league,
        maxProducts: POE2_MARKET_MAX_PRODUCTS,
        categories: catalog.categories,
        products: catalog.products.map(function(product) {
            return {
                ...product,
                iconUrl: product.iconUrl
                    ? `/api/poe2-market/icon?token=${encodeURIComponent(token)}&id=${encodeURIComponent(product.id)}`
                    : ''
            };
        }),
        selectedProductIds: settings.selectedProducts.map(function(product) {
            return product.id;
        }),
        postIntervalHours: settings.postIntervalHours,
        history: settings.history.map(function(entry) {
            return {
                updatedByName: entry.updatedByName,
                updatedAt: entry.updatedAt,
                selectedCount: entry.selectedCount,
                selectedLabels: Array.isArray(entry.selectedLabels) ? entry.selectedLabels : [],
                postIntervalHours: entry.postIntervalHours
            };
        }),
        configured: Boolean(settings.configured)
    };
}

async function sendPoe2MarketIcon(response, iconUrl) {
    if (!poe2IconCache.has(iconUrl)) {
        poe2IconCache.set(iconUrl, fetchPoe2MarketIcon(iconUrl).catch(function(error) {
            poe2IconCache.delete(iconUrl);
            throw error;
        }));
    }

    const icon = await poe2IconCache.get(iconUrl);

    response.writeHead(200, {
        'Content-Type': icon.contentType,
        'Cache-Control': 'private, max-age=86400'
    });
    response.end(icon.contents);
}

async function fetchPoe2MarketIcon(iconUrl) {
    const config = getPoe2MarketConfig();
    const response = await fetch(iconUrl, {
        headers: {
            'User-Agent': config.userAgent,
            Accept: 'image/*'
        }
    });

    if (!response.ok) {
        throw new Error('画像を取得できませんでした。');
    }

    const contentType = response.headers.get('content-type') || 'image/png';

    if (!contentType.startsWith('image/')) {
        throw new Error('画像を取得できませんでした。');
    }

    return {
        contentType: contentType,
        contents: Buffer.from(await response.arrayBuffer())
    };
}

async function handleSessionRequest(url, response) {
    try {
        const payload = verifyActWebToken(url.searchParams.get('token'));

        if (payload.scope === 'create') {
            sendJson(response, 200, {
                kind: 'create',
                actorName: payload.displayName,
                game: getCommandGame(payload.commandName),
                commandName: payload.commandName,
                mode: payload.mode || payload.partyType,
                modeLabel: getDraftModeLabel(payload),
                defaultDatetime: formatDefaultActDateTimeInput(new Date(Date.now() + 30 * 60 * 1000))
            });
            return;
        }

        const party = await requireManagedParty(payload, payload.partyId);
        sendJson(response, 200, buildManageSession(party, payload));
    } catch (error) {
        sendJson(response, 401, {
            error: error.message
        });
    }
}

async function handleCreateRequest(client, request, response) {
    try {
        const body = await readJsonBody(request);
        const payload = verifyActWebToken(body.token, 'create');

        if (completedCreateTokens.has(body.token)) {
            throw new Error('このリンクでは募集を作成済みです。Discordの投稿から開いてください。');
        }

        const commonOptions = {
            datetime: requireText(body.datetime, '開始日時を入力してください。'),
            details: requireText(body.details, '募集内容を入力してください。'),
            creatorId: payload.userId,
            guildId: payload.guildId,
            channelId: payload.channelId,
            webManaged: true,
            assignmentMode: ACT_ASSIGNMENT_PREFERENCE
        };
        let party;

        if (payload.commandName === 'act-ow') {
            party = await createOwAct({
                ...commonOptions,
                mode: payload.mode
            });
        } else if (payload.commandName === 'act-ff14') {
            party = await createFf14Act({
                ...commonOptions,
                partyType: payload.partyType,
                ff14RoleSelection: 'ON',
                contentName: requireText(body.contentName, 'コンテンツ名を入力してください。')
            });
        } else {
            party = await createLolAct({
                ...commonOptions,
                mode: payload.mode
            });
        }

        const postedParty = await postActDiscordMessage(client, party);
        completedCreateTokens.add(body.token);
        const manageUrl = buildActManageUrl({
            partyId: postedParty.id,
            userId: payload.userId,
            displayName: payload.displayName
        });

        sendJson(response, 201, {
            manageUrl: manageUrl
        });
    } catch (error) {
        sendJson(response, 400, {
            error: error.message
        });
    }
}

async function handlePartyAction(client, request, response, partyId, action) {
    try {
        const body = await readJsonBody(request);
        const payload = verifyActWebToken(body.token, 'manage');
        const party = await requireManagedParty(payload, partyId);
        let result;

        if (action === 'join') {
            result = usesPreferenceComposition(party)
                ? await setActPreference(partyId, payload.userId, payload.displayName, body.preference || {})
                : await joinActList(partyId, payload.userId, payload.displayName);
        } else if (action === 'leave') {
            result = await leaveAct(partyId, payload.userId);
        } else if (action === 'edit') {
            result = await updateActEditableFields(partyId, payload.userId, body.fields || {});
        } else if (action === 'close') {
            result = await closeAct(partyId, payload.userId);
        } else {
            result = await reopenAct(partyId, payload.userId);
        }

        if (!result.ok) {
            sendJson(response, 400, {
                error: result.message,
                session: buildManageSession(result.party, payload)
            });
            return;
        }

        await updateActDiscordMessage(client, partyId);
        sendJson(response, 200, buildManageSession(result.party, payload));
    } catch (error) {
        sendJson(response, 400, {
            error: error.message
        });
    }
}

function buildManageSession(party, payload) {
    const definition = getActDefinition(party);
    const preferenceData = buildPreferencePublicData(party);
    const ownPreference = preferenceData?.participants.find(function(participant) {
        return participant.userId === payload.userId;
    }) || null;

    return {
        kind: 'manage',
        actorName: payload.displayName,
        isCreator: party.creatorId === payload.userId,
        isClosed: party.status === ACT_STATUS_CLOSED,
        canReopen: canReopenParty(party),
        isJoined: isParticipant(party, payload.userId),
        party: {
            id: party.id,
            game: party.game,
            title: party.game === 'ff14'
                ? party.contentName
                : definition.modeLabels?.[party.mode] || party.mode,
            mode: party.mode,
            partyType: party.partyType,
            datetime: party.datetime,
            datetimeInput: party.datetimeInput,
            scheduledAt: party.scheduledAt,
            details: party.details || '',
            contentName: party.contentName || '',
            maxParticipants: party.maxParticipants,
            preference: preferenceData,
            participants: buildListParticipants(party)
        },
        ownPreference: ownPreference
    };
}

function canReopenParty(party) {
    if (party.status !== ACT_STATUS_CLOSED || party.autoClosedAt) {
        return false;
    }

    const closedAt = Date.parse(party.closedAt || party.updatedAt || party.createdAt || '');

    return Number.isNaN(closedAt) || Date.now() - closedAt < CLOSED_ACT_REOPEN_VISIBLE_MS;
}

function isParticipant(party, userId) {
    if (usesPreferenceComposition(party)) {
        return (party.preferenceParticipants || []).some(function(participant) {
            return participant.userId === userId;
        });
    }

    return (party.participants || []).includes(userId);
}

function buildListParticipants(party) {
    return (party.participants || []).map(function(userId) {
        return {
            userId: userId,
            displayName: party.participantNames?.[userId] || '参加者'
        };
    });
}

async function requireManagedParty(payload, partyId) {
    if (payload.partyId !== partyId) {
        throw new Error('募集を開くリンクが正しくありません。');
    }

    const party = await getActById(partyId);

    if (!party || !party.webManaged) {
        throw new Error('募集が見つかりません。');
    }

    return party;
}

function getCommandGame(commandName) {
    if (commandName === 'act-ff14') {
        return 'ff14';
    }

    if (commandName === 'act-ow') {
        return 'ow';
    }

    return 'lol';
}

function getDraftModeLabel(payload) {
    const game = getCommandGame(payload.commandName);
    const party = {
        game: game,
        mode: payload.mode,
        partyType: payload.partyType
    };

    if (game === 'ff14') {
        return payload.partyType;
    }

    return getActDefinition(party).modeLabels[payload.mode] || payload.mode;
}

async function serveWebStaticFile(urlPath, response) {
    const fileName = urlPath.slice('/act/'.length);
    const safeFileNames = {
        'app.css': 'text/css; charset=utf-8',
        'app.js': 'text/javascript; charset=utf-8',
        'favicon.svg': 'image/svg+xml; charset=utf-8'
    };

    if (!safeFileNames[fileName]) {
        sendJson(response, 404, {
            error: 'ページが見つかりません。'
        });
        return;
    }

    await sendFile(response, path.join(WEB_ROOT, fileName), safeFileNames[fileName]);
}

async function servePoe2MarketStaticFile(urlPath, response) {
    const fileName = urlPath.slice('/poe2-market/'.length);
    const safeFileNames = {
        'app.css': 'text/css; charset=utf-8',
        'app.js': 'text/javascript; charset=utf-8'
    };

    if (!safeFileNames[fileName]) {
        sendJson(response, 404, {
            error: 'ページが見つかりません。'
        });
        return;
    }

    await sendFile(response, path.join(POE2_WEB_ROOT, fileName), safeFileNames[fileName]);
}

async function serveAssetFile(urlPath, response) {
    const relativePath = urlPath.slice('/assets/'.length);
    const absolutePath = path.resolve(ASSET_ROOT, relativePath);

    if (!absolutePath.startsWith(`${ASSET_ROOT}${path.sep}`) || !relativePath.endsWith('.png')) {
        sendJson(response, 404, {
            error: '画像が見つかりません。'
        });
        return;
    }

    await sendFile(response, absolutePath, 'image/png');
}

async function sendFile(response, filePath, contentType) {
    try {
        const content = await readFile(filePath);

        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': contentType === 'image/png' ? 'public, max-age=86400' : 'no-cache'
        });
        response.end(content);
    } catch (error) {
        sendJson(response, 404, {
            error: 'ファイルが見つかりません。'
        });
    }
}

async function readJsonBody(request) {
    let content = '';

    for await (const chunk of request) {
        content += chunk;

        if (content.length > 65536) {
            throw new Error('送信内容が大きすぎます。');
        }
    }

    return JSON.parse(content || '{}');
}

function requireText(value, message) {
    const text = String(value || '').trim();

    if (!text) {
        throw new Error(message);
    }

    return text;
}

function setSecurityHeaders(response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self';");
}

function sendJson(response, statusCode, payload) {
    if (response.writableEnded) {
        return;
    }

    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}
