import { execSync } from 'child_process'
import fs from 'node:fs'
import path from 'node:path'

const globalTeardown = async (): Promise<void> => {
  // Clean up auth file after all tests complete
  const authDir = 'tests/e2e/.auth'
  const authFile = path.join(authDir, 'real-db-user.json')

  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile)
  }

  // If running against a local docker container, optionally clean up by re-seeding
  // This ensures test data is reset between full test runs
  const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4280'
  if (baseURL.includes('127.0.0.1') || baseURL.includes('localhost')) {
    try {
      const seedSQL = fs.readFileSync(path.join(process.cwd(), 'tests/e2e/seed/real-db-seed.sql'), 'utf-8')
      const containerName = 'training-log-local-db'

      // Only re-seed if the docker container exists
      try {
        execSync(`docker ps --filter name=^/${containerName}$ --quiet`, { stdio: 'ignore' })
        console.log('Re-seeding test database after test suite...')
        execSync(
          `docker exec -i ${containerName} psql -v ON_ERROR_STOP=1 -U traininglog -d training_log`,
          {
            input: seedSQL,
            stdio: 'pipe',
          },
        )
      } catch {
        // Docker container not running, skip re-seed
      }
    } catch {
      // Silently skip if re-seeding fails (e.g., in CI where database is managed externally)
    }
  }
}

export default globalTeardown
