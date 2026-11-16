// Browsers cap one ArrayBuffer (and so File.arrayBuffer()) at roughly 2 GB, and the failure they
// give — "NotReadableError: The requested file could not be read, typically due to permission
// problems" — names nothing about size. The geometry engine needs the whole file in one buffer,
// unlike the check, which streams it.
export async function readModelFile(file: File): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    const gigabytes = (file.size / 1024 ** 3).toFixed(2);
    throw new Error(
      `${file.name} (${gigabytes} GB) is too large to view in 3D: the viewer can load files of roughly 2 GB or less. The file can still be checked.`
    );
  }
}
