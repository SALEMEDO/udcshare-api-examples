# NOVATECH — Developer Playground public

NOVATECH est un laboratoire public destiné aux développeurs qui souhaitent comprendre et tester l'intégration de l'API UDCShare avec **leurs propres projets, leurs propres clés API et leur propre Google Drive**.

## Guide détaillé

Le tutoriel en français est disponible dans [docs/NOVATECH_PLAYGROUND_GUIDE_FR.md](../../docs/NOVATECH_PLAYGROUND_GUIDE_FR.md). Le schéma SQL isolé est dans [database/novatech-public-demo.sql](../../database/novatech-public-demo.sql). Les tables du Playground sont créées dans le schéma PostgreSQL `developer_test` du projet Supabase NOVATECH partagé.

## Accès public

- Portail : https://novatech-demo-portal-public.onrender.com
- API du Playground : https://novatech-demo-api-public.onrender.com
- Santé du backend : https://novatech-demo-api-public.onrender.com/health
- Code source : https://github.com/SALEMEDO/udcshare-api-examples/tree/main/portals/novatech-demo-portal

Chaque visiteur crée son compte développeur avec son adresse e-mail et son mot de passe. Après connexion, il retrouve ses configurations API et son historique, même après s'être déconnecté puis reconnecté.

## Règle de séparation

Chaque compte NOVATECH est un compte de démonstration public, distinct des comptes clients UDCShare. Les tables `developer_test.userdemo`, `developer_test.userdemo_api_connections` et `developer_test.userdemo_api_test_runs` identifient les développeurs et séparent leurs données. Les anciennes tables `public.userdemo*` sont conservées intactes et ne sont plus ciblées par le Playground.

- Le développeur saisit sa propre adresse API, son identifiant de projet et sa clé API dans son espace privé.
- Le backend utilise cette clé uniquement pour les requêtes du propriétaire de la configuration.
- Les appels transmettent un identifiant externe stable dérivé du compte NOVATECH, afin de séparer les utilisateurs au niveau du projet API.
- Chaque visiteur doit connecter le Google Drive qu'il contrôle dans son propre projet UDCShare. NOVATECH ne prête ni ne partage un Drive central.
- Aucun appel API de visiteur n'utilise une clé API UDCShare de production appartenant à NOVATECH ou à un autre client.

## Protection des clés

**La clé API saisie par un visiteur n'est jamais configurée dans Render.** Elle est envoyée au backend via HTTPS, chiffrée avec AES-256-GCM et stockée sous forme de ciphertext, IV et tag dans userdemo_api_connections. Elle n'est jamais renvoyée au navigateur après enregistrement.

Render conserve uniquement les paramètres techniques du service :
- SUPABASE_URL : URL du projet Supabase NOVATECH partagé.
- SUPABASE_ANON_KEY : clé publishable Supabase (non secrète).
- SUPABASE_DB_SCHEMA : `developer_test` (schéma PostgreSQL dédié au Playground).
- NOVATECH_CREDENTIALS_ENCRYPTION_KEY : clé de chiffrement interne de 32 octets encodée en hexadécimal. Ce n'est **pas** une clé API UDCShare.
- NOVATECH_ALLOWED_ORIGIN : origine exacte du portail public.

Ne jamais committer ces secrets internes dans GitHub. La clé de chiffrement ne doit jamais être partagée ni utilisée comme clé API. Ne configurez pas UDCSHARE_API_KEY, UDCSHARE_API_CLIENT_ID ou un Drive de démonstration partagé dans Render.

## Base de données

Le script database/novatech-public-demo.sql contient uniquement les trois tables nécessaires au Playground et leurs règles RLS. Il ne contient aucune donnée, clé, token ou table de la plateforme UDCShare complète.

- userdemo : profil public relié à auth.users.
- userdemo_api_connections : configurations personnelles et clé API chiffrée.
- userdemo_api_test_runs : journal des tests, sans clé ni réponse sensible complète.

Les politiques RLS imposent auth.uid() = userdemo_id (ou id pour userdemo). Les clés ne doivent jamais être enregistrées en clair. Les fichiers binaires restent dans le Google Drive du projet API de chaque développeur ; aucun fichier n'est stocké dans Supabase Storage par ce Playground.

## Démonstrations présentes

1. État du projet : GET /apps/{projectId}/status.
2. Fichiers du projet : GET /apps/{projectId}/files?limit=10.
3. Consommation : GET /usage.

Les requêtes sont exécutées côté serveur avec la clé personnelle du visiteur. Les erreurs sont journalisées dans son historique, sans stocker sa clé.

## Sécurité

Le backend exige HTTPS, refuse les adresses locales/privées et bloque les redirections automatiques afin de réduire les risques SSRF. Les appels ont un délai maximal et une limite de taille de réponse. Les quotas consommés par les appels de démonstration appartiennent au projet du développeur.

## Configuration Render

Le backend Render doit recevoir les variables techniques listées dans « Protection des clés ». Dans Supabase Dashboard → API Settings, ajouter `developer_test` à « Exposed schemas » ; le backend envoie `Accept-Profile` pour les lectures et `Content-Profile` pour les écritures. Les fonctions RPC publiques d'engagement restent dans leur schéma actuel. Générer NOVATECH_CREDENTIALS_ENCRYPTION_KEY comme 32 octets aléatoires encodés en hexadécimal (64 caractères). Cette clé de chiffrement n'est jamais la clé API du visiteur.

Pour activer la création de comptes, vérifier dans Supabase Auth que les inscriptions e-mail sont autorisées et que la confirmation e-mail est configurée selon la politique de l'organisation. Si la confirmation est obligatoire, l'utilisateur confirme son adresse avant sa première connexion.

## Avertissement

Utilisez un projet Sandbox ou un projet dont vous êtes propriétaire, des fichiers fictifs et des données de test. Les appels réalisés sur une API réelle peuvent consommer des quotas et agir sur les fichiers de votre propre projet. NOVATECH ne garantit pas les ressources des API tierces.


## Démonstrations publiques NOVATECH

- Démo 1 — Portail client : https://novatech-demo-portal-public.onrender.com/client-portal.html
- Démo 2 — Playground API : https://novatech-demo-portal-public.onrender.com/app.html

Le portail client est une vraie intégration des routes UDCShare documentées : `GET /account`, `GET /files`, `POST /upload`, `DELETE /files/:id` et `GET /stats`. Il réutilise une configuration API appartenant au compte NOVATECH connecté. La clé API est déchiffrée uniquement côté serveur au moment de l'appel et n'est jamais envoyée au navigateur. Cette démonstration limite les uploads à 50 Mo par fichier pour maîtriser la mémoire du service.

### Vues et J'aime publics

Chaque démonstration affiche ses vues et ses J'aime. Une vue est comptée une seule fois par navigateur et par journée UTC pour chaque démo ; aucun compte n'est requis pour consulter. Un identifiant aléatoire conservé dans le navigateur est haché côté serveur ; aucune adresse IP ni adresse e-mail n'est enregistrée pour les vues.

Un J'aime exige un compte NOVATECH connecté. La contrainte unique en base empêche un même compte d'aimer plusieurs fois la même démo ; l'utilisateur peut retirer son J'aime. Les tables d'engagement résident dans le schéma privé Supabase et ne sont pas accessibles directement via la Data API. Le schéma SQL est documenté dans [database/novatech-demo-engagement.sql](../../database/novatech-demo-engagement.sql).

Les compteurs publics sont servis par le backend NOVATECH via des fonctions SQL limitées à deux identifiants de démonstration connus. Les actions J'aime sont autorisées uniquement aux sessions authentifiées.
