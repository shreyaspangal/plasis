import { persistedIds } from "@/lib/savedItems";

/**
 * Files attached to a card, kept in IndexedDB (not localStorage: that is ~5 MB of text
 * shared with the saved list, and one screenshot would fill it). Files are keyed by the
 * card's draft id, which becomes the saved item's id, so saving needs no copy step.
 */
export type Attachment = { id: string; itemId: number; name: string; type: string; size: number; blob: Blob; addedAt: number };
export type Rejected = { name: string; reason: string };

export const MAX_BYTES = 10 * 1024 * 1024;

/** Pure checks, kept separate from IndexedDB so they can be tested. */
export function checkFile(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "is empty";
  if (file.size > MAX_BYTES) return `is ${formatBytes(file.size)}, over the 10 MB limit`;
  return null;
}

/**
 * Files whose card no longer exists: discarded drafts, or items deleted after the undo window.
 * Only files older than a day, so another open tab's unsaved draft keeps its files.
 */
export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;
export function orphans(records: Pick<Attachment, "id" | "itemId" | "addedAt">[], keep: Set<number>, now = Date.now()): string[] {
  return records.filter((r) => !keep.has(r.itemId) && now - r.addedAt > SWEEP_GRACE_MS).map((r) => r.id);
}

/** A record whose file can't be read back (storage cleared or corrupted). */
export function isMissing(a: Pick<Attachment, "blob" | "size">): boolean {
  return !(a.blob instanceof Blob) || a.blob.size !== a.size;
}

/** Why a write failed, in words a person can act on. */
export function storageReason(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "QuotaExceededError") return "couldn't be attached: browser storage is full";
  return "couldn't be attached: browser storage is blocked or unavailable";
}

export type FileKind = "image" | "video" | "audio" | "sheet" | "archive" | "code" | "text" | "other";

const KIND_BY_EXT: [RegExp, FileKind][] = [
  [/\.(csv|tsv|xlsx?|ods|numbers)$/i, "sheet"],
  [/\.(zip|gz|tgz|tar|rar|7z)$/i, "archive"],
  [/\.(js|jsx|ts|tsx|json|html?|css|py|rb|go|rs|java|sh|ya?ml|sql)$/i, "code"],
  [/\.(txt|log|md|pdf|docx?|rtf)$/i, "text"],
];

/** Which icon a file's tile shows: the browser's type first, then the extension (logs often have no type). */
export function fileKind(file: { name: string; type: string }): FileKind {
  const major = file.type.split("/")[0];
  if (major === "image" || major === "video" || major === "audio") return major;
  return KIND_BY_EXT.find(([re]) => re.test(file.name))?.[1] ?? (major === "text" ? "text" : "other");
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const DB = "plasis";
const STORE = "attachments";
let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available"));
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" }).createIndex("itemId", "itemId");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).then(async (db) => {
    // Sweep once per page load, before the undo window of this session can matter.
    const all = await done(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<Attachment[]>);
    const stale = orphans(all, persistedIds());
    if (stale.length) {
      const store = db.transaction(STORE, "readwrite").objectStore(STORE);
      await Promise.all(stale.map((id) => done(store.delete(id))));
    }
    return db;
  });
  return dbPromise;
}

const changed = () => listeners.forEach((l) => l());

export const attachments = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },

  async list(itemId: number): Promise<Attachment[]> {
    const db = await open();
    const rows = await done(db.transaction(STORE).objectStore(STORE).index("itemId").getAll(itemId) as IDBRequest<Attachment[]>);
    return rows.sort((a, b) => a.addedAt - b.addedAt);
  },

  async add(itemId: number, files: File[]): Promise<Rejected[]> {
    const rejected: Rejected[] = [];
    const ok = files.filter((f) => {
      const reason = checkFile(f);
      if (reason) rejected.push({ name: f.name, reason });
      return !reason;
    });
    if (ok.length) {
      try {
        const db = await open();
        const store = db.transaction(STORE, "readwrite").objectStore(STORE);
        const now = Date.now();
        await Promise.all(
          ok.map((f, i) =>
            done(
              store.put({
                id: crypto.randomUUID(),
                itemId,
                name: f.name,
                type: f.type,
                size: f.size,
                blob: f,
                // + i keeps the picked order when several files land in the same millisecond.
                addedAt: now + i,
              } satisfies Attachment),
            ),
          ),
        );
        changed();
      } catch (err) {
        // Quota exceeded, private mode or blocked storage.
        rejected.push(...ok.map((f) => ({ name: f.name, reason: storageReason(err) })));
      }
    }
    return rejected;
  },

  async remove(id: string) {
    const db = await open();
    await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
    changed();
  },
};
