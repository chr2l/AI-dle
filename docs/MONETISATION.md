# Brancher les vraies pubs et les achats

Tout passe par `src/core/monetization.ts` (GDD §13). Aujourd'hui `showRewardedAd()` et `purchase()` répondent `true` tout de suite : chaque pub et chaque achat est offert. Le reste du jeu (limites, boutique, Pass, boost) fonctionne déjà avec ces deux fonctions.

## Pubs récompensées (AdMob)

1. Compte AdMob : https://admob.google.com. Créer l'application Android (après sa création sur la Play Console), puis **un bloc « Avec récompense »**. Noter l'**ID d'application** (`ca-app-pub-…~…`) et l'**ID du bloc** (`ca-app-pub-…/…`).
2. Dans le dépôt :
   - `npm install @capacitor-community/admob` ;
   - versionner `android/` (aujourd'hui généré par la CI) et ajouter dans `AndroidManifest.xml` la balise `com.google.android.gms.ads.APPLICATION_ID` avec l'ID d'application. **Sans elle, l'app plante au lancement** : c'est pourquoi le plugin n'est pas encore installé ;
   - au démarrage : `AdMob.initialize()`, puis `AdMob.requestConsentInfo()` / `showConsentForm()` (consentement RGPD, obligatoire en Europe) ;
   - dans `showRewardedAd()` : `prepareRewardVideoAd({ adId })`, `showRewardVideoAd()`, résoudre `true` sur l'événement de récompense, `false` sinon.
3. Remplir `app-ads.txt` sur un site à vous (demandé par AdMob).

## Achats intégrés (Google Play Billing)

1. Play Console > Monétiser > Produits intégrés : créer les produits avec ces identifiants (ceux de `IAP_PACKS`) : `miles_small`, `miles_medium`, `miles_big`, `miles_huge` (consommables), `starter`, `pass` (non consommables).
2. `npm install @revenuecat/purchases-capacitor` (le plus simple, gratuit jusqu'à un certain chiffre d'affaires) ou `cordova-plugin-purchase`.
3. Dans `purchase(packId)` : lancer l'achat, résoudre `true` quand Google confirme. Au lancement, restaurer les achats non consommables (`starter`, `pass`) dans `state.purchases`.
4. Afficher les prix renvoyés par le store à la place de `priceEur`.

## Règles

- Jamais de pub interstitielle ni de pub au lancement.
- 30 pubs récompensées par jour maximum (illimité avec le Pass).
- Le pack de départ n'est proposé qu'à partir du niveau 5 ou après une Franchise.
