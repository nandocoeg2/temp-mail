export type DomainErrorCode =
  | "MAILBOX_NOT_FOUND"
  | "MAILBOX_EXPIRED"
  | "MESSAGE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "VALIDATION_FAILED"
  | "WEBHOOK_UNAUTHORIZED"
  | "WEBHOOK_NOT_CONFIGURED"
  | "PAYLOAD_TOO_LARGE";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string, status: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

export function toHttpStatus(error: unknown): number {
  if (error instanceof DomainError) {
    return error.status;
  }
  return 500;
}

export function publicError(error: unknown): { code: string; message: string } {
  if (error instanceof DomainError) {
    return { code: error.code, message: error.message };
  }
  return { code: "INTERNAL_ERROR", message: "Unexpected server error" };
}
