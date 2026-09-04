export const DEFAULT_HTTP_TIMEOUT_MS = 15 * 1000;

export async function fetchWithTimeout(input, init = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function() {
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal
        });
    } catch (error) {
        if (controller.signal.aborted) {
            const timeoutError = new Error(`外部サービスへの接続が${timeoutMs}msでタイムアウトしました。`);
            timeoutError.code = 'HTTP_TIMEOUT';
            timeoutError.cause = error;
            throw timeoutError;
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
