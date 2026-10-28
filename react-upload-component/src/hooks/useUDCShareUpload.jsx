import { useState, useCallback, useRef } from 'react';

export const useUDCShareUpload = ({ apiKey, baseUrl = 'https://udcshare.com/api/v1', options = {} }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, loaded: 0, total: 0 });
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const abortControllerRef = useRef(null);

  const upload = useCallback(async (file) => {
    if (!file) {
      setError(new Error('Aucun fichier fourni'));
      return null;
    }

    if (!apiKey) {
      setError(new Error('Clé API requise'));
      return null;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);
    setProgress({ percentage: 0, loaded: 0, total: file.size });

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
        body: formData,
        signal: abortControllerRef.current.signal,

        // Progress tracking using XHR
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          const percentage = Math.round((loaded / total) * 100);
          setProgress({ percentage, loaded, total });

          if (options.onUploadProgress) {
            options.onUploadProgress({ percentage, loaded, total });
          }
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      
      setResult(data);
      
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
      setError(new Error(errorMessage));

      if (options.onError) {
        options.onError(new Error(errorMessage));
      }

      throw err;
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [apiKey, baseUrl, options]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      setError(new Error('Upload annulé'));
    }
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setError(null);
    setResult(null);
    setProgress({ percentage: 0, loaded: 0, total: 0 });
  }, []);

  return {
    upload,
    isUploading,
    progress,
    error,
    result,
    cancelUpload,
    reset
  };
};

export default useUDCShareUpload;
