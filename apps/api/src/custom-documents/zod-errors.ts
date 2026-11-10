import { BadRequestException } from '@nestjs/common';

/**
 * Structural view of a Zod schema. The shared schemas come from
 * @trycompai/company, which can resolve a different zod copy than the API, so
 * this avoids tying the helper to one zod instance's nominal types.
 */
type SafeParser<T> = {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | {
        success: false;
        error: {
          issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
        };
      };
};

/** Parse with Zod and turn failures into a readable 400. */
export function parseOrThrow<T>(schema: SafeParser<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const messages = result.error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  throw new BadRequestException(
    `Please fix the following: ${messages.join('; ')}`,
  );
}
