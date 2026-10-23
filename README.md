# Diario de síntomas · Journal de symptômes

PWA bilingue (es/fr) de suivi de symptômes et d'intolérances, **100 % locale et hors ligne** (IndexedDB, aucune donnée ne quitte l'appareil). Installable sur Android via Chrome.

> Phase 1 en cours de construction — README complet à l'étape 6.

## Démarrage

```bash
npm install
npm run dev        # développement
npm run build      # build de production (génère le service worker)
npm run preview    # sert le build (nécessaire pour tester l'installation PWA)
npm test           # tests unitaires (Vitest)
npm run icons      # régénère les icônes PWA
```

Le service worker n'existe que dans le build : pour tester l'installation et le hors-ligne, utiliser `npm run build && npm run preview`.

## Base d'aliments

| Fichier | Rôle |
|---|---|
| `src/data/base_aliments_histamine_fodmap.csv` | Base d'origine (recherche sourcée) : **ne pas la modifier à la main dans l'app**, on la remplace par un nouveau fichier |
| `src/data/allergen_flags.json` | Étiquettes allergènes (gluten, lait, œuf… solanacée, latex-fruits) par id d'aliment — absentes du CSV |
| `src/data/food_keywords.json` | Synonymes FR/ES de recherche et dérivés (guacamole → avocat) |
| `src/data/seedMeta.ts` | `SEED_VERSION` à incrémenter quand on remplace le CSV |

**Trois couches, jamais mélangées** (IndexedDB) : `foods` = base d'origine, `foodOverrides` = modifications de l'utilisatrice (par aliment et par champ), `customFoods` = ses propres aliments. La valeur effective d'un champ est sa modification si elle existe, sinon la valeur d'origine.

**Mettre à jour la base** : remplacer le CSV, incrémenter `SEED_VERSION`, rebuild. Au prochain lancement la base d'origine est rechargée ; les modifications et aliments perso ne sont jamais écrasés (si l'origine change pour un champ modifié, la valeur de l'utilisatrice est conservée et la fiche l'indique). Un aliment retiré du CSV n'est supprimé que s'il n'est ni modifié ni utilisé dans un repas.

**Validation à l'import** : colonnes, valeurs autorisées, ids uniques. Une ligne invalide est ignorée, journalisée dans la console et listée dans Réglages › Base d'aliments › Rapport d'import.

**Ajouter des aliments** : depuis l'app (Réglages › Base d'aliments › Ajouter), ou en ajoutant des lignes au CSV (19 colonnes, mêmes valeurs autorisées) puis en incrémentant `SEED_VERSION`.

`inconnu` s'affiche « ? » et n'est **jamais** traité comme « bas » ou « non » (voir `src/domain/effective.ts`).
