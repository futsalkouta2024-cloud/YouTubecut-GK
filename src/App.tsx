import React, { useState, useEffect, useRef, useMemo } from "react";
import { YouTubePlayer, YouTubePlayerRef, extractYoutubeId } from "./components/YouTubePlayer";
import { ClipList, formatTime } from "./components/ClipList";
import { ShortcutGuide } from "./components/ShortcutGuide";
import { VideoProject, Clip } from "./types";
import {
  Plus,
  Trash2,
  FolderOpen,
  Settings,
  Scissors,
  CheckCircle,
  HelpCircle,
  Video,
  ExternalLink,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Bookmark,
  Volume2,
} from "lucide-react";

// プリセット動画
const PRESET_VIDEOS = [
  {
    title: "【フットサル】試合フル動画デモ (15分)",
    url: "https://www.youtube.com/watch?v=K37iM8D8Xb0"
  },
  {
    title: "【フットサル日本代表】練習＆ミニゲーム動画 (40分)",
    url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ"
  }
];

export default function App() {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  // 入力フォーム用
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  
  // プレイヤー状態
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerState, setPlayerState] = useState<number>(-1); // -1: 未開始, 1: 再生中, 2: 一時停止...
  const [volume, setVolume] = useState<number>(50);

  // 切り取り範囲マーク用
  const [markStart, setMarkStart] = useState<number | null>(null);
  const [markEnd, setMarkEnd] = useState<number | null>(null);

  // 連続再生（1本の動画として再生）用の管理
  const [isPlayingContinuous, setIsPlayingContinuous] = useState(false);
  const [currentContinuousClipIndex, setCurrentContinuousClipIndex] = useState<number | null>(null);

  const playerRef = useRef<YouTubePlayerRef>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const zoomTimelineRef = useRef<HTMLDivElement>(null);

  // マウスホバープレビュー用のステート
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [zoomHoverTime, setZoomHoverTime] = useState<number | null>(null);
  const [zoomHoverX, setZoomHoverX] = useState<number>(0);

  // ローカルストレージからプロジェクト読み込み
  useEffect(() => {
    const saved = localStorage.getItem("yt_clipper_projects");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as VideoProject[];
        setProjects(parsed);
        if (parsed.length > 0) {
          setActiveProjectId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    } else {
      // 初期デモプロジェクトをセット
      const demoId = "demo-project-id";
      const demoProject: VideoProject = {
        id: demoId,
        title: "フットサル練習動画デモ",
        youtubeUrl: PRESET_VIDEOS[0].url,
        videoId: extractYoutubeId(PRESET_VIDEOS[0].url) || "",
        clips: [
          { id: "demo-clip-1", startTime: 15, endTime: 25, duration: 10, title: "クリップ #1", note: "華麗なシュートシーン" },
          { id: "demo-clip-2", startTime: 120, endTime: 132, duration: 12, title: "クリップ #2", note: "ナイスパスカット" },
          { id: "demo-clip-3", startTime: 305, endTime: 315, duration: 10, title: "クリップ #3", note: "ゴール前崩し" }
        ],
        createdAt: new Date().toISOString()
      };
      setProjects([demoProject]);
      setActiveProjectId(demoId);
    }
  }, []);

  // プロジェクトの永続化
  const saveProjects = (updatedProjects: VideoProject[]) => {
    setProjects(updatedProjects);
    localStorage.setItem("yt_clipper_projects", JSON.stringify(updatedProjects));
  };

  // アクティブなプロジェクトを取得
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // 新規プロジェクト作成
  const handleCreateProject = (urlToUse?: string, titleToUse?: string) => {
    const targetUrl = urlToUse || newUrl;
    const targetTitle = titleToUse || newTitle || "新しいキリトリプロジェクト";
    const videoId = extractYoutubeId(targetUrl);

    if (!videoId) {
      alert("有効なYouTubeのURLを入力してください。");
      return;
    }

    const newProj: VideoProject = {
      id: Math.random().toString(36).substring(2, 9),
      youtubeUrl: targetUrl,
      videoId: videoId,
      title: targetTitle,
      clips: [],
      createdAt: new Date().toISOString()
    };

    const updated = [newProj, ...projects];
    saveProjects(updated);
    setActiveProjectId(newProj.id);
    
    // 入力リセット
    setNewUrl("");
    setNewTitle("");
    setMarkStart(null);
    setMarkEnd(null);
    setIsPlayingContinuous(false);
  };

  // プロジェクト削除
  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("このプロジェクトを削除しますか？ストックしたクリップも消去されます。")) return;
    
    const updated = projects.filter((p) => p.id !== id);
    saveProjects(updated);
    if (activeProjectId === id) {
      setActiveProjectId(updated.length > 0 ? updated[0].id : null);
    }
    setMarkStart(null);
    setMarkEnd(null);
    setIsPlayingContinuous(false);
  };

  // クリップストック追加
  const handleAddClip = (start: number, end: number) => {
    if (!activeProject) return;

    const startTime = Math.min(start, end);
    const endTime = Math.max(start, end);
    const duration = endTime - startTime;

    if (duration < 0.5) {
      // 短すぎるクリップは除外
      return;
    }

    const newClip: Clip = {
      id: Math.random().toString(36).substring(2, 9),
      startTime,
      endTime,
      duration,
      title: `クリップ #${activeProject.clips.length + 1}`,
      note: ""
    };

    const updatedClips = [...activeProject.clips, newClip];
    const updatedProjects = projects.map((p) => {
      if (p.id === activeProject.id) {
        return { ...p, clips: updatedClips };
      }
      return p;
    });

    saveProjects(updatedProjects);
  };

  // クリップ削除
  const handleDeleteClip = (clipId: string) => {
    if (!activeProject) return;
    const updatedClips = activeProject.clips.filter((c) => c.id !== clipId);
    
    // 削除されたクリップの順番を再ナンバリング
    const renumberedClips = updatedClips.map((c, idx) => ({
      ...c,
      title: c.title.startsWith("クリップ #") ? `クリップ #${idx + 1}` : c.title
    }));

    const updatedProjects = projects.map((p) => {
      if (p.id === activeProject.id) {
        return { ...p, clips: renumberedClips };
      }
      return p;
    });
    saveProjects(updatedProjects);

    if (activeClipId === clipId) {
      setIsPlayingContinuous(false);
      setCurrentContinuousClipIndex(null);
    }
  };

  // クリップのメモ更新
  const handleUpdateClipNote = (clipId: string, note: string) => {
    if (!activeProject) return;
    const updatedClips = activeProject.clips.map((c) => {
      if (c.id === clipId) return { ...c, note };
      return c;
    });
    const updatedProjects = projects.map((p) => {
      if (p.id === activeProject.id) return { ...p, clips: updatedClips };
      return p;
    });
    saveProjects(updatedProjects);
  };

  // クリップのタイトル更新
  const handleUpdateClipTitle = (clipId: string, title: string) => {
    if (!activeProject) return;
    const updatedClips = activeProject.clips.map((c) => {
      if (c.id === clipId) return { ...c, title };
      return c;
    });
    const updatedProjects = projects.map((p) => {
      if (p.id === activeProject.id) return { ...p, clips: updatedClips };
      return p;
    });
    saveProjects(updatedProjects);
  };

  // クリップの並び替え
  const handleReorderClips = (reorderedClips: Clip[]) => {
    if (!activeProject) return;
    const updatedProjects = projects.map((p) => {
      if (p.id === activeProject.id) return { ...p, clips: reorderedClips };
      return p;
    });
    saveProjects(updatedProjects);
  };

  // クリップを単体でプレビュー
  const handlePlayClip = (clip: Clip) => {
    setIsPlayingContinuous(false);
    setCurrentContinuousClipIndex(null);
    setMarkStart(clip.startTime);
    setMarkEnd(clip.endTime);
    playerRef.current?.seekTo(clip.startTime);
    playerRef.current?.play();
  };

  // 1本の動画として連続再生をトグル
  const handleToggleContinuousPlay = () => {
    if (!activeProject || activeProject.clips.length === 0) return;

    if (isPlayingContinuous) {
      // 停止
      setIsPlayingContinuous(false);
      setCurrentContinuousClipIndex(null);
      playerRef.current?.pause();
    } else {
      // 開始：最初のクリップから再生
      setIsPlayingContinuous(true);
      setCurrentContinuousClipIndex(0);
      const firstClip = activeProject.clips[0];
      setMarkStart(firstClip.startTime);
      setMarkEnd(firstClip.endTime);
      playerRef.current?.seekTo(firstClip.startTime);
      playerRef.current?.play();
    }
  };

  // プレイヤーイベント：現在の秒数更新
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);

    // 連続再生（1本の動画としてプレビュー）中の制御ロジック
    if (isPlayingContinuous && activeProject && currentContinuousClipIndex !== null) {
      const activeClip = activeProject.clips[currentContinuousClipIndex];
      if (activeClip) {
        // クリップの終了時間を超えたか判定
        if (time >= activeClip.endTime) {
          const nextIndex = currentContinuousClipIndex + 1;
          if (nextIndex < activeProject.clips.length) {
            // 次のクリップへ移動
            setCurrentContinuousClipIndex(nextIndex);
            const nextClip = activeProject.clips[nextIndex];
            setMarkStart(nextClip.startTime);
            setMarkEnd(nextClip.endTime);
            playerRef.current?.seekTo(nextClip.startTime);
            playerRef.current?.play();
          } else {
            // 全クリップ終了
            setIsPlayingContinuous(false);
            setCurrentContinuousClipIndex(null);
            playerRef.current?.pause();
            // 最初に戻る
            setMarkStart(null);
            setMarkEnd(null);
          }
        }
      }
    }
  };

  // プレーヤーイベント：状態変化
  const handleStateChange = (state: number) => {
    setPlayerState(state);
  };

  // タイムラインでのクリックシーク
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = percentage * duration;
    playerRef.current?.seekTo(targetSeconds);
    
    // 連続再生を解除
    if (isPlayingContinuous) {
      setIsPlayingContinuous(false);
      setCurrentContinuousClipIndex(null);
    }
  };

  // ズーム（拡大）タイムライン用の設定（3分間＝180秒）
  const zoomWindow = 180;
  const zoomStart = useMemo(() => {
    if (duration <= zoomWindow) return 0;
    return Math.max(0, Math.min(duration - zoomWindow, currentTime - zoomWindow / 2));
  }, [currentTime, duration]);
  const zoomEnd = useMemo(() => {
    return Math.min(duration, zoomStart + zoomWindow);
  }, [zoomStart, duration]);

  // ズームタイムラインでのクリックシーク
  const handleZoomTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomTimelineRef.current || duration === 0) return;
    const rect = zoomTimelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = zoomStart + percentage * (zoomEnd - zoomStart);
    playerRef.current?.seekTo(targetSeconds);
    
    if (isPlayingContinuous) {
      setIsPlayingContinuous(false);
      setCurrentContinuousClipIndex(null);
    }
  };

  // 全体タイムラインでのマウスムーブ (プレビュー表示用)
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(percentage * duration);
    setHoverX(x);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
  };

  // ズームタイムラインでのマウスムーブ (プレビュー表示用)
  const handleZoomTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomTimelineRef.current || duration === 0) return;
    const rect = zoomTimelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setZoomHoverTime(zoomStart + percentage * (zoomEnd - zoomStart));
    setZoomHoverX(x);
  };

  const handleZoomTimelineMouseLeave = () => {
    setZoomHoverTime(null);
  };

  // キーボードショートカット設定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フォーム等にフォーカスがある場合はショートカットを無効化
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.hasAttribute("contenteditable")
      );
      if (isInput) return;

      if (!activeProject) return;

      const key = e.key.toLowerCase();

      // Space: 切り取り開始・終了トグル
      if (e.key === " " || key === "spacebar") {
        e.preventDefault(); // 画面スクロールを防ぐ
        if (markStart === null) {
          // 開始地点をマーク
          setMarkStart(currentTime);
          setMarkEnd(null);
        } else {
          // 終了地点をマーク ＆ 自動ストック
          const end = currentTime;
          setMarkEnd(end);
          handleAddClip(markStart, end);
          // 次のマークに備えてリセット
          setMarkStart(null);
          setMarkEnd(null);
        }
      }

      // K: 再生・一時停止
      if (key === "k") {
        e.preventDefault();
        if (playerState === 1) {
          playerRef.current?.pause();
        } else {
          playerRef.current?.play();
        }
      }

      // J: 10秒戻る
      if (key === "j") {
        e.preventDefault();
        playerRef.current?.seekTo(Math.max(0, currentTime - 10));
      }

      // L: 10秒進む
      if (key === "l") {
        e.preventDefault();
        playerRef.current?.seekTo(Math.min(duration, currentTime + 10));
      }

      // Left Arrow: 1秒戻る
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        playerRef.current?.seekTo(Math.max(0, currentTime - 1));
      }

      // Right Arrow: 1秒進む
      if (e.key === "ArrowRight") {
        e.preventDefault();
        playerRef.current?.seekTo(Math.min(duration, currentTime + 1));
      }

      // I: 手動開始点(In)マーク
      if (key === "i") {
        e.preventDefault();
        setMarkStart(currentTime);
      }

      // O: 手動終了点(Out)マーク
      if (key === "o") {
        e.preventDefault();
        setMarkEnd(currentTime);
      }

      // Enter: 現在のマーク範囲をストック
      if (e.key === "Enter") {
        e.preventDefault();
        if (markStart !== null && markEnd !== null) {
          handleAddClip(markStart, markEnd);
          setMarkStart(null);
          setMarkEnd(null);
        } else if (markStart !== null) {
          // 開始点だけある場合、現在の位置を終了点として即座に追加
          handleAddClip(markStart, currentTime);
          setMarkStart(null);
          setMarkEnd(null);
        }
      }

      // Esc: マーククリア
      if (e.key === "Escape") {
        e.preventDefault();
        setMarkStart(null);
        setMarkEnd(null);
        setIsPlayingContinuous(false);
        setCurrentContinuousClipIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTime, duration, markStart, markEnd, activeProject, playerState, projects]);

  // 現在再生中のクリップのIDを取得
  const activeClipId = useMemo(() => {
    if (isPlayingContinuous && activeProject && currentContinuousClipIndex !== null) {
      return activeProject.clips[currentContinuousClipIndex]?.id || null;
    }
    return null;
  }, [isPlayingContinuous, activeProject, currentContinuousClipIndex]);

  // 音量スライダー変更
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value, 10);
    setVolume(vol);
    playerRef.current?.setVolume(vol);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* ナビゲーションバー */}
      <header className="border-b border-white/10 bg-[#121212] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl italic text-white shadow-lg shadow-indigo-500/25">
            C
          </div>
          <div>
            <h1 className="font-medium text-base tracking-tight flex items-center gap-2 text-white">
              QuickClip
              <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono px-1.5 py-0.5 rounded font-normal">
                Futsal Edition
              </span>
            </h1>
            <p className="text-[10px] text-gray-500 font-normal">YouTube Clip Cutter</p>
          </div>
        </div>

        {/* ユーザー案内 */}
        <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Connection Stable
          </span>
          <span className="text-gray-500">Storage: 1.4 GB / 10 GB</span>
        </div>
      </header>

      {/* メインレイアウト */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 p-6 max-w-[1700px] w-full mx-auto">
        {/* 左側サイドバー: プロジェクト管理 */}
        <div className="xl:col-span-1 space-y-5 flex flex-col h-full">
          {/* 新規プロジェクト追加 */}
          <div className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-3 shadow-md">
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-400" />
              新規動画をインポート
            </h3>
            
            <div className="space-y-2">
              <input
                type="text"
                placeholder="YouTubeのURLを入力..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full text-base sm:text-xs bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white transition-colors"
              />
              <input
                type="text"
                placeholder="プロジェクト名 (任意)..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-base sm:text-xs bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white transition-colors"
              />
              <button
                onClick={() => handleCreateProject()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-600/15"
              >
                インポート開始
              </button>
            </div>

            {/* プリセット選択 */}
            <div className="pt-2 border-t border-white/10">
              <span className="text-[10px] text-gray-500 block mb-1.5 font-bold">デモ用フットサル動画（すぐに試せます）</span>
              <div className="space-y-1">
                {PRESET_VIDEOS.map((video, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCreateProject(video.url, video.title)}
                    className="w-full text-left text-[11px] text-gray-400 hover:text-indigo-400 hover:bg-white/5 p-1.5 rounded transition-all flex items-center justify-between gap-1 border border-transparent hover:border-white/10 cursor-pointer"
                  >
                    <span className="truncate flex-1">{video.title}</span>
                    <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* プロジェクト一覧 */}
          <div className="bg-[#121212] border border-white/10 rounded-xl p-4 flex-1 flex flex-col min-h-[150px] lg:min-h-none shadow-md">
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3 shrink-0">
              <FolderOpen className="w-4 h-4 text-gray-400" />
              プロジェクト一覧 ({projects.length})
            </h3>

            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1 max-h-[220px] lg:max-h-[350px]">
              {projects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 py-6 text-center">
                  <p className="text-xs">プロジェクトがありません</p>
                </div>
              ) : (
                projects.map((proj) => {
                  const isActive = proj.id === activeProjectId;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        setActiveProjectId(proj.id);
                        setMarkStart(null);
                        setMarkEnd(null);
                        setIsPlayingContinuous(false);
                      }}
                      className={`group flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isActive
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <Video className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo-400" : "text-gray-600"}`} />
                        <div className="truncate pr-2 text-left">
                          <p className="font-semibold truncate">{proj.title}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {proj.clips.length} クリップ
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-all"
                        title="プロジェクト削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 中央・右側: 編集ステージ & ストックリスト */}
        <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 編集ステージ */}
          <div className="lg:col-span-3 space-y-4">
            {/* メインプレイヤー */}
            {activeProject ? (
              <div className="space-y-4">
                <YouTubePlayer
                  ref={playerRef}
                  videoId={activeProject.videoId}
                  onTimeUpdate={handleTimeUpdate}
                  onStateChange={handleStateChange}
                  onReady={(dur) => setDuration(dur)}
                />

                {/* ビデオ詳細バー */}
                <div className="flex items-center justify-between px-2 text-xs">
                  <span className="font-medium text-gray-300 truncate max-w-[280px]">
                    {activeProject.title}
                  </span>
                  <a
                    href={activeProject.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
                  >
                    YouTubeで開く
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* タイムライン & シークバー */}
                <div className="space-y-2 bg-[#121212] border border-white/10 p-4 rounded-xl shadow-md">
                  {/* 時間表示 */}
                  <div className="flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span className="font-bold text-indigo-400">
                        {formatTime(currentTime)}
                      </span>
                      <span className="text-gray-600">/</span>
                      <span className="text-gray-500">{formatTime(duration)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* 音量調整 */}
                      <div className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300">
                        <Volume2 className="w-3.5 h-3.5" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-14 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      {/* キリトリ状態インジケーター */}
                      {markStart !== null && (
                        <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          キリトリ中: {formatTime(markStart)} 〜
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 全体タイムライン */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 font-semibold select-none">
                      <span>全体プレビュー (Global Timeline)</span>
                      {hoverTime !== null && (
                        <span className="text-indigo-400 font-mono">
                          ホバー: {formatTime(hoverTime)}
                        </span>
                      )}
                    </div>
                    <div
                      ref={timelineRef}
                      onClick={handleTimelineClick}
                      onMouseMove={handleTimelineMouseMove}
                      onMouseLeave={handleTimelineMouseLeave}
                      className="relative h-5 bg-white/5 rounded-md border border-white/10 overflow-hidden cursor-pointer select-none group/timeline"
                    >
                      {/* ストックされた全クリップの範囲表示 */}
                      {activeProject.clips.map((clip) => {
                        if (duration === 0) return null;
                        const left = (clip.startTime / duration) * 100;
                        const width = (clip.duration / duration) * 100;
                        return (
                          <div
                            key={clip.id}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className="absolute h-full bg-indigo-500/20 border-x border-indigo-400/30 hover:bg-indigo-500/35 transition-colors"
                            title={`${clip.title}: ${clip.duration.toFixed(1)}秒`}
                          />
                        );
                      })}

                      {/* 現在のキリトリ中の範囲表示 */}
                      {markStart !== null && duration > 0 && (
                        <div
                          style={{
                            left: `${(markStart / duration) * 100}%`,
                            width: `${((currentTime - markStart) / duration) * 100}%`,
                          }}
                          className="absolute h-full bg-white/10 border-x border-white/20"
                        />
                      )}

                      {/* 再生ヘッド (赤色の縦線) */}
                      {duration > 0 && (
                        <div
                          style={{ left: `${(currentTime / duration) * 100}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        >
                          <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-[#121212] scale-90 group-hover/timeline:scale-110 transition-transform" />
                        </div>
                      )}

                      {/* ホバー位置のプレビュー縦線 & ツールチップ */}
                      {hoverTime !== null && (
                        <div
                          style={{ left: `${hoverX}px` }}
                          className="absolute top-0 bottom-0 w-[1px] bg-white/30 pointer-events-none z-20"
                        >
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/95 border border-white/20 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap">
                            {formatTime(hoverTime)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 全体タイムラインの時間目盛り */}
                    <div className="relative h-4 mt-0.5 w-full">
                      {(() => {
                        if (duration === 0) return null;
                        const ticks = [];
                        let interval = 60;
                        if (duration > 7200) interval = 1200; // 20分
                        else if (duration > 3600) interval = 600; // 10分
                        else if (duration > 1800) interval = 300; // 5分
                        else if (duration > 600) interval = 120; // 2分
                        else interval = 30; // 30秒

                        for (let t = 0; t <= duration; t += interval) {
                          const left = (t / duration) * 100;
                          ticks.push(
                            <div key={t} style={{ left: `${left}%` }} className="absolute top-0 flex flex-col items-center pointer-events-none">
                              <div className="w-[1px] h-1 bg-white/20" />
                              <span className="text-[8px] text-gray-500 font-mono mt-0.5 -translate-x-1/2 select-none">
                                {formatTime(t)}
                              </span>
                            </div>
                          );
                        }
                        return ticks;
                      })()}
                    </div>
                  </div>

                  {/* 精密ズームタイムライン */}
                  <div className="space-y-1 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-indigo-300 px-1 font-semibold select-none">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        精密ズームタイムライン (前後3分間を表示)
                      </span>
                      {zoomHoverTime !== null && (
                        <span className="text-indigo-400 font-mono">
                          ホバー: {formatTime(zoomHoverTime)}
                        </span>
                      )}
                    </div>
                    <div
                      ref={zoomTimelineRef}
                      onClick={handleZoomTimelineClick}
                      onMouseMove={handleZoomTimelineMouseMove}
                      onMouseLeave={handleZoomTimelineMouseLeave}
                      className="relative h-11 bg-white/5 rounded-md border border-indigo-500/20 overflow-hidden cursor-pointer select-none group/zoom"
                    >
                      {/* 背景グリッド */}
                      <div className="absolute inset-0 pointer-events-none">
                        {(() => {
                          if (duration === 0) return null;
                          const gridLines = [];
                          const startSec = Math.ceil(zoomStart / 10) * 10;
                          for (let t = startSec; t <= zoomEnd; t += 10) {
                            const left = ((t - zoomStart) / (zoomEnd - zoomStart)) * 100;
                            gridLines.push(
                              <div
                                key={t}
                                style={{ left: `${left}%` }}
                                className="absolute top-0 bottom-0 w-[1px] bg-white/[0.03]"
                              />
                            );
                          }
                          return gridLines;
                        })()}
                      </div>

                      {/* ズーム範囲内にあるストック済みクリップの範囲表示 */}
                      {activeProject.clips.map((clip) => {
                        if (duration === 0) return null;
                        const clipStart = Math.max(zoomStart, clip.startTime);
                        const clipEnd = Math.min(zoomEnd, clip.endTime);
                        if (clipStart >= clipEnd) return null;

                        const left = ((clipStart - zoomStart) / (zoomEnd - zoomStart)) * 100;
                        const width = ((clipEnd - clipStart) / (zoomEnd - zoomStart)) * 100;
                        return (
                          <div
                            key={clip.id}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className="absolute h-full bg-indigo-500/25 border-x border-indigo-400/40 hover:bg-indigo-500/35 transition-colors flex items-center justify-center"
                            title={`${clip.title}: ${clip.duration.toFixed(1)}秒`}
                          >
                            {width > 12 && (
                              <span className="text-[9px] font-mono text-indigo-200/80 pointer-events-none truncate px-1 font-semibold">
                                {clip.title}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* ズーム範囲内にあるキリトリ中の範囲表示 */}
                      {markStart !== null && duration > 0 && (() => {
                        const selStart = Math.max(zoomStart, markStart);
                        const selEnd = Math.min(zoomEnd, currentTime);
                        if (selStart >= selEnd) return null;

                        const left = ((selStart - zoomStart) / (zoomEnd - zoomStart)) * 100;
                        const width = ((selEnd - selStart) / (zoomEnd - zoomStart)) * 100;
                        return (
                          <div
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className="absolute h-full bg-white/15 border-x border-white/30"
                          />
                        );
                      })()}

                      {/* 主要な時間目盛り */}
                      <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none">
                        {(() => {
                          if (duration === 0) return null;
                          const ticks = [];
                          const startSec = Math.ceil(zoomStart / 10) * 10;
                          for (let t = startSec; t <= zoomEnd; t += 10) {
                            const left = ((t - zoomStart) / (zoomEnd - zoomStart)) * 100;
                            const isMajor = t % 30 === 0;
                            ticks.push(
                              <div
                                key={t}
                                style={{ left: `${left}%` }}
                                className="absolute bottom-0 flex flex-col items-center"
                              >
                                <div className={`w-[1px] ${isMajor ? "h-2 bg-indigo-500/40" : "h-1 bg-white/10"}`} />
                                {isMajor && (
                                  <span className="text-[8px] text-indigo-300/60 font-mono mt-0.5 -translate-x-1/2 select-none">
                                    {formatTime(t)}
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return ticks;
                        })()}
                      </div>

                      {/* 再生ヘッド (赤色の極太縦線 & 影) */}
                      {duration > 0 && currentTime >= zoomStart && currentTime <= zoomEnd && (
                        <div
                          style={{ left: `${((currentTime - zoomStart) / (zoomEnd - zoomStart)) * 100}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                        >
                          <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-[#121212]" />
                        </div>
                      )}

                      {/* ホバー位置のプレビュー縦線 & ツールチップ */}
                      {zoomHoverTime !== null && (
                        <div
                          style={{ left: `${zoomHoverX}px` }}
                          className="absolute top-0 bottom-0 w-[1px] bg-indigo-400/40 pointer-events-none z-20"
                        >
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-indigo-950/95 border border-indigo-500/30 text-indigo-100 font-mono text-[9px] px-1.5 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap">
                            {formatTime(zoomHoverTime)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 物理操作ボタン */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => playerRef.current?.seekTo(Math.max(0, currentTime - 10))}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="10秒戻る (J)"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (playerState === 1) playerRef.current?.pause();
                          else playerRef.current?.play();
                        }}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        title="再生 / 一時停止 (K)"
                      >
                        {playerState === 1 ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                      </button>
                      <button
                        onClick={() => playerRef.current?.seekTo(Math.min(duration, currentTime + 10))}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="10秒進む (L)"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* メイン切り取りボタン */}
                    <div className="flex items-center gap-2">
                      {markStart === null ? (
                        <button
                          onClick={() => setMarkStart(currentTime)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 transition-all animate-none"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          キリトリ開始地点をマーク
                          <kbd className="hidden sm:inline bg-indigo-700/60 px-1 py-0.2 rounded text-[10px] font-mono">Space</kbd>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              handleAddClip(markStart, currentTime);
                              setMarkStart(null);
                              setMarkEnd(null);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            切り取りを確定・ストックに保存
                            <kbd className="hidden sm:inline bg-emerald-700/60 px-1 py-0.2 rounded text-[10px] font-mono">Space</kbd>
                          </button>
                          <button
                            onClick={() => {
                              setMarkStart(null);
                              setMarkEnd(null);
                            }}
                            className="px-2.5 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                            title="キャンセル"
                          >
                            キャンセル
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* タイムスタンプ・インジケーター解説 */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">💡 操作方法＆ヒント</span>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    タイムライン上の<span className="text-indigo-400 font-bold">インディゴ色の帯</span>は、すでにストックされたクリップの範囲を表しています。
                    スペースキーを1回押してマークし、そのまま流して、もう1回スペースキーを押すだけで自動的にクリップが追加されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center border border-dashed border-white/10 bg-white/5 rounded-2xl text-gray-500 p-6 text-center">
                <Video className="w-12 h-12 mb-4 text-gray-700 animate-pulse" />
                <p className="text-sm font-semibold text-gray-400">編集中のプロジェクトがありません</p>
                <p className="text-xs text-gray-600 mt-1 max-w-sm">
                  左側の「新規動画をインポート」からYouTubeのURLを入力するか、デモ用の練習動画をインポートして開始してください。
                </p>
              </div>
            )}

            {/* ショートカットキーガイド */}
            <ShortcutGuide />
          </div>

          {/* クリップリストステージ */}
          <div className="lg:col-span-2">
            {activeProject ? (
              <ClipList
                clips={activeProject.clips}
                videoId={activeProject.videoId}
                onPlayClip={handlePlayClip}
                onDeleteClip={handleDeleteClip}
                onUpdateClipNote={handleUpdateClipNote}
                onUpdateClipTitle={handleUpdateClipTitle}
                onReorderClips={handleReorderClips}
                isPlayingContinuous={isPlayingContinuous}
                onToggleContinuousPlay={handleToggleContinuousPlay}
                activeClipId={activeClipId}
              />
            ) : (
              <div className="h-full min-h-[300px] flex items-center justify-center border border-dashed border-white/10 bg-white/5 rounded-xl text-gray-600 text-xs">
                プロジェクトを選択するとストックリストが表示されます
              </div>
            )}
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="border-t border-white/10 bg-[#0A0A0A] py-4 px-6 text-center text-[10px] text-gray-500 mt-auto">
        <p>© 2026 QuickClip Futsal Edition. All rights reserved.</p>
        <p className="mt-1">
          YouTube Player API を用いてブラウザ上でリアルタイムシークを行い、まるで1本の結合動画のように連続再生を実現しています。
        </p>
      </footer>
    </div>
  );
}
