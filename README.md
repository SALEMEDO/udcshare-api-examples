# UDCShare API Examples

> Projets exemples professionnels pour intégrer l'API UDCShare

**Authentification** : toutes les requêtes portent la clé API dans l'en-tête `X-API-Key`
(et non `Authorization: Bearer`). Obtenez une clé sur
[Tableau de bord → Développeur](https://udcshare.com/dashboard?tab=developer).
Documentation interactive : <https://udcshare.com/api/docs>

**État des exemples** — 7 exemples contiennent du code utilisable :
client JavaScript, React, Vue, Node.js, Python, PHP et Go.
Les dossiers **Ruby** et **Angular** ne contiennent pour l'instant que leur documentation
et leur manifeste, sans code source : les sections correspondantes ci-dessous décrivent
l'intention, pas un code livré.

---

## 📋 Table des matières

- [Introduction](#introduction)
- [Projets disponibles](#projets-disponibles)
- [Installation rapide](#installation-rapide)
- [Architecture](#architecture)
- [Support](#support)

---

## Introduction

Cette collection de projets exemples montre comment intégrer l'API REST UDCShare dans différents langages et frameworks, comme le font les grandes entreprises tech (Stripe, Twilio, SendGrid, etc.).

### 🎯 Objectif

Fournir des exemples **concrets** et **immédiatement utilisables** pour :
- Démarrer rapidement avec l'API UDCShare
- Comprendre les bonnes pratiques de l'intégration
- Résoudre des cas d'usage réels
- Gérer les limites selon les plans

### 🔒 Prérequis

- Une clé API UDCShare (plan Essentials, Pro ou Business)
- Connaissance de base du langage choisi
- Compréhension des APIs REST

---

## Projets disponibles

### 🐍 Python: Système de Backup Automatisé

Un système professionnel de backup d'entreprise avec monitoring, retry logic et base de données locale.

**Fonctionnalités :**
- ✅ Backup automatique selon schedule
- ✅ Retry intelligent avec exponential backoff
- ✅ Base de données SQLite pour traçabilité
- ✅ Monitoring et alertes automatiques
- ✅ Respect des limites API selon les plans
- ✅ Logs structurés pour debugging

**Stack technique :**
- Python 3.8+
- SQLite
- Requests (HTTP client)
- Tenacity (retry logic)
- Schedule (task scheduling)

**Cas d'usage :**
- Backup nocturne de documents importants
- Archivage automatique de factures
- Sauvegarde de configuration système

[📁 Documentation complète →](./python-backup-system/README.md)

---

### 🟢 Node.js: Upload API Middleware

API middleware Express pour gérer les uploads UDCShare dans votre application web.

**Fonctionnalités :**
- ✅ Upload streaming pour gros fichiers
- ✅ Rate limiting par utilisateur
- ✅ Authentification JWT sécurisée
- ✅ Base de données MongoDB pour traçabilité
- ✅ Gestion centralisée des erreurs
- ✅ Tests unitaires complets

**Stack technique :**
- Node.js 16+
- Express.js
- MongoDB + Mongoose
- Axios
- Multer (file upload)
- Winston (logging)

**Cas d'usage :**
- Middleware pour application web existante
- SaaS avec gestion d'uploads
- Platform multi-tenant
- Application mobile avec backend Node.js

[📁 Documentation complète →](./nodejs-upload-api/README.md)

---

### 💻 JavaScript: Client Frontend

Client JavaScript vanilla pour intégration directe dans les pages web.

**Fonctionnalités :**
- ✅ Upload avec progression en temps réel
- ✅ Drag & drop natif
- ✅ Gestion automatique des erreurs
- ✅ Aucune dépendance externe (vanilla JS)
- ✅ Compatible tous navigateurs modernes
- ✅ Widget d'upload réutilisable

**Stack technique :**
- Vanilla JavaScript (ES6+)
- Fetch API
- FormData API
- Drag & Drop API

**Cas d'usage :**
- Intégration directe dans pages web
- CMS et sites statiques
- Applications SPA (React, Vue, Angular)
- Uploads utilisateurs front-end

[📁 Documentation complète →](./javascript-client/README.md)

---

### 🐘 PHP: Upload Service

Service PHP professionnel pour intégrer l'API UDCShare dans vos applications.

**Fonctionnalités :**
- ✅ Intégration Laravel et Symfony
- ✅ Upload avec progression
- ✅ Retry automatique
- ✅ Gestion des erreurs robuste
- ✅ Compatible PHP 8+

**Stack technique :**
- PHP 8.0+
- Composer
- Guzzle (HTTP client)
- PHPUnit (tests)

**Cas d'usage :**
- Application Laravel/Symfony
- CMS PHP (WordPress, Drupal)
- Scripts PHP automatisés

[📁 Documentation complète →](./php-upload-service/README.md)

---

### 🐹 Go: Backup Service

Service Go performant pour backup automatisé avec l'API UDCShare.

**Fonctionnalités :**
- ✅ Concurrence native avec goroutines
- ✅ Type safety
- ✅ Context aware
- ✅ Docker et Kubernetes ready
- ✅ Monitoring Prometheus intégré

**Stack technique :**
- Go 1.21+
- http.Client
- Context packages
- Prometheus (monitoring)

**Cas d'usage :**
- Système de fichiers distribué
- Microservice Go
- Applications cloud-native

[📁 Documentation complète →](./go-backup-service/README.md)

---

### 💎 Ruby: Upload Gem — PAS ENCORE DISPONIBLE

> Ce dossier ne contient que ce README, le `.gemspec` et `.env.example`.
> Le code de la gem reste à écrire : la description ci-dessous est l'intention visée.

Gem Ruby professionnelle pour intégrer l'API UDCShare.

**Fonctionnalités :**
- ✅ Intégration Rails
- ✅ Background jobs Sidekiq/Resque
- ✅ Retry automatique
- ✅ Logger personnalisable

**Stack technique :**
- Ruby 2.7+
- Faraday (HTTP client)
- RSpec (tests)

**Cas d'usage :**
- Application Ruby on Rails
- Scripts Ruby automatisés
- Background jobs

[📁 Documentation complète →](./ruby-upload-gem/README.md)

---

### ⚛️ React: Upload Component

Composant React moderne pour intégrer l'API UDCShare.

**Fonctionnalités :**
- ✅ Hooks personnalisés
- ✅ Gestion d'état React
- ✅ TypeScript support
- ✅ Drag & drop intégré
- ✅ Progress tracking

**Stack technique :**
- React 16+
- Hooks API
- TypeScript
- React Testing Library

**Cas d'usage :**
- Applications React/Next.js
- Single Page Applications
- Applications React Native

[📁 Documentation complète →](./react-upload-component/README.md)

---

### 💚 Vue.js: Upload Component

Composant Vue.js pour intégrer l'API UDCShare.

**Fonctionnalités :**
- ✅ Composition API
- ✅ Composables personnalisés
- ✅ Support Nuxt.js
- ✅ Reactivity système
- ✅ TypeScript support

**Stack technique :**
- Vue 3+
- Composition API
- TypeScript
- Vitest (tests)

**Cas d'usage :**
- Applications Vue.js
- Applications Nuxt.js
- Progressive Web Apps

[📁 Documentation complète →](./vue-upload-component/README.md)

---

### 🅰️ Angular: Upload Module — PAS ENCORE DISPONIBLE

> Ce dossier ne contient que ce README et `package.json`.
> Le service Angular reste à écrire : la description ci-dessous est l'intention visée.

Module Angular professionnel pour intégrer l'API UDCShare.

**Fonctionnalités :**
- ✅ Services RxJS
- ✅ Dependency Injection
- ✅ Support NgRx
- ✅ Standalone Components
- ✅ Tests avec Jasmine

**Stack technique :**
- Angular 15+
- RxJS
- TypeScript
- Jasmine/Karma (tests)

**Cas d'usage :**
- Applications Angular
- Enterprise apps
- Server-Side Rendering (SSR)

[📁 Documentation complète →](./angular-upload-module/README.md)

---

## Installation rapide

### 1. Choisissez votre projet

```bash
# Pour le système de backup Python
cd python-backup-system

# Pour l'API middleware Node.js
cd nodejs-upload-api

# Pour le client JavaScript
cd javascript-client

# Pour le service PHP
cd php-upload-service

# Pour le service Go
cd go-backup-service

# Pour la Gem Ruby
cd ruby-upload-gem

# Pour le composant React
cd react-upload-component

# Pour le composant Vue.js
cd vue-upload-component

# Pour le module Angular
cd angular-upload-module
```

### 2. Configurez votre clé API

Chaque projet utilise une variable d'environnement ou fichier de configuration pour votre clé API.

```bash
# Python
export UDCSHARE_API_KEY="votre_clé_api_udcshare"

# Node.js
echo "UDCSHARE_API_KEY=votre_clé_api_udcshare" > .env

# JavaScript
// Directement dans le code ou via variable d'environnement
const apiKey = 'votre_clé_api_udcshare';
```

### 3. Installez les dépendances

```bash
# Python
pip install -r requirements.txt

# Node.js
npm install

# JavaScript
# Aucune installation requise (vanilla JS)
```

### 4. Lancez le projet

```bash
# Python
python backup_system.py

# Node.js
npm run dev

# JavaScript
# Incluez simplement le fichier .js dans votre HTML
```

---

## Architecture

Tous les projets suivent les principes :

- **Séparation des responsabilités** - Modules spécifiques par fonction
- **Gestion d'erreurs robuste** - Retry logic et error boundaries
- **Respect des limites** - Vérification automatique des quotas API
- **Logging structuré** - Logs détaillés pour debugging
- **Tests unitaires** - Assurance qualité du code
- **Documentation complète** - README et commentaires

### Structure commune

Chaque projet inclut :

```
projet/
├── src/                 # Code source principal
├── tests/              # Tests unitaires
├── docs/               # Documentation additionnelle
├── README.md            # Documentation principale
└── examples/            # Exemples d'utilisation
```

---

## Configuration

### Clé API UDCShare

Pour obtenir une clé API :
1. Connectez-vous à [udcshare.com/dashboard](https://udcshare.com/dashboard)
2. Allez dans "Paramètres" → "Clés API"
3. Cliquez sur "+ Générer une clé"
4. Donnez un nom (ex: "Mon Application Production")
5. Copiez et sécurisez la clé

### Plans et limites

L'API respecte les limites versionnées du catalogue des plans :

<!-- PLAN_LIMITS:START -->
| Plan | Prix | Taille max par fichier web | Quota total par jour (UTC) | Limite par semaine (lundi 0 h, Kinshasa) | Quota web/mois | Envois/mois | Stockage | Drives | Uploads simultanés | Expiration lien (défaut; maximum) | Téléchargements/jour | Quotas API (taille/fichier; req/min/IP; fichiers/jour) |
|---|---:|---:|---:|---|---:|---:|---|---:|---:|---|---|---|
| Free | Gratuit | 2 Go | Non plafonné | 3 envois; 5 Go | 15 Go | 10 | Fourni par le Drive connecté | 1 | 1 | 1 jour (max. 7 jours) | Aucun plafond par plan | Non incluse |
| Essentials | 8 500 CDF | 10 Go | Non plafonné | 15 envois; 25 Go | 75 Go | 50 | Fourni par le Drive connecté | 3 | 1 | 7 jours (max. 30 jours) | Aucun plafond par plan | 5 Go; 100 req/min/IP; 50 fichiers/jour |
| Pro | 20 000 CDF | 100 Go | 100 Go | 30 envois; 250 Go | 750 Go | 100 | Fourni par le Drive connecté | 10 | 10 | 7 jours (max. 30 jours) | Aucun plafond par plan | 25 Go; 300 req/min/IP; 200 fichiers/jour |
| Business | 57 000 CDF | 1 To | Illimité | Aucune | 5 To | 1000 | Fourni par le Drive connecté | Selon configuration | 50 | Aucune expiration automatique (max. sans plafond) | Aucun plafond par plan | 1 To; 1000 req/min/IP; 1000 fichiers/jour |
<!-- PLAN_LIMITS:END -->

Pour les uploads web, « taille max par fichier » s'applique individuellement à chaque fichier ; « quota total par jour » s'applique à la somme des fichiers du transfert et de l'usage déjà enregistré pour la date UTC. Le quota journalier se réinitialise à 00:00 UTC. L'API REST conserve ses limites dédiées de taille par fichier et de nombre de fichiers par jour, indiquées dans la colonne « Quotas API ».

Les projets exemples gèrent automatiquement ces limites.

---

## Support

### Documentation

- 📖 [Documentation API complète](../API_DOCUMENTATION.md)
- 🚀 [Dashboard UDCShare](https://udcshare.com/dashboard)

### Support technique

- 📧 **Email:** support@udcshare.com
- ⏰ **Horaires:** Lun-Ven, 9h-18h (GMT+1)
- 🌍 **Langues:** Français, Anglais

### Communauté

- 💬 Rejoignez notre [Discord](https://discord.gg/udcshare)
- 📚 Contribuez sur [GitHub](https://github.com/udcshare-official/udcshare-api-examples)
- 🎯 Signalez des bugs via l'issue tracker

---

## License

Tous les projets exemples sont fournis sous la **MIT License**, ce qui signifie :

✅ **Utilisation libre** dans vos projets personnels et commerciaux
✅ **Modification** selon vos besoins  
✅ **Distribution** avec vos modifications
✅ **Sous-licensing** dans vos produits

---

## 🤝 Contribution

Nous apprécions les contributions ! Voici comment participer :

1. **Signalez des bugs** - Utilisez l'issue tracker
2. **Proposez des améliorations** - Idées et suggestions bienvenues
3. **Soumettez du code** - Pull requests bienvenues
4. **Améliorez la documentation** - Corrections et clarifications
5. **Partagez votre projet** - Montrez comment vous avez intégré l'API

---

## 📢 Mise à jour

**Version actuelle:** 1.0.0  
**Date:** Juin 2026  
**Langages:** Python, Node.js, JavaScript, PHP, Go, Ruby, React, Vue.js, Angular  

Nous ajoutons régulièrement de nouveaux langages et exemples. Restez à l'écoute !

## 🎯 Résumé des projets

### Backend Services
- 🐍 **Python** - Système de backup automatisé avec monitoring
- 🟢 **Node.js** - API middleware avec MongoDB
- 🐘 **PHP** - Service avec intégration Laravel/Symfony
- 🐹 **Go** - Service performant avec concurrence native
- 💎 **Ruby** - Gem avec intégration Rails

### Frontend Components
- 💻 **JavaScript** - Client vanilla pour intégration directe
- ⚛️ **React** - Composant avec hooks modernes
- 💚 **Vue.js** - Composant avec Composition API
- 🅰️ **Angular** - Module avec RxJS et TypeScript

### Guides et Tests
- 📚 **Guides de déploiement** pour chaque projet principal
- 🧪 **Tests unitaires** pour Python, Node.js, JavaScript
- 🔧 **Configuration** avec .env.example pour chaque projet

---

**Créé avec ❤️ par l'équipe UDCShare**  
**[udcshare.com](https://udcshare.com)**

<!-- PLAN_CHANNEL_POLICIES:START -->
| Plan | Canal | Accès | Max par fichier | Quota total en octets/jour | Quota total en octets/mois | Transferts/mois | Uploads simultanés | Fichiers/jour | Requêtes/minute |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Guest | Web | Oui | 500 Mo | Aucun plafond | 500 Mo | 5 | 1 | — | — |
| Guest | API REST par clé | Non incluse | — | — | — | — | — | — | — |
| Free | Web | Oui | 2 Go | Aucun plafond | 15 Go | 10 | 1 | — | — |
| Free | API REST par clé | Non incluse | — | — | — | — | — | — | — |
| Essentials | Web | Oui | 10 Go | Aucun plafond | 75 Go | 50 | 1 | — | — |
| Essentials | API REST par clé | Oui | 5 Go | Non appliqué | Non appliqué | — | — | 50 (UTC) | 100/IP |
| Pro | Web | Oui | 100 Go | 100 Go (UTC) | 750 Go | 100 | 10 | — | — |
| Pro | API REST par clé | Oui | 25 Go | Non appliqué | Non appliqué | — | — | 200 (UTC) | 300/IP |
| Business | Web | Oui | 1 To | Aucun plafond | 5 To | 1000 | 50 | — | — |
| Business | API REST par clé | Oui | 1 To | Non appliqué | Non appliqué | — | — | 1000 (UTC) | 1000/IP |

Politique : les limites Web s’appliquent aux uploads de transfert Web ; les quotas en octets et le nombre de transferts mensuels sont cumulés par compte. Le quota journalier Web utilise la date UTC et se réinitialise à 00:00 UTC. Les quotas API REST v1 par clé sont indépendants : taille par fichier, nombre de fichiers enregistrés par jour UTC et débit par minute compté par clé API sur toutes les routes API limitées (30 clés invalides au plus par IP et par 15 minutes). Cette API n’a pas de plafond journalier ou mensuel en octets. Ses limites affichées comme « Non incluse » ne sont pas applicables aux plans sans accès API. Les endpoints de session `/api/transfers/*` et `/api/dashboard/reports/*` utilisent séparément un limiteur générique de 30 requêtes/minute/IP ; les autres endpoints d’application ne sont pas couverts par ce limiteur.
<!-- PLAN_CHANNEL_POLICIES:END -->
