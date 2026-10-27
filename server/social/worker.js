// Serveur social d'IdlePort (plan de polish IP-17), l'API attendue par
// HttpSocialBackend (src/ui/socialServer.ts). Cloudflare Worker + base D1.
// Chaque joueur s'identifie par son code ami et une clé secrète tirée au
// hasard sur son téléphone (en-tête x-idleport-key) : le premier envoi du
// profil enregistre l'empreinte de la clé, les suivants doivent la donner.
//   PUT  /profile          publie son profil (clé)
//   GET  /profiles?codes=  profils publics, 50 codes au plus
//   POST /gifts            envoie un cadeau à un joueur (clé de l'expéditeur)
//   POST /gifts/take       reprend les cadeaux reçus (clé du destinataire)
//   GET  /top?week=&limit= classement mondial de la semaine
const CODE = /^IP-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const MAX_PROFILE = 4000;
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type, x-idleport-key',
};
const json = (data, status = 200) => Response.json(data, { status, headers: cors });
const fail = (message, status = 400) => json({ error: message }, status);

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True when the request carries the key registered for `code`. */
async function owns(env, request, code) {
  const key = request.headers.get('x-idleport-key') ?? '';
  if (key.length < 20) return false;
  const row = await env.DB.prepare('SELECT key_hash FROM players WHERE code = ?').bind(code).first();
  return !!row && row.key_hash === (await sha256(key));
}

async function body(request) {
  const text = await request.text();
  if (text.length > MAX_PROFILE) throw new Error('trop long');
  return JSON.parse(text);
}

function cleanProfile(p) {
  const int = (v) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return {
    code: p.code,
    name: str(p.name, 20) || 'Joueur',
    level: int(p.level),
    stars: int(p.stars),
    weeklyScore: int(p.weeklyScore),
    week: int(p.week),
    totalCoins: int(p.totalCoins),
    carnet: int(p.carnet),
    album: int(p.album),
    facadeColor: str(p.facadeColor, 16),
    lobbyColor: str(p.lobbyColor, 16),
    floors: (Array.isArray(p.floors) ? p.floors : []).slice(0, 10).map((f) => ({ defId: str(f?.defId, 40), level: int(f?.level) })),
    updatedAt: int(p.updatedAt),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    try {
      if (request.method === 'PUT' && url.pathname === '/profile') {
        const p = await body(request);
        if (!p || !CODE.test(p.code)) return fail('Code invalide');
        const key = request.headers.get('x-idleport-key') ?? '';
        if (key.length < 20) return fail('Clé manquante', 401);
        const hash = await sha256(key);
        const row = await env.DB.prepare('SELECT key_hash FROM players WHERE code = ?').bind(p.code).first();
        if (row && row.key_hash !== hash) return fail('Clé refusée', 403);
        const profile = cleanProfile(p);
        await env.DB.prepare(
          'INSERT INTO players (code, key_hash, profile, week, weekly_score, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
            'ON CONFLICT (code) DO UPDATE SET profile = ?3, week = ?4, weekly_score = ?5, updated_at = ?6',
        ).bind(p.code, hash, JSON.stringify(profile), profile.week, profile.weeklyScore, Date.now()).run();
        return json({ ok: true });
      }

      if (request.method === 'GET' && url.pathname === '/profiles') {
        const codes = (url.searchParams.get('codes') ?? '').split(',').filter((c) => CODE.test(c)).slice(0, 50);
        if (!codes.length) return json([]);
        const { results } = await env.DB.prepare(`SELECT profile FROM players WHERE code IN (${codes.map(() => '?').join(',')})`).bind(...codes).all();
        return json(results.map((r) => JSON.parse(r.profile)));
      }

      if (request.method === 'POST' && url.pathname === '/gifts') {
        const g = await body(request);
        if (!g || typeof g.id !== 'string' || !CODE.test(g.from) || !CODE.test(g.to) || g.from === g.to) return fail('Cadeau invalide');
        if (!(await owns(env, request, g.from))) return fail('Clé refusée', 403);
        const to = await env.DB.prepare('SELECT 1 FROM players WHERE code = ?').bind(g.to).first();
        if (!to) return fail('Joueur introuvable', 404);
        await env.DB.prepare('INSERT OR IGNORE INTO gifts (id, sender, sender_name, receiver, day) VALUES (?, ?, ?, ?, ?)')
          .bind(g.id.slice(0, 40), g.from, String(g.fromName ?? '').slice(0, 20), g.to, Math.floor(g.day) || 0).run();
        return json({ ok: true });
      }

      if (request.method === 'POST' && url.pathname === '/gifts/take') {
        const { code } = await body(request);
        if (!CODE.test(code)) return fail('Code invalide');
        if (!(await owns(env, request, code))) return fail('Clé refusée', 403);
        const { results } = await env.DB.prepare('DELETE FROM gifts WHERE receiver = ? RETURNING id, sender, sender_name, day').bind(code).all();
        return json(results.map((r) => ({ id: r.id, from: r.sender, fromName: r.sender_name, to: code, day: r.day })));
      }

      if (request.method === 'GET' && url.pathname === '/top') {
        const week = Math.floor(Number(url.searchParams.get('week'))) || 0;
        const limit = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get('limit'))) || 50));
        const { results } = await env.DB.prepare('SELECT profile FROM players WHERE week = ? ORDER BY weekly_score DESC LIMIT ?').bind(week, limit).all();
        return json(results.map((r) => JSON.parse(r.profile)));
      }
    } catch {
      return fail('Requête invalide');
    }
    return new Response('IdlePort social', { headers: cors });
  },
};
