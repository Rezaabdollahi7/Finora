"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { caretAfterGrouping, groupAmountInput } from "@/utils/money";

/**
 * A Toman amount field that groups its digits in threes as they are typed.
 *
 * `12500000` becomes `12,500,000` on the fly, so a missing zero is visible
 * before the form is sent. The value the form holds is the grouped text;
 * every money parser already ignores the separators, so nothing downstream
 * changes. The caret stays after the digit it was after, even when a comma
 * appears or disappears in front of it.
 *
 * Not `type="number"`: that rejects Persian digits and separators, and
 * gives a phone the wrong keypad.
 */
function MoneyInput({
  value,
  onChange,
  className,
  ref,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const inner = React.useRef<HTMLInputElement | null>(null);
  const pendingCaret = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    if (pendingCaret.current === null || !inner.current) return;
    inner.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  return (
    <Input
      {...props}
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      inputMode="decimal"
      dir="ltr"
      autoComplete="off"
      className={cn("tabular text-start", className)}
      value={groupAmountInput(value)}
      onChange={(event) => {
        const raw = event.target.value;
        const grouped = groupAmountInput(raw);
        const caret = event.target.selectionStart ?? raw.length;

        pendingCaret.current = caretAfterGrouping(raw, caret, grouped);
        onChange(grouped);
      }}
    />
  );
}

export { MoneyInput };
