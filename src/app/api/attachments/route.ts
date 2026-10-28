import { getCurrentUser } from "@/lib/auth/current-user";
import { AppError } from "@/lib/errors";
import { httpErrorResponse } from "@/lib/http";
import { saveUpload } from "@/modules/messaging/attachments";

// POST /api/attachments  (multipart/form-data, field "file")
// Step 1 of attaching a file to a message. A route handler (not a server action) so the
// browser can use XMLHttpRequest and show real upload progress.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError("VALIDATION", "The upload couldn't be read. Please try again.");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "No file was uploaded.");

    const attachment = await saveUpload(user, file);
    return Response.json(attachment, { status: 201 });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
