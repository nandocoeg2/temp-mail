import { getMailboxService } from "@/lib/server/service-provider";
import { jsonError, jsonOk, routeParam, tokenFromRequest } from "@/lib/server/http";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await routeParam(context.params);
    const mailbox = await getMailboxService().extendMailbox(id, tokenFromRequest(request));
    return jsonOk({ ...mailbox, expiresAt: mailbox.expiresAt.toISOString() });
  } catch (error) {
    return jsonError(error);
  }
}
