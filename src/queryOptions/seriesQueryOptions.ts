import { queryOptions } from "@tanstack/react-query"
import { getSeriesMetadata } from "../api"

export default function getSeriesMetadataQueryOptions(serialId: string) {
    return queryOptions({
        queryKey: ["serial", serialId],
        queryFn: () => getSeriesMetadata(serialId),
    })
}