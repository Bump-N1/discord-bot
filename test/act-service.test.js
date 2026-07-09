import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACT_ASSIGNMENT_PREFERENCE } from '../src/services/act/act-composition.js';

let originalCwd;
let tempDir;
let service;

function commonOptions(fields = {}) {
    return {
        datetime: '07/10 20:00',
        details: '誰でも',
        creatorId: 'creator',
        guildId: 'guild',
        channelId: 'channel',
        ...fields
    };
}

beforeEach(async function() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'act-service-'));
    process.chdir(tempDir);
    vi.resetModules();
    service = await import('../src/services/act/act-service.js');
});

afterEach(async function() {
    process.chdir(originalCwd);
    await rm(tempDir, {
        recursive: true,
        force: true
    });
    vi.useRealTimers();
});

describe('act service', function() {
    it('ARAMは参加者リストで管理し、人数上限と離脱を処理する', async function() {
        const party = await service.createLolAct(commonOptions({
            mode: 'ARAM'
        }));

        expect(party.usesSlots).toBe(false);

        await expect(service.joinActList(party.id, 'u1', 'Bump')).resolves.toMatchObject({
            ok: true,
            party: {
                participants: ['u1'],
                participantNames: {
                    u1: 'Bump'
                }
            }
        });

        for (const userId of ['u2', 'u3', 'u4', 'u5']) {
            await service.joinActList(party.id, userId, userId);
        }

        await expect(service.joinActList(party.id, 'u6', 'u6')).resolves.toMatchObject({
            ok: false,
            message: '募集人数が埋まっています。'
        });

        await expect(service.leaveAct(party.id, 'u1')).resolves.toMatchObject({
            ok: true,
            party: {
                participants: ['u2', 'u3', 'u4', 'u5']
            }
        });
    });

    it('LoLはレーン選択後に参加確定し、どこでも枠も保持する', async function() {
        const party = await service.createLolAct(commonOptions({
            mode: 'Normal'
        }));

        await expect(service.confirmActSlot(party.id, 'top-user')).resolves.toMatchObject({
            ok: false,
            message: '先にレーンを選択してください。'
        });

        await expect(service.selectActSlot(party.id, 'top', 'top-user')).resolves.toMatchObject({
            ok: true,
            deferred: true
        });
        await expect(service.confirmActSlot(party.id, 'top-user')).resolves.toMatchObject({
            ok: true,
            party: {
                slots: {
                    top: 'top-user'
                }
            }
        });

        await service.selectActSlot(party.id, 'any', 'flex-user');

        await expect(service.confirmActSlot(party.id, 'flex-user')).resolves.toMatchObject({
            ok: true,
            party: {
                multiParticipants: {
                    any: ['flex-user']
                }
            }
        });
    });

    it('OWはDamage/Supportの同一ロール枠を上から詰めて管理する', async function() {
        const party = await service.createOwAct(commonOptions({
            mode: 'Quick'
        }));

        await service.selectActSlot(party.id, 'damage', 'damage-a');
        await service.confirmActSlot(party.id, 'damage-a');
        await service.selectActSlot(party.id, 'damage', 'damage-b');
        const secondJoin = await service.confirmActSlot(party.id, 'damage-b');

        expect(secondJoin.party.slots).toMatchObject({
            damage1: 'damage-a',
            damage2: 'damage-b'
        });

        const leave = await service.leaveAct(party.id, 'damage-a');

        expect(leave.party.slots).toMatchObject({
            damage1: 'damage-b',
            damage2: null
        });
    });

    it('FF14はロールとジョブを選択して確定し、ロール定員を守る', async function() {
        const party = await service.createFf14Act(commonOptions({
            partyType: 'LIGHT PARTY',
            ff14RoleSelection: 'ON',
            contentName: '極タコ'
        }));

        await service.selectFf14Role(party.id, 'tank', 'tank-a');
        await service.selectFf14Job(party.id, 'warrior', 'tank-a');

        await expect(service.confirmActSlot(party.id, 'tank-a')).resolves.toMatchObject({
            ok: true,
            party: {
                ff14Participants: [
                    {
                        userId: 'tank-a',
                        role: 'tank',
                        jobKey: 'warrior'
                    }
                ]
            }
        });

        await expect(service.selectFf14Role(party.id, 'tank', 'tank-b')).resolves.toMatchObject({
            ok: false,
            message: 'タンク枠が埋まっています。'
        });
    });

    it('募集の編集、締め切り、締め切り解除は作成者だけが実行できる', async function() {
        const party = await service.createFf14Act(commonOptions({
            partyType: 'FULL PARTY',
            ff14RoleSelection: 'OFF',
            contentName: '零式'
        }));

        await expect(service.updateActEditableFields(party.id, 'other', {
            contentName: '絶',
            datetime: '07/10 21:00',
            details: '変更'
        })).resolves.toMatchObject({
            ok: false,
            message: '募集を編集できるのは作成者だけです。'
        });

        await expect(service.updateActEditableFields(party.id, 'creator', {
            contentName: '絶',
            datetime: '07/10 21:00',
            details: '変更'
        })).resolves.toMatchObject({
            ok: true,
            party: {
                contentName: '絶',
                mode: '絶',
                datetime: '7月10日 21時'
            }
        });

        await expect(service.closeAct(party.id, 'other')).resolves.toMatchObject({
            ok: false,
            message: '募集を締め切れるのは作成者だけです。'
        });

        const closed = await service.closeAct(party.id, 'creator');

        expect(closed.party.status).toBe('closed');

        await expect(service.reopenAct(party.id, 'creator')).resolves.toMatchObject({
            ok: true,
            party: {
                status: 'open',
                closedAt: ''
            }
        });
    });

    it('希望制Web募集は希望登録で自動編成を保存する', async function() {
        const party = await service.createLolAct(commonOptions({
            mode: 'Normal',
            assignmentMode: ACT_ASSIGNMENT_PREFERENCE,
            webManaged: true
        }));

        await expect(service.setActPreference(party.id, 'u1', 'Bump', {
            firstChoice: 'top',
            fixed: true
        })).resolves.toMatchObject({
            ok: true,
            party: {
                slots: {
                    top: 'u1'
                }
            }
        });

        await expect(service.getActById(party.id)).resolves.toMatchObject({
            preferenceParticipants: [
                expect.objectContaining({
                    userId: 'u1',
                    displayName: 'Bump',
                    assignedRole: 'top'
                })
            ]
        });
    });
});
