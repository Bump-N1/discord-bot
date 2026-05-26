const TOKYO_UTC_OFFSET_HOURS = 9;
const INPUT_FORMAT_PATTERN = /^(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/u;

export const ACT_DATETIME_ERROR_MESSAGE = '開始日時は MM/DD HH:mm の形式で入力してください。';

export function parseActDateTime(input, now = new Date()) {
    const text = normalizeInput(input);
    const match = text.match(INPUT_FORMAT_PATTERN);

    if (!match) {
        return null;
    }

    const baseDate = getTokyoDateTimeParts(now);
    const month = Number(match[1]);
    const day = Number(match[2]);
    const hour = Number(match[3]);
    const minute = Number(match[4]);
    let date = toValidDate(baseDate.year, month, day);

    if (!date || !isValidTime(hour, minute)) {
        return null;
    }

    let scheduledAt = buildTokyoDate(date.year, date.month, date.day, hour, minute);

    if (scheduledAt.getTime() <= now.getTime()) {
        if (date.month === baseDate.month && date.day === baseDate.day) {
            return null;
        }

        date = toValidDate(baseDate.year + 1, month, day);
        scheduledAt = buildTokyoDate(date.year, date.month, date.day, hour, minute);
    }

    return {
        scheduledAt: scheduledAt.toISOString(),
        displayText: formatActDateTimeDisplay(date, {
            hour: hour,
            minute: minute
        }),
        inputText: formatActDateTimeInput(date, {
            hour: hour,
            minute: minute
        })
    };
}

export function parseActDateTimeOrThrow(input, now = new Date()) {
    const result = parseActDateTime(input, now);

    if (!result) {
        throw new Error(ACT_DATETIME_ERROR_MESSAGE);
    }

    return result;
}

export function formatDefaultActDateTimeInput(now = new Date()) {
    const roundedDate = new Date(Math.ceil((now.getTime() + 1000) / (10 * 60 * 1000)) * 10 * 60 * 1000);

    return formatActDateTimeInputFromDate(roundedDate);
}

export function formatActDateTimeInputFromScheduledAt(scheduledAt) {
    const date = new Date(scheduledAt || '');

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return formatActDateTimeInputFromDate(date);
}

function formatActDateTimeInputFromDate(date) {
    const dateTime = getTokyoDateTimeParts(date);

    return formatActDateTimeInput(dateTime, dateTime);
}

function normalizeInput(input) {
    return String(input || '')
        .normalize('NFKC')
        .replace(/[　]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
}

function isValidTime(hour, minute) {
    return Number.isInteger(hour)
        && Number.isInteger(minute)
        && hour >= 0
        && hour <= 23
        && minute >= 0
        && minute <= 59;
}

function toValidDate(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return {
        year: year,
        month: month,
        day: day
    };
}

function getTokyoDateTimeParts(date) {
    const tokyoDate = new Date(date.getTime() + TOKYO_UTC_OFFSET_HOURS * 60 * 60 * 1000);

    return {
        year: tokyoDate.getUTCFullYear(),
        month: tokyoDate.getUTCMonth() + 1,
        day: tokyoDate.getUTCDate(),
        hour: tokyoDate.getUTCHours(),
        minute: tokyoDate.getUTCMinutes()
    };
}

function buildTokyoDate(year, month, day, hour, minute) {
    return new Date(Date.UTC(year, month - 1, day, hour - TOKYO_UTC_OFFSET_HOURS, minute, 0, 0));
}

function formatActDateTimeInput(date, time) {
    return `${padNumber(date.month)}/${padNumber(date.day)} ${padNumber(time.hour)}:${padNumber(time.minute)}`;
}

function formatActDateTimeDisplay(date, time) {
    const timeText = time.minute === 0
        ? `${time.hour}時`
        : `${time.hour}時${time.minute}分`;

    return `${date.month}月${date.day}日 ${timeText}`;
}

function padNumber(value) {
    return String(value).padStart(2, '0');
}
