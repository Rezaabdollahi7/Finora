import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tables follow docs/DESIGN_SYSTEM.md §24: spacious rows, a muted caption-size
 * header, horizontal separators only, and no vertical rules between columns.
 *
 * The wrapper scrolls horizontally so a wide financial table stays usable on a
 * phone without forcing the user to zoom (rule G.10).
 *
 * That wrapper is `dir="ltr"` with the table itself back in `rtl`, which
 * looks wrong and is not. In an RTL scroll container the overflow runs to the
 * **left**, and left overflow is "unreachable": the container scrolls, but
 * the overflowing width also propagates to the viewport, and the whole page
 * gains a horizontal scrollbar. A 567px table on a 390px phone dragged the
 * document 202px wide — measured, with every other candidate fix (clipping
 * the card, clipping the wrapper, overflow-clip) leaving it at exactly 202.
 * Flipping the container sends the overflow right, where it is scrollable and
 * stays contained; the table's own `rtl` keeps the columns in their right
 * order.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="w-full overflow-x-auto" dir="ltr">
      <table
        data-slot="table"
        dir="rtl"
        className={cn("w-full caption-bottom border-collapse text-body", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  // The header sits on a soft band rather than over a rule (§0.13).
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-0 [&_tr]:bg-muted [&_tr]:hover:bg-muted", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-border font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/60 transition-colors last:border-0",
        "hover:bg-primary-subtle data-[state=selected]:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-start align-middle first:rounded-s-lg last:rounded-e-lg",
        "text-caption font-semibold whitespace-nowrap text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("h-14 px-4 text-start align-middle", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-caption text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
