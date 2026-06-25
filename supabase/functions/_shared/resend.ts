const RESEND_API_BASE_URL = 'https://api.resend.com/emails'

export const DEFAULT_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@whatif-ep.xyz'
export const DEFAULT_ADMIN_EMAIL = Deno.env.get('CONTACT_NOTIFICATION_EMAIL') || 'contact@whatif-ep.xyz'

type SendEmailParams = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string | null
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const response = await fetch(RESEND_API_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DEFAULT_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      reply_to: params.replyTo || undefined,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend request failed: ${response.status} ${body}`)
  }
}
