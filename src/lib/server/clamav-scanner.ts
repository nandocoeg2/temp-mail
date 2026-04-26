import { connect } from "node:net";
import type { AttachmentScanner } from "./attachments";
import { DomainError } from "./domain-error";

const DEFAULT_CLAMAV_HOST = "clamav";
const DEFAULT_CLAMAV_PORT = 3310;
const DEFAULT_SCAN_TIMEOUT_MS = 3000;
const CLAMAV_CHUNK_BYTES = 64 * 1024;

export function createClamAvScanner(): AttachmentScanner {
  const host = process.env.CLAMAV_HOST || DEFAULT_CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT || DEFAULT_CLAMAV_PORT);
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS || DEFAULT_SCAN_TIMEOUT_MS);

  return {
    async scan(attachment) {
      const payload = buildClamAvInstreamPayload(attachment.bytes);

      return new Promise((resolve, reject) => {
        let settled = false;
        let response = "";
        const socket = connect({ host, port });
        const timeout = setTimeout(() => {
          settle(() => resolve({ status: "unavailable" as const }));
          socket.destroy();
        }, timeoutMs);

        function settle(callback: () => void) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          callback();
        }

        socket.on("connect", () => {
          socket.end(payload);
        });
        socket.on("data", (chunk) => {
          response += chunk.toString("utf8");
        });
        socket.on("error", () => {
          settle(() => resolve({ status: "unavailable" as const }));
        });
        socket.on("end", () => {
          settle(() => {
            try {
              resolve(parseClamAvResponse(response));
            } catch (error) {
              reject(error);
            }
          });
        });
      });
    }
  };
}

export function buildClamAvInstreamPayload(bytes: Buffer): Buffer {
  const frames: Uint8Array[] = [Buffer.from("zINSTREAM\0")];
  for (let offset = 0; offset < bytes.length; offset += CLAMAV_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + CLAMAV_CHUNK_BYTES);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(chunk.length, 0);
    frames.push(length, chunk);
  }
  frames.push(Buffer.alloc(4));
  return Buffer.concat(frames);
}

export function parseClamAvResponse(response: string) {
  const cleanResponse = response.replace(/\0/g, "").trim();
  if (cleanResponse.endsWith(": OK")) {
    return { status: "clean" as const };
  }

  const match = cleanResponse.match(/^.*?:\s*(.+)\s+FOUND$/);
  if (match) {
    return { status: "infected" as const, signature: match[1] };
  }

  throw new DomainError("ATTACHMENT_REJECTED", "Attachment scanner returned an invalid response", 502);
}
