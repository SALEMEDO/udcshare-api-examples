package udcshare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"sync"
	"time"
)

// Client représente le client API UDCShare
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	options    *ClientOptions
	stats      *Stats
}

// ClientOptions représente les options du client
type ClientOptions struct {
	Timeout       time.Duration
	MaxRetries    int
	RetryDelay    time.Duration
	OnProgress    func(float64)
	OnError       func(error)
	OnSuccess     func(*UploadResult)
	UserAgent     string
}

// Stats représente les statistiques du client
type Stats struct {
	TotalUploads     int64
	SuccessfulUploads int64
	FailedUploads    int64
	TotalBytes       int64
	StartTime        time.Time
}

// UploadResult représente le résultat d'un upload
type UploadResult struct {
	FileID     string `json:"file_id"`
	Filename   string `json:"filename"`
	FileSize   int64  `json:"filesize"`
	FileURL    string `json:"file_url"`
	CreatedAt  string `json:"created_at"`
	Plan       string `json:"plan"`
	UploadTime float64
}

// FileInfo représente les informations d'un fichier
type FileInfo struct {
	ID        string `json:"id"`
	Filename  string `json:"filename"`
	FileSize  int64  `json:"filesize"`
	MimeType  string `json:"mime_type"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	FileURL   string `json:"file_url"`
}

// FilesResponse représente la réponse de l'endpoint /files
type FilesResponse struct {
	Files []FileInfo `json:"files"`
	Total int        `json:"total"`
}

// NewClient crée un nouveau client UDCShare
func NewClient(apiKey string, opts ...func(*ClientOptions)) *Client {
	options := &ClientOptions{
		Timeout:    30 * time.Second,
		MaxRetries: 3,
		RetryDelay: 1 * time.Second,
		UserAgent:  "UDCShare-Go-Client/1.0",
	}

	for _, opt := range opts {
		opt(options)
	}

	return &Client{
		apiKey:  apiKey,
		baseURL: "https://udcshare.com/api/v1",
		httpClient: &http.Client{
			Timeout: options.Timeout,
		},
		options: options,
		stats: &Stats{
			StartTime: time.Now(),
		},
	}
}

// WithTimeout configure le timeout du client
func WithTimeout(timeout time.Duration) func(*ClientOptions) {
	return func(o *ClientOptions) {
		o.Timeout = timeout
	}
}

// WithMaxRetries configure le nombre maximum de retries
func WithMaxRetries(maxRetries int) func(*ClientOptions) {
	return func(o *ClientOptions) {
		o.MaxRetries = maxRetries
	}
}

// UploadFile upload un fichier vers UDCShare
func (c *Client) UploadFile(filePath string) (*UploadResult, error) {
	return c.UploadFileWithContext(context.Background(), filePath)
}

// UploadFileWithProgress upload un fichier avec callback de progression
func (c *Client) UploadFileWithProgress(filePath string, progressFunc func(float64)) (*UploadResult, error) {
	c.options.OnProgress = progressFunc
	return c.UploadFile(filePath)
}

// UploadFileWithContext upload un fichier avec context
func (c *Client) UploadFileWithContext(ctx context.Context, filePath string) (*UploadResult, error) {
	c.stats.TotalUploads++

	// Ouvrir le fichier
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("erreur ouverture fichier: %w", err)
	}
	defer file.Close()

	// Obtenir les infos du fichier
	fileInfo, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("erreur lecture info fichier: %w", err)
	}

	fileSize := fileInfo.Size()
	fileName := fileInfo.Name()

	startTime := time.Now()

	// Préparer le multipart form
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		return nil, fmt.Errorf("erreur création form file: %w", err)
	}

	// Upload avec progression
	if c.options.OnProgress != nil {
		_, err = io.Copy(part, &progressReader{
			reader: file,
			total:  fileSize,
			current: 0,
			onProgress: c.options.OnProgress,
		})
	} else {
		_, err = io.Copy(part, file)
	}

	if err != nil {
		return nil, fmt.Errorf("erreur copie fichier: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("erreur fermeture writer: %w", err)
	}

	// Créer la requête
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/upload", &body)
	if err != nil {
		return nil, fmt.Errorf("erreur création requête: %w", err)
	}

	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("User-Agent", c.options.UserAgent)

	// Envoyer la requête avec retry
	var response *http.Response
	var lastErr error

	for i := 0; i <= c.options.MaxRetries; i++ {
		response, err = c.httpClient.Do(req)
		if err == nil {
			break
		}

		lastErr = err
		if i < c.options.MaxRetries {
			time.Sleep(c.options.RetryDelay * time.Duration(i+1))
		}
	}

	if err != nil {
		c.stats.FailedUploads++
		if c.options.OnError != nil {
			c.options.OnError(err)
		}
		return nil, fmt.Errorf("erreur requête: %w", lastErr)
	}
	defer response.Body.Close()

	// Traiter la réponse
	if response.StatusCode != http.StatusOK {
		c.stats.FailedUploads++
		errorMsg := c.handleErrorResponse(response)
		if c.options.OnError != nil {
			c.options.OnError(fmt.Errorf(errorMsg))
		}
		return nil, fmt.Errorf("erreur API: %s", errorMsg)
	}

	// Décoder la réponse
	var result UploadResult
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("erreur décodage réponse: %w", err)
	}

	result.UploadTime = time.Since(startTime).Seconds()

	c.stats.SuccessfulUploads++
	c.stats.TotalBytes += fileSize

	if c.options.OnSuccess != nil {
		c.options.OnSuccess(&result)
	}

	return &result, nil
}

// UploadMultiple upload plusieurs fichiers en parallèle
func (c *Client) UploadMultiple(filePaths []string) ([]*UploadResult, []error) {
	results := make([]*UploadResult, len(filePaths))
	errors := make([]error, len(filePaths))
	var wg sync.WaitGroup

	for i, filePath := range filePaths {
		wg.Add(1)
		go func(index int, path string) {
			defer wg.Done()
			result, err := c.UploadFile(path)
			if err != nil {
				errors[index] = err
			} else {
				results[index] = result
			}
		}(i, filePath)
	}

	wg.Wait()

	return results, errors
}

// ListFiles liste les fichiers uploadés
func (c *Client) ListFiles() (*FilesResponse, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/files", nil)
	if err != nil {
		return nil, fmt.Errorf("erreur création requête: %w", err)
	}

	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("User-Agent", c.options.UserAgent)

	response, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erreur requête: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("erreur API: %s", c.handleErrorResponse(response))
	}

	var filesResponse FilesResponse
	if err := json.NewDecoder(response.Body).Decode(&filesResponse); err != nil {
		return nil, fmt.Errorf("erreur décodage réponse: %w", err)
	}

	return &filesResponse, nil
}

// DeleteFile supprime un fichier
func (c *Client) DeleteFile(fileID string) error {
	req, err := http.NewRequest("DELETE", c.baseURL+"/files/"+fileID, nil)
	if err != nil {
		return fmt.Errorf("erreur création requête: %w", err)
	}

	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("User-Agent", c.options.UserAgent)

	response, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("erreur requête: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("erreur API: %s", c.handleErrorResponse(response))
	}

	return nil
}

// GetStats obtient les statistiques du client
func (c *Client) GetStats() *Stats {
	return c.stats
}

// ResetStats reset les statistiques
func (c *Client) ResetStats() {
	c.stats = &Stats{
		StartTime: time.Now(),
	}
}

// handleErrorResponse traite les réponses d'erreur de l'API
func (c *Client) handleErrorResponse(response *http.Response) string {
	switch response.StatusCode {
	case http.StatusUnauthorized:
		return "Clé API invalide ou expirée"
	case http.StatusForbidden:
		return "Accès refusé (vérifiez votre plan)"
	case http.StatusRequestEntityTooLarge:
		return "Fichier trop grand pour votre plan"
	case http.StatusTooManyRequests:
		return "Trop de requêtes, veuillez attendre"
	default:
		return fmt.Sprintf("Erreur HTTP %d", response.StatusCode)
	}
}

// progressReader permet de suivre la progression d'un upload
type progressReader struct {
	reader     io.Reader
	total      int64
	current    int64
	onProgress func(float64)
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	pr.current += int64(n)

	if pr.onProgress != nil && pr.total > 0 {
		progress := float64(pr.current) / float64(pr.total) * 100
		pr.onProgress(progress)
	}

	return n, err
}

// FormatBytes formate une taille en bytes
func FormatBytes(bytes int64) string {
	units := []string{"B", "KB", "MB", "GB", "TB"}
	size := float64(bytes)

	for i := 0; size >= 1024 && i < len(units)-1; i++ {
		size /= 1024
	}

	return fmt.Sprintf("%.2f %s", size, units[0])
}
