# Rendu voxel (cube art)

Deux styles, choisis dans `PixelRenderer` : **`cube`** (par défaut, à la demande de Maitre) dessine des cubes nets en pleine résolution, avec un contour fin seulement autour des objets (silhouette, changement de couleur), jamais entre les cubes d'un même objet ; **`pixel`** rend en basse résolution puis agrandit sans lissage (pixel art).

Chaîne choisie (voir GDD §15-16) : tout est **généré par du code TypeScript**, aucun fichier image à dessiner.

1. `src/render/voxel.ts` : `VoxelGrid` (grille dense, couleurs 0xRRGGBB) et `buildGeometry`, qui ne garde que les faces visibles et cuit l'ombrage dans les couleurs de sommets (haut clair, gauche moyen, droite sombre).
2. `src/render/models/` : modèles procéduraux. Étage-magasin (`floor.ts`, mise en page par catégorie + décor par pays + passagers), hall et toit (`building.ts`), avions à partir de `PlaneModel.shape` (`plane.ts`). Même graine, même modèle.
3. `src/render/palette.ts` : palettes des pays (`src/core/data/countries.ts`), mélanges, PRNG.
4. `src/render/pixelRenderer.ts` : caméra orthographique iso. Style `cube` : atlas de contours (16 masques) choisi face par face par `faceEdgeMask` (voxel.ts), `pixelsPerVoxel` = pixels CSS par cube (10 par défaut). Style `pixel` : basse résolution (`pixelScale`), caméra calée sur la grille de pixels pour éviter le scintillement au scroll.
5. `src/render/tower.ts` : empile hall, étages et toit ; piste avec avions garés.

## Aperçu

`npm run dev` puis ouvrir `/preview.html?style=cube&seed=3&floors=8` (ou `style=pixel`) (molette ou glisser pour monter).

## Ajouter du contenu

- Nouvelle catégorie de magasin : une entrée dans `CATEGORY_LAYOUTS` (`floor.ts`).
- Nouveau pays : une entrée dans `COUNTRY_DECOR` ; la palette vient des données.
- Une pièce faite à la main : MagicaVoxel (.vox) via `VOXLoader` de three.js, puis copie dans une `VoxelGrid`.
- Vérifier visuellement : capture Playwright de `preview.html` (Chromium lancé avec `--use-angle=swiftshader`).

## VIP

`src/render/models/vip.ts` : figurines « chibi » (grosse tête, petit corps) décrites par un `VipLook` (peau, coiffure, chapeau, détails du visage, tenue, cape, accessoire). Chaque VIP de `src/core/data/vips.ts` est un **clin d'œil parodique** à une figure connue (champ `nod`) : nom détourné, silhouette et accessoire signature, jamais de nom réel ni de copie d'un personnage protégé. Aperçu : `/preview.html?scene=vips` (ou `&vips=rockeur,diva`).

Les couleurs sont écrites en sRGB et converties en linéaire à la cuisson (`srgbToLinear`), sinon le rendu paraît délavé.

## Décor et aéroport vivant

- `src/render/models/scenery.ts` : décor procédural autour de la tour, habillé selon le **pays de la semaine** (`featuredCountry`) : sol, végétation (palmiers, sapins enneigés, cactus, lave, néons, enceintes, sucettes, nuages…), ciel, piste avec balisage et feux, taxiway, tarmac, hangar, route et parking. L'emprise de la tour reste libre.
- `src/render/airport.ts` : `AirportScene` gère les avions garés (rangée sur le tarmac), les décollages et les atterrissages (`flightPose`) quand un vol part ou revient dans `GameState`, et un trafic d'ambiance de temps en temps. Effets : poussière au roulage, bouffée au décollage, fumée au toucher, traînées, ombre qui rétrécit avec l'altitude, petit rebond à l'atterrissage, feux d'approche, oiseaux, voitures, nuages.
- `TowerView` appelle `airport.tick()` à 30 images/s (rien quand la vue est cachée) et `airport.sync()` à chaque `update(state)`.
- Aperçu : `/preview.html?country=givrebourg` (un avion décolle après 1 s).

## Horizon

`src/render/models/horizon.ts` (`buildHorizon(element)`) prolonge le décor jusqu'au bord de l'écran : un sol de dalles de 8 unités sur ±900 autour de l'aéroport (couleurs du thème, lacs au-delà de 170, routes prolongées), puis un anneau voxel à l'échelle 2 avec reliefs propres à chaque thème (montagnes, mesas, volcans, collines de nuages…), villes, collines et bois. Un brouillard couleur ciel (`towerView.ts`, ancré sur le point visé par la caméra) fond l'horizon. Reconstruit par `Airport.setTheme`.
