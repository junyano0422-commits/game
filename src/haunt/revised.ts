import { z } from 'zod';
import { hauntConfig as config } from './config';
import { revisionConfig as rules } from './revision-config';
import {
  actHaunt,
  createHaunt,
  decodeHaunt,
  encodeHaunt,
  hauntDiagnosis,
  omen,
  puzzle,
} from './engine';
import type { HauntAction, HauntRun } from './engine';
import type { ClueRoom, HauntMode } from './config';
export { canSeal, hauntSaveKey, omen, puzzle } from './engine';
export type RevisedRun = HauntRun & {
  revision: 2;
  passage: boolean;
  watchTurns: number;
  hides: number;
  remembered: ClueRoom[];
};
export type NightRun = HauntRun | RevisedRun;
export const isRevised = (run: NightRun): run is RevisedRun =>
  'revision' in run && run.revision === 2;
export function createNight(seed: number, mode: HauntMode = 'quick'): RevisedRun {
  return {
    ...createHaunt(seed, mode),
    revision: 2,
    passage: false,
    watchTurns: 0,
    hides: 0,
    remembered: [],
  };
}
const roomName = (id: ClueRoom) => config.rooms.find((r) => r.id === id)!.name;
export function fragments(run: NightRun) {
  const p = puzzle(run);
  return isRevised(run)
    ? {
        video: run.orderKnown ? `最後に映るのは「${roomName(p.order[2]!)}」。` : null,
        diary: run.clues.includes('study')
          ? `「${roomName(p.order[0]!)}」は「${roomName(p.order[1]!)}」より先。`
          : null,
      }
    : null;
}
export function actNight(run: NightRun, action: HauntAction): NightRun {
  if (!isRevised(run)) return actHaunt(run, action);
  const next = actHaunt(run, action) as RevisedRun; // Preserve v1 validation and item effects; apply v2 costs below.
  const sign = omen(run);
  let extra = 0;
  let relief = 0;
  next.message = next.message
    .replace(/\n背後で、濡れた髪が床を擦った。もう、扉は見えない。$/, '')
    .replace(/\n気配に触れてしまった。彼女が、近づく。$/, '');
  next.passage = false;
  next.watchTurns = run.watchTurns + (run.tv ? 1 : 0);
  const danger = run.tv ? config.rules.omenFear : rules.darkDangerFear;
  if (action.kind === 'move') {
    extra = sign.id === 'steps' && !run.passage ? danger : 0;
    if (run.passage) next.message += '\n扉の前の足音をやり過ごし、気づかれずに移動できた。';
    else if (extra) next.message += '\n足音に重なった。彼女は、こちらの場所を知った。';
    if (action.room === 'bath' && !run.tv)
      next.message += '\nテレビは消した。それなのに、鏡には砂嵐が映っている。';
    if (action.room === 'well' && run.clues[0] === 'study')
      next.message += '\n日記と同じ文字が、井戸の縁に浮かんでいる。';
  } else if (action.kind === 'search') {
    extra = sign.id === 'eyes' && !action.light && !run.ward ? danger : 0;
    const duplicate =
      run.room === 'living' ? run.orderKnown : run.clues.includes(run.room as ClueRoom);
    if (duplicate) extra += 2;
    if (!duplicate) {
      if (run.room === 'living')
        next.message = `映像の最後に一つの部屋が残った。\n${fragments(next)!.video}\nほかの順番は、日記の書き込みと組み合わせて考えよう。`;
      else {
        const room = run.room as ClueRoom;
        if (room === 'study') next.message += `\n濡れた余白の書き込み：${fragments(next)!.diary}`;
        if (run.tv) {
          next.remembered.push(room);
          next.message += `\n【映像と重なる記憶】${rules.memories[room]}`;
        } else if (room === 'bath') next.message += '\n鏡の中だけで、消えた映像が続いている。';
      }
    }
  } else if (action.kind === 'wait') {
    const success = sign.id === 'steps' && run.actions.at(-1)?.kind !== 'wait';
    relief = success ? rules.restRelief : 0;
    extra = success ? 0 : rules.blindRestFear;
    next.passage = success;
    next.hides = run.hides + (success ? 1 : 0);
    next.message = success
      ? '息を止める。足音が、ゆっくり扉を離れた。\n気配が遠ざかり、次の1回は安全に移動できる。'
      : run.actions.at(-1)?.kind === 'wait'
        ? '隠れ続けるあなたの呼吸を、誰かが真似し始めた。\n足音のないときや、続けて隠れると逆に気配が増す。'
        : '足音はない。静寂の中で、あなたの呼吸だけが響いた。\n息をひそめるのは、扉の前に足音があるとき。';
  } else if (action.kind === 'seal' && next.phase !== 'escaped') extra = config.rules.wrongSealFear;
  else if (action.kind === 'unplug')
    next.message =
      'プラグを抜いた。行動ごとの気配＋1は止まった。\n予告は消え、危険に触れたときの増加は＋5になる。周囲の音と視線に気を配ろう。';
  next.fear = Math.max(0, run.fear + (run.tv ? 1 : 0) + extra - relief);
  next.phase =
    action.kind === 'seal' && action.symbols.every((s, i) => s === puzzle(run).solution[i])
      ? 'escaped'
      : 'play';
  next.reason = '';
  if (next.phase === 'escaped' && next.remembered.length === 3)
    next.message =
      '最後の印を結ぶと、背後の水音が止んだ。\n扉の向こうは、朝だった。\n井戸から聞こえたのは、追いかける声ではなく、かすかな「ありがとう」だった。';
  if (
    next.phase === 'play' &&
    (next.fear >= config.modes[run.mode].fear || next.turn >= config.modes[run.mode].turns)
  ) {
    next.phase = 'taken';
    next.reason =
      next.fear >= config.modes[run.mode].fear ? '気配に追いつかれた' : '夜の猶予を使い切った';
    next.message += '\n背後で、濡れた髪が床を擦った。もう、扉は見えない。';
  }
  next.log = [next.message, ...run.log].slice(0, 8);
  return next;
}
export function nightDiagnosis(run: NightRun) {
  if (!isRevised(run) || run.phase !== 'escaped') return hauntDiagnosis(run);
  if (run.remembered.length === 3)
    return {
      title: '井戸の記憶をほどいた者',
      body: '映像を断つだけでなく、三つの場所に残された記憶を見届けた。忘れられた誰かの声に応えたことが、もう一つの夜明けを連れてきた。',
    };
  if (run.watchTurns >= Math.ceil(run.turn * 0.7))
    return {
      title: '闇を見届けた生還者',
      body: '探索の大半を映像の予告とともに進んだ。危険を読み、限られた明かりを使い分けた判断が、朝への道を開いた。',
    };
  if (run.hides >= 2)
    return {
      title: '静寂を味方にした生還者',
      body: `足音を${run.hides}度やり過ごし、動くべき瞬間を選んだ。静けさを見分ける慎重さが、あなたを朝へ導いた。`,
    };
  return {
    title: '呪いの連鎖を断つ者',
    body: '映像から離れ、部屋に残る音と視線を頼りに進んだ。危険に合わせた判断で、朝を取り戻した。',
  };
}
export function apparition(run: NightRun) {
  if (!isRevised(run)) return { id: 'shadow', text: '背後に、白い影が立っている。' };
  if (run.room === 'living' && !run.tv)
    return { id: 'screen', text: '電源のない画面の中で、髪だけが揺れている。' };
  if (run.room === 'bath' && run.clues.includes('bath') && !run.ward)
    return { id: 'mirror', text: '黒く染まった護符。鏡の中の彼女が、こちらを向いた。' };
  if (run.clues[0] === 'study' && run.room === 'well')
    return { id: 'writing', text: '日記と同じ文字が、井戸の縁をゆっくり這っている。' };
  if (run.remembered.length === 3)
    return { id: 'memory', text: '白い影は、もうあなたを追っていない。井戸の底を見つめている。' };
  if (run.passage) return { id: 'passing', text: '窓の外を、白い袖が音もなく通り過ぎる。' };
  return {
    id: 'shadow',
    text:
      run.fear >= config.modes[run.mode].fear * 0.7
        ? 'すぐ後ろに、白い影がいる。'
        : '窓の端に、人影のようなものが映った。',
  };
}
export function restHint(run: NightRun) {
  if (!isRevised(run)) return `1手 / 気配−${run.tv ? 1 : 2}・連続使用は逆効果`;
  return omen(run).id === 'steps' && run.actions.at(-1)?.kind !== 'wait'
    ? `1手 / 気配−${run.tv ? 2 : 3}・次の移動を守る`
    : `1手 / 今は気配＋${run.tv ? 3 : 2}・足音のときだけ有効`;
}
const actionSchema = z.union([
  z
    .object({ kind: z.literal('move'), room: z.enum(['living', 'bath', 'study', 'well', 'door']) })
    .strict(),
  z.object({ kind: z.literal('search'), light: z.boolean() }).strict(),
  z.object({ kind: z.enum(['wait', 'unplug', 'plug']) }).strict(),
  z
    .object({ kind: z.literal('seal'), symbols: z.array(z.enum(['○', '△', '×'])).length(3) })
    .strict(),
]);
const saveSchema = z
  .object({
    version: z.literal(2),
    seed: z.number().int().min(1).max(0xffffffff),
    mode: z.enum(['quick', 'slow']),
    actions: z.array(actionSchema).max(24),
  })
  .strict();
export function encodeNight(run: NightRun) {
  return isRevised(run)
    ? JSON.stringify({ version: 2, seed: run.seed, mode: run.mode, actions: run.actions })
    : encodeHaunt(run);
}
export function decodeNight(text: string): NightRun {
  if (text.length > 12000) throw Error('保存データが大きすぎます');
  const raw = JSON.parse(text);
  if (raw?.version === 1) return decodeHaunt(text);
  const saved = saveSchema.parse(raw);
  let run: NightRun = createNight(saved.seed, saved.mode);
  for (const a of saved.actions) run = actNight(run, a);
  return run;
}
export function nightShare(run: NightRun, site: string) {
  let link = '';
  try {
    const url = new URL(site);
    if (/^https?:$/.test(url.protocol)) {
      url.search = '';
      url.hash = '';
      url.searchParams.set('game', 'zero-echo');
      link = `\n${url.href}`;
    }
  } catch {
    /* Local file has no public URL. */
  }
  return `零時の残響｜${run.phase === 'escaped' ? '生還' : '夜に呑まれた'}\n「${nightDiagnosis(run).title}」\n${run.turn}手 / 手がかり ${run.clues.length}/3\n#零時の残響${link}`;
}
