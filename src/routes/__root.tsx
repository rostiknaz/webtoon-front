import {
    Outlet,
    createRootRouteWithContext,
} from '@tanstack/react-router'
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { QueryClient } from '@tanstack/react-query'
import NotFound from "@/pages/NotFound.tsx";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
}>()({
    component: RootComponent,
    notFoundComponent: () => NotFound,
})

function RootComponent() {
    return (
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <Outlet />
            <ReactQueryDevtools buttonPosition="top-right" />
            <TanStackRouterDevtools position="bottom-right" />
        </TooltipProvider>
    )
}