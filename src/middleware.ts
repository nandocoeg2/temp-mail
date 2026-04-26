import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin") && !request.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse("Admin credentials required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="DropMail Admin"'
    }
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};

function isAuthorized(request: NextRequest): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const decoded = atob(authorization.slice("Basic ".length));
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }

  return decoded.slice(0, separator) === expectedUsername && decoded.slice(separator + 1) === expectedPassword;
}
