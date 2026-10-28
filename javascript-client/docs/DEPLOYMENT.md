# Guide de Déploiement - JavaScript Client

Ce guide couvre le déploiement du client JavaScript UDCShare dans différents environnements.

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Déploiement Simple (HTML)](#déploiement-simple-html)
- [Déploiement avec CDN](#déploiement-avec-cdn)
- [Déploiement avec NPM](#déploiement-avec-npm)
- [Optimisation](#optimisation)
- [Compatibilité](#compatibilité)

---

## Prérequis

### Aucun prérequis technique

Le client JavaScript est vanilla JS et ne nécessite :
- ❌ Aucun framework
- ❌ Aucun build process
- ❌ Aucun transpilation
- ✅ Un navigateur moderne

---

## Déploiement Simple (HTML)

### 1. Copier le fichier JavaScript

```bash
# Copiez le fichier udcshare.js dans votre projet
cp udcshare.js /path/to/your-project/js/
```

### 2. Inclure dans votre HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Upload UDCShare</title>
  <script src="js/udcshare.js"></script>
</head>
<body>
  <input type="file" id="fileInput">
  <button onclick="uploadFile()">Uploader</button>

  <script>
    const udcshare = new UDCShareClient('votre_clé_api_udcshare');

    async function uploadFile() {
      const file = document.getElementById('fileInput').files[0];
      const result = await udcshare.uploadFile(file);
      console.log('Upload réussi:', result);
    }
  </script>
</body>
</html>
```

### 3. Déployer sur votre serveur

```bash
# Upload via FTP/SFTP
# Ou utiliser git, rsync, etc.

# Exemple avec rsync
rsync -avz /path/to/your-project/ user@server:/var/www/html/
```

---

## Déploiement avec CDN

### 1. Héberger sur CDN

```bash
# Upload sur CDN (Cloudflare, AWS CloudFront, etc.)
# URL: https://cdn.yourdomain.com/udcshare.js
```

### 2. Inclure depuis le CDN

```html
<script src="https://cdn.yourdomain.com/udcshare.js"></script>

<script>
  const udcshare = new UDCShareClient('votre_clé_api');
  // Utilisation...
</script>
```

---

## Déploiement avec NPM

### 1. Publier sur NPM

```bash
# Se connecter à NPM
npm login

# Dans package.json
{
  "name": "@udcshare/javascript-client",
  "version": "1.0.0",
  "main": "udcshare.js",
  "types": "udcshare.d.ts"
}

# Publier
npm publish --access public
```

### 2. Installer dans votre projet

```bash
npm install @udcshare/javascript-client
```

### 3. Utiliser avec bundler (Webpack, Vite, Rollup)

```javascript
import UDCShareClient from '@udcshare/javascript-client';

const udcshare = new UDCShareClient('votre_clé_api');
```

---

## Optimisation

### Minification

#### 1. Minifier avec terser

```bash
npm install -g terser

terser udcshare.js -c -m -o udcshare.min.js
```

#### 2. Utiliser le fichier minifié

```html
<script src="js/udcshare.min.js"></script>
```

### Version avec Tree-shaking

```javascript
// Si vous utilisez ES6 modules
export { UDCShareClient } from './udcshare.js';

// Les bundlers modernes (Webpack, Rollup) feront le tree-shaking automatiquement
```

### Lazy loading

```javascript
// Charger seulement quand nécessaire
async function uploadFile(file) {
  const { UDCShareClient } = await import('./udcshare.js');
  const udcshare = new UDCShareClient('votre_clé_api');
  return await udcshare.uploadFile(file);
}
```

---

## Intégration Framework

### Next.js

```javascript
// pages/api/upload.js
import UDCShareClient from '@udcshare/javascript-client';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const udcshare = new UDCShareClient(process.env.UDCSHARE_API_KEY);
    const file = req.body.file;
    
    try {
      const result = await udcshare.uploadFile(file);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

### Gatsby

```javascript
// src/components/Upload.js
import React, { useState } from 'react';
import UDCShareClient from '@udcshare/javascript-client';

export default function Upload() {
  const [result, setResult] = useState(null);

  const handleUpload = async (file) => {
    const udcshare = new UDCShareClient(process.env.GATSBY_UDCSHARE_API_KEY);
    const uploadResult = await udcshare.uploadFile(file);
    setResult(uploadResult);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {result && <p>Upload réussi: {result.file_url}</p>}
    </div>
  );
}
```

### SvelteKit

```javascript
// src/lib/udcshare.js
import UDCShareClient from '@udcshare/javascript-client';

export const udcshare = new UDCShareClient(import.meta.env.VITE_UDCSHARE_API_KEY);
```

---

## Performance

### Caching

```javascript
// Utiliser localStorage pour cacher les réponses
const cacheKey = 'udcshare_files';
const cacheDuration = 5 * 60 * 1000; // 5 minutes

async function getFilesWithCache() {
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < cacheDuration) {
      return data;
    }
  }

  const data = await udcshare.listFiles();
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  return data;
}
```

### Web Workers

```javascript
// worker.js
self.importScripts('udcshare.js');

self.onmessage = async (e) => {
  const udcshare = new UDCShareClient(e.data.apiKey);
  const result = await udcshare.uploadFile(e.data.file);
  self.postMessage(result);
};

// main.js
const worker = new Worker('worker.js');
worker.postMessage({
  apiKey: 'votre_clé_api',
  file: fileToUpload
});
worker.onmessage = (e) => {
  console.log('Upload terminé:', e.data);
};
```

---

## Sécurité

### Protection XSS

```javascript
// Sanitize les inputs avant upload
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

const file = new File([fileBlob], sanitizeFileName(file.name));
```

### Validation côté client

```javascript
function validateFile(file) {
  const maxSize = 25 * 1024 * 1024 * 1024; // 25GB
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  
  if (file.size > maxSize) {
    throw new Error('Fichier trop grand');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Type de fichier non autorisé');
  }
  
  return true;
}
```

---

## Compatibilité

### Polyfills pour vieux navigateurs

```html
<!-- Pour IE 11 et vieux navigateurs -->
<script src="https://cdn.polyfill.io/v3/polyfill.min.js?features=fetch,Promise"></script>
<script src="udcshare.js"></script>
```

### Test de compatibilité

```javascript
// Vérifier si l'API est supportée
if (typeof fetch !== 'undefined' && typeof FormData !== 'undefined') {
  // OK, utiliser le client
} else {
  // Fallback ou message d'erreur
  console.error('Navigateur non supporté');
}
```

---

## Monitoring

### Analytics simple

```javascript
// Intégration Google Analytics (optionnel)
function trackUpload(success, fileSize, duration) {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'upload', {
      'event_category': 'UDCShare',
      'event_label': success ? 'success' : 'error',
      'value': fileSize,
      'custom_map': { 'metric_upload_duration': duration }
    });
  }
}

// Utiliser pendant l'upload
const startTime = performance.now();
const result = await udcshare.uploadFile(file);
const duration = performance.now() - startTime;
trackUpload(true, file.size, duration);
```

---

## Dépannage

### Problèmes courants

#### Erreur CORS

**Solution:** Assurez-vous que votre serveur a le CORS configuré correctement.

```javascript
// Côté serveur (Node.js Express)
app.use(cors({
  origin: 'https://yourdomain.com',
  methods: ['GET', 'POST', 'DELETE']
}));
```

#### Erreur "Network Error"

**Solution:** Vérifiez que l'URL de l'API est accessible et que vous avez une connexion internet.

#### Erreur "Clé API requise"

**Solution:** Assurez-vous que la clé API est passée correctement au constructeur.

---

**Support:** support@udcshare.com
