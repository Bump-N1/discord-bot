import sharp from 'sharp';
import {
    getQuoteCurrencyProducts,
    POE2_MARKET_BASE_CURRENCY_ID,
    POE2_MARKET_DIVINE_CURRENCY_ID
} from '../services/poe2/poe2-market-definition.js';
import { fetchWithTimeout } from '../utils/http.js';

const IMAGE_WIDTH = 900;
const HEADER_HEIGHT = 176;
const ROW_HEIGHT = 70;
const IMAGE_BOTTOM_PADDING = 24;
const JST_TIME_ZONE = 'Asia/Tokyo';
const iconCache = new Map();

export async function buildPoe2MarketImage(snapshot, options = {}) {
    const quoteCurrencies = getQuoteCurrencyProducts();
    const quoteCurrencyIcons = await Promise.all(quoteCurrencies.map(function(product) {
        return loadIconDataUrl(product.iconUrl, options.userAgent);
    }));
    const productIcons = await Promise.all(snapshot.products.map(function(product) {
        return loadIconDataUrl(product.iconUrl, options.userAgent);
    }));
    const svg = buildImageSvg(snapshot, productIcons, quoteCurrencyIcons, quoteCurrencies);

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

function buildImageSvg(snapshot, productIcons, quoteCurrencyIcons, quoteCurrencies) {
    const imageHeight = HEADER_HEIGHT + (snapshot.products.length * ROW_HEIGHT) + IMAGE_BOTTOM_PADDING;
    const panelHeight = imageHeight - 36;
    const sourceText = escapeXml(buildSnapshotSourceText(snapshot));
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
    ${buildMarketHeader('相場', quoteCurrencyIcons[0], exaltedHeaderX, quoteCurrencies[0].label)}
    ${buildMarketHeader('相場', quoteCurrencyIcons[1], divineHeaderX, quoteCurrencies[1].label)}
    ${rows}
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
    return `
    <rect x="40" y="${y}" width="820" height="67" rx="6" fill="${rowFill}"/>
    ${icon}
    <text x="108" y="${y + 30}" fill="#edf1f7" font-size="19" font-weight="600" font-family="${fontFamily()}">${escapeXml(truncateLabel(product.label))}</text>
    <text x="108" y="${y + 52}" fill="#7f8da1" font-size="12" font-family="${fontFamily()}">${escapeXml(buildLiquidityText(exalted, divine))}</text>
    ${buildPriceText(exalted, exaltedRightX, y, latestChangeId)}
    ${buildPriceText(divine, divineRightX, y, latestChangeId)}`;
}

function buildPriceText(price, rightX, y, latestChangeId) {
    const available = price?.lowestPrice !== null && price?.lowestPrice !== undefined;
    const value = escapeXml(formatPrice(price));

    const trend = available && !isStalePrice(price, latestChangeId)
        ? formatChange(price?.changePercent)
        : available && isStalePrice(price, latestChangeId)
            ? formatStaleQuote(price.quoteChangeId)
            : '';
    const trendColor = Number(price?.changePercent) > 0 ? '#55c98b' : Number(price?.changePercent) < 0 ? '#ef7d7d' : '#7f8da1';

    return `<text x="${rightX}" y="${y + 30}" text-anchor="end" fill="${available ? '#f1c76e' : '#728096'}" font-size="18" font-weight="600" font-family="${fontFamily()}">${value}</text>
    <text x="${rightX}" y="${y + 52}" text-anchor="end" fill="${trendColor}" font-size="12" font-family="${fontFamily()}">${escapeXml(trend)}</text>`;
}

function buildLiquidityText(exalted, divine) {
    const volume = Math.max(Number(exalted?.volume) || 0, Number(divine?.volume) || 0);
    const stock = Math.max(Number(exalted?.highestStock) || 0, Number(divine?.highestStock) || 0);

    if (volume <= 0 && stock <= 0) {
        return hasDisplayedPrice(exalted) || hasDisplayedPrice(divine)
            ? '\u53d6\u5f15\u91cf\u60c5\u5831\u306a\u3057'
            : '\u53d6\u5f15\u306a\u3057';
    }

    return `1時間取引 ${formatCompactNumber(volume)} ・ 在庫 ${formatCompactNumber(stock)}`;
}

function hasDisplayedPrice(price) {
    return price?.lowestPrice !== null
        && price?.lowestPrice !== undefined
        && price?.highestPrice !== null
        && price?.highestPrice !== undefined;
}

function formatChange(value) {
    return Number.isFinite(Number(value))
        ? `前時間比 ${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`
        : '';
}

function formatCompactNumber(value) {
    return Number(value || 0).toLocaleString('ja-JP', {
        maximumFractionDigits: 0
    });
}

function isStalePrice(price, latestChangeId) {
    return price?.quoteChangeId
        && Number.isFinite(Number(latestChangeId))
        && Number(price.quoteChangeId) !== Number(latestChangeId);
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
        const response = await fetchWithTimeout(iconUrl, {
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

        if (!contentType.toLowerCase().startsWith('image/')) {
            return '';
        }

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

export const __testables = {
    buildLiquidityText,
    buildImageSvg,
    buildSnapshotSourceText,
    formatPrice,
    formatChange,
    truncateLabel
};
