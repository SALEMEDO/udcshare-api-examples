const axios = require('axios');

class UDCShareService {
  constructor() {
    this.apiKey = process.env.UDCSHARE_API_KEY;
    this.baseUrl = process.env.UDCSHARE_API_URL || 'https://udcshare.com/api/v1';
    this.headers = {
      'X-API-Key': this.apiKey
    };
  }

  /**
   * Upload un fichier vers UDCShare
   */
  async uploadFile(fileBuffer, filename, mimetype) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('file', fileBuffer, {
        filename,
        contentType: mimetype
      });

      const response = await axios.post(
        `${this.baseUrl}/upload`,
        form,
        {
          headers: {
            ...this.headers,
            ...form.getHeaders()
          },
          maxContentLength: 25 * 1024 * 1024 * 1024 // 25GB
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      if (error.response) {
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error || 'Erreur upload inconnue';
        
        // Gérer les erreurs spécifiques
        if (statusCode === 413) {
          throw new Error('Fichier trop grand pour votre plan');
        } else if (statusCode === 429) {
          throw new Error('Trop de requêtes, veuillez attendre');
        } else if (statusCode === 401) {
          throw new Error('Clé API invalide ou expirée');
        }
        
        throw new Error(`UDCShare API Error: ${errorMessage}`);
      }
      
      throw new Error(`Erreur réseau: ${error.message}`);
    }
  }

  /**
   * Récupérer la liste des fichiers
   */
  async listFiles() {
    try {
      const response = await axios.get(`${this.baseUrl}/files`, {
        headers: this.headers
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erreur récupération fichiers:', error);
      throw new Error('Impossible de récupérer les fichiers');
    }
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(fileId) {
    try {
      const response = await axios.delete(`${this.baseUrl}/files/${fileId}`, {
        headers: this.headers
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erreur suppression fichier:', error);
      throw new Error('Impossible de supprimer le fichier');
    }
  }

  /**
   * Obtenir les statistiques d'utilisation
   */
  async getStats() {
    try {
      const response = await axios.get(`${this.baseUrl}/stats`, {
        headers: this.headers
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erreur récupération stats:', error);
      throw new Error('Impossible de récupérer les statistiques');
    }
  }

  /**
   * Vérifier le compte et les limites
   */
  async getAccountInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/account`, {
        headers: this.headers
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Erreur compte:', error);
      throw new Error('Impossible de récupérer les informations du compte');
    }
  }
}

module.exports = new UDCShareService();
