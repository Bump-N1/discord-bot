import { describe, expect, it } from 'vitest';
import {
    ACT_ASSIGNMENT_PREFERENCE,
    applyPreferenceComposition,
    buildPreferencePublicData,
    normalizePreferenceInput,
    usesPreferenceComposition
} from '../src/services/act/act-composition.js';
import {
    getActDefinition,
    getFf14PartyType,
    getFf14RoleSelection,
    usesFf14RoleSlots,
    usesLolLaneSlots
} from '../src/services/act/act-definitions.js';

function buildPreferenceParty(game, fields = {}) {
    const baseSlots = game === 'ow'
        ? {
            tank: null,
            damage1: null,
            damage2: null,
            support1: null,
            support2: null
        }
        : {
            top: null,
            jungle: null,
            middle: null,
            bottom: null,
            utility: null
        };

    return {
        game: game,
        usesSlots: true,
        assignmentMode: ACT_ASSIGNMENT_PREFERENCE,
        slots: baseSlots,
        multiParticipants: {},
        partyType: 'FULL PARTY',
        ...fields
    };
}

describe('act preference composition', function() {
    it('募集が希望制自動編成か判定する', function() {
        expect(usesPreferenceComposition(buildPreferenceParty('lol'))).toBe(true);
        expect(usesPreferenceComposition({
            game: 'lol',
            usesSlots: false,
            assignmentMode: ACT_ASSIGNMENT_PREFERENCE
        })).toBe(false);
    });

    it('LoLの希望入力を正規化し、第1希望必須なら第2希望を無効化する', function() {
        const party = buildPreferenceParty('lol');

        expect(normalizePreferenceInput(party, {
            firstChoice: 'top',
            secondChoice: 'jungle',
            fixed: true
        })).toEqual({
            ok: true,
            preference: {
                firstChoice: 'top',
                secondChoice: '',
                fixed: true,
                jobKey: '',
                secondJobKey: ''
            }
        });
    });

    it('LoLのどこでもは固定扱いにしない', function() {
        const party = buildPreferenceParty('lol');

        expect(normalizePreferenceInput(party, {
            firstChoice: 'any',
            fixed: true
        })).toMatchObject({
            ok: true,
            preference: {
                firstChoice: 'any',
                fixed: false
            }
        });
    });

    it('OWは第2希望を使って空きロールに割り当てる', function() {
        const party = buildPreferenceParty('ow');
        const result = applyPreferenceComposition(party, [
            {
                userId: 'tank-fixed',
                firstChoice: 'tank',
                secondChoice: '',
                fixed: true,
                joinedAt: '2026-05-01T00:00:00.000Z'
            },
            {
                userId: 'tank-or-support',
                firstChoice: 'tank',
                secondChoice: 'support',
                fixed: false,
                joinedAt: '2026-05-01T00:01:00.000Z'
            }
        ]);

        expect(result.ok).toBe(true);
        expect(party.slots).toMatchObject({
            tank: 'tank-fixed',
            support1: 'tank-or-support'
        });
    });

    it('第1希望必須同士で枠が足りない場合は失敗する', function() {
        const party = buildPreferenceParty('ow');
        const result = applyPreferenceComposition(party, [
            {
                userId: 'tank-a',
                firstChoice: 'tank',
                fixed: true,
                joinedAt: '2026-05-01T00:00:00.000Z'
            },
            {
                userId: 'tank-b',
                firstChoice: 'tank',
                fixed: true,
                joinedAt: '2026-05-01T00:01:00.000Z'
            }
        ]);

        expect(result).toMatchObject({
            ok: false,
            message: '希望に合う空き枠がありません。第2希望またはどこでも可を指定してください。'
        });
    });

    it('FF14はジョブ指定を保持し、割り当て先に応じたジョブを使う', function() {
        const party = buildPreferenceParty('ff14', {
            partyType: 'LIGHT PARTY',
            ff14Participants: []
        });
        const result = applyPreferenceComposition(party, [
            {
                userId: 'tank',
                firstChoice: 'tank',
                jobKey: 'warrior',
                fixed: true,
                joinedAt: '2026-05-01T00:00:00.000Z'
            },
            {
                userId: 'flex',
                firstChoice: 'all',
                fixed: false,
                joinedAt: '2026-05-01T00:01:00.000Z'
            }
        ]);

        expect(result.ok).toBe(true);
        expect(party.ff14Participants).toEqual(expect.arrayContaining([
            {
                userId: 'tank',
                role: 'tank',
                jobKey: 'warrior'
            },
            expect.objectContaining({
                userId: 'flex',
                jobKey: expect.stringMatching(/_any$/u)
            })
        ]));
    });

    it('FF14の第2希望ジョブは第2希望ロールと一致している必要がある', function() {
        const party = buildPreferenceParty('ff14');

        expect(normalizePreferenceInput(party, {
            firstChoice: 'dps',
            jobKey: 'dragoon',
            secondChoice: 'healer',
            secondJobKey: 'warrior'
        })).toMatchObject({
            ok: false,
            message: '第2希望のロールに対応するジョブを選択してください。'
        });
    });

    it('Web公開データにFF14ジョブ候補を含める', function() {
        const publicData = buildPreferencePublicData(buildPreferenceParty('ff14'));

        expect(publicData.jobsByRole.tank[0]).toMatchObject({
            key: 'tank_any',
            label: 'ジョブ指定無し'
        });
        expect(publicData.jobsByRole.dps).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'dragoon',
                label: '竜騎士'
            })
        ]));
    });
});

describe('act definitions', function() {
    it('LoLはARAMだけレーン選択を使わない', function() {
        expect(usesLolLaneSlots('ARAM')).toBe(false);
        expect(usesLolLaneSlots('Normal')).toBe(true);
        expect(usesLolLaneSlots('ノーマル（ドラフト）')).toBe(true);
    });

    it('FF14のmodeとrole指定を表記ゆれ込みで正規化する', function() {
        expect(getFf14PartyType('Light Party')).toMatchObject({
            label: 'ライトパーティ',
            maxParticipants: 4
        });
        expect(getFf14PartyType('FULL_PARTY')).toMatchObject({
            label: 'フルパーティ',
            maxParticipants: 8
        });
        expect(getFf14RoleSelection('off')).toBe('OFF');
        expect(getFf14RoleSelection('invalid')).toBe('ON');
        expect(usesFf14RoleSlots({
            ff14RoleSelection: 'OFF'
        })).toBe(false);
    });

    it('ユーザー表示用のモード名を日本語で保持する', function() {
        expect(getActDefinition({
            game: 'lol',
            usesSlots: true
        }).modeLabels).toMatchObject({
            Normal: 'ノーマル（ドラフト）',
            ARAM: 'ランダムミッド'
        });
        expect(getActDefinition({
            game: 'ow',
            usesSlots: true
        }).modeLabels).toMatchObject({
            Quick: 'クイック・プレイ',
            Stadium: 'スタジアム'
        });
    });
});
