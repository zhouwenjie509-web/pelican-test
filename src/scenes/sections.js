// The 20 sections in chronological order: names for the title cards, the
// historical date, and a stand-in colour used until each scene is painted.

export const SECTIONS = [
  { n: 1, id: "sahara", zh: "撒哈拉岩画", en: "Saharan Rock Art", date: "约公元前 4000 年", dateEn: "c. 4000 BCE", color: "#b5673a" },
  { n: 2, id: "egypt", zh: "古埃及壁画", en: "Egyptian Wall Painting", date: "约公元前 1300 年", dateEn: "c. 1300 BCE", color: "#d9b36a" },
  { n: 3, id: "han", zh: "汉画像石拓片", en: "Han Stone Relief Rubbing", date: "约公元 100 年", dateEn: "c. 100 CE", color: "#26231f" },
  { n: 4, id: "tang", zh: "唐代白描", en: "Tang Baimiao Line Drawing", date: "约公元 750 年", dateEn: "c. 750 CE", color: "#e8dfc8" },
  { n: 5, id: "song", zh: "宋代山水", en: "Song Landscape Painting", date: "约公元 1000 年", dateEn: "c. 1000 CE", color: "#b9b19a" },
  { n: 6, id: "qingming", zh: "清明上河图", en: "Along the River During the Qingming Festival", date: "约公元 1100 年", dateEn: "c. 1100 CE", color: "#cdb98f" },
  { n: 7, id: "maya", zh: "玛雅手抄本", en: "Maya Codex", date: "约公元 1200 年", dateEn: "c. 1200 CE", color: "#4a9a94" },
  { n: 8, id: "mughal", zh: "莫卧儿细密画", en: "Mughal Miniature Painting", date: "约公元 1600 年", dateEn: "c. 1600 CE", color: "#1f6b4f" },
  { n: 9, id: "bada", zh: "八大山人写意", en: "Bada Shanren Expressive Ink", date: "约 1690 年", dateEn: "c. 1690", color: "#efe9dc" },
  { n: 10, id: "wayang", zh: "爪哇皮影", en: "Javanese Wayang Kulit", date: "约 1800 年", dateEn: "c. 1800", color: "#d98e2b" },
  { n: 11, id: "ukiyoe", zh: "浮世绘", en: "Ukiyo-e", date: "19 世纪 30 年代", dateEn: "1830s", color: "#2d5c88" },
  { n: 12, id: "starry", zh: "梵高《星夜》", en: "The Starry Night", date: "1889 年", dateEn: "1889", color: "#1d2f6f" },
  { n: 13, id: "scream", zh: "蒙克《呐喊》", en: "The Scream", date: "1893 年", dateEn: "1893", color: "#d9562b" },
  { n: 14, id: "nosferatu", zh: "《诺斯费拉图》", en: "Nosferatu", date: "1922 年", dateEn: "1922", color: "#3b3b3b" },
  { n: 15, id: "scope", zh: "示波器矢量图形", en: "Oscilloscope Vector Graphics", date: "20 世纪 50 年代", dateEn: "1950s", color: "#06140c" },
  { n: 16, id: "pixel", zh: "8 位像素游戏", en: "8-Bit Pixel Game", date: "20 世纪 80 年代", dateEn: "1980s", color: "#4f7cf0" },
  { n: 17, id: "chat", zh: "早期聊天窗口", en: "Early Chat Window", date: "21 世纪 00 年代", dateEn: "2000s", color: "#dfe7f5" },
  { n: 18, id: "vapor", zh: "蒸汽波", en: "Vaporwave", date: "21 世纪 10 年代", dateEn: "2010s", color: "#ff71ce" },
  { n: 19, id: "shortvideo", zh: "竖屏短视频", en: "Vertical Short-Form Video", date: "21 世纪 20 年代", dateEn: "2020s", color: "#101014" },
  { n: 20, id: "code", zh: "代码美学", en: "Code Aesthetics", date: "21 世纪 20 年代 · 大模型时代", dateEn: "2020s, the LLM era", color: "#1e1e2e" },
];

export const sectionMeta = (n) => SECTIONS[n - 1];
