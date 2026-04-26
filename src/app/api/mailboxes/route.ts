import { getMailboxService } from "@/lib/server/service-provider";
import { clientIdFromRequest, jsonError, jsonOk } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const mailbox = await getMailboxService().createMailbox(clientIdFromRequest(request));
    return jsonOk(toMailboxJson(mailbox), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

function toMailboxJson(mailbox: Awaited<ReturnType<ReturnType<typeof getMailboxService>["createMailbox"]>>) {
  return {
    ...mailbox,
    expiresAt: mailbox.expiresAt.toISOString()
  };
}
