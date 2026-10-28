import { ref, computed } from 'vue';

export function useUDCShareUpload({ apiKey, baseUrl = 'https://udcshare.com/api/v1', options = {} }) {
  const isUploading = ref(false);
  const progress = ref({ percentage: 0, loaded: 0, total: 0 });
  const error = ref(null);
  const result = ref(null);
  const abortController = ref(null);

  const upload = async (file) => {
    if (!file) {
      error.value = new Error('Aucun fichier fourni');
      return null;
    }

    if (!apiKey) {
      error.value = new Error('Clé API requise');
      return null;
    }

    isUploading.value = true;
    error.value = null;
    result.value = null;
    progress.value = { percentage: 0, loaded: 0, total: file.size };

    abortController.value = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
        body: formData,
        signal: abortController.value.signal
      });

      // Progress tracking
      if (response.body) {
        const reader = response.body.getReader();
        const total = file.size;
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          loaded += value.length;
          const percentage = Math.round((loaded / total) * 100);
          progress.value = { percentage, loaded, total };

          if (options.onUploadProgress) {
            options.onUploadProgress({ percentage, loaded, total });
          }
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      
      result.value = data;
      
      if (options.onSuccess) {
        options.onSuccess(data);
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Upload annulé');
        return null;
      }

      const errorMessage = err.message || 'Erreur lors de l\'upload';
      error.value = new Error(errorMessage);

      if (options.onError) {
        options.onError(new Error(errorMessage));
      }

      throw err;
    } finally {
      isUploading.value = false;
      abortController.value = null;
    }
  };

  const cancelUpload = () => {
    if (abortController.value) {
      abortController.value.abort();
      isUploading.value = false;
      error.value = new Error('Upload annulé');
    }
  };

  const reset = () => {
    isUploading.value = false;
    error.value = null;
    result.value = null;
    progress.value = { percentage: 0, loaded: 0, total: 0 };
  };

  return {
    upload,
    isUploading,
    progress,
    error,
    result,
    cancelUpload,
    reset
  };
}

export default useUDCShareUpload;
