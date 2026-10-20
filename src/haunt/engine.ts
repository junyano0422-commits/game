import { z } from 'zod';
import { random } from '../core/engine';
import { hauntConfig as config } from './config';
import type { ClueRoom, HauntMode, Room, Rune } from './config';
export const hauntSaveKey = 'small-worlds:zero-echo:v1';
export type HauntAction =
  | { kind: 'move'; room: Room }
  | { kind: 'search'; light: boolean }
  | { kind: 'wait' | 'unplug' | 'plug' }
  | { kind: 'seal'; symbols: Rune[] };
export type HauntRun = {
  seed: number;
  mode: HauntMode;
  room: Room;
  turn: number;
  fear: number;
  battery: number;
  tv: boolean;
  key: boolean;
  ward: boolean;
  orderKnown: boolean;
  clues: ClueRoom[];
  phase: 'play' | 'escaped' | 'taken';
  reason: string;
  message: string;
  log: string[];
  actions: HauntAction[];
};
export function createHaunt(seed: number, mode: HauntMode = 'quick'): HauntRun {
  return {
    seed,
    mode,
    room: 'living',
    turn: 0,
    fear: 0,
    battery: config.modes[mode].battery,
    tv: true,
    key: false,
    ward: false,
    orderKnown: false,
    clues: [],
    phase: 'play',
    reason: '',
    message:
      '午前零時。電話は一度だけ鳴った。受話器の向こうで、水が滴っている。テレビの映像を調べよう。',
    log: [],
    actions: [],
  };
}
function shuffled<T>(items: readonly T[], seed: number, salt: number): T[] {
  return items
    .map((item, i) => ({ item, value: random(seed, i, salt) }))
    .sort((a, b) => a.value - b.value)
    .map((p) => p.item);
}
export function puzzle(run: HauntRun) {
  const order = shuffled(config.clueRooms, run.seed, 83);
  const runes = shuffled(config.runes, run.seed, 41);
  const marks = Object.fromEntries(config.clueRooms.map((room, i) => [room, runes[i]!])) as Record<
    ClueRoom,
    Rune
  >;
  return { order, marks, solution: order.map((room) => marks[room]) };
}
export function omen(run: HauntRun) {
  return config.omens[Math.floor(random(run.seed, run.turn, 209) * config.omens.length)]!;
}
export function canSeal(run: HauntRun) {
  return run.room === 'door' && run.orderKnown && run.clues.length === 3;
}
export function actHaunt(run: HauntRun, action: HauntAction): HauntRun {
  if (run.phase !== 'play') throw Error('この夜は終わっています');
  const next = structuredClone(run);
  const sign = omen(run);
  let extra = 0;
  let relief = 0;
  if (action.kind === 'move') {
    if (action.room === run.room) throw Error('今いる場所です');
    if (action.room === 'well' && !run.key) throw Error('書斎にある鍵が必要です');
    next.room = action.room;
    extra = sign.id === 'steps' ? config.rules.omenFear : 0;
    next.message = config.rooms.find((room) => room.id === action.room)!.description;
  } else if (action.kind === 'search') {
    if (run.room === 'living' && !run.tv) throw Error('映像を見るにはテレビの電源が必要です');
    if (run.room === 'door') throw Error('扉には封印を結んでください');
    if (action.light && run.battery === 0) throw Error('ライトの電池がありません');
    if (action.light) next.battery--;
    const watched = sign.id === 'eyes' && !action.light;
    if (watched && run.ward) {
      next.ward = false;
      next.message = '護符が黒く染まった。背後の視線が、一度だけ遠ざかる。\n';
    } else {
      extra = watched ? config.rules.omenFear : 0;
      next.message = '';
    }
    if (run.room === 'living') {
      if (run.orderKnown) {
        extra += 2;
        next.message += '同じ映像を見続けてしまった。画面の中の井戸が、さっきより近い。';
      } else {
        next.orderKnown = true;
        next.message += `${config.rooms[0].clue}\n${puzzle(run)
          .order.map((room) => config.rooms.find((r) => r.id === room)!.name)
          .join(' → ')}`;
      }
    } else {
      const room = run.room as ClueRoom;
      if (run.clues.includes(room)) {
        extra += 2;
        next.message += '手がかりはもう持っている。長居するほど、気配が濃くなる。';
      } else {
        next.clues.push(room);
        next.message += `${config.rooms.find((r) => r.id === room)!.clue}\n記された印：${puzzle(run).marks[room]}`;
        if (room === 'study') next.key = true;
        if (room === 'bath') next.ward = true;
      }
    }
  } else if (action.kind === 'plug') {
    if (run.room !== 'living' || run.tv) throw Error('居間のテレビで操作してください');
    next.tv = true;
    next.message = '電源を戻すと、井戸の映像が再び映った。知るためには、見つめ返すしかない。';
  } else if (action.kind === 'unplug') {
    if (run.room !== 'living' || !run.tv) throw Error('居間のテレビで操作してください');
    next.tv = false;
    next.message =
      'プラグを抜いた。これ以上、映像は呪いを呼ばない。\nただし、次の気配を予告していた砂嵐も消えてしまった。';
  } else if (action.kind === 'wait') {
    const repeated = run.actions.at(-1)?.kind === 'wait';
    relief = repeated ? 0 : config.rules.waitRelief;
    extra = repeated ? config.rules.repeatedWaitFear : 0;
    next.message = repeated
      ? '立ち止まりすぎた。あなたの呼吸を、誰かが真似している。'
      : '息を止める。足音が、扉の前をゆっくり通り過ぎた。\n気配が少し遠ざかった。でも時間は戻らない。';
  } else if (action.kind === 'seal') {
    if (!canSeal(run) || action.symbols.length !== 3) throw Error('三つの記号と順番が必要です');
    if (action.symbols.every((symbol, i) => symbol === puzzle(run).solution[i])) {
      next.phase = 'escaped';
      next.message = '最後の印を結ぶと、背後の水音が止んだ。\n扉の向こうは、朝だった。';
    } else {
      extra = config.rules.wrongSealFear;
      next.message =
        '封印の順番が違う。扉の隙間から、一本の黒い髪が入り込んできた。映像の順番と、各部屋の印を照らし合わせよう。';
    }
  }
  next.turn++;
  next.fear = Math.max(0, run.fear + (run.tv ? config.rules.baseFear : 0) + extra - relief);
  if (extra === config.rules.omenFear) next.message += '\n気配に触れてしまった。彼女が、近づく。';
  if (
    next.phase === 'play' &&
    (next.fear >= config.modes[run.mode].fear || next.turn >= config.modes[run.mode].turns)
  ) {
    next.phase = 'taken';
    next.reason =
      next.fear >= config.modes[run.mode].fear ? '気配に追いつかれた' : '夜の猶予を使い切った';
    next.message += '\n背後で、濡れた髪が床を擦った。もう、扉は見えない。';
  }
  next.actions.push(structuredClone(action));
  next.log = [next.message, ...run.log].slice(0, 8);
  return next;
}
export function hauntDiagnosis(run: HauntRun) {
  if (run.phase !== 'escaped')
    return {
      title: run.clues.length === 3 ? 'あと一つ、結べなかった夜' : '井戸に残された足跡',
      body: '集めた記号と、映像が示した部屋の順番は別の手がかり。次の夜は、立ち止まる場所とライトを使う瞬間を変えてみよう。',
    };
  if (run.tv)
    return {
      title: '闇を見届けた生還者',
      body: '映像の予告を最後まで読み取り、追いかけてくる気配の隙間を抜けた。知る勇気が、あなたを朝へ導いた。',
    };
  if (run.actions.filter((a) => a.kind === 'wait').length >= 3)
    return {
      title: '静寂を味方にした生還者',
      body: '走り続けず、ときに呼吸をひそめた。音が去るのを待つ慎重さが、最後の扉を開いた。',
    };
  return {
    title: '呪いの連鎖を断つ者',
    body: '映像を断ち、限られた明かりで真実を拾った。振り返らずに進んだ先で、あなたは朝を取り戻した。',
  };
}
const roomSchema = z.enum(['living', 'bath', 'study', 'well', 'door']);
const actionSchema = z.union([
  z.object({ kind: z.literal('move'), room: roomSchema }).strict(),
  z.object({ kind: z.literal('search'), light: z.boolean() }).strict(),
  z.object({ kind: z.enum(['wait', 'unplug', 'plug']) }).strict(),
  z
    .object({ kind: z.literal('seal'), symbols: z.array(z.enum(['○', '△', '×'])).length(3) })
    .strict(),
]);
const saveSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(1).max(0xffffffff),
    mode: z.enum(['quick', 'slow']),
    actions: z.array(actionSchema).max(24),
  })
  .strict();
export function encodeHaunt(run: HauntRun) {
  return JSON.stringify({ version: 1, seed: run.seed, mode: run.mode, actions: run.actions });
}
export function decodeHaunt(text: string) {
  if (text.length > 12000) throw Error('保存データが大きすぎます');
  const data = saveSchema.parse(JSON.parse(text));
  let run = createHaunt(data.seed, data.mode);
  for (const action of data.actions) run = actHaunt(run, action);
  return run;
}
export function hauntShare(run: HauntRun, site: string) {
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
    /* File editions have no public link. */
  }
  return `零時の残響｜${run.phase === 'escaped' ? '生還' : '夜に呑まれた'}\n「${hauntDiagnosis(run).title}」\n${run.turn}手 / 手がかり ${run.clues.length}/3\n#零時の残響${link}`;
}
