export const DEFAULT_MAX_EMAIL_BYTES = 8 * 1024 * 1024;
const MAX_FIELD_CHARS = 120_000;
const MAX_ATTACHMENT_COUNT = 10;

export default {
  async fetch() {
    return new Response("DropMail Email Worker", { status: 200 });
  },

  async email(message, env) {
    const inboundUrl = requiredEnv(env, "APP_INBOUND_URL");
    const webhookSecret = requiredEnv(env, "INBOUND_WEBHOOK_SECRET");
    const maxBytes = Number(env.MAX_EMAIL_BYTES || DEFAULT_MAX_EMAIL_BYTES);

    if (message.rawSize > maxBytes) {
      message.setReject("Message exceeds DropMail inbound size limit");
      return;
    }

    const raw = await streamToText(message.raw);
    const parsed = parseMime(raw, message.headers.get("content-type") || "");
    const payload = stableJson({
      from: normalizeAddress(message.from || parsed.from || message.headers.get("from") || ""),
      to: normalizeAddress(message.to || parsed.to || message.headers.get("to") || ""),
      subject: decodeHeader(message.headers.get("subject") || parsed.subject || ""),
      text: limitField(parsed.text),
      html: limitField(parsed.html),
      attachments: parsed.attachments
    });

    const signature = await hmacSha256Hex(webhookSecret, payload);
    const response = await fetch(inboundUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dropmail-signature": signature,
        "x-dropmail-provider": "cloudflare-email-routing"
      },
      body: payload
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      message.setReject(`DropMail inbound rejected message: ${response.status} ${body.slice(0, 120)}`);
    }
  }
};

function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function streamToText(stream) {
  return new Response(stream).text();
}

function stableJson(value) {
  return JSON.stringify(value);
}

async function hmacSha256Hex(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseMime(raw, contentType) {
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerBlock = headerEnd >= 0 ? raw.slice(0, headerEnd) : "";
  const body = headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw;
  const parsedHeaders = parseHeaderBlock(headerBlock);
  const subject = parsedHeaders.get("subject") || "";
  const from = parsedHeaders.get("from") || "";
  const to = parsedHeaders.get("to") || "";
  const parsed = parseMimePart(body, contentType || parsedHeaders.get("content-type") || "");

  return {
    from,
    to,
    subject,
    text: parsed.text || "",
    html: parsed.html || "",
    attachments: parsed.attachments || []
  };
}

function parseMimePart(body, contentType) {
  const boundary = getBoundary(contentType);
  if (boundary) {
    return parseMultipart(body, boundary);
  }

  const charset = getCharset(contentType);
  const transferEncoding = "";
  const decoded = decodeTransfer(body, transferEncoding, charset);
  if (/text\/html/i.test(contentType)) {
    return { text: "", html: decoded, attachments: [] };
  }
  if (/text\/plain/i.test(contentType) || !contentType) {
    return { text: decoded, html: "", attachments: [] };
  }
  return { text: "", html: "", attachments: [] };
}

function parseMultipart(body, boundary) {
  const delimiter = `--${boundary}`;
  const result = { text: "", html: "", attachments: [] };

  for (const rawPart of body.split(delimiter)) {
    const part = rawPart.trim();
    if (!part || part === "--") {
      continue;
    }

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      continue;
    }

    const headers = parseHeaderBlock(part.slice(0, headerEnd));
    const contentType = headers.get("content-type") || "text/plain";
    const disposition = headers.get("content-disposition") || "";
    const transferEncoding = headers.get("content-transfer-encoding") || "";
    const filename = getFilename(disposition) || getFilename(contentType);

    const content = part.slice(headerEnd + 4).replace(/\r\n--$/, "");
    const boundary = getBoundary(contentType);
    if (boundary) {
      const nested = parseMultipart(content, boundary);
      result.text ||= nested.text;
      result.html ||= nested.html;
      result.attachments.push(...nested.attachments);
      continue;
    }

    if (/attachment/i.test(disposition) || filename) {
      const bytes = decodeTransferToBytes(content, transferEncoding, getCharset(contentType));
      if (filename && bytes.length > 0 && result.attachments.length < MAX_ATTACHMENT_COUNT) {
        result.attachments.push({
          filename: decodeHeader(filename).slice(0, 180),
          contentType: normalizeContentType(contentType),
          contentBase64: bytesToBase64(bytes)
        });
      }
      continue;
    }

    const decoded = decodeTransfer(
      content,
      transferEncoding,
      getCharset(contentType)
    );
    if (!result.html && /text\/html/i.test(contentType)) {
      result.html = decoded;
    }
    if (!result.text && /text\/plain/i.test(contentType)) {
      result.text = decoded;
    }
  }

  return result;
}

function parseHeaderBlock(block) {
  const headers = new Map();
  let current = "";
  for (const line of block.split(/\r?\n/)) {
    if (/^\s/.test(line)) {
      current += ` ${line.trim()}`;
      continue;
    }
    addHeader(headers, current);
    current = line;
  }
  addHeader(headers, current);
  return headers;
}

function addHeader(headers, line) {
  const index = line.indexOf(":");
  if (index <= 0) {
    return;
  }
  headers.set(line.slice(0, index).toLowerCase(), line.slice(index + 1).trim());
}

function getBoundary(contentType) {
  return /boundary="?([^";]+)"?/i.exec(contentType)?.[1] || "";
}

function getCharset(contentType) {
  return /charset="?([^";]+)"?/i.exec(contentType)?.[1] || "utf-8";
}

function getFilename(value) {
  return /(?:filename|name)\*?=(?:"([^"]+)"|([^;\s]+))/i.exec(value)?.[1] ||
    /(?:filename|name)\*?=(?:"([^"]+)"|([^;\s]+))/i.exec(value)?.[2] ||
    "";
}

function normalizeContentType(contentType) {
  return (contentType.split(";")[0] || "application/octet-stream").trim().toLowerCase();
}

function decodeTransfer(value, encoding, charset) {
  if (/base64/i.test(encoding)) {
    return decodeBytes(Uint8Array.from(atob(value.replace(/\s/g, "")), (char) => char.charCodeAt(0)), charset);
  }
  if (/quoted-printable/i.test(encoding)) {
    return decodeQuotedPrintable(value);
  }
  return value.trim();
}

function decodeTransferToBytes(value, encoding) {
  if (/base64/i.test(encoding)) {
    return Uint8Array.from(atob(value.replace(/\s/g, "")), (char) => char.charCodeAt(0));
  }
  if (/quoted-printable/i.test(encoding)) {
    return decodeQuotedPrintableBytes(value);
  }
  return new TextEncoder().encode(value.trim());
}

function decodeBytes(bytes, charset) {
  try {
    return new TextDecoder(charset).decode(bytes).trim();
  } catch {
    return new TextDecoder().decode(bytes).trim();
  }
}

function decodeQuotedPrintable(value) {
  return decodeBytes(decodeQuotedPrintableBytes(value), "utf-8");
}

function decodeQuotedPrintableBytes(value) {
  const normalized = value.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === "=" && /^[0-9a-f]{2}$/i.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(normalized.charCodeAt(index));
    }
  }
  return new Uint8Array(bytes);
}

function decodeHeader(value) {
  return value.replace(/=\?([^?]+)\?B\?([^?]+)\?=/gi, (_, charset, encoded) =>
    decodeBytes(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)), charset)
  );
}

function normalizeAddress(value) {
  return (/<([^>]+)>/.exec(value)?.[1] || value).trim();
}

function limitField(value) {
  return String(value || "").slice(0, MAX_FIELD_CHARS);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
