import { queryOptions } from "@tanstack/react-query"
import { getSeriesMetadata } from "../api"

export default function getSeriesMetadataQueryOptions(
    serialId: string,
    hasSubscription: boolean = false
) {
    return queryOptions({
        // Keep query key stable - don't include subscription status
        // This prevents duplicate keys when subscription changes
        queryKey: ["serial", serialId],
        queryFn: () => getSeriesMetadata(serialId, hasSubscription),
        // Don't refetch on mount - we handle refetching via useEffect in component
        refetchOnMount: false,
    })
}