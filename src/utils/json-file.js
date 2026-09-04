import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export async function writeJsonFileAtomic(filePath, value) {
    const directory = path.dirname(filePath);
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

    await mkdir(directory, {
        recursive: true
    });

    try {
        await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await rename(temporaryPath, filePath);
    } finally {
        await rm(temporaryPath, {
            force: true
        });
    }
}
