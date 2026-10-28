jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn()
}));

const mockAxios = require('axios');
const udcshareService = require('../src/services/udcshareService');
const File = require('../src/models/File');

describe('UDCShare Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf'
      };

      const mockResponse = {
        data: {
          file_id: 'test-id',
          filename: 'test.pdf',
          file_url: 'https://udcshare.com/d/test-id'
        }
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await udcshareService.uploadFile(
        mockFile.buffer,
        mockFile.originalname,
        mockFile.mimetype
      );

      expect(result.success).toBe(true);
      expect(result.data.file_id).toBe('test-id');
      expect(mockAxios.post).toHaveBeenCalled();
    });

    it('should handle 413 error (file too large)', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'large.pdf',
        mimetype: 'application/pdf'
      };

      mockAxios.post.mockRejectedValue({
        response: {
          status: 413
        }
      });

      await expect(
        udcshareService.uploadFile(mockFile.buffer, mockFile.originalname, mockFile.mimetype)
      ).rejects.toThrow('Fichier trop grand pour votre plan');
    });

    it('should handle 429 error (rate limit)', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf'
      };

      mockAxios.post.mockRejectedValue({
        response: {
          status: 429
        }
      });

      await expect(
        udcshareService.uploadFile(mockFile.buffer, mockFile.originalname, mockFile.mimetype)
      ).rejects.toThrow('Trop de requêtes, veuillez attendre');
    });

    it('should handle 401 error (invalid API key)', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf'
      };

      mockAxios.post.mockRejectedValue({
        response: {
          status: 401
        }
      });

      await expect(
        udcshareService.uploadFile(mockFile.buffer, mockFile.originalname, mockFile.mimetype)
      ).rejects.toThrow('Clé API invalide ou expirée');
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const mockResponse = {
        data: {
          files: [
            {
              id: 'file1',
              filename: 'test.pdf',
              filesize: 1024
            }
          ],
          total: 1
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await udcshareService.listFiles();

      expect(result.success).toBe(true);
      expect(result.data.files.length).toBe(1);
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.any(Object)
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Fichier supprimé'
        }
      };

      mockAxios.delete.mockResolvedValue(mockResponse);

      const result = await udcshareService.deleteFile('file-id');

      expect(result.success).toBe(true);
      expect(mockAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-id'),
        expect.any(Object)
      );
    });
  });

  describe('getStats', () => {
    it('should get stats successfully', async () => {
      const mockResponse = {
        data: {
          total_files: 10,
          total_storage_bytes: 1024000,
          total_storage_gb: 1
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await udcshareService.getStats();

      expect(result.success).toBe(true);
      expect(result.data.total_files).toBe(10);
    });
  });

  describe('getAccountInfo', () => {
    it('should get account info successfully', async () => {
      const mockResponse = {
        data: {
          id: 'user-id',
          email: 'test@example.com',
          plan: 'pro'
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      const result = await udcshareService.getAccountInfo();

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('test@example.com');
    });
  });
});

describe('File Model', () => {
  it('should create a new file', () => {
    const file = new File({
      originalName: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      udcshareFileId: 'file-id',
      udcshareFileUrl: 'https://udcshare.com/d/file-id',
      userId: 'user-id'
    });

    expect(file.originalName).toBe('test.pdf');
    expect(file.mimetype).toBe('application/pdf');
    expect(file.size).toBe(1024);
  });

  it('should check if file is expired', () => {
    const file = new File({
      originalName: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      udcshareFileId: 'file-id',
      udcshareFileUrl: 'https://udcshare.com/d/file-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() - 10000) // Expired 10 seconds ago
    });

    expect(file.isExpired()).toBe(true);

    const nonExpiredFile = new File({
      originalName: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      udcshareFileId: 'file-id',
      udcshareFileUrl: 'https://udcshare.com/d/file-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 86400000) // Expires in 24 hours
    });

    expect(nonExpiredFile.isExpired()).toBe(false);
  });
});
