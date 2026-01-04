// src/api.ts
import { seriesMetadataSchema } from './types';

export const getSeriesMetadata = async (seriesId: string) => {
    // simulate network latency
    await new Promise((r) => setTimeout(r, 300));

    const data =  {
        _id: seriesId,
        title: 'Midnight Confessions',
        description: 'A vertical short-form drama series.',

        user: {
            isAuthenticated: true,
            hasSubscription: false,
        },

        episodes: [
            {
                _id: 'ep-1',
                episodeNumber: 1,
                title: 'The First Message',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep1/master.m3u8',
            },
            {
                _id: 'ep-2',
                episodeNumber: 2,
                title: 'Seen at 2:14 AM',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-3',
                episodeNumber: 3,
                title: 'Typing…',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep3/master.m3u8',
            },
            {
                _id: 'ep-4',
                episodeNumber: 4,
                title: 'Deleted Messages',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-5',
                episodeNumber: 5,
                title: 'Who Is Watching?',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-6',
                episodeNumber: 6,
                title: 'The Screenshot',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-7',
                episodeNumber: 7,
                title: 'No Caller ID',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-8',
                episodeNumber: 8,
                title: 'Online Again',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-9',
                episodeNumber: 9,
                title: 'The Profile Picture',
                isLocked: false,
                hlsUrl: 'https://cdn.example.com/series/1/ep2/master.m3u8',
            },
            {
                _id: 'ep-10',
                episodeNumber: 10,
                title: 'Voice Note',
                isLocked: true,
            },
            {
                _id: 'ep-11',
                episodeNumber: 11,
                title: 'Read Receipts',
                isLocked: true,
            },
            {
                _id: 'ep-12',
                episodeNumber: 12,
                title: 'Last Seen',
                isLocked: true,
            },
        ]
    };

    return seriesMetadataSchema.parse(data);
}
