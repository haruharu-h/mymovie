import { createBrowserRouter } from 'react-router'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import ErrorPage from '@/pages/ErrorPage'
import ReviewsPage from '@/pages/ReviewsPage'
import MovieDetailPage from '@/pages/MovieDetailPage'
import UserPage from '@/pages/UserPage'
import FollowingPage from '@/pages/FollowingPage'
import SearchPage from '@/pages/SearchPage'
import SignInPage from '@/pages/SignInPage'
import SignUpPage from '@/pages/SignUpPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage'
import TermsPage from '@/pages/TermsPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import MovieRegisterPage from '@/pages/MovieRegisterPage'
import ProfilePage from '@/pages/ProfilePage'
import NotFoundPage from '@/pages/NotFoundPage'

const withLayout = (element: React.ReactNode) => <Layout>{element}</Layout>
const protected_ = (element: React.ReactNode) => <ProtectedRoute>{element}</ProtectedRoute>

const errorElement = <ErrorPage />

export const router = createBrowserRouter([
  { path: '/', element: withLayout(protected_(<ReviewsPage />)), errorElement },
  { path: '/reviews', element: withLayout(protected_(<ReviewsPage />)), errorElement },
  { path: '/movies/:tmdbId', element: withLayout(protected_(<MovieDetailPage />)), errorElement },
  { path: '/users/:userId', element: withLayout(<UserPage />), errorElement },
  { path: '/following', element: withLayout(protected_(<FollowingPage />)), errorElement },
  { path: '/search', element: withLayout(protected_(<SearchPage />)), errorElement },
  { path: '/movies/register', element: withLayout(protected_(<MovieRegisterPage />)), errorElement },
  { path: '/profile', element: withLayout(protected_(<ProfilePage />)), errorElement },
  { path: '/auth/callback', element: <AuthCallbackPage />, errorElement },
  { path: '/signin', element: <SignInPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/privacy-policy', element: <PrivacyPolicyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '*', element: <NotFoundPage /> },
])
