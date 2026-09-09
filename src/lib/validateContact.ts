import { z } from "zod";
import type { ContactInput } from "./types";

/**
 * Mirrors the database CHECK constraints in db/schema.sql (non-blank name,
 * priority in high|medium|low). The Postgres constraints are the real,
 * non-bypassable enforcement; this runs first so the UI can show a clear
 * error message without a round trip, and so the rule is unit-testable.
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required."),
  company: z.string().trim().max(200, "Company is too long.").optional().default(""),
  role: z.string().trim().max(200, "Role is too long.").optional().default(""),
  met_at: z.string().trim().max(300, "Where you met is too long.").optional().default(""),
  notes: z.string().trim().max(4000, "Notes are too long.").optional().default(""),
  priority: z.enum(["high", "medium", "low"], {
    message: "Priority must be high, medium, or low.",
  }),
});

export type ValidationResult =
  | { success: true; data: ContactInput }
  | { success: false; error: string };

export function validateContact(input: unknown): ValidationResult {
  const result = contactSchema.safeParse(input);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return { success: false, error: firstIssue?.message ?? "Invalid contact data." };
  }
  return { success: true, data: result.data };
}
