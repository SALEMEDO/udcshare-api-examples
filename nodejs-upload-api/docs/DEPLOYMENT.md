# Guide de Déploiement - Node.js Upload API

Ce guide couvre le déploiement de l'API middleware Node.js UDCShare dans différents environnements.

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Déploiement Local](#déploiement-local)
- [Déploiement Docker](#déploiement-docker)
- [Déploiement Cloud](#déploiement-cloud)
- [Déploiement Kubernetes](#déploiement-kubernetes)
- [Performance](#performance)
- [Sécurité](#sécurité)

---

## Prérequis

### Outils requis

- Node.js 16+
- npm ou yarn
- Git
- MongoDB (local ou Atlas)

### Variables d'environnement

```bash
UDCSHARE_API_KEY=votre_clé_api_udcshare
UDCSHARE_API_URL=https://udcshare.com/api/v1
MONGODB_URI=mongodb://localhost:27017/udcshare_uploads
PORT=3001
NODE_ENV=production
JWT_SECRET=votre_secret_jwt
```

---

## Déploiement Local

### 1. Cloner le projet

```bash
git clone https://github.com/udcshare-official/udcshare-api-examples.git
cd udcshare-api-examples/nodejs-upload-api
```

### 2. Installer les dépendances

```bash
npm install
# ou
yarn install
```

### 3. Configurer

```bash
cp .env.example .env
# Éditez .env avec votre configuration
```

### 4. Lancer en développement

```bash
npm run dev
```

### 5. Lancer en production

```bash
npm start
```

### 6. Déployer en production

#### Utilisation de PM2

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer avec PM2
pm2 start src/app.js --name udcshare-api

# Configurer pour démarrage au boot
pm2 startup
pm2 save

# Monitoring
pm2 monit

# Logs
pm2 logs udcshare-api

# Restart
pm2 restart udcshare-api
```

#### Configuration PM2 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'udcshare-api',
    script: './src/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M'
  }]
};
```

```bash
pm2 start ecosystem.config.js --env production
```

---

## Déploiement Docker

### 1. Créer le Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/app.js"]
```

### 2. Créer docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    container_name: udcshare-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - UDCSHARE_API_KEY=${UDCSHARE_API_KEY}
      - UDCSHARE_API_URL=${UDCSHARE_API_URL}
      - MONGODB_URI=mongodb://mongodb:27017/udcshare_uploads
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3001
    depends_on:
      - mongodb
    networks:
      - udcshare-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mongodb:
    image: mongo:6
    container_name: udcshare-mongodb
    restart: unless-stopped
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    networks:
      - udcshare-network

networks:
  udcshare-network:
    driver: bridge

volumes:
  mongodb_data:
```

### 3. Construire et lancer

```bash
# Build
docker-compose build

# Lancer
docker-compose up -d

# Logs
docker-compose logs -f api

# Arrêter
docker-compose down
```

---

## Déploiement Cloud

### Heroku

#### 1. Préparer l'application

```json
// package.json - ajouter scripts
{
  "scripts": {
    "start": "node src/app.js",
    "heroku-postbuild": "npm install"
  }
}
```

#### 2. Créer Procfile

```
web: node src/app.js
```

#### 3. Déployer

```bash
# Login Heroku
heroku login

# Créer l'app
heroku create udcshare-api

# Ajouter add-ons
heroku addons:create mongolab:sandbox

# Définir les variables d'environnement
heroku config:set UDCSHARE_API_KEY=your_key
heroku config:set UDCSHARE_API_URL=https://udcshare.com/api/v1
heroku config:set JWT_SECRET=your_secret

# Déployer
git push heroku main

# Ouvrir l'app
heroku open
```

### Vercel

#### 1. Préparer pour Serverless

```javascript
// api/index.js
module.exports = require('./src/app.js');
```

#### 2. Configuration Vercel

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "src/app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/src/app.js"
    }
  ],
  "env": {
    "UDCSHARE_API_KEY": "@udcshare_api_key",
    "UDCSHARE_API_URL": "@udcshare_api_url",
    "JWT_SECRET": "@jwt_secret"
  }
}
```

#### 3. Déployer

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### AWS (Elastic Beanstalk)

#### 1. Préparer

```json
// package.json
{
  "scripts": {
    "start": "node src/app.js",
    "postinstall": "npm install --production"
  }
}
```

#### 2. Configuration EB

```yaml
# .ebextensions/nodecommand.config
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
    NodeVersion: "18.16.0"
```

#### 3. Déployer

```bash
eb init -p nodejs udcshare-api
eb create production-env
eb deploy
```

---

## Déploiement Kubernetes

### 1. Créer le Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: udcshare-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: udcshare-api
  template:
    metadata:
      labels:
        app: udcshare-api
    spec:
      containers:
      - name: api
        image: your-registry/udcshare-api:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: UDCSHARE_API_KEY
          valueFrom:
            secretKeyRef:
              name: udcshare-secrets
              key: api-key
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: udcshare-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. Créer le Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: udcshare-secrets
type: Opaque
stringData:
  api-key: "votre_clé_api_udcshare"
  mongodb-uri: "mongodb://mongodb:27017/udcshare_uploads"
  jwt-secret: "votre_secret_jwt"
```

### 3. Créer le Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: udcshare-api
spec:
  selector:
    app: udcshare-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

### 4. Déployer

```bash
kubectl apply -f secret.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Vérifier
kubectl get pods
kubectl logs -f deployment/udcshare-api
```

---

## Performance

### Compression avec gzip

```javascript
// src/app.js
const compression = require('compression');

app.use(compression({
  level: 6,
  threshold: 10 * 1024 // 10KB
}));
```

### Caching avec Redis

```javascript
// services/redis.js
const redis = require('redis');
const client = redis.createClient();

async function cacheFile(fileId, data) {
  await client.setex(`file:${fileId}`, 3600, JSON.stringify(data));
}

async function getCachedFile(fileId) {
  const data = await client.get(`file:${fileId}`);
  return data ? JSON.parse(data) : null;
}
```

### Rate limiting avancé

```javascript
// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite par IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: redisClient
  })
});

app.use('/api/', apiLimiter);
```

---

## Sécurité

### Helmet pour les headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### CORS sécurisé

```javascript
const cors = require('cors');

app.use(cors({
  origin: ['https://yourdomain.com'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

### Validation des entrées

```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/upload',
  body('file').custom((value, { req }) => {
    if (!req.file) {
      throw new Error('File is required');
    }
    return true;
  }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ...
  }
);
```

---

## Dépannage

### Problèmes courants

#### Erreur: "MongoDB connection failed"

**Solution:** Vérifiez que MongoDB est accessible et que MONGODB_URI est correct.

#### Erreur: "Clé API requise"

**Solution:** Assurez-vous que UDCSHARE_API_KEY est défini dans .env ou les variables d'environnement.

#### Erreur: "Port already in use"

**Solution:** Changez le PORT dans .env ou arrêtez le processus utilisant le port 3001.

```bash
# Linux/Mac
lsof -i :3001
kill -9 <PID>

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

**Support:** support@udcshare.com
