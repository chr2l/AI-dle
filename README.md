# IdlePort

Testing AI capacity to make an idle-game, from a simple idea i had when i was a child.

Jeu mobile idle vertical de gestion d'aéroport : la tour monte étage par étage, chaque étage ouvre un magasin tiré au sort, et les avions partent vers une carte imaginaire (Tropicalia, Infernia, Désolande…). Rendu three.js en voxel « cube art », interface HTML, application Android via Capacitor.

## Lancer le jeu

```bash
npm ci
npm run dev        # jeu dans le navigateur (ajouter ?demo=1 pour un aéroport avancé)
npm test           # tests Vitest
npm run simulate   # 30 jours de partie simulée pour l'équilibrage
npm run screens    # captures de chaque onglet (après npm run build et vite preview)
```

L'APK de test est publié à chaque push sur `main` dans la release [`apk-test`](../../releases/tag/apk-test).

## Où trouver quoi

| Dossier ou fichier | Contenu |
|---|---|
| `docs/GDD.md` | Game design : règles, chiffres, rythme mesuré |
| `docs/RENDU.md` | Rendu voxel et décor |
| `docs/PLAY-STORE.md`, `docs/MONETISATION.md` | Sortie sur le Play Store, pubs et achats |
| `src/core` | Moteur de jeu pur et testé, données dans `src/core/data` |
| `src/render` | Scène three.js |
| `src/ui` | Interface mobile |
| `server/` | Serveurs Cloudflare (statistiques, social) |
