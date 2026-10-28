# 🐍 UDCShare Backup System - Python

Un système professionnel de backup automatisé utilisant l'API UDCShare avec retry logic, monitoring et base de données personnalisée.

## 🎯 Cas d'usage

Backup automatique de documents importants pour une entreprise :
- Sauvegarde nocturne automatique
- Gestion des erreurs avec retry intelligent
- Monitoring et rapports détaillés
- Base de données locale pour la traçabilité
- Respect des limites de l'API selon les plans

## 🏗️ Architecture

```
python-backup-system/
├── backup_system.py       # Module principal de backup
├── config.py              # Configuration (clé API, paramètres)
├── database.py            # Gestion de la base de données locale
├── utils.py               # Utilitaires (retry, logging, monitoring)
├── requirements.txt       # Dépendances Python
└── README.md             # Ce fichier
```

## 🚀 Installation

```bash
# Installer les dépendances
pip install requests tenacity schedule sqlite3

# Ou utiliser requirements.txt
pip install -r requirements.txt
```

## ⚙️ Configuration

Créez un fichier `config.py` avec vos paramètres :

```python
API_KEY = "votre_clé_api_udcshare"
BASE_URL = "https://udcshare.com/api/v1"
BACKUP_DIRECTORIES = [
    "/chemin/vers/documents/important",
    "/chemin/vers/factures",
    "/chemin/vers/contrats"
]
BACKUP_SCHEDULE = "02:00"  # 2h du matin
MAX_RETRIES = 3
RETRY_DELAY = 5  # secondes
```

## 💻 Utilisation

### Backup manuel

```python
from backup_system import UDCShareBackup

backup = UDCShareBackup()
success = backup.backup_directory("/chemin/vers/documents")
```

### Backup automatisé

```python
from backup_system import UDCShareBackupScheduler

scheduler = UDCShareBackupScheduler()
scheduler.start()  # Démarre le scheduler
```

### Monitoring

```python
from database import BackupDatabase

db = BackupDatabase()
stats = db.get_backup_stats()
print(f"Total backups: {stats['total_backups']}")
print(f"Dernier backup: {stats['last_backup']}")
```

## 🎯 Fonctionnalités

### ✅ Features principales

1. **Upload automatique** de fichiers vers UDCShare
2. **Retry intelligent** avec exponential backoff
3. **Base de données locale** pour traçabilité
4. **Monitoring** et rapports détaillés
5. **Respect des limites** de l'API
6. **Logging avancé** pour debugging
7. **Scheduler intégré** pour backups automatiques

### 📊 Monitoring

Le système génère des rapports détaillés :
- Statistiques de backup
- Taux de succès/échec
- Temps d'exécution
- Utilisation de l'API
- Alertes en cas d'échec

### 🔒 Sécurité

- Clé API stockée de manière sécurisée
- Validation des fichiers avant upload
- Logging des actions (sans données sensibles)
- Gestion des erreurs robuste

## 📈 Performance

- **Parallel processing** pour les uploads multiples
- **Compression** optionnelle des fichiers
- **Delta backup** (uniquement les fichiers modifiés)
- **Rate limiting** automatique selon votre plan

## 🐛 Gestion des erreurs

Le système gère automatiquement :
- Erreurs réseau (retry automatique)
- Erreurs d'API (analyse des codes HTTP)
- Erreurs de fichiers (validation avant upload)
- Erreurs de base de données (retry + logging)

## 📝 Base de données

Le système utilise SQLite pour stocker :
- Historique des backups
- Métadonnées des fichiers
- Statistiques d'utilisation
- Logs d'erreurs

La base de données est **locale** et n'interfère pas avec votre base de données principale.

## 🎓 Exemples d'utilisation

### Example 1: Backup simple

```python
from backup_system import UDCShareBackup

backup = UDCShareBackup()
result = backup.backup_directory("/data/documents")
if result['success']:
    print(f"Backup réussi: {result['files_uploaded']} fichiers")
else:
    print(f"Erreur: {result['error']}")
```

### Example 2: Backup avec monitoring

```python
from backup_system import UDCShareBackup
from utils import setup_monitoring

backup = UDCShareBackup()
setup_monitoring(backup)

backup.backup_directory("/data/invoices")
# Le monitoring enverra des alertes en cas d'échec
```

### Example 3: Backup sélectif

```python
from backup_system import UDCShareBackup

backup = UDCShareBackup()
# Backup uniquement les fichiers modifiés récemment
result = backup.backup_recent_files(
    "/data/documents", 
    hours=24  # derniers 24 heures
)
```

## 🔧 Personnalisation

Le système est conçu pour être facilement personnalisable :

1. **Adaptez la logique de backup** dans `backup_system.py`
2. **Modifiez le schéma de la base de données** dans `database.py`
3. **Changez les paramètres de retry** dans `utils.py`
4. **Intégrez votre propre système de logging**

## 📚 Documentation technique

### Architecture du code

- **backup_system.py**: Logique principale de backup et intégration API
- **database.py**: Couche d'abstraction pour la base de données locale
- **utils.py**: Fonctions utilitaires (retry, validation, monitoring)
- **config.py**: Configuration centralisée

### Patterns utilisés

- **Repository Pattern** pour l'accès aux données
- **Strategy Pattern** pour les différents types de backup
- **Observer Pattern** pour le monitoring
- **Singleton Pattern** pour la configuration

## 🚨 Limitations

- **Dépendance** à une connexion internet
- **Respect des limites** de votre plan UDCShare
- **Base de données locale** (pas de synchronisation multi-sites)

## 🤝 Contribution

Ce projet est open source. N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Soumettre des pull requests

## 📄 Licence

Ce projet exemple est fourni sous licence MIT pour vous aider à intégrer l'API UDCShare.

---

**Support:** Pour toute question sur l'API UDCShare, contactez support@udcshare.com
