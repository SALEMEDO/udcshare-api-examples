"""
Configuration pour le système de backup UDCShare
"""
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

class Config:
    """Configuration centralisée du système de backup"""
    
    # Configuration API UDCShare
    API_KEY = os.getenv('UDCSHARE_API_KEY', '')
    BASE_URL = os.getenv('UDCSHARE_API_URL', 'https://udcshare.com/api/v1')
    
    # Configuration backup
    BACKUP_DIRECTORIES = [
        os.getenv('BACKUP_DIR_1', ''),
        os.getenv('BACKUP_DIR_2', ''),
        os.getenv('BACKUP_DIR_3', '')
    ]
    
    # Configuration scheduling
    BACKUP_SCHEDULE = os.getenv('BACKUP_SCHEDULE', '02:00')  # 2h du matin par défaut
    BACKUP_ENABLED = os.getenv('BACKUP_ENABLED', 'true').lower() == 'true'
    
    # Configuration retry
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
    RETRY_DELAY = int(os.getenv('RETRY_DELAY', '5'))  # secondes
    RETRY_BACKOFF = float(os.getenv('RETRY_BACKOFF', '2'))  # exponential backoff
    
    # Configuration fichiers
    MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', '25')) * 1024 * 1024 * 1024  # 25GB par défaut
    ALLOWED_EXTENSIONS = os.getenv('ALLOWED_EXTENSIONS', 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,png').split(',')
    EXCLUDE_PATTERNS = ['.tmp', '.cache', '~']
    
    # Configuration base de données
    DB_PATH = os.getenv('DB_PATH', 'backup_system.db')
    
    # Configuration monitoring
    MONITORING_ENABLED = os.getenv('MONITORING_ENABLED', 'true').lower() == 'true'
    ALERT_EMAIL = os.getenv('ALERT_EMAIL', '')
    ALERT_THRESHOLD = int(os.getenv('ALERT_THRESHOLD', '3'))  # alertes après 3 échecs
    
    # Configuration logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'backup_system.log')
    
    @classmethod
    def validate(cls):
        """Valide la configuration"""
        if not cls.API_KEY:
            raise ValueError("UDCSHARE_API_KEY doit être défini")
        
        if cls.MAX_FILE_SIZE <= 0:
            raise ValueError("MAX_FILE_SIZE doit être positif")
        
        if cls.MAX_RETRIES < 0:
            raise ValueError("MAX_RETRIES ne peut pas être négatif")
        
        return True
    
    @classmethod
    def get_plan_limits(cls):
        """Retourne les limites selon le plan (à obtenir depuis l'API)"""
        # Ces valeurs seront mises à jour dynamiquement depuis l'API
        return {
            'max_upload': None,  # Sera obtenu depuis /account
            'max_files_per_day': None,
            'api_rate_limit': None
        }
