# 💎 UDCShare Ruby Gem

Gem Ruby professionnelle pour intégrer l'API UDCShare dans vos applications Rails et Ruby.

## 🎯 Cas d'usage

- Applications Ruby on Rails avec upload de fichiers
- Scripts Ruby pour automatisation
- Background jobs avec Sidekiq/Resque
- Microservices Ruby

## 🏗️ Architecture

```
ruby-upload-gem/
├── lib/
│   └── udcshare/
│       ├── version.rb          # Version
│       ├── client.rb           # Client principal
│       ├── file.rb             # Classe File
│       └── error.rb            # Erreurs personnalisées
├── examples/
│   ├── basic_upload.rb         # Upload simple
│   └── rails_integration.rb    # Exemple Rails
├── spec/
│   ├── client_spec.rb          # Specs du client
│   └── upload_spec.rb          # Specs d'upload
├── udcshare.gemspec            # Spécification Gem
├── Gemfile                     # Dépendances
└── README.md                   # Ce fichier
```

## 🚀 Installation

```bash
# Ajoutez à votre Gemfile
gem 'udcshare'

# Ou installez localement
gem install udcshare
```

## ⚙️ Configuration

```ruby
# config/initializers/udcshare.rb (Rails)
UDCShare.configure do |config|
  config.api_key = ENV['UDCSHARE_API_KEY']
  config.api_url = 'https://udcshare.com/api/v1'
end
```

## 💻 Utilisation

### Upload simple

```ruby
require 'udcshare'

client = UDCShare::Client.new('votre_clé_api')

result = client.upload_file('/path/to/document.pdf')
puts "Fichier uploadé: #{result[:file_url]}"
```

### Upload avec progression

```ruby
result = client.upload_file('/path/to/large-file.pdf') do |progress|
  puts "Progression: #{progress[:percentage]}%"
end
```

### Upload multiple

```ruby
files = ['/path/to/file1.pdf', '/path/to/file2.jpg']

results = client.upload_multiple(files)
results.each do |result|
  if result[:success]
    puts "#{result[:filename]}: #{result[:file_url]}"
  else
    puts "#{result[:filename]}: #{result[:error]}"
  end
end
```

### Lister les fichiers

```ruby
files = client.list_files
files.each do |file|
  puts "#{file[:filename]} - #{file[:file_url]}"
end
```

## 🎯 Intégration Rails

### Controller Rails

```ruby
class FilesController < ApplicationController
  def upload
    uploaded_file = params[:file]
    
    # Sauvegarder temporairement
    temp_file = uploaded_file.tempfile.path
    
    # Upload vers UDCShare
    result = UDCShare.client.upload_file(temp_file) do |progress|
      # Progression WebSocket si nécessaire
      ActionCable.server.broadcast(
        "upload_channel",
        { percentage: progress[:percentage] }
      )
    end
    
    render json: {
      success: true,
      file_url: result[:file_url],
      file_id: result[:file_id]
    }
  rescue UDCShare::Error => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
```

### Background Job avec Sidekiq

```ruby
class UDCShareUploadJob
  include Sidekiq::Worker

  def perform(file_path)
    client = UDCShare::Client.new(ENV['UDCSHARE_API_KEY'])
    result = client.upload_file(file_path)
    
    # Mettre à jour votre base de données
    FileRecord.create!(
      udcshare_file_id: result[:file_id],
      udcshare_file_url: result[:file_url],
      original_filename: result[:filename]
    )
  end
end
```

### Active Record Integration

```ruby
class User < ApplicationRecord
  has_many :files

  def upload_document(file_path)
    result = UDCShare.client.upload_file(file_path)
    
    files.create!(
      udcshare_file_id: result[:file_id],
      udcshare_file_url: result[:file_url],
      filename: result[:filename],
      filesize: result[:filesize]
    )
  end
end
```

## 🔧 Personnalisation

### Configuration globale

```ruby
UDCShare.configure do |config|
  config.api_key = 'votre_clé'
  config.api_url = 'https://udcshare.com/api/v1'
  config.timeout = 30
  config.retry_attempts = 3
  config.retry_delay = 1
end
```

### Webhooks

```ruby
client = UDCShare::Client.new('api_key', webhook_url: 'https://your-webhook.com')
```

### Logger personnalisé

```ruby
UDCShare.configure do |config|
  config.logger = Rails.logger
  config.log_level = :debug
end
```

## 📊 Monitoring

```ruby
stats = client.stats
puts "Total uploads: #{stats[:total_uploads]}"
puts "Succès: #{stats[:successful_uploads]}"
puts "Échecs: #{stats[:failed_uploads]}"
puts "Taux de succès: #{stats[:success_rate]}%"
```

## 🧪 Tests

```bash
# Lancer les specs
bundle exec rspec

# Tests avec coverage
bundle exec rspec --format documentation
```

## 📄 License

MIT License

---

**Support:** support@udcshare.com
