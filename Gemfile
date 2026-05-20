source "https://rubygems.org"

ruby "4.0.4"

gem "sinatra", "~> 4.2", ">= 4.2.1"
gem "sinatra-contrib", "~> 4.2", ">= 4.2.1"
gem "erubi"
gem "json", ">= 2.19.2"
gem "net-imap", ">= 0.6.4"
gem "rackup"
gem "puma"
gem "webrick", "~> 1.9"

gem "pg", "~> 1.6", ">= 1.6.3"
gem "bcrypt"

group :development do
  gem "pry"
  gem "sinatra-reloader"
  gem "overcommit"
end

group :test do
  gem "rspec"
  gem "rack-test"
  gem "capybara"
  gem "database_cleaner-sequel"
  gem "sequel"
  gem "sqlite3", "2.9.4"
  gem "rubocop"
  gem "rubocop-rspec"
  gem "rubocop-performance"
  gem 'code-scanning-rubocop', '~> 0.6.1'
  gem "brakeman"
  gem "bundler-audit"
  gem "erb_lint"
end