export function isAdminRequest(request: Request): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return username === expectedUsername && password === expectedPassword;
}

export function adminUnauthorizedResponse(): Response {
  return new Response("Admin credentials required", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="DropMail Admin"'
    }
  });
}
