import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Wraps authenticated pages. Redirects to /login if no JWT token
 * is found in localStorage.
 */
const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
    }
  }, [token, navigate])

  if (!token) return null

  return <>{children}</>
}

export default AuthGuard
