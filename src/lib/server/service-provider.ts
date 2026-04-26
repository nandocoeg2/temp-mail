import { Pool } from "pg";
import { systemClock } from "./clock";
import { createInMemoryRepository } from "./in-memory-repository";
import { createMailboxService } from "./mailbox-service";
import { createPostgresRepository } from "./postgres-repository";
import type { MailboxRepository } from "./types";

type GlobalState = {
  pool?: Pool;
  repository?: MailboxRepository;
};

const globalState = globalThis as typeof globalThis & { __dropmail?: GlobalState };
globalState.__dropmail ??= {};

export function getMailboxService() {
  return createMailboxService({
    repository: getRepository(),
    clock: systemClock,
    appDomain: process.env.APP_DOMAIN || "dropmail.local"
  });
}

export function getRepository(): MailboxRepository {
  if (globalState.__dropmail?.repository) {
    return globalState.__dropmail.repository;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    globalState.__dropmail!.pool = new Pool({ connectionString: databaseUrl });
    globalState.__dropmail!.repository = createPostgresRepository(globalState.__dropmail!.pool);
  } else {
    globalState.__dropmail!.repository = createInMemoryRepository(systemClock);
  }

  return globalState.__dropmail!.repository;
}
