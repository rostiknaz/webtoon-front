/**
 * Hook to handle OAuth authentication toast notifications
 *
 * OAuth redirects cause a full page reload, so we can't detect session
 * transitions. Instead, we use URL params set by the OAuth callback.
 *
 * Note: Email/password login toasts are handled directly in AuthDrawer.
 */

import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

export function useAuthToast() {
  const router = useRouter()
  const hasHandled = useRef(false)

  useEffect(() => {
    if (hasHandled.current) return

    const params = new URLSearchParams(window.location.search)
    const loginSuccess = params.get('login_success')

    if (loginSuccess) {
      hasHandled.current = true
      const provider = loginSuccess === 'google' ? 'Google' : 'Social'
      toast.success('Welcome!', {
        description: `Signed in with ${provider}.`,
      })
      // Clean URL
      params.delete('login_success')
      const newSearch = params.toString()
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '')
      router.history.replace(newUrl)
    }
  }, [router])
}
