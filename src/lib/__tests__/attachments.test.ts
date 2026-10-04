import { describe, expect, test } from "bun:test";
import { checkFile, fileKind, formatBytes, isMissing, MAX_BYTES, orphans, storageReason, SWEEP_GRACE_MS } from "@/lib/attachments";

describe("attachments", () => {
  test("accepts any type up to 10 MB", () => {
    expect(checkFile({ name: "crash.log", size: 1200 })).toBeNull();
    expect(checkFile({ name: "shot.png", size: MAX_BYTES })).toBeNull();
  });
  test("rejects empty and oversized files", () => {
    expect(checkFile({ name: "empty.txt", size: 0 })).toBe("is empty");
    expect(checkFile({ name: "video.mov", size: 12 * 1024 * 1024 })).toBe("is 12.0 MB, over the 10 MB limit");
  });
  const now = 10 * SWEEP_GRACE_MS;
  const old = now - SWEEP_GRACE_MS - 1;
  test("orphans: old files whose card was discarded or deleted", () => {
    const records = [
      { id: "a", itemId: 1, addedAt: old },
      { id: "b", itemId: 2, addedAt: old },
      { id: "c", itemId: 3, addedAt: old },
    ];
    expect(orphans(records, new Set([1, 3]), now)).toEqual(["b"]);
    expect(orphans(records, new Set(), now)).toEqual(["a", "b", "c"]);
  });
  test("orphans: a fresh file survives, so another tab's unsaved draft keeps it", () => {
    expect(orphans([{ id: "d", itemId: 9, addedAt: now - 1000 }], new Set(), now)).toEqual([]);
  });
  test("isMissing: unreadable or truncated blobs", () => {
    expect(isMissing({ blob: new Blob(["abc"]), size: 3 })).toBe(false);
    expect(isMissing({ blob: new Blob(["ab"]), size: 3 })).toBe(true);
    expect(isMissing({ blob: undefined as unknown as Blob, size: 3 })).toBe(true);
  });
  test("storageReason names a full disk separately", () => {
    expect(storageReason(new DOMException("full", "QuotaExceededError"))).toContain("storage is full");
    expect(storageReason(new Error("x"))).toContain("blocked or unavailable");
  });
  test("formatBytes", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

describe("file kind (tile icon)", () => {
  test.each([
    ["shot.png", "image/png", "image"],
    ["demo.mp4", "video/mp4", "video"],
    ["call.m4a", "audio/mp4", "audio"],
    ["console-errors.log", "", "text"],
    ["spec.pdf", "application/pdf", "text"],
    ["export.csv", "text/csv", "sheet"],
    ["logs.tar.gz", "application/gzip", "archive"],
    ["payload.json", "application/json", "code"],
    ["notes", "text/plain", "text"],
    ["blob.bin", "application/octet-stream", "other"],
  ])("%s → %s", (name, type, kind) => expect(fileKind({ name, type })).toBe(kind as never));
});
