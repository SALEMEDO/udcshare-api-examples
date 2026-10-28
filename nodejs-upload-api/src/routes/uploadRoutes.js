const express = require('express');
const router = express.Router();
const udcshareService = require('../services/udcshareService');
const File = require('../models/File');

/**
 * POST /api/upload
 * Upload un fichier vers UDCShare
 */
router.post('/upload', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const userId = req.user?.id; // À implémenter selon votre système d'auth
    
    // Upload vers UDCShare
    const result = await udcshareService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Sauvegarder dans MongoDB
    const fileRecord = new File({
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      udcshareFileId: result.data.file_id,
      udcshareFileUrl: result.data.file_url,
      userId: userId || null, // Adapter selon votre système d'auth
      category: 'document'
    });

    await fileRecord.save();

    res.json({
      success: true,
      file: {
        id: fileRecord._id,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        udcshareFileId: fileRecord.udcshareFileId,
        udcshareFileUrl: fileRecord.udcshareFileUrl,
        uploadedAt: fileRecord.uploadedAt
      },
      api_response: result.data
    });

  } catch (error) {
    console.error('Erreur upload:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files
 * Lister les fichiers uploadés
 */
router.get('/files', async (req, res) => {
  try {
    const userId = req.user?.id; // Adapter selon votre système d'auth
    
    const files = await File.find({ 
      userId: userId,
      status: 'active'
    }).sort({ uploadedAt: -1 });

    res.json({
      success: true,
      files: files,
      total: files.length
    });

  } catch (error) {
    console.error('Erreur liste fichiers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/files/:id
 * Supprimer un fichier
 */
router.delete('/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    // Supprimer de UDCShare
    await udcshareService.deleteFile(file.udcshareFileId);

    // Marquer comme supprimé dans MongoDB
    file.status = 'deleted';
    await file.save();

    res.json({
      success: true,
      message: 'Fichier supprimé'
    });

  } catch (error) {
    console.error('Erreur suppression fichier:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats
 * Statistiques d'utilisation
 */
router.get('/stats', async (req, res) => {
  try {
    // Stats UDCShare API
    const udcshareStats = await udcshareService.getStats();
    
    // Stats locale MongoDB
    const userId = req.user?.id;
    const totalFiles = await File.countDocuments({ userId, status: 'active' });
    const totalStorage = await File.aggregate([
      { $match: { userId, status: 'active' } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]);

    res.json({
      success: true,
      udcshare: udcshareStats.data,
      local: {
        totalFiles,
        totalStorage: totalStorage[0]?.totalSize || 0
      }
    });

  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
