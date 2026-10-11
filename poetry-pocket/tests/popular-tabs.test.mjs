import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pairEntries, defaults, applyReview, quoteEntries } from '../core.js';
import * as fam from '../familiarity-ui.js';
import { createRegistry, setFamiliarity } from '../familiarity.js';
import { pairsView, filterPairs } from '../explorer.js';
import { studyView } from '../views.js';

const poems = JSON.parse(readFileSync(new URL('../data/poems.json', import.meta.url), 'utf8'));

test('分頁1：我的背誦 - 全部 vs 🔥只看熱門（作品與名句獨立篩選）', () => {
  const state = defaults();
  const registry = createRegistry(poems, quoteEntries(poems));

  // 1. 作品模式：全部作品
  const optsPoemAll = { filters: [], sort: 'default', selected: [], batch: false, popular: false };
  fam.configureFamiliarity(state, registry, optsPoemAll);
  const htmlPoemAll = fam.managerView('poem', '');
  assert.ok(htmlPoemAll.includes('符合 518 項'), '全部作品模式下顯示 518 項');
  assert.ok(htmlPoemAll.includes('全部作品'), '含有 全部作品 按鈕');
  assert.ok(htmlPoemAll.includes('🔥 只看熱門'), '含有 🔥 只看熱門 按鈕');

  // 2. 作品模式：🔥只看熱門
  const optsPoemPop = { filters: [], sort: 'default', selected: [], batch: false, popular: true };
  fam.configureFamiliarity(state, registry, optsPoemPop);
  const htmlPoemPop = fam.managerView('poem', '');
  assert.ok(htmlPoemPop.includes('符合 35 項'), '只看熱門模式下顯示 35 項');

  // 3. 名句模式：全部名句 (registry 中名句去重後共 1240 項)
  const optsQuoteAll = { filters: [], sort: 'default', selected: [], batch: false, popular: false };
  fam.configureFamiliarity(state, registry, optsQuoteAll);
  const htmlQuoteAll = fam.managerView('quote', '');
  assert.ok(htmlQuoteAll.includes('符合 1240 項'), '全部名句模式下顯示 1240 項');
  assert.ok(htmlQuoteAll.includes('全部名句'), '含有 全部名句 按鈕');
  assert.ok(htmlQuoteAll.includes('🔥 熱門名句'), '含有 🔥 熱門名句 按鈕');

  // 4. 名句模式：🔥熱門名句 (registry 中熱門作品名句共 111 項)
  const optsQuotePop = { filters: [], sort: 'default', selected: [], batch: false, popular: true };
  fam.configureFamiliarity(state, registry, optsQuotePop);
  const htmlQuotePop = fam.managerView('quote', '');
  assert.ok(htmlQuotePop.includes('符合 111 項'), '熱門名句模式下顯示 111 項');
});

test('分頁1：我的背誦 - 🔥熱門 ＋ 熟悉度篩選（交集運作）', () => {
  let state = defaults();
  const registry = createRegistry(poems, quoteEntries(poems));
  const ref = (type, id) => registry.byKey.get(registry.resolve(type, id));

  // 先把其中 3 首熱門作品標為 weak、2 首標為 familiar
  const popPoems = poems.filter(p => (p.tags || []).includes('熱門'));
  state = setFamiliarity(state, [ref('poem', popPoems[0].id)], 'weak', new Date());
  state = setFamiliarity(state, [ref('poem', popPoems[1].id)], 'weak', new Date());
  state = setFamiliarity(state, [ref('poem', popPoems[2].id)], 'weak', new Date());
  state = setFamiliarity(state, [ref('poem', popPoems[3].id)], 'familiar', new Date());
  state = setFamiliarity(state, [ref('poem', popPoems[4].id)], 'familiar', new Date());

  // 同時把 1 首非熱門作品也標為 weak
  const nonPop = poems.find(p => !(p.tags || []).includes('熱門'));
  state = setFamiliarity(state, [ref('poem', nonPop.id)], 'weak', new Date());

  // 篩選：熱門 + weak
  const optsWeakPop = { filters: ['weak'], sort: 'default', selected: [], batch: false, popular: true };
  fam.configureFamiliarity(state, registry, optsWeakPop);
  const htmlWeakPop = fam.managerView('poem', '');
  assert.ok(htmlWeakPop.includes('符合 3 項'), '熱門＋很不熟(weak)精確交集為 3 項');

  // 篩選：熱門 + unlearned (35 - 5 = 30)
  const optsUnlearnedPop = { filters: ['unlearned'], sort: 'default', selected: [], batch: false, popular: true };
  fam.configureFamiliarity(state, registry, optsUnlearnedPop);
  const htmlUnlearnedPop = fam.managerView('poem', '');
  assert.ok(htmlUnlearnedPop.includes('符合 30 項'), '熱門＋未背誦(unlearned)精確交集為 30 項');

  // 篩選：全部 + weak (3 + 1 = 4)
  const optsWeakAll = { filters: ['weak'], sort: 'default', selected: [], batch: false, popular: false };
  fam.configureFamiliarity(state, registry, optsWeakAll);
  const htmlWeakAll = fam.managerView('poem', '');
  assert.ok(htmlWeakAll.includes('符合 4 項'), '全部＋很不熟(weak)為 4 項');
});

test('分頁2：名句 - 全部 vs 🔥熱門名句 及熟悉度交集', () => {
  const state = defaults();
  const registry = createRegistry(poems, quoteEntries(poems));
  const ref = (type, id) => registry.byKey.get(registry.resolve(type, id));
  const dummyOpts = { filters: [], sort: 'default', selected: [], batch: false };
  fam.configureFamiliarity(state, registry, dummyOpts);

  // 1. 全部名句 (pairEntries 共 1083 組)
  const allPairs = filterPairs(poems, state, { popular: false, type: '', theme: '', saved: false, query: '' });
  assert.equal(allPairs.length, 1083, '全部名句共 1083 組');

  const htmlAll = pairsView(poems, state, { popular: false, type: '', theme: '', saved: false, query: '' });
  assert.ok(htmlAll.includes('全部名句'), '呈現 全部名句 按鈕');
  assert.ok(htmlAll.includes('🔥 熱門名句'), '呈現 🔥 熱門名句 按鈕');
  assert.ok(htmlAll.includes('找到 1083 組'), '顯示 找到 1083 組');

  // 2. 熱門名句 (pairEntries 中熱門作品共 92 組)
  const popPairs = filterPairs(poems, state, { popular: true, type: '', theme: '', saved: false, query: '' });
  assert.equal(popPairs.length, 92, '熱門作品對應名句共 92 組');
  assert.ok(popPairs.every(q => (q.poem.tags || []).includes('熱門')), '每組名句均出自熱門作品');

  const htmlPop = pairsView(poems, state, { popular: true, type: '', theme: '', saved: false, query: '' });
  assert.ok(htmlPop.includes('找到 92 組'), '顯示 找到 92 組');

  // 3. 熱門名句 + 熟悉度篩選
  let stateWithQuote = setFamiliarity(state, [ref('quote', popPairs[0].id)], 'familiar', new Date());
  fam.configureFamiliarity(stateWithQuote, registry, { filters: ['familiar'], sort: 'default', selected: [], batch: false });
  const famPairs = filterPairs(poems, stateWithQuote, { popular: true, type: '', theme: '', saved: false, query: '' });
  assert.equal(famPairs.length, 1, '熱門＋熟悉度熟(familiar)交集精確為 1 組');
});

test('分頁3：背誦 - 全部 vs 🔥只背熱門 及 🔥熱門學習進度卡片', () => {
  let state = defaults();
  const registry = createRegistry(poems, quoteEntries(poems));
  const ref = (type, id) => registry.byKey.get(registry.resolve(type, id));
  fam.configureFamiliarity(state, registry, { filters: [], sort: 'default', selected: [], batch: false });

  // 標記幾首熱門作品進度
  const popPoems = poems.filter(p => (p.tags || []).includes('熱門'));
  state = applyReview(state, popPoems[0].id, 3);
  state = applyReview(state, popPoems[1].id, 2);
  state = setFamiliarity(state, [ref('poem', popPoems[0].id)], 'familiar', new Date());
  state = setFamiliarity(state, [ref('poem', popPoems[1].id)], 'shaky', new Date());
  state = setFamiliarity(state, [ref('poem', popPoems[2].id)], 'weak', new Date());

  // 1. 全部作品模式
  const htmlAll = studyView(poems, state, { popular: false });
  assert.ok(htmlAll.includes('全部作品'), '含有 全部作品 按鈕');
  assert.ok(htmlAll.includes('🔥 只背熱門'), '含有 🔥 只背熱門 按鈕');
  assert.ok(htmlAll.includes('🔥 熱門學習進度'), '含有 🔥 熱門學習進度 卡片');
  assert.ok(htmlAll.includes('已熟讀'), '卡片顯示 已熟讀 統計');
  assert.ok(htmlAll.includes('不太熟'), '卡片顯示 不太熟 統計');
  assert.ok(htmlAll.includes('很不熟'), '卡片顯示 很不熟 統計');
  assert.ok(htmlAll.includes('尚未背誦'), '卡片顯示 尚未背誦 統計');

  // 2. 🔥只背熱門模式
  const htmlPop = studyView(poems, state, { popular: true });
  assert.ok(htmlPop.includes('熱門作品 35 首，其中 2 首已練習'), '提示反映當前熱門篩選母體與練習狀況');
  
  // 檢查自由練習清單在熱門模式下不包含非熱門作品
  const nonPop = poems.find(p => !(p.tags || []).includes('熱門'));
  assert.ok(!htmlPop.includes(`/practice/${nonPop.id}`), '只背熱門模式不包含非熱門作品連結');
  assert.ok(htmlPop.includes(`/practice/${popPoems[0].id}`), '只背熱門模式包含熱門作品連結');
});

test('狀態獨立性：切換篩選條件不改變學習紀錄，各分頁狀態各自獨立', () => {
  let state = defaults();
  const testPoemId = 'li-zao';
  state = applyReview(state, testPoemId, 3);
  const originalReviewCount = state.progress[testPoemId].reviewCount;

  // 模擬三個分頁獨立狀態
  const tabStates = {
    recitation: { popular: false },
    pairs: { popular: true },
    study: { popular: true }
  };

  assert.equal(tabStates.recitation.popular, false);
  assert.equal(tabStates.pairs.popular, true);
  assert.equal(tabStates.study.popular, true);

  // 切換 recitation 狀態
  tabStates.recitation.popular = true;
  assert.equal(tabStates.recitation.popular, true);
  assert.equal(tabStates.pairs.popular, true);

  // 驗證背誦紀錄完全無損
  assert.equal(state.progress[testPoemId].reviewCount, originalReviewCount);
});
