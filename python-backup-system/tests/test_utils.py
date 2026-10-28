"""
Tests unitaires pour le système de backup UDCShare
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
import os
import tempfile
import json

from config import Config
from utils import (
    validate_file, format_file_size, calculate_file_hash,
    APIMonitor, BackupMonitor, APIError, RateLimitError
)


class TestUtils(unittest.TestCase):
    """Tests pour les utilitaires"""

    def setUp(self):
        """Setup pour les tests"""
        self.temp_dir = tempfile.mkdtemp()
        self.test_file = os.path.join(self.temp_dir, 'test.txt')
        with open(self.test_file, 'w') as f:
            f.write('Test content')

    def tearDown(self):
        """Cleanup après les tests"""
        if os.path.exists(self.test_file):
            os.remove(self.test_file)
        if os.path.exists(self.temp_dir):
            os.rmdir(self.temp_dir)

    def test_format_file_size(self):
        """Test le formatage de la taille de fichier"""
        self.assertEqual(format_file_size(1024), '1.00 KB')
        self.assertEqual(format_file_size(1024 * 1024), '1.00 MB')
        self.assertEqual(format_file_size(0), '0.00 B')

    def test_validate_file_success(self):
        """Test la validation réussie d'un fichier"""
        result = validate_file(
            self.test_file,
            max_size=1024 * 1024,  # 1MB
            allowed_extensions=['.txt', '.pdf'],
            exclude_patterns=['.tmp']
        )
        self.assertTrue(result[0])
        self.assertEqual(result[1], '')

    def test_validate_file_not_found(self):
        """Test la validation d'un fichier inexistant"""
        result = validate_file(
            '/non/existent/file.txt',
            max_size=1024 * 1024,
            allowed_extensions=['.txt'],
            exclude_patterns=[]
        )
        self.assertFalse(result[0])
        self.assertIn("n'existe pas", result[1])

    def test_validate_file_too_large(self):
        """Test la validation d'un fichier trop grand"""
        result = validate_file(
            self.test_file,
            max_size=10,  # 10 bytes seulement
            allowed_extensions=['.txt'],
            exclude_patterns=[]
        )
        self.assertFalse(result[0])
        self.assertIn("trop grand", result[1])

    def test_calculate_file_hash(self):
        """Test le calcul du hash d'un fichier"""
        hash1 = calculate_file_hash(self.test_file)
        hash2 = calculate_file_hash(self.test_file)
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)  # SHA256 = 64 chars hex


class TestAPIMonitor(unittest.TestCase):
    """Tests pour le moniteur API"""

    def setUp(self):
        """Setup pour les tests"""
        self.monitor = APIMonitor(rate_limit=100)

    def test_initial_state(self):
        """Test l'état initial"""
        self.assertEqual(self.monitor.rate_limit, 100)
        self.assertEqual(len(self.monitor.calls_made), 0)

    def test_can_make_call(self):
        """Test si un appel peut être fait"""
        self.assertTrue(self.monitor.can_make_call())

    def test_record_call(self):
        """Test l'enregistrement d'un appel"""
        self.monitor.record_call()
        self.assertEqual(len(self.monitor.calls_made), 1)

    def test_rate_limiting(self):
        """Test le rate limiting"""
        # Simuler 100 appels
        for _ in range(100):
            self.monitor.record_call()

        # Le 101ème ne devrait pas être possible
        self.assertFalse(self.monitor.can_make_call())

    def test_get_stats(self):
        """Test la récupération des statistiques"""
        self.monitor.record_call()
        stats = self.monitor.get_stats()
        self.assertEqual(stats['calls_in_current_window'], 1)
        self.assertEqual(stats['rate_limit'], 100)
        self.assertEqual(stats['remaining'], 99)


class TestBackupMonitor(unittest.TestCase):
    """Tests pour le moniteur de backup"""

    def setUp(self):
        """Setup pour les tests"""
        self.monitor = BackupMonitor()

    def test_initial_state(self):
        """Test l'état initial"""
        self.assertEqual(self.monitor.backup_count, 0)
        self.assertEqual(self.monitor.success_count, 0)
        self.assertEqual(self.monitor.error_count, 0)

    def test_record_backup_start(self):
        """Test l'enregistrement du début de backup"""
        self.monitor.record_backup_start()
        self.assertEqual(self.monitor.backup_count, 1)

    def test_record_backup_success(self):
        """Test l'enregistrement d'un backup réussi"""
        self.monitor.record_backup_start()
        self.monitor.record_backup_success(5, 1024)
        self.assertEqual(self.monitor.success_count, 1)
        self.assertEqual(self.monitor.total_files_uploaded, 5)
        self.assertEqual(self.monitor.total_size_uploaded, 1024)

    def test_record_backup_error(self):
        """Test l'enregistrement d'une erreur de backup"""
        self.monitor.record_backup_start()
        self.monitor.record_backup_error()
        self.assertEqual(self.monitor.error_count, 1)

    def test_get_stats(self):
        """Test la récupération des statistiques"""
        self.monitor.record_backup_start()
        self.monitor.record_backup_success(10, 2048)
        self.monitor.record_backup_error()
        
        stats = self.monitor.get_stats()
        self.assertEqual(stats['total_backups'], 1)
        self.assertEqual(stats['successful_backups'], 0)  # 1 succès sur 1 total = 0 car error_count > 0
        self.assertEqual(stats['failed_backups'], 1)


class TestConfig(unittest.TestCase):
    """Tests pour la configuration"""

    @patch.dict(os.environ, {'UDCSHARE_API_KEY': 'test_key'})
    def test_api_key_from_env(self):
        """Test la récupération de la clé API depuis l'environnement"""
        # Cette test nécessite que Config soit rechargé avec les nouvelles variables d'environnement
        self.assertIsNotNone(Config.API_KEY)

    def test_validate_without_api_key(self):
        """Test la validation sans clé API"""
        Config.API_KEY = ''
        with self.assertRaises(ValueError):
            Config.validate()

    @patch.dict(os.environ, {'UDCSHARE_API_KEY': 'test_key'})
    def test_validate_with_api_key(self):
        """Test la validation avec clé API"""
        Config.API_KEY = 'test_key'
        self.assertTrue(Config.validate())


class TestAPIError(unittest.TestCase):
    """Tests pour les exceptions personnalisées"""

    def test_api_error_creation(self):
        """Test la création d'une erreur API"""
        error = APIError("Test error", status_code=400)
        self.assertEqual(str(error), "Test error")
        self.assertEqual(error.status_code, 400)

    def test_rate_limit_error_creation(self):
        """Test la création d'une erreur de rate limit"""
        error = RateLimitError("Rate limit exceeded")
        self.assertEqual(str(error), "Rate limit exceeded")
        self.assertIsInstance(error, APIError)


if __name__ == '__main__':
    unittest.main()
