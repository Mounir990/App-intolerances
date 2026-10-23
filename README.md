# Diario de síntomas · Journal de symptômes

PWA bilingue (es/fr) de suivi de symptômes et d'intolérances, **100 % locale et hors ligne** (IndexedDB, aucune donnée ne quitte l'appareil). Installable sur Android via Chrome.

> Phase 1 en cours de construction — README complet à l'étape 6.

## Démarrage

```bash
npm install
npm run dev        # développement
npm run build      # build de production (génère le service worker)
npm run preview    # sert le build (nécessaire pour tester l'installation PWA)
npm test           # tests unitaires
npm run icons      # régénère les icônes PWA
```

Le service worker n'existe que dans le build : pour tester l'installation et le hors-ligne, utiliser `npm run build && npm run preview`.
