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
