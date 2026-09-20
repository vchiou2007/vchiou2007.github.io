import {createRegistry,migrateFamiliarity,setFamiliarity} from './familiarity.js';
import {lineEntries,cleanLineProgress} from './feihua-core.js';
export const RATINGS = ['😕 完全忘了', '🤔 有印象', '🙂 大致記得', '😊 很熟'];
export const THEMES = { paper: '宣紙', moon: '月夜', green: '青綠山水', blossom: '桃花', ink: '水墨', night: '深色夜讀' };
export const SPEEDS = [0.7, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const defaults = () => ({ schemaVersion: 1, settings: { theme: 'paper', size: 'large', zhuyin: true, speed: 1.25, onboarded: false }, familiarity:{version:1,records:{}}, progress: {}, lineProgress: {}, quotes: [], events: [] });
export function isZhuyin(text) { return typeof text === 'string' && /^[ㄅ-ㄩˊˇˋ˙]+$/u.test(text) && /[ㄅ-ㄩ]/u.test(text); }
export function validatePoems(poems) {
  if (!Array.isArray(poems) || !poems.length || new Set(poems.map(p => p.id)).size !== poems.length) throw new Error('詩集格式錯誤');
  for (const p of poems) {
    for (const field of ['id', 'title', 'author', 'dynasty', 'type', 'translation', 'background', 'source', 'textualNote']) if (typeof p[field] !== 'string' || !p[field]) throw new Error('詩集缺少必要內容');
    if (!Array.isArray(p.lines) || !p.lines.length || !p.lines.every(l => typeof l === 'string' && l.length)) throw new Error('詩句格式錯誤');
    for (const field of ['famousLines', 'locations', 'tags', 'difficultCharacters']) if (!Array.isArray(p[field])) throw new Error('詩集分類格式錯誤');
    for (const d of p.difficultCharacters) if (!isZhuyin(d.zhuyin) || !p.lines.includes(d.lineContext) || !d.lineContext.includes(d.character)) throw new Error('注音資料格式錯誤');
  }
  return poems;
}
export function searchPoems(poems, query = '', category = '') {
  const terms = query.trim().split(/\s+/u).filter(Boolean);
  return poems.filter(p => (!category || p.type === category || p.author === category || p.locations.includes(category)) && terms.every(t => [p.title, p.author, p.dynasty, p.type, ...p.lines, ...p.tags, ...p.locations].join(' ').includes(t)));
}
export function dailyPoem(poems, now = new Date()) { return poems[(now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate()) % poems.length]; }
export function nextReviewDate(rating, count, now = new Date()) {
  if (!Number.isInteger(rating) || rating < 0 || rating > 3) throw new Error('無效的評分');
  if (rating === 0) return new Date(now.getTime() + 600000).toISOString();
  const days = rating === 1 ? 1 : rating === 2 ? 3 : 7 * Math.max(1, Math.min(count + 1, 8));
  const date = new Date(now); date.setDate(date.getDate() + days); return date.toISOString();
}
export function applyReview(state, poemID, rating, now = new Date()) {
  const next = structuredClone(state);
  const old = next.progress[poemID] || { reviewCount: 0, isFavorite: false, masteryLevel: 0 };
  next.progress[poemID] = { ...old, lastReviewed: now.toISOString(), nextReviewDate: nextReviewDate(rating, old.reviewCount, now), reviewCount: old.reviewCount + 1, masteryLevel: rating };
  next.events.push({ poemID, rating, date: now.toISOString() }); return setFamiliarity(next,[{key:'poem:'+poemID,contentId:poemID,contentType:'poem'}],['weak','weak','shaky','familiar'][rating],now,true);
}
export function togglePoem(state, id) {
  const next = structuredClone(state);
  const old = next.progress[id] || { reviewCount: 0, masteryLevel: 0, isFavorite: false };
  next.progress[id] = { ...old, isFavorite: !old.isFavorite }; return next;
}
export function toggleQuote(state, id) { const next = structuredClone(state); next.quotes = next.quotes.includes(id) ? next.quotes.filter(x => x !== id) : [...next.quotes, id]; return next; }
export function duePoems(poems, state, now = new Date()) {
  const time = p => state.progress[p.id]?.nextReviewDate ? Date.parse(state.progress[p.id].nextReviewDate) : 0;
  return poems.filter(p => time(p) <= now.getTime()).sort((a, b) => time(a) - time(b));
}
export function maskLine(line, mode, index, revealed = false) {
  if (revealed || mode === 'read') return line;
  if (mode === 'lines') return index % 2 ? '＿＿＿＿＿＿' : line;
  let n = 0;
  return [...line].map(c => /[\u3400-\u9fff]/u.test(c) && ++n % 3 === 0 ? '＿' : c).join('');
}
const PAIR_RANGES={
 'su-jiang':[[[0],[1,2]],[[11],[12]]], 'su-shui':[[[0],[1]],[[17],[18]]],
 'su-nian':[[[0],[1,2]],[[9],[10]]], 'xin-po':[[[0],[1]],[[7],[8]]],
 'xin-qing':[[[9],[10,11,12]],[[4],[5,6]]], 'qing-sheng':[[[0,1],[2]],[[19],[20]]],
 'du-chun':[[[0],[1]],[[4],[5]]], 'wang-shan':[[[2],[3]],[[4],[5]]],
 'qing-ru':[[[0],[1]],[[4,5],[6]]], 'yue-man':[[[6],[7]],[[8],[9,10]]]
};
export function pairEntries(poems) {
 const pairs=poems.flatMap(p=>{
  const ranges=PAIR_RANGES[p.id]||[[[0],[1]],[[2],[3]]];
  return ranges.map((halves,i)=>{
   const lines=halves.map(indices=>indices.map(n=>p.lines[n]).join(''));
   return {id:`${p.id}:pair:${i}`,lines,text:lines.join(''),poem:p};
  });
 });
 return pairs.map((q,i)=>({...q,previous:pairs[(i+pairs.length-1)%pairs.length].id,next:pairs[(i+1)%pairs.length].id}));
}
export function quoteEntries(poems) { const all=[...poems.flatMap(p => p.famousLines.map((text, i) => ({ id: `${p.id}:${i}`, text, poem: p }))),...pairEntries(poems),...lineEntries(poems)]; return [...new Map(all.map(q=>[q.id,q])).values()]; }
export function validateBackup(input, poems) {
  if (!input || input.schemaVersion !== 1 || !input.settings || !input.progress || Array.isArray(input.progress) || !Array.isArray(input.quotes) || !Array.isArray(input.events)) throw new Error('這不是有效的詩詞備份檔');
  if (Object.keys(input.progress).length > poems.length || input.events.length > 100000) throw new Error('備份內容超出限制');
  const ids = new Set(poems.map(p => p.id)), quoteIDs = new Set(quoteEntries(poems).map(q => q.id));
  const clean = defaults(), s = input.settings;
  if (!Object.hasOwn(THEMES, s.theme) || !['small', 'medium', 'large', 'xl'].includes(s.size) || typeof s.zhuyin !== 'boolean' || !SPEEDS.includes(s.speed)) throw new Error('閱讀設定格式錯誤');
  clean.settings = { theme: s.theme, size: s.size, zhuyin: s.zhuyin, speed: s.speed, onboarded: Boolean(s.onboarded) };
  const validDate = d => typeof d === 'string' && Number.isFinite(Date.parse(d));
  for (const [id, p] of Object.entries(input.progress)) {
    if (!ids.has(id) || !p || typeof p.isFavorite !== 'boolean' || !Number.isInteger(p.reviewCount) || p.reviewCount < 0 || p.reviewCount > 100000 || !Number.isInteger(p.masteryLevel) || p.masteryLevel < 0 || p.masteryLevel > 3) throw new Error('學習進度格式錯誤');
    if (p.reviewCount && (!validDate(p.lastReviewed) || !validDate(p.nextReviewDate))) throw new Error('複習日期格式錯誤');
    clean.progress[id] = { isFavorite: p.isFavorite, reviewCount: p.reviewCount, masteryLevel: p.masteryLevel, ...(p.reviewCount ? { lastReviewed: new Date(p.lastReviewed).toISOString(), nextReviewDate: new Date(p.nextReviewDate).toISOString() } : {}) };
  }
  if (!input.quotes.every(id => quoteIDs.has(id))) throw new Error('名句收藏不在目前詩集裡');
  clean.quotes = [...new Set(input.quotes)];
  clean.events = input.events.map(e => {
    if (!e || !ids.has(e.poemID) || !validDate(e.date) || !Number.isInteger(e.rating) || e.rating < 0 || e.rating > 3) throw new Error('複習紀錄格式錯誤');
    return { poemID: e.poemID, date: new Date(e.date).toISOString(), rating: e.rating };
  });
  clean.lineProgress=cleanLineProgress(input.lineProgress,lineEntries(poems));
  clean.familiarity=migrateFamiliarity(input,createRegistry(poems,quoteEntries(poems)));
  return clean;
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
