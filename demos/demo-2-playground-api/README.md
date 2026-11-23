# Démo 2 — Playground API NOVATECH

Dossier source indépendant de la démonstration Playground API.

## Structure
- `site/app.html` et `site/app.js` : Playground et parcours de connexion.
- `site/client-portal.html` et `site/client-portal.js` : portail client associé.
- `site/config.js` : adresse publique de l’API NOVATECH.
- `site/engagement.js` : compteurs de vues et de J’aime.
- `site/styles.css`, `site/uix-pro-max.css`, `site/home.css`, `site/novatech-logo.svg` : ressources.
- `site/index.html` et `site/guide.html` : accueil et guide associés.

## Configuration API globale
Le Playground utilise la même configuration API unique que le Portail client et les futures démonstrations. Elle est enregistrée une fois par compte NOVATECH. La clé privée est chiffrée côté serveur et n'est jamais exposée au navigateur.

## Lancement
Servir le dossier `site` avec un serveur HTTP statique ; ne pas ouvrir les pages en `file://`.
