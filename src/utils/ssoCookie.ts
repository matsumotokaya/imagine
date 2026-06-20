// Cross-subdomain SSO cookie utility (IMAGINE side).
//
// A single shared cookie `wf-sso-token` holds the Supabase access/refresh
// tokens so that a session established on whatif-ep.xyz (Gallery) can be
// adopted by app.whatif-ep.xyz (IMAGINE) without re-login.
//
// IMPORTANT: this file MUST stay in sync with the Gallery counterpart
// (whatif-ep-xyz/src/lib/ssoCookie.ts): same cookie name, encoding and
// chunk-splitting rules.
//
// Trade-off: the cookie is NOT HttpOnly because the SPA needs to read it in
// JS. This is an accepted decision (see task spec).

const COOKIE_NAME = 'wf-sso-token';

// Browsers cap a single cookie around 4KB (name + value + attributes).
// We keep each chunk's value well under that. access+refresh tokens are
// usually < 4KB total, but we split defensively.
const MAX_CHUNK_VALUE_LENGTH = 3000;

export interface SsoTokens {
  access_token: string;
  refresh_token: string;
}

// Domain is environment-dependent. Production: ".whatif-ep.xyz".
// When unset, no Domain attribute is added (host-only cookie, dev/localhost).
const COOKIE_DOMAIN = import.meta.env.VITE_SSO_COOKIE_DOMAIN as string | undefined;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function buildAttributes(maxAge: number): string {
  const isHttps = isBrowser() && window.location.protocol === 'https:';
  const parts = [`Path=/`, `SameSite=Lax`, `Max-Age=${maxAge}`];
  if (COOKIE_DOMAIN) {
    parts.push(`Domain=${COOKIE_DOMAIN}`);
  }
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function readRawCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const prefix = `${name}=`;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(prefix)) {
      return cookie.slice(prefix.length);
    }
  }
  return null;
}

// Read the shared SSO tokens. Returns null on any failure (fallback-safe).
export function readSsoCookie(): SsoTokens | null {
  if (!isBrowser()) return null;
  try {
    // Single cookie first.
    let raw = readRawCookie(COOKIE_NAME);

    // Chunked fallback: wf-sso-token.0, wf-sso-token.1, ...
    if (raw === null) {
      const chunks: string[] = [];
      for (let i = 0; ; i += 1) {
        const part = readRawCookie(`${COOKIE_NAME}.${i}`);
        if (part === null) break;
        chunks.push(part);
      }
      if (chunks.length === 0) return null;
      raw = chunks.join('');
    }

    const json = decodeURIComponent(raw);
    const parsed = JSON.parse(json) as Partial<SsoTokens>;
    if (
      parsed &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string'
    ) {
      return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
    }
    return null;
  } catch {
    return null;
  }
}

// Write the shared SSO tokens. Swallows all errors (fallback-safe).
export function writeSsoCookie(tokens: SsoTokens): void {
  if (!isBrowser()) return;
  try {
    const value = encodeURIComponent(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })
    );
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    // Clear any previous representation before writing the new one.
    clearSsoCookie();

    if (value.length <= MAX_CHUNK_VALUE_LENGTH) {
      document.cookie = `${COOKIE_NAME}=${value}; ${buildAttributes(maxAge)}`;
      return;
    }

    // Split into chunks: wf-sso-token.0, wf-sso-token.1, ...
    const attrs = buildAttributes(maxAge);
    let index = 0;
    for (let start = 0; start < value.length; start += MAX_CHUNK_VALUE_LENGTH) {
      const part = value.slice(start, start + MAX_CHUNK_VALUE_LENGTH);
      document.cookie = `${COOKIE_NAME}.${index}=${part}; ${attrs}`;
      index += 1;
    }
  } catch {
    // ignore
  }
}

// Delete the shared SSO cookie (single + any chunks). Same Domain so the
// removal targets the same cookie the writer created.
export function clearSsoCookie(): void {
  if (!isBrowser()) return;
  try {
    const expire = buildAttributes(0);
    document.cookie = `${COOKIE_NAME}=; ${expire}`;
    // Best-effort clear of a reasonable number of chunk slots.
    for (let i = 0; i < 10; i += 1) {
      document.cookie = `${COOKIE_NAME}.${i}=; ${expire}`;
    }
  } catch {
    // ignore
  }
}
