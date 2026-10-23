import { s3CredentialsFromEnv } from './s3-credentials';

describe('s3CredentialsFromEnv', () => {
  it('returns static credentials when both keys are set', () => {
    expect(
      s3CredentialsFromEnv({
        APP_AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        APP_AWS_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toEqual({
      credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
    });
  });

  it('leaves credentials unset when no keys are configured', () => {
    expect(s3CredentialsFromEnv({})).toEqual({});
  });

  it('leaves credentials unset when only one key is configured', () => {
    expect(s3CredentialsFromEnv({ APP_AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE' })).toEqual({});
    expect(s3CredentialsFromEnv({ APP_AWS_SECRET_ACCESS_KEY: 'secret' })).toEqual({});
  });

  it('treats empty strings as unset', () => {
    expect(
      s3CredentialsFromEnv({ APP_AWS_ACCESS_KEY_ID: '', APP_AWS_SECRET_ACCESS_KEY: '' }),
    ).toEqual({});
  });
});
