# Guide de contribution — UDCShare API Examples

Merci de contribuer aux exemples backend et aux ressources de démonstration UDCShare.

## Périmètre maintenu

Les exemples d'intégration backend maintenus sont :
- **Node.js** : API relais et intégration serveur.
- **Python** : service de sauvegarde.
- **PHP** : service d'envoi.
- **Go** : client et service de sauvegarde.

Le dépôt contient également le NOVATECH Developer Playground et ses ressources de démonstration.

## Règles de sécurité obligatoires

- La clé API UDCShare doit rester exclusivement côté serveur.
- Aucun exemple HTML, JavaScript navigateur, React, Vue ou Angular ne doit recevoir une clé API secrète.
- Une interface cliente appelle le backend de l'intégrateur, qui authentifie l'utilisateur et transmet la requête à UDCShare.
- Ne jamais committer de clé, jeton, mot de passe ou fichier .env réel.
- Les fichiers .env.example ne contiennent que des valeurs fictives.

## Standards de code

- **Node.js** : async/await, validation des entrées, gestion explicite des erreurs.
- **Python** : PEP 8, annotations de types, gestion explicite des erreurs.
- **PHP** : PSR-12 et PHPDoc.
- **Go** : conventions Go et propagation explicite des erreurs.

## Proposer une contribution

1. Décrire le besoin et le périmètre concerné.
2. Ajouter ou modifier un exemple backend ou une ressource Playground.
3. Documenter les variables d'environnement sans valeur secrète réelle.
4. Mettre à jour le README et le changelog.
5. Effectuer les vérifications locales adaptées.

Pour signaler une vulnérabilité, écrire à security@udcshare.com sans publier de détails exploitables.

Toutes les contributions acceptées restent sous licence MIT.
