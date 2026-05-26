import sharp from 'sharp';

const IMAGE_WIDTH = 1000;
const IMAGE_HEIGHT = 650;
const JST_TIME_ZONE = 'Asia/Tokyo';
const iconCache = new Map();

export async function buildPoe2MarketImage(snapshot, options = {}) {
    const productIcons = await Promise.all(snapshot.products.map(function(product) {
        return loadIconDataUrl(product.iconUrl, options.userAgent);
    }));
    const svg = buildImageSvg(snapshot, productIcons);

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

function buildImageSvg(snapshot, productIcons) {
    const title = 'PoE2 相場';
    const period = escapeXml(formatSnapshotPeriod(snapshot.completedHour));
    const exaltedIcon = productIcons[0]
        ? `<image href="${productIcons[0]}" x="669" y="152" width="17" height="17" preserveAspectRatio="xMidYMid meet"/>`
        : '';
    const rows = snapshot.products.map(function(product, index) {
        return buildProductRow(product, productIcons[index], index, snapshot.completedHour);
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="header" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#171d29"/>
            <stop offset="100%" stop-color="#23202a"/>
        </linearGradient>
    </defs>
    <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="#0d1118"/>
    <rect x="18" y="18" width="964" height="614" rx="10" fill="#141a24" stroke="#303a49" stroke-width="2"/>
    <rect x="18" y="18" width="964" height="118" rx="10" fill="url(#header)"/>
    <rect x="18" y="126" width="964" height="10" fill="url(#header)"/>
    <rect x="44" y="42" width="5" height="70" fill="#c99c51"/>
    <text x="70" y="70" fill="#f5f7fb" font-size="32" font-weight="700" font-family="${fontFamily()}">${title}</text>
    <text x="70" y="102" fill="#9ca9bc" font-size="18" font-family="${fontFamily()}">高貴のオーブ換算  /  直近確定取引 ${period}</text>
    <text x="70" y="169" fill="#8997aa" font-size="16" font-weight="700" font-family="${fontFamily()}">アイテム</text>
    <text x="630" y="169" fill="#8997aa" font-size="16" font-weight="700" font-family="${fontFamily()}">相場</text>
    ${exaltedIcon}
    <text x="848" y="169" fill="#8997aa" font-size="16" font-weight="700" font-family="${fontFamily()}">取引量</text>
    ${rows}
    <text x="54" y="608" fill="#687488" font-size="14" font-family="${fontFamily()}">Path of Exile 2 Currency Exchange / 1時間単位の確定履歴</text>
</svg>`;
}

function buildProductRow(product, iconDataUrl, index, latestChangeId) {
    const y = 192 + (index * 63);
    const rowFill = index % 2 === 0 ? '#18202b' : '#141a24';
    const price = escapeXml(formatPrice(product));
    const volume = escapeXml(formatVolume(product));
    const staleLabel = product.quoteChangeId && product.quoteChangeId !== latestChangeId
        ? `<text x="626" y="${y + 46}" fill="#79879a" font-size="12" font-family="${fontFamily()}">${escapeXml(formatStaleQuote(product.quoteChangeId))}</text>`
        : '';
    const icon = iconDataUrl
        ? `<image href="${iconDataUrl}" x="72" y="${y + 11}" width="42" height="42" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="72" y="${y + 11}" width="42" height="42" rx="6" fill="#253142"/>`;

    return `
    <rect x="54" y="${y}" width="892" height="60" rx="6" fill="${rowFill}"/>
    ${icon}
    <text x="134" y="${y + 37}" fill="#edf1f7" font-size="21" font-weight="600" font-family="${fontFamily()}">${escapeXml(product.label)}</text>
    <text x="758" y="${y + 35}" text-anchor="end" fill="${product.lowestPrice === null ? '#728096' : '#f1c76e'}" font-size="20" font-weight="600" font-family="${fontFamily()}">${price}</text>
    ${staleLabel}
    <text x="848" y="${y + 35}" fill="#d5dce6" font-size="18" font-family="${fontFamily()}">${volume}</text>`;
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

function formatPrice(product) {
    if (product.lowestPrice === null || product.highestPrice === null) {
        return '取引なし';
    }

    if (Math.abs(product.highestPrice - product.lowestPrice) < 0.0001) {
        return formatNumber(product.lowestPrice);
    }

    return `${formatNumber(product.lowestPrice)} - ${formatNumber(product.highestPrice)}`;
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

function formatVolume(product) {
    if (product.base) {
        return '基準';
    }

    if (product.volume === null) {
        return '-';
    }

    return Number(product.volume).toLocaleString('ja-JP');
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
