# Démo 1 — Portail client NOVATECH

Dossier autonome de la démonstration du portail client.

## Contenu
- `site/client-portal.html` et `site/client-portal.js` : interface du portail.
- `site/app.html` et `site/app.js` : connexion et espace de démonstration requis par le parcours.
- `site/config.js` : adresse publique de l’API NOVATECH (aucune clé secrète).
- `site/engagement.js` : vues et J’aime.
- `site/styles.css`, `site/uix-pro-max.css`, `site/novatech-logo.svg` : ressources d’interface.
- `site/index.html`, `site/guide.html`, `site/home.css` : accueil et guide associés.

## API commune
Cette démonstration utilise l’API NOVATECH partagée :
`https://api-novatech-test.udcshare.com`.
Aucune clé secrète ne doit être placée dans le navigateur. Les identifiants utilisateurs sont gérés côté serveur par l’API.

## Lancer localement
Servir le contenu du dossier `site` avec un serveur HTTP statique. Ne pas ouvrir les pages en `file://`.
