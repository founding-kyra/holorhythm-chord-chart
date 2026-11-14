import { Env, hasValidSession, json } from '../_lib/auth';

const MAX_BYTES = 1_500_000; // D1 rows are capped at 2 MB

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await hasValidSession(request, env))) return json({ error: 'Not signed in' }, 401);

  const row = await env.DB.prepare('SELECT data, version FROM library WHERE id = 1').first<{
    data: string;
    version: number;
  }>();

  if (!row) return json({ library: null, version: 0 });
  return json({ library: JSON.parse(row.data), version: row.version });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await hasValidSession(request, env))) return json({ error: 'Not signed in' }, 401);

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'Library is too large to save' }, 413);

  let body: { library?: unknown; baseVersion?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (typeof body.baseVersion !== 'number' || typeof body.library !== 'object' || body.library === null) {
    return json({ error: 'Bad request' }, 400);
  }

  const data = JSON.stringify(body.library);

  // Only save if nobody else saved since this client last loaded (optimistic lock).
  const result =
    body.baseVersion === 0
      ? await env.DB.prepare('INSERT INTO library (id, data, version) VALUES (1, ?, 1) ON CONFLICT(id) DO NOTHING')
          .bind(data)
          .run()
      : await env.DB.prepare('UPDATE library SET data = ?, version = version + 1 WHERE id = 1 AND version = ?')
          .bind(data, body.baseVersion)
          .run();

  if (result.meta.changes === 0) {
    return json({ error: 'The library was changed somewhere else. Reload to get the latest.' }, 409);
  }
  return json({ version: body.baseVersion + 1 });
};
