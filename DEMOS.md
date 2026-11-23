# Démonstrations NOVATECH — sources séparées

Chaque démonstration possède son propre dossier indépendant :

- [Démo 1 — Portail client](demos/demo-1-portail-client/)
- [Démo 2 — Playground API](demos/demo-2-playground-api/)

Chaque dossier contient ses sources HTML, JavaScript, CSS, ses ressources et un README. Les démonstrations utilisent le même service API NOVATECH ; aucune clé secrète ne doit être placée dans le navigateur.

## Générer un ZIP par démonstration

Depuis la racine du dépôt, exécuter :

```bash
python3 scripts/package-demos.py
```

Les archives sont créées dans `downloads/` :
- `downloads/demo-1-portail-client.zip`
- `downloads/demo-2-playground-api.zip`

Le script utilise uniquement la bibliothèque standard Python. Après génération et publication des archives, chaque ZIP peut être téléchargé séparément.
