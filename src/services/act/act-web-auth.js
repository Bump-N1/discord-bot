import { createHmac, timingSafeEqual } from 'node:crypto';

const CREATE_LINK_TTL_MS = 30 * 60 * 1000;
const MANAGE_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export function isActWebConfigured() {
    return Boolean(getActWebBaseUrl() && getSigningSecret());
}

export function getActWebPort() {
    const value = Number(process.env.ACT_WEB_PORT || 3100);

    return Number.isInteger(value) && value > 0 ? value : 3100;
}

export function getActWebHost() {
    return process.env.ACT_WEB_HOST || '0.0.0.0';
}

export function buildActCreateUrl(payload) {
    return buildActWebUrl({
        ...payload,
        scope: 'create'
    }, CREATE_LINK_TTL_MS);
}

export function buildActManageUrl(payload) {
    return buildActWebUrl({
        ...payload,
        scope: 'manage'
    }, MANAGE_LINK_TTL_MS);
}

export function verifyActWebToken(token, requiredScope = '') {
    if (!isActWebConfigured()) {
        throw new Error('募集Web画面が設定されていません。');
    }

    const parts = String(token || '').split('.');

    if (parts.length !== 2) {
        throw new Error('リンクが正しくありません。');
    }

    const [encodedPayload, receivedSignature] = parts;
    const expectedSignature = createSignature(encodedPayload);

    if (!securelyEqual(receivedSignature, expectedSignature)) {
        throw new Error('リンクが正しくありません。');
    }

    let payload;

    try {
        payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch (error) {
        throw new Error('リンクが正しくありません。');
    }

    if (!payload.expiresAt || payload.expiresAt < Date.now()) {
        throw new Error('リンクの有効期限が切れました。Discordからもう一度開いてください。');
    }

    if (requiredScope && payload.scope !== requiredScope) {
        throw new Error('この操作には使用できないリンクです。');
    }

    return payload;
}

function buildActWebUrl(payload, ttlMs) {
    if (!isActWebConfigured()) {
        throw new Error('募集Web画面が設定されていません。');
    }

    const encodedPayload = Buffer.from(JSON.stringify({
        ...payload,
        expiresAt: Date.now() + ttlMs
    })).toString('base64url');
    const token = `${encodedPayload}.${createSignature(encodedPayload)}`;
    const url = new URL('/act/', getActWebBaseUrl());

    url.searchParams.set('token', token);

    return url.toString();
}

function getActWebBaseUrl() {
    const value = String(process.env.ACT_WEB_BASE_URL || '').trim();

    if (!value) {
        return '';
    }

    try {
        return new URL(value).toString();
    } catch (error) {
        return '';
    }
}

function getSigningSecret() {
    return String(process.env.ACT_WEB_SIGNING_SECRET || '').trim();
}

function createSignature(payload) {
    return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
}

function securelyEqual(left, right) {
    const leftBuffer = Buffer.from(String(left || ''));
    const rightBuffer = Buffer.from(String(right || ''));

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
}
