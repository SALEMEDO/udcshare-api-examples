# NOVATECH DEMO — portail de dépôt et de suivi

Application **entièrement fictive** inspirée d'un portail de réception de justificatifs. Elle sert à montrer comment une entreprise cliente peut intégrer UDCShare dans son propre produit.

> ⚠️ Démonstration publique : n'envoyez aucun vrai reçu, document personnel, numéro de téléphone réel, donnée bancaire ou information client. Utilisez uniquement des valeurs inventées et des fichiers de test.

## Architecture

- `site/` : interface HTML/CSS/JavaScript publiée comme site statique Render.
- `api/` : backend Node.js/Express publié comme Web Service Render.
- Le navigateur appelle uniquement le backend NOVATECH ; il ne reçoit jamais de clé API UDCShare.
- En mode démo par défaut, les fichiers et le registre sont stockés temporairement en mémoire et sont effacés au redémarrage du service.
- Aucun projet, aucune clé et aucune donnée d'un client réel ne sont utilisés.

## Démonstration

- URL portail : https://novatech-demo-portal.onrender.com
- URL API : https://novatech-demo-api.onrender.com
- Santé API : https://novatech-demo-api.onrender.com/health
- Espace équipe : bouton « Espace agents NOVATECH »
- Mot de passe public de démonstration : `NOVATECH-DEMO-2026`

Les identifiants sont volontairement publics et ne doivent jamais être réutilisés en production. L'espace équipe ne contient que des données fictives.

## Mode démo et mode API réel

Par défaut, Render configure `NOVATECH_DEMO_MODE=true`. Ce mode simule l'état du Drive, l'usage API et le stockage ; il n'utilise aucune clé et ne consomme aucun quota réel.

Pour une démonstration connectée à UDCShare Sandbox, utiliser **un projet Sandbox dédié**, distinct de tout projet client ou institutionnel, puis configurer côté serveur uniquement :

| Variable Render | Rôle |
|---|---|
| `NOVATECH_DEMO_MODE` | Passer à `false` pour activer l'API réelle |
| `NOVATECH_PROJECT_READY` | `true` après vérification du projet dédié |
| `UDCSHARE_API_BASE_URL` | `https://udcshare.com/api/v1` |
| `UDCSHARE_API_CLIENT_ID` | Identifiant de la ressource Sandbox NOVATECH |
| `UDCSHARE_API_KEY` | Clé API privée Sandbox NOVATECH — jamais dans Git ni le navigateur |
| `UDCSHARE_EXTERNAL_USER_ID` | `NOVATECH-DEMO-PORTAL` |
| `UDCSHARE_PROJECT_URL` | URL de la page du projet Sandbox |
| `NOVATECH_ALLOWED_ORIGIN` | URL publique du portail statique |
| `NOVATECH_ADMIN_PASSWORD` | Mot de passe de démo (à remplacer pour une instance privée) |
| `NOVATECH_SESSION_SECRET` | Secret aléatoire indépendant, privé |

Ne jamais réutiliser une clé API, un identifiant de ressource, un Drive, un compte Google ou des données appartenant à un autre client. Ne pas intégrer de secret dans `site/config.js`, les fichiers HTML, JavaScript, exemples publics ou captures d'écran.

## Stockage et base de données

Cette démonstration ne crée pas de base SQL. En mode démo, le registre et les fichiers sont temporaires en mémoire. En mode API réel, les binaires sont envoyés dans le Drive associé au projet UDCShare et le registre JSON est conservé comme fichier dans ce même Drive. Aucune preuve n'est envoyée dans Supabase Storage.

## Développement local

```bash
cd api
npm install
NOVATECH_DEMO_MODE=true NOVATECH_ADMIN_PASSWORD=NOVATECH-DEMO-2026 NOVATECH_SESSION_SECRET=change-me npm start
```

Ouvrir ensuite `site/index.html` via un serveur statique et définir `NOVATECH_API_BASE` dans `site/config.js`.

## Licence et réutilisation

Exemple pédagogique à adapter à votre propre entreprise. Voir la licence du dépôt parent.
