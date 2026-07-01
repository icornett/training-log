import { chromium, type FullConfig } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

import { REAL_DB_AUTH_FILE, loginAsSeededUser } from './auth'

const globalSetup = async (config: FullConfig): Promise<void> => {
  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL || typeof baseURL !== 'string') {
    throw new Error('Playwright real-db baseURL is not configured')
  }

  const authDir = path.dirname(REAL_DB_AUTH_FILE)
  await fs.mkdir(authDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()

  await loginAsSeededUser(page)
  await context.storageState({ path: REAL_DB_AUTH_FILE })

  await browser.close()
}

export default globalSetup
