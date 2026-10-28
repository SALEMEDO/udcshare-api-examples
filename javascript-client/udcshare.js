/**
 * UDCShare JavaScript Client
 * Client vanilla JavaScript pour l'API UDCShare
 * Aucune dépendance externe requise
 */

class UDCShareClient {
  /**
   * Initialise le client UDCShare
   * @param {string} apiKey - Votre clé API UDCShare
   * @param {Object} options - Options de configuration
   */
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://udcshare.com/api/v1';
    this.timeout = options.timeout || 30000; // 30 secondes par défaut
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Upload un fichier vers UDCShare
   * @param {File} file - Fichier à uploader
   * @param {Object} options - Options d'upload
   * @returns {Promise<Object>} Résultat de l'upload
   */
  uploadFile(file, options = {}) {
    return new Promise((resolve, reject) => {
      // Validation
      if (!file) {
        reject(new Error('Aucun fichier fourni'));
        return;
      }

      if (!this.apiKey) {
        reject(new Error('Clé API requise'));
        return;
      }

      // Préparer FormData
      const formData = new FormData();
      formData.append('file', file);

      // Options de progression
      const onProgress = options.onProgress || (() => {});
      const onComplete = options.onComplete || (() => {});
      const onError = options.onError || (() => {});

      // Upload avec XMLHttpRequest pour la progression
      this._uploadWithXHR(formData, {
        onProgress: (loaded, total) => {
          const percentage = Math.round((loaded / total) * 100);
          onProgress({ percentage, loaded, total });
        },
        onSuccess: (response) => {
          onComplete(response);
          resolve(response);
        },
        onError: (error) => {
          onError(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Upload avec XMLHttpRequest (pour la progression)
   */
  _uploadWithXHR(formData, callbacks) {
    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', `${this.baseUrl}/upload`, true);
    xhr.setRequestHeader('X-API-Key', this.apiKey);
    
    // Progress tracking
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        callbacks.onProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          callbacks.onSuccess(response);
        } catch (error) {
          callbacks.onError(new Error('Erreur de réponse JSON'));
        }
      } else {
        this._handleErrorResponse(xhr, callbacks.onError);
      }
    });

    xhr.addEventListener('error', () => {
      callbacks.onError(new Error('Erreur réseau'));
    });

    xhr.timeout = this.timeout;
    xhr.addEventListener('timeout', () => {
      callbacks.onError(new Error('Timeout'));
      xhr.abort();
    });

    xhr.send(formData);
  }

  /**
   * Gère les réponses d'erreur de l'API
   */
  _handleErrorResponse(xhr, errorCallback) {
    let errorMessage = 'Erreur upload inconnue';
    
    try {
      const response = JSON.parse(xhr.responseText);
      if (response.error) {
        errorMessage = response.error;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }

    // Erreurs spécifiques selon le code HTTP
    if (xhr.status === 401) {
      errorMessage = 'Clé API invalide ou expirée';
    } else if (xhr.status === 403) {
      errorMessage = 'Accès refusé (vérifiez votre plan)';
    } else if (xhr.status === 413) {
      errorMessage = 'Fichier trop grand pour votre plan';
    } else if (xhr.status === 429) {
      errorMessage = 'Trop de requêtes, veuillez attendre';
    }

    errorCallback(new Error(errorMessage));
  }

  /**
   * Récupère les informations du compte
   * @returns {Promise<Object>} Informations du compte
   */
  async getAccountInfo() {
    return this._makeRequest('GET', '/account');
  }

  /**
   * Récupère la liste des fichiers
   * @returns {Promise<Object>} Liste des fichiers
   */
  async listFiles() {
    return this._makeRequest('GET', '/files');
  }

  /**
   * Supprime un fichier
   * @param {string} fileId - ID du fichier à supprimer
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteFile(fileId) {
    return this._makeRequest('DELETE', `/files/${fileId}`);
  }

  /**
   * Récupère les statistiques
   * @returns {Promise<Object>} Statistiques d'utilisation
   */
  async getStats() {
    return this._makeRequest('GET', '/stats');
  }

  /**
   * Effectue une requête API avec retry automatique
   */
  async _makeRequest(method, endpoint, data = null, retries = this.retryAttempts) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: method,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': data ? 'application/json' : undefined
        },
        body: data ? JSON.stringify(data) : undefined
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }
    } catch (error) {
      if (retries > 0) {
        console.warn(`Erreur, retry dans ${this.retryDelay}ms... (${retries} tentatives restantes)`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this._makeRequest(method, endpoint, data, retries - 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * Validation de fichier avant upload
   */
  validateFile(file, maxSize = 25 * 1024 * 1024 * 1024) {
    
    if (!file) {
      return { valid: false, error: 'Aucun fichier fourni' };
    }

    if (typeof file.name !== 'string' || !file.name.trim()) {
      return { valid: false, error: 'Nom de fichier manquant' };
    }

    if (!Number.isFinite(file.size) || file.size < 0) {
      return { valid: false, error: 'Taille de fichier invalide' };
    }

    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `Fichier trop grand (${this.formatFileSize(file.size)} > ${this.formatFileSize(maxSize)})`
      };
    }

    return { valid: true };
  }

  /**
   * Formate la taille d'un fichier
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Vérifie les limites de l'API
   */
  async checkLimits() {
    try {
      const accountInfo = await this.getAccountInfo();
      return accountInfo.api_limits || {};
    } catch (error) {
      console.error('Erreur vérification des limites:', error);
      return {};
    }
  }

  /**
   * Upload multiple avec gestion automatique des limites
   */
  async uploadMultipleFiles(files) {
    const results = [];
    const limits = await this.checkLimits();
    
    for (let i = 0; i < files.length; i++) {
      // Vérifier si on a atteint la limite quotidienne
      if (limits.max_files_per_day && i >= limits.max_files_per_day) {
        results.push({
          file: files[i],
          status: 'skipped',
          reason: 'Limite quotidienne atteinte'
        });
        continue;
      }

      try {
        const result = await this.uploadFile(files[i]);
        results.push({
          file: files[i],
          status: 'success',
          result
        });
        
        // Délai entre uploads pour respecter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          file: files[i],
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }
}

// Export pour utilisation directe dans le navigateur
if (typeof window !== 'undefined') {
  window.UDCShareClient = UDCShareClient;
}

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UDCShareClient;
}
