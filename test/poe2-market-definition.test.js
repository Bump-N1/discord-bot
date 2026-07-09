import { describe, expect, it } from 'vitest';
import {
    createPoe2MarketProduct,
    getKnownPoe2MarketProducts,
    getQuoteCurrencyProducts,
    POE2_MARKET_BASE_CURRENCY_ID,
    POE2_MARKET_CATEGORIES,
    POE2_MARKET_DIVINE_CURRENCY_ID,
    POE2_MARKET_MAX_PRODUCTS,
    POE2_MARKET_MAX_POST_INTERVAL_HOURS,
    POE2_MARKET_MIN_POST_INTERVAL_HOURS
} from '../src/services/poe2/poe2-market-definition.js';

describe('PoE2 market definition', function() {
    it('表示上のカテゴリ順を保持する', function() {
        expect(POE2_MARKET_CATEGORIES.map(function(category) {
            return category.label;
        })).toEqual([
            'カレンシー',
            'エッセンス',
            'デリリウム',
            'ブリーチ',
            'アビス',
            'アッツィリ神殿',
            'フラグメント',
            'ルーン',
            'リチュアル',
            'ソウルコア',
            'アイドル',
            'ジェムの原石',
            'ジェム',
            'エクスペディション'
        ]);
    });

    it('相場画像の基準通貨を高貴と神で固定する', function() {
        expect(getQuoteCurrencyProducts().map(function(product) {
            return product.id;
        })).toEqual([
            POE2_MARKET_BASE_CURRENCY_ID,
            POE2_MARKET_DIVINE_CURRENCY_ID
        ]);
    });

    it('既知アイテムは日本語名とカテゴリを持つ', function() {
        const knownProducts = getKnownPoe2MarketProducts();

        expect(knownProducts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'exalted',
                label: '高貴なオーブ',
                category: 'Currency'
            }),
            expect.objectContaining({
                id: 'divine',
                label: '神のオーブ',
                category: 'Currency'
            }),
            expect.objectContaining({
                id: 'architects-orb',
                label: 'アーキテクトオーブ',
                category: 'Incursion'
            })
        ]));
    });

    it('未知アイテムはIDから暫定名を作る', function() {
        expect(createPoe2MarketProduct('uncut-skill-gem-lv20')).toMatchObject({
            id: 'uncut-skill-gem-lv20',
            label: 'Uncut Skill Gem Lv20',
            category: 'Currency'
        });
    });

    it('表示件数と投稿頻度の上限下限を固定する', function() {
        expect(POE2_MARKET_MAX_PRODUCTS).toBe(12);
        expect(POE2_MARKET_MIN_POST_INTERVAL_HOURS).toBe(1);
        expect(POE2_MARKET_MAX_POST_INTERVAL_HOURS).toBe(24);
    });
});
