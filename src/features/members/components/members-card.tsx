"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { useMembers } from "@/features/members/components/members-provider";
import { MEMBER_NAME_MAX } from "@/features/members/schemas";
import { SHARED_LABEL, type MemberDto } from "@/features/members/types";

/**
 * Who is in the household (Settings → اعضای خانوار).
 *
 * Finora starts empty: nobody's name is baked in. A household of one can
 * ignore this card entirely and every record is simply the household's;
 * adding a person — themselves, a partner, a child, a parent — is what
 * makes owner pickers, owner filters and the per-person household view
 * appear across the app.
 *
 * A member who still owns records cannot be removed (the API explains
 * why); renaming is always possible.
 */
export function MembersCard() {
  const router = useRouter();
  const members = useMembers();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function send(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    success: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string; fields?: Record<string, string> };
        } | null;
        toast.error(
          payload?.error?.fields?.name ?? payload?.error?.message ?? "انجام نشد.",
        );
        return false;
      }

      toast.success(success);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (await send("/api/members", "POST", { name: trimmed }, `${trimmed} اضافه شد.`)) {
      setName("");
    }
  }

  return (
    <Card id="members" variant="featured" className="reveal scroll-mt-28 gap-5">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>اعضای خانوار</CardTitle>
          <CardDescription>
            کسانی که با آن‌ها پول مشترک دارید؛ هر رکورد یا مال «{SHARED_LABEL}» است یا
            مال یکی از این‌ها.
          </CardDescription>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Users className="size-5" />
        </span>
      </CardHeader>

      {members.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3 text-body text-muted-foreground">
          <UserPlus aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            هنوز کسی اضافه نشده و همه‌چیز به نام خانه ثبت می‌شود. اگر تنها از برنامه
            استفاده می‌کنید همین کافی است؛ وگرنه خودتان و بقیه اعضا را با نامی که
            می‌خواهید اضافه کنید.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} busy={busy} send={send} />
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex items-center gap-2">
        <label htmlFor="new-member" className="sr-only">
          نام عضو جدید
        </label>
        <Input
          id="new-member"
          value={name}
          maxLength={MEMBER_NAME_MAX}
          placeholder="نام عضو جدید، مثلاً سارا"
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <Button type="submit" disabled={busy || name.trim() === ""}>
          <Plus />
          افزودن
        </Button>
      </form>
    </Card>
  );
}

function MemberRow({
  member,
  busy,
  send,
}: {
  member: MemberDto;
  busy: boolean;
  send: (
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    success: string,
  ) => Promise<boolean>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(member.name);
  const url = `/api/members/${member.id}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || trimmed === member.name) {
      setEditing(false);
      return;
    }
    if (await send(url, "PATCH", { name: trimmed }, "نام تغییر کرد."))
      setEditing(false);
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="flex items-center gap-2">
          <label htmlFor={`member-${member.id}`} className="sr-only">
            نام {member.name}
          </label>
          <Input
            id={`member-${member.id}`}
            value={draft}
            maxLength={MEMBER_NAME_MAX}
            autoFocus
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
          <Button type="submit" size="icon" aria-label="ذخیره نام" disabled={busy}>
            <Check />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="انصراف"
            onClick={() => {
              setDraft(member.name);
              setEditing(false);
            }}
          >
            <X />
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg bg-muted py-2 ps-2 pe-4">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-body font-semibold text-primary"
      >
        {member.name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 truncate text-body font-medium">
        {member.name}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`تغییر نام ${member.name}`}
        disabled={busy}
        onClick={() => {
          setEditing(true);
        }}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`حذف ${member.name}`}
        disabled={busy}
        onClick={() => {
          if (window.confirm(`${member.name} از اعضای خانوار حذف شود؟`)) {
            void send(url, "DELETE", undefined, `${member.name} حذف شد.`);
          }
        }}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
