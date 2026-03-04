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
import { AgeGate } from "@/components/AgeGate"

// Lazy load devtools - only imported in development
const ReactQueryDevtools = import.meta.env.DEV
    ? lazy(() => import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools })))
    : () => null

const TanStackRouterDevtools = import.meta.env.DEV
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

    return (
        <TooltipProvider>
            <AgeGate />
            <Toaster />
            <Sonner />
            <Outlet />
            {import.meta.env.DEV && (
                <Suspense fallback={null}>
                    <ReactQueryDevtools buttonPosition="top-right" />
                    <TanStackRouterDevtools position="bottom-right" />
                </Suspense>
            )}
        </TooltipProvider>
    )
}