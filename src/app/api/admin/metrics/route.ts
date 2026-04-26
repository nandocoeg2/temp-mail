import { adminUnauthorizedResponse, isAdminRequest } from "@/lib/server/admin-auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getMailboxService } from "@/lib/server/service-provider";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const metrics = await getMailboxService().adminMetrics();
    return jsonOk({
      ...metrics,
      inboundEvents: metrics.inboundEvents.map((event) => ({
        ...event,
        receivedAt: event.receivedAt.toISOString()
      })),
      rateLimitEvents: metrics.rateLimitEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return jsonError(error);
  }
}
