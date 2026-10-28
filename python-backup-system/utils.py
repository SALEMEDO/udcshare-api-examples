"""
Utilitaires pour le système de backup UDCShare
"""
import logging
import time
import hashlib
import os
from typing import Callable, Any
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
import requests.exceptions


def setup_logging(log_level: str = 'INFO', log_file: str = 'backup_system.log'):
    """Configure le logging du système"""
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, maxBytes=10*1024*1024, backupCount=5),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)


class APIError(Exception):
    """Exception personnalisée pour les erreurs API"""
    def __init__(self, message: str, status_code: int = None, response: Any = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(message)


class RateLimitError(APIError):
    """Erreur quand la limite de l'API est dépassée"""
    pass


def calculate_file_hash(file_path: str) -> str:
    """Calcule le hash SHA256 d'un fichier"""
    sha256_hash = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def format_file_size(size_bytes: int) -> str:
    """Formate la taille d'un fichier"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def validate_file(file_path: str, max_size: int, allowed_extensions: list, exclude_patterns: list) -> tuple[bool, str]:
    """Valide un fichier avant upload"""
    if not os.path.exists(file_path):
        return False, "Le fichier n'existe pas"
    
    file_size = os.path.getsize(file_path)
    if file_size > max_size:
        return False, f"Fichier trop grand ({format_file_size(file_size)} > {format_file_size(max_size)})"
    
    file_ext = os.path.splitext(file_path)[1].lower()
    if allowed_extensions and file_ext not in allowed_extensions:
        return False, f"Extension non autorisée: {file_ext}"
    
    for pattern in exclude_patterns:
        if pattern in file_path:
            return False, f"Fichier exclu: {pattern}"
    
    return True, ""


class APIMonitor:
    """Moniteur pour respecter les limites de l'API"""
    
    def __init__(self, rate_limit: int = 300):
        self.rate_limit = rate_limit
        self.calls_made = []
        self.window_size = 60  # 60 secondes
    
    def can_make_call(self) -> bool:
        """Vérifie si un appel API peut être fait"""
        now = time.time()
        self.calls_made = [call for call in self.calls_made if now - call < self.window_size]
        return len(self.calls_made) < self.rate_limit
    
    def record_call(self):
        """Enregistre un appel API"""
        self.calls_made.append(time.time())
    
    def wait_if_needed(self):
        """Attend si nécessaire"""
        if not self.can_make_call():
            oldest_call = self.calls_made[0]
            wait_time = self.window_size - (time.time() - oldest_call)
            if wait_time > 0:
                time.sleep(wait_time)
    
    def get_stats(self) -> dict:
        """Retourne les statistiques d'utilisation"""
        now = time.time()
        calls_in_window = len([call for call in self.calls_made if now - call < self.window_size])
        return {
            'calls_in_current_window': calls_in_window,
            'rate_limit': self.rate_limit,
            'remaining': max(0, self.rate_limit - calls_in_window)
        }


class BackupMonitor:
    """Moniteur pour les opérations de backup"""
    
    def __init__(self):
        self.backup_count = 0
        self.success_count = 0
        self.error_count = 0
        self.total_files_uploaded = 0
        self.total_size_uploaded = 0
        self.start_time = datetime.now()
    
    def record_backup_start(self):
        self.backup_count += 1
    
    def record_backup_success(self, files_count: int, size_bytes: int):
        self.success_count += 1
        self.total_files_uploaded += files_count
        self.total_size_uploaded += size_bytes
    
    def record_backup_error(self):
        self.error_count += 1
    
    def get_stats(self) -> dict:
        uptime = datetime.now() - self.start_time
        return {
            'total_backups': self.backup_count,
            'successful_backups': self.success_count,
            'failed_backups': self.error_count,
            'success_rate': (self.success_count / max(1, self.backup_count)) * 100,
            'total_files_uploaded': self.total_files_uploaded,
            'total_size_uploaded': self.total_size_uploaded,
            'uptime_hours': uptime.total_seconds() / 3600
        }


def send_alert(message: str, email: str = None):
    """Envoie une alerte (à implémenter selon vos besoins)"""
    print(f"[ALERT] {message}")
