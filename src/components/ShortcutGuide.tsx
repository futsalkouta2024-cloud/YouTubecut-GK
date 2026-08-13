import { Keyboard, HelpCircle, X, ChevronRight, Check } from "lucide-react";
import { useState } from "react";

export function ShortcutGuide() {
  const [isOpen, setIsOpen] = useState(true);

  const shortcuts = [
    { key: "Space", desc: "キリトリ開始 ⇄ キリトリ終了・ストック追加 (トグル)", highlight: true },
    { key: "K", desc: "動画の再生 / 一時停止", highlight: false },
    { key: "J / L", desc: "10秒巻き戻し / 10秒早送り (長尺動画の移動に便利)", highlight: false },
    { key: "← / →", desc: "1秒巻き戻し / 1秒進む (微調整に最適)", highlight: false },
    { key: "I", desc: "開始地点 (In点) を個別にマーク", highlight: false },
    { key: "O", desc: "終了地点 (Out点) を個別にマーク", highlight: false },
    { key: "Enter", desc: "現在のマーク範囲をクリップとしてストックに追加", highlight: false },
    { key: "Esc", desc: "現在のマーキング・選択状態をクリア", highlight: false },
  ];

  return (
    <div className="relative">
      {isOpen ? (
        <div className="bg-[#121212] backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl text-gray-300 w-full">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <h4 className="font-semibold text-sm text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-indigo-400" />
              編集ショートカットキー
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {shortcuts.map((shortcut, idx) => (
              <div key={idx} className="flex items-start justify-between gap-4 text-xs">
                <div className="flex items-center gap-1.5 min-w-[75px] justify-start">
                  <kbd className={`px-2 py-1 rounded text-[11px] font-mono font-bold shadow-md select-none ${
                    shortcut.highlight
                      ? "bg-indigo-600 text-white border-b-2 border-indigo-700"
                      : "bg-white/5 text-gray-200 border border-white/10 border-b-2 border-white/20"
                  }`}>
                    {shortcut.key}
                  </kbd>
                </div>
                <span className="text-gray-400 text-right text-[11px] leading-relaxed flex-1">
                  {shortcut.desc}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-gray-500 flex flex-col gap-1">
            <div className="flex items-start gap-1">
              <ChevronRight className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
              <span>
                1. 動画を再生し、キリトリたい場面の始まりで <kbd className="bg-white/5 border border-white/10 text-gray-300 px-1 py-0.2 rounded">Space</kbd> を押します。
              </span>
            </div>
            <div className="flex items-start gap-1">
              <ChevronRight className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
              <span>
                2. そのまま流して、終わりたい場面でもう一度 <kbd className="bg-white/5 border border-white/10 text-gray-300 px-1 py-0.2 rounded">Space</kbd> を押すと、約10秒の動画がストックされます。
              </span>
            </div>
            <div className="flex items-start gap-1">
              <ChevronRight className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
              <span>
                3. ストックされた動画は、右上の「1本として連続再生」を押すだけで自動的に1本の動画のように再生されます！
              </span>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[#121212] border border-white/10 rounded-lg hover:bg-white/5 text-gray-300 text-xs font-semibold cursor-pointer shadow-lg"
        >
          <Keyboard className="w-4 h-4 text-indigo-400" />
          ショートカットキーを表示
        </button>
      )}
    </div>
  );
}
