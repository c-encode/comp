import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const awsConfigSchema = z.object({
  region: z.string().default('us-east-1'),
  // Optional: when unset, S3 clients use the AWS SDK default credential chain
  // (e.g. the EC2 instance role). See app/s3-credentials.ts.
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  bucketName: z.string().min(1, 'AWS_BUCKET_NAME is required'),
  endpoint: z.string().optional(),
});

export type AwsConfig = z.infer<typeof awsConfigSchema>;

export const awsConfig = registerAs('aws', (): AwsConfig => {
  const config = {
    region: process.env.APP_AWS_REGION || 'us-east-1',
    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY || undefined,
    bucketName: process.env.APP_AWS_BUCKET_NAME || '',
    endpoint: process.env.APP_AWS_ENDPOINT || '',
  };

  // Validate configuration at startup
  const result = awsConfigSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `AWS configuration validation failed: ${result.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`,
    );
  }

  return result.data;
});
