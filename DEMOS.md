# Démonstrations NOVATECH — sources séparées

Chaque démonstration possède son propre dossier et ses propres sources :

- [Démo 1 — Portail client](demos/demo-1-portail-client/)
- [Démo 2 — Playground API](demos/demo-2-playground-api/)

Les dossiers restent indépendants pour la consultation et le téléchargement. Ils utilisent tous la même API NOVATECH et la configuration API globale du compte connecté : adresse API, `api_client_id` et clé privée chiffrée côté serveur. Il n'y a pas de configuration à enregistrer pour chaque démonstration.

La configuration globale se modifie depuis l'espace NOVATECH. Lors d'une mise à jour, laisser le champ de clé vide conserve la clé déjà chiffrée ; saisir une nouvelle clé la remplace. Les historiques de tests sont conservés.

## Générer un ZIP par démonstration

Depuis la racine du dépôt :

```bash
python3 scripts/package-demos.py
```

Les archives sont créées dans `downloads/` :
- `downloads/demo-1-portail-client.zip`
- `downloads/demo-2-playground-api.zip`

Le script utilise uniquement la bibliothèque standard Python. Les archives doivent être générées et publiées pour devenir téléchargeables depuis le site.
