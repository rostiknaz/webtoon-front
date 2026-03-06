import { lazy, Suspense } from 'react'
import {
    Outlet,
    createRootRouteWithContext,
} from '@tanstack/react-router'
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { QueryClient } from '@tanstack/react-query'
import NotFound from "@/pages/NotFound.tsx";
import { useAuthToast } from "@/hooks/useAuthToast"
import { usePurchaseReturn } from "@/hooks/usePurchaseReturn"
import { AgeGate } from "@/components/AgeGate"
import { AppShell } from "@/components/AppShell"
import { usePreferencesStore } from "@/stores/usePreferencesStore"

// Lazy load devtools - only in development, disabled during E2E tests (navigator.webdriver is set by Playwright/automation)
const showDevtools = import.meta.env.DEV && typeof navigator !== 'undefined' && !navigator.webdriver

const ReactQueryDevtools = showDevtools
    ? lazy(() => import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools })))
    : () => null

const TanStackRouterDevtools = showDevtools
    ? lazy(() => import('@tanstack/react-router-devtools').then(m => ({ default: m.TanStackRouterDevtools })))
    : () => null

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
}>()({
    component: RootComponent,
    notFoundComponent: () => NotFound,
})

function RootComponent() {
    // Handle OAuth success/error toast notifications
    useAuthToast()
    // Handle return from Solidgate payment page (credit pack purchase)
    usePurchaseReturn()
    const ageGateConfirmed = usePreferencesStore((s) => s.ageGateConfirmed)

    return (
        <TooltipProvider>
            {!ageGateConfirmed ? (
                <AgeGate />
            ) : (
                <AppShell>
                    <Outlet />
                </AppShell>
            )}
            <Toaster />
            <Sonner />
            {showDevtools && (
                <Suspense fallback={null}>
                    <ReactQueryDevtools buttonPosition="top-right" />
                    <TanStackRouterDevtools position="bottom-right" />
                </Suspense>
            )}
        </TooltipProvider>
    )
}