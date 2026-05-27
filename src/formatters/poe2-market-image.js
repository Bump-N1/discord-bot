import sharp from 'sharp';
import {
    getQuoteCurrencyProducts,
    POE2_MARKET_BASE_CURRENCY_ID,
    POE2_MARKET_DIVINE_CURRENCY_ID
} from '../services/poe2/poe2-market-definition.js';

const IMAGE_WIDTH = 900;
const HEADER_HEIGHT = 176;
const ROW_HEIGHT = 58;
const FOOTER_HEIGHT = 56;
const JST_TIME_ZONE = 'Asia/Tokyo';
const iconCache = new Map();

export async function buildPoe2MarketImage(snapshot, options = {}) {
    const quoteCurrencyIcons = await Promise.all(getQuoteCurrencyProducts().map(function(product) {
        return loadIconDataUrl(product.iconUrl, options.userAgent);
    }));
    const productIcons = await Promise.all(snapshot.products.map(function(product) {
        return loadIconDataUrl(product.iconUrl, options.userAgent);
    }));
    const svg = buildImageSvg(snapshot, productIcons, quoteCurrencyIcons);

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

function buildImageSvg(snapshot, productIcons, quoteCurrencyIcons) {
    const imageHeight = HEADER_HEIGHT + (snapshot.products.length * ROW_HEIGHT) + FOOTER_HEIGHT;
    const panelHeight = imageHeight - 36;
    const sourceText = escapeXml(buildSnapshotSourceText(snapshot));
    const footerText = escapeXml(buildFooterText(snapshot));
    const itemHeaderX = 251;
    const exaltedHeaderX = 604;
    const divineHeaderX = 788;
    const priceRightOffset = 42;
    const exaltedRightX = exaltedHeaderX + priceRightOffset;
    const divineRightX = divineHeaderX + priceRightOffset;
    const rows = snapshot.products.map(function(product, index) {
        return buildProductRow(product, productIcons[index], index, snapshot.completedHour, exaltedRightX, divineRightX);
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${IMAGE_WIDTH}" height="${imageHeight}" viewBox="0 0 ${IMAGE_WIDTH} ${imageHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="header" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#171d29"/>
            <stop offset="100%" stop-color="#23202a"/>
        </linearGradient>
    </defs>
    <rect width="${IMAGE_WIDTH}" height="${imageHeight}" fill="#0d1118"/>
    <rect x="18" y="18" width="864" height="${panelHeight}" rx="10" fill="#141a24" stroke="#303a49" stroke-width="2"/>
    <rect x="18" y="18" width="864" height="112" rx="10" fill="url(#header)"/>
    <rect x="18" y="120" width="864" height="10" fill="url(#header)"/>
    <rect x="38" y="38" width="5" height="70" fill="#c99c51"/>
    <text x="60" y="68" fill="#f5f7fb" font-size="31" font-weight="700" font-family="${fontFamily()}">PoE2 相場</text>
    <text x="60" y="98" fill="#9ca9bc" font-size="17" font-family="${fontFamily()}">${sourceText}</text>
    <text x="${itemHeaderX}" y="158" text-anchor="middle" fill="#8997aa" font-size="16" font-weight="700" font-family="${fontFamily()}">アイテム</text>
    ${buildMarketHeader('相場', quoteCurrencyIcons[0], exaltedHeaderX, 'Exalted')}
    ${buildMarketHeader('相場', quoteCurrencyIcons[1], divineHeaderX, 'Divine')}
    ${rows}
    <text x="40" y="${imageHeight - 24}" fill="#687488" font-size="14" font-family="${fontFamily()}">${footerText}</text>
</svg>`;
}

function buildMarketHeader(label, iconDataUrl, centerX, fallbackLabel) {
    const labelWidth = 32;
    const gap = 7;
    const iconSize = 19;
    const trailingWidth = iconDataUrl ? iconSize : fallbackLabel.length * 8;
    const width = labelWidth + gap + trailingWidth;
    const left = Math.round(centerX - (width / 2));
    const icon = iconDataUrl
        ? `<image href="${iconDataUrl}" x="${left + labelWidth + gap}" y="143" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="${left + labelWidth + gap}" y="158" fill="#8997aa" font-size="13" font-weight="600" font-family="${fontFamily()}">${fallbackLabel}</text>`;

    return `
    <text x="${left}" y="158" fill="#8997aa" font-size="16" font-weight="700" font-family="${fontFamily()}">${label}</text>
    ${icon}`;
}

function buildProductRow(product, iconDataUrl, index, latestChangeId, exaltedRightX, divineRightX) {
    const y = HEADER_HEIGHT + (index * ROW_HEIGHT);
    const rowFill = index % 2 === 0 ? '#18202b' : '#141a24';
    const exalted = product.prices?.[POE2_MARKET_BASE_CURRENCY_ID];
    const divine = product.prices?.[POE2_MARKET_DIVINE_CURRENCY_ID];
    const icon = iconDataUrl
        ? `<image href="${iconDataUrl}" x="54" y="${y + 10}" width="38" height="38" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="54" y="${y + 10}" width="38" height="38" rx="6" fill="#253142"/>`;
    const staleLabel = buildStaleLabel(exalted, divine, latestChangeId, divineRightX, y);

    return `
    <rect x="40" y="${y}" width="820" height="55" rx="6" fill="${rowFill}"/>
    ${icon}
    <text x="108" y="${y + 34}" fill="#edf1f7" font-size="19" font-weight="600" font-family="${fontFamily()}">${escapeXml(truncateLabel(product.label))}</text>
    ${buildPriceText(exalted, exaltedRightX, y)}
    ${buildPriceText(divine, divineRightX, y)}
    ${staleLabel}`;
}

function buildPriceText(price, rightX, y) {
    const available = price?.lowestPrice !== null && price?.lowestPrice !== undefined;
    const value = escapeXml(formatPrice(price));

    return `<text x="${rightX}" y="${y + 34}" text-anchor="end" fill="${available ? '#f1c76e' : '#728096'}" font-size="18" font-weight="600" font-family="${fontFamily()}">${value}</text>`;
}

function buildStaleLabel(exalted, divine, latestChangeId, rightX, y) {
    const staleChangeId = [exalted, divine].map(function(price) {
        return price?.quoteChangeId;
    }).find(function(changeId) {
        return changeId && changeId !== latestChangeId;
    });

    if (!staleChangeId || typeof latestChangeId !== 'number') {
        return '';
    }

    return `<text x="${rightX}" y="${y + 49}" text-anchor="end" fill="#79879a" font-size="11" font-family="${fontFamily()}">${escapeXml(formatStaleQuote(staleChangeId))}</text>`;
}

async function loadIconDataUrl(iconUrl, userAgent) {
    if (!iconUrl) {
        return '';
    }

    const cacheKey = `${userAgent || ''}:${iconUrl}`;

    if (!iconCache.has(cacheKey)) {
        iconCache.set(cacheKey, fetchIconDataUrl(iconUrl, userAgent));
    }

    return await iconCache.get(cacheKey);
}

async function fetchIconDataUrl(iconUrl, userAgent) {
    try {
        const response = await fetch(iconUrl, {
            headers: userAgent
                ? {
                    'User-Agent': userAgent,
                    Accept: 'image/*'
                }
                : undefined
        });

        if (!response.ok) {
            return '';
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const contents = Buffer.from(await response.arrayBuffer()).toString('base64');

        return `data:${contentType};base64,${contents}`;
    } catch (error) {
        return '';
    }
}

function formatPrice(price) {
    if (!price || price.lowestPrice === null || price.highestPrice === null) {
        return '取引なし';
    }

    if (Math.abs(price.highestPrice - price.lowestPrice) < 0.0001) {
        return formatNumber(price.lowestPrice);
    }

    return `${formatNumber(price.lowestPrice)} - ${formatNumber(price.highestPrice)}`;
}

function formatNumber(value) {
    if (value >= 100) {
        return value.toLocaleString('ja-JP', {
            maximumFractionDigits: 1
        });
    }

    if (value >= 1) {
        return value.toLocaleString('ja-JP', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 2
        });
    }

    return value.toLocaleString('ja-JP', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
}

function truncateLabel(label) {
    const text = String(label || '');

    return text.length > 37 ? `${text.slice(0, 34)}...` : text;
}

function formatSnapshotPeriod(changeId) {
    const start = new Date(Number(changeId) * 1000);
    const end = new Date((Number(changeId) + 3600) * 1000);
    const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: JST_TIME_ZONE,
        month: 'numeric',
        day: 'numeric'
    });
    const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: JST_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `${dateFormatter.format(start)} ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

function buildSnapshotSourceText(snapshot) {
    if (snapshot.source === 'poe-ninja') {
        return `Currency Exchange  /  取得 ${formatCapturedAt(snapshot.capturedAt)}`;
    }

    return `Currency Exchange  /  直近確定取引 ${formatSnapshotPeriod(snapshot.completedHour)}`;
}

function buildFooterText(snapshot) {
    if (snapshot.source === 'poe-ninja') {
        return '取得元: poe.ninja / 暫定データ';
    }

    return '取得元: Path of Exile 2 Currency Exchange / 1時間単位の確定履歴';
}

function formatCapturedAt(value) {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: JST_TIME_ZONE,
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return formatter.format(new Date(value));
}

function formatStaleQuote(changeId) {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: JST_TIME_ZONE,
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `最終取引 ${formatter.format(new Date(Number(changeId) * 1000))}`;
}

function fontFamily() {
    return 'Noto Sans JP, Noto Sans CJK JP, Yu Gothic, sans-serif';
}

function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
