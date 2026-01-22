import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button'
import { AlertCircle } from 'lucide-react'

const errorMessages: Record<string, string> = {
  unable_to_link_account: 'Unable to link your account. This email may already be registered with a different sign-in method.',
  invalid_state: 'Authentication session expired. Please try again.',
  access_denied: 'Access was denied. Please try again or use a different sign-in method.',
  default: 'An authentication error occurred. Please try again.',
}

interface AuthErrorSearch {
  error?: string
}

function AuthErrorPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as AuthErrorSearch
  const error = search.error

  const errorMessage = errorMessages[error || 'default'] || errorMessages.default

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Authentication Error
        </h1>
        <p className="text-muted-foreground">
          {errorMessage}
        </p>
        <div className="flex flex-col gap-3">
          <MotionButton
            onClick={() => navigate({ to: '/' })}
            variant="default"
            {...buttonAnimations.hoverPress}
          >
            Go to Home
          </MotionButton>
          <MotionButton
            onClick={() => window.history.back()}
            variant="outline"
            {...buttonAnimations.press}
          >
            Try Again
          </MotionButton>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/auth-error')({
  component: AuthErrorPage,
})
