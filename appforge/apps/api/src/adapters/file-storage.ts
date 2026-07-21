import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env';
import { newId } from '../utils/ids';

export interface StoredFile {
  storageKey: string;
}

export interface FileStorageAdapter {
  save(tenantId: string, fileName: string, content: Buffer): Promise<StoredFile>;
}

/** Local-disk adapter; an S3-compatible adapter can replace it via the same interface. */
class LocalFileStorage implements FileStorageAdapter {
  async save(tenantId: string, fileName: string, content: Buffer): Promise<StoredFile> {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const key = `${tenantId}/${newId()}-${safeName}`;
    const fullPath = join(env.FILE_STORAGE_LOCAL_DIR, key);
    await mkdir(join(env.FILE_STORAGE_LOCAL_DIR, tenantId), { recursive: true });
    await writeFile(fullPath, content);
    return { storageKey: key };
  }
}

let adapter: FileStorageAdapter | null = null;
export function getFileStorage(): FileStorageAdapter {
  if (!adapter) adapter = new LocalFileStorage();
  return adapter;
}
