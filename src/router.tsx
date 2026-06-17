import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { AuthLandingPage } from './pages/AuthLandingPage'
import { LoginPage } from './pages/LoginPage'
import { NewWorkoutPage } from './pages/NewWorkoutPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { SignupPage } from './pages/SignupPage'
import { WorkoutDetailPage } from './pages/WorkoutDetailPage'
import { WorkoutsPage } from './pages/WorkoutsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <AuthLandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'training_log/:pageNumber/account', element: <AccountSettingsPage /> },
      { path: 'training_log/:pageNumber/workouts', element: <WorkoutsPage /> },
      { path: 'training_log/:pageNumber/workouts/new', element: <NewWorkoutPage /> },
      {
        path: 'training_log/:pageNumber/workouts/:workoutId',
        element: <WorkoutDetailPage />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
