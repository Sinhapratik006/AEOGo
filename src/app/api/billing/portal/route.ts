import { getDodo } from "@/lib/dodo";
import { appUrl } from "@/lib/env";
import { assertSameOrigin, HttpError, ok, requireApiUser, withApi } from "@/lib/server/api";

/** Opens the Dodo customer portal (payment methods, invoices, cancellations). */
export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (!user.dodoCustomerId) {
    throw new HttpError(409, "NO_BILLING_ACCOUNT", "You don't have a billing account yet. Subscribe to a plan first.");
  }
  const session = await getDodo().customers.customerPortal.create(user.dodoCustomerId, {
    return_url: `${appUrl()}/dashboard/billing`,
  });
  return ok({ url: session.link });
});
