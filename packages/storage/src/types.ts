export interface StorageAdapter {
  write(key: string, data: Buffer | NodeJS.ReadableStream): Promise<void>;
  read(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  getAbsolutePath(key: string): string;
}
