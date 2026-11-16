import { describe, expect, it } from "vitest";
import { readModelFile } from "./readModelFile.js";

describe("readModelFile", () => {
  it("returns the file's bytes", async () => {
    const bytes = await readModelFile(new File(["ISO"], "model.ifc"));

    expect(new TextDecoder().decode(bytes)).toBe("ISO");
  });

  it("names the file and its size when the browser refuses to load it whole", async () => {
    const file = new File(["x"], "huge.ifc");
    Object.defineProperty(file, "size", { value: 2150400895 });
    file.arrayBuffer = () => Promise.reject(new DOMException("could not be read", "NotReadableError"));

    await expect(readModelFile(file)).rejects.toThrow(/huge\.ifc \(2\.00 GB\) is too large to view in 3D/);
  });
});
