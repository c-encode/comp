import type { S3ClientConfig } from '@aws-sdk/client-s3';

/**
 * Static S3 credentials from APP_AWS_ACCESS_KEY_ID / APP_AWS_SECRET_ACCESS_KEY
 * when both are set. Otherwise `credentials` is left unset so the AWS SDK
 * default chain resolves them — the EC2 instance role or ECS task role on a
 * self-hosted deployment, or AWS_* env / shared config locally.
 *
 * Trigger.dev tasks run off-box and have no instance role, so they still need
 * both variables set in the Trigger.dev environment.
 */
export function s3CredentialsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Pick<S3ClientConfig, 'credentials'> {
  const accessKeyId = env.APP_AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.APP_AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return {};
  return { credentials: { accessKeyId, secretAccessKey } };
}
