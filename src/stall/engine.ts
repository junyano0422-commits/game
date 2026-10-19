import { z } from 'zod';
import { random } from '../core/engine';
import { stallConfig as config } from './config';
import type { Flavor, StallMode, Upgrade } from './config';
export const stallSaveKey = 'small-worlds:night-stall:v1';
export type Pan = {
  stage: 'empty' | 'cooking' | 'plated';
  side: 0 | 1;
  heat: [number, number];
  flavor: Flavor;
};
export type Order = {
  id: number;
  guest: number;
  flavor: Flavor;
  patience: number;
  maxPatience: number;
  regular: boolean;
};
export type Action =
  | { kind: 'tick'; count: number }
  | { kind: 'start' | 'flip' | 'plate' | 'discard'; pan: number }
  | { kind: 'flavor'; pan: number; flavor: Flavor }
  | { kind: 'serve'; pan: number; order: number }
  | { kind: 'upgrade'; id: Upgrade | null };
export type StallRun = {
  seed: number;
  mode: StallMode;
  night: number;
  phase: 'night' | 'upgrade' | 'result';
  ticks: number;
  spawned: number;
  cash: number;
  served: number;
  perfect: number;
  missed: number;
  burned: number;
  wrong: number;
  combo: number;
  bestCombo: number;
  stock: number;
  pans: Pan[];
  orders: Order[];
  upgrades: Upgrade[];
  flavors: Record<Flavor, number>;
  message: string;
  actions: Action[];
};
const emptyPan = (): Pan => ({ stage: 'empty', side: 0, heat: [0, 0], flavor: 'soy' });
export function evening(run: StallRun) {
  return config.evenings[
    run.night === 1 ? 0 : Math.floor(random(run.seed, run.night, 38) * config.evenings.length)
  ]!;
}
function spawn(run: StallRun) {
  const index = run.spawned++;
  const regular = run.night > 1 && index === 0 && Object.values(run.flavors).some((n) => n > 0);
  const favorite = [...config.flavors].sort((a, b) => run.flavors[b.id] - run.flavors[a.id])[0]!.id;
  const flavor = regular
    ? favorite
    : config.flavors[Math.floor(random(run.seed, run.night * 10 + index, 53) * 3)]!.id;
  const patience = 110 + (run.upgrades.includes('lantern') ? 25 : 0);
  run.orders.push({
    id: run.night * 100 + index,
    guest: Math.floor(random(run.seed, run.night * 10 + index, 19) * config.guests.length),
    flavor,
    patience,
    maxPatience: patience,
    regular,
  });
}
export function createStall(seed: number, mode: StallMode = 'story'): StallRun {
  const run: StallRun = {
    seed,
    mode,
    night: 1,
    phase: 'night',
    ticks: 0,
    spawned: 0,
    cash: 0,
    served: 0,
    perfect: 0,
    missed: 0,
    burned: 0,
    wrong: 0,
    combo: 0,
    bestCombo: 0,
    stock: config.modes[mode].guests * 2,
    pans: [emptyPan(), emptyPan()],
    orders: [],
    upgrades: [],
    flavors: { soy: 0, miso: 0, butter: 0 },
    message: 'まずは焼き台におにぎりを置こう。焼き色が緑になったら裏返してね。',
    actions: [],
  };
  spawn(run);
  spawn(run);
  return run;
}
export function quality(pan: Pan): 'raw' | 'burnt' | 'perfect' | 'good' {
  if (pan.heat.some((h) => h >= 90)) return 'burnt';
  if (pan.heat.some((h) => h < 30)) return 'raw';
  return pan.heat.every((h) => h >= config.golden.min && h <= config.golden.max)
    ? 'perfect'
    : 'good';
}
function closeIfDone(run: StallRun) {
  if (
    run.ticks >= config.modes[run.mode].closing ||
    (run.spawned === config.modes[run.mode].guests && !run.orders.length)
  ) {
    run.missed += run.orders.length;
    run.orders = [];
    run.pans = run.pans.map(() => emptyPan());
    run.phase = run.night === config.modes[run.mode].nights ? 'result' : 'upgrade';
    run.message = 'のれんを下ろして、ひと休み。今夜もおつかれさまでした。';
  }
}
function apply(run: StallRun, action: Action) {
  if (action.kind === 'upgrade') {
    if (run.phase !== 'upgrade') throw Error('営業の合間に選んでください');
    if (action.id) {
      const item = config.upgrades.find((u) => u.id === action.id);
      if (!item || run.upgrades.includes(item.id) || run.cash < item.cost)
        throw Error('この設備は購入できません');
      run.cash -= item.cost;
      run.upgrades.push(item.id);
    }
    run.night++;
    run.ticks = 0;
    run.spawned = 0;
    run.phase = 'night';
    run.stock = config.modes[run.mode].guests * 2;
    run.pans = Array.from({ length: run.upgrades.includes('grill') ? 3 : 2 }, emptyPan);
    spawn(run);
    spawn(run);
    run.message = run.orders[0]?.regular
      ? '「また来たよ。あの味が忘れられなくて」前の夜に人気だった味を頼む常連さんが来ました。'
      : '新しい夜のはじまり。今夜はどんな出会いがあるかな。';
    return;
  }
  if (run.phase !== 'night') throw Error('営業は終了しています');
  if (action.kind === 'tick') {
    for (let i = 0; i < action.count && run.phase === 'night'; i++) {
      run.ticks++;
      for (const pan of run.pans)
        if (pan.stage === 'cooking')
          pan.heat[pan.side] = Math.min(100, pan.heat[pan.side] + evening(run).heat);
      for (const order of run.orders) order.patience--;
      const leaving = run.orders.filter((o) => o.patience <= 0);
      if (leaving.length) {
        run.missed += leaving.length;
        run.combo = 0;
        run.message =
          '「また今度、寄るね」待ちきれなかったお客さんが帰りました。次の一皿に集中しよう。';
      }
      run.orders = run.orders.filter((o) => o.patience > 0);
      if (
        run.spawned < config.modes[run.mode].guests &&
        run.orders.length < 3 &&
        run.ticks % evening(run).interval === 0
      )
        spawn(run);
      closeIfDone(run);
    }
    return;
  }
  const pan = run.pans[action.pan];
  if (!pan) throw Error('焼き台がありません');
  if (action.kind === 'start') {
    if (pan.stage !== 'empty' || run.stock <= 0) throw Error('今は焼き始められません');
    run.stock--;
    Object.assign(pan, emptyPan(), { stage: 'cooking' });
    run.message = 'じゅう…お米のいい匂い。緑の焼き加減が狙い目です。';
  } else if (action.kind === 'flip') {
    if (pan.stage !== 'cooking' || pan.side !== 0) throw Error('今は裏返せません');
    pan.side = 1;
    run.message =
      pan.heat[0] >= 42 && pan.heat[0] <= 69
        ? 'いい焼き色！もう片面もこんがり焼こう。'
        : '裏返しました。片面の焼き加減はここで決まります。';
  } else if (action.kind === 'plate') {
    if (pan.stage !== 'cooking' || pan.side !== 1)
      throw Error('両面を焼いてから取り出してください');
    pan.stage = 'plated';
    run.message = '火から下ろしました。注文と同じ味を選んで、お客さんに出そう。';
  } else if (action.kind === 'flavor') {
    if (pan.stage !== 'plated') throw Error('火から下ろしてから味つけします');
    pan.flavor = action.flavor;
  } else if (action.kind === 'discard') {
    if (pan.stage === 'empty') throw Error('焼き台は空です');
    run.pans[action.pan] = emptyPan();
    run.combo = 0;
    run.message = '作り直そう。焦げたおにぎりも、次の一皿の練習です。';
  } else if (action.kind === 'serve') {
    const order = run.orders.find((o) => o.id === action.order);
    if (!order || pan.stage !== 'plated') throw Error('お皿と注文を確認してください');
    const grade = quality(pan);
    const correct = pan.flavor === order.flavor;
    if (!correct) run.wrong++;
    if (grade === 'burnt') run.burned++;
    if (correct && (grade === 'perfect' || grade === 'good')) {
      run.served++;
      run.flavors[pan.flavor]++;
      run.combo++;
      const comboBonus = Math.min(5, run.combo) * 2;
      const earned =
        (grade === 'perfect' ? 45 : 28) +
        comboBonus +
        evening(run).tip +
        (run.upgrades.includes('premium') ? 8 : 0);
      run.cash += earned;
      if (grade === 'perfect') run.perfect++;
      run.bestCombo = Math.max(run.bestCombo, run.combo);
      run.message =
        grade === 'perfect'
          ? `「外はカリッ、中はふっくら！」大満足で＋${earned}円。${run.combo}連続のおいしい笑顔！`
          : `「あったかくて、おいしいね」＋${earned}円。次は両面とも緑を狙おう。`;
    } else {
      run.combo = 0;
      run.missed++;
      run.message = !correct
        ? '「頼んだ味と違うみたい…」注文の色を見て、次は同じ味で出そう。'
        : grade === 'burnt'
          ? '少し焦げすぎました。緑のうちに火から下ろすのがコツ。'
          : 'まだ中がひんやり。裏返した後も焼き色を見てね。';
    }
    run.orders = run.orders.filter((o) => o.id !== order.id);
    run.pans[action.pan] = emptyPan();
    closeIfDone(run);
  }
}
export function actStall(run: StallRun, action: Action): StallRun {
  const next = structuredClone(run);
  apply(next, action);
  const previous = next.actions.at(-1);
  if (action.kind === 'tick' && previous?.kind === 'tick') previous.count += action.count;
  else next.actions.push({ ...action });
  return next;
}
export function stallDiagnosis(run: StallRun) {
  const title =
    run.perfect >= run.served * 0.75 && run.served > 0
      ? '焼き色の魔法使い'
      : run.bestCombo >= 5
        ? '行列を笑顔にする店主'
        : run.upgrades.includes('lantern')
          ? '夜道を照らす、ほっとする屋台'
          : 'また寄りたくなる、町の小さな屋台';
  const body =
    run.perfect >= run.served * 0.75 && run.served > 0
      ? 'ひとつずつ焼き色を見守る丁寧さが、いちばんの看板メニューになりました。'
      : run.bestCombo >= 5
        ? 'ふたつの焼き台と注文を見渡す段取り上手。忙しい夜にも、おいしい笑顔が続きました。'
        : '今日出会ったお客さんの記憶に、あたたかい一皿が残りました。次の夜は、どんな屋台に育てましょう。';
  return {
    title,
    body,
    stars: run.served
      ? Math.min(5, Math.max(1, Math.round((run.served / (run.served + run.missed)) * 5)))
      : 1,
  };
}
const panAction = z
  .object({
    kind: z.enum(['start', 'flip', 'plate', 'discard']),
    pan: z.number().int().min(0).max(2),
  })
  .strict();
const actionSchema = z.union([
  panAction,
  z.object({ kind: z.literal('tick'), count: z.number().int().min(1).max(900) }).strict(),
  z
    .object({
      kind: z.literal('flavor'),
      pan: z.number().int().min(0).max(2),
      flavor: z.enum(['soy', 'miso', 'butter']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('serve'),
      pan: z.number().int().min(0).max(2),
      order: z.number().int().min(100).max(305),
    })
    .strict(),
  z
    .object({ kind: z.literal('upgrade'), id: z.enum(['lantern', 'grill', 'premium']).nullable() })
    .strict(),
]);
const saveSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(1).max(0xffffffff),
    mode: z.enum(['quick', 'story']),
    actions: z.array(actionSchema).max(1500),
  })
  .strict();
export function encodeStall(run: StallRun) {
  return JSON.stringify({ version: 1, seed: run.seed, mode: run.mode, actions: run.actions });
}
export function decodeStall(text: string): StallRun {
  if (text.length > 150_000) throw Error('保存データが大きすぎます');
  const data = saveSchema.parse(JSON.parse(text));
  let run = createStall(data.seed, data.mode);
  let ticks = 0;
  for (const action of data.actions) {
    if (action.kind === 'tick') {
      ticks += action.count;
      if (ticks > 900) throw Error('時間の履歴が不正です');
    }
    run = actStall(run, action);
  }
  return run;
}
export function stallShare(run: StallRun, site: string) {
  let link = '';
  try {
    const url = new URL(site);
    if (/^https?:$/.test(url.protocol)) {
      url.search = '';
      url.hash = '';
      url.searchParams.set('game', 'night-stall');
      link = `\n${url.href}`;
    }
  } catch {
    /* Downloaded game has no public URL. */
  }
  return `夜空のおにぎり屋台\n${run.served}人においしい笑顔 / ${run.perfect}皿がこんがり大成功！\n「${stallDiagnosis(run).title}」\n#夜空のおにぎり屋台${link}`;
}
