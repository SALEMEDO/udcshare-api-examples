# 🐹 UDCShare Go Backup Service

Service Go performant pour backup automatisé avec l'API UDCShare.

## 🎯 Cas d'usage

- Backup automatisé à haute performance
- Système de fichiers distribué
- Microservice Go pour gestion d'uploads
- Applications cloud-native (Docker, Kubernetes)

## 🏗️ Architecture

```
go-backup-service/
├── cmd/
│   └── backup/
│       └── main.go              # Application principale
├── pkg/
│   ├── udcshare/
│   │   ├── client.go            # Client API
│   │   ├── upload.go            # Upload logic
│   │   └── types.go             # Types Go
│   ├── storage/
│   │   └── database.go          # Stockage local
│   └── monitor/
│       └── metrics.go           # Monitoring
├── examples/
│   ├── simple-backup.go         # Backup simple
│   └── concurrent-backup.go     # Backup concurrent
├── go.mod                       # Dépendances Go
├── go.sum
├── .env.example                # Configuration
└── README.md                    # Ce fichier
```

## 🚀 Installation

```bash
# Cloner le projet
git clone https://github.com/udcshare-official/udcshare-go-backup.git
cd udcshare-go-backup

# Installer les dépendances
go mod download

# Build
go build -o backup cmd/backup/main.go
```

## ⚙️ Configuration

```env
UDCSHARE_API_KEY=votre_clé_api_udcshare
UDCSHARE_API_URL=https://udcshare.com/api/v1
BACKUP_DIRECTORY=/path/to/backup
```

## 💻 Utilisation

### Backup simple

```go
package main

import (
    "log"
    "github.com/udcshare-official/go-backup/pkg/udcshare"
)

func main() {
    client := udcshare.NewClient("votre_clé_api")
    
    result, err := client.UploadFile("/path/to/document.pdf")
    if err != nil {
        log.Fatal(err)
    }
    
    log.Printf("Upload réussi: %s", result.FileURL)
}
```

### Backup concurrent

```go
files := []string{
    "/path/to/file1.pdf",
    "/path/to/file2.jpg",
    "/path/to/file3.docx",
}

results := make(chan udcshare.UploadResult)
var wg sync.WaitGroup

for _, file := range files {
    wg.Add(1)
    go func(path string) {
        defer wg.Done()
        result, err := client.UploadFile(path)
        if err != nil {
            results <- udcshare.UploadResult{Error: err}
            return
        }
        results <- result
    }(file)
}

go func() {
    wg.Wait()
    close(results)
}()

for result := range results {
    if result.Error != nil {
        log.Printf("Erreur: %v", result.Error)
    } else {
        log.Printf("Succès: %s", result.FileURL)
    }
}
```

### Upload avec progression

```go
client.UploadFileWithProgress("/path/to/large-file.pdf", func(progress float64) {
    log.Printf("Progression: %.2f%%", progress)
})
```

## 🎯 Fonctionnalités

### ✅ Features principales

1. **Concurrence native** - Goroutines pour uploads parallèles
2. **Type safety** - Types forts Go
3. **Performance** - Basé sur http.Client performant
4. **Context aware** - Gestion des timeouts et cancellation
5. **Retry logic** - Retry automatique avec backoff
6. **Rate limiting** - Respect des limites API
7. **Monitoring** - Metrics via Prometheus
8. **Docker ready** - Containerisation native

### 📊 Monitoring

Intégration Prometheus pour :
- Upload rate
- Success rate
- Error rate
- Latency

## 🔧 Personnalisation

### Intégration avec votre base de données

```go
import "your/database"

func onUploadSuccess(result udcshare.UploadResult) {
    db.SaveFileMetadata(result)
}
```

### Webhooks personnalisés

```go
client := udcshare.NewClient("api_key", udcshare.WithWebhook("https://your-webhook.com"))
```

## 🐳 Docker

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o backup cmd/backup/main.go

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/backup .
CMD ["./backup"]
```

## 🧪 Tests

```bash
# Lancer les tests
go test ./...

# Tests avec coverage
go test -cover ./...
```

## 📄 License

MIT License

---

**Support:** support@udcshare.com
