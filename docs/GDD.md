# IdlePort — Game Design Document (v1)

> Jeu mobile idle **vertical**, en **voxel 3D « cube art »** (vue isométrique, style pixel art en option).
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
| Jours | Cadeau quotidien, quêtes du jour, montée de niveau, déblocage des anneaux, collections (VIP, album, équipage) |
| Semaines → mois | Pays à l'honneur, succès, Franchise (prestige infini) |

---

## 3. Monnaies & ressources

| Nom | Icône | Source | Usage |
|---|---|---|---|
| **Pièces** | 🪙 | Ventes des magasins, billets, pourboires, événements | Étages, améliorations, avions, recrutement standard, recherche |
| **Miles** (monnaie premium) | ✈️ | Missions, quêtes du jour, cadeau quotidien, succès, VIP, événements rares, pubs, achats | Accélérer, recrutement premium, relancer un tirage |
| **Ressources régionales** | 🎶 🐚 … | Vols vers le pays correspondant | Recherche du pays |
| **Réputation (XP)** | ⭐ | Construire, voler, VIP, recherche | Niveau d'aéroport → débloque anneaux, étages, avions |

**Accélérer avec des Miles** : tout chrono (chantier, réappro, recherche, fusion, vol, réparation) se termine immédiatement pour **1 ✈️ par tranche de 10 min restantes** (minimum 1). Une recherche de 15 min coûte donc 2 ✈️, un réappro « Gros » 2 ✈️.

**Départ** : 300 🪙, 10 ✈️, niveau 1, aucun étage, un Coucou sans équipage, salle d'embarquement niveau 1 (30 places). Le premier étage (150 🪙) est donc abordable tout de suite, le second (218 🪙) demande les premières ventes.

---

## 4. L'aéroport-tour

### 4.1 Structure (de bas en haut)
- **Tarmac** (sol) : places de parking = capacité du hangar. Les avions décollent/atterrissent ici.
- **Hall (RDC)** : les passagers arrivent, la **salle d'embarquement** stocke ceux qui attendent un vol. Les décorations du hall s'y affichent.
- **Étages 1..N** : un magasin par étage.
- **Toit** : tour de contrôle + bouton « Construire un étage ».

### 4.2 Construire un étage
- Coût : `150 × 1.45^(n-1)` pièces (n = numéro du futur étage).
- Durée : `15 s × n^1.3` (max 6 h, jamais atteint en pratique : l'étage 40 prend 30 min). Accélérable (Miles ou 📺 pub). Un seul chantier à la fois.
- Étages max : `6 + 3 × niveau d'aéroport` (9 au départ). En fin de partie, c'est le **coût exponentiel** (étage 30 ≈ 7,2 M, étage 40 ≈ 295 M) qui freine, pas ce plafond.

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
- Le tirage **évite les magasins déjà présents** dans la tour tant que la catégorie en propose d'autres ; sinon un doublon peut sortir.
- Relancer le tirage : 5 ✈️ ou 📺 pub (1 fois par étage), seulement tant que le magasin n'a jamais été réapprovisionné ni amélioré. La relance ne peut pas redonner le même magasin.
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
- Le réappro est **gratuit** et ne peut se lancer que sur un **rayon vide** (pas de cumul de stock).
- Un magasin fraîchement ouvert est vide : premier geste du joueur = lancer un « Petit ».
- Le stock est figé en pièces au moment où il arrive en rayon ; une amélioration ultérieure fait vendre plus vite le stock restant.

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
- Le résultat devient un **plan** (inventaire) → à poser sur un étage vide, ou à utiliser comme doublon (+1 étoile, sur un étage portant le même magasin).
- Le résultat est tiré parmi **tous** les magasins compatibles, y compris ceux pas encore dans le pool du tirage : la fusion est un raccourci vers les magasins rares et épiques des pays. Exemple : Disquaire 🎵 + Bar à smoothies 🌴 → magasins neutres, de Mélodia, de Tropicalia, ou Beach party.
- Une seule fusion à la fois. La recette est fixée (et payée) au lancement ; le plan arrive à la fin du chrono.

### 4.7 Passagers
- Arrivées : `0.3 + 0.05 × magasins` passagers/s, vers la salle d'embarquement (cap `20 + 10 × niv. salle` + bonus déco, niveau de salle 1 au départ).
- **Agrandir la salle** : `400 × 2^(niv-1)` 🪙, niveau max 10 (110 places). Utile quand la salle est pleine entre deux vols.
- 🤳 Influenceuse : les arrivées comptent double pendant 10 min.
- **Guider** (actif) : un passager apparaît parfois dans le hall avec une bulle « étage X » → tap → pourboire (`5 × étage`) et 5 % de chance de 1 ✈️.
  - Un test toutes les 30 s : 25 % de chance qu'un passager apparaisse (s'il n'y en a pas déjà un), vers un étage qui a un magasin. Il attend 1 min.
  - Se tromper d'étage le fait repartir sans pourboire.

### 4.8 Personnalisation
- Couleur de mur par étage (palette de 8 teintes), couleur de façade et sol du hall (couleur libre). Tout est **gratuit** et instantané.
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

Non satisfait (mauvais pays, confort trop bas, module manquant) → rien, et le VIP repart. Dans les deux cas il quitte la salle.

### 5.3 Apparition
- Un test par minute (hors ligne : 10 tests au plus au retour) :
  - VIP à pouvoir : `0,5 % × magasins neutres`, plafonné à 5 % ;
  - pour chaque pays dont l'anneau est débloqué : `1 % × magasins de ce pays`, plafonné à 5 % (un magasin à double élément compte pour ses deux pays).
  - Soit au plus ~3 VIP à pouvoir par heure de jeu : le Millionnaire reste une surprise, pas une rente.
- Chances ×(1 + 30 %) avec la déco 🔥 Brasero éternel.
- **4 VIP au plus** attendent en même temps. Un VIP embarqué dans un vol ne repart pas à l'expiration.
- Effets précis : 📦 Livreur = réappro « Petit » instantané de tous les rayons vides ; 🎤 Influenceuse cumulable (+10 min) ; 🎧 Contrôleur = −50 % du temps restant de chaque vol, sans consommer le « Vent arrière » ; un VIP sans effet possible (aucun chantier, aucun rayon vide, aucun vol) reste dans le hall.

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

Hangar : `2 + ⌊niv. aéroport / 3⌋` places (3 au niv 3, 4 au niv 6…).

**Réparation** (avion endommagé par un événement, il ne peut plus décoller) : `10 % × max(500, prix)` 🪙 et 10 min, ou 📺 pub instantanée. Réduite par la déco 🛩️ (−30 %) et le trait Économe (−25 %).

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
- L'affinité est **cumulable** : 3 membres du bon élément = +45 % récompenses et +45 % réussite.
- Bonus de siège (proportionnels aux **points** = puissance × niveau) :

| Siège | Bonus par point | Exemple C niv 10 (10 pts) | Exemple L niv 40 (120 pts) |
|---|---|---|---|
| Pilote | +0,5 % vitesse | +5 % | +60 % |
| Cabine | +0,1 confort (arrondi bas) | +1 | +12 |
| Mécano | +0,5 fiabilité | +5 | +60 (plafond 99) |

- Les traits s'appliquent dès que le membre est assis : Lève-tôt (+10 % vitesse), Bavard (+10 % billets), Vétéran (+20 % XP), Chanceux (+5 % réussite partout), traits de pays (±10 % réussite dans ce pays), Économe (−25 % réparation).
- Effectif max : **30** membres. Renvoyer un membre est gratuit (rien n'est remboursé).
- XP par vol : `10 × anneau` pour chaque membre de l'avion (+ XP d'événement). Niveau suivant : `20 × niv^1.5` XP. Au niveau max l'XP n'est plus comptée.
- Changer un membre de siège est gratuit, mais impossible pendant un vol. Asseoir un membre libère celui qui occupait le siège.

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
- **Nom** généré par syllabes propres au pays = préfixe + suffixe (ex : Mélodia → « Arpège-sur-Gamme », « Tempoville », « Vibraphonie » ; Infernia → « Brais-du-Gouffre », « Lucifgehenne »).
- **Distance** tirée dans l'anneau.
- **Modificateur** : d'abord 10 % de chance de **Mystère**, sinon tirage pondéré :

| Modificateur | Poids | Billets | Ressource | Événements |
|---|---|---|---|---|
| Calme | 50 | ×1 | ×1 | normaux (70 %) |
| Festival | 15 | ×1 | ×1.5 | normaux |
| Ruée | 15 | ×1.5 | ×1 | normaux |
| Tempête | 10 | ×2 | ×2 | normaux, malus **deux fois plus probables** |
| Mystère | 10 % | ×1 | ×1 | le **premier** vol vers cette destination a **toujours** un événement rare ; les vols suivants vers la même destination sont normaux (sinon on enchaîne les trésors) |

### 8.3 Vol
- Durée : `distance / vitesse × 150 s` (aller-retour, ex. 300 km en Coucou ≈ 2 min 30).
- Départ : prend jusqu'à `capacité` passagers dans la salle + les VIP choisis.
- Billets : `(5 + 0.05 × distance) × passagers × (1 + 0.04 × confort)`.
- Ressource : `(5 + 0.5 × passagers) × anneau`.
- Multiplicateurs des billets : `× (1 + bonus billets)` (modules, déco 📺, trait Bavard, Carnet VIP) `× modificateur × (1 + 0.15 × affinités)`.
- Multiplicateurs de la ressource : `× modificateur × (1 + 10 % si la 1re techno du pays est recherchée) × (1 + 0.15 × affinités)`.
- Réputation : `15 × anneau` par vol (+40 par VIP satisfait).
- Conditions de départ : avion libre et non endommagé, anneau débloqué, autonomie ≥ distance. Les passagers embarqués quittent la salle.
- Le **premier retour** d'un pays le marque comme **découvert** (son magasin commun entre dans le pool, sa recherche s'ouvre).
- L'avion attend au tarmac jusqu'à ce que le joueur le **collecte** (geste actif) ; les gains sont crédités à la collecte.
- 📺 « Vent arrière » : −50 % du temps restant (1 fois par vol).
- 📺 « Double récolte » au retour : recrédite une fois les pièces et la ressource du vol (hors VIP).

### 8.4 Événements au retour (70 %)
La chance de 70 % vaut pour les vols de **15 min ou plus** ; en dessous elle est proportionnelle à la durée, avec un minimum d'un quart (17,5 %) : `70 % × clamp(durée / 15 min, 0,25, 1)`. Sans cette règle, les allers-retours de 2 min de l'anneau 1 rapportent trop de Miles.

Chaque pays a sa table d'événements (+ quelques génériques) :
- **Bonus** : instantané (ex. « Concert improvisé en cabine : +50 % pourboires »).
- **Malus** : évitable avec un test de fiabilité (chance d'éviter = `fiabilité × 0.6 %`).
- **Choix** : 2 options, chacune avec un test de réussite (`base + affinités + traits + module`).
Résultats possibles : pièces, ressources, Miles, XP équipage, réputation, **avion endommagé** (réparation), **magasin débloqué**, **VIP** qui rentre avec vous (un VIP du pays visité arrive dans le hall avec sa demande ; 3 événements le proposent : chef étoilé, pillards, ange).

Règles de calcul :
- Les effets « +x % / −x % » s'appliquent aux billets et à la ressource **du vol** (pas aux récompenses VIP) : `pièces × (1 + x)`, jamais en dessous de 0.
- Bonus de réussite d'une option : `+15 %` par membre ayant l'affinité, traits (pays ou Chanceux), `+15 %` si le module du pays est installé. Une option à 100 % réussit toujours ; le total est plafonné entre 0 et 100 %.
- Tant qu'un **choix** n'est pas fait, le rapport de vol reste **en attente** : rien n'est crédité (ni pièces, ni XP, ni ressources), l'avion est quand même libre de repartir.
- Contenu actuel : 6 événements génériques (dont 2 rares) + 4 à 5 par pays (au moins un bonus, un malus et un choix chacun), soit 42 au total.

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
- Une seule recherche à la fois. Il faut avoir **découvert** le pays et terminé la techno `k-1` avant la techno `k`.
- Coût payé au lancement ; à la fin : +30 ⭐ et l'effet s'active (magasin dans le pool, module installable, déco et son passif).
- Exemple Mélodia (anneau 1) : k0 = 15 🎶 + 500 🪙, 1 min ; k3 = 160 🎶 + 4 000 🪙, 15 min 37.

---

## 10. Progression d'aéroport
- XP pour passer au niveau L+1 : `150 × L²` (150, 600, 1 350… 15 000 pour passer au 11).
- Gains :
  - **dépenser rapporte de la réputation** : chaque amélioration de magasin ou d'avion et chaque achat d'avion donne `√coût / 4` ⭐ ; un étage terminé donne `max(10 × n, √coût / 4)`. Les pièces se transforment ainsi toujours en progression, avec des rendements décroissants ;
  - vol `5 × anneau`, VIP satisfait 40, recherche 30, réputation des événements.
- Débloque : anneaux (1/4/8/13), étages (+3/niv), avions, hangar (+1 / 3 niv), fusion (niv 3).

### 10.1 Progression entre pays

| Anneau | Niveau | Distances | Premier avion qui y va | Avion dispo au niveau |
|---|---|---|---|---|
| 1 | 1 | 250-700 km | Coucou (800 km) | 1 |
| 2 | 4 | 1 100-1 700 km | Libellule (1 800 km) | 3 |
| 3 | 8 | 2 500-3 400 km | Albatros (3 500 km) | 6 |
| 4 | 13 | 4 500-7 500 km | Baleine (6 000 km, ou 7 500+ avec +3 niveaux d'autonomie) puis Colibri Jet (8 000 km) | 10 / 14 |

Chaque avion qui ouvre un anneau est disponible **avant** l'anneau : le joueur l'achète et l'équipe en attendant le niveau.

### 10.2 Rythme mesuré (simulation)
`npm run simulate` fait jouer un joueur scripté pendant 30 jours (Franchise dès qu'elle au moins double les étoiles, cadeaux, quêtes et succès réclamés) (sessions de 16 h par jour, gestion gloutonne : collecter, renvoyer, réapprovisionner, acheter le moins cher utile). Heures de jeu réelles pour atteindre chaque niveau :

| Profil | Niv 4 (anneau 2) | Niv 8 (anneau 3) | Niv 10 | Niv 13 (anneau 4) |
|---|---|---|---|---|
| Assidu (10 min toutes les 1 h 30) | 6 h | 33 h | 57 h | 252 h (10,5 jours ; la 1re Franchise, au niveau 12 vers 129 h, passe avant) |
| Occasionnel (5 min toutes les 4 h) | 32 h | 124 h (5 jours) | 196 h (8 jours) | > 10 jours (mesure d'octobre 2026) |

Revenus du joueur assidu (mesure du 10 novembre 2026) : ~105 🪙/s après 6 h, ~1 400 🪙/s après 30 h, ~6 300 🪙/s au jour 4. Miles gagnés sans pub ni achat : surtout le Millionnaire et les événements rares (Noël, trésor), plus les 56 des missions.

**Angles morts de la simulation** : le joueur scripté n'ouvre aucune boîte de plans, ne fait aucun pari, ne satisfait presque aucun VIP de pays (1 en 28 jours) et n'achète jamais le Colibri Jet (5 à 6 avions au total). Ces systèmes ne sont donc pas validés par la simulation tant qu'elle ne les joue pas.
Vers le niveau 12-13, les pièces s'accumulent plus vite que les étages ne se construisent : c'est exactement là que la **Franchise** (§14) se débloque et relance la boucle.

## 11. Missions (onboarding)
Chaîne de missions qui guide le joueur et donne des Miles. Une seule mission active ; la récompense se réclame d'un tap, puis la suivante s'affiche.

| # | Mission | Récompense |
|---|---|---|
| 1 | Construire un étage | 2 ✈️ + 100 🪙 |
| 2 | Ouvrir un magasin | 2 ✈️ |
| 3 | Réapprovisionner un rayon | 2 ✈️ |
| 4 | Envoyer un vol | 2 ✈️ |
| 5 | Collecter un avion | 3 ✈️ |
| 6 | Avoir 3 étages | 3 ✈️ |
| 7 | Recruter un équipier | 3 ✈️ + 500 🪙 |
| 8 | Assigner un équipier | 3 ✈️ |
| 9 | Améliorer un avion | 3 ✈️ |
| 10 | Améliorer un magasin | 3 ✈️ |
| 11 | Terminer une recherche | 5 ✈️ |
| 12 | Atteindre le niveau 4 | 5 ✈️ |
| 13 | Visiter un pays de l'anneau 2 | 5 ✈️ |
| 14 | Fusionner deux magasins | 5 ✈️ |
| 15 | Satisfaire un VIP | 10 ✈️ |

Total : 56 ✈️, soit presque deux recrutements premium.

## 12. Hors ligne
Tout est basé sur des **horodatages** : ventes (jusqu'à épuisement du stock), vols, recherche, constructions, fusion. Arrivées de passagers plafonnées à la salle. Pas de plafond de durée hors ligne : les magasins s'arrêtent d'eux-mêmes à la fin du stock et les avions attendent d'être collectés. Les apparitions de VIP rattrapent au plus 10 tests (10 min). Au retour : récapitulatif (durée, pièces vendues, avions rentrés) + 📺 « ×2 gains hors ligne » (une fois par retour, sur les ventes des magasins).

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
| `boost` | Ventes des magasins ×2 pendant 4 h (cumulable jusqu'à 12 h) |
| `repair` | Réparation instantanée |
| Boutique (IAP) | Packs de Miles / pièces (ci-dessous) |

**Limites des pubs** : 30 pubs récompensées par jour au total. Délai par emplacement : `skip_build` 10 min, `restock_express` 5 min, `repair` 10 min ; `tailwind` et `double_collect` une fois par vol, `reroll_shop` une fois par étage, `offline_x2` une fois par retour, `free_recruit` toutes les 4 h.

**Packs (prix indicatifs)** :

| Pack | Prix | Contenu |
|---|---|---|
| Poignée de Miles | 1,99 € | 60 ✈️ |
| Sac de Miles | 4,99 € | 170 ✈️ |
| Valise de Miles | 9,99 € | 380 ✈️ |
| Soute de Miles | 19,99 € | 850 ✈️ |
| Pack de départ (une fois, proposé dès le niveau 5 ou après une Franchise) | 2,99 € | 100 ✈️ + 20 000 🪙 |
| Pass Commandant (une fois) | 7,99 € | Pubs récompensées sans limite quotidienne, +10 % de revenus des magasins pour toujours |

Boutique : toucher le compteur de Miles. Aucune pub interstitielle, jamais. Plus tard : AdMob (pubs récompensées) + achats in-app via plugins Capacitor, branchés dans `showRewardedAd` et `purchase` (voir docs/MONETISATION.md), sans toucher au gameplay.

## 14. Prestige « Franchise »
Revendre l'aéroport pour en ouvrir un dans une nouvelle ville.

- Débloquée au **niveau 12**, et seulement si elle rapporte au moins 1 étoile.
- **Étoiles d'Alliance** sur toute la carrière : `⌊√(pièces gagnées au total / 1 M)⌋`. Une Franchise donne les étoiles gagnées depuis la précédente. Il faut donc 4× plus de pièces pour doubler ses étoiles : la boucle ralentit naturellement.
- Chaque étoile : **+5 % de revenus** des magasins et des billets, pour toujours.
- **On garde** : étoiles, Miles (monnaie premium, jamais perdue), équipage **légendaire** (désaffecté), Carnet VIP, album, Dex et compteur de pitié des boîtes, succès, statistiques de carrière, série quotidienne et quêtes du jour, couleurs, missions d'onboarding terminées, achats (Pass Commandant, packs uniques).
- **On repart de zéro** : pièces (300), niveau, étages, magasins, avions (un Coucou), équipage non légendaire, ressources, recherches, pays découverts, plans, VIP.
- Rythme mesuré (joueur assidu) : 1re Franchise vers le jour 5 (+20 ⭐, revenus ×2), puis la partie suivante retrouve le niveau 11 en 2 jours et va plus loin (niveau 15 au jour 20, 3 Franchises en 30 jours).

## 15. Direction artistique
- **Voxel 3D en « cube art »** : cubes nets avec un contour fin autour des objets seulement (style par défaut). Un style pixel art (basse résolution agrandie sans lissage) reste disponible.
- Caméra **orthographique isométrique**, faces ombrées « cuites » (haut clair, gauche moyen, droite sombre) → lisible et très léger sur mobile.
- Chaque pays a une palette ; les magasins et le mobilier en reprennent les couleurs.
- UI en surimpression (HTML/CSS), police pixel, format **portrait**.

## 16. Technique
- TypeScript + Vite + Three.js. Logique de jeu pure et testée (`src/core`), rendu (`src/render`), interface (`src/ui`).
- Sauvegarde locale toutes les 10 s, après chaque action et à la fermeture : `localStorage` (clé `idleport.save`) et, sur téléphone, stockage natif (`@capacitor/preferences`), chacun avec une copie de secours (`idleport.save.bak`) ; au lancement, la copie lisible la plus avancée gagne. Code de sauvegarde (Réglages) pour exporter ou charger une partie. La sauvegarde est versionnée : chaque nouvelle version ajoute une migration, et les champs absents d'une ancienne sauvegarde sont remplis avec les valeurs de départ. Une sauvegarde illisible ou plus récente que le jeu est ignorée.
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
- ✅ Franchise (prestige)
- ✅ Rétention : cadeau quotidien, quêtes du jour, succès, album, pays de la semaine, notifications planifiées (§18)
- ✅ Événements saisonniers à thème (§19) et social : amis, cadeaux, visites, classements (§20), côté moteur
- ✅ Polish (plan IP-01 à IP-31) : sauvegarde blindée, Réglages, retour Android, rappels locaux, musique, boutique (boost, Pass), captures automatiques, workflow de release (docs/PLAY-STORE.md), scène qui réagit, jour et nuit, profil et photo, mode paysage
- ⏳ Post-MVP : mise en ligne du serveur social (code prêt), vrais SDK pubs/IAP (docs/MONETISATION.md)

## 18. Durée de vie et rétention

### 18.1 Audit
| Levier | Horizon | État |
|---|---|---|
| Gains hors ligne, stock « Gros » à lancer avant de partir | heures | ✅ |
| Chronos courts (réappro, vols, guidage) | minutes | ✅ |
| Destinations renouvelées toutes les 4 h, recrutement gratuit toutes les 4 h | heures | ✅ |
| Missions d'onboarding (15) | 1-3 jours | ✅ |
| **Cadeau quotidien** avec série de 7 jours | jours | ✅ nouveau |
| **Quêtes du jour** (3 + coffre) | jours | ✅ nouveau |
| **Pays à l'honneur** de la semaine | semaines | ✅ nouveau |
| Anneaux 1 → 4, recherche (32 technos) | 1-3 semaines | ✅ |
| Collections : Carnet VIP (16), équipage, étoiles de magasins, **album** (43 magasins), **Dex** (§23) | semaines | ✅ |
| **Boîtes de plans** et **pari de rareté** (§22) | minutes → semaines | ✅ moteur |
| **Succès** à paliers (36) | semaines → mois | ✅ nouveau |
| **Franchise** (prestige infini) | semaines → mois | ✅ nouveau |
| **Notifications** planifiées | retour du joueur | ✅ branchées (rappels locaux Capacitor) |
| **Événements saisonniers** (9 par an, piste de récompenses, trophées) | mois → années | ✅ nouveau (§19) |
| **Social** : amis, cadeaux, visites, classement hebdo | jours → mois | ✅ moteur et serveur Cloudflare prêt (`server/social`), à déployer (§20) |

### 18.2 Cadeau quotidien
Un cadeau par jour (jour UTC), cycle de 7 jours. Manquer un jour fait recommencer le cycle au jour 1.

| Jour | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Cadeau | 300 🪙 × niv | 3 ✈️ | 600 🪙 × niv | recrue standard | 5 ✈️ | 1 200 🪙 × niv | **recrue premium** |

Équipage plein (30) → la recrue est remplacée par des Miles (5 ou 30).

### 18.3 Quêtes du jour
- 3 quêtes tirées chaque jour (graine joueur + jour), parmi 12 : collecter `10 + 2 × niv` vols, 8 réappros, 5 améliorations de magasin, 3 améliorations d'avion, guider 3 passagers, utiliser 1 VIP, satisfaire 1 VIP, gagner `2 000 × niv²` pièces, lancer 1 fusion, terminer 1 recherche, envoyer 3 cadeaux, visiter 2 aéroports amis. Les quêtes impossibles (cadeaux et visites sans ami,  fusion avant le niveau 3…) ne sortent pas.
- La progression compte à partir du tirage. Chaque quête : 3 ✈️ + `200 × niv` 🪙. Les trois réclamées : **coffre** de 5 ✈️ (14 ✈️ par jour au total).

### 18.4 Succès
48 succès en paliers, de quelques heures à plusieurs mois de jeu : étages (10 → 100), vols (100 → 50 000), pièces (1 M → 1 000 Md), VIP différents (5 → 16), album (10 → 43), pays (2 → 8), recherches (4 → 32), légendaires (1 → 9), Franchises (1 → 25), série quotidienne (7 → 100 jours), amis (1 → 20), cadeaux envoyés (10 → 1 000), trophées saisonniers (1 → 9), boîtes de plans ouvertes (10 → 500). Récompense : 3 à 150 ✈️ (≈ 1 250 ✈️ au total).

### 18.5 Album de magasins
Chaque magasin ouvert au moins une fois (tirage, relance ou plan) entre dans l'album, qui survit à la Franchise. Une **série complète** donne un bonus permanent de revenus des magasins : +3 % par pays (et pour la série neutre), **+10 %** pour la série des 8 magasins de fusion.

### 18.6 Pays à l'honneur
Chaque semaine (lundi 00 h UTC), un pays est à l'honneur, le même pour tous les joueurs, à tour de rôle : vols vers lui **+50 % de billets, ×2 ressource**, et ses VIP viennent deux fois plus souvent. Ça pousse à relancer la recherche de ce pays et à varier ses vols. Plus tard : un événement et un magasin exclusifs par semaine.

### 18.7 Notifications
Au départ du joueur, le jeu calcule les rappels à programmer (`plannedNotifications`) : premier avion qui atterrit, premier rayon vide, étage terminé, recherche terminée, recrutement gratuit prêt, cadeau quotidien du lendemain (9 h). Une notification par type, programmée via `@capacitor/local-notifications` quand le joueur quitte le jeu et annulée à son retour. Jamais entre 22 h et 8 h (décalée à 8 h). La permission est demandée après le premier avion récupéré (mission 5), avec une phrase qui dit ce qu'on y gagne ; chaque type se coupe dans les Réglages.

### 18.8 Miles gagnés sans payer (simulation, joueur assidu)
~30 ✈️ par jour en régime établi (quêtes 14, cadeau ~2, succès, Millionnaire, événements rares), soit une recrue premium par jour ou de quoi accélérer les chronos clés. Les pubs (30 / jour) et les packs viennent en plus.

## 19. Événements saisonniers

Neuf événements à thème par an, aux mêmes dates pour tous (UTC). Un seul à la fois ; hors saison, la bannière annonce le prochain (`nextSeason`).

| Événement | Dates | Pays à thème | Monnaie affichée | Magasin exclusif |
|---|---|---|---|---|
| 💘 Fête des amoureux | 7 → 21 févr. | Gourmandie | 💌 Lettres d'amour | 💝 Chocolatier des cœurs (E) |
| 🎭 Carnaval | 1 → 14 mars | Mélodia | 🎭 Masques | 🎭 Bal masqué (E) |
| 🌷 Fête du printemps | 1 → 21 avr. | Nuagelande | 🥚 Œufs | 🌷 Jardin suspendu (E) |
| 🎸 Fête de la musique | 14 → 28 juin | Mélodia | 🎟️ Billets de concert | 🎙️ Scène live (L) |
| 🏖️ Grandes vacances | 10 juil. → 25 août | Tropicalia | 🐠 Poissons-clowns | 🛖 Paillote (E) |
| 🏁 Rallye des dunes | 15 → 30 sept. | Désolande | ⛽ Bidons | ⛽ Station-service rétro (E) |
| 🎃 Halloween | 20 oct. → 3 nov. | Infernia | 🍬 Bonbons | 🏚️ Manoir hanté (L) |
| 💾 Semaine du Cyber | 20 nov. → 2 déc. | Bitopia | 💾 Disquettes | 🕹️ Arcade néon (E) |
| 🎄 Noël polaire | 10 déc. → 6 janv. | Givrebourg | 🎁 Paquets | 🎅 Atelier du Père Givre (L) |

**Points de saison** (la monnaie affichée change selon l'événement, le compteur est le même) :
- chaque vol récupéré : `2 × anneau`, **doublé** vers le pays à thème ;
- un **événement de vol saisonnier** (1 par saison, poids 4, tous pays, jamais sur une destination Mystère) entre dans le tirage habituel des événements et donne 10 à 60 points selon le choix.

**Piste de récompenses** (remise à zéro à chaque saison) :

| Points | 50 | 150 | 300 | 600 | 1 000 | 1 600 | 2 500 | 4 000 |
|---|---|---|---|---|---|---|---|---|
| Récompense | 5 ✈️ | 2 000 🪙 × niv | recrue standard | 10 ✈️ | **plan du magasin exclusif** | recrue premium | 25 ✈️ | **trophée** + 40 ✈️ |

- Rythme visé : un joueur assidu (~100 vols par jour, anneau 2, un tiers vers le pays à thème) fait ≈ 530 points par jour et finit la piste en ~8 jours ; un joueur occasionnel atteint le magasin exclusif (1 000) en 1 semaine environ. Les saisons durent 2 à 7 semaines.
- Le magasin exclusif arrive en **plan** (à placer sur un étage libre ou à utiliser comme étoile s'il est déjà ouvert). Il n'est jamais tiré au hasard ni produit par fusion, et il ne compte pas dans les séries de l'album (§18.5) : rater une saison ne bloque aucune collection.
- Les **trophées** (`halloween-2026`…) sont gardés pour toujours, Franchise comprise, et affichés sur le profil public. Succès dédiés (1 / 5 / 9 trophées).
- Équipage plein : la recrue devient 5 ou 30 ✈️, comme pour le cadeau quotidien.

## 20. Social

Le moteur reste jouable hors ligne : tout passe par une interface `SocialBackend` (publier son profil, lire ceux des amis, livrer et récupérer les cadeaux, top mondial). `MemorySocialBackend` sert au développement et aux tests ; le vrai serveur est un Cloudflare Worker avec une base D1 (`server/social`, déploiement dans son README), branché par `HttpSocialBackend` (src/ui/socialServer.ts) quand le build connaît `VITE_SOCIAL_URL`. Chaque téléphone tire une clé secrète gardée dans la sauvegarde ; le serveur n'en garde que l'empreinte, ce qui empêche de publier sous le code d'un autre ou de prendre ses cadeaux. Le jeu se synchronise au lancement, toutes les 5 minutes et à l'ouverture de l'onglet Amis : profil publié, cadeaux reçus ouverts (au-delà de 10 par jour ils repartent au serveur pour le lendemain), profils des amis rafraîchis.

### 20.1 Profil et code ami
- Chaque joueur a un **code ami** stable tiré de sa graine (`IP-XXXX-XXXX`, sans 0/O/1/I) et un nom (2 à 20 caractères, modifiable).
- **Profil public** publié à chaque ouverture et toutes les 10 min de jeu : nom, niveau, étoiles de Franchise, score de la semaine, pièces totales, Carnet, album, couleurs de façade et de hall, 10 premiers étages (magasin + niveau). Il suffit à dessiner la tour d'un ami en visite.

### 20.2 Amis
- On ajoute un ami avec son code (ou un lien de partage). 50 amis au maximum, pas soi-même, pas deux fois.

### 20.3 Cadeaux
- **1 cadeau par ami et par jour**, gratuit à envoyer. Le destinataire l'ouvre à sa prochaine connexion : `150 × niv` 🪙 chacun, **10 ouverts par jour** au plus (les autres attendent le lendemain).
- Quête du jour « Envoyer 3 cadeaux », succès 10 / 100 / 1 000 cadeaux.

### 20.4 Visites
- Visiter la tour d'un ami (vue 3D en lecture seule à partir de son profil) laisse un **pourboire** : `50 × niv` 🪙 et 10 % de chance d'1 ✈️, une fois par ami et par jour.
- Quête du jour « Visiter 2 aéroports amis ».

### 20.5 Classements
- **Score de la semaine** = pièces gagnées depuis lundi 00 h UTC (même semaine que le pays à l'honneur). Juste entre petits et gros joueurs ? Non : il favorise les tours avancées, d'où un classement **entre amis** en priorité.
- **Classement entre amis** (soi + amis ayant publié cette semaine). Le lundi suivant, récompense selon le rang : **1er 30 ✈️, 2e 20, 3e 10, autres 5** (il faut au moins un ami classé).
- **Top mondial** de la semaine fourni par le serveur (`topWeekly`), sans récompense pour l'instant (anti-triche à prévoir côté serveur avant d'en mettre).
- Plus tard : ligues par niveau, classement par saison.

### 20.6 Ce qui reste à faire
Serveur réel et authentification, lien de partage du code, écran de visite 3D, modération des noms, notifications « X vous a envoyé un cadeau ».

## 21. Interface et prise en main

Interface DOM (`src/ui`) au-dessus de la vue cube art, pensée pour le portrait mobile.

**Direction visuelle (refonte B+C, 2026-10-27)** : la scène 3D occupe tout l'écran sur tous les onglets ; le HUD, le guide, les panneaux et le dock d'onglets flottent dessus. Cartes et boutons crème à contour encre de 3 px avec ombre portée (palette dans `:root` de `style.css`), dock d'onglets sombre avec onglet actif jaune. `fitScene()` mesure le HUD et les panneaux et recadre la caméra sur l'espace libre (`tower.inset`).

- **Boutons** : verbe + coût ou gain sur deux lignes. Un bouton indisponible reste touchable et explique pourquoi (« Il manque 120 🪙 », « Niveau 6 requis »). Couleurs : jaune = action principale, violet = pub récompensée, turquoise = payé en Miles, gris = secondaire.
- **Tour** : la vue de l'aéroport occupe presque tout l'écran. Un **ascenseur** à droite (🛫 piste, 🛎️ hall, étages, 🏙️ vue d'ensemble) ou un glissement vertical sur la vue fait passer d'un étage à l'autre : les étages du dessus et le toit sont masqués et la caméra zoome sur l'étage choisi. Une **bulle** dans la vue dit ce qu'il attend (❗ Commander, ⬆ Améliorable, VIP au hall, caisse gratuite) ; le petit panneau du bas reprend ses actions directes (réappro, améliorer, guider, pari, « ⋯ » pour la fiche complète). Pastilles de l'ascenseur : ❗ action attendue, vert = amélioration abordable, violet = VIP ou cadeau. Le journal de mission se replie en pastille (« 📋 x/y »), replié d'office après les 4 premières missions.
- **Boîtes et pari** (§22) : bouton 🎁 Boîtes dans la vue d'ensemble, probabilités en barre colorée, compteur de pitié, écran d'ouverture animé (confettis dès le Rare), plans en attente avec le bouton pour les poser ou en faire une étoile. Le pari de rareté apparaît en tête de la fiche d'un magasin neuf (mise sûre / mise risquée, chances affichées).
- **Dex** (§23) : carte en tête d'Objectifs, puis fiche par section (magasins, VIP, avions, pays, événements), entrées non trouvées en « ? » avec leur indice, paliers 25/50/75/100 % à récupérer (pastille sur l'onglet).
- **Sous-onglets** en haut de chaque onglet, pour ne jamais défiler à la recherche d'une info (seules les vraies listes défilent) : Vols (Avions, Départs, Pays, Recherche), fiche avion (Vol, Améliorer, Équipage, Équipements), Équipe (Recruter, Mon équipe), Objectifs (Missions, Quêtes, Événement, Succès, Dex), Amis (Amis, Classement, Mon profil). Pastilles de notification sur les sous-onglets.
- **Icônes** : jeu d'icônes Phosphor (remplissage) embarqué, à la place des emojis d'interface ; VIP, magasins et avions sont montrés par leur portrait cube art.
- **Conditions de vol** : sur la fiche avion et pour chaque destination, ✔ / ✖ / ⚠ : passagers, autonomie (km manquants), météo (Calme, Festival, Ruée, Tempête, Mystère et leurs effets), chance d'événement en vol, part d'incidents évités par la fiabilité, et pour chaque VIP si l'avion lui convient (confort, équipement).
- **Vols** : sous-vues Avions / Départs / Pays / Recherche. Le **tableau des départs** (une ligne par avion : statut, route et position de l'avion en vol ; toucher une ligne amène sur sa fiche) est aussi l'arrêt « piste » de l'onglet Tour. Une fiche par avion, en défilement vertical : aperçu cube art, statut et action, caractéristiques avec jauges d'amélioration, 3 sièges d'équipage et emplacements d'équipement modifiables, nom modifiable.
- **Tutoriel** : le conseil suit la mission en cours (§11) ; le bouton à toucher clignote, ou l'onglet à ouvrir s'il est ailleurs. Écran de bienvenue au premier lancement, aide ⓘ sur chaque section et sur les compteurs du HUD.
- **Déblocage progressif** (annoncé par un écran « Nouveau ! ») :

| Fonction | Mission atteinte | ou niveau |
|---|---|---|
| Objectifs | 2 (Ouvrir un magasin) | 2 |
| Vols | 4 (Envoyer un vol) | 2 |
| Équipe | 7 (Recruter) | 3 |
| Recherche | 11 (Terminer une recherche) | 3 |
| Événements saisonniers, Amis, Laboratoire | — | 2, 3, 3 |
| Boîtes de plans, Dex | — | 2 |
| Franchise (aperçu, active au niveau 12) | — | 10 |

- **Retours** : pièces et Miles qui volent vers le compteur, confettis (mission, niveau, déblocage), sons synthétisés (coupables dans le HUD), vibrations légères (Capacitor Haptics), glissement horizontal pour changer d'onglet, pastilles de notification sur les onglets.
- **Typo** : Nunito (texte) et Lilita One (titres, chiffres), embarquées dans l'APK.
- **Réglages** (⚙ dans le HUD) : sons, vibrations, animations (auto = réglage du téléphone, ou réduites), taille du texte, 30 ou 60 i/s, export et chargement de la sauvegarde, recommencer de zéro, confidentialité, version.
- **Android** : le geste retour ferme la fenêtre ouverte, sinon revient à la Tour, sinon propose de quitter. Au retour d'arrière-plan après plus d'une minute, le récapitulatif hors ligne s'affiche.
- **Chiffres** : à la française (« 9 999 », « 12,4 k », « 3,05 Md », puis Bn, Bd, Tn, Td, aa…) ; le compteur de pièces défile en continu.
- **Confort du milieu de partie** : « Tout récupérer » (Vols, dès 2 avions rentrés, niveau 4) et « Tout réapprovisionner » (Tour, dès 2 rayons vides, niveau 6, même taille de commande pour tous) ; mêmes coûts et gains qu'un par un.
- **Retour** : l'écran « Bon retour ! » liste ce qui attend (avions rentrés, incidents, rayons vides, VIP, cadeau du jour, recrue gratuite), chacun avec son raccourci.
- **Tirages** : ouvrir ou relancer un magasin le révèle avec un court suspense (dé, puis le magasin dans la lueur de sa rareté, son et vibration plus forts pour Épique et Légendaire).
- **Musique** : synthétisée, une ambiance par pays de la semaine (tonalité, tempo, timbre), très discrète, coupée en arrière-plan ; interrupteur dans les Réglages.
- **Premiers pas** : au premier lancement, une phrase de bienvenue (les règles complètes restent dans Réglages > Comment jouer). Pendant les 6 premières missions, une main animée pointe le bouton à toucher. Le compteur de Miles apparaît après la première mission, celui des passagers à la mission « Envoyer un vol ».
- **Statistiques et erreurs** (`telemetry.ts`) : événements anonymes (sessions, missions, niveaux, déblocages, erreurs) gardés sur le téléphone ; envoyés seulement si une adresse de collecte est configurée au build (`VITE_TELEMETRY_URL`) et que le joueur accepte. Réglages > Signaler un problème donne un rapport à copier avec les dernières erreurs.
- **Scène qui réagit** : sur la vue de toute la tour, toucher un étage y emmène l'ascenseur. Toutes les 3 secondes, les étages qui vendent affichent leur gain (« +12 🪙 »). Un étage terminé tombe à sa place avec un nuage de poussière ; un décollage secoue légèrement la caméra.
- **Jour, nuit et météo** : la lumière suit l'heure du téléphone (aube de 6 h à 8 h, crépuscule de 19 h à 21 h, nuit teintée de bleu) ; neige à Givrebourg, pluie à Tropicalia et Nuagelande, braises à Infernia.
- **Vibrations graduées** : légère au toucher, moyenne pour un achat, un décollage ou un étage posé, forte pour un niveau ou un Légendaire.
- **Profil** (toucher la barre de niveau) : niveau, statistiques de carrière, et « Photo de mon aéroport » (vue cadrée 1080×1350 avec le nom et le niveau, partagée par la feuille de partage du téléphone).
- **Couleurs** : palette « Daltonien » dans les Réglages (raretés et états en couleurs Okabe-Ito).
- **Langue** : français ou anglais (Réglages › Langue, « Auto » suit le téléphone). Le code reste en français ; le dictionnaire anglais (src/i18n) a pour clés les textes français et traduit tout le HTML au passage dans iconize(). Les nombres passent en notation anglaise (2.4M, 3B). `scripts/screens.mjs` capture les onglets en anglais et liste les textes sans traduction dans `missing-en.txt`.
- **Tablette et paysage** (plus de 700 px de large en paysage) : la scène reste à gauche sur tous les onglets, le panneau à droite.
- **Capucine, cheffe d'escale** : mascotte en cube art (uniforme bleu marine, casquette, bloc-notes) qui accueille le joueur, signe le journal et les bandeaux de conseil.
- **Performance** : simulation 4 fois par seconde (le compteur de pièces défile toujours à chaque image) ; la scène passe à 4 images par seconde quand une fenêtre la couvre ; résolution adaptative (si dessiner une image prend plus de la moitié du budget, la densité de pixels baisse par paliers jusqu'à 1). Les statistiques notent le temps de démarrage et les images par seconde de chaque session.
- **Accessibilité** : zones tactiles de 44 px, texte de 12 px minimum, contour de focus visible.

## 22. Gamble : boîtes de plans et pari de rareté

Les magasins ont quatre raretés (Commun 60 %, Rare 28 %, Épique 10 %, Légendaire 2 % au tirage d'un étage). Le tirage normal ne donne que les magasins **communs** des pays découverts (les autres viennent de la recherche, des événements et de la fusion). Le gamble ouvre un autre accès aux raretés hautes, avec un risque.

**Règles d'honnêteté** : probabilités affichées avant chaque achat (`boxOdds`), aucune boîte vendue directement contre de l'argent réel (seulement pièces, Miles gagnés en jeu ou pub), compteur de pitié visible.

### 22.1 Boîtes de plans
Le magasin gagné arrive en **plan** : à poser sur un étage libre, ou à utiliser comme **étoile** si le même magasin est déjà ouvert (les doublons ont donc toujours une valeur).

| Boîte | Prix | Commun | Rare | Épique | Légendaire |
|---|---|---|---|---|---|
| 📦 Caisse de chantier | `250 × niv²` 🪙 ou 5 ✈️, **gratuite avec une pub toutes les 6 h** | 55 % | 32 % | 11 % | 2 % |
| 🧰 Coffre d'architecte | 15 ✈️ | — | 65 % | 30 % | 5 % |
| 💼 Malle du magnat | 40 ✈️ | — | — | 80 % | 20 % |

- **Contenu** : magasins neutres et des pays **découverts**, toutes raretés (pas les magasins de fusion ni saisonniers). Si une rareté n'a aucun magasin disponible (ex. pas de légendaire neutre au début), sa part passe à la rareté inférieure ; les probabilités affichées en tiennent compte.
- **Pitié** : la 30ᵉ boîte d'affilée sans légendaire en donne un (compteur commun à toutes les boîtes, gardé après Franchise).
- Rythme : ~30 ✈️ par jour sans payer (§18.8) → un coffre d'architecte par jour, ou une malle tous les deux jours (≈ un légendaire par semaine et demie).

### 22.2 Pari de rareté (sur un étage)
Sur un magasin **neuf** (niveau 1, jamais réapprovisionné), on peut parier pour monter d'une rareté, dans la **même catégorie** :

| Rareté actuelle | Chance (mise sûre) | Chance (mise risquée) | Prix de la mise sûre |
|---|---|---|---|
| Commun → Rare | 40 % | — | `200 × niv²` 🪙 |
| Rare → Épique | 25 % | 37,5 % | `400 × niv²` 🪙 |
| Épique → Légendaire | 10 % | 15 % | `600 × niv²` 🪙 |

- **Mise sûre** : payée en pièces ; perdu, le magasin ne change pas.
- **Mise risquée** : gratuite, chance ×1,5 ; perdu, le magasin **descend** d'une rareté. Impossible sur un commun (il ne peut pas descendre).
- Les paris s'enchaînent tant que le magasin est neuf (Commun → Rare → Épique…). Le magasin obtenu entre dans l'album.
- Le pari n'est proposé que si un magasin de la rareté visée existe dans la catégorie (pays découverts compris).

## 23. Dex

Une encyclopédie qui regroupe toutes les collections, avec les entrées trouvées et celles qui manquent (silhouette « ? » et un indice pour savoir où chercher).

| Section | Entrées | Trouvée quand… | Indice |
|---|---|---|---|
| 🏬 Magasins (étages) | 52 (43 + 9 saisonniers) | ouvert une fois (album) | pays et rareté, recette de fusion, saison |
| ⭐ VIP | 21 | vu à l'aéroport ou servi (Carnet) | magasins qui l'attirent |
| ✈️ Avions | 5 | possédé une fois | niveau requis |
| 🗺️ Pays | 8 | découvert | anneau |
| 📜 Événements | tous (normaux, rares, saisonniers) | rencontré en vol | pays, Mystère ou saison |

- **Récompenses de complétion**, par section : 25 % → 5 ✈️, 50 % → 10 ✈️, 75 % → 20 ✈️, 100 % → 50 ✈️ (425 ✈️ au total). Un badge indique les récompenses prêtes.
- Le Dex survit à la Franchise. Le bonus de revenus des séries complètes reste celui de l'album (§18.5).

## 24. Aéroport à plat (city builder) — prototype

Décision du 10 novembre 2026 : la tour laisse place à un aéroport qu'on étale sur un terrain en grille (proposition complète : terrain, salles, adjacences, décors, collection d'avions, plan en 6 étapes). **Étape 1 en place** : un prototype jouable, séparé de la partie (Profil › « Essayer l'aéroport à plat »), qui garde son propre plan dans `localStorage` (`idleport.city`).

- **Moteur** (`src/core/city.ts`, testé) : grille de 24 × 20 cases, bâtiments à empreinte (terminal 3 × 3 unique, couloir 1 × 1, salle 2 × 2, porte 2 × 1, piste 2 × 12, voie de circulation 1 × 1, parking avion 2 × 2, tour de contrôle 2 × 2 unique, décors), pose, déplacement, rotation d'un quart, retrait (sauf le terminal).
- **Règles de position** d'une salle : reliée au terminal par des couloirs (sinon ×0), +10 % par salle voisine partageant un élément, zone de salles de même catégorie qui se touchent (+10 % dès 3, +25 % dès 6, +50 % dès 10), beauté des décors à portée (+3 % par point, plafond +30 % ; arbre et banc 1, parterre 2, fontaine 4 à 2 cases), porte à 2 cases ou moins (+15 %).
- **Côté aérogare et côté pistes** (demande de Maitre, comme les vrais aéroports) : le terrain (24 × 20) est coupé par une clôture. À gauche, l'aérogare : terminal, couloirs, salles, décors. À droite, la zone réservée aux avions : pistes, voies de circulation et parkings avions ; la tour de contrôle va des deux côtés. Les **portes** se posent contre la clôture, côté aérogare. Un parking est relié s'il touche une voie qui mène à la piste ; une porte est **en service** si elle est reliée au terminal et qu'un parking relié la touche de l'autre côté de la clôture (un avion y attend).
- **Départ** : terminal au centre de l'aérogare, couloirs autour, les magasins actuels du joueur posés tout autour (c'est ainsi que les sauvegardes seront converties à l'étape 3) ; deux portes en service, leurs parkings, des voies et la piste.
- **Écran** (`src/ui/cityProto.ts`, modèles `src/render/models/city.ts`) : glisser pour déplacer la vue, pincer ou molette pour zoomer, barre de construction en bas, fantôme vert ou rouge avant de poser, fiche de bonus en touchant une salle, « ! » rouge sur ce qui n'est pas relié.
- Pas encore : coûts, parcelles, lien avec les revenus réels, avions sur la piste.
