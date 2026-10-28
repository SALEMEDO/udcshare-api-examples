const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  // Métadonnées du fichier
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  
  // Informations UDCShare
  udcshareFileId: {
    type: String,
    required: true
  },
  udcshareFileUrl: {
    type: String,
    required: true
  },
  
  // Métadonnées personnalisées
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['document', 'image', 'video', 'audio', 'archive', 'other'],
    default: 'other'
  },
  tags: [{
    type: String
  }],
  
  // Statut
  status: {
    type: String,
    enum: ['active', 'deleted', 'processing'],
    default: 'active'
  },
  
  // Statistiques
  downloadCount: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
fileSchema.index({ userId: 1, status: 1 });
fileSchema.index({ udcshareFileId: 1 });
fileSchema.index({ uploadedAt: -1 });

// Méthode virtuelle pour vérifier si le fichier est expiré
fileSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

module.exports = mongoose.model('File', fileSchema);
