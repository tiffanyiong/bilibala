import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  url: string;
  onError?: (msg: string) => void;
  onTimeUpdate?: (seconds: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ url, onError, onTimeUpdate }, ref) => {
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoId = useMemo(() => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{11})/);
    return match ? match[1] : null;
  }, [url]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (playerRef.current) {
        playerRef.current.seekTo(seconds, true);
        playerRef.current.playVideo();
      }
    }
  }));

  useEffect(() => {
    if (url && !videoId && onError) {
      onError("Could not parse video ID");
    }
  }, [url, videoId, onError]);

  useEffect(() => {
      return () => stopTimer();
  }, []);

  const startTimer = () => {
      stopTimer();
      intervalRef.current = setInterval(() => {
          if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
              const time = playerRef.current.getCurrentTime();
              if (onTimeUpdate) onTimeUpdate(time);
          }
      }, 500);
  };

  const stopTimer = () => {
      if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
      }
  };

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
      // 1 = PLAYING
      if (event.data === 1) {
          startTimer();
      } else {
          stopTimer();
      }
  };

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
  };

  const handlePlayerError: YouTubeProps['onError'] = (event) => {
      const code = Number(event.data);
      let msg = "An error occurred while loading the video.";
      
      if (code === 100) msg = "Video not found or has been removed.";
      if (code === 101 || code === 150) msg = "This video cannot be played (Embedding disabled by owner). Please try another video.";
      
      if (onError) onError(msg);
  };

  if (!videoId) return <div className="w-full h-full bg-black" />;

  return (
    <div className="w-full h-full bg-black">
      <YouTube
        videoId={videoId}
        onReady={onReady}
        onError={handlePlayerError}
        onStateChange={onStateChange}
        opts={{
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
        }}
        className="w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
