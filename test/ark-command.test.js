import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MessageFlags } from 'discord.js';

const arkBackupServiceMock = vi.hoisted(function() {
    return {
        buildArkBackupFailureNotificationMessage: vi.fn(function(reason, error) {
            return `failure:${reason}:${error.message}`;
        }),
        buildArkBackupNotificationMessage: vi.fn(function(result) {
            return `success:${result.id}`;
        }),
        isArkBackupAlreadyRunningError: vi.fn(function(error) {
            return error?.code === 'ARK_BACKUP_RUNNING';
        }),
        startArkBackup: vi.fn()
    };
});

vi.mock('../src/services/ark/ark-backup-service.js', function() {
    return {
        buildArkBackupFailureNotificationMessage: arkBackupServiceMock.buildArkBackupFailureNotificationMessage,
        buildArkBackupNotificationMessage: arkBackupServiceMock.buildArkBackupNotificationMessage,
        createArkBackup: vi.fn(),
        isArkBackupAlreadyRunningError: arkBackupServiceMock.isArkBackupAlreadyRunningError,
        startArkBackup: arkBackupServiceMock.startArkBackup
    };
});

vi.mock('../src/services/ark/ark-config.js', function() {
    return {
        getArkConfig: function() {
            return {
                notifyChannelId: 'notify-channel'
            };
        }
    };
});

const { handleArkBackupCommand } = await import('../src/commands/ark.js');

function createBackupInteraction() {
    const send = vi.fn();
    const channel = {
        isTextBased: function() {
            return true;
        },
        send: send
    };
    const fetch = vi.fn(async function() {
        return channel;
    });

    return {
        interaction: {
            client: {
                channels: {
                    fetch: fetch
                }
            },
            member: {
                displayName: 'Bump'
            },
            reply: vi.fn(),
            user: {
                displayName: 'Bump',
                id: '100',
                username: 'bump'
            }
        },
        send: send,
        fetch: fetch
    };
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('ARK backup command', function() {
    beforeEach(function() {
        vi.clearAllMocks();
    });

    it('バックアップ開始後は完了を待たずに即時応答する', async function() {
        let resolveBackup;
        const task = new Promise(function(resolve) {
            resolveBackup = resolve;
        });
        const context = createBackupInteraction();

        arkBackupServiceMock.startArkBackup.mockResolvedValue({
            task: task
        });

        await handleArkBackupCommand(context.interaction);

        expect(arkBackupServiceMock.startArkBackup).toHaveBeenCalledWith({
            actorId: '100',
            actorName: 'Bump',
            reason: '手動バックアップ'
        });
        expect(context.interaction.reply).toHaveBeenCalledWith({
            content: 'ARKバックアップを開始しました。完了後、ARK通知チャンネルに結果を投稿します。',
            flags: MessageFlags.Ephemeral
        });
        expect(context.fetch).not.toHaveBeenCalled();

        resolveBackup({
            id: 'backup-1'
        });
        await flushMicrotasks();

        expect(context.fetch).toHaveBeenCalledWith('notify-channel');
        expect(context.send).toHaveBeenCalledWith({
            content: 'success:backup-1'
        });
    });

    it('既にバックアップ処理中のときは実行中であることだけを応答する', async function() {
        const error = new Error('running');
        const context = createBackupInteraction();

        error.code = 'ARK_BACKUP_RUNNING';
        arkBackupServiceMock.startArkBackup.mockRejectedValue(error);

        await handleArkBackupCommand(context.interaction);

        expect(context.interaction.reply).toHaveBeenCalledWith({
            content: 'ARKバックアップは現在実行中です。完了後にもう一度試してください。',
            flags: MessageFlags.Ephemeral
        });
        expect(context.fetch).not.toHaveBeenCalled();
    });
});
