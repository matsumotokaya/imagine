import { DEFAULT_ADMIN_EMAIL, sendEmail } from './resend.ts'

type SignupNotificationParams = {
  email: string
  fullName?: string | null
  providerLabel: string
  appLabel: string
}

type PremiumNotificationParams = {
  email: string
  fullName?: string | null
  status: 'active' | 'canceling' | 'canceled' | null
  expiresAt?: string | null
}

function displayName(fullName: string | null | undefined, email: string): string {
  return fullName?.trim() || email
}

export async function sendSignupNotifications(params: SignupNotificationParams): Promise<void> {
  const memberName = displayName(params.fullName, params.email)
  const userSubject = 'Welcome to WHATIF'
  const userText =
    `Hello ${memberName},\n\n` +
    `Your WHATIF account has been created successfully.\n` +
    `Sign-in method: ${params.providerLabel}\n` +
    `Service: ${params.appLabel}\n` +
    `Email: ${params.email}\n\n` +
    `You can now use WHATIF services with this account.\n`
  const adminSubject = `[WHATIF] New user signup: ${params.email}`
  const adminText =
    `A new WHATIF account was created.\n\n` +
    `Name: ${memberName}\n` +
    `Email: ${params.email}\n` +
    `Provider: ${params.providerLabel}\n` +
    `Entry app: ${params.appLabel}\n`

  await Promise.all([
    sendEmail({
      to: params.email,
      subject: userSubject,
      text: userText,
      replyTo: DEFAULT_ADMIN_EMAIL,
    }),
    sendEmail({
      to: DEFAULT_ADMIN_EMAIL,
      subject: adminSubject,
      text: adminText,
      replyTo: params.email,
    }),
  ])
}

export async function sendPremiumActivatedNotifications(
  params: PremiumNotificationParams,
): Promise<void> {
  const memberName = displayName(params.fullName, params.email)
  const userSubject = 'Your WHATIF Premium membership is active'
  const userText =
    `Hello ${memberName},\n\n` +
    `Your WHATIF Premium membership is now active.\n` +
    `Status: ${params.status ?? 'active'}\n` +
    `Expires at: ${params.expiresAt ?? '-'}\n\n` +
    `Thank you for joining Premium.\n`
  const adminSubject = `[WHATIF] Premium activated: ${params.email}`
  const adminText =
    `A WHATIF account became premium.\n\n` +
    `Name: ${memberName}\n` +
    `Email: ${params.email}\n` +
    `Status: ${params.status ?? 'active'}\n` +
    `Expires at: ${params.expiresAt ?? '-'}\n`

  await Promise.all([
    sendEmail({
      to: params.email,
      subject: userSubject,
      text: userText,
      replyTo: DEFAULT_ADMIN_EMAIL,
    }),
    sendEmail({
      to: DEFAULT_ADMIN_EMAIL,
      subject: adminSubject,
      text: adminText,
      replyTo: params.email,
    }),
  ])
}
