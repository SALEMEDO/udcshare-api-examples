<?php

require_once __DIR__ . '/../vendor/autoload.php';

use UDCShare\Client;

// Initialisation du client
$apiKey = getenv('UDCSHARE_API_KEY') ?: 'votre_clé_api_udcshare';
$udcshare = new Client($apiKey);

// Example 1: Upload simple
echo "=== Upload simple ===\n";

try {
    $result = $udcshare->uploadFile(__DIR__ . '/example.pdf');
    echo "✅ Upload réussi!\n";
    echo "   URL: {$result['file_url']}\n";
    echo "   ID: {$result['file_id']}\n";
} catch (Exception $e) {
    echo "❌ Erreur: {$e->getMessage()}\n";
}

// Example 2: Upload avec progression
echo "\n=== Upload avec progression ===\n";

try {
    $result = $udcshare->uploadFile(__DIR__ . '/large-file.pdf', [
        'onProgress' => function($progress) {
            echo "   Progression: {$progress['percentage']}%\n";
        },
        'onSuccess' => function($result) {
            echo "   Upload terminé en {$result['upload_time']}s\n";
        }
    ]);
} catch (Exception $e) {
    echo "❌ Erreur: {$e->getMessage()}\n";
}

// Example 3: Lister les fichiers
echo "\n=== Liste des fichiers ===\n";

try {
    $files = $udcshare->listFiles();
    echo "Total fichiers: {$files['total']}\n";
    
    foreach ($files['files'] as $file) {
        echo "   - {$file['filename']} ({$file['filesize']} bytes)\n";
    }
} catch (Exception $e) {
    echo "❌ Erreur: {$e->getMessage()}\n";
}

// Example 4: Upload multiple
echo "\n=== Upload multiple ===\n";

$files = [
    __DIR__ . '/file1.pdf',
    __DIR__ . '/file2.jpg',
    __DIR__ . '/file3.docx'
];

$results = $udcshare->uploadMultiple($files);

foreach ($results as $result) {
    if ($result['status'] === 'success') {
        echo "✅ {$result['file']}: {$result['result']['file_url']}\n";
    } else {
        echo "❌ {$result['file']}: {$result['error']}\n";
    }
}

// Example 5: Statistiques
echo "\n=== Statistiques ===\n";

try {
    $stats = $udcshare->getClientStats();
    echo "Total uploads: {$stats['total_uploads']}\n";
    echo "Succès: {$stats['successful_uploads']}\n";
    echo "Échecs: {$stats['failed_uploads']}\n";
    echo "Taux de succès: {$stats['success_rate']}%\n";
    echo "Total bytes: " . Client::formatFileSize($stats['total_bytes']) . "\n";
    echo "Uptime: {$stats['uptime_hours']}h\n";
} catch (Exception $e) {
    echo "❌ Erreur: {$e->getMessage()}\n";
}
