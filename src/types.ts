export interface Clip {
  id: string;
  startTime: number; // 秒数
  endTime: number;   // 秒数
  duration: number;  // 秒数
  note?: string;     // メモ（フットサルの「シュート」「ゴール」など）
  title: string;     // クリップ名
}

export interface VideoProject {
  id: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
  clips: Clip[];
  createdAt: string;
}
