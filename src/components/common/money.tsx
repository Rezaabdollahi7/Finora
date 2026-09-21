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
}: {
  rial: string;
  className?: string;
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
      <span aria-hidden>{formatted}</span>
      {unit ? (
        <span
          aria-hidden
          className="ms-1 text-caption font-normal text-muted-foreground"
        >
          تومان
        </span>
      ) : null}
      <span className="sr-only">{tomanAriaLabel(value)}</span>
    </span>
  );
}

export { Money };
