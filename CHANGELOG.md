# Changelog — exemples API UDCShare

## 2026-11-23 — Nettoyage et sécurisation

### Conservé
- Node.js : API relais côté serveur.
- Python : système de sauvegarde côté serveur.
- PHP : service d'envoi côté serveur.
- Go : client et service de sauvegarde côté serveur.
- NOVATECH Developer Playground et ses ressources de démonstration.

### Retiré
- Ancien client JavaScript destiné à être exécuté dans le navigateur.
- Anciennes instructions d'intégration directe dans HTML, React, Vue et autres interfaces clientes.
- Ancien dossier Ruby incomplet, sans implémentation fonctionnelle.
- Documentation et résumés qui présentaient ces éléments comme disponibles.

### Sécurité
Une clé API UDCShare est un secret serveur. Les interfaces web, mobiles et frameworks frontend doivent appeler le backend de l'intégrateur. Ne jamais placer la clé dans le navigateur, une variable publique, le stockage local ou un dépôt Git.

## Versioning

- Major : changements incompatibles.
- Minor : nouvelles fonctionnalités compatibles.
- Patch : corrections compatibles.
