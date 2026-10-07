"use client";

import { CalendarDays, Flag, UserRound, Users } from "lucide-react";
import type { IssueData, IssuePriority } from "@/lib/parse/issue";
import { AttachChip } from "./Attachments";
import { Chip, Field, formatWhen, Missing, Placeholder } from "./shared";
import type { CardProps } from "./types";

const PRIORITY_LABEL: Record<IssuePriority, string> = { high: "High", medium: "Medium", low: "Low" };

export function IssueCard({ data, signals }: CardProps<IssueData>) {
  const due = data.due ? formatWhen(data.due, data.hasTime) : null;
  // Typed priority wins; otherwise the urgency signal can only suggest one.
  const suggested = !data.priority && signals.urgent;

  return (
    <div className="flex flex-col gap-3">
      <Field index={0}>
        {data.summary ? (
          <h2 className="text-[17px] leading-6 font-[550] tracking-[-0.01em] text-pretty break-words">{data.summary}</h2>
        ) : (
          <Missing>No summary yet</Missing>
        )}
      </Field>

      <Field index={1} className="flex flex-wrap items-center gap-2">
        {data.assignee ? <Chip icon={UserRound}>{data.assignee}</Chip> : <Placeholder insert=" @">Assign</Placeholder>}
        {due ? (
          <Chip icon={CalendarDays}>{due.time ? `${due.day}, ${due.time}` : due.day}</Chip>
        ) : (
          <Placeholder insert=" by ">Add due date</Placeholder>
        )}
        {data.priority ? (
          <Chip icon={Flag}>{PRIORITY_LABEL[data.priority]}</Chip>
        ) : suggested ? (
          <Chip icon={Flag} className="opacity-60">
            High <span className="text-muted-foreground font-normal">· suggested</span>
          </Chip>
        ) : (
          <Placeholder insert=" priority: ">Add priority</Placeholder>
        )}
        <AttachChip />
      </Field>

      {data.collaborators.length > 0 && (
        <Field index={2} className="text-ink-2 flex items-center gap-2 text-[15px] leading-[22px]">
          <Users className="text-muted-foreground size-4" aria-hidden />
          <span>cc {data.collaborators.join(", ")}</span>
        </Field>
      )}
    </div>
  );
}
