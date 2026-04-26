import { timingSafeEqual } from "node:crypto";
import { productionMetrics } from "./metrics";
import { getRepository } from "./service-provider";

export async function metricsResponse(request: Request): Promise<Response> {
  if (!isMetricsAuthorized(request)) {
    return new Response("Metrics token required", {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "www-authenticate": 'Bearer realm="DropMail Metrics"'
      }
    });
  }

  // Ensure repository is initialized for DB-backed metrics
  getRepository();

  return new Response(await productionMetrics.render(), {
    headers: {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isMetricsAuthorized(request: Request): boolean {
  const expectedToken = process.env.METRICS_TOKEN;
  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const headerToken = request.headers.get("x-metrics-token");
  const suppliedToken = bearerToken || headerToken;

  return suppliedToken ? secureEquals(suppliedToken, expectedToken) : false;
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
