import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPoe2MarketProduct } from '../src/services/poe2/poe2-market-definition.js';
import { __testables } from '../src/services/poe2/poe2-market-client.js';

const {
    buildPoeNinjaProductPrices,
    mergeMissingPoeNinjaPrices,
    compareCatalogProducts,
    collectOfficialQuotes,
    findLatestTradeChallengeLeague,
    getPoeNinjaSourceCategory,
    normalizeMarketProductCategory,
    normalizePoeNinjaIconUrl,
    findOfficialMarketQuote,
    getProductMarketIds,
    detectChallengeLeague,
    getQuoteMarketId,
    isMarketPair,
    resolvePoe2MarketConfig
} = __testables;

const originalFetch = global.fetch;

afterEach(function() {
    global.fetch = originalFetch;
});

describe('PoE2 market client helpers', function() {
    it('CDN market_pairの内部IDと自動リーグを解決する', function() {
        expect(getQuoteMarketId('divine')).toBe('Metadata/Items/Currency/CurrencyModValues');
        expect(isMarketPair({
            market_pair: [
                'Metadata/Items/Currency/CurrencyRerollRare',
                'Metadata/Items/Currency/CurrencyModValues'
            ]
        }, 'Metadata/Items/Currency/CurrencyRerollRare', getQuoteMarketId('divine'))).toBe(true);
        expect(detectChallengeLeague([
            { league: 'Standard' },
            { league: 'Runes of Aldur' }
        ])).toBe('Runes of Aldur');
    });
    it('表示用IDとCurrency Exchange内部IDの差分を吸収する', function() {
        const omen = createPoe2MarketProduct('omen-of-putrefaction', {
            baseItemId: 'Metadata/Items/Currency/Omens/OmenOnAbyssVeilAllAndCorrupt'
        });
        const omenWithoutBase = createPoe2MarketProduct('omen-of-the-sovereign');

        const uncutSkillGem = createPoe2MarketProduct('uncut-skill-gem-20', {
            baseItemId: 'Metadata/Items/Gems/UncutSkillGem'
        });
        const uncutSpiritGem = createPoe2MarketProduct('uncut-spirit-gem-20', {
            baseItemId: 'Metadata/Items/Gems/UncutSkillGemBuff'
        });

        expect(getProductMarketIds(omen)).toContain(
            'Metadata/Items/Currency/OmenOnAbyssVeilAllAndCorrupt'
        );
        expect(getProductMarketIds(uncutSkillGem)).toContain(
            'Metadata/Items/Gems/SkillGemUncut20'
        );
        expect(getProductMarketIds(omenWithoutBase)).toContain(
            'Metadata/Items/Currency/OmenOnAbyssGuarenteeLichTypeMod1'
        );
        expect(getProductMarketIds(uncutSpiritGem)).toContain(
            'Metadata/Items/Gems/ReservationGemUncut20'
        );
        expect(getProductMarketIds(createPoe2MarketProduct('rakiatas-flow', {
            baseItemId: 'Metadata/Items/Gems/New/NewSupport/Lineage/Rakiata'
        }))).toContain(
            'Metadata/Items/Gem/SupportGemRakiatasFlow'
        );
        expect(findOfficialMarketQuote([
            {
                market_pair: [
                    'Metadata/Items/Currency/OmenOnAbyssVeilAllAndCorrupt',
                    getQuoteMarketId('divine')
                ]
            }
        ], omen, 'divine')).toMatchObject({
            productMarketId: 'Metadata/Items/Currency/OmenOnAbyssVeilAllAndCorrupt',
            currencyMarketId: getQuoteMarketId('divine')
        });
    });
    it('一致した内部IDで価格と在庫を計算する', function() {
        const product = createPoe2MarketProduct('uncut-skill-gem-20', {
            baseItemId: 'Metadata/Items/Gems/UncutSkillGem'
        });
        const quotesByProductId = new Map();

        collectOfficialQuotes([{
            market_pair: [
                'Metadata/Items/Gems/SkillGemUncut20',
                getQuoteMarketId('divine')
            ],
            lowest_ratio: {
                'Metadata/Items/Gems/SkillGemUncut20': 2,
                [getQuoteMarketId('divine')]: 10
            },
            highest_ratio: {
                'Metadata/Items/Gems/SkillGemUncut20': 1,
                [getQuoteMarketId('divine')]: 5
            },
            volume_traded: {
                'Metadata/Items/Gems/SkillGemUncut20': 8,
                [getQuoteMarketId('divine')]: 40
            },
            lowest_stock: {
                'Metadata/Items/Gems/SkillGemUncut20': 12
            },
            highest_stock: {
                'Metadata/Items/Gems/SkillGemUncut20': 18
            }
        }], 123, [product], quotesByProductId);

        expect(quotesByProductId.get(product.id).divine).toMatchObject({
            lowestPrice: 5,
            highestPrice: 5,
            quoteChangeId: 123,
            volume: 8,
            lowestStock: 12,
            highestStock: 18
        });
    });
    it('auto leagueは常設/Hardcore/未indexを避けて最新チャレンジリーグを選ぶ', function() {
        expect(findLatestTradeChallengeLeague([
            {
                name: 'Standard',
                hardcore: false,
                indexed: true
            },
            {
                name: 'Hardcore',
                hardcore: true,
                indexed: true
            },
            {
                name: 'Old League',
                hardcore: false,
                indexed: false
            },
            {
                name: 'Fate of the Vaal',
                hardcore: false,
                indexed: true
            }
        ])).toBe('Fate of the Vaal');
    });

    it('poe.ninjaのアイコンURLは許可ドメインだけ通す', function() {
        expect(normalizePoeNinjaIconUrl('/image/currency.png')).toBe(
            'https://www.pathofexile.com/image/currency.png'
        );
        expect(normalizePoeNinjaIconUrl('https://poe.ninja/images/item.png')).toBe(
            'https://poe.ninja/images/item.png'
        );
        expect(normalizePoeNinjaIconUrl('https://web.poecdn.com/image.png')).toBe(
            'https://web.poecdn.com/image.png'
        );
        expect(normalizePoeNinjaIconUrl('http://poe.ninja/images/item.png')).toBe('');
        expect(normalizePoeNinjaIconUrl('https://example.com/images/item.png')).toBe('');
    });

    it('poe.ninja用の取得カテゴリを表示カテゴリから補正する', function() {
        expect(getPoeNinjaSourceCategory({
            id: 'simulacrum',
            category: 'Delirium',
            sourceCategory: 'Delirium'
        })).toBe('Fragments');

        expect(getPoeNinjaSourceCategory({
            id: 'architects-orb',
            category: 'Incursion',
            sourceCategory: 'Vaal'
        })).toBe('SoulCores');

        expect(getPoeNinjaSourceCategory({
            id: 'soul-core-of-topotante',
            category: 'SoulCores',
            sourceCategory: 'Ultimatum'
        })).toBe('SoulCores');
    });

    it('ゲーム内表示用のカテゴリ補正を行う', function() {
        expect(normalizeMarketProductCategory({
            id: 'runic-splinter',
            label: 'Runic Splinter',
            category: 'Fragments',
            sourceCategory: 'Fragments',
            sortOrder: 999
        })).toMatchObject({
            category: 'Expedition',
            sourceCategory: 'Fragments',
            sortOrder: -1
        });

        expect(normalizeMarketProductCategory({
            id: 'soul-core-of-topotante',
            label: 'Soul Core',
            category: 'Ultimatum',
            sourceCategory: 'Ultimatum',
            sortOrder: 1
        })).toMatchObject({
            category: 'SoulCores',
            sourceCategory: 'Ultimatum',
            sortOrder: 1
        });
    });

    it('poe.ninjaの基準通貨から高貴/神の相場へ換算する', function() {
        const overviews = [
            {
                category: 'Currency',
                data: {
                    core: {
                        primary: 'exalted',
                        rates: {
                            chaos: 10,
                            divine: 0.01
                        }
                    },
                    lines: [
                        {
                            id: 'mirror',
                            primaryValue: 500
                        }
                    ]
                }
            }
        ];

        expect(buildPoeNinjaProductPrices(createPoe2MarketProduct('divine'), overviews, 100)).toMatchObject({
            exalted: {
                lowestPrice: 100,
                highestPrice: 100,
                quoteChangeId: 100
            },
            divine: {
                lowestPrice: 1,
                highestPrice: 1,
                quoteChangeId: 100
            }
        });

        expect(buildPoeNinjaProductPrices(createPoe2MarketProduct('mirror'), overviews, 100)).toMatchObject({
            exalted: {
                lowestPrice: 500,
                highestPrice: 500,
                quoteChangeId: 100
            },
            divine: {
                lowestPrice: 5,
                highestPrice: 5,
                quoteChangeId: 100
            }
        });
    });

    it('公式相場の欠損価格だけをpoe.ninja価格で補完する', function() {
        const officialSnapshot = {
            source: 'official',
            completedHour: 100,
            products: [
                {
                    id: 'annul',
                    prices: {
                        exalted: { lowestPrice: null, highestPrice: null },
                        divine: { lowestPrice: null, highestPrice: null }
                    }
                },
                {
                    id: 'divine',
                    prices: {
                        exalted: { lowestPrice: 350, highestPrice: 374 },
                        divine: { lowestPrice: 1, highestPrice: 1 }
                    }
                }
            ]
        };
        const fallbackProducts = [
            {
                id: 'annul',
                prices: {
                    exalted: { lowestPrice: 153, highestPrice: 154, quoteChangeId: 100 },
                    divine: { lowestPrice: 0.42, highestPrice: 0.43, quoteChangeId: 100 }
                }
            },
            {
                id: 'divine',
                prices: {
                    exalted: { lowestPrice: 999, highestPrice: 999 },
                    divine: { lowestPrice: 1, highestPrice: 1 }
                }
            }
        ];

        const result = mergeMissingPoeNinjaPrices(officialSnapshot, fallbackProducts);

        expect(result.products[0].prices).toEqual(fallbackProducts[0].prices);
        expect(result.products[1].prices.exalted).toEqual(officialSnapshot.products[1].prices.exalted);
        expect(result.products[1].prices.divine).toEqual(officialSnapshot.products[1].prices.divine);
    });

    it('カタログ表示順はカテゴリ、小カテゴリ、sortOrderの順で並べる', function() {
        const products = [
            createPoe2MarketProduct('rune-b', {
                label: 'Rune B',
                category: 'Runes',
                subCategoryOrder: 1,
                sortOrder: 1
            }),
            createPoe2MarketProduct('currency-b', {
                label: 'Currency B',
                category: 'Currency',
                subCategoryOrder: 1,
                sortOrder: 1
            }),
            createPoe2MarketProduct('currency-a', {
                label: 'Currency A',
                category: 'Currency',
                subCategoryOrder: 0,
                sortOrder: 99
            })
        ];

        expect(products.sort(compareCatalogProducts).map(function(product) {
            return product.id;
        })).toEqual(['currency-a', 'currency-b', 'rune-b']);
    });

    it('auto league uses the current league list instead of market response order', async function() {
        const fetchMock = vi.fn(async function() {
            return {
                ok: true,
                json: async function() {
                    return {
                        economyLeagues: [
                            {
                                name: 'Runes of Aldur',
                                hardcore: false,
                                indexed: true
                            }
                        ],
                        oldEconomyLeagues: [
                            {
                                name: 'Fate of the Vaal',
                                hardcore: false,
                                indexed: false
                            }
                        ]
                    };
                }
            };
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(resolvePoe2MarketConfig({
            league: 'auto',
            realm: 'poe2',
            userAgent: 'test-agent'
        })).resolves.toMatchObject({
            league: 'Runes of Aldur',
            realm: 'poe2'
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api/data/index-state?'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'User-Agent': 'test-agent'
                })
            })
        );
    });
});
