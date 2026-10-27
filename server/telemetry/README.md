# Collecteur de statistiques (Cloudflare, gratuit)

1. Compte Cloudflare, puis `npm i -g wrangler` et `wrangler login`.
2. `wrangler d1 create idleport-telemetry` : copier l'`database_id` affiché dans `wrangler.toml`.
3. `wrangler d1 execute idleport-telemetry --remote --file schema.sql`
4. `wrangler secret put STATS_TOKEN` (un mot de passe au choix, pour lire l'entonnoir).
5. `wrangler deploy` : noter l'adresse `https://idleport-telemetry.<compte>.workers.dev`.
6. Dans GitHub : Settings > Secrets and variables > Actions > **Variables** : `VITE_TELEMETRY_URL` = cette adresse. Les builds (APK de test et release) l'embarquent ; le jeu demande alors l'accord du joueur au niveau 2.
7. Entonnoir des missions : `https://…workers.dev/funnel?token=<STATS_TOKEN>`.
