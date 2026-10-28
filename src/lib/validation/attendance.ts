import { z } from "zod";
import { optionalDay } from "./common";

export const attendanceRangeSchema = z
  .object({ from: optionalDay, to: optionalDay })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    path: ["to"],
    message: "The end of the range can't be before the start",
  });
