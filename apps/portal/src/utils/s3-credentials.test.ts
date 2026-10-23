import { describe, expect, it } from 'vitest';
import { s3CredentialsFromEnv } from './s3-credentials';

describe('s3CredentialsFromEnv', () => {
  it('returns static credentials when both keys are set', () => {
    expect(
      s3CredentialsFromEnv({
        APP_AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        APP_AWS_SECRET_ACCESS_KEY: 'secret',
      } as NodeJS.ProcessEnv),
    ).toEqual({ credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' } });
  });

  it('leaves credentials unset when keys are missing or empty', () => {
    expect(s3CredentialsFromEnv({} as NodeJS.ProcessEnv)).toEqual({});
    expect(
      s3CredentialsFromEnv({
        APP_AWS_ACCESS_KEY_ID: '',
        APP_AWS_SECRET_ACCESS_KEY: '',
      } as NodeJS.ProcessEnv),
    ).toEqual({});
  });
});
