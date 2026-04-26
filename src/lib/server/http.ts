import { NextResponse } from "next/server";
import { publicError, toHttpStatus } from "./domain-error";

export function jsonOk<T>(payload: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(payload, init);
}

export function jsonError(error: unknown): NextResponse {
  return NextResponse.json({ error: publicError(error) }, { status: toHttpStatus(error) });
}

export function tokenFromRequest(request: Request): string {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return request.headers.get("x-mailbox-token") || bearer || url.searchParams.get("token") || "";
}

export function clientIdFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") || firstForwarded || "local-client";
}

export async function routeParam<T extends Record<string, string>>(
  params: T | Promise<T>
): Promise<T> {
  return params instanceof Promise ? params : Promise.resolve(params);
}
