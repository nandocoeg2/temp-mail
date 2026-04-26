import { getMailboxService } from "@/lib/server/service-provider";
import { jsonError, jsonOk, routeParam, tokenFromRequest } from "@/lib/server/http";

type Context = {
  params: Promise<{ id: string; messageId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id, messageId } = await routeParam(context.params);
    const message = await getMailboxService().getMessage(id, tokenFromRequest(request), messageId);
    return jsonOk({
      ...message,
      receivedAt: message.receivedAt.toISOString()
    });
  } catch (error) {
    return jsonError(error);
  }
}
