// Collecteur des statistiques anonymes d'IdlePort (src/ui/telemetry.ts).
// Cloudflare Worker + base D1 : reçoit des lots d'événements en POST et les
// range dans la table `events`. GET /funnel renvoie l'entonnoir des missions
// (protégé par le jeton STATS_TOKEN). Déploiement : voir README.md.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (request.method === 'POST' && url.pathname === '/') {
      let events;
      try {
        events = await request.json();
      } catch {
        return new Response('JSON invalide', { status: 400, headers: cors });
      }
      if (!Array.isArray(events) || events.length > 500) return new Response('Lot invalide', { status: 400, headers: cors });
      const stmt = env.DB.prepare('INSERT INTO events (install_id, name, at, payload) VALUES (?, ?, ?, ?)');
      const rows = events
        .filter((e) => e && typeof e.e === 'string' && typeof e.id === 'string' && typeof e.t === 'number')
        .map((e) => stmt.bind(e.id.slice(0, 40), e.e.slice(0, 40), e.t, JSON.stringify(e.p ?? {}).slice(0, 1000)));
      if (rows.length) await env.DB.batch(rows);
      return new Response('ok', { headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/funnel') {
      if (url.searchParams.get('token') !== env.STATS_TOKEN) return new Response('Interdit', { status: 403 });
      const { results } = await env.DB.prepare(
        "SELECT json_extract(payload, '$.m') AS mission, COUNT(DISTINCT install_id) AS players FROM events WHERE name = 'mission' GROUP BY mission ORDER BY mission",
      ).all();
      const installs = await env.DB.prepare("SELECT COUNT(DISTINCT install_id) AS n FROM events WHERE name = 'first_launch'").first();
      return Response.json({ installs: installs?.n ?? 0, missions: results });
    }
    return new Response('IdlePort telemetry', { headers: cors });
  },
};
