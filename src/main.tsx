import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { SyncProvider } from './context/SyncContext'
import { AuthProvider } from './context/AuthContext'
import { router } from './router'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SyncProvider>
        <RouterProvider router={router} />
      </SyncProvider>
    </AuthProvider>
  </React.StrictMode>,
)
