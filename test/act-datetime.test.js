import { describe, expect, it } from 'vitest';
import {
    ACT_DATETIME_ERROR_MESSAGE,
    formatDefaultActDateTimeInput,
    formatActDateTimeInputFromScheduledAt,
    parseActDateTime,
    parseActDateTimeOrThrow
} from '../src/services/act/act-datetime.js';

describe('act date time', function() {
    it('MM/DD HH:mm を東京時間の表示に変換する', function() {
        const now = new Date('2026-05-09T09:00:00.000Z');
        const result = parseActDateTime('05/09 19:10', now);

        expect(result).toEqual({
            scheduledAt: '2026-05-09T10:10:00.000Z',
            displayText: '5月9日 19時10分',
            inputText: '05/09 19:10'
        });
    });

    it('全角入力と余分な空白を正規化する', function() {
        const now = new Date('2026-05-09T09:00:00.000Z');
        const result = parseActDateTime('　０５／１０　２２：００　', now);

        expect(result).toMatchObject({
            scheduledAt: '2026-05-10T13:00:00.000Z',
            displayText: '5月10日 22時',
            inputText: '05/10 22:00'
        });
    });

    it('同日過去時刻と不正フォーマットは null にする', function() {
        const now = new Date('2026-05-09T10:00:00.000Z');

        expect(parseActDateTime('05/09 18:59', now)).toBeNull();
        expect(parseActDateTime('2026/05/09 19:10', now)).toBeNull();
        expect(parseActDateTime('02/29 19:10', now)).toBeNull();
        expect(parseActDateTime('05/09 24:00', now)).toBeNull();
    });

    it('過去日付は翌年の予定として扱う', function() {
        const now = new Date('2026-12-31T12:00:00.000Z');
        const result = parseActDateTime('01/01 00:30', now);

        expect(result).toMatchObject({
            scheduledAt: '2026-12-31T15:30:00.000Z',
            displayText: '1月1日 0時30分',
            inputText: '01/01 00:30'
        });
    });

    it('フォーム初期値は10分単位に丸める', function() {
        const now = new Date('2026-05-09T10:01:30.000Z');

        expect(formatDefaultActDateTimeInput(now)).toBe('05/09 19:10');
        expect(formatActDateTimeInputFromScheduledAt('2026-05-09T10:10:00.000Z')).toBe('05/09 19:10');
    });

    it('例示日時を含まないエラーメッセージを投げる', function() {
        expect(function() {
            parseActDateTimeOrThrow('invalid', new Date('2026-05-09T09:00:00.000Z'));
        }).toThrow(ACT_DATETIME_ERROR_MESSAGE);
        expect(ACT_DATETIME_ERROR_MESSAGE).toContain('MM/DD HH:mm');
        expect(ACT_DATETIME_ERROR_MESSAGE).not.toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/u);
    });
});
