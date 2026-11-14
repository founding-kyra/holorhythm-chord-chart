import { Env, json, sessionCookie } from '../_lib/auth';

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) });
};
