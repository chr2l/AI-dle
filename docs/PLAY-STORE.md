# Sortie sur le Play Store

Ce qui est prêt dans le dépôt, et ce qu'il reste à faire avec ton compte.

## Déjà prêt

- **AAB signé** : workflow `Release Play Store` (Actions > Release Play Store > Run workflow). Il lance les tests, construit le jeu, génère le projet Android, règle `versionCode` (numéro du run) et `versionName` (`package.json`), puis signe l'AAB. Le fichier `IdlePort.aab` est dans les artefacts du run.
- **Captures** : `npm run build`, `npx vite preview --port 4173 &`, puis `node scripts/screens.mjs` produit les captures de chaque onglet à partir de l'aéroport de démo (`?demo=1`). Elles sont aussi jointes à chaque PR (workflow `Tests et captures`).
- **Fiche** : textes ci-dessous. **Confidentialité** : `docs/CONFIDENTIALITE.md`.

## À faire une fois

1. **Créer la clé de signature** (à garder précieusement : sans elle, plus de mise à jour possible) :
   ```sh
   keytool -genkeypair -v -keystore idleport-release.jks -alias idleport -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 idleport-release.jks > idleport-release.b64
   ```
   Le plus simple est d'activer ensuite la **signature d'application par Google Play** : cette clé devient alors la « clé d'importation ».
2. **Secrets GitHub** (Settings > Secrets and variables > Actions) : `ANDROID_KEYSTORE_BASE64` (contenu du `.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`idleport`), `ANDROID_KEY_PASSWORD`.
3. **Compte Play Console** (25 $ une fois) : https://play.google.com/console. Un compte personnel récent doit faire un **test fermé avec au moins 12 testeurs pendant 14 jours** avant de pouvoir publier en production.
4. **Créer l'application** : nom « IdlePort », langue par défaut français, jeu, gratuit.
5. **Remplir** : politique de confidentialité (URL publique de `docs/CONFIDENTIALITE.md`, par exemple une page Notion, Google Sites ou GitHub Pages), Sécurité des données (réponses ci-dessous), classification IARC (questionnaire : pas de violence réaliste, pas de jeux d'argent réels, achats intégrés oui quand ils seront branchés), public cible (13 ans et plus conseillé, à cause des pubs).
6. **Envoyer l'AAB** dans Tests > Test fermé, ajouter les testeurs (liste d'e-mails), lancer.

## Sécurité des données (version actuelle)

- Données collectées : **aucune** tant que `VITE_TELEMETRY_URL` n'est pas configurée.
- Si les statistiques anonymes sont activées : « Informations sur l'appli et performances » (journaux de plantage, diagnostics) et « Activité dans l'appli » (interactions), **non associées à l'utilisateur**, avec consentement, non partagées.
- Quand AdMob sera branché : ajouter « Identifiants de l'appareil » (identifiant publicitaire), partagé avec Google pour la publicité.

## Fiche

**Titre** (30 car.) : IdlePort : Aéroport Idle

**Description courte** (80 car.) : Bâtissez votre aéroport étage par étage et envoyez vos avions au bout du monde !

**Description longue** :

> Bienvenue à IdlePort, l'aéroport qui grandit avec vous !
>
> 🏢 **Construisez votre tour** étage par étage et ouvrez des magasins tirés au sort : snacks, boutiques de souvenirs, salons futuristes… Chaque magasin vend tout seul, même quand le jeu est fermé.
>
> ✈️ **Envoyez vos avions** vers des pays imaginaires : Mélodia, Tropicalia, Bitopia, Givrebourg, Infernia… Ramenez des passagers, des billets et des ressources exotiques.
>
> 👨‍✈️ **Recrutez votre équipage** : pilotes, hôtesses et mécanos aux talents rares, à placer dans le bon avion.
>
> 🧪 **Fusionnez vos magasins** pour découvrir des enseignes légendaires et complétez votre Dex.
>
> 🌟 **Ouvrez des franchises** pour recommencer plus fort, avec des étoiles qui boostent tous vos gains.
>
> 🎉 Événements saisonniers, quêtes du jour, cadeau quotidien, VIP farfelus et plus de 40 succès.
>
> Un jeu de gestion idle tout en cubes, à jouer quelques minutes ou des heures. Pas de pub imposée : les pubs sont toujours un choix, contre une récompense.

**Catégorie** : Jeux > Simulation. **Tags** : idle, gestion, tycoon, aéroport.
