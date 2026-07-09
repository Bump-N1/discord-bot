import { describe, expect, it } from 'vitest';
import { __testables } from '../src/services/poe2/poe2-market-localization.js';

const {
    getSubCategoryOrder,
    mapOfficialMarketProduct,
    shouldExcludeMarketProduct
} = __testables;

describe('PoE2 market localization', function() {
    it('公式マーケットのカテゴリ差し替えをゲーム内表示に寄せる', function() {
        expect(mapOfficialMarketProduct(
            'Vaal',
            'Vaal',
            'ソウルコア',
            'ヴァール系アイテム',
            'guatelitzis-soul-core-of-endurance',
            4
        )).toMatchObject({
            category: 'Incursion',
            subCategory: 'ソウルコア',
            sortOrder: 4
        });

        expect(mapOfficialMarketProduct(
            'Ultimatum',
            'Ultimatum',
            'ソウルコア',
            'トポタンテのソウルコア',
            'soul-core-of-topotante',
            0
        )).toMatchObject({
            category: 'SoulCores',
            subCategory: 'ソウルコア',
            sortOrder: 0
        });

        expect(mapOfficialMarketProduct(
            'Expedition',
            'Expedition',
            'ヴェリシウム',
            'ソーマタージ・フラックス（レベル4）',
            'thaumaturgic-flux-4',
            30
        )).toMatchObject({
            category: 'Currency',
            subCategory: 'カレンシー'
        });

        expect(mapOfficialMarketProduct(
            'Fragments',
            'Fragments',
            'フラグメント',
            'ルーニック スプリンター',
            'runic-splinter',
            10
        )).toMatchObject({
            category: 'Expedition',
            subCategory: 'エクスペディション',
            sortOrder: 1
        });
    });

    it('例外アイテムを正しいカテゴリへ寄せる', function() {
        expect(mapOfficialMarketProduct(
            'Ritual',
            'Ritual',
            'お告げ',
            'アビスの反響のお告げ',
            'omen-of-abyssal-echoes',
            5
        )).toMatchObject({
            category: 'Abyss',
            subCategory: 'お告げ'
        });

        expect(mapOfficialMarketProduct(
            'Ritual',
            'Ritual',
            'ピナクルフラグメント',
            '影の呼び声',
            'call-of-the-shadows',
            5
        )).toMatchObject({
            category: 'Fragments',
            subCategory: 'ピナクルフラグメント'
        });

        expect(mapOfficialMarketProduct(
            'Ritual',
            'Ritual',
            'デリリウム',
            '鴉の鏡像',
            'raven-touched-shard',
            5
        )).toMatchObject({
            category: 'Delirium',
            subCategory: 'デリリウム'
        });

        expect(mapOfficialMarketProduct(
            'Fragments',
            'Fragments',
            'ピナクルフラグメント',
            'クーレマクの招待',
            'kulemaks-invitation',
            5
        )).toMatchObject({
            category: 'Abyss',
            subCategory: 'ピナクルフラグメント'
        });

        expect(mapOfficialMarketProduct(
            'Fragments',
            'Fragments',
            'ピナクルフラグメント',
            'ブリーチロードの供物',
            'breachlord-sac',
            5
        )).toMatchObject({
            category: 'Breach',
            subCategory: 'ピナクルフラグメント'
        });
    });

    it('エクスペディション由来の特殊アイテムを移動する', function() {
        expect(mapOfficialMarketProduct(
            'Expedition',
            'Expedition',
            'オーグメント',
            '発現する活力',
            'emergent-vigour',
            12
        )).toMatchObject({
            category: 'Runes',
            subCategory: 'グレータールーン'
        });

        expect(mapOfficialMarketProduct(
            'Expedition',
            'Expedition',
            'オーグメント',
            '刻印された狡猾さ',
            'carved-cunning',
            12
        )).toMatchObject({
            category: 'Idols',
            subCategory: 'リチュアル'
        });

        expect(mapOfficialMarketProduct(
            'Expedition',
            'Expedition',
            '事詩',
            'アルダーの叙事詩',
            'aldurs-saga',
            12
        )).toMatchObject({
            category: 'Expedition',
            subCategory: 'お告げ'
        });
    });

    it('削除済みまたは不要なアイテムを除外する', function() {
        expect(shouldExcludeMarketProduct('petition-splinter')).toBe(true);
        expect(shouldExcludeMarketProduct('primary-calamity-fragment')).toBe(true);
        expect(shouldExcludeMarketProduct('lavish-wombgift')).toBe(true);
        expect(shouldExcludeMarketProduct('legacy-of-something')).toBe(true);
        expect(shouldExcludeMarketProduct('divine')).toBe(false);
    });

    it('小カテゴリの表示順を固定する', function() {
        expect(getSubCategoryOrder('Currency', 'カレンシー')).toBeLessThan(
            getSubCategoryOrder('Currency', '品質カレンシー')
        );
        expect(getSubCategoryOrder('Abyss', 'アビスの骨')).toBeLessThan(
            getSubCategoryOrder('Abyss', 'お告げ')
        );
        expect(getSubCategoryOrder('Runes', 'ルーン')).toBeLessThan(
            getSubCategoryOrder('Runes', 'グレータールーン')
        );
    });
});
