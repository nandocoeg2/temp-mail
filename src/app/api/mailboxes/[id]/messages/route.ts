import { getMailboxService } from "@/lib/server/service-provider";
import { jsonError, jsonOk, routeParam, tokenFromRequest } from "@/lib/server/http";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await routeParam(context.params);
    const messages = await getMailboxService().listMessages(id, tokenFromRequest(request));
    return jsonOk({
      messages: messages.map((message) => ({
        ...message,
        receivedAt: message.receivedAt.toISOString()
      }))
    });
  } catch (error) {
    return jsonError(error);
  }
}
