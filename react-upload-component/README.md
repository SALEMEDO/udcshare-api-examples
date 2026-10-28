# ⚛️ UDCShare React Upload Component

Composant React moderne pour intégrer l'API UDCShare dans vos applications React.

## 🎯 Cas d'usage

- Applications React/Next.js avec upload de fichiers
- Single Page Applications (SPAs)
- Applications React Native
- PWA avec upload hors-ligne

## 🏗️ Architecture

```
react-upload-component/
├── src/
│   ├── components/
│   │   ├── UDCShareUpload.jsx    # Composant principal
│   │   ├── DragDropZone.jsx      # Zone drag & drop
│   │   ├── ProgressBar.jsx       # Barre de progression
│   │   └── FileList.jsx          # Liste des fichiers
│   ├── hooks/
│   │   ├── useUDCShareUpload.jsx  # Hook personnalisé
│   │   └── useUDCShareFiles.jsx   # Hook pour fichiers
│   ├── services/
│   │   └── udcshareAPI.js        # Service API
│   └── utils/
│       └── validation.js         # Validation
├── examples/
│   ├── basic-example.jsx         # Exemple simple
│   ├── nextjs-example.jsx        # Exemple Next.js
│   └── typescript-example.tsx    # Exemple TypeScript
├── package.json                  # Dépendances
├── tsconfig.json                # Configuration TypeScript
└── README.md                    # Ce fichier
```

## 🚀 Installation

```bash
# npm
npm install @udcshare/react-upload

# yarn
yarn add @udcshare/react-upload
```

## 💻 Utilisation

### Usage basique

```jsx
import { UDCShareUpload } from '@udcshare/react-upload';

function App() {
  return (
    <UDCShareUpload
      apiKey="votre_clé_api_udcshare"
      onUploadSuccess={(result) => console.log(result)}
      onUploadError={(error) => console.error(error)}
    />
  );
}
```

### Hook personnalisé

```jsx
import { useUDCShareUpload } from '@udcshare/react-upload';

function UploadComponent() {
  const { upload, isUploading, progress, error } = useUDCShareUpload({
    apiKey: 'votre_clé_api'
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    upload(file);
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} disabled={isUploading} />
      {isUploading && <progress value={progress.percentage} max={100} />}
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

### Composant Drag & Drop

```jsx
import { DragDropZone } from '@udcshare/react-upload';

function DragDropUpload() {
  return (
    <DragDropZone
      apiKey="votre_clé_api"
      onDrop={(files) => console.log('Files dropped:', files)}
      onUploadSuccess={(result) => console.log('Upload:', result)}
      accept={['.pdf', '.jpg', '.png']}
      maxSize={25 * 1024 * 1024 * 1024} // 25GB
    >
      <p>Glissez vos fichiers ici</p>
    </DragDropZone>
  );
}
```

### Upload multiple

```jsx
import { UDCShareUpload } from '@udcshare/react-upload';

function MultipleUpload() {
  return (
    <UDCShareUpload
      apiKey="votre_clé_api"
      multiple={true}
      maxFiles={10}
      onUploadComplete={(results) => {
        console.log('All uploads completed:', results);
      }}
    />
  );
}
```

## 🎨 Props du composant

### UDCShareUpload

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| apiKey | string | requis | Votre clé API UDCShare |
| onUploadSuccess | function | - | Callback quand upload réussi |
| onUploadError | function | - | Callback quand erreur |
| onUploadProgress | function | - | Callback pendant progression |
| multiple | boolean | false | Permettre multiple fichiers |
| maxFiles | number | 10 | Maximum de fichiers |
| accept | array | - | Extensions acceptées |
| maxSize | number | 25GB | Taille max par fichier |
| autoUpload | boolean | true | Upload automatique après sélection |

## 🎯 Intégration TypeScript

```tsx
import { useUDCShareUpload } from '@udcshare/react-upload';

interface UploadResult {
  file_id: string;
  filename: string;
  file_url: string;
}

function TypeScriptUpload() {
  const { upload, isUploading } = useUDCShareUpload({
    apiKey: 'votre_clé_api'
  });

  const handleUpload = async (file: File) => {
    const result = await upload(file);
    console.log('Upload result:', result);
  };

  return <input type="file" onChange={(e) => handleUpload(e.target.files![0])} />;
}
```

## 🔧 Personnalisation

### Thème personnalisé

```jsx
<UDCShareUpload
  apiKey="votre_clé_api"
  theme={{
    primary: '#4CAF50',
    secondary: '#2196F3',
    error: '#f44336',
    success: '#4CAF50'
  }}
/>
```

### Labels personnalisés

```jsx
<UDCShareUpload
  apiKey="votre_clé_api"
  labels={{
    selectFile: 'Choisir un fichier',
    dropFiles: 'Glissez vos fichiers ici',
    uploading: 'Upload en cours...',
    success: 'Upload réussi !',
    error: 'Erreur lors de l\'upload'
  }}
/>
```

### Webhook personnalisé

```jsx
const webhookUrl = 'https://your-webhook.com';

<UDCShareUpload
  apiKey="votre_clé_api"
  onUploadSuccess={async (result) => {
    await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify(result)
    });
  }}
/>
```

## 📊 État du composant

Le hook `useUDCShareUpload` retourne :

```javascript
{
  upload: (file: File) => Promise<UploadResult>,
  isUploading: boolean,
  progress: {
    percentage: number,
    loaded: number,
    total: number
  },
  error: Error | null,
  result: UploadResult | null,
  reset: () => void
}
```

## 🧪 Tests

```bash
# Tests React Testing Library
npm test

# Tests avec coverage
npm test -- --coverage
```

## 📄 License

MIT License

---

**Support:** support@udcshare.com
