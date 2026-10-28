require_relative 'lib/udcshare/version'

Gem::Specification.new do |spec|
  spec.name          = "udcshare"
  spec.version       = UDCShare::VERSION
  spec.authors       = ["UDCShare Team"]
  spec.email         = ["support@udcshare.com"]

  spec.summary       = "Client Ruby pour l'API UDCShare"
  spec.description   = "Gem Ruby professionnelle pour intégrer l'API REST UDCShare dans vos applications Rails et Ruby"
  spec.homepage      = "https://github.com/udcshare-official/udcshare-ruby"
  spec.license       = "MIT"
  spec.required_ruby_version = ">= 2.7.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/udcshare-official/udcshare-ruby"

  spec.files = Dir.chdir(__dir__) do
    `git ls-files -z`.split("\x0").reject do |f|
      (f == __FILE__) || f.match(%r{\A(?:(?:bin|test|spec|features)/|\.(?:git|travis|circleci)|appveyor)})
    end
  end
  spec.bindir        = "exe"
  spec.executables   = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  spec.add_dependency "faraday", "~> 2.0"
  spec.add_dependency "faraday-multipart", "~> 1.0"

  spec.add_development_dependency "rspec", "~> 3.12"
  spec.add_development_dependency "rubocop", "~> 1.50"
  spec.add_development_dependency "simplecov", "~> 0.22"
end
