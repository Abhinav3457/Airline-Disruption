import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env before validating environment variables
dotenv.config();

/**
 * Schema for environment variables.
 * Fails fast at boot if configuration is missing or invalid.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // LLM provider (Groq). Required by the agent service once implemented.
  // Empty string is treated as unset so the server can boot without a key
  // during early development.
  GROQ_API_KEY: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : undefined))
    .optional(),

  // Groq chat model. Defaults to a current production model on Groq.
  GROQ_MODEL: z.string().trim().default('openai/gpt-oss-120b'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment configuration:',
    z.treeifyError(parsed.error)
  );
  process.exit(1);
}

export const env = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  groqApiKey: parsed.data.GROQ_API_KEY,
  groqModel: parsed.data.GROQ_MODEL,
} as const;

export type Env = typeof env;

if (!env.groqApiKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️  GROQ_API_KEY is not set. LLM features will fail until it is added to .env'
  );
}
