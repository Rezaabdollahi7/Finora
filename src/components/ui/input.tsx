import * as React from "react";

import { cn } from "@/lib/utils";

/** Input styling follows docs/DESIGN_SYSTEM.md §20. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-card px-[14px] py-2",
        "text-body text-foreground placeholder:text-text-muted",
        "transition-[border-color,box-shadow] duration-150 ease-out outline-none",
        "focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--primary-muted)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--danger-subtle)]",
        "file:inline-flex file:border-0 file:bg-transparent file:text-body file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
