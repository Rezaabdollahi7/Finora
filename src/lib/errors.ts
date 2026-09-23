/**
 * A broken business rule, as opposed to a bug.
 *
 * Rule errors carry a message that is safe to show the user and the HTTP
 * status that fits them, so the API layer can translate any of them without
 * knowing which feature raised it — which is what keeps `lib/` free of
 * imports from `features/` (see docs/ARCHITECTURE.md).
 */
export class AppRuleError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The requested record does not exist. */
export class NotFoundError extends AppRuleError {
  constructor(message: string) {
    super(message, "NOT_FOUND", 404);
  }
}

/** The record exists, but its current state forbids the operation. */
export class ConflictError extends AppRuleError {
  constructor(message: string, code: string) {
    super(message, code, 409);
  }
}
