import { useSync } from '../context/SyncContext'

export const OfflineIndicator = (): JSX.Element | null => {
  const { isOnline, isSyncing, pendingCount, lastError } = useSync()

  // Hide when online with no pending operations
  if (isOnline && pendingCount === 0 && !lastError) {
    return null
  }

  return (
    <div className="offline-indicator">
      {!isOnline && <div className="badge badge-offline">Offline</div>}

      {isSyncing && <div className="badge badge-syncing">Syncing...</div>}

      {isOnline && pendingCount > 0 && !isSyncing && (
        <div className="badge badge-pending">{pendingCount} pending</div>
      )}

      {lastError && (
        <div className="badge badge-error">
          <span className="error-title">Sync error:</span>
          <span className="error-message">{lastError}</span>
        </div>
      )}
    </div>
  )
}
