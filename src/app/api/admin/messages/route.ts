import { isValidEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  HttpError,
  ok,
  readJsonBody,
  requireApiAdmin,
  str,
  tooManyRequests,
  withApi,
} from "@/lib/server/api";
import { BODY_MAX, SUBJECT_MAX, sendAdminMessage } from "@/lib/server/messages";

/** Admin sends a message to one user (by email) or to every user. */
export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const admin = await requireApiAdmin();

  const limit = await rateLimit(`admin-message:${admin.id}`, 30, 60 * 60);
  if (!limit.ok) throw tooManyRequests(limit.retryAfterSeconds, "You've sent a lot of messages. Please wait before sending more.");

  const body = await readJsonBody(req, 32_768);
  const subject = str(body.subject, SUBJECT_MAX + 1);
  const text = str(body.body, BODY_MAX + 1);
  const to = body.to === "all" ? "all" : str(body.email, 320);

  if (!subject) throw new HttpError(400, "VALIDATION_ERROR", "Please enter a subject.", { field: "subject" });
  if (subject.length > SUBJECT_MAX)
    throw new HttpError(400, "VALIDATION_ERROR", `Subject must be at most ${SUBJECT_MAX} characters.`, { field: "subject" });
  if (!text) throw new HttpError(400, "VALIDATION_ERROR", "Please write a message.", { field: "body" });
  if (text.length > BODY_MAX)
    throw new HttpError(400, "VALIDATION_ERROR", `Message must be at most ${BODY_MAX} characters.`, { field: "body" });
  if (to !== "all" && !isValidEmail(to))
    throw new HttpError(400, "VALIDATION_ERROR", "Enter a valid recipient email.", { field: "email" });

  const result = await sendAdminMessage({
    senderId: admin.id,
    recipient: to === "all" ? "all" : { email: to },
    subject,
    body: text,
  });
  if (!result) throw new HttpError(404, "VALIDATION_ERROR", "No user with that email.", { field: "email" });
  return ok({ recipients: result.recipients }, 201);
});
