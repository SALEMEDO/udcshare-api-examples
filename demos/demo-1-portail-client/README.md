# Démo 1 — Portail client NOVATECH

Dossier source indépendant de la démonstration Portail client.

## Contenu
- `site/client-portal.html` et `site/client-portal.js` : interface du portail client.
- `site/app.html` et `site/app.js` : connexion et espace développeur partagés.
- `site/config.js` : adresse publique de l’API NOVATECH (aucune clé secrète).
- `site/engagement.js` : compteurs de vues et de J’aime.
- `site/styles.css`, `site/uix-pro-max.css`, `site/novatech-logo.svg` : ressources d’interface.
- `site/index.html`, `site/guide.html`, `site/home.css` : accueil et guide associés.

## Configuration API globale
Le portail utilise la configuration API unique du compte NOVATECH connecté. Elle est enregistrée une seule fois dans l'espace développeur et partagée avec le Playground ainsi que les futures démonstrations. La clé reste chiffrée côté serveur ; aucune clé secrète ne doit être placée dans le navigateur.

## Lancer localement
Servir le contenu du dossier `site` avec un serveur HTTP statique. Ne pas ouvrir les pages en `file://`.
