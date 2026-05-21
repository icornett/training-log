import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { NewWorkoutPage } from './pages/NewWorkoutPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SignupPage } from './pages/SignupPage'
import { WorkoutDetailPage } from './pages/WorkoutDetailPage'
import { WorkoutsPage } from './pages/WorkoutsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/training_log/1/workouts" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
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
