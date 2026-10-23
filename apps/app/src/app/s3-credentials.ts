import type { S3ClientConfig } from '@aws-sdk/client-s3';

/**
 * Static S3 credentials from APP_AWS_ACCESS_KEY_ID / APP_AWS_SECRET_ACCESS_KEY
 * when both are set. Otherwise `credentials` is left unset so the AWS SDK
 * default chain resolves them (e.g. the EC2 instance role on a self-hosted
 * deployment).
 */
export function s3CredentialsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Pick<S3ClientConfig, 'credentials'> {
  const accessKeyId = env.APP_AWS_ACCESS_KEY_ID;
  const secretAccessKey = env.APP_AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return {};
  return { credentials: { accessKeyId, secretAccessKey } };
}
