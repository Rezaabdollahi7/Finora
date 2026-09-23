"use client";

import type { FieldValues, Path, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromJalaliDate, isValidJalaliDate, toJalaliDate } from "@/utils/date";
import { toLatinDigits } from "@/utils/digits";

/**
 * A Jalali date, as three text fields.
 *
 * Three inputs rather than a calendar popover because this is how a Persian
 * date is spoken and typed — ۲۹ / ۶ / ۱۴۰۵ — and because a numeric keypad on
 * a phone beats hunting through a month grid for a date the user already
 * knows (rule G.10).
 *
 * The fields run day / month / year inside a `dir="ltr"` row. The order is
 * the spoken one; the isolate stops the bidi algorithm from reordering three
 * adjacent number fields, which is what puts the year first.
 *
 * There is no "روز / ماه / سال" line under the fields: in a two-column
 * form it pushed this field below its neighbour. The order is in each
 * input's placeholder and label, and forms say it once in their notes
 * (`DATE_NOTE` in form-notes.tsx).
 *
 * Jalali never reaches the database: {@link readJalaliFields} converts to a
 * UTC instant at the form boundary (rule G.5).
 */
export function JalaliDateField<T extends FieldValues>({
  id,
  label,
  register,
  names,
  error,
}: {
  id: string;
  label: string;
  register: UseFormRegister<T>;
  names: { day: Path<T>; month: Path<T>; year: Path<T> };
  error?: string | undefined;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2" dir="ltr">
        <Input
          id={id}
          aria-label="روز"
          placeholder="روز"
          inputMode="numeric"
          className="text-center"
          {...register(names.day, { required: true })}
        />
        <Input
          aria-label="ماه"
          placeholder="ماه"
          inputMode="numeric"
          className="text-center"
          {...register(names.month, { required: true })}
        />
        <Input
          aria-label="سال"
          placeholder="سال"
          inputMode="numeric"
          className="text-center"
          {...register(names.year, { required: true })}
        />
      </div>
      {error ? <p className="text-caption text-danger">{error}</p> : null}
    </div>
  );
}

/** The three fields as strings, which is what the form holds. */
export type JalaliFields = { year: string; month: string; day: string };

/** Today, ready to seed the fields with. */
export function todayJalaliFields(): JalaliFields {
  const today = toJalaliDate(new Date());

  return {
    year: String(today.year),
    month: String(today.month),
    day: String(today.day),
  };
}

/** An instant as the three fields, for editing an existing record. */
export function toJalaliFields(instant: Date): JalaliFields {
  const jalali = toJalaliDate(instant);

  return {
    year: String(jalali.year),
    month: String(jalali.month),
    day: String(jalali.day),
  };
}

/**
 * Read the three fields as a UTC instant, or null if they are not a date.
 *
 * Persian digits are converted first, because that is what the numeric keypad
 * on a Persian phone produces. Null rather than a fallback date: a date the
 * user did not choose is worse than a visible error.
 */
export function readJalaliFields(fields: JalaliFields): Date | null {
  const year = Number(toLatinDigits(fields.year));
  const month = Number(toLatinDigits(fields.month));
  const day = Number(toLatinDigits(fields.day));

  if (!isValidJalaliDate({ year, month, day })) return null;

  return fromJalaliDate({ year, month, day });
}
