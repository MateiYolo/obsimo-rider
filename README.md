# OBSIMO — Rider & fiche technique

Le rider live d'Obsimo, en ligne et toujours à jour. FR + EN, avec un PDF téléchargeable pour l'impression.

## Modifier le rider

1. Ouvre `content/fr.md` (et `content/en.md` pour la version anglaise) sur GitHub
2. Clique sur le crayon ✏️, modifie le texte
3. « Commit changes » (direct sur `main`, ou via une PR si tu veux faire relire)

Le site (hébergé sur Vercel) et les PDF se mettent à jour tout seuls en ~1 minute. La date « Mis à jour le » aussi.

Avec une PR, Vercel poste en commentaire un **lien d'aperçu** : tu vois le site et les PDF modifiés avant de merger. L'URL officielle ne change qu'au merge.

**Pense à modifier les deux langues.**

### Petit mémo de mise en forme

| Tu écris | Ça donne |
|---|---|
| `**texte**` | **gras** |
| `*texte*` | *italique gris* (pour les précisions) |
| `- truc` | une puce |
| `> texte` | encadré vert (note éco) |
| `## Titre` | une nouvelle section numérotée |
| `[texte](tel:+33600000000)` | un numéro cliquable |
| `![description](image.jpg)` | une image (fichier à mettre dans `assets/`) |

Tout ce qui est après `<!-- tech -->` va dans la partie « Fiche technique » (qui commence sur une nouvelle page dans le PDF).

## Changer une image

Remplace le fichier dans `assets/` en gardant le même nom : `logo.png`, `stage-plot.jpg`, `lumiere.jpg`.

## Ajouter une langue

Copie `content/en.md` en `content/de.md` (par exemple), change `lang: de` en haut et traduis. Elle apparaît toute seule dans le sélecteur.

## En local

```sh
npm install
npm run dev     # site sans PDF, sur http://localhost:3000
npm run build   # site + PDF dans dist/
```
