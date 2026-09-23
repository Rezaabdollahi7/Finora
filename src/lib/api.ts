import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppRuleError } from "@/lib/errors";

/**
 * Shared shape for API errors.
 *
 * Every failure reaches the client as `{ error: { message, code, fields? } }`
 * with a message that is safe to show a user. Raw database and runtime errors
 * are logged on the server and replaced with a generic message, so a stack
 * trace or an SQL fragment can never reach the browser.
 */
export type ApiError = {
  error: {
    message: string;
    code: string;
    /** Per-field messages, for form validation failures. */
    fields?: Record<string, string>;
  };
};

export function apiError(
  message: string,
  code: string,
  status: number,
  fields?: Record<string, string>,
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    { error: { message, code, ...(fields ? { fields } : {}) } },
    { status },
  );
}

/** Thrown by {@link readJsonBody} when the request body is not valid JSON. */
export class InvalidJsonError extends Error {}

/** Turn a thrown error into a response, without leaking its internals. */
export function handleApiError(error: unknown): NextResponse<ApiError> {
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};

    for (const issue of error.issues) {
      const path = issue.path.join(".") || "_";
      fields[path] ??= issue.message;
    }

    return apiError("داده‌های ارسالی معتبر نیست.", "VALIDATION_ERROR", 422, fields);
  }

  if (error instanceof InvalidJsonError) {
    return apiError("بدنه درخواست معتبر نیست.", "INVALID_JSON", 400);
  }

  if (error instanceof AppRuleError) {
    return apiError(error.message, error.code, error.status);
  }

  // Anything else is a bug or an infrastructure failure. Log it for us; show
  // the user something calm and actionable (design system §37).
  console.error("Unhandled API error:", error);

  return apiError("خطایی رخ داد. لطفاً دوباره تلاش کنید.", "INTERNAL_ERROR", 500);
}

/** Parse a JSON body, turning malformed input into a clean 400 rather than a crash. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidJsonError();
  }
}
