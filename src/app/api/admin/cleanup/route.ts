import { adminUnauthorizedResponse, isAdminRequest } from "@/lib/server/admin-auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getMailboxService } from "@/lib/server/service-provider";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const deletedMessages = await getMailboxService().cleanupExpiredContent();
    return jsonOk({ deletedMessages });
  } catch (error) {
    return jsonError(error);
  }
}
