# 💚 UDCShare Vue.js Upload Component

Composant Vue.js moderne pour intégrer l'API UDCShare dans vos applications Vue.

## 🎯 Cas d'usage

- Applications Vue 3 avec Composition API
- Applications Nuxt.js
- Applications Vue 2 (supporté)
- Vite-based projects

## 🏗️ Architecture

```
vue-upload-component/
├── src/
│   ├── components/
│   │   ├── UDCShareUpload.vue   # Composant principal
│   │   ├── DragDropZone.vue     # Zone drag & drop
│   │   └── ProgressBar.vue      # Barre de progression
│   ├── composables/
│   │   ├── useUDCShare.js      # Composable
│   │   └── useUDCShareFiles.js # Composable fichiers
│   ├── services/
│   │   └── udcshareAPI.js      # Service API
│   └── utils/
│       └── validation.js       # Validation
├── examples/
│   ├── basic-example.vue       # Exemple simple
│   ├── nuxt3-example.vue       # Exemple Nuxt 3
│   └── typescript-example.vue  # Exemple TypeScript
├── package.json                # Dépendances
├── vite.config.js             # Configuration Vite
└── README.md                  # Ce fichier
```

## 🚀 Installation

```bash
# npm
npm install @udcshare/vue-upload

# yarn
yarn add @udcshare/vue-upload

# pnpm
pnpm add @udcshare/vue-upload
```

## 💻 Utilisation

### Vue 3 - Usage basique

```vue
<template>
  <UDCShareUpload
    :api-key="apiKey"
    @upload-success="onSuccess"
    @upload-error="onError"
  />
</template>

<script setup>
import { ref } from 'vue';
import { UDCShareUpload } from '@udcshare/vue-upload';

const apiKey = ref('votre_clé_api_udcshare');

const onSuccess = (result) => {
  console.log('Upload réussi:', result);
};

const onError = (error) => {
  console.error('Erreur:', error);
};
</script>
```

### Vue 3 - Composition API avec Composable

```vue
<template>
  <div>
    <input type="file" @change="handleFileChange" :disabled="isUploading" />
    <progress v-if="isUploading" :value="progress.percentage" max="100" />
    <p v-if="error">{{ error.message }}</p>
  </div>
</template>

<script setup>
import { useUDCShareUpload } from '@udcshare/vue-upload';

const { upload, isUploading, progress, error } = useUDCShareUpload({
  apiKey: 'votre_clé_api'
});

const handleFileChange = (e) => {
  const file = e.target.files[0];
  upload(file);
};
</script>
```

### Nuxt 3 Integration

```vue
<template>
  <UDCShareUpload
    :api-key="config.public.udcshareApiKey"
    @upload-success="onSuccess"
  />
</template>

<script setup>
const config = useRuntimeConfig();

const onSuccess = (result) => {
  console.log('Upload:', result);
};
</script>
```

### Drag & Drop

```vue
<template>
  <DragDropZone
    :api-key="apiKey"
    @drop="handleDrop"
    @upload-success="onSuccess"
    :accept="['.pdf', '.jpg', '.png']"
    :max-size="25 * 1024 * 1024 * 1024"
  >
    <p>Glissez vos fichiers ici</p>
  </DragDropZone>
</template>
```

### Upload multiple

```vue
<template>
  <UDCShareUpload
    :api-key="apiKey"
    :multiple="true"
    :max-files="10"
    @upload-complete="onComplete"
  />
</template>
```

## 🎨 Props du composant

### UDCShareUpload

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| apiKey | string | requis | Votre clé API UDCShare |
| multiple | boolean | false | Permettre multiple fichiers |
| maxFiles | number | 10 | Maximum de fichiers |
| accept | array | - | Extensions acceptées |
| maxSize | number | 25GB | Taille max par fichier |
| autoUpload | boolean | true | Upload automatique |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| upload-success | result | Émis quand upload réussi |
| upload-error | error | Émis quand erreur |
| upload-progress | progress | Émis pendant progression |
| upload-complete | results | Émis quand tous les uploads terminés |

## 🔧 Personnalisation

### Thème personnalisé

```vue
<template>
  <UDCShareUpload
    :api-key="apiKey"
    :theme="{
      primary: '#4CAF50',
      secondary: '#2196F3',
      error: '#f44336',
      success: '#4CAF50'
    }"
  />
</template>
```

### Labels personnalisés

```vue
<template>
  <UDCShareUpload
    :api-key="apiKey"
    :labels="{
      selectFile: 'Choisir un fichier',
      dropFiles: 'Glissez vos fichiers ici',
      uploading: 'Upload en cours...',
      success: 'Upload réussi !',
      error: 'Erreur lors de l\'upload'
    }"
  />
</template>
```

## 📊 State du composable

Le composable `useUDCShareUpload` retourne :

```javascript
{
  upload: (file: File) => Promise<UploadResult>,
  isUploading: Ref<boolean>,
  progress: Ref<{ percentage: number, loaded: number, total: number }>,
  error: Ref<Error | null>,
  result: Ref<UploadResult | null>,
  reset: () => void,
  cancel: () => void
}
```

## 🧪 Tests

```bash
# Tests Vitest
npm test

# Tests avec coverage
npm run test:coverage
```

## 📄 License

MIT License

---

**Support:** support@udcshare.com
