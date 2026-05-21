# frozen_string_literal: true

# Connection configuration helpers for DatabaseAccess.
module DatabaseAccessConnectionConfig
  private

  def connection_config
    database_url = configured_database_url
    return database_url if database_url

    host = env_first('DB_HOST', 'PGHOST')

    {
      dbname: env_first('DB_NAME', 'PGDATABASE') || 'training_log',
      host: host,
      port: env_first('DB_PORT', 'PGPORT'),
      user: env_first('DB_USER', 'PGUSER'),
      password: env_first('DB_PASSWORD', 'PGPASSWORD'),
      sslmode: resolved_sslmode(host)
    }.compact
  end

  def configured_database_url
    url = ENV.fetch('DATABASE_URL', nil)
    return nil if url.nil? || url.empty?

    url
  end

  def env_first(*keys)
    keys.each do |key|
      value = ENV.fetch(key, nil)
      return value unless value.nil? || value.empty?
    end
    nil
  end

  def resolved_sslmode(host)
    explicit_sslmode = env_first('DB_SSLMODE', 'PGSSLMODE')
    return explicit_sslmode if explicit_sslmode
    return 'require' if azure_postgres_host?(host)

    nil
  end

  def azure_postgres_host?(host)
    host.to_s.include?('.postgres.database.azure.com')
  end
end
