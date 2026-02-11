import { z } from 'zod'

const appEnvironmentSchema = z.enum(['dev', 'prod'])

const environmentSchema = z.object({
  VITE_APP_ENV: appEnvironmentSchema.default('dev'),
  VITE_SUPABASE_URL: z
    .string()
    .url()
    .default('https://placeholder-project-ref.supabase.co'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  // Backward-compatible fallback for existing local setups.
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
})

const environmentResult = environmentSchema.safeParse(import.meta.env)

if (!environmentResult.success) {
  throw new Error(`Invalid environment configuration: ${environmentResult.error.message}`)
}

const supabasePublishableKey =
  environmentResult.data.VITE_SUPABASE_PUBLISHABLE_KEY ??
  environmentResult.data.VITE_SUPABASE_ANON_KEY ??
  'placeholder-publishable-key'

export const environment = {
  appEnv: environmentResult.data.VITE_APP_ENV,
  supabaseUrl: environmentResult.data.VITE_SUPABASE_URL,
  supabasePublishableKey,
}

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>
