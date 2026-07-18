import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { LocalDiskStorageAdapter } from "./local-disk-storage-adapter";

describe("LocalDiskStorageAdapter", () => {
  const roots: string[] = [];
  const makeRoot = () => {
    const dir = mkdtempSync(join(tmpdir(), "ifc-qa-storage-"));
    roots.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of roots.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips a buffer write/read", async () => {
    const adapter = new LocalDiskStorageAdapter(makeRoot());
    await adapter.write("runs/r1/model.ifc", Buffer.from("ISO-10303-21;"));

    const stream = await adapter.read("runs/r1/model.ifc");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("ISO-10303-21;");
  });

  it("round-trips a stream write", async () => {
    const adapter = new LocalDiskStorageAdapter(makeRoot());
    await adapter.write("runs/r2/model.ifc", Readable.from([Buffer.from("hello")]));

    const stream = await adapter.read("runs/r2/model.ifc");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe("hello");
  });

  it("deletes a stored key", async () => {
    const adapter = new LocalDiskStorageAdapter(makeRoot());
    await adapter.write("runs/r3/model.ifc", Buffer.from("x"));
    await adapter.delete("runs/r3/model.ifc");
    await expect(adapter.read("runs/r3/model.ifc")).rejects.toThrow();
  });

  it("exposes an absolute path for keys that were written", async () => {
    const root = makeRoot();
    const adapter = new LocalDiskStorageAdapter(root);
    await adapter.write("runs/r4/model.ifc", Buffer.from("x"));
    expect(adapter.getAbsolutePath("runs/r4/model.ifc")).toBe(
      join(root, "runs/r4/model.ifc")
    );
  });
});
