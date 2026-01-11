import React, { useMemo, useEffect } from 'react';

interface VideoPlayerProps {
  url: string;
  onError?: (msg: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, onError }) => {
  const videoId = useMemo(() => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{11})/);
    return match ? match[1] : null;
  }, [url]);

  useEffect(() => {
    if (url && !videoId && onError) {
      onError("Could not parse video ID");
    }
  }, [url, videoId, onError]);

  if (!videoId) return <div className="w-full h-full bg-slate-200 rounded-3xl" />;

  return (
    <div className="w-full h-full bg-slate-900 rounded-3xl overflow-hidden shadow-xl ring-8 ring-white">
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?origin=${typeof window !== 'undefined' ? window.location.origin : ''}&modestbranding=1&rel=0`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
};

export default VideoPlayer;