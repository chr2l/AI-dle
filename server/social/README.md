# Serveur social (Cloudflare, gratuit)

Codes ami, cadeaux quotidiens et classement de la semaine. Sans ce serveur, le
jeu garde les amis en local et aucun code ne peut être trouvé.

1. Compte Cloudflare, puis `npm i -g wrangler` et `wrangler login` (le même que pour `server/telemetry`).
2. `wrangler d1 create idleport-social` : copier l'`database_id` affiché dans `wrangler.toml`.
3. `wrangler d1 execute idleport-social --remote --file schema.sql`
4. `wrangler deploy` : noter l'adresse `https://idleport-social.<compte>.workers.dev`.
5. Dans GitHub : Settings > Secrets and variables > Actions > **Variables** : `VITE_SOCIAL_URL` = cette adresse. Les builds (APK de test et release) l'embarquent.

Sécurité : chaque téléphone tire une clé secrète au hasard (gardée dans la
sauvegarde, donc aussi dans le code d'export). Le serveur n'en garde que
l'empreinte SHA-256 : personne d'autre ne peut publier sous votre code, ni
prendre vos cadeaux. Un cadeau par ami et par jour, profils limités à 4 ko.
