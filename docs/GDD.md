# IdlePort — Game Design Document (v1)

> Jeu mobile idle **vertical**, en **voxel 3D rendu en pixel art** (vue isométrique).
> Le joueur gère un aéroport qui grandit étage par étage, ouvre des magasins tirés au sort,
> recrute un équipage, améliore ses avions et les envoie vers une carte imaginaire de plus en plus lointaine.

Références assumées :

| Jeu | Ce qu'on reprend |
|---|---|
| **Tiny Tower Vegas** | La tour qui monte étage par étage, un magasin par étage, réapprovisionnement chronométré, VIP à pouvoir instantané, rythme « je reviens toutes les 10 min » |
| **Monster Legends** | Collection avec raretés (C/R/E/L) et **éléments**, **fusion** aléatoire (≈ breeding), équipes construites selon les affinités, carte d'aventure en anneaux de difficulté |

---

## 1. Piliers

1. **Une tour vivante** : chaque étage est un petit diorama voxel animé (passagers, vendeurs, couleurs du pays d'origine).
2. **Le hasard qui fait rêver** : on ne choisit pas son magasin, on le **tire** ; on peut **fusionner** deux magasins pour viser une recette rare.
3. **Partir loin, ramener l'exotisme** : chaque pays visité enrichit l'aéroport (magasins, déco, modules d'avion, passagers spéciaux).
4. **Rythme mixte** : idle (ventes, vols, recherche continuent hors ligne) + actif (réappro, guider les passagers, choix d'événements).

---

## 2. Boucles de jeu

```
            ┌──────────── MAGASINS (tour) ────────────┐
            │ vendent en continu  →  PIÈCES            │
            │ attirent des VIP    →  demandes de vol   │
            └───────▲───────────────────────┬──────────┘
                    │ nouveaux magasins     │ pièces
                    │ (pool par pays)       ▼
   RECHERCHE ◄── RESSOURCES ◄── VOLS (carte) ◄── AVIONS + ÉQUIPAGE
   (modules,      régionales    événements      (améliorations,
    déco, shops)                 au retour        recrutement)
```

| Échelle | Boucle |
|---|---|
| ~30 s | Guider un passager à son étage (pourboire), collecter un avion, réapprovisionner un rayon court |
| ~5-30 min | Vols anneaux 1-2, réappro moyen, construction d'étage, recherche |
| ~1-6 h | Vols lointains, réappro long, fusion légendaire, gains hors ligne |
| Jours | Montée de niveau d'aéroport, déblocage des anneaux, collection (VIP, magasins, équipage), Franchise (prestige) |

---

## 3. Monnaies & ressources

| Nom | Icône | Source | Usage |
|---|---|---|---|
| **Pièces** | 🪙 | Ventes des magasins, billets, pourboires, événements | Étages, améliorations, avions, recrutement standard, recherche |
| **Miles** (monnaie premium) | ✈️ | Missions, VIP, événements rares, pubs, achats | Accélérer, recrutement premium, relancer un tirage |
| **Ressources régionales** | 🎶 🐚 … | Vols vers le pays correspondant | Recherche du pays |
| **Réputation (XP)** | ⭐ | Construire, voler, VIP, recherche | Niveau d'aéroport → débloque anneaux, étages, avions |

---

## 4. L'aéroport-tour

### 4.1 Structure (de bas en haut)
- **Tarmac** (sol) : places de parking = capacité du hangar. Les avions décollent/atterrissent ici.
- **Hall (RDC)** : les passagers arrivent, la **salle d'embarquement** stocke ceux qui attendent un vol. Les décorations du hall s'y affichent.
- **Étages 1..N** : un magasin par étage.
- **Toit** : tour de contrôle + bouton « Construire un étage ».

### 4.2 Construire un étage
- Coût : `150 × 1.45^(n-1)` pièces (n = numéro du futur étage).
- Durée : `15 s × n^1.3` (max 6 h). Accélérable (Miles ou 📺 pub).
- Étages max : `4 + 2 × niveau d'aéroport`.

### 4.3 Ouvrir un magasin (tirage)
Étage vide → choisir une **catégorie** → tirage pondéré dans le **pool** de cette catégorie.

| Rareté | Poids | Revenu de base |
|---|---|---|
| Commun | 60 | 1.0 🪙/s |
| Rare | 28 | 1.6 🪙/s |
| Épique | 10 | 2.6 🪙/s |
| Légendaire | 2 | 4.2 🪙/s |

- Catégories : 🍔 Restauration · 🛍️ Boutique · 🛋️ Détente · 🧳 Services · 🎮 Loisirs.
- Le pool contient les magasins **neutres** + ceux des pays **découverts** (1er vol) et **recherchés**.
- Relancer le tirage : 5 ✈️ ou 📺 pub (1 fois par étage).
- On peut aussi poser un **plan** obtenu par fusion.

### 4.4 Réapprovisionnement (Tiny Tower)
Un magasin vend tant qu'il a du stock. Chaque magasin a 3 produits :

| Produit | Temps de réappro | Stock (durée de vente) |
|---|---|---|
| Petit | 20 s | 3 min |
| Moyen | 3 min | 30 min |
| Gros | 20 min | 3 h |

Stock (en pièces) = `revenu/s × durée`. Hors ligne, les magasins vendent jusqu'à épuisement → ça incite à lancer le « Gros » avant de partir.
📺 « Livraison express » : réappro instantané.

### 4.5 Revenu d'un magasin
```
revenu/s = base(rareté) × 1.25^(niveau-1) × (1 + 0.5 × (étoiles-1))
         × (1 + 0.1 × (niv. aéroport - 1))          // trafic
         × (1 + 0.10 × voisins partageant un élément) // adjacence
         × bonus déco / passifs
```
- **Niveau** (1-20) : `coût = base(rareté)×60 × 1.7^(niv-1)` (C 60, R 96, E 156, L 252 au niv 1).
- **Étoiles** (1-5) : un doublon obtenu (tirage/fusion) ajoute une étoile.
- **Adjacence** : on peut **échanger deux étages** gratuitement → personnalisation stratégique.

### 4.6 Fusion (Monster Legends)
- Débloquée au niveau 3. Choisir 2 magasins (ils ne sont pas consommés).
- Résultat possible : tout magasin dont les éléments ⊆ éléments(A) ∪ éléments(B), pondéré par rareté ; les magasins **à double élément** ne s'obtiennent **que** par fusion.
- Coût : `300 × (rang A + rang B)` pièces (rang C=1…L=4). Durée : `2 min × (rang A + rang B)`.
- Le résultat devient un **plan** (inventaire) → à poser sur un étage vide, ou à utiliser comme doublon (+1 étoile).

### 4.7 Passagers
- Arrivées : `0.3 + 0.05 × magasins` passagers/s, vers la salle d'embarquement (cap `20 + 10 × niv. salle`).
- **Guider** (actif) : un passager apparaît parfois dans le hall avec une bulle « étage X » → tap → pourboire (`5 × étage`) et petite chance de 1 ✈️.

### 4.8 Personnalisation
- Couleur de mur par étage, couleur de façade, sol du hall.
- **Décorations du hall** (débloquées par la recherche) : visibles en 3D + bonus passif.
- Ordre des étages (échange) → adjacences.

---

## 5. Passagers spéciaux (VIP)

### 5.1 VIP à pouvoir (Tiny Tower)
Apparaissent dans le hall (chance par magasin neutre), restent 10 min, tap pour utiliser :

| VIP | Effet |
|---|---|
| 🏗️ Promoteur | Termine la construction en cours |
| 📦 Livreur | Réapprovisionne tous les magasins vides (Petit) |
| 🤳 Influenceuse | Arrivées ×2 pendant 10 min |
| 🎧 Contrôleur aérien | −50 % du temps restant de tous les vols |
| 💰 Millionnaire | +5 ✈️ |

### 5.2 VIP de pays (demandes)
Attirés par les magasins d'un pays. Ils attendent **30 min** en salle d'embarquement avec une **demande** :
- destination : n'importe quelle destination du pays,
- confort minimum : `2 + 2 × anneau`,
- module requis : le module du pays **s'il est recherché** (ex : le Rockeur veut un 🪩 Dancefloor).

Satisfait → `500 × 3^(anneau-1)` 🪙, `20 × anneau` ressource, 3 ✈️, 40 ⭐, et une entrée au **Carnet** (+1 % pièces par VIP unique servi).

---

## 6. Avions

### 6.1 Statistiques
| Stat | Effet | Amélioration (par niveau, max 10) |
|---|---|---|
| Vitesse | Durée du vol | +8 % |
| Capacité | Passagers / billets | +10 % |
| Autonomie | Distance max | +10 % |
| Confort | Prix du billet (+4 %/pt), demandes VIP | +1 |
| Fiabilité | Évite les événements négatifs | +4 (max 99) |

Coût d'amélioration : `max(500, prix) × 0.15 × 1.5^niv`.

### 6.2 Flotte
| Modèle | Vit. | Cap. | Autonomie | Confort | Fiab. | Modules | Prix | Niv. |
|---|---|---|---|---|---|---|---|---|
| Coucou | 300 | 8 | 800 | 1 | 50 | 1 | offert | 1 |
| Libellule | 450 | 16 | 1 800 | 2 | 55 | 1 | 5 000 | 3 |
| Albatros | 600 | 30 | 3 500 | 3 | 60 | 2 | 40 000 | 6 |
| Baleine | 800 | 60 | 6 000 | 3 | 65 | 2 | 250 000 | 10 |
| Colibri Jet | 950 | 12 | 8 000 | 8 | 70 | 3 | 1.2 M | 14 |

Hangar : 2 places au départ, +1 tous les 3 niveaux.

### 6.3 Modules (technologies de pays)
Un module recherché est installable sur autant d'avions qu'on veut (dans la limite des emplacements).

| Pays | Module | Effet |
|---|---|---|
| Mélodia | 🪩 Dancefloor | +3 confort |
| Tropicalia | 🍹 Bar à cocktails | +2 confort, +10 % billets |
| Gourmandie | 👨‍🍳 Cuisine étoilée | +4 confort |
| Bitopia | 🤖 Pilote IA | +10 % vitesse, +5 fiabilité |
| Givrebourg | 🧊 Isolation cryo | +10 fiabilité, +10 % autonomie |
| Désolande | 🛡️ Blindage de récup | +15 fiabilité |
| Nuagelande | 🎈 Moteurs à vapeur céleste | +20 % vitesse, +20 % autonomie |
| Infernia | 😈 Réacteur infernal | +30 % vitesse, −5 fiabilité |

Bonus caché : un avion équipé du module d'un pays obtient **+15 %** de réussite aux événements de ce pays.

---

## 7. Équipage (collection)

3 sièges par avion : **Pilote** (vitesse), **Cabine** (confort, pourboires), **Mécano** (fiabilité).

- Rareté C / R / E / L → niveau max 10 / 20 / 30 / 40 et puissance ×1 / ×1.5 / ×2.2 / ×3.
- Chaque membre a un **élément** (pays) : affinité avec la destination = **+15 % récompenses** et **+15 % réussite** aux événements.
- 0-2 **traits** aléatoires : Mélomane, Bronzé, Gourmet, Geek, Frileux, Survivaliste, Rêveur, Ignifugé, Chanceux, Lève-tôt, Bavard, Économe, Vétéran…
- XP à chaque vol.

Recrutement (« Agence ») :
| Type | Coût | C | R | E | L |
|---|---|---|---|---|---|
| Standard | `500 × niv. aéroport` 🪙 | 70 % | 25 % | 4.5 % | 0.5 % |
| Premium | 30 ✈️ | — | 60 % | 33 % | 7 % |
| 📺 Gratuit | 1 / 4 h | 70 % | 25 % | 4.5 % | 0.5 % |

---

## 8. La carte imaginaire (partiellement procédurale)

### 8.1 Pays (fixes)
| Anneau | Pays | Ambiance | Ressource | Niv. requis |
|---|---|---|---|---|
| 1 | 🎵 **Mélodia** | Pays musical | 🎶 Notes | 1 |
| 1 | 🌴 **Tropicalia** | Pays tropical | 🐚 Coquillages | 1 |
| 2 | 🍰 **Gourmandie** | Royaume culinaire | 🧁 Saveurs | 4 |
| 2 | 💾 **Bitopia** | Pays digital | 💠 Octets | 4 |
| 3 | ❄️ **Givrebourg** | Archipel de glace | 💎 Cristaux | 8 |
| 3 | 🏜️ **Désolande** | Pays désolé | ⚙️ Ferraille | 8 |
| 4 | ☁️ **Nuagelande** | Îles flottantes | 💨 Vapeur | 13 |
| 4 | 🔥 **Infernia** | Pays des enfers | 🔥 Braises | 13 |

Distances : anneau 1 `250-700 km`, 2 `1 100-1 700`, 3 `2 500-3 400`, 4 `4 500-7 500`.

### 8.2 Destinations (procédurales)
Chaque pays propose **3 destinations** régénérées toutes les **4 h** (graine = joueur + pays + fenêtre de temps) :
- **Nom** généré par syllabes propres au pays (ex : Mélodia → « Do-Sol-ville », « Port-Arpège »).
- **Distance** tirée dans l'anneau.
- **Modificateur** : Calme (—), Festival (+50 % ressource), Ruée (+50 % billets), Tempête (+risque, ×2 récompenses), Mystère (10 % : événement rare garanti).

### 8.3 Vol
- Durée : `distance / vitesse × 150 s` (aller-retour, ex. 300 km en Coucou ≈ 2 min 30).
- Départ : prend jusqu'à `capacité` passagers dans la salle + les VIP choisis.
- Billets : `(5 + 0.05 × distance) × passagers × (1 + 0.04 × confort)`.
- Ressource : `(5 + 0.5 × passagers) × anneau`.
- 📺 « Vent arrière » : −50 % du temps restant (1 fois par vol).
- 📺 « Double récolte » au retour.

### 8.4 Événements au retour (70 %)
Chaque pays a sa table d'événements (+ quelques génériques) :
- **Bonus** : instantané (ex. « Concert improvisé en cabine : +50 % pourboires »).
- **Malus** : évitable avec un test de fiabilité (chance d'éviter = `fiabilité × 0.6 %`).
- **Choix** : 2 options, chacune avec un test de réussite (`base + affinités + traits + module`).
Résultats possibles : pièces, ressources, Miles, XP équipage, réputation, **avion endommagé** (réparation), **magasin débloqué**, **VIP** qui rentre avec vous.

---

## 9. Recherche (par pays)
4 technologies par pays, coût `15 × anneau × 2.2^k` ressource + `500 × 3^(anneau-1) × 2^k` 🪙, durée `60 s × 2.5^k × anneau` (k = 0..3).

| k | Type | Exemple (Mélodia) |
|---|---|---|
| 0 | Magasin rare dans le pool + 10 % ressource | 🎤 Karaoké |
| 1 | Module d'avion | 🪩 Dancefloor |
| 2 | Décoration de hall + passif | 🎸 Scène du hall (+10 % arrivées) |
| 3 | Magasin épique/légendaire dans le pool | 🎻 Luthier |

Découverte : le **premier vol** vers un pays ajoute son magasin commun au pool.

---

## 10. Progression d'aéroport
- XP pour passer au niveau L+1 : `50 × L^1.6`.
- Gains : étage construit `10 × n`, vol `15 × anneau`, VIP 40, recherche 30, mission variable.
- Débloque : anneaux (1/4/8/13), étages (+2/niv), avions, hangar (+1 / 3 niv), fusion (niv 3).

## 11. Missions (onboarding)
Chaîne de missions qui guide le joueur et donne des Miles : construire un étage → ouvrir un magasin → réapprovisionner → envoyer un vol → collecter → recruter → assigner l'équipage → améliorer un avion → rechercher → niveau 4 → visiter l'anneau 2 → fusionner → servir un VIP…

## 12. Hors ligne
Tout est basé sur des **horodatages** : ventes (jusqu'à épuisement du stock), vols, recherche, constructions, fusion. Arrivées de passagers plafonnées à la salle. Au retour : récapitulatif + 📺 « ×2 gains hors ligne ».

## 13. Monétisation (emplacements prévus)
Toutes les intégrations passent par `src/core/monetization.ts`.
**Version actuelle : chaque pub/achat donne sa récompense immédiatement** (aucun SDK branché).

| Emplacement | Récompense |
|---|---|
| `skip_build` | Termine la construction |
| `restock_express` | Réappro instantané |
| `tailwind` | −50 % du temps de vol restant |
| `double_collect` | ×2 sur un retour de vol |
| `free_recruit` | Recrutement gratuit (1 / 4 h) |
| `reroll_shop` | Relance un tirage de magasin |
| `offline_x2` | ×2 gains hors ligne |
| `repair` | Réparation instantanée |
| Boutique (IAP) | Packs de Miles / pièces |

Plus tard : AdMob (pubs récompensées) + achats in-app via plugins Capacitor, sans toucher au gameplay.

## 14. Prestige « Franchise » (post-MVP)
Revendre l'aéroport pour en ouvrir un dans une nouvelle ville. Gain : **Étoiles d'Alliance** = `√(pièces totales / 1M)`, chacune +5 % revenus permanents. On garde : équipage légendaire, Carnet VIP, technologies cosmétiques.

## 15. Direction artistique
- **Voxel 3D en « cube art »** : cubes nets avec un contour fin autour des objets seulement (style par défaut). Un style pixel art (basse résolution agrandie sans lissage) reste disponible.
- Caméra **orthographique isométrique**, faces ombrées « cuites » (haut clair, gauche moyen, droite sombre) → lisible et très léger sur mobile.
- Chaque pays a une palette ; les magasins et le mobilier en reprennent les couleurs.
- UI en surimpression (HTML/CSS), police pixel, format **portrait**.

## 16. Technique
- TypeScript + Vite + Three.js. Logique de jeu pure et testée (`src/core`), rendu (`src/render`), interface (`src/ui`).
- Sauvegarde locale (`localStorage`), versionnée.
- Packaging mobile prévu via Capacitor (Android / iOS).

## 17. Périmètre MVP (v0.1)
- ✅ Tour : étages, tirage, réappro, améliorations, échange d'étages, couleurs
- ✅ Fusion + plans
- ✅ 5 modèles d'avions, améliorations, modules
- ✅ Équipage : recrutement, traits, affinités, XP
- ✅ 8 pays, destinations procédurales, événements avec choix
- ✅ Recherche par pays (4 technologies)
- ✅ VIP à pouvoir + VIP à demandes + Carnet
- ✅ Missions d'onboarding
- ✅ Hors ligne, sauvegarde, emplacements de monétisation (récompense immédiate)
- ⏳ Post-MVP : Franchise, événements saisonniers, sons, Capacitor, vrais SDK pubs/IAP
