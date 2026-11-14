import { Env, hasValidSession, json } from '../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  return (await hasValidSession(request, env)) ? json({ ok: true }) : json({ error: 'Not signed in' }, 401);
};
