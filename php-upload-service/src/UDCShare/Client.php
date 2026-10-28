<?php

namespace UDCShare;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Utils;

/**
 * Client PHP pour l'API UDCShare
 */
class Client
{
    private string $apiKey;
    private string $baseUrl;
    private GuzzleClient $httpClient;
    private array $stats = [];
    private array $options = [];

    /**
     * Constructeur
     */
    public function __construct(string $apiKey, array $options = [])
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = $options['base_url'] ?? 'https://udcshare.com/api/v1';
        $this->options = $options;
        
        $this->httpClient = new GuzzleClient([
            'base_uri' => $this->baseUrl,
            'timeout' => $options['timeout'] ?? 30,
            'headers' => [
                'X-API-Key' => $this->apiKey,
                'Accept' => 'application/json'
            ]
        ]);

        $this->stats = [
            'total_uploads' => 0,
            'successful_uploads' => 0,
            'failed_uploads' => 0,
            'total_bytes' => 0,
            'start_time' => time()
        ];
    }

    /**
     * Upload un fichier
     */
    public function uploadFile(string $filePath, array $options = []): array
    {
        try {
            if (!file_exists($filePath)) {
                throw new \Exception("Le fichier n'existe pas: {$filePath}");
            }

            $fileSize = filesize($filePath);
            $fileName = basename($filePath);

            $this->stats['total_uploads']++;
            $startTime = microtime(true);

            // Upload avec Guzzle
            $response = $this->httpClient->post('/upload', [
                'multipart' => [
                    [
                        'name' => 'file',
                        'contents' => Utils::tryFopen($filePath, 'r'),
                        'filename' => $fileName
                    ]
                ],
                'progress' => function($downloadSize, $downloaded, $uploadSize, $uploaded) use ($options) {
                    if (isset($options['onProgress']) && $uploadSize > 0) {
                        $percentage = round(($uploaded / $uploadSize) * 100);
                        call_user_func($options['onProgress'], [
                            'percentage' => $percentage,
                            'uploaded' => $uploaded,
                            'total' => $uploadSize
                        ]);
                    }
                }
            ]);

            $result = json_decode($response->getBody(), true);
            $uploadTime = microtime(true) - $startTime;

            $this->stats['successful_uploads']++;
            $this->stats['total_bytes'] += $fileSize;

            // Callback succès
            if (isset($options['onSuccess'])) {
                call_user_func($options['onSuccess'], $result);
            }

            return array_merge($result, [
                'upload_time' => $uploadTime,
                'file_size' => $fileSize
            ]);

        } catch (RequestException $e) {
            $this->stats['failed_uploads']++;
            
            $errorMessage = $this->handleApiError($e);
            
            if (isset($options['onError'])) {
                call_user_func($options['onError'], $errorMessage);
            }

            throw new \Exception($errorMessage);
        }
    }

    /**
     * Upload multiple fichiers
     */
    public function uploadMultiple(array $filePaths, array $options = []): array
    {
        $results = [];
        
        foreach ($filePaths as $filePath) {
            try {
                $results[] = [
                    'file' => basename($filePath),
                    'status' => 'success',
                    'result' => $this->uploadFile($filePath, $options)
                ];
            } catch (\Exception $e) {
                $results[] = [
                    'file' => basename($filePath),
                    'status' => 'error',
                    'error' => $e->getMessage()
                ];
            }
        }

        return $results;
    }

    /**
     * Lister les fichiers
     */
    public function listFiles(): array
    {
        try {
            $response = $this->httpClient->get('/files');
            return json_decode($response->getBody(), true);
        } catch (RequestException $e) {
            throw new \Exception($this->handleApiError($e));
        }
    }

    /**
     * Supprimer un fichier
     */
    public function deleteFile(string $fileId): array
    {
        try {
            $response = $this->httpClient->delete("/files/{$fileId}");
            return json_decode($response->getBody(), true);
        } catch (RequestException $e) {
            throw new \Exception($this->handleApiError($e));
        }
    }

    /**
     * Obtenir les statistiques
     */
    public function getStats(): array
    {
        try {
            $response = $this->httpClient->get('/stats');
            $apiStats = json_decode($response->getBody(), true);
            
            return array_merge($this->stats, [
                'api_stats' => $apiStats,
                'success_rate' => $this->stats['total_uploads'] > 0 
                    ? round(($this->stats['successful_uploads'] / $this->stats['total_uploads']) * 100, 2)
                    : 0
            ]);
        } catch (RequestException $e) {
            throw new \Exception($this->handleApiError($e));
        }
    }

    /**
     * Obtenir les informations du compte
     */
    public function getAccountInfo(): array
    {
        try {
            $response = $this->httpClient->get('/account');
            return json_decode($response->getBody(), true);
        } catch (RequestException $e) {
            throw new \Exception($this->handleApiError($e));
        }
    }

    /**
     * Obtenir les statistiques du client
     */
    public function getClientStats(): array
    {
        $uptime = time() - $this->stats['start_time'];
        
        return [
            'total_uploads' => $this->stats['total_uploads'],
            'successful_uploads' => $this->stats['successful_uploads'],
            'failed_uploads' => $this->stats['failed_uploads'],
            'total_bytes' => $this->stats['total_bytes'],
            'success_rate' => $this->stats['total_uploads'] > 0
                ? round(($this->stats['successful_uploads'] / $this->stats['total_uploads']) * 100, 2)
                : 0,
            'uptime_hours' => round($uptime / 3600, 2)
        ];
    }

    /**
     * Reset les statistiques
     */
    public function resetStats(): void
    {
        $this->stats = [
            'total_uploads' => 0,
            'successful_uploads' => 0,
            'failed_uploads' => 0,
            'total_bytes' => 0,
            'start_time' => time()
        ];
    }

    /**
     * Gérer les erreurs de l'API
     */
    private function handleApiError(RequestException $e): string
    {
        if ($e->hasResponse()) {
            $statusCode = $e->getResponse()->getStatusCode();
            $body = json_decode($e->getResponse()->getBody(), true);

            switch ($statusCode) {
                case 401:
                    return "Clé API invalide ou expirée";
                case 403:
                    return "Accès refusé (vérifiez votre plan)";
                case 413:
                    return "Fichier trop grand pour votre plan";
                case 429:
                    return "Trop de requêtes, veuillez attendre";
                default:
                    return $body['error'] ?? "Erreur API ({$statusCode})";
            }
        }

        return "Erreur réseau: " . $e->getMessage();
    }

    /**
     * Formater la taille d'un fichier
     */
    public static function formatFileSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Valider un fichier avant upload
     */
    public static function validateFile(string $filePath, int $maxSize = 26843545600): array
    {
        if (!file_exists($filePath)) {
            return ['valid' => false, 'error' => 'Le fichier n\'existe pas'];
        }

        $fileSize = filesize($filePath);
        
        if ($fileSize > $maxSize) {
            return [
                'valid' => false,
                'error' => "Fichier trop grand (" . self::formatFileSize($fileSize) . " > " . self::formatFileSize($maxSize) . ")"
            ];
        }

        return ['valid' => true];
    }
}
