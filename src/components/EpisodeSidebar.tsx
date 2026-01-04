export function EpisodeSidebar(
    {episodes, activeIndex, onSelect}: {
    episodes: any[];
    activeIndex: number;
    onSelect: (i: number) => void;
}) {
    console.log(episodes);
    return (
        <div style={{ padding: 16 }}>
            <h3>Episodes</h3>

            {episodes.map((ep, i) => (
                <button
                    key={ep._id}
                    onClick={() => onSelect(i)}
                    disabled={ep.isLocked}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: 12,
                        marginBottom: 8,
                        background: i === activeIndex ? '#374151' : '#111827',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        opacity: ep.isLocked ? 0.5 : 1,
                    }}
                >
                    Episode {ep.episodeNumber}
                </button>
            ))}
        </div>
    );
}
