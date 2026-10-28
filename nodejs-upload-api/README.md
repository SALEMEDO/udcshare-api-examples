# 🟢 UDCShare Upload API - Node.js

API middleware professionnelle pour gérer les uploads via UDCShare dans votre application web.

## 🎯 Cas d'usage

API REST middleware pour applications web qui veulent :
- Déléguer les uploads à UDCShare
- Gérer les quotas utilisateurs
- Traiter les fichiers de manière asynchrone
- Intégrer facilement dans votre architecture existante

## 🏗️ Architecture

```
nodejs-upload-api/
├── src/
│   ├── controllers/
│   │   └── uploadController.js   # Logique de gestion des uploads
│   ├── middleware/
│   │   ├── authMiddleware.js      # Authentification JWT
│   │   ├── rateLimiter.js         # Rate limiting par utilisateur
│   │   └── errorHandler.js        # Gestion centralisée des erreurs
│   ├── models/
│   │   └── File.js                 # Schéma MongoDB pour les fichiers
│   ├── services/
│   │   └── udcshareService.js     # Service UDCShare API
│   ├── routes/
│   │   └── uploadRoutes.js        # Routes API
│   ├── config/
│   │   └── database.js            # Configuration MongoDB
│   └── app.js                      # Application Express
├── tests/
│   └── upload.test.js             # Tests unitaires
├── .env.example                   # Exemple de configuration
├── package.json                   # Dépendances
└── README.md                      # Ce fichier
```

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Copier la configuration
cp .env.example .env
# Editez .env avec vos clés API
```

## ⚙️ Configuration

```env
# UDCShare API
UDCSHARE_API_KEY=votre_clé_api_udcshare
UDCSHARE_API_URL=https://udcshare.com/api/v1

# Application
PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/udcshare_uploads
# Ou MongoDB Atlas: mongodb+srv://...
```

## 💻 Utilisation

### Démarrer le serveur

```bash
# Mode développement
npm run dev

# Mode production
npm start
```

### Endpoints API

Ce service expose ses propres endpoints et appelle UDCShare pour vous. Votre clé API
UDCShare reste côté serveur, dans `UDCSHARE_API_KEY` (voir `.env.example`) : elle n'est
jamais transmise par le client.

> ⚠️ Ces endpoints de démonstration n'ont **aucune authentification**. Ajoutez la vôtre
> (session, JWT, clé interne) avant de déployer ce service ailleurs qu'en local, sinon
> n'importe qui peut consommer votre quota UDCShare.

```bash
# Envoyer un fichier
POST /api/upload
Content-Type: multipart/form-data

curl -X POST http://localhost:3001/api/upload \
  -F "file=@document.pdf"

# Lister les fichiers envoyés
GET /api/files

curl -X GET http://localhost:3001/api/files

# Supprimer un fichier
DELETE /api/files/:id

curl -X DELETE http://localhost:3001/api/files/file_id

# Statistiques d'utilisation
GET /api/stats

curl -X GET http://localhost:3001/api/stats
```

## 🎯 Fonctionnalités

### ✅ Features principales

1. **Upload streaming** pour les gros fichiers
2. **Rate limiting** par utilisateur
3. **Authentification JWT** sécurisée
4. **Base de données MongoDB** pour traçabilité
5. **Webhooks** pour notifications d'upload
6. **Compression** automatique optionnelle
7. **Gestion des erreurs** robuste
8. **Tests unitaires** complets

### 📊 Monitoring & Analytics

- Métriques d'upload en temps réel
- Statistiques par utilisateur
- Monitoring des erreurs
- Alertes automatiques

### 🔒 Sécurité

- Validation de fichiers
- Scan antivirus (intégrable)
- Rate limiting configuré
- Authentification JWT
- CORS configuré
- Sanitization des inputs

## 🎓 Exemples d'utilisation

### Intégration dans Express existant

```javascript
const udcshareUpload = require('./src/udcshareService');

// Dans vos routes existantes
app.post('/upload', authMiddleware, async (req, res) => {
  try {
    const result = await udcshareUpload(req.file);
    res.json({
      success: true,
      file_id: result.file_id,
      file_url: result.file_url
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Upload avec métadonnées personnalisées

```javascript
const metadata = {
  userId: req.user.id,
  category: 'invoice',
  clientId: req.body.clientId
};

const result = await udcshareUpload(req.file, metadata);
```

### Upload multiple avec parallel processing

```javascript
const files = req.files;
const uploads = files.map(file => udcshareUpload(file));

const results = await Promise.allSettled(uploads);
```

## 🔧 Personnalisation

### Adapter pour votre base de données

Le système utilise Mongoose avec MongoDB mais peut être adapté pour :
- PostgreSQL avec Sequelize
- MySQL avec Knex
- SQL Server avec MSSQL

### Ajouter votre propre logique métier

```javascript
// Dans uploadController.js
async function customValidation(file, user) {
  // Votre logique de validation personnalisée
  return isValid;
}
```

### Webhooks personnalisés

```javascript
// Dans udcshareService.js
function onUploadSuccess(file, metadata) {
  // Envoyer notification à votre système
  sendWebhook({
    type: 'upload.success',
    file: file,
    metadata: metadata
  });
}
```

## 📈 Performance

- **Upload streaming** : utilise `multer` pour gérer les gros fichiers
- **Compression** : gzip automatique pour réduire la taille
- **Caching** : Redis pour les métadonnées (optionnel)
- **Queue** : Bull pour les uploads en arrière-plan (optionnel)

## 🧪 Tests

```bash
# Lancer les tests
npm test

# Tests avec coverage
npm test:coverage
```

## 🐛 Gestion des erreurs

Le système gère automatiquement :
- Erreurs réseau (retry automatique)
- Erreurs UDCShare API (codes HTTP)
- Erreurs de validation
- Erreurs de base de données
- Erreurs de système de fichiers

## 📝 Base de données

Le système utilise MongoDB pour stocker :
- Métadonnées des fichiers uploadés
- Mapping entre fichiers locaux et UDCShare
- Statistiques d'utilisation
- Logs d'erreurs

**Note:** La base de données est **votre propre base de données**, pas celle de UDCShare.

## 🔌 Intégration

### Avec votre application existante

Le middleware peut être intégré dans :
- Express.js (exemple fourni)
- NestJS
- Koa.js
- Hapi.js
- Fastify

### Microservice architecture

Le service peut fonctionner comme :
- Microservice indépendant
- Fonction serverless (AWS Lambda, Vercel, etc.)
- Docker container

## 🚨 Limitations

- Dépendance à une connexion internet
- Respect des limites de votre plan UDCShare
- MongoDB requis (ou adapter pour une autre BD)

## 🤝 Contribution

Ce projet est open source. N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Soumettre des pull requests

## 📄 License

MIT License - Utilisez librement dans vos projets commerciaux.

---

**Support:** support@udcshare.com
**Documentation:** https://udcshare.com/api
