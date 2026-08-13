import { useState } from "react";
import { Clip } from "../types";
import { Play, Trash2, ChevronUp, ChevronDown, Download, Copy, Check, Sparkles, Film, Edit2, Terminal, FileCode, X, HelpCircle, ArrowRight, Monitor } from "lucide-react";
import { useIsTouchDevice } from "../hooks/useIsTouchDevice";

interface ClipListProps {
  clips: Clip[];
  onPlayClip: (clip: Clip) => void;
  onDeleteClip: (id: string) => void;
  onUpdateClipNote: (id: string, note: string) => void;
  onUpdateClipTitle: (id: string, title: string) => void;
  onReorderClips: (clips: Clip[]) => void;
  isPlayingContinuous: boolean;
  onToggleContinuousPlay: () => void;
  activeClipId: string | null;
  videoId: string;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === null) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toString().padStart(2, "0");

  if (h > 0) {
    const hStr = h.toString().padStart(2, "0");
    return `${hStr}:${mStr}:${sStr}.${ms}`;
  }
  return `${mStr}:${sStr}.${ms}`;
}

export function ClipList({
  clips,
  onPlayClip,
  onDeleteClip,
  onUpdateClipNote,
  onUpdateClipTitle,
  onReorderClips,
  isPlayingContinuous,
  onToggleContinuousPlay,
  activeClipId,
  videoId,
}: ClipListProps) {
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const isTouchDevice = useIsTouchDevice();

  const moveClip = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= clips.length) return;

    const updatedClips = [...clips];
    const temp = updatedClips[index];
    updatedClips[index] = updatedClips[newIndex];
    updatedClips[newIndex] = temp;

    onReorderClips(updatedClips);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // FFmpeg コマンドの生成
  const generateFfmpegCommand = () => {
    if (clips.length === 0) return "";
    
    let command = "# === 1. 各クリップの切り出しコマンド ===\n";
    clips.forEach((clip, index) => {
      const idx = index + 1;
      const startFormatted = formatTimeForFfmpeg(clip.startTime);
      const endFormatted = formatTimeForFfmpeg(clip.endTime);
      command += `ffmpeg -ss ${startFormatted} -to ${endFormatted} -i input.mp4 -c:v libx264 -c:a aac -b:v 5M -y clip_${idx}.mp4\n`;
    });

    command += "\n# === 2. クリップの結合リスト作成 (mylist.txt) ===\n";
    clips.forEach((_, index) => {
      command += `echo "file 'clip_${index + 1}.mp4'" >> mylist.txt\n`;
    });

    command += "\n# === 3. 1本の動画に結合するコマンド ===\n";
    command += `ffmpeg -f concat -safe 0 -i mylist.txt -c copy final_highlight.mp4\n`;
    
    return command;
  };

  // Mac/Linux 用の .sh スクリプトエクスポート
  const exportShScript = () => {
    if (clips.length === 0) return;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    let content = `#!/bin/bash
# ==========================================================
# QuickClip Futsal Edition - 自動動画結合スクリプト (Mac/Linux用)
# ==========================================================
# 動作には ffmpeg と yt-dlp が必要です。
# インストールされていない場合は、ターミナルで以下を実行してください：
# macOS: brew install yt-dlp ffmpeg
# Ubuntu: sudo apt update && sudo apt install -y ffmpeg yt-dlp

echo "=========================================================="
echo "  QuickClip - 自動動画ダウンロード＆切り出し結合プロセス"
echo "=========================================================="

# 依存性のチェック
if ! command -v yt-dlp &> /dev/null; then
    echo "❌ エラー: yt-dlp がインストールされていません。"
    echo "インストール方法: brew install yt-dlp"
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "❌ エラー: ffmpeg がインストールされていません。"
    echo "インストール方法: brew install ffmpeg"
    exit 1
fi

echo "1/3. 元のYouTube動画を最高画質でダウンロード中..."
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${videoUrl}" -o "temp_source.mp4"

if [ ! -f "temp_source.mp4" ]; then
    echo "❌ エラー: 動画のダウンロードに失敗しました。"
    exit 1
fi

echo "2/3. 各指定クリップの切り出し中..."
`;

    clips.forEach((clip, index) => {
      const idx = index + 1;
      const startFormatted = formatTimeForFfmpeg(clip.startTime);
      const endFormatted = formatTimeForFfmpeg(clip.endTime);
      content += `ffmpeg -ss ${startFormatted} -to ${endFormatted} -i temp_source.mp4 -c:v libx264 -c:a aac -b:v 5M -y clip_${idx}.mp4\n`;
    });

    content += `\n# 結合用リストファイルの作成\n`;
    content += `rm -f mylist.txt\n`;
    clips.forEach((_, index) => {
      content += `echo "file 'clip_${index + 1}.mp4'" >> mylist.txt\n`;
    });

    content += `\necho "3/3. クリップを1本の高画質MP4ファイルに結合中..."
ffmpeg -f concat -safe 0 -i mylist.txt -c copy "combined_highlight.mp4"

# 一時ファイルのクリーンアップ
rm -f mylist.txt
`;

    clips.forEach((_, index) => {
      content += `rm -f clip_${index + 1}.mp4\n`;
    });
    content += `rm -f temp_source.mp4\n`;

    content += `
echo "=========================================================="
echo "🎉 結合処理が完了しました！"
echo "生成されたファイル: combined_highlight.mp4"
echo "=========================================================="
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quickclip-export-${videoId || "youtube"}.sh`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Windows 用の .bat スクリプトエクスポート
  const exportBatScript = () => {
    if (clips.length === 0) return;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    let content = `@echo off
rem Set console to UTF-8 to handle Japanese text correctly
chcp 65001 > nul
echo ==========================================================
echo   QuickClip Futsal Edition - 自動動画結合スクリプト (Windows用)
echo ==========================================================
echo ※ 動作には ffmpeg.exe と yt-dlp.exe が必要です。
echo 同じフォルダに配置するか、環境変数(PATH)に登録してください。
echo.

where yt-dlp >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ エラー: yt-dlp.exe が見つかりません。
    echo https://github.com/yt-dlp/yt-dlp/releases から最新の yt-dlp.exe をダウンロードしてこのバッチと同じフォルダに置いてください。
    pause
    exit /b
)

where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ エラー: ffmpeg.exe が見つかりません。
    echo https://ffmpeg.org/download.html からダウンロードし、ffmpeg.exe をこのバッチと同じフォルダに置いてください。
    pause
    exit /b
)

echo 1/3. 元のYouTube動画を最高画質でダウンロード中...
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${videoUrl}" -o "temp_source.mp4"

if not exist temp_source.mp4 (
    echo ❌ エラー: 動画のダウンロードに失敗しました。
    pause
    exit /b
)

echo 2/3. 各指定クリップの切り出し中...
`;

    clips.forEach((clip, index) => {
      const idx = index + 1;
      const startFormatted = formatTimeForFfmpeg(clip.startTime);
      const endFormatted = formatTimeForFfmpeg(clip.endTime);
      content += `ffmpeg -ss ${startFormatted} -to ${endFormatted} -i temp_source.mp4 -c:v libx264 -c:a aac -b:v 5M -y clip_${idx}.mp4\n`;
    });

    content += `\nif exist mylist.txt del mylist.txt\n`;
    clips.forEach((_, index) => {
      content += `echo file 'clip_${index + 1}.mp4' >> mylist.txt\n`;
    });

    content += `\necho 3/3. クリップを1本の高画質MP4ファイルに結合中...
ffmpeg -f concat -safe 0 -i mylist.txt -c copy "combined_highlight.mp4"

rem 一時ファイルのクリーンアップ
if exist mylist.txt del mylist.txt
`;

    clips.forEach((_, index) => {
      content += `if exist clip_${index + 1}.mp4 del clip_${index + 1}.mp4\n`;
    });
    content += `if exist temp_source.mp4 del temp_source.mp4\n`;

    content += `
echo ==========================================================
echo 🎉 結合処理が完了しました！
echo 生成されたファイル: combined_highlight.mp4
echo ==========================================================
pause
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quickclip-export-${videoId || "youtube"}.bat`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSVのエクスポート
  const exportToCsv = () => {
    if (clips.length === 0) return;
    const headers = "Clip Number,Title,Start Second,End Second,Duration (sec),Formatted Start,Formatted End,Note\n";
    const rows = clips.map((clip, index) => {
      return `${index + 1},"${clip.title.replace(/"/g, '""')}",${clip.startTime.toFixed(2)},${clip.endTime.toFixed(2)},${clip.duration.toFixed(1)},"${formatTime(clip.startTime)}","${formatTime(clip.endTime)}","${(clip.note || "").replace(/"/g, '""')}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clips-export-${videoId || "youtube"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSONのエクスポート
  const exportToJson = () => {
    if (clips.length === 0) return;
    const dataStr = JSON.stringify(clips, null, 2);
    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clips-project-${videoId || "youtube"}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ffmpeg用に hh:mm:ss.xxx の形式に変換する
  const formatTimeForFfmpeg = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    const hStr = h.toString().padStart(2, "0");
    const mStr = m.toString().padStart(2, "0");
    const sStr = s.toString().padStart(2, "0");
    const msStr = ms.toString().padStart(3, "0");

    return `${hStr}:${mStr}:${sStr}.${msStr}`;
  };

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);

  return (
    <div className="flex flex-col h-full bg-[#121212] rounded-xl border border-white/10 overflow-hidden shadow-md">
      {/* ヘッダー情報 */}
      <div className="p-4 border-b border-white/10 bg-white/5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            ストックされたクリップ ({clips.length})
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            結合後の総時間: <span className="text-indigo-400 font-mono font-bold">{totalDuration.toFixed(1)}秒</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 連続再生トグル */}
          <button
            onClick={onToggleContinuousPlay}
            disabled={clips.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPlayingContinuous
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
                : "bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isPlayingContinuous ? "animate-spin" : ""}`} />
            {isPlayingContinuous ? "1本として連続再生中" : "1本として連続再生"}
          </button>
        </div>
      </div>

      {/* リストエリア */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[350px] lg:max-h-none min-h-[200px]">
        {clips.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-3 text-gray-400">
              <Film className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-sm font-medium text-gray-400">ストックされたクリップはありません</p>
            <p className="text-xs text-gray-600 mt-1.5 max-w-[280px]">
              {isTouchDevice ? (
                "動画を再生しながら「キリトリ開始地点をマーク」をタップしてお気に入りの場面を切り取りましょう！"
              ) : (
                <>
                  動画を再生しながら<kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-mono mx-1">Space</kbd>キーを押して
                  お気に入りの場面を切り取りましょう！
                </>
              )}
            </p>
          </div>
        ) : (
          clips.map((clip, index) => {
            const isActive = activeClipId === clip.id;
            const isEditing = editingClipId === clip.id;

            return (
              <div
                key={clip.id}
                className={`group relative flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isActive
                    ? "bg-indigo-500/10 border-indigo-500/40 shadow-sm"
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                }`}
              >
                {/* 左側：インデックス、並び替え */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => moveClip(index, "up")}
                      disabled={index === 0}
                      className="p-0.5 text-gray-500 hover:text-gray-200 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono font-bold text-gray-500 my-0.5">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <button
                      onClick={() => moveClip(index, "down")}
                      disabled={index === clips.length - 1}
                      className="p-0.5 text-gray-500 hover:text-gray-200 disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* クリップ情報 */}
                  <div className="space-y-1 max-w-[160px] sm:max-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={clip.title}
                          onChange={(e) => onUpdateClipTitle(clip.id, e.target.value)}
                          onBlur={() => setEditingClipId(null)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingClipId(null)}
                          autoFocus
                          className="text-base sm:text-xs bg-[#1A1A1A] text-white border border-white/10 rounded px-1.5 py-0.5 outline-none focus:border-indigo-500 w-full"
                        />
                      ) : (
                        <span
                          onClick={() => setEditingClipId(clip.id)}
                          className="text-xs font-semibold text-gray-200 hover:text-indigo-400 cursor-pointer flex items-center gap-1"
                        >
                          {clip.title}
                          <Edit2 className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-gray-400">
                        {formatTime(clip.startTime)} 〜 {formatTime(clip.endTime)}
                      </span>
                      <span className="text-indigo-300 font-bold bg-indigo-500/20 border border-indigo-500/30 px-1 rounded">
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>

                    {/* メモ編集 */}
                    <input
                      type="text"
                      placeholder="タグやメモを追加 (例: ゴール, シュート...)"
                      value={clip.note || ""}
                      onChange={(e) => onUpdateClipNote(clip.id, e.target.value)}
                      className="text-base sm:text-[11px] text-gray-300 placeholder-gray-600 bg-transparent border-b border-transparent hover:border-white/10 focus:border-white/20 focus:bg-white/5 w-full py-0.5 outline-none rounded"
                    />
                  </div>
                </div>

                {/* 右側：再生、削除 */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onPlayClip(clip)}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                    title="このクリップをプレビュー"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={() => onDeleteClip(clip.id)}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 cursor-pointer transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* エクスポート・アクションフッター */}
      {clips.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-white/5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={exportToJson}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1A1A1A] hover:bg-white/5 border border-white/10 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-gray-400" />
              JSON保存
            </button>
            <button
              onClick={exportToCsv}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1A1A1A] hover:bg-white/5 border border-white/10 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-gray-400" />
              CSV保存 (エクセル)
            </button>
          </div>

          {/* 実用的な1本のMP4結合ダウンロードセクション */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" />
            1本の動画(MP4)としてエクスポート
          </button>
          {isTouchDevice && (
            <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1 -mt-1">
              <Monitor className="w-3 h-3 shrink-0" />
              MP4への結合処理はPC(ffmpeg実行環境)が必要です
            </p>
          )}

          {/* FFmpeg 結合コマンドセクション */}
          <div className="bg-[#1A1A1A] rounded-lg border border-white/10 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Film className="w-3.5 h-3.5 text-indigo-400" />
                FFmpeg 結合コマンド
              </span>
              <button
                onClick={() => handleCopyText(generateFfmpegCommand(), "ffmpeg")}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedIndex === "ffmpeg" ? (
                  <>
                    <Check className="w-3 h-3" />
                    コピー完了
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    コマンドをコピー
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
              ダウンロードした1つの動画から、ストックした全クリップを綺麗に切り出して1本に結合するPC用コマンドです。
            </p>
            <pre className="text-[10px] font-mono bg-black/40 p-2 rounded text-gray-300 overflow-x-auto border border-white/5 max-h-[110px]">
              {generateFfmpegCommand()}
            </pre>
          </div>
        </div>
      )}

      {/* エクスポート方法を親切に解説＆一括自動スクリプト配布用モーダル */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121212] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="w-10 h-10 bg-indigo-600/15 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">MP4形式でエクスポート</h3>
                <p className="text-xs text-gray-400">
                  超高画質・劣化なしで1本に結合したMP4を書き出します
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-gray-400">
                  YouTubeのセキュリティ仕様(CORS)により、ブラウザ上だけでYouTubeから直接動画ピクセルをダウンロードしてMP4をエンコードすることは制限されています。
                  そのため、お使いのPCで<strong>「全自動でダウンロード・切り出し・結合」を行う一括自動化スクリプト</strong>を用意しました！
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-1.5 text-xs">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  使い方（たったの2ステップ）
                </h4>
                <ol className="space-y-2 text-gray-400 list-decimal list-inside bg-white/5 p-3 rounded-xl border border-white/5">
                  <li>下のボタンからお使いのOSに合うスクリプトをダウンロードします。</li>
                  <li>ダウンロードしたスクリプトファイルを、動画を保存したいフォルダに入れて実行するだけ！自動的に最高画質のMP4動画が1本生成されます。</li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    exportBatScript();
                  }}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer group transition-all text-center gap-2"
                >
                  <FileCode className="w-7 h-7 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="font-semibold text-white text-xs">Windows用 (.bat)</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">ダブルクリックで実行</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    exportShScript();
                  }}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer group transition-all text-center gap-2"
                >
                  <Terminal className="w-7 h-7 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="font-semibold text-white text-xs">Mac / Linux用 (.sh)</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">ターミナルで実行</p>
                  </div>
                </button>
              </div>

              <div className="pt-2 text-[10px] text-gray-500 flex flex-col gap-1 border-t border-white/5">
                <p>※ 動作には PC に <strong>ffmpeg</strong> と <strong>yt-dlp</strong> (無料・オープンソース) がインストールされている必要があります。</p>
                <p>※ Mac であればターミナルで <code className="bg-black/50 px-1 py-0.5 rounded text-gray-300">brew install yt-dlp ffmpeg</code> と入力するだけで簡単に導入できます。</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

