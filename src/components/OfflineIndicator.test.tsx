import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSync } from '../context/SyncContext'
import { OfflineIndicator } from './OfflineIndicator'

vi.mock('../context/SyncContext', () => ({
  useSync: vi.fn(),
}))

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows offline badge when isOnline is false', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: false,
      isSyncing: false,
      pendingCount: 0,
      lastError: null,
      retryAttempt: 0,
      flushManually: vi.fn(),
    } as any)

    render(<OfflineIndicator />)
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it('shows pending operation count', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 3,
      lastError: null,
      retryAttempt: 0,
      flushManually: vi.fn(),
    } as any)

    render(<OfflineIndicator />)
    expect(screen.getByText(/3 pending/i)).toBeInTheDocument()
  })

  it('shows syncing state', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: true,
      isSyncing: true,
      pendingCount: 2,
      lastError: null,
      retryAttempt: 0,
      flushManually: vi.fn(),
    } as any)

    render(<OfflineIndicator />)
    expect(screen.getByText(/syncing/i)).toBeInTheDocument()
  })

  it('displays error message when sync fails', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 1,
      lastError: 'Server error: 500',
      retryAttempt: 0,
      flushManually: vi.fn(),
    } as any)

    render(<OfflineIndicator />)
    expect(screen.getByText(/sync error/i)).toBeInTheDocument()
    expect(screen.getByText('Server error: 500')).toBeInTheDocument()
  })

  it('hides completely when online with no pending operations', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastError: null,
      retryAttempt: 0,
      flushManually: vi.fn(),
    } as any)

    const { container } = render(<OfflineIndicator />)
    // When null is returned, only text nodes/comments remain
    const hasVisibleElements = Array.from(container.childNodes).some(
      (node) => node.nodeType === 1, // 1 = ELEMENT_NODE
    )
    expect(hasVisibleElements).toBe(false)
  })

  it('shows retrying badge with attempt count when retryAttempt > 0', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: true,
      isSyncing: true,
      pendingCount: 1,
      lastError: null,
      retryAttempt: 2,
      flushManually: vi.fn(),
    } as any)

    render(<OfflineIndicator />)
    expect(screen.getByText(/retrying/i)).toBeInTheDocument()
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument()
  })

  it('does not show retrying badge when retryAttempt is 0', () => {
    vi.mocked(useSync).mockReturnValue({
      isOnline: true,
      isSyncing: true,
      pendingCount: 1,
      lastError: null,
      retryAttempt: 0,
      flushManually: vi.fn(),
    } as any)

    render(<OfflineIndicator />)
    expect(screen.queryByText(/retrying/i)).not.toBeInTheDocument()
    expect(screen.getByText(/syncing/i)).toBeInTheDocument()
  })
})
