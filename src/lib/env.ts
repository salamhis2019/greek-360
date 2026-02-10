import { z } from 'zod'

const appEnvironmentSchema = z.enum(['dev', 'prod'])

const environmentSchema = z.object({
  VITE_APP_ENV: appEnvironmentSchema.default('dev'),
  VITE_SUPABASE_URL: z
    .string()
    .url()
    .default('https://placeholder-project-ref.supabase.co'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).default('placeholder-anon-key'),
})

const environmentResult = environmentSchema.safeParse(import.meta.env)

if (!environmentResult.success) {
  throw new Error(`Invalid environment configuration: ${environmentResult.error.message}`)
}

export const environment = {
  appEnv: environmentResult.data.VITE_APP_ENV,
  supabaseUrl: environmentResult.data.VITE_SUPABASE_URL,
  supabaseAnonKey: environmentResult.data.VITE_SUPABASE_ANON_KEY,
}

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>
