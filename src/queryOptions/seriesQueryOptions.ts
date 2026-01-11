import { queryOptions } from "@tanstack/react-query"
import { getSeriesMetadata } from "../api"

export default function getSeriesMetadataQueryOptions(
    serialId: string,
    hasSubscription: boolean = false
) {
    return queryOptions({
        // Include subscription in query key to create separate cache entries
        // This prevents invalidation logic - React Query naturally uses the right cache
        queryKey: ["serial", serialId, hasSubscription],
        queryFn: () => getSeriesMetadata(serialId, hasSubscription),
        refetchOnMount: false,
    })
}