import { getMailboxService } from "@/lib/server/service-provider";
import { jsonError, jsonOk, routeParam, tokenFromRequest } from "@/lib/server/http";

type Context = {
  params: Promise<{ id: string; messageId: string; attachmentId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { id, messageId, attachmentId } = await routeParam(context.params);
    const result = await getMailboxService().createAttachmentDownloadUrl(
      id,
      tokenFromRequest(request),
      messageId,
      attachmentId
    );
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
