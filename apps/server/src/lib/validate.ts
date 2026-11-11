import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { badRequest, notFound } from "./errors.js";

/** Parse untrusted input with a zod schema, raising a 400 with field errors on failure. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest("Validation failed", z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

/** Ensure a route param is a valid ObjectId; invalid ids are reported as not found to avoid leaking info. */
export function objectId(value: unknown, what = "Resource"): string {
  if (typeof value !== "string" || !isValidObjectId(value)) throw notFound(what);
  return value;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
