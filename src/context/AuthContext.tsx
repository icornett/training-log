import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { api } from '../services/api'
import { createPendingOperationStore, syncStatusChangedEventName } from '../services/localStore'
import { syncService } from '../services/sync'
import type { SessionUser } from '../types/domain'

interface AuthContextValue {
  currentUser: SessionUser | null
  loading: boolean
  isOffline: boolean
  pendingCount: number
  lastSyncError: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  exportAccountData: (format: 'json' | 'csv') => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const getPendingCount = (): number => {
  if (typeof localStorage === 'undefined') {
    return 0
  }

  return createPendingOperationStore(localStorage).list().length
}

const getOfflineState = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false
  }

  return !navigator.onLine
}

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(getOfflineState)
  const [pendingCount, setPendingCount] = useState(getPendingCount)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)

  const refreshSyncStatus = (): void => {
    setIsOffline(getOfflineState())
    setPendingCount(getPendingCount())
  }

  const flushPendingChanges = async (): Promise<void> => {
    if (!currentUser || getOfflineState() || getPendingCount() === 0) {
      return
    }

    const result = await syncService.flush()
    refreshSyncStatus()
    setLastSyncError(result.lastError)
  }

  const refresh = async (): Promise<void> => {
    const user = await api.getCurrentUser()
    setCurrentUser(user)
  }

  const logout = async (): Promise<void> => {
    await api.logout()
    setCurrentUser(null)
  }

  const deleteAccount = async (): Promise<void> => {
    await api.deleteAccount()
    setCurrentUser(null)
  }

  const exportAccountData = async (format: 'json' | 'csv'): Promise<string> => {
    const data = await api.exportAccountData(format)
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  }

  useEffect(() => {
    let disposed = false

    const load = async (): Promise<void> => {
      try {
        const user = await api.getCurrentUser()
        if (!disposed) {
          setCurrentUser(user)
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    const handleOnline = (): void => {
      setIsOffline(false)
      setPendingCount(getPendingCount())
      void flushPendingChanges()
    }

    const handleOffline = (): void => {
      setIsOffline(true)
      setPendingCount(getPendingCount())
    }

    const handleSyncStatusChanged = (): void => {
      setPendingCount(getPendingCount())
    }

    refreshSyncStatus()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener(syncStatusChangedEventName, handleSyncStatusChanged)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener(syncStatusChangedEventName, handleSyncStatusChanged)
    }
  }, [currentUser])

  useEffect(() => {
    if (loading || !currentUser || getOfflineState()) {
      return
    }

    void flushPendingChanges()
  }, [currentUser, loading])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      isOffline,
      pendingCount,
      lastSyncError,
      refresh,
      logout,
      deleteAccount,
      exportAccountData,
    }),
    [currentUser, loading, isOffline, pendingCount, lastSyncError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
