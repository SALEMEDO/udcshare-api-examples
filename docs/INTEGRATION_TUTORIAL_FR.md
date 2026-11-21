# Tutoriel — intégrer l'API UDCShare dans son application

Ce guide explique le modèle d'intégration utilisé par les exemples publics. Il ne demande aucune clé réelle et ne publie aucun secret.

## 1. Architecture

```text
Navigateur / application mobile
          |
          | session de VOTRE application
          v
Votre backend (Node, PHP, Python, Java, etc.)
          |
          | HTTPS + X-API-Key + X-External-User-ID
          v
API UDCShare
          |
          +---- métadonnées / autorisations
          |
          +---- Google Drive autorisé pour le projet ou l'utilisateur
                 (les fichiers binaires restent dans Drive)
```

Le navigateur ne reçoit jamais la clé UDCShare. Votre serveur authentifie d'abord l'utilisateur dans votre propre application, puis transmet un identifiant externe opaque et stable à UDCShare.

## 2. Créer et configurer le projet

1. Ouvrez [la Developer Console UDCShare](https://udcshare.com/developers).
2. Créez une organisation et un projet.
3. Choisissez le mode adapté :
   - **API-only** : vos utilisateurs restent authentifiés par votre application ;
   - **OAuth-only** : connexion « Continuer avec UDCShare », sans API fichiers ;
   - **OAuth + API** : les deux parcours, avec identifiants distincts.
4. Activez l'API fichiers si nécessaire et choisissez le modèle Drive entreprise ou Drive individuel.
5. Commencez en Sandbox. Production est soumise au forfait développeur actif et à l'approbation technique du projet.
6. Conservez la clé API uniquement dans les variables secrètes du backend.

## 3. Variables d'environnement

Créez un fichier `.env` local non versionné. Exemple de noms et de valeurs fictives :

```dotenv
UDCSHARE_API_BASE_URL=https://udcshare.com/api
UDCSHARE_API_KEY=REMPLACER_PAR_VOTRE_CLE_SECRETE
UDCSHARE_API_CLIENT_ID=REMPLACER_PAR_API_CLIENT_ID
```

Ajoutez `.env` à `.gitignore`. Pour Render, utilisez Environment > Environment Variables. Pour un autre hébergeur, utilisez son gestionnaire de secrets.

Ne publiez jamais la valeur réelle de `UDCSHARE_API_KEY`. Ne la placez pas dans le JavaScript du navigateur, le dépôt Git, les captures d'écran, les journaux ou une URL.

## 4. Premier appel serveur

Exemple cURL (placeholders uniquement) :

```bash
curl --request GET "$UDCSHARE_API_BASE_URL/v1/usage" \
  --header "X-API-Key: $UDCSHARE_API_KEY"
```

Pour une ressource API fichiers par projet, utilisez le `api_client_id` public et l'identité externe stable :

```bash
curl --request GET "$UDCSHARE_API_BASE_URL/v1/apps/$UDCSHARE_API_CLIENT_ID/status" \
  --header "X-API-Key: $UDCSHARE_API_KEY" \
  --header "X-External-User-ID: user_12345"
```

L'identifiant externe doit être construit côté serveur à partir de l'utilisateur authentifié. N'acceptez pas directement une valeur arbitraire envoyée par le navigateur.

## 5. Upload côté backend (Node.js)

```js
import fs from 'node:fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const form = new FormData();
form.append('file', fs.createReadStream('./document.pdf'));

const response = await fetch(
  `${process.env.UDCSHARE_API_BASE_URL}/v1/apps/${process.env.UDCSHARE_API_CLIENT_ID}/files`,
  {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.UDCSHARE_API_KEY,
      'X-External-User-ID': 'user_12345', // valeur obtenue depuis votre session backend
      ...form.getHeaders()
    },
    body: form
  }
);

const payload = await response.json();
if (!response.ok) {
  throw new Error(payload.error || `UDCShare API error: ${response.status}`);
}
console.log('Fichier accepté :', payload.file?.id);
```

Adaptez le transport multipart et la gestion des flux à votre runtime. Vérifiez toujours le code HTTP et la réponse avant d'afficher un succès.

## 6. Base de données de votre application

Vous n'avez pas besoin de copier la base interne d'UDCShare. Votre application peut conserver ses propres utilisateurs, relations métier, identifiants de fichiers UDCShare et événements webhook. Le dossier [database](../database/README.md) fournit un schéma de référence limité au modèle de ressources API/Drive ; adaptez-le à votre authentification et à vos politiques.

La séparation est la suivante :
- UDCShare conserve les métadonnées et l'isolation des ressources API ;
- Google Drive conserve les fichiers binaires ;
- votre application conserve ses utilisateurs et les références nécessaires à son propre fonctionnement.

## 7. Webhooks et environnements

- Déclarez une URL HTTPS de webhook dans votre projet si vous utilisez les événements.
- Vérifiez la signature côté serveur avec le secret webhook conservé dans l'environnement.
- Enregistrez l'identifiant de livraison pour rendre le traitement idempotent.
- Testez d'abord en Sandbox avec des fichiers non sensibles.
- Séparez les variables Sandbox et Production ; ne copiez pas une clé de développement dans un frontend.
- Respectez les quotas, les délais de reprise et les réponses HTTP 429.

## 8. Dépannage rapide

| Réponse | Vérification |
|---|---|
| 401 | Clé absente, invalide, révoquée ou transmise sous le mauvais en-tête |
| 403 | Scope, forfait, statut du projet, environnement ou identité externe |
| 404 | Identifiant de ressource ou fichier incorrect, ou ressource non accessible |
| 413 | Taille maximale autorisée dépassée |
| 422 | Paramètres ou formulaire multipart invalides |
| 429 | Quota ou limite de débit : ralentir et respecter `Retry-After` |

## 9. Exemples prêts à adapter

- [Exemples API multi-langages](../examples/developer-api/README.md)
- [Exemple utilisateur externe API-only](../examples/api-external-user/README.md)
- [Portail de démonstration NOVATECH](../portals/novatech-demo-portal/README.md)
- [Documentation interactive UDCShare](https://udcshare.com/api/docs)
- [Vitrine publique des exemples](https://udcshare-developer-examples.onrender.com)

**Rappel sécurité :** ce dépôt est public. Il ne doit contenir que du code de démonstration, des variables fictives et des schémas sans données. Les clés, jetons et mots de passe réels restent dans le gestionnaire de secrets de chaque environnement.
