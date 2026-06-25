import { DEFAULT_ADMIN_EMAIL, sendEmail } from './resend.ts'

const GALLERY_URL = 'https://whatif-ep.xyz'
const IMAGINE_URL = 'https://app.whatif-ep.xyz'
const IMAGINE_UPGRADE_URL = 'https://app.whatif-ep.xyz/upgrade'

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderButton(label: string, href: string, accent = false): string {
  const background = accent ? '#f5d38a' : '#232323'
  const color = accent ? '#121212' : '#f5f5f5'
  const border = accent ? '#f5d38a' : '#3a3a3a'

  return (
    `<a href="${escapeHtml(href)}" ` +
    `style="display:inline-block;padding:12px 18px;border-radius:999px;` +
    `background:${background};color:${color};text-decoration:none;` +
    `font-size:14px;font-weight:700;border:1px solid ${border};margin-right:10px;` +
    `margin-bottom:10px;">${escapeHtml(label)}</a>`
  )
}

function renderSignupUserText(params: SignupNotificationParams, memberName: string): string {
  return (
    `Hello ${memberName},\n\n` +
    `Welcome to WHATIF. Your email has been verified and your account is now ready to use.\n\n` +
    `With your account, you can:\n` +
    `- Sign in to IMAGINE and edit templates freely\n` +
    `- Save your own design files\n` +
    `- Upload your own assets and continue your work later\n\n` +
    `About wallpaper access:\n` +
    `- Free accounts can use the free parts of IMAGINE and browse WHATIF services\n` +
    `- Unlimited wallpaper downloads require IMAGINE Premium\n\n` +
    `Premium membership currently includes:\n` +
    `- Access to premium templates\n` +
    `- Unlimited premium wallpaper pack downloads\n` +
    `- Unlimited design files\n` +
    `- Access to the design asset library, including saved WHATIF character illustrations\n\n` +
    `Open IMAGINE: ${IMAGINE_URL}\n` +
    `Browse WHATIF Gallery: ${GALLERY_URL}\n` +
    `Upgrade to Premium: ${IMAGINE_UPGRADE_URL}\n\n` +
    `Sign-in method: ${params.providerLabel}\n` +
    `Service: ${params.appLabel}\n` +
    `Email: ${params.email}\n\n` +
    `If you have any questions, reply to this email or contact ${DEFAULT_ADMIN_EMAIL}.\n`
  )
}

function renderSignupUserHtml(params: SignupNotificationParams, memberName: string): string {
  const safeName = escapeHtml(memberName)
  const safeProvider = escapeHtml(params.providerLabel)
  const safeAppLabel = escapeHtml(params.appLabel)
  const safeEmail = escapeHtml(params.email)
  const safeAdminEmail = escapeHtml(DEFAULT_ADMIN_EMAIL)

  return (
    '<!doctype html>' +
    '<html><body style="margin:0;padding:0;background:#0f0f10;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your WHATIF account is ready. Start with IMAGINE, then upgrade when you want unlimited wallpaper access.</div>' +
    '<div style="max-width:680px;margin:0 auto;padding:32px 20px 48px;">' +
    '<div style="padding:28px 28px 12px;border:1px solid #262626;border-radius:28px;background:linear-gradient(180deg,#1a1a1c 0%,#131315 100%);">' +
    '<p style="margin:0 0 14px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#f5d38a;">Welcome to WHATIF</p>' +
    `<h1 style="margin:0 0 16px;font-size:32px;line-height:1.2;color:#ffffff;">Your account is ready, ${safeName}</h1>` +
    '<p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#d7d7d7;">' +
    'Your email has been verified and your WHATIF account is now active. ' +
    'You can start designing in IMAGINE right away and return to your saved work anytime.' +
    '</p>' +
    '<div style="margin:24px 0 12px;">' +
    renderButton('Open IMAGINE', IMAGINE_URL, true) +
    renderButton('Browse Gallery', GALLERY_URL) +
    '</div>' +
    '</div>' +
    '<div style="padding:24px 8px 0;">' +
    '<div style="padding:24px 24px 10px;border:1px solid #262626;border-radius:24px;background:#151516;margin-top:18px;">' +
    '<h2 style="margin:0 0 12px;font-size:20px;color:#ffffff;">What you can do now</h2>' +
    '<ul style="margin:0;padding-left:20px;color:#d7d7d7;font-size:15px;line-height:1.8;">' +
    '<li>Edit templates freely in IMAGINE</li>' +
    '<li>Save your own design files to your account</li>' +
    '<li>Upload your own images and continue your projects later</li>' +
    '</ul>' +
    '</div>' +
    '<div style="padding:24px 24px 10px;border:1px solid #262626;border-radius:24px;background:#151516;margin-top:18px;">' +
    '<h2 style="margin:0 0 12px;font-size:20px;color:#ffffff;">About wallpaper access</h2>' +
    '<p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#d7d7d7;">' +
    'A free account lets you use the free parts of IMAGINE, save designs, and move between WHATIF services with one login.' +
    '</p>' +
    '<p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#d7d7d7;">' +
    'Unlimited downloads of premium wallpaper packs and The Club content require an IMAGINE Premium membership.' +
    '</p>' +
    '</div>' +
    '<div style="padding:24px 24px 14px;border:1px solid #40331f;border-radius:24px;background:#1d1811;margin-top:18px;">' +
    '<h2 style="margin:0 0 12px;font-size:20px;color:#fff4d3;">Premium membership includes</h2>' +
    '<ul style="margin:0;padding-left:20px;color:#f0dfba;font-size:15px;line-height:1.9;">' +
    '<li>Access to premium templates</li>' +
    '<li>Unlimited premium wallpaper pack downloads</li>' +
    '<li>Unlimited design files</li>' +
    '<li>Access to the design asset library, including saved WHATIF character illustrations</li>' +
    '</ul>' +
    '<div style="margin-top:18px;">' +
    renderButton('See Premium benefits', IMAGINE_UPGRADE_URL, true) +
    '</div>' +
    '</div>' +
    '<div style="padding:24px 24px 14px;border:1px solid #262626;border-radius:24px;background:#151516;margin-top:18px;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;color:#ffffff;">Account details</h2>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;color:#d7d7d7;font-size:14px;line-height:1.8;">' +
    `<tr><td style="padding:4px 0;width:150px;color:#9f9f9f;">Sign-in method</td><td style="padding:4px 0;">${safeProvider}</td></tr>` +
    `<tr><td style="padding:4px 0;width:150px;color:#9f9f9f;">Service</td><td style="padding:4px 0;">${safeAppLabel}</td></tr>` +
    `<tr><td style="padding:4px 0;width:150px;color:#9f9f9f;">Email</td><td style="padding:4px 0;">${safeEmail}</td></tr>` +
    '</table>' +
    '</div>' +
    `<p style="margin:20px 4px 0;font-size:13px;line-height:1.7;color:#8e8e93;">Questions? Reply to this email or contact <a href="mailto:${safeAdminEmail}" style="color:#f5d38a;text-decoration:none;">${safeAdminEmail}</a>.</p>` +
    '</div>' +
    '</div>' +
    '</body></html>'
  )
}

export async function sendSignupNotifications(params: SignupNotificationParams): Promise<void> {
  const memberName = displayName(params.fullName, params.email)
  const userSubject = 'Welcome to WHATIF'
  const userText = renderSignupUserText(params, memberName)
  const userHtml = renderSignupUserHtml(params, memberName)
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
      html: userHtml,
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
