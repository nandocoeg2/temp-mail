import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClamAvScanner } from "./clamav-scanner";
import { systemClock } from "./clock";
import { createInMemoryRepository } from "./in-memory-repository";
import { createMailboxService } from "./mailbox-service";
import { createS3AttachmentStorage } from "./object-storage";
import { createPrismaRepository } from "./prisma-repository";
import type { MailboxRepository } from "./types";

type GlobalState = {
  prisma?: PrismaClient;
  repository?: MailboxRepository;
};

const globalState = globalThis as typeof globalThis & { __dropmail?: GlobalState };
globalState.__dropmail ??= {};

export function getMailboxService() {
  return createMailboxService({
    repository: getRepository(),
    clock: systemClock,
    appDomain: process.env.APP_DOMAIN || "dropmail.local",
    attachmentScanner: createClamAvScanner(),
    attachmentStorage: hasObjectStorageEnv() ? createS3AttachmentStorage() : undefined
  });
}

export function getRepository(): MailboxRepository {
  if (globalState.__dropmail?.repository) {
    return globalState.__dropmail.repository;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    globalState.__dropmail!.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl })
    });
    globalState.__dropmail!.repository = createPrismaRepository(globalState.__dropmail!.prisma);
  } else {
    globalState.__dropmail!.repository = createInMemoryRepository(systemClock);
  }

  return globalState.__dropmail!.repository;
}

function hasObjectStorageEnv(): boolean {
  return Boolean(
    process.env.ATTACHMENT_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}
