import { Env, SESSION_SECONDS, json, makeSessionCookieValue, safeEqual, sessionCookie } from '../_lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let passcode = '';
  try {
    const body = (await request.json()) as { passcode?: unknown };
    passcode = typeof body.passcode === 'string' ? body.passcode : '';
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  if (!env.PASSCODE || !env.COOKIE_SECRET) {
    return json({ error: 'Server is not configured yet' }, 500);
  }

  if (!(await safeEqual(passcode, env.PASSCODE))) {
    // Slow down guessing a little.
    await new Promise(resolve => setTimeout(resolve, 800));
    return json({ error: 'Wrong passcode' }, 401);
  }

  const value = await makeSessionCookieValue(env);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, value, SESSION_SECONDS) });
};
