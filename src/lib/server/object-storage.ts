import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AttachmentStorage } from "./attachments";

export function createS3AttachmentStorage(): AttachmentStorage {
  const bucket = requiredEnv("ATTACHMENT_BUCKET");
  const client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY")
    }
  });

  return {
    async put(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.bytes,
          ContentType: input.contentType,
          Metadata: {
            filename: input.filename
          }
        })
      );
      return { key: input.key, size: input.bytes.length };
    },
    async createDownloadUrl(key) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        }),
        { expiresIn: 60 }
      );
    },
    async deleteMany(keys) {
      let deleted = 0;
      for (let index = 0; index < keys.length; index += 1000) {
        const chunk = keys.slice(index, index + 1000);
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: chunk.map((key) => ({ Key: key })),
              Quiet: true
            }
          })
        );
        deleted += chunk.length;
      }
      return deleted;
    }
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
