import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { api } from '../services/api'
import type { SessionUser } from '../types/domain'

interface AuthContextValue {
  currentUser: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  exportAccountData: (format: 'json' | 'csv') => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

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

  const value = useMemo<AuthContextValue>(
    () => ({ currentUser, loading, refresh, logout, deleteAccount, exportAccountData }),
    [currentUser, loading],
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
