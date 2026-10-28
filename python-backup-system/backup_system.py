"""
UDCShare Backup System - Système professionnel de backup automatisé
Intégration avec l'API REST UDCShare pour backup d'entreprise
"""
import os
import requests
import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import logging
from pathlib import Path
import time

from config import Config
from utils import (
    setup_logging, APIError, RateLimitError, retry_on_network_error,
    calculate_file_hash, format_file_size, validate_file,
    APIMonitor, BackupMonitor, send_alert
)

logger = setup_logging(Config.LOG_LEVEL, Config.LOG_FILE)


class BackupDatabase:
    """Base de données locale pour la traçabilité des backups"""
    
    def __init__(self, db_path: str = Config.DB_PATH):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialise la base de données avec les tables nécessaires"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Table des backups
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS backups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    backup_id TEXT UNIQUE NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    files_uploaded INTEGER DEFAULT 0,
                    total_size INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    duration_seconds REAL
                )
            ''')
            
            # Table des fichiers
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS backup_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    backup_id TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_hash TEXT,
                    file_size INTEGER,
                    udcshare_file_id TEXT,
                    udcshare_file_url TEXT,
                    upload_status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (backup_id) REFERENCES backups (backup_id)
                )
            ''')
            
            # Table des statistiques
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS backup_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date DATE DEFAULT CURRENT_DATE,
                    total_backups INTEGER DEFAULT 0,
                    successful_backups INTEGER DEFAULT 0,
                    total_files INTEGER DEFAULT 0,
                    total_bytes INTEGER DEFAULT 0
                )
            ''')
            
            conn.commit()
    
    def create_backup_record(self, backup_id: str) -> int:
        """Crée un enregistrement de backup"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO backups (backup_id, status) VALUES (?, ?)',
                (backup_id, 'pending')
            )
            conn.commit()
            return cursor.lastrowid
    
    def update_backup_status(self, backup_id: str, status: str, files_uploaded: int = 0, 
                           total_size: int = 0, error_message: str = None, duration: float = None):
        """Met à jour le statut d'un backup"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            update_fields = ['status = ?']
            update_values = [status]
            
            if files_uploaded is not None:
                update_fields.append('files_uploaded = ?')
                update_values.append(files_uploaded)
            
            if total_size is not None:
                update_fields.append('total_size = ?')
                update_values.append(total_size)
            
            if error_message is not None:
                update_fields.append('error_message = ?')
                update_values.append(error_message)
            
            if duration is not None:
                update_fields.append('duration_seconds = ?')
                update_values.append(duration)
            
            update_values.append(backup_id)
            
            cursor.execute(
                f'UPDATE backups SET {", ".join(update_fields)} WHERE backup_id = ?',
                update_values
            )
            conn.commit()
    
    def add_file_record(self, backup_id: str, file_name: str, file_path: str, 
                      file_hash: str, file_size: int) -> int:
        """Ajoute un enregistrement de fichier"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO backup_files (backup_id, file_name, file_path, file_hash, file_size)
                   VALUES (?, ?, ?, ?, ?)''',
                (backup_id, file_name, file_path, file_hash, file_size)
            )
            conn.commit()
            return cursor.lastrowid
    
    def update_file_status(self, file_id: int, status: str, udcshare_file_id: str = None,
                          udcshare_file_url: str = None, error_message: str = None):
        """Met à jour le statut d'un fichier"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            update_fields = ['upload_status = ?']
            update_values = [status]
            
            if udcshare_file_id:
                update_fields.append('udcshare_file_id = ?')
                update_values.append(udcshare_file_id)
            
            if udcshare_file_url:
                update_fields.append('udcshare_file_url = ?')
                update_values.append(udcshare_file_url)
            
            if error_message:
                update_fields.append('error_message = ?')
                update_values.append(error_message)
            
            update_values.append(file_id)
            
            cursor.execute(
                f'UPDATE backup_files SET {", ".join(update_fields)} WHERE id = ?',
                update_values
            )
            conn.commit()
    
    def get_backup_stats(self, days: int = 30) -> Dict:
        """Récupère les statistiques de backup"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            since_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_backups,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_backups,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_backups,
                    SUM(files_uploaded) as total_files,
                    SUM(total_size) as total_bytes
                FROM backups
                WHERE timestamp >= ?
            ''', (since_date,))
            
            stats = cursor.fetchone()
            
            cursor.execute('''
                SELECT timestamp, status, files_uploaded, total_size
                FROM backups
                ORDER BY timestamp DESC
                LIMIT 10
            ''')
            
            recent_backups = cursor.fetchall()
            
            return {
                'total_backups': stats[0] or 0,
                'successful_backups': stats[1] or 0,
                'failed_backups': stats[2] or 0,
                'total_files': stats[3] or 0,
                'total_bytes': stats[4] or 0,
                'recent_backups': recent_backups,
                'success_rate': (stats[1] / max(1, stats[0]) * 100)) if stats[0] > 0 else 0
            }


class UDCShareAPI:
    """Client API UDCShare avec gestion des erreurs et rate limiting"""
    
    def __init__(self, api_key: str, base_url: str = None):
        self.api_key = api_key
        self.base_url = base_url or Config.BASE_URL
        self.headers = {'X-API-Key': api_key}
        self.monitor = APIMonitor()
        self.plan_limits = Config.get_plan_limits()
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Effectue une requête API avec retry et rate limiting"""
        self.monitor.wait_if_needed()
        
        try:
            response = requests.request(
                method,
                f"{self.base_url}{endpoint}",
                headers=self.headers,
                **kwargs
            )
            self.monitor.record_call()
            return response
        except requests.exceptions.RequestException as e:
            logger.error(f"Erreur réseau: {e}")
            raise
    
    def get_account_info(self) -> Dict:
        """Récupère les informations du compte"""
        response = self._make_request('GET', '/account')
        
        if response.status_code == 200:
            data = response.json()
            # Mettre à jour les limites du plan
            self.plan_limits = data.get('api_limits', {})
            return data
        else:
            raise APIError(f"Erreur account: {response.status_code}", response.status_code, response.text)
    
    def upload_file(self, file_path: str, file_name: str = None) -> Dict:
        """Upload un fichier vers UDCShare"""
        if not file_name:
            file_name = os.path.basename(file_path)
        
        # Valider le fichier
        is_valid, error_msg = validate_file(
            file_path, 
            Config.MAX_FILE_SIZE, 
            Config.ALLOWED_EXTENSIONS,
            Config.EXCLUDE_PATTERNS
        )
        
        if not is_valid:
            raise ValueError(error_msg)
        
        # Vérifier les limites de l'API
        stats = self.get_stats()
        if stats.get('total_files', 0) >= self.plan_limits.get('max_files_per_day', 50):
            raise RateLimitError("Limite quotidienne de fichiers atteinte")
        
        with open(file_path, 'rb') as f:
            files = {'file': (file_name, f)}
            
            response = self._make_request('POST', '/upload', files=files)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 413:
            raise APIError("Fichier trop grand pour votre plan", response.status_code)
        elif response.status_code == 429:
            raise RateLimitError("Trop de requêtes, veuillez attendre", response.status_code)
        else:
            raise APIError(f"Erreur upload: {response.status_code}", response.status_code, response.text)
    
    def list_files(self) -> Dict:
        """Liste les fichiers uploadés"""
        response = self._make_request('GET', '/files')
        
        if response.status_code == 200:
            return response.json()
        else:
            raise APIError(f"Erreur list files: {response.status_code}", response.status_code)
    
    def delete_file(self, file_id: str) -> Dict:
        """Supprime un fichier"""
        response = self._make_request('DELETE', f'/files/{file_id}')
        
        if response.status_code == 200:
            return response.json()
        else:
            raise APIError(f"Erreur delete file: {response.status_code}", response.status_code)
    
    def get_stats(self) -> Dict:
        """Récupère les statistiques"""
        response = self._make_request('GET', '/stats')
        
        if response.status_code == 200:
            return response.json()
        else:
            raise APIError(f"Erreur stats: {response.status_code}", response.status_code)


class UDCShareBackup:
    """Système principal de backup UDCShare"""
    
    def __init__(self, api_key: str = None):
        if not api_key:
            api_key = Config.API_KEY
        
        if not api_key:
            raise ValueError("Clé API requise")
        
        self.api = UDCShareAPI(api_key)
        self.db = BackupDatabase()
        self.monitor = BackupMonitor()
        
        # Vérifier la connexion API
        try:
            account_info = self.api.get_account_info()
            logger.info(f"Connecté en tant que {account_info.get('email')} (Plan: {account_info.get('plan')})")
        except Exception as e:
            logger.error(f"Erreur de connexion API: {e}")
            raise
    
    def backup_directory(self, directory: str, recursive: bool = True) -> Dict:
        """
        Backup un répertoire complet
        Returns: Dict avec le résultat du backup
        """
        start_time = time.time()
        backup_id = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.info(f"Début du backup: {directory}")
        logger.info(f"Backup ID: {backup_id}")
        
        self.monitor.record_backup_start()
        backup_record_id = self.db.create_backup_record(backup_id)
        
        try:
            files_to_backup = self._get_files_to_backup(directory, recursive)
            logger.info(f"{len(files_to_backup)} fichiers à backup")
            
            uploaded_files = 0
            total_size = 0
            failed_files = 0
            
            for file_path in files_to_backup:
                try:
                    # Vérifier si le fichier a déjà été backup
                    file_hash = calculate_file_hash(file_path)
                    
                    # Enregistrer le fichier dans la base de données
                    file_record_id = self.db.add_file_record(
                        backup_id,
                        os.path.basename(file_path),
                        file_path,
                        file_hash,
                        os.path.getsize(file_path)
                    )
                    
                    # Upload le fichier
                    result = self.api.upload_file(file_path)
                    
                    # Mettre à jour le statut du fichier
                    self.db.update_file_status(
                        file_record_id,
                        'success',
                        udcshare_file_id=result.get('file_id'),
                        udcshare_file_url=result.get('file_url')
                    )
                    
                    uploaded_files += 1
                    total_size += os.path.getsize(file_path)
                    
                    logger.info(f"✓ Upload réussi: {os.path.basename(file_path)}")
                    
                    # Petit délai pour respecter le rate limiting
                    time.sleep(0.5)
                    
                except Exception as e:
                    failed_files += 1
                    logger.error(f"✗ Erreur upload {file_path}: {e}")
                    self.db.update_file_status(
                        file_record_id,
                        'error',
                        error_message=str(e)
                    )
            
            duration = time.time() - start_time
            
            # Mettre à jour le statut du backup
            if failed_files == 0:
                status = 'success'
            elif uploaded_files > 0:
                status = 'partial'
            else:
                status = 'error'
            
            self.db.update_backup_status(
                backup_id,
                status,
                files_uploaded=uploaded_files,
                total_size=total_size,
                duration=duration
            )
            
            self.monitor.record_backup_success(uploaded_files, total_size)
            
            result = {
                'success': status != 'error',
                'status': status,
                'backup_id': backup_id,
                'files_uploaded': uploaded_files,
                'failed_files': failed_files,
                'total_size': total_size,
                'duration': duration
            }
            
            logger.info(f"Backup terminé: {status} ({uploaded_files}/{uploaded_files + failed_files} fichiers)")
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            
            self.db.update_backup_status(
                backup_id,
                'error',
                error_message=error_msg,
                duration=duration
            )
            
            self.monitor.record_backup_error()
            logger.error(f"Backup échoué: {error_msg}")
            
            if Config.MONITORING_ENABLED and failed_files >= Config.ALERT_THRESHOLD:
                send_alert(f"Backup échoué: {error_msg}", Config.ALERT_EMAIL)
            
            return {
                'success': False,
                'status': 'error',
                'error': error_msg,
                'duration': duration
            }
    
    def _get_files_to_backup(self, directory: str, recursive: bool) -> List[str]:
        """Récupère la liste des fichiers à backup"""
        files = []
        directory_path = Path(directory)
        
        if recursive:
            for file_path in directory_path.rglob('*'):
                if file_path.is_file():
                    files.append(str(file_path))
        else:
            for file_path in directory_path.glob('*'):
                if file_path.is_file():
                    files.append(str(file_path))
        
        return files
    
    def get_backup_stats(self, days: int = 30) -> Dict:
        """Récupère les statistiques de backup"""
        return self.db.get_backup_stats(days)
    
    def get_api_monitoring(self) -> Dict:
        """Récupère les statistiques d'utilisation de l'API"""
        return self.api.monitor.get_stats()


def main():
    """Fonction principale pour les tests manuels"""
    try:
        Config.validate()
        
        # Créer le système de backup
        backup = UDCShareBackup()
        
        # Backup manuel
        if len(Config.BACKUP_DIRECTORIES) > 0:
            directory = Config.BACKUP_DIRECTORIES[0]
            if os.path.exists(directory):
                result = backup.backup_directory(directory)
                print(f"\n✓ Backup terminé: {result['status']}")
                print(f"  Fichiers uploadés: {result.get('files_uploaded', 0)}")
                print(f"  Taille totale: {format_file_size(result.get('total_size', 0))}")
            else:
                print(f"✗ Répertoire inexistant: {directory}")
        else:
            print("Aucun répertoire configuré pour le backup")
        
        # Afficher les statistiques
        stats = backup.get_backup_stats()
        print(f"\n📊 Statistiques (30 derniers jours):")
        print(f"  Total backups: {stats['total_backups']}")
        print(f"  Succès: {stats['successful_backups']}")
        print(f"  Échecs: {stats['failed_backups']}")
        print(f"  Taux de succès: {stats['success_rate']:.1f}%")
        print(f"  Fichiers totaux: {stats['total_files']}")
        print(f"  Taille totale: {format_file_size(stats['total_bytes'])}")
        
    except Exception as e:
        logger.error(f"Erreur principale: {e}")
        print(f"✗ Erreur: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
