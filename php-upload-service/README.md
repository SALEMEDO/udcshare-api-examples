# 🐘 UDCShare PHP Upload Service

Service PHP professionnel pour intégrer l'API UDCShare dans vos applications.

## 🎯 Cas d'usage

- Application Laravel/Symfony avec upload de fichiers
- CMS PHP (WordPress, Drupal) avec intégration API
- Backend PHP avec gestion d'uploads
- Microservice PHP dédié aux fichiers

## 🏗️ Architecture

```
php-upload-service/
├── src/
│   ├── UDCShare/
│   │   ├── Client.php          # Client API principal
│   │   ├── FileUpload.php      # Classe d'upload
│   │   ├── FileManager.php     # Gestionnaire de fichiers
│   │   └── Exceptions/
│   │       └── APIException.php # Exception personnalisée
├── examples/
│   ├── basic-upload.php        # Upload simple
│   ├── laravel-integration.php # Exemple Laravel
│   └── symfony-integration.php # Exemple Symfony
├── tests/
│   ├── ClientTest.php          # Tests du client
│   └── FileUploadTest.php      # Tests d'upload
├── composer.json               # Dépendances PHP
├── .env.example               # Configuration
└── README.md                  # Ce fichier
```

## 🚀 Installation

```bash
# Installer via Composer
composer require udcshare/php-client

# Ou clonez le projet
git clone https://github.com/udcshare-official/udcshare-php-client.git
cd udcshare-php-client
composer install
```

## ⚙️ Configuration

```env
UDCSHARE_API_KEY=votre_clé_api_udcshare
UDCSHARE_API_URL=https://udcshare.com/api/v1
```

## 💻 Utilisation

### Upload simple

```php
use UDCShare\Client;

$udcshare = new Client('votre_clé_api_udcshare');

// Upload un fichier
$result = $udcshare->uploadFile('/path/to/document.pdf');
echo "Fichier uploadé: " . $result['file_url'];
```

### Upload avec progression

```php
$result = $udcshare->uploadFile('/path/to/document.pdf', [
    'onProgress' => function($progress) {
        echo "Progression: {$progress['percentage']}%";
    }
]);
```

### Lister les fichiers

```php
$files = $udcshare->listFiles();
foreach ($files['files'] as $file) {
    echo $file['filename'] . " - " . $file['file_url'];
}
```

### Upload multiple

```php
$files = ['/path/to/file1.pdf', '/path/to/file2.jpg'];
$results = $udcshare->uploadMultiple($files);
```

## 🎯 Intégration Laravel

### Installation Laravel

```bash
composer require udcshare/php-client
```

### Service Provider

```php
// config/udcshare.php
return [
    'api_key' => env('UDCSHARE_API_KEY'),
    'api_url' => env('UDCSHARE_API_URL', 'https://udcshare.com/api/v1'),
];
```

### Controller Laravel

```php
use UDCShare\Client;
use Illuminate\Http\Request;

class FileController extends Controller
{
    private $udcshare;
    
    public function __construct()
    {
        $this->udcshare = new Client(config('udcshare.api_key'));
    }
    
    public function upload(Request $request)
    {
        $file = $request->file('file');
        $path = $file->store('temp');
        
        $result = $this->udcshare->uploadFile(storage_path('app/' . $path));
        
        // Nettoyer le fichier temporaire
        Storage::delete($path);
        
        return response()->json([
            'success' => true,
            'file_url' => $result['file_url']
        ]);
    }
}
```

## 🎯 Intégration Symfony

### Installation Symfony

```bash
composer require udcshare/php-client
```

### Service Symfony

```yaml
# services.yaml
App\Service\UDCShareService:
    arguments:
        $apiKey: '%env(UDCSHARE_API_KEY)%'
```

### Controller Symfony

```php
use App\Service\UDCShareService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;

class FileController extends AbstractController
{
    private $udcshare;
    
    public function __construct(UDCShareService $udcshare)
    {
        $this->udcshare = $udcshare;
    }
    
    public function upload(Request $request)
    {
        $file = $request->files->get('file');
        
        $result = $this->udcshare->uploadFile($file->getPathname());
        
        return $this->json([
            'success' => true,
            'file_url' => $result['file_url']
        ]);
    }
}
```

## 🔧 Personnalisation

### Base de données personnalisée

```php
use UDCShare\FileManager;

$manager = new FileManager($yourDatabaseConnection);

// Sauvegarder les métadonnées dans votre base
$manager->saveMetadata($result, $file);
```

### Webhooks personnalisés

```php
$udcshare = new Client('api_key', [
    'onSuccess' => function($result) {
        // Envoyer à votre webhook
        $this->sendWebhook($result);
    }
]);
```

## 📊 Monitoring

Le client PHP inclut :
- Statistiques d'upload
- Temps de réponse
- Taux de succès/échec
- Logs détaillés

```php
$stats = $udcshare->getStats();
echo "Total uploads: " . $stats['total_uploads'];
echo "Taux de succès: " . $stats['success_rate'] . "%";
```

## 🧪 Tests

```bash
# Lancer les tests
vendor/bin/phpunit

# Tests avec coverage
vendor/bin/phpunit --coverage-html coverage
```

## 📄 License

MIT License

---

**Support:** support@udcshare.com
