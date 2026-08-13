import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

// global window 型拡張
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (duration: number) => void;
  onStateChange?: (state: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  ({ videoId, onReady, onStateChange, onTimeUpdate }, ref) => {
    const playerContainerId = `youtube-player-${videoId}`;
    const playerRef = useRef<any>(null);
    const timeUpdateIntervalRef = useRef<number | null>(null);
    const [isApiLoaded, setIsApiLoaded] = useState(false);

    // YouTube APIの読み込み
    useEffect(() => {
      if (window.YT && window.YT.Player) {
        setIsApiLoaded(true);
        return;
      }

      // APIがまだない場合、スクリプトを追加
      const existingScript = document.getElementById("youtube-iframe-api-script");
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }

      // APIコールバックの設定
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousCallback) previousCallback();
        setIsApiLoaded(true);
      };

      return () => {
        // コンポーネントがアンマウントされても window にコールバックを残しておくと再ロード時に動く
      };
    }, []);

    // プレーヤーの初期化
    useEffect(() => {
      if (!isApiLoaded || !videoId) return;

      // 既存のプレーヤーオブジェクトがある場合は破棄して再作成
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying player:", e);
        }
        playerRef.current = null;
      }

      const initPlayer = () => {
        try {
          playerRef.current = new window.YT.Player(playerContainerId, {
            videoId: videoId,
            playerVars: {
              autoplay: 0,
              controls: 1, // シーク等の標準UIは表示
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              fs: 1,
              enablejsapi: 1,
            },
            events: {
              onReady: (event: any) => {
                const duration = event.target.getDuration();
                if (onReady) onReady(duration);
                startTimeTracker();
              },
              onStateChange: (event: any) => {
                if (onStateChange) onStateChange(event.data);
                
                // 再生中(1)の時だけ時間更新タイマーを動かす
                if (event.data === 1) {
                  startTimeTracker();
                } else {
                  stopTimeTracker();
                }
              },
            },
          });
        } catch (err) {
          console.error("Failed to initialize YT Player", err);
        }
      };

      // コンテナが存在するのを確実にするため、少しだけ待機して初期化
      const timer = setTimeout(initPlayer, 100);

      return () => {
        clearTimeout(timer);
        stopTimeTracker();
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) {}
          playerRef.current = null;
        }
      };
    }, [isApiLoaded, videoId, playerContainerId]);

    // 定期的な時間監視
    const startTimeTracker = () => {
      stopTimeTracker();
      timeUpdateIntervalRef.current = window.setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          try {
            const time = playerRef.current.getCurrentTime();
            if (onTimeUpdate) onTimeUpdate(time);
          } catch (e) {}
        }
      }, 100); // 100ms ごとに現在の時間を更新
    };

    const stopTimeTracker = () => {
      if (timeUpdateIntervalRef.current !== null) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };

    // 親コンポーネントに操作用関数を公開
    useImperativeHandle(ref, () => ({
      play: () => {
        if (playerRef.current && typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      },
      pause: () => {
        if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
        }
      },
      seekTo: (seconds: number, allowSeekAhead = true) => {
        if (playerRef.current && typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(seconds, allowSeekAhead);
          // シークした後に時間表示を即座に同期
          if (onTimeUpdate) onTimeUpdate(seconds);
        }
      },
      getCurrentTime: () => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          try {
            return playerRef.current.getCurrentTime();
          } catch (e) {
            return 0;
          }
        }
        return 0;
      },
      getDuration: () => {
        if (playerRef.current && typeof playerRef.current.getDuration === "function") {
          try {
            return playerRef.current.getDuration();
          } catch (e) {
            return 0;
          }
        }
        return 0;
      },
      getPlayerState: () => {
        if (playerRef.current && typeof playerRef.current.getPlayerState === "function") {
          try {
            return playerRef.current.getPlayerState();
          } catch (e) {
            return -1;
          }
        }
        return -1;
      },
      setVolume: (volume: number) => {
        if (playerRef.current && typeof playerRef.current.setVolume === "function") {
          playerRef.current.setVolume(volume);
        }
      }
    }));

    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
        {!videoId ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
            <svg
              className="w-16 h-16 mb-4 text-zinc-600 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="font-medium text-lg text-zinc-400">YouTubeのURLを入力してください</p>
            <p className="text-sm text-zinc-600 mt-2 max-w-md">
              1〜2時間の試合・練習動画でも読み込み可能。キーボードのショートカットでサクサク編集できます。
            </p>
          </div>
        ) : (
          <div id={playerContainerId} className="w-full h-full" />
        )}
      </div>
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";

// URLからYouTubeのVideo IDを抽出するヘルパー
export function extractYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}
