"use client";

import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FileX,
  ImageOff,
  type LucideIcon,
  Paperclip,
  X,
} from "lucide-react";
import { createContext, type DragEvent, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type Attachment, attachments, type FileKind, fileKind, formatBytes, isMissing } from "@/lib/attachments";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Field, ItemIdContext, Placeholder } from "./shared";

type Shown = Attachment & { url: string | null; missing: boolean };

const KIND_ICON: Record<FileKind, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  sheet: FileSpreadsheet,
  archive: FileArchive,
  code: FileCode,
  text: FileText,
  other: File,
};
const MAX_LABEL = "Max 10 MB each"; // MAX_BYTES; formatBytes would print "10.0 MB"
type State = { status: "loading" | "ready" | "unavailable"; items: Shown[] };

function useAttachments(itemId: number | null): State {
  const [state, setState] = useState<State>({ status: "loading", items: [] });
  useEffect(() => {
    if (itemId === null) return;
    let live = true;
    let urls: string[] = [];
    const revoke = () => urls.forEach((u) => URL.revokeObjectURL(u));
    const load = () =>
      attachments.list(itemId).then(
        (list) => {
          if (!live) return;
          const items = list.map((a) => {
            const missing = isMissing(a);
            return { ...a, missing, url: missing ? null : URL.createObjectURL(a.blob) };
          });
          revoke();
          urls = items.flatMap((i) => (i.url ? [i.url] : []));
          setState({ status: "ready", items });
        },
        () => live && setState({ status: "unavailable", items: [] }),
      );
    load();
    const unsubscribe = attachments.subscribe(load);
    return () => {
      live = false;
      unsubscribe();
      revoke();
    };
  }, [itemId]);
  return state;
}

async function addFiles(itemId: number, files: File[]) {
  const rejected = await attachments.add(itemId, files);
  for (const r of rejected) notify(`${r.name} ${r.reason}`, { lead: "Not attached:" });
}

async function removeFile(file: Shown) {
  try {
    await attachments.remove(file.id);
  } catch {
    notify(`Couldn't remove ${file.name}. Try again.`);
  }
}

/** Opens the file picker of the attachments card around it; null anywhere else. */
const AttachContext = createContext<(() => void) | null>(null);

/**
 * A card body with attachments: files can be dropped anywhere on it, their tiles sit below its fields,
 * and the card's own "+ Attach" chip (AttachChip) opens the picker.
 * CardView adds it for registry entries with `attachments: true`, so the flag alone turns them on.
 */
export function WithAttachments({ interactive, children }: { interactive: boolean; children: ReactNode }) {
  const itemId = useContext(ItemIdContext);
  const input = useRef<HTMLInputElement>(null);
  return (
    <AttachContext value={interactive && itemId !== null ? () => input.current?.click() : null}>
      <AttachmentDrop enabled={interactive}>
        <div className="flex flex-col gap-3">
          {children}
          {/* After the card's own fields in the stagger (they use 0–2). */}
          <Field index={3}>
            <AttachmentList interactive={interactive} />
          </Field>
        </div>
        {itemId !== null && (
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) void addFiles(itemId, files);
            }}
          />
        )}
      </AttachmentDrop>
    </AttachContext>
  );
}

/** "+ Attach", styled like the card's other missing fields so it sits in their row; nothing outside an attachments card. */
export function AttachChip() {
  const open = useContext(AttachContext);
  if (!open) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={open}
          aria-label={`Attach files, ${MAX_LABEL.toLowerCase()}`}
          className="focus-visible:outline-ring rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Placeholder icon={Paperclip} className="hover:border-muted-foreground hover:text-ink-2 transition-[border-color,color] duration-150 ease-out">
            Attach
          </Placeholder>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{MAX_LABEL}</TooltipContent>
    </Tooltip>
  );
}

/** Wraps a card body so files can be dropped anywhere on it. */
function AttachmentDrop({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const itemId = useContext(ItemIdContext);
  const [over, setOver] = useState(false);
  const active = enabled && itemId !== null;
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

  return (
    <div
      onDragOver={(e) => {
        if (!active || !hasFiles(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!active || !hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        void addFiles(itemId, Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "-m-2 rounded-xl p-2 transition-[background-color,box-shadow] duration-150",
        over && "bg-secondary/60 ring-ring/40 ring-2",
      )}
    >
      {children}
    </div>
  );
}

/** Attached files as square tiles below the card's fields. */
function AttachmentList({ interactive }: { interactive: boolean }) {
  const itemId = useContext(ItemIdContext);
  const { status, items } = useAttachments(itemId);
  if (itemId === null) return null;

  if (status === "unavailable") {
    return <p className="text-muted-foreground text-[13px] leading-[18px]">Attachments aren&apos;t available in this browser.</p>;
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {items.map((a) => (
        <FileTile key={a.id} file={a} onRemove={interactive ? () => void removeFile(a) : undefined} />
      ))}
    </div>
  );
}

function FileTile({ file, onRemove }: { file: Shown; onRemove?: () => void }) {
  const [broken, setBroken] = useState(false);
  const kind = fileKind(file);
  // The tile shows a thumbnail or a type icon; the name and size live in the tooltip.
  const label = file.missing ? `${file.name} · missing` : `${file.name} · ${formatBytes(file.size)}`;
  const Icon = file.missing ? FileX : broken ? ImageOff : KIND_ICON[kind];

  const body =
    kind === "image" && !broken && !file.missing && file.url ? (
      // eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not an optimizable asset
      <img src={file.url} alt="" onError={() => setBroken(true)} className="size-full object-cover" />
    ) : (
      <Icon className="text-muted-foreground size-5" aria-hidden />
    );

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          {file.missing || !file.url ? (
            <div aria-label={label} className="border-border bg-secondary grid size-16 place-items-center overflow-hidden rounded-lg border">
              {body}
            </div>
          ) : (
            <a
              href={file.url}
              download={file.name}
              aria-label={`Download ${label}`}
              className="border-border bg-secondary focus-visible:outline-ring grid size-16 place-items-center overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {body}
            </a>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-60 break-all">
          {label}
        </TooltipContent>
      </Tooltip>
      {onRemove && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="bg-foreground text-background focus-visible:outline-ring absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full shadow-sm transition-[scale] duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** On a card type that can't show files: say they're kept, so switching types never looks like data loss. */
export function HiddenAttachmentsNotice({ showsOn }: { showsOn: string }) {
  const itemId = useContext(ItemIdContext);
  const { items } = useAttachments(itemId);
  if (items.length === 0) return null;
  const n = items.length;
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-[13px] leading-[18px]">
      <Paperclip className="size-3.5 shrink-0" aria-hidden />
      {n === 1 ? "1 attached file is kept, but only shows" : `${n} attached files are kept, but only show`} on {showsOn} cards.
    </p>
  );
}
