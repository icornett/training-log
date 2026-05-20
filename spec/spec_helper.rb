# frozen_string_literal: true

ENV['RACK_ENV'] = 'test'

require 'rspec'
require 'rack/test'
require 'capybara/rspec'

require_relative '../workouts'

Dir[File.join(File.dirname(__FILE__), 'support', '**', '*.rb')].each do |f|
  require f
end

RSpec.configure do |config|
  config.include Rack::Test::Methods, type: :integration

  config.include Capybara::DSL, type: :e2e
  config.after(:each, type: :e2e) { Capybara.reset_sessions! }

  config.expect_with :rspec do |c|
    c.syntax = :expect
  end

  config.order = :random
  config.seed = rand(0xFFFF)
end

Capybara.app = Sinatra::Application
Capybara.default_driver = :rack_test
