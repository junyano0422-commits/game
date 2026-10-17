import { z } from 'zod';
import { random } from '../core/engine';
import { rescueConfig as config } from './config';
import {
  createRescue,
  decodeRescue,
  encodeRescue,
  hasNextMove,
  moveElevator,
  previewRoute,
  rescueResult,
  savedPeople,
} from './engine';
import type { RescueMode, RescueRun, TravelMode } from './engine';

export const contracts = [
  {
    id: 'connections',
    title: 'みんなの力で',
    description: '電気技師・防災リーダー・おばあちゃんと孫を全員届ける',
    reward: 350,
    icon: '♡',
  },
  {
    id: 'highrise',
    title: '上の階を見捨てない',
    description: '8F以上から8人を救出する',
    reward: 300,
    icon: '↗',
  },
  {
    id: 'full-house',
    title: '満員の名人',
    description: '満員の便を2回届ける',
    reward: 250,
    icon: '▣',
  },
] as const;
export type ContractId = (typeof contracts)[number]['id'];
export type StoryAction =
  | { kind: 'move'; floor: number; travel: TravelMode }
  | { kind: 'decision'; event: string; choice: string };
export type AdventureRun = RescueRun & {
  storyVersion: 2;
  contract: ContractId;
  actions: StoryAction[];
  answered: string[];
  pending: string | null;
};
export type PlayRun = RescueRun | AdventureRun;
export const isAdventure = (run: PlayRun): run is AdventureRun =>
  'storyVersion' in run && run.storyVersion === 2;

export function createAdventure(
  seed: number,
  mode: RescueMode = 'standard',
  contract: ContractId = 'connections',
): AdventureRun {
  return {
    ...createRescue(seed, mode),
    storyVersion: 2,
    contract,
    actions: [],
    answered: [],
    pending: null,
  };
}

export function contractProgress(run: AdventureRun) {
  const contract = contracts.find((c) => c.id === run.contract)!;
  const progress =
    run.contract === 'connections'
      ? run.people.filter((p) => ['tech', 'leader', 'family'].includes(p.id) && p.status === 'safe')
          .length
      : run.contract === 'highrise'
        ? run.highFloor
        : run.fullTrips;
  const target = run.contract === 'connections' ? 3 : run.contract === 'highrise' ? 8 : 2;
  return { ...contract, progress, target, complete: progress >= target };
}

export function consultation(run: PlayRun) {
  if (!isAdventure(run) || !run.pending) return null;
  if (run.pending === 'rooftop') {
    const floor = 8 + Math.floor(random(run.seed, 1, 882) * 3);
    return {
      id: 'rooftop',
      from: '屋上からの無線',
      title: '予定外のSOS。引き受ける？',
      body: `${floor + 1}Fのテラスで写真を撮っていた2人から、遅れて連絡が入りました。今のルートからは外れますが、あと6手は待てるそうです。`,
      choices: [
        {
          id: 'accept',
          label: '迎えに行くと約束する',
          hint: `${floor + 1}Fに新しい呼び出し。2人を届けると追加220pt`,
          disabled: false,
        },
        {
          id: 'supply',
          label: '別チームに託し、予備電源をつなぐ',
          hint: '補給に1手を使い、電力＋8。ほかの住民の期限も1手進みます',
          disabled: false,
        },
      ],
    };
  }
  const tech = run.people.some((p) => p.id === 'tech' && p.status === 'safe');
  return {
    id: 'lights',
    from: tech ? 'ミナさんからの相談' : '避難所からの相談',
    title: '明かりを守るか、次の一便か。',
    body: tech
      ? 'ミナさんが、照明の回路をエレベーターに回せると教えてくれました。ただし暗くなると、待つ人たちは早めに階段へ移ります。'
      : '待機フロアの照明にも非常電源が使われています。電力を救出に集中するか、明かりと落ち着きを守るか。',
    choices: [
      {
        id: 'divert',
        label: tech ? 'ミナさんと回路をつなぎ替える' : '照明の電力を一時的に回す',
        hint: `電力＋${tech ? 10 : 6}。待機中の全員の猶予−2手`,
        disabled: false,
      },
      {
        id: 'comfort',
        label: '照明を守り、無線で励ます',
        hint: '電力−4。待機中の全員の猶予＋3手',
        disabled: run.battery < 4,
      },
      {
        id: 'continue',
        label: '今の作戦を変えずに進める',
        hint: '資源の変化なし。予定していたルートを優先',
        disabled: false,
      },
    ],
  };
}

function settle(run: AdventureRun): AdventureRun {
  const next: AdventureRun = { ...run, finished: false, pending: null };
  const remaining = config.modes[next.mode].turns - next.turn;
  if (next.floor === 0 && remaining >= 3 && next.people.some((p) => p.status === 'waiting')) {
    if (next.trips >= 1 && !next.answered.includes('rooftop')) next.pending = 'rooftop';
    else if (next.trips >= 2 && !next.answered.includes('lights')) next.pending = 'lights';
  }
  next.finished = !next.pending && !hasNextMove(next);
  return next;
}

export function playMove(run: PlayRun, floor: number, travel: TravelMode): PlayRun {
  if (!isAdventure(run)) return moveElevator(run, floor, travel);
  if (run.pending) throw new Error('先に無線の相談に答えてください');
  const moved = moveElevator(run, floor, travel) as AdventureRun;
  moved.actions = [...run.actions, { kind: 'move', floor, travel }];
  return settle(moved);
}

export function playPreview(run: PlayRun, floor: number, travel: TravelMode) {
  const preview = previewRoute(run, floor, travel);
  return isAdventure(run) && run.pending
    ? { ...preview, available: false, reason: '先に無線の相談に答えてください' }
    : preview;
}

export function answerConsultation(run: AdventureRun, choice: string): AdventureRun {
  const event = consultation(run);
  const option = event?.choices.find((c) => c.id === choice && !c.disabled);
  if (!event || !option || run.finished) throw new Error('Unavailable consultation choice');
  const next = structuredClone(run);
  next.actions.push({ kind: 'decision', event: event.id, choice });
  next.answered.push(event.id);
  next.lastBonus = 0;
  if (event.id === 'rooftop') {
    if (choice === 'accept') {
      const floor = 8 + Math.floor(random(run.seed, 1, 882) * 3);
      next.people.push({
        id: 'photo-team',
        name: '星空を撮っていた写真部',
        icon: '✧',
        count: 2,
        floor,
        deadline: next.turn + 6,
        line: '今日いちばん撮りたかったのは、この避難所の笑顔です。',
        status: 'waiting',
      });
      next.last = `「待っていてください」と約束しました。${floor + 1}Fの新しい呼び出しは、あと6手。届けると追加220ptです。`;
    } else {
      next.turn++;
      next.battery += 8;
      next.last =
        '写真部は屋上の避難チームへ。あなたは予備電源の接続を手伝い、電力を8確保しました。1手分、ほかの住民の期限も進みます。';
    }
  } else if (choice === 'divert') {
    const tech = next.people.some((p) => p.id === 'tech' && p.status === 'safe');
    next.battery += tech ? 10 : 6;
    for (const p of next.people.filter((p) => p.status === 'waiting')) p.deadline -= 2;
    next.last = tech
      ? 'ミナさんの腕で電力＋10。照明は落ち、待機できる時間は全員−2手。今こそ急いで届けよう。'
      : '電力＋6。照明を落としたため、待機できる時間は全員−2手。次の便が勝負です。';
  } else if (choice === 'comfort') {
    next.battery -= 4;
    for (const p of next.people.filter((p) => p.status === 'waiting')) p.deadline += 3;
    next.last =
      '明かりが残り、避難所からの声も届きました。電力を4使い、待機できる時間は全員＋3手。節電走行で回る余裕が生まれます。';
  } else next.last = '今ある電力と時間で届けきる。無線にそう答え、予定していたルートへ戻ります。';
  const leaving = next.people.filter((p) => p.status === 'waiting' && p.deadline <= next.turn);
  for (const p of leaving) p.status = 'stairs';
  if (leaving.length)
    next.last += `\n${leaving.reduce((n, p) => n + p.count, 0)}人は階段チームへ合流しました。`;
  next.log = [next.last, ...next.log].slice(0, 30);
  return settle(next);
}

export function adventureResult(run: PlayRun) {
  const base = rescueResult(run);
  const goal = isAdventure(run) ? contractProgress(run) : null;
  const rooftop = run.people.some((p) => p.id === 'photo-team' && p.status === 'safe');
  return {
    ...base,
    score: base.score + (goal?.complete ? goal.reward : 0) + (rooftop ? 220 : 0),
    goal,
    rooftop,
  };
}

const epilogues: Record<string, { title: string; body: string }> = {
  tech: {
    title: 'ミナさんは、まだ働いていた。',
    body: '避難所の片隅で配線図を広げるミナさん。「次の便の電力、もう少しだけ見つけられそうです」',
  },
  family: {
    title: '小さな応援団。',
    body: '孫が避難所の入口で、戻ってくるエレベーターに手を振っています。その隣で、おばあちゃんがお茶を配り始めました。',
  },
  leader: {
    title: '知らない人同士が、チームになった。',
    body: '防災リーダーの声で、荷物が整然と並びました。さっきまでお隣の名前も知らなかった人たちが、次の便の到着を支えています。',
  },
  cat: {
    title: 'チクワ、避難所デビュー。',
    body: '猫のチクワは毛布の山を自分の席にしました。緊張していた避難所に、少しだけ笑い声が戻ります。',
  },
  twins: {
    title: '救出隊の絵。',
    body: '双子が段ボールに描いたのは、タワマンより大きなエレベーター。「みんな乗れるように大きくしたんだ」',
  },
  'photo-team': {
    title: '約束した一枚。',
    body: '写真部が見せてくれたのは、星空ではなく避難所の集合写真でした。あなたが引き受けた寄り道が、ここに写っています。',
  },
};
export function residentMemories(run: PlayRun) {
  return run.people
    .filter((p) => p.status === 'safe' && epilogues[p.id])
    .sort((a, b) => (a.boardedAt ?? 0) - (b.boardedAt ?? 0))
    .map((p) => ({ id: p.id, ...epilogues[p.id]! }))
    .slice(-3);
}

const actionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('move'),
      floor: z.number().int().min(0).max(config.floors),
      travel: z.enum(['normal', 'eco']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('decision'),
      event: z.enum(['rooftop', 'lights']),
      choice: z.string().max(30),
    })
    .strict(),
]);
const storySaveSchema = z
  .object({
    version: z.literal(2),
    seed: z.number().int().min(1).max(0xffffffff),
    mode: z.enum(['standard', 'practice']),
    contract: z.enum(['connections', 'highrise', 'full-house']),
    actions: z.array(actionSchema).max(26),
  })
  .strict();
export function encodePlaySave(run: PlayRun) {
  return isAdventure(run)
    ? JSON.stringify({
        version: 2,
        seed: run.seed,
        mode: run.mode,
        contract: run.contract,
        actions: run.actions,
      })
    : encodeRescue(run);
}
export function decodePlaySave(text: string): PlayRun {
  if (text.length > 15_000) throw new Error('Save too large');
  const raw = JSON.parse(text);
  if (raw?.version === 1) return decodeRescue(text);
  const saved = storySaveSchema.parse(raw);
  let run: PlayRun = createAdventure(saved.seed, saved.mode, saved.contract);
  for (const action of saved.actions) {
    if (action.kind === 'move') run = playMove(run, action.floor, action.travel);
    else {
      if (!isAdventure(run) || run.pending !== action.event)
        throw new Error('Invalid consultation history');
      run = answerConsultation(run, action.choice);
    }
  }
  return run;
}

export function adventureShare(run: PlayRun, siteUrl: string) {
  const result = adventureResult(run);
  let link = '';
  if (/^https?:\/\//.test(siteUrl)) {
    const url = new URL(siteUrl);
    url.search = '';
    url.hash = '';
    url.searchParams.set('game', 'last-elevator');
    link = `\n${url.href}`;
  }
  const goal = result.goal
    ? `\n目標「${result.goal.title}」${result.goal.complete ? '達成！' : '次は達成したい'}`
    : '';
  return `ラスト・エレベーター｜${config.modes[run.mode].label}\n${savedPeople(run)}/${result.total}人を救出！ RANK ${result.rank} / ${result.score}pt\n「${result.title}」${goal}\n#ラストエレベーター${link}`;
}
