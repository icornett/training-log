import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

const envFirst = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim() !== '') {
      return value
    }
  }

  return undefined
}

const azureHost = (host: string | undefined): boolean => {
  return typeof host === 'string' && host.includes('.postgres.database.azure.com')
}

const configuredUrl = envFirst('DATABASE_URL')
const host = envFirst('DB_HOST', 'PGHOST')
const sslMode = envFirst('DB_SSLMODE', 'PGSSLMODE')

const pool = configuredUrl
  ? new Pool({
      connectionString: configuredUrl,
      ssl: configuredUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({
      database: envFirst('DB_NAME', 'PGDATABASE') ?? 'training_log',
      host,
      port: envFirst('DB_PORT', 'PGPORT') ? Number(envFirst('DB_PORT', 'PGPORT')) : undefined,
      user: envFirst('DB_USER', 'PGUSER'),
      password: envFirst('DB_PASSWORD', 'PGPASSWORD'),
      ssl:
        sslMode === 'require' || (!sslMode && azureHost(host))
          ? { rejectUnauthorized: false }
          : undefined,
    })

export const query = async <T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => {
  return pool.query<T>(sql, params)
}

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
