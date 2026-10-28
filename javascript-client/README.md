# 💻 UDCShare JavaScript Client

Client JavaScript vanilla pour intégrer UDCShare directement dans vos pages web.

## 🎯 Cas d'usage

Client frontend JavaScript pour les sites web qui veulent :
- Intégrer UDCShare sans backend
- Permettre aux utilisateurs d'uploader des fichiers directement
- Fonctionner sur tous les navigateurs modernes
- Aucune dépendance externe (vanilla JS)

## 🏗️ Architecture

```
javascript-client/
├── udcshare.js              # Client principal
├── udcshare-widget.js       # Widget d'upload
├── examples/
│   ├── basic-upload.html    # Upload simple
│   ├── drag-drop.html        # Drag & drop
│   └── gallery-upload.html   # Upload avec galerie
├── README.md                 # Ce fichier
└── dist/                     # Version minifiée (générée)
```

## 🚀 Installation

### 1. Copier le fichier JavaScript

```html
<script src="path/to/udcshare.js"></script>
```

### 2. Initialiser avec votre clé API

```javascript
const udcshare = new UDCShareClient('votre_clé_api_udcshare');
```

### 3. Utiliser dans votre page

```html
<input type="file" id="fileInput">
<button onclick="uploadFile()">Uploader</button>

<script>
  async function uploadFile() {
    const file = document.getElementById('fileInput').files[0];
    const result = await udcshare.uploadFile(file);
    console.log('Upload réussi:', result);
  }
</script>
```

## 💻 Utilisation

### Upload simple

```javascript
const udcshare = new UDCShareClient('votre_clé_api');

// Upload avec callback
udcshare.uploadFile(fileObject, (result) => {
  console.log('Succès:', result);
}, (error) => {
  console.error('Erreur:', error);
});

// Upload avec Promises
udcshare.uploadFile(fileObject)
  .then(result => console.log('Succès:', result))
  .catch(error => console.error('Erreur:', error));

// Upload avec async/await
const result = await udcshare.uploadFile(fileObject);
```

### Upload avec progression

```javascript
const result = await udcshare.uploadFile(fileObject, {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% uploadé`);
  },
  onComplete: (result) => {
    console.log('Upload terminé:', result);
  }
});
```

### Upload multiple

```javascript
const files = document.getElementById('fileInput').files;

for (const file of files) {
  await udcshare.uploadFile(file);
  console.log(`${file.name} uploadé`);
}
```

### Drag & Drop

```html
<div id="dropZone">
  <p>Glissez vos fichiers ici</p>
</div>

<script>
  const dropZone = document.getElementById('dropZone');
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    for (const file of e.dataTransfer.files) {
      await udcshare.uploadFile(file);
    }
  });
</script>
```

### Liste des fichiers

```javascript
const files = await udcshare.listFiles();
console.log('Fichiers:', files.files);
```

### Suppression

```javascript
await udcshare.deleteFile(fileId);
console.log('Fichier supprimé');
```

## 🎨 Intégration dans votre page

### Composant d'upload

```html
<div class="udcshare-upload-widget">
  <div class="upload-area">
    <input type="file" id="udcshareFile" hidden>
    <button onclick="document.getElementById('udcshareFile').click()">
      Choisir un fichier
    </button>
    <div class="drop-zone">
      Glissez vos fichiers ici
    </div>
  </div>
  <div class="progress" style="display:none">
    <div class="progress-bar"></div>
    <span class="progress-text">0%</span>
  </div>
</div>

<script>
  const udcshare = new UDCShareClient('votre_clé_api');
  
  // Implement drag & drop
  // Show progress
  // Handle success/error
</script>
```

### Gallery avec thumbnails

```javascript
const files = await udcshare.listFiles();

files.files.forEach(file => {
  const galleryItem = document.createElement('div');
  galleryItem.className = 'gallery-item';
  galleryItem.innerHTML = `
    <div class="file-preview">
      <a href="${file.file_url}" target="_blank">
        ${file.filename}
      </a>
    </div>
    <button onclick="deleteFile('${file.id}')">
      Supprimer
    </button>
  `;
  document.getElementById('gallery').appendChild(galleryItem);
});
```

## 🎯 Fonctionnalités

### ✅ Features principales

1. **Upload simple** avec callback ou Promise
2. **Progress tracking** en temps réel
3. **Error handling** robuste
4. **Drag & drop** natif
5. **Multiple file upload**
6. **Liste des fichiers** avec pagination
7. **Suppression** de fichiers
8. **Gestion des erreurs** automatique
9. **Compression** automatique (optionnelle)
10. **Respect des limites** de l'API

### 📊 Monitoring

Le client JavaScript inclut :
- Temps d'upload par fichier
- Taux de succès/échec
- Utilisation de l'API
- Alertes visuelles

### 🔒 Sécurité

- Validation des fichiers côté client
- Vérification de la taille
- Type checking
- Sanitization des inputs

## 🎓 Exemples complets

### Formulaire d'upload avec preview

```html
<!DOCTYPE html>
<html>
<head>
  <title>Upload UDCShare</title>
  <style>
    .upload-form {
      max-width: 600px;
      margin: 50px auto;
      padding: 30px;
      border: 2px dashed #ccc;
      border-radius: 10px;
    }
    .progress {
      height: 20px;
      background: #f0f0f0;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-bar {
      height: 100%;
      background: #4CAF50;
      width: 0%;
      transition: width 0.3s;
    }
  </style>
</head>
<body>
  <div class="upload-form">
    <h2>Upload vos fichiers</h2>
    <input type="file" id="fileInput" multiple>
    <button onclick="uploadFiles()">Uploader</button>
    <div class="progress" id="progressBar" style="display:none">
      <div class="progress-bar" id="progressFill"></div>
    </div>
    <div id="results"></div>
  </div>

  <script src="udcshare.js"></script>
  <script>
    const udcshare = new UDCShareClient('votre_clé_api');

    async function uploadFiles() {
      const files = document.getElementById('fileInput').files;
      const progressDiv = document.getElementById('progressBar');
      const progressFill = document.getElementById('progressFill');
      const results = document.getElementById('results');
      
      progressDiv.style.display = 'block';
      results.innerHTML = '';
      
      for (let i = 0; i < files.length; i++) {
        const progress = (i / files.length) * 100;
        progressFill.style.width = `${progress}%`;
        
        try {
          const result = await udcshare.uploadFile(files[i]);
          results.innerHTML += `<p>✅ ${files[i].name}: <a href="${result.file_url}" target="_blank">${result.file_url}</a></p>`;
        } catch (error) {
          results.innerHTML += `<p>❌ ${files[i].name}: ${error.message}</p>`;
        }
      }
      
      progressFill.style.width = '100%';
      setTimeout(() => {
        progressDiv.style.display = 'none';
        progressFill.style.width = '0%';
      }, 1000);
    }
  </script>
</body>
</html>
```

### Widget d'upload réutilisable

```javascript
class UDCShareWidget {
  constructor(apiKey, containerId) {
    this.apiKey = apiKey;
    this.container = document.getElementById(containerId);
    this.udcshare = new UDCShareClient(apiKey);
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="udcshare-widget">
        <div class="upload-area">
          <input type="file" id="udcshare-file" hidden multiple>
          <button id="select-files">Sélectionner fichiers</button>
          <div id="drop-zone">Glissez vos fichiers ici</div>
        </div>
        <div class="status"></div>
      </div>
    `;
    
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Implement drag & drop et autres interactions
  }
}
```

## 🧪 Tests

```javascript
// Test basique
const udcshare = new UDCShareClient('test_key');

udcshare.getAccountInfo()
  .then(account => console.log('Account:', account))
  .catch(error => console.error('Erreur:', error));
```

## 🎨 Personnalisation

### Adapter pour votre design

Le client est facile à personnaliser :
- Modifiez le CSS des widgets
- Changez les messages d'erreur
- Adaptez l'interface selon vos besoins

### Webhooks

```javascript
const result = await udcshare.uploadFile(file, {
  onSuccess: (data) => {
    // Envoyer à votre serveur
    fetch('/api/file-uploaded', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
});
```

## 📱 Compatibilité

- ✅ Chrome (dernières versions)
- ✅ Firefox (dernières versions)
- ✅ Safari (dernières versions)
- ✅ Edge (dernières versions)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🚨 Limitations

- **Taille max** selon votre plan UDCShare
- **Rate limiting** automatique
- **Dépendance** à JavaScript activé
- **CORS** doit être configuré sur votre serveur

## 🤝 Contribution

Ce projet est open source. N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Soumettre des pull requests

## 📄 License

MIT License - Utilisez librement dans vos projets.

---

**Support:** support@udcshare.com
**Documentation:** https://udcshare.com/api
