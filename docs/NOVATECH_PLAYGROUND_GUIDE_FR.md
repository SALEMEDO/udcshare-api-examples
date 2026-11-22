# Tutoriel — NOVATECH Developer Playground

## Objectif

NOVATECH est un environnement public d'apprentissage de l'API UDCShare. Chaque développeur crée un compte public distinct, enregistre sa propre configuration API et exécute les essais avec ses propres ressources.

Portail : https://novatech-demo-portal-public.onrender.com

## Parcours d'un développeur

1. Ouvrir le portail et choisir « Créer un compte ».
2. Confirmer son adresse e-mail si Supabase Auth le demande.
3. Se connecter avec son compte.
4. Saisir l'URL HTTPS de son API, l'identifiant de son projet et sa clé API personnelle.
5. Enregistrer la configuration. La clé est immédiatement effacée du formulaire.
6. Lancer les tests « État du projet », « Mes fichiers » et « Consommation API ».
7. Se déconnecter. Après une nouvelle connexion, retrouver les configurations et l'historique du compte.

## Isolation des données

La table userdemo est dédiée aux profils publics NOVATECH. Elle ne crée pas de compte client UDCShare et ne modifie pas public.users ou public.profiles.

Les tables userdemo_api_connections et userdemo_api_test_runs ont une colonne propriétaire userdemo_id. Leurs politiques Row Level Security comparent cette valeur à auth.uid(). Les visiteurs ne peuvent donc pas consulter ou modifier les données des autres comptes.

L'identifiant externe envoyé à l'API est stable par développeur et construit côté serveur à partir de son UUID Supabase. Les appels de deux visiteurs restent ainsi distincts dans le projet API.

## Protection des clés API

La clé saisie par un visiteur n'est jamais une variable Render. Le navigateur la transmet au backend via HTTPS lors de l'enregistrement. Le backend la chiffre avec AES-256-GCM et stocke uniquement le ciphertext, le vecteur d'initialisation et le tag d'authentification.

La clé en clair n'est jamais retournée au navigateur ni écrite dans les journaux. Lors d'un test, le backend déchiffre temporairement la clé du propriétaire, appelle son API et ne conserve que le résultat synthétique du test.

Render contient une clé de chiffrement interne NOVATECH, distincte des clés UDCShare, ainsi que l'URL et la clé publishable Supabase. Ne publiez jamais la clé de chiffrement.

## Configuration technique

Variables du backend Render :

- SUPABASE_URL : URL du projet Supabase.
- SUPABASE_ANON_KEY : clé publishable Supabase.
- NOVATECH_CREDENTIALS_ENCRYPTION_KEY : 32 octets aléatoires en hexadécimal (64 caractères).
- NOVATECH_ALLOWED_ORIGIN : origine exacte du site statique.

Ne configurez pas de clé UDCShare de démonstration dans Render. Ne placez aucune clé API de visiteur dans les variables d'environnement.

Le projet Supabase doit autoriser les inscriptions e-mail dans Auth. Le mode de confirmation e-mail dépend des paramètres Auth du projet. Si la confirmation est activée, l'utilisateur doit confirmer son adresse avant de se connecter.

## Endpoints utilisés pour les tests

- État : GET /api/v1/apps/{projectId}/status
- Fichiers : GET /api/v1/apps/{projectId}/files?limit=10
- Usage : GET /api/v1/usage

Les endpoints et les quotas sont ceux du projet personnel du développeur. Les tests ne sont pas simulés : ils peuvent consommer les quotas et consulter les fichiers de ce projet.

## Script SQL

Le schéma minimal à reproduire est dans database/novatech-public-demo.sql. Il crée seulement les tables NOVATECH, pas la base complète de la plateforme UDCShare. Le script peut être adapté à un autre projet Supabase ; conservez l'isolation par auth.uid() et ne supprimez pas les politiques RLS.

## Architecture de stockage

Les binaires ne sont pas envoyés dans Supabase Storage par NOVATECH. Ils restent dans le Google Drive connecté au projet API personnel. Supabase conserve uniquement le profil développeur, la configuration chiffrée et l'historique des appels.

## Bonnes pratiques de test

- Préférer un projet Sandbox.
- Ne jamais utiliser la clé d'un autre client ou de la production UDCShare.
- Ne pas téléverser de vrais documents personnels.
- Vérifier le projet et le Drive sélectionnés avant de lancer les tests.
- Supprimer les configurations inutilisées depuis son espace personnel.


## Configuration Supabase NOVATECH partagée (mise à jour)

Le Playground NOVATECH utilise désormais le schéma PostgreSQL dédié `developer_test` dans le projet Supabase NOVATECH (`aptsndwskxgzadmkylmm`). Les tables historiques `public.userdemo*` restent conservées et ne sont plus la cible des nouvelles requêtes du Playground.

Variables du backend Render :
- `SUPABASE_URL` : URL du projet Supabase NOVATECH.
- `SUPABASE_ANON_KEY` : clé publishable du projet.
- `SUPABASE_DB_SCHEMA=developer_test`.
- `NOVATECH_CREDENTIALS_ENCRYPTION_KEY` : clé AES-256-GCM dédiée au Playground, 32 octets aléatoires encodés en hexadécimal.
- `NOVATECH_ALLOWED_ORIGIN` : URL exacte du portail NOVATECH public.

Dans Supabase Dashboard → Project Settings → API → Exposed schemas, ajouter `developer_test`. Les accès REST en lecture utilisent `Accept-Profile: developer_test`; les écritures utilisent `Content-Profile: developer_test`. Les endpoints Auth restent sur le même projet. Les fonctions RPC de compteurs et J'aime restent dans leur schéma actuel.

Ne jamais utiliser le projet UDCShare Production ni ses clés, utilisateurs, données ou credentials. Le fichier `.env.example` est un modèle sans secrets ; les valeurs réelles restent dans Render ou dans un gestionnaire de secrets.
