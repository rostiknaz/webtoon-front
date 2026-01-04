import type {episode} from "../types.ts";


export function VideoPlayer({episode}: {episode: episode})
{
    return (
        <div className="video-player">
            Video player for Episode {episode.episodeNumber}
        </div>
    );
}