import { describe, expect, it } from 'vitest';
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
            localizedTags: ['シャドウストリクス', 'レジェンダリー', 'ダガー'],
            description: 'The weapon Dago carried when fleeing the Shadowstrix Inn.'
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
            localizedTags: ['シャドウストリクス', 'レジェンダリー', 'ダガー'],
            stats: {
                Durability: '1,500',
                Attack: '40',
                'Combat value': '525'
            }
        });
    });

    it('記号や全角差を寄せて検索用文字列を作る', function() {
        expect(__testables.normalizeMfhText("Serpent's Whisper")).toBe('serpentswhisper');
        expect(__testables.normalizeMfhText('シャドウ・ストリクス')).toBe('シャドウストリクス');
    });
});
