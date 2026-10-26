# Build Android (Capacitor)

- Le jeu web (`npm run build` → `dist/`) est emballé par Capacitor (`capacitor.config.ts`, appId `com.chr2l.idleport`).
- Le dossier natif `android/` n'est pas versionné : le workflow `.github/workflows/android.yml` le génère (`npx cap add android`), puis lance `./gradlew assembleDebug`.
- Chaque push sur `main` publie l'APK de debug dans la release GitHub **`apk-test`** (lien fixe, remplacé à chaque build). Sur une PR, l'APK est disponible en artefact du workflow.
- En local : `npm run build && npx cap add android && npx cap sync android`, puis ouvrir `android/` dans Android Studio (JDK 21, SDK Android).
- Le jour où il faut du code natif (notifications locales, pubs), versionner `android/` : le workflow saute alors `cap add`.

L'interface de test (`src/ui/`) : vue cube art de la tour (`towerView.ts`, rendu `src/render`) au-dessus de panneaux DOM qui exposent toutes les actions du moteur (tour, vols, équipe, amis, objectifs et événement saisonnier). Le social tourne sur `MemorySocialBackend` tant qu'aucun serveur n'existe : ajouter un ami par code échoue pour l'instant.
