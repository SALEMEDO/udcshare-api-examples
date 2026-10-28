const UDCShareClient = require('../udcshare');

describe('UDCShareClient', () => {
  let client;

  beforeEach(() => {
    client = new UDCShareClient('test-api-key');
  });

  it('configures the API key, URLs, and retry options', () => {
    expect(client.apiKey).toBe('test-api-key');
    expect(client.baseUrl).toBe('https://udcshare.com/api/v1');
    expect(new UDCShareClient('key', {
      baseUrl: 'https://custom.example/api',
      timeout: 60_000,
      retryAttempts: 5,
      retryDelay: 2_000
    })).toMatchObject({
      baseUrl: 'https://custom.example/api',
      timeout: 60_000,
      retryAttempts: 5,
      retryDelay: 2_000
    });
  });

  it('formats file sizes, including zero and unit boundaries', () => {
    expect(client.formatFileSize(0)).toBe('0 B');
    expect(client.formatFileSize(1)).toBe('1 B');
    expect(client.formatFileSize(1024)).toBe('1 KB');
    expect(client.formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(client.formatFileSize(5 * 1024 ** 3)).toBe('5 GB');
    expect(client.formatFileSize(1500)).toBe('1.46 KB');
  });

  it('validates file presence, name, size, and configured maximum', () => {
    expect(client.validateFile(null)).toEqual({
      valid: false,
      error: 'Aucun fichier fourni'
    });
    expect(client.validateFile({ name: '', size: 12 }).valid).toBe(false);
    expect(client.validateFile({ name: 'file.pdf', size: -1 }).valid).toBe(false);
    expect(client.validateFile({ name: 'file.pdf', size: 0 }).valid).toBe(true);
    expect(client.validateFile({ name: 'large.pdf', size: 11 }, 10)).toMatchObject({
      valid: false,
      error: expect.stringContaining('Fichier trop grand')
    });
    expect(client.validateFile({ name: 'limit.pdf', size: 10 }, 10).valid).toBe(true);
  });

  it('sends API requests with the configured key and base URL', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: [] })
    });

    try {
      await expect(client.listFiles()).resolves.toEqual({ files: [] });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://udcshare.com/api/v1/files',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-API-Key': 'test-api-key' })
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
