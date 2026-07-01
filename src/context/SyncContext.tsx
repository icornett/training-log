import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { createPendingOperationStore } from '../services/localStore'
import { createSyncService } from '../services/sync'

interface SyncContextValue {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastError: string | null
  retryAttempt: number
  flushManually: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export const SyncProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator === 'undefined' || navigator.onLine === true
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [retryAttempt, setRetryAttempt] = useState(0)

  // Initialize pending store and sync service
  const pendingStore = createPendingOperationStore(localStorage)
  const syncService = createSyncService({
    pendingStore,
  })

  // Update pending count from store
  const updatePendingCount = useCallback(() => {
    const pending = pendingStore.list()
    setPendingCount(pending.length)
  }, [pendingStore])

  // Flush queue
  const flushQueue = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return
    }

    setIsSyncing(true)
    setRetryAttempt(0)
    try {
      const result = await syncService.flush({
        onRetry: ({ attempt }: { attempt: number }) => {
          setRetryAttempt(attempt)
        },
      })
      if (result.lastError) {
        setLastError(result.lastError)
      } else {
        setLastError(null)
      }
      updatePendingCount()
    } finally {
      setIsSyncing(false)
      setRetryAttempt(0)
    }
  }, [isOnline, isSyncing, syncService, updatePendingCount])

  const flushManually = useCallback(async () => {
    await flushQueue()
  }, [flushQueue])

  // Handle online/offline transitions
  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true)
    }

    const handleOffline = (): void => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for sync status changes
  useEffect(() => {
    const handleSyncStatusChanged = (): void => {
      updatePendingCount()
    }

    window.addEventListener('trainingLog:sync-status-changed', handleSyncStatusChanged)

    return () => {
      window.removeEventListener('trainingLog:sync-status-changed', handleSyncStatusChanged)
    }
  }, [updatePendingCount])

  // Initialize pending count on mount
  useEffect(() => {
    updatePendingCount()
  }, [updatePendingCount])

  // Auto-flush when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      // Debounce flush to avoid multiple rapid calls
      const timeoutId = setTimeout(() => {
        void flushQueue()
      }, 500)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isOnline, pendingCount, flushQueue])

  const value: SyncContextValue = {
    isOnline,
    isSyncing,
    pendingCount,
    lastError,
    retryAttempt,
    flushManually,
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export const useSync = (): SyncContextValue => {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within SyncProvider')
  }
  return context
}
