# Guide de Déploiement - Python Backup System

Ce guide couvre le déploiement du système de backup Python UDCShare dans différents environnements.

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Déploiement Local](#déploiement-local)
- [Déploiement Docker](#déploiement-docker)
- [Déploiement Cloud](#déploiement-cloud)
- [Déploiement Kubernetes](#déploiement-kubernetes)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)

---

## Prérequis

### Outils requis

- Python 3.8+
- pip (Python package manager)
- Git

### Variables d'environnement

```bash
export UDCSHARE_API_KEY="votre_clé_api_udcshare"
export UDCSHARE_API_URL="https://udcshare.com/api/v1"
export BACKUP_DIRECTORIES="/path/to/backup1,/path/to/backup2"
```

---

## Déploiement Local

### 1. Cloner le projet

```bash
git clone https://github.com/udcshare-official/udcshare-api-examples.git
cd udcshare-api-examples/python-backup-system
```

### 2. Créer un environnement virtuel

```bash
python -m venv venv

# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer

```bash
cp .env.example .env
# Éditez .env avec votre configuration
```

### 5. Tester

```bash
python backup_system.py
```

### 6. Déployer en production

#### Création d'un service systemd (Linux)

```ini
# /etc/systemd/system/udcshare-backup.service
[Unit]
Description=UDCShare Backup System
After=network.target

[Service]
Type=simple
User=backup
WorkingDirectory=/opt/udcshare-backup
Environment="PATH=/opt/udcshare-backup/venv/bin"
ExecStart=/opt/udcshare-backup/venv/bin/python backup_system.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Activer le service
sudo systemctl enable udcshare-backup
sudo systemctl start udcshare-backup
sudo systemctl status udcshare-backup
```

#### Création d'un service Windows

```bat
# Utiliser NSSM pour créer un service Windows
nssm install UDCShareBackup "C:\Python39\python.exe" "C:\udcshare-backup\backup_system.py"
nssm set UDCShareBackup AppDirectory "C:\udcshare-backup"
nssm set UDCShareBackup DisplayName "UDCShare Backup System"
nssm start UDCShareBackup
```

---

## Déploiement Docker

### 1. Créer le Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Créer un utilisateur non-root
RUN useradd -m -u 1000 backup && chown -R backup:backup /app
USER backup

CMD ["python", "backup_system.py"]
```

### 2. Créer docker-compose.yml

```yaml
version: '3.8'

services:
  backup:
    build: .
    container_name: udcshare-backup
    restart: unless-stopped
    environment:
      - UDCSHARE_API_KEY=${UDCSHARE_API_KEY}
      - UDCSHARE_API_URL=${UDCSHARE_API_URL:-https://udcshare.com/api/v1}
      - BACKUP_DIRECTORIES=/data/backup1,/data/backup2
    volumes:
      - /path/to/local/backup:/data/backup1
      - /path/to/local/backup2:/data/backup2
      - backup_db:/app/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  backup_db:
```

### 3. Construire et lancer

```bash
# Build
docker-compose build

# Lancer
docker-compose up -d

# Logs
docker-compose logs -f backup

# Arrêter
docker-compose down
```

---

## Déploiement Cloud

### AWS (Elastic Beanstalk)

#### 1. Préparer l'application

```python
# application.py (Wsgi entrypoint)
from backup_system import UDCShareBackup
import os

def create_app():
    # Configuration AWS
    return UDCShareBackup()

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)
```

#### 2. Créer requirements.txt AWS

```
gunicorn==21.2.0
requests>=2.31.0
tenacity>=8.2.0
python-dotenv>=1.0.0
```

#### 3. Configuration EB

```yaml
# .ebextensions/python.config
option_settings:
  aws:elasticbeanstalk:container:python:
    WSGIPath: application.py
```

#### 4. Déployer

```bash
eb init -p python-3.9 udcshare-backup
eb create production-env
eb deploy
```

### Google Cloud (Cloud Run)

#### 1. Préparer le Dockerfile (Cloud Run)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "backup_system.py"]
```

#### 2. Déployer

```bash
# Build
gcloud builds submit --tag gcr.io/PROJECT_ID/udcshare-backup

# Deploy
gcloud run deploy udcshare-backup \
  --image gcr.io/PROJECT_ID/udcshare-backup \
  --platform managed \
  --region us-central1 \
  --set-env-vars UDCSHARE_API_KEY=your_key
```

### Azure (Container Instances)

#### 1. Préparer le fichier de configuration

```json
{
  "location": "eastus",
  "name": "udcshare-backup",
  "properties": {
    "containers": [
      {
        "name": "udcshare-backup",
        "image": "your-registry/udcshare-backup:latest",
        "ports": [
          { "port": 80 }
        ],
        "environmentVariables": [
          { "name": "UDCSHARE_API_KEY", "value": "your_key" }
        ]
      }
    ],
    "osType": "Linux",
    "restartPolicy": "Always"
  }
}
```

---

## Déploiement Kubernetes

### 1. Créer le Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: udcshare-backup
spec:
  replicas: 1
  selector:
    matchLabels:
      app: udcshare-backup
  template:
    metadata:
      labels:
        app: udcshare-backup
    spec:
      containers:
      - name: backup
        image: your-registry/udcshare-backup:latest
        env:
        - name: UDCSHARE_API_KEY
          valueFrom:
            secretKeyRef:
              name: udcshare-secrets
              key: api-key
        - name: UDCSHARE_API_URL
          value: "https://udcshare.com/api/v1"
        volumeMounts:
        - name: backup-data
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: backup-data
        persistentVolumeClaim:
          claimName: backup-pvc
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
```

### 3. Créer le PersistentVolume

```yaml
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
```

### 4. Déployer

```bash
kubectl apply -f secret.yaml
kubectl apply -f pvc.yaml
kubectl apply -f deployment.yaml

# Vérifier
kubectl get pods
kubectl logs -f deployment/udcshare-backup
```

---

## Monitoring

### Monitoring avec Prometheus

#### 1. Ajouter Prometheus client

```python
# requirements.txt
prometheus-client>=0.19.0

# monitoring.py
from prometheus_client import Counter, Histogram, start_http_server

upload_counter = Counter('udcshare_uploads_total', 'Total uploads')
upload_duration = Histogram('udcshare_upload_duration_seconds', 'Upload duration')

start_http_server(8000)
```

#### 2. Configurer Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'udcshare-backup'
    static_configs:
      - targets: ['localhost:8000']
```

### Monitoring avec Datadog

```python
# monitoring.py
from datadog import statsd

def record_upload(duration, success):
    statsd.histogram('udcshare.upload.duration', duration)
    if success:
        statsd.increment('udcshare.upload.success')
    else:
        statsd.increment('udcshare.upload.failure')
```

---

## Maintenance

### Rotation des logs

```python
# Utiliser logging avec rotation
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler(
    'backup_system.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
```

### Mises à jour

```bash
# Pull les mises à jour
git pull origin main

# Mise à jour des dépendances
pip install --upgrade -r requirements.txt

# Redémarrer le service
sudo systemctl restart udcshare-backup
```

### Backup de la base de données locale

```bash
# Backup SQLite
cp backup_system.db backup_system_backup_$(date +%Y%m%d).db

# Compresser
gzip backup_system_backup_$(date +%Y%m%d).db
```

---

## Dépannage

### Problèmes courants

#### Erreur: "Aucun fichier fourni"

**Solution:** Vérifiez que les répertoires de backup sont accessibles et contiennent des fichiers.

#### Erreur: "Clé API requise"

**Solution:** Assurez-vous que UDCSHARE_API_KEY est défini dans .env ou les variables d'environnement.

#### Erreur: "Trop de requêtes"

**Solution:** Le rate limiting est activé. Attendez ou upgradez votre plan UDCShare.

---

**Support:** support@udcshare.com
