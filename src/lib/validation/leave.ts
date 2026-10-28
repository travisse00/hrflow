import { z } from "zod";
import { dayField, objectId } from "./common";

export const LEAVE_TYPES = ["ANNUAL", "SICK", "CASUAL", "MATERNITY", "PATERNITY", "UNPAID"] as const;

export const leaveRequestSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: dayField,
    endDate: dayField,
    reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(1000),
  })
  // YYYY-MM-DD strings sort the same way the dates do, so a plain comparison is enough.
  .refine((d) => d.endDate >= d.startDate, {
    path: ["endDate"],
    message: "End date can't be before the start date",
  });

export const reviewLeaveSchema = z
  .object({
    id: objectId,
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((d) => d.decision !== "REJECTED" || (d.note !== undefined && d.note.length >= 3), {
    path: ["note"],
    message: "Give a reason when rejecting a request",
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
