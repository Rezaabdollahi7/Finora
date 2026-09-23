import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export type FormNote = {
  /** The field the note is about, as its label reads. */
  label?: string;
  text: React.ReactNode;
  /** Show the note only in some states of the form, e.g. when editing. */
  when?: boolean;
};

/** The one note every form with a Jalali date field needs. */
export const DATE_NOTE: FormNote = {
  label: "تاریخ",
  text: "شمسی؛ از چپ به راست روز، ماه و سال — با ارقام فارسی یا انگلیسی.",
};

/**
 * A form's explanations, gathered above its buttons.
 *
 * Help text used to sit under each input. In a two-column row that pushes
 * one field down and not its neighbour, so inputs meant to line up did not,
 * and a form read as ragged. Collected here, the fields keep one rhythm and
 * the notes are read once, just before the person commits — which is when
 * "an empty field means the purchase price" is actually useful.
 *
 * Validation errors stay under their fields: an error belongs to the input
 * it is about, and appears only after a mistake, so it does not misalign an
 * untouched form.
 */
function FormNotes({ notes, className }: { notes: FormNote[]; className?: string }) {
  const visible = notes.filter((note) => note.when !== false);

  if (visible.length === 0) return null;

  return (
    <aside
      aria-label="راهنمای فرم"
      className={cn(
        "flex gap-3 rounded-lg bg-muted px-4 py-3 text-caption text-muted-foreground",
        className,
      )}
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <ul className="flex min-w-0 flex-col gap-1.5">
        {visible.map((note, index) => (
          <li key={note.label ?? index}>
            {note.label ? (
              <span className="font-medium text-foreground">{note.label}: </span>
            ) : null}
            {note.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export { FormNotes };
