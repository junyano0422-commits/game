import { z } from 'zod';
import { random } from '../core/engine';
import { rescueConfig as config } from './config';

export type RescueMode = keyof typeof config.modes;
export type TravelMode = 'normal' | 'eco';
export type Passenger = {
  id: string;
  name: string;
  icon: string;
  count: number;
  floor: number;
  deadline: number;
  perk?: 'battery' | 'capacity' | 'patience';
  line: string;
  status: 'waiting' | 'aboard' | 'safe' | 'stairs';
  boardedAt?: number;
};
export type RescueRun = {
  seed: number;
  mode: RescueMode;
  floor: number;
  turn: number;
  battery: number;
  capacity: number;
  people: Passenger[];
  score: number;
  trips: number;
  fullTrips: number;
  urgent: number;
  highFloor: number;
  log: string[];
  last: string;
  lastBonus: number;
  moves: { floor: number; travel: TravelMode }[];
  finished: boolean;
};
export const rescueSaveKey = 'small-worlds:last-elevator:v1';

export function createRescue(seed: number, mode: RescueMode = 'standard'): RescueRun {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Invalid seed');
  const settings = config.modes[mode];
  const people: Passenger[] = config.passengerTemplates.map((template, i) => {
    const floor =
      'floor' in template ? template.floor : 1 + Math.floor(random(seed, i, 221) * config.floors);
    const deadline =
      'deadline' in template ? template.deadline : 9 + Math.floor(random(seed, i, 331) * 8);
    return { ...template, floor, deadline: deadline + settings.waitingBonus, status: 'waiting' };
  });
  return {
    seed,
    mode,
    floor: 0,
    turn: 0,
    battery: settings.battery,
    capacity: settings.capacity,
    people,
    score: 0,
    trips: 0,
    fullTrips: 0,
    urgent: 0,
    highFloor: 0,
    moves: [],
    log: [],
    last: '非常電源に切り替わりました。呼び出しのある階を選んでください。',
    lastBonus: 0,
    finished: false,
  };
}

export const countPeople = (people: Passenger[]) => people.reduce((sum, p) => sum + p.count, 0);
export const cabin = (run: RescueRun) => run.people.filter((p) => p.status === 'aboard');
export const savedPeople = (run: RescueRun) =>
  countPeople(run.people.filter((p) => p.status === 'safe'));
export function forecast(run: RescueRun) {
  return run.turn > 0 && run.turn % 4 === 0
    ? config.disruptions[Math.floor(random(run.seed, run.turn, 441) * config.disruptions.length)]!
    : null;
}

function baseCost(from: number, to: number, travel: TravelMode) {
  const distance = Math.abs(from - to);
  const directional = to < from ? Math.ceil(distance * 0.5) : distance;
  return Math.max(1, Math.ceil((directional + 1) * (travel === 'eco' ? 0.6 : 1)));
}

export function previewRoute(run: RescueRun, floor: number, travel: TravelMode = 'normal') {
  const ticks = travel === 'eco' ? 2 : 1;
  const cost = Math.max(1, baseCost(run.floor, floor, travel) + (forecast(run)?.cost ?? 0));
  const arrivalForecast = forecast({ ...run, turn: run.turn + ticks });
  const returnCost =
    floor === 0 ? 0 : baseCost(floor, 0, 'normal') + Math.max(0, arrivalForecast?.cost ?? 0);
  let space = run.capacity - countPeople(cabin(run));
  const boarding: Passenger[] = [];
  for (const p of [...run.people].sort(
    (a, b) => Number(!!b.perk) - Number(!!a.perk) || a.deadline - b.deadline,
  )) {
    if (
      p.status === 'waiting' &&
      p.floor === floor &&
      p.deadline >= run.turn + ticks &&
      p.count <= space
    ) {
      boarding.push(p);
      space -= p.count;
    }
  }
  let reason = '';
  if (run.finished) reason = '救出は終了しています';
  else if (!Number.isInteger(floor) || floor < 0 || floor > config.floors)
    reason = '存在しない階です';
  else if (floor === run.floor) reason = 'いま、この階です';
  else if (cost + returnCost > run.battery) reason = '帰還分の電力が足りません';
  else if (run.turn + ticks + (floor === 0 ? 0 : 1) > config.modes[run.mode].turns)
    reason = '帰還する時間がありません';
  else if (floor > 0 && !boarding.length)
    reason = space === 0 ? '満員です。1Fへ戻りましょう' : '到着時に乗せられる住民がいません';
  else if (floor === 0 && !cabin(run).length) reason = 'まだ誰も乗っていません';
  return {
    cost,
    ticks,
    returnCost,
    boarding,
    count: countPeople(boarding),
    reason,
    available: !reason,
  };
}

export function hasNextMove(run: RescueRun) {
  for (let floor = 0; floor <= config.floors; floor++) {
    if (previewRoute(run, floor, 'normal').available || previewRoute(run, floor, 'eco').available)
      return true;
  }
  return false;
}

export function moveElevator(run: RescueRun, floor: number, travel: TravelMode): RescueRun {
  const route = previewRoute(run, floor, travel);
  if (!route.available) throw new Error(route.reason);
  const next = structuredClone(run);
  next.floor = floor;
  next.turn += route.ticks;
  next.battery -= route.cost;
  next.moves.push({ floor, travel });
  next.lastBonus = 0;
  const messages: string[] = [];
  if (floor === 0) {
    const carried = cabin(next);
    const count = countPeople(carried);
    const full = count === next.capacity;
    const chain = new Set(carried.map((p) => p.floor)).size >= 3;
    next.trips++;
    if (full) next.fullTrips++;
    let points = count * 100 + (full ? 100 : 0) + (chain ? 80 : 0);
    for (const person of carried) {
      person.status = 'safe';
      if (person.deadline - (person.boardedAt ?? 0) <= 2) {
        next.urgent += person.count;
        points += person.count * 35;
      }
      if (person.floor >= 7) next.highFloor += person.count;
      if (person.perk === 'battery') {
        next.battery += 8;
        messages.push('⚡ ミナさんが予備電源を接続。電力＋8！');
      }
      if (person.perk === 'capacity') {
        next.capacity += 1;
        messages.push('▣ 荷物を整理して、定員＋1！');
      }
      if (person.perk === 'patience') {
        for (const waiting of next.people.filter((p) => p.status === 'waiting'))
          waiting.deadline += 2;
        messages.push('♡ 助け合いの声が広がり、待機できる時間が全員＋2手！');
      }
    }
    next.score += points;
    next.lastBonus = points;
    messages.unshift(
      `${count}人を避難所へ！${full ? ' 満員ボーナス＋100。' : ''}${chain ? ' 3フロア連携＋80。' : ''}`,
    );
    if (carried[0]) messages.push(`「${carried[0].line}」`);
  } else {
    for (const person of next.people)
      if (route.boarding.some((p) => p.id === person.id)) {
        person.status = 'aboard';
        person.boardedAt = next.turn;
      }
    messages.push(
      `${floor + 1}Fで${route.count}人が乗りました。${countPeople(cabin(next)) === next.capacity ? '満員です。1Fへ！' : 'ほかの階に寄る？ それとも1Fへ？'}`,
    );
  }
  const leaving = next.people.filter((p) => p.status === 'waiting' && p.deadline <= next.turn);
  for (const p of leaving) p.status = 'stairs';
  if (leaving.length) messages.push(`${countPeople(leaving)}人は階段の避難チームに合流しました。`);
  next.last = messages.join('\n');
  next.log = [...messages, ...next.log].slice(0, 30);
  next.finished = !hasNextMove(next);
  return next;
}

export function rescueResult(run: RescueRun) {
  const count = savedPeople(run);
  const total = countPeople(run.people);
  const title =
    run.urgent >= 5
      ? 'ギリギリを救うヒーロー'
      : run.fullTrips >= 2
        ? '満員御礼の段取り魔'
        : run.highFloor >= 6
          ? '高層階の守護神'
          : count >= 10
            ? '小さな声を拾う理事長'
            : '次はもっと救える挑戦者';
  const body =
    run.urgent >= 5
      ? '待ちきれない声を見逃さなかった。最後の一瞬に手を伸ばした判断が、たくさんの安心につながりました。'
      : run.fullTrips >= 2
        ? '寄り道を計算して、座席を無駄にしない。あなたの段取りが、限られた電力をたくさんの救出に変えました。'
        : run.highFloor >= 6
          ? '遠い階にも、待つ人がいる。帰還の電力まで見据えて、高い場所へ向かった勇気が光ります。'
          : '救出した人が、次の救出を助けてくれる。どの声から応えるかで、同じ建物にも別の未来が生まれます。';
  const rank = count >= 18 ? 'S' : count >= 14 ? 'A' : count >= 10 ? 'B' : 'C';
  return { title, body, rank, count, total, score: run.score + Math.max(0, run.battery) * 3 };
}

const saveSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(1).max(0xffffffff),
    mode: z.enum(['standard', 'practice']),
    moves: z
      .array(
        z
          .object({
            floor: z.number().int().min(0).max(config.floors),
            travel: z.enum(['normal', 'eco']),
          })
          .strict(),
      )
      .max(24),
  })
  .strict();

export function encodeRescue(run: RescueRun) {
  return JSON.stringify({
    version: config.version,
    seed: run.seed,
    mode: run.mode,
    moves: run.moves,
  });
}
export function decodeRescue(text: string): RescueRun {
  if (text.length > 10_000) throw new Error('Save too large');
  const data = saveSchema.parse(JSON.parse(text));
  return data.moves.reduce(
    (run, move) => moveElevator(run, move.floor, move.travel),
    createRescue(data.seed, data.mode),
  );
}

export function dailyRescueSeed(date: Date): number {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return [...day].reduce((hash, c) => (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0, 7) || 1;
}

export function rescueShare(run: RescueRun, siteUrl: string) {
  const result = rescueResult(run);
  let link = '';
  if (/^https?:\/\//.test(siteUrl)) {
    const url = new URL(siteUrl);
    url.search = '';
    url.hash = '';
    url.searchParams.set('game', 'last-elevator');
    link = `\n${url.href}`;
  }
  return `ラスト・エレベーター｜${config.modes[run.mode].label}\n${result.count}/${result.total}人を救出！ RANK ${result.rank} / ${result.score}pt\n「${result.title}」\n#ラストエレベーター${link}`;
}
