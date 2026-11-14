export interface Env {
  DB: D1Database;
  /** Shared passcode Kyra and Kasey type to get in. Set with `wrangler pages secret put PASSCODE`. */
  PASSCODE: string;
  /** Random string used to sign session cookies. Set with `wrangler pages secret put COOKIE_SECRET`. */
  COOKIE_SECRET: string;
}

export const COOKIE_NAME = 'hr_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (hashes first so length doesn't leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([hmac('cmp', a), hmac('cmp', b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

export async function makeSessionCookieValue(env: Env): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const sig = await hmac(env.COOKIE_SECRET, String(expires));
  return `${expires}.${sig}`;
}

export async function hasValidSession(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Cookie') ?? '';
  const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const [expires, sig] = match.slice(COOKIE_NAME.length + 1).split('.');
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(env.COOKIE_SECRET, expires));
}

export function sessionCookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
