# Schéma NOVATECH Developer Playground

Le script novatech-public-demo.sql crée uniquement les tables nécessaires aux comptes de démonstration développeur.

Il ne s'agit pas d'une copie de la base de données UDCShare. Il ne contient aucune donnée client, aucun compte de production, aucune clé API ni aucun token Google.

## Tables

- userdemo : profil de chaque développeur public, lié à auth.users.
- userdemo_api_connections : configurations API par développeur. La clé API est stockée sous forme chiffrée AES-256-GCM (api_key_ciphertext, api_key_iv, api_key_tag).
- userdemo_api_test_runs : historique des appels de test, séparé par propriétaire.

## Isolation

Les trois tables ont RLS activé. Les politiques comparent auth.uid() à id ou userdemo_id. Un développeur ne peut donc lire, modifier ou supprimer les connexions d'un autre.

Le backend utilise le JWT de la session Supabase de l'utilisateur pour accéder à PostgREST. Il ne met pas les clés API des visiteurs dans Render. Render contient uniquement une clé de chiffrement technique (distincte des clés UDCShare) et les paramètres publics de connexion Supabase.

## Stockage

Les fichiers envoyés lors des essais restent dans le Google Drive relié au projet API personnel du développeur. Ces tables ne stockent que les configurations et les journaux, jamais les binaires.
