import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { StorageAdapter } from "./types";

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  getAbsolutePath(key: string): string {
    return join(this.rootDir, key);
  }

  async write(key: string, data: Buffer | NodeJS.ReadableStream): Promise<void> {
    const absolutePath = this.getAbsolutePath(key);
    await mkdir(dirname(absolutePath), { recursive: true });
    const source = Buffer.isBuffer(data) ? Readable.from(data) : data;
    await pipeline(source, createWriteStream(absolutePath));
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    const absolutePath = this.getAbsolutePath(key);
    await access(absolutePath);
    return createReadStream(absolutePath);
  }

  async delete(key: string): Promise<void> {
    await rm(this.getAbsolutePath(key), { force: true });
  }
}
