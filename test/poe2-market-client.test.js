import { describe, expect, it } from 'vitest';
import { createPoe2MarketProduct } from '../src/services/poe2/poe2-market-definition.js';
import { __testables } from '../src/services/poe2/poe2-market-client.js';

const {
    buildPoeNinjaProductPrices,
    compareCatalogProducts,
    findLatestTradeChallengeLeague,
    getPoeNinjaSourceCategory,
    normalizeMarketProductCategory,
    normalizePoeNinjaIconUrl
} = __testables;

describe('PoE2 market client helpers', function() {
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
});
