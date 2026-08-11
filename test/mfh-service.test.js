import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { __testables as localizationTestables } from '../src/services/mfh/mfh-localization.js';
import {
    __testables,
    parseMfhCatalogueEntries
} from '../src/services/mfh/mfh-service.js';

describe('MFH service', function() {
    it('GameDBの一覧行から検索用データを抽出する', function() {
        const html = `
            <table>
                <tr data-gamedb-catalogue-item
                    data-id="weapons:serpents-whisper"
                    data-name="Serpent&#39;s Whisper"
                    data-family="Weapons"
                    data-tags="Shadowstrix|Legendary|Dagger"
                    data-search="Serpent&#39;s Whisper The weapon Dago carried when fleeing the Shadowstrix Inn. Serpent&#39;s Whisper Dagger Shadowstrix Legendary 40 525 1,500"
                    data-mf-sort-values="{&quot;name&quot;:&quot;Serpent's Whisper&quot;,&quot;attack&quot;:40}">
                    <td data-label="Weapon"><a href="/weapons/serpents-whisper/"><img src="/icons/1213009.webp"><strong>Serpent&#39;s Whisper</strong></a></td>
                    <td data-label="Type"><a href="/weapon-types/dagger/">Dagger</a></td>
                    <td data-label="Class"><a href="/classes/shadowstrix/">Shadowstrix</a></td>
                    <td data-label="Rarity">Legendary</td>
                    <td data-label="Attack">40</td>
                </tr>
            </table>
        `;

        const entries = parseMfhCatalogueEntries(html, {
            key: 'weapons',
            label: '武器'
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            id: 'weapons:serpents-whisper',
            name: "Serpent's Whisper",
            category: 'weapons',
            categoryLabel: '武器',
            url: 'https://mistfallhunter.gamedb.wiki/weapons/serpents-whisper/',
            iconUrl: 'https://mistfallhunter.gamedb.wiki/icons/1213009.webp',
            tags: ['Shadowstrix', 'Legendary', 'Dagger'],
            localizedTags: ['シャドウストリクス', 'レジェンダリー', '短剣'],
            displayName: 'うねる蛇の舌',
            localizedName: 'うねる蛇の舌',
            description: 'ダーゴがシャドーアウルの宿から逃げる時に携帯した武器。波打つ刃はうねる蛇の舌のように獲物を狙っている。彼はこのダガーを服と共に墓に埋め、自らの過去と決別した。'
        });
        expect(entries[0].cells).toMatchObject({
            Type: 'Dagger',
            Class: 'Shadowstrix',
            Rarity: 'Legendary',
            Attack: '40'
        });
        expect(entries[0].sortValues.attack).toBe(40);
    });

    it('詳細ページから説明文とステータスを抽出する', function() {
        const html = `
            <header class="gdb-entity-hero">
                <div class="gdb-entity-hero__media"><img src="/icons/1213009.webp" alt="icon"></div>
                <div class="gdb-entity-hero__body">
                    <h1 id="entity-title">Serpent&#39;s Whisper</h1>
                    <p>The weapon Dago carried when fleeing the <a href="/classes/shadowstrix/">Shadowstrix</a> Inn.</p>
                    <ul class="gdb-tag-list"><li><a href="/classes/shadowstrix/">Shadowstrix</a></li><li>Legendary</li><li>Dagger</li></ul>
                </div>
            </header>
            <aside class="gdb-infobox">
                <dl>
                    <div><dt>Durability</dt><dd>1,500</dd></div>
                    <div><dt>Attack</dt><dd>40</dd></div>
                    <div><dt>Combat value</dt><dd>525</dd></div>
                </dl>
            </aside>
        `;

        const detail = __testables.parseMfhDetailPage(html);

        expect(detail).toMatchObject({
            title: "Serpent's Whisper",
            description: 'The weapon Dago carried when fleeing the Shadowstrix Inn.',
            iconUrl: 'https://mistfallhunter.gamedb.wiki/icons/1213009.webp',
            tags: ['Shadowstrix', 'Legendary', 'Dagger'],
            localizedTags: ['シャドウストリクス', 'レジェンダリー', '短剣'],
            stats: {
                Durability: '1,500',
                Attack: '40',
                'Combat value': '525'
            }
        });
    });

    it('記号や表記揺れを寄せて検索用文字列を作る', function() {
        expect(__testables.normalizeMfhText("Serpent's Whisper")).toBe('serpentswhisper');
        expect(__testables.normalizeMfhText('シャドウ・ストリクス')).toBe('シャドウストリクス');
        expect(localizationTestables.normalizeMfhLookupText('ソーマタージ・フラックス（レベル４）')).toBe('ソーマタージフラックスレベル4');
        expect(localizationTestables.looksLikeJapaneseMfhText('天金鉱')).toBe(true);
        expect(localizationTestables.looksLikeJapaneseMfhText('Celestigold')).toBe(false);
    });

    it('ゲーム本体の公式日本語名で完全一致検索できる', function() {
        const entries = parseMfhCatalogueEntries(`
            <table>
                <tr data-gamedb-catalogue-item
                    data-id="items:celestigold"
                    data-name="Celestigold"
                    data-tags="Material"
                    data-search="Celestigold Material">
                    <td data-label="Item"><a href="/items/celestigold/"><strong>Celestigold</strong></a></td>
                </tr>
            </table>
        `, {
            key: 'items',
            label: 'アイテム'
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            name: 'Celestigold',
            displayName: '天金鉱',
            localizedName: '天金鉱'
        });
        expect(__testables.getMfhSearchScore(entries[0], '天金鉱')).toBe(0);
    });

    it('ローカル辞書がある場合は日本語名と別名を検索対象に含める', function() {
        const oldPath = process.env.MFH_LOCALIZATION_PATH;
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfh-localization-'));
        const localPath = path.join(tempDir, 'localization.json');

        fs.writeFileSync(localPath, JSON.stringify({
            entries: [
                {
                    id: 'weapons:serpents-whisper',
                    sourceName: "Serpent's Whisper",
                    name: '蛇の囁き',
                    aliases: ['蛇短剣', '短剣レジェンダリー'],
                    tags: ['正式日本語']
                }
            ]
        }), 'utf8');

        process.env.MFH_LOCALIZATION_PATH = localPath;
        localizationTestables.resetMfhLocalDataCache();

        try {
            const entries = parseMfhCatalogueEntries(`
                <table>
                    <tr data-gamedb-catalogue-item
                        data-id="weapons:serpents-whisper"
                        data-name="Serpent&#39;s Whisper"
                        data-tags="Shadowstrix|Legendary|Dagger"
                        data-search="Serpent&#39;s Whisper Dagger Shadowstrix Legendary">
                        <td data-label="Weapon"><a href="/weapons/serpents-whisper/"><img src="/icons/1213009.webp"><strong>Serpent&#39;s Whisper</strong></a></td>
                    </tr>
                </table>
            `, {
                key: 'weapons',
                label: '武器'
            });

            expect(entries[0]).toMatchObject({
                name: "Serpent's Whisper",
                displayName: '蛇の囁き',
                localizedName: '蛇の囁き',
                aliases: ['蛇短剣', '短剣レジェンダリー', "Serpent's Whisper"]
            });
            expect(entries[0].localizedTags).toContain('正式日本語');
            expect(entries[0].searchText).toContain('蛇の囁き');
            expect(entries[0].searchText).toContain('蛇短剣');
        } finally {
            if (oldPath === undefined) {
                delete process.env.MFH_LOCALIZATION_PATH;
            } else {
                process.env.MFH_LOCALIZATION_PATH = oldPath;
            }

            localizationTestables.resetMfhLocalDataCache();
            fs.rmSync(tempDir, {
                recursive: true,
                force: true
            });
        }
    });
});
