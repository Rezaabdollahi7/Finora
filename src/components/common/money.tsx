import { cn } from "@/lib/utils";
import { formatToman, tomanAriaLabel } from "@/utils/money";

/**
 * A monetary amount.
 *
 * Takes the Rial value as a decimal string, which is how money crosses every
 * boundary in this application (see AccountDto), and parses it with BigInt
 * rather than Number so nothing rounds on the way to the screen.
 *
 * The visible text uses Latin digits and a lighter unit, per design system
 * §41; the accessible label uses Persian digits, which screen readers
 * announce more reliably inside Persian text.
 */
function Money({
  rial,
  className,
  tone = "default",
  signed = false,
  unit = true,
  unitClassName,
}: {
  rial: string;
  className?: string;
  /** For a surface where the muted unit would not read, like the gradient card. */
  unitClassName?: string;
  tone?: "default" | "muted" | "positive" | "negative" | "auto";
  signed?: boolean;
  unit?: boolean;
}) {
  const value = BigInt(rial);
  const resolvedTone =
    tone === "auto"
      ? value < 0n
        ? "negative"
        : value > 0n
          ? "positive"
          : "muted"
      : tone;

  const formatted = formatToman(value, {
    withUnit: false,
    ...(signed ? { signDisplay: "always" as const } : {}),
  });

  return (
    <span
      className={cn(
        "tabular",
        resolvedTone === "muted" && "text-muted-foreground",
        resolvedTone === "positive" && "text-success",
        resolvedTone === "negative" && "text-danger",
        className,
      )}
    >
      {/*
        dir="ltr" isolates the number as its own run. A leading sign is a
        bidi-neutral character, so without the isolate it is reordered to the
        far end and "−1,250,000" renders as "1,250,000−".
      */}
      <span aria-hidden dir="ltr" className="inline-block">
        {formatted}
      </span>
      {unit ? (
        <span
          aria-hidden
          className={cn(
            "ms-1 text-caption font-normal text-muted-foreground",
            unitClassName,
          )}
        >
          تومان
        </span>
      ) : null}
      <span className="sr-only">{tomanAriaLabel(value)}</span>
    </span>
  );
}

export { Money };
