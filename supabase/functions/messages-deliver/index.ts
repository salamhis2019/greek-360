import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

type EmailProvider = 'resend' | 'sendgrid'

interface EmailJobRecord {
  id: string
  organization_id: string
  template_id: string | null
  custom_subject: string | null
  custom_body_text: string | null
  status: 'queued' | 'processing' | 'sent' | 'partial' | 'failed'
}

interface EmailJobRecipientRecord {
  id: string
  user_id: string
  email: string | null
  status: 'queued' | 'sent' | 'failed'
}

interface EmailTemplateRecord {
  id: string
  subject: string
  body_text: string
}

interface UserNameRecord {
  id: string
  name: string | null
}

interface DeliveryFailureRecord {
  userId: string
  email: string
  reason: string
  attempts: number
}

interface ProviderSendResult {
  messageId: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const templateVariablePattern = /{{\s*([a-z_]+)\s*}}/g

const renderTemplate = (
  value: string,
  context: Record<'name' | 'organization_name', string>
) =>
  value.replace(templateVariablePattern, (_match, rawVariableName: string) => {
    const variableName = rawVariableName.trim() as keyof typeof context
    return context[variableName] ?? ''
  })

const toBodyHtml = (bodyText: string) =>
  `<p>${bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\n/g, '<br/>')}</p>`

const resolveProvider = (): EmailProvider => {
  const raw = (Deno.env.get('EMAIL_PROVIDER') ?? 'resend').trim().toLowerCase()
  return raw === 'sendgrid' ? 'sendgrid' : 'resend'
}

const sendViaResend = async ({
  apiKey,
  fromEmail,
  to,
  subject,
  bodyText,
  bodyHtml,
}: {
  apiKey: string
  fromEmail: string
  to: string
  subject: string
  bodyText: string
  bodyHtml: string
}): Promise<ProviderSendResult> => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text: bodyText,
      html: bodyHtml,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Resend error ${response.status}: ${errorBody}`)
  }

  const responseBody = (await response.json().catch(() => ({}))) as { id?: string }
  return { messageId: responseBody.id ?? null }
}

const sendViaSendGrid = async ({
  apiKey,
  fromEmail,
  to,
  subject,
  bodyText,
  bodyHtml,
}: {
  apiKey: string
  fromEmail: string
  to: string
  subject: string
  bodyText: string
  bodyHtml: string
}): Promise<ProviderSendResult> => {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail },
      subject,
      content: [
        { type: 'text/plain', value: bodyText },
        { type: 'text/html', value: bodyHtml },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`SendGrid error ${response.status}: ${errorBody}`)
  }

  return { messageId: response.headers.get('x-message-id') }
}

const sendWithProvider = async ({
  provider,
  fromEmail,
  to,
  subject,
  bodyText,
  bodyHtml,
}: {
  provider: EmailProvider
  fromEmail: string
  to: string
  subject: string
  bodyText: string
  bodyHtml: string
}): Promise<ProviderSendResult> => {
  if (provider === 'sendgrid') {
    const apiKey = Deno.env.get('SENDGRID_API_KEY') ?? ''
    if (!apiKey) {
      throw new Error('Missing SENDGRID_API_KEY.')
    }

    return sendViaSendGrid({
      apiKey,
      fromEmail,
      to,
      subject,
      bodyText,
      bodyHtml,
    })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY.')
  }

  return sendViaResend({
    apiKey,
    fromEmail,
    to,
    subject,
    bodyText,
    bodyHtml,
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const fromEmail = Deno.env.get('EMAIL_FROM') ?? 'noreply@greek360.local'

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase service-role configuration.')
    }

    const payload = (await request.json().catch(() => ({}))) as {
      jobId?: string
      maxRetries?: number
    }

    const jobId = payload.jobId?.trim() ?? ''
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const maxRetries = Math.max(0, Math.min(5, Math.floor(payload.maxRetries ?? 2)))
    const maxAttempts = maxRetries + 1
    const provider = resolveProvider()

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const claimResponse = await supabase.rpc('claim_email_job_for_delivery', {
      claim_job_id: jobId,
    })
    if (claimResponse.error) {
      throw new Error(claimResponse.error.message)
    }

    const claimedJob = (Array.isArray(claimResponse.data)
      ? claimResponse.data[0]
      : claimResponse.data) as EmailJobRecord | null
    if (!claimedJob) {
      throw new Error('Email job claim returned no record.')
    }

    if (claimedJob.status !== 'queued' && claimedJob.status !== 'processing') {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, status: claimedJob.status }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const [organizationResponse, recipientsResponse] = await Promise.all([
      supabase
        .from('organizations')
        .select('name')
        .eq('id', claimedJob.organization_id)
        .single<{ name: string }>(),
      supabase
        .from('email_job_recipients')
        .select('id, user_id, email, status')
        .eq('job_id', claimedJob.id)
        .in('status', ['queued', 'failed']),
    ])

    if (organizationResponse.error) {
      throw new Error(organizationResponse.error.message)
    }
    if (recipientsResponse.error) {
      throw new Error(recipientsResponse.error.message)
    }

    const organizationName = organizationResponse.data?.name ?? 'Your chapter'
    const recipients = (recipientsResponse.data ?? []) as EmailJobRecipientRecord[]
    const recipientUserIds = recipients.map((recipient) => recipient.user_id)

    const usersResponse = await supabase
      .from('users')
      .select('id, name')
      .in('id', recipientUserIds)
    if (usersResponse.error) {
      throw new Error(usersResponse.error.message)
    }

    const userById = new Map(
      ((usersResponse.data ?? []) as UserNameRecord[]).map((user) => [user.id, user])
    )

    let subjectTemplate = claimedJob.custom_subject ?? ''
    let bodyTemplate = claimedJob.custom_body_text ?? ''
    if (claimedJob.template_id) {
      const templateResponse = await supabase
        .from('email_templates')
        .select('id, subject, body_text')
        .eq('id', claimedJob.template_id)
        .single<EmailTemplateRecord>()

      if (templateResponse.error) {
        throw new Error(templateResponse.error.message)
      }

      subjectTemplate = templateResponse.data?.subject ?? ''
      bodyTemplate = templateResponse.data?.body_text ?? ''
    }

    if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
      throw new Error('Email template subject/body could not be resolved.')
    }

    const failureDetails: DeliveryFailureRecord[] = []
    let sentCount = 0
    let retriesUsed = 0

    for (const recipient of recipients) {
      const user = userById.get(recipient.user_id)
      const recipientName = user?.name?.trim() ? user.name : recipient.user_id
      const recipientEmail = recipient.email?.trim() ?? ''

      if (!recipientEmail) {
        const missingEmailReason = 'Recipient has no email address on file.'
        await supabase
          .from('email_job_recipients')
          .update({
            status: 'failed',
            attempt_count: 0,
            last_error: missingEmailReason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)

        failureDetails.push({
          userId: recipient.user_id,
          email: '',
          reason: missingEmailReason,
          attempts: 0,
        })
        continue
      }

      const renderedSubject = renderTemplate(subjectTemplate, {
        name: recipientName,
        organization_name: organizationName,
      })
      const renderedBodyText = renderTemplate(bodyTemplate, {
        name: recipientName,
        organization_name: organizationName,
      })
      const renderedBodyHtml = toBodyHtml(renderedBodyText)

      let attempts = 0
      let sent = false
      let lastError = 'Provider delivery failed.'
      let providerMessageId: string | null = null

      while (!sent && attempts < maxAttempts) {
        attempts += 1
        try {
          const deliveryResult = await sendWithProvider({
            provider,
            fromEmail,
            to: recipientEmail,
            subject: renderedSubject,
            bodyText: renderedBodyText,
            bodyHtml: renderedBodyHtml,
          })
          providerMessageId = deliveryResult.messageId
          sent = true
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Provider delivery failed.'
        }
      }

      retriesUsed += Math.max(0, attempts - 1)

      if (sent) {
        sentCount += 1
        await supabase
          .from('email_job_recipients')
          .update({
            status: 'sent',
            attempt_count: attempts,
            last_error: null,
            provider_message_id: providerMessageId,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)
        continue
      }

      await supabase
        .from('email_job_recipients')
        .update({
          status: 'failed',
          attempt_count: attempts,
          last_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipient.id)

      failureDetails.push({
        userId: recipient.user_id,
        email: recipientEmail,
        reason: lastError,
        attempts,
      })
    }

    const failedCount = failureDetails.length

    const applyResponse = await supabase.rpc('apply_email_job_delivery_result', {
      target_job_id: claimedJob.id,
      result_sent_count: sentCount,
      result_failed_count: failedCount,
      result_retries_used: retriesUsed,
      result_failure_details: failureDetails,
      result_provider: provider,
    })
    if (applyResponse.error) {
      throw new Error(applyResponse.error.message)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        jobId: claimedJob.id,
        sentCount,
        failedCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
