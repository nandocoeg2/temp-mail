import { metricsResponse } from "@/lib/server/metrics-endpoint";

export async function GET(request: Request) {
  return metricsResponse(request);
}
