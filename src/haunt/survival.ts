import { z } from 'zod';
import { hauntConfig as config } from './config';
import type { HauntMode, Room } from './config';
import type { HauntAction } from './engine';
import {
  actNight,
  createNight,
  decodeNight,
  encodeNight,
  nightDiagnosis,
  nightShare,
  omen,
} from './revised';
import type { NightRun, RevisedRun } from './revised';
import { survivalConfig as rules, itemById } from './survival-config';
import type { ItemId } from './survival-config';
export { canSeal, hauntSaveKey, omen, puzzle, isRevised, fragments, apparition } from './revised';
export type SurvivalCommand =
  | HauntAction
  | { kind: 'move'; room: Room; pace: 'quiet' }
  | { kind: 'take' | 'store' | 'retrieve' | 'use'; item: ItemId }
  | { kind: 'craft' };
export type SurvivalRun = RevisedRun & {
  survivalVersion: 3;
  commands: SurvivalCommand[];
  bag: ItemId[];
  box: ItemId[];
  supplies: Record<Room, ItemId[]>;
  health: number;
  hunter: Room;
  alert: number;
  stun: number;
  cooldown: number;
  encounters: number;
  wellUnlocked: boolean;
  lastTimed: string;
};
export type PlayRun = NightRun | SurvivalRun;
export const isSurvival = (run: PlayRun): run is SurvivalRun =>
  'survivalVersion' in run && run.survivalVersion === 3;
export function nightLimits(run: PlayRun) {
  return isSurvival(run) ? rules.modes[run.mode] : config.modes[run.mode];
}
export function createSurvival(seed: number, mode: HauntMode = 'quick'): SurvivalRun {
  return {
    ...createNight(seed, mode),
    survivalVersion: 3,
    commands: [],
    bag: ['cloth'],
    box: [],
    supplies: { living: [], bath: [], study: [], well: [], door: [] },
    health: rules.maxHealth,
    hunter: 'well',
    alert: 0,
    stun: 0,
    cooldown: 0,
    encounters: 0,
    wellUnlocked: false,
    lastTimed: '',
  };
}
export function adjacent(run: SurvivalRun, room: Room) {
  return rules.edges
    .flatMap(([a, b]) => (a === room ? [b] : b === room ? [a] : []))
    .filter(
      (next) =>
        !([room, next].includes('bath') && [room, next].includes('well')) ||
        run.clues.includes('well'),
    );
}
export function travelReason(run: PlayRun, target: Room) {
  if (!isSurvival(run)) return target === 'well' && !run.key ? '要：鍵' : '';
  if (target === run.room) return '';
  if (!adjacent(run, run.room).includes(target))
    return target === 'well' && run.room === 'bath' ? '井戸側から開く近道' : '隣の部屋から移動';
  if (target === 'well' && !run.wellUnlocked && !run.bag.includes('key'))
    return '鍵を持ち物に入れる';
  return '';
}
export function hunterActive(run: SurvivalRun) {
  return run.key;
}
export function hunterHint(run: SurvivalRun) {
  if (run.room === 'living') return '居間は安全拠点。追跡者は入れない。';
  if (!hunterActive(run)) return 'まだ、井戸の奥で眠っている。';
  if (run.stun) return `光で停止中：あと${run.stun}行動`;
  if (run.cooldown) return '白い影が離れていく。今なら動ける。';
  return run.hunter === run.room
    ? '同じ部屋にいる。薬草・閃光札か、退避を。'
    : `足跡は${config.rooms.find((r) => r.id === run.hunter)!.name}。調査と移動の音で近づく。`;
}
function hunterStep(run: SurvivalRun, noise: number, evading: boolean) {
  if (!hunterActive(run)) return;
  if (run.stun > 0) {
    run.stun--;
    return;
  }
  if (run.cooldown > 0) {
    run.cooldown--;
    return;
  }
  if (evading) return;
  run.alert += noise + (run.tv ? 1 : 0);
  if (run.alert >= rules.hunterThreshold) {
    run.alert = 0;
    if (run.hunter !== run.room) {
      const queue: Room[][] = [[run.hunter]];
      const visited = new Set<Room>([run.hunter]);
      while (queue.length) {
        const path = queue.shift()!;
        const end = path.at(-1)!;
        if (end === run.room) {
          const step = path[1];
          if (step && step !== 'living') run.hunter = step;
          break;
        }
        for (const room of adjacent(run, end))
          if (!visited.has(room) && (room !== 'living' || run.room === 'living')) {
            visited.add(room);
            queue.push([...path, room]);
          }
      }
    }
  }
  if (run.room !== 'living' && run.hunter === run.room) {
    run.health--;
    run.encounters++;
    run.cooldown = 1;
    run.message += '\n白い手に触れられた。体力−1。次の1行動は、影が離れる猶予がある。';
  }
}
function finish(run: SurvivalRun) {
  const limits = nightLimits(run);
  if (run.phase === 'escaped') return;
  if (run.health <= 0 || run.fear >= limits.fear || run.turn >= limits.turns) {
    run.phase = 'taken';
    run.reason =
      run.health <= 0
        ? '白い手に捕まった'
        : run.fear >= limits.fear
          ? '気配に追いつかれた'
          : '夜の猶予を使い切った';
    run.message += `\n${run.reason}。もう、扉は見えない。`;
  } else {
    run.phase = 'play';
    run.reason = '';
  }
}
export function actSurvival(run: PlayRun, command: SurvivalCommand): PlayRun {
  if (!isSurvival(run)) {
    if (['take', 'store', 'retrieve', 'use', 'craft'].includes(command.kind))
      throw Error('新しい夜の道具です');
    return actNight(run, command as HauntAction);
  }
  if (run.phase !== 'play') throw Error('この夜は終わっています');
  if (run.commands.length >= 240) throw Error('持ち物の操作が多すぎます');
  let next = structuredClone(run);
  let timed = false;
  let noise = 0;
  let evading = false;
  if (command.kind === 'take' || command.kind === 'retrieve') {
    if (next.bag.length >= rules.capacity)
      throw Error('持ち物は4枠まで。居間の保管箱へ預けられます');
    const source = command.kind === 'take' ? next.supplies[next.room] : next.box;
    if (command.kind === 'retrieve' && run.room !== 'living') throw Error('保管箱は居間にあります');
    const index = source.indexOf(command.item);
    if (index < 0) throw Error('そこにはありません');
    source.splice(index, 1);
    next.bag.push(command.item);
    next.message = `${itemById(command.item).name}を持ち物に入れた。整理中は時間が進まない。`;
  } else if (command.kind === 'store') {
    if (run.room !== 'living') throw Error('保管箱は居間にあります');
    const index = next.bag.indexOf(command.item);
    if (index < 0) throw Error('持っていません');
    next.bag.splice(index, 1);
    next.box.push(command.item);
    next.message = `${itemById(command.item).name}を保管箱に預けた。必要なら居間で取り出せる。`;
  } else if (command.kind === 'craft' || command.kind === 'use') {
    timed = true;
    noise = 1;
    next.turn++;
    next.watchTurns += run.tv ? 1 : 0;
    next.fear += run.tv ? 1 : 0;
    next.passage = false;
    if (command.kind === 'craft') {
      if (!next.bag.includes('cloth') || !next.bag.includes('powder'))
        throw Error('布切れと浄化粉が必要です');
      next.bag.splice(next.bag.indexOf('cloth'), 1);
      next.bag.splice(next.bag.indexOf('powder'), 1);
      next.bag.push('flare');
      next.message = '布切れと浄化粉を調合し、閃光札を作った。持ち物が1枠空いた。';
    } else {
      const index = next.bag.indexOf(command.item);
      if (index < 0) throw Error('持っていません');
      if (command.item === 'herb') {
        if (run.health >= rules.maxHealth) throw Error('体力は十分です');
        next.health = Math.min(rules.maxHealth, run.health + rules.heal);
        next.message = '薬草の香りで意識が戻る。体力＋2（上限3）。';
      } else if (command.item === 'battery') {
        if (run.battery >= rules.maxBattery) throw Error('電池は十分です');
        next.battery = Math.min(rules.maxBattery, run.battery + rules.batteryPack);
        next.message = '予備電池を交換した。電池＋3（上限6）。';
      } else if (command.item === 'flare') {
        next.stun = rules.stun;
        next.message = '閃光札が白く燃え、影が止まった。次の2行動は追跡者が動けない。';
      } else throw Error('この道具は使う場所で働きます');
      next.bag.splice(index, 1);
    }
  } else {
    timed = true;
    if (command.kind === 'move') {
      const reason = travelReason(run, command.room);
      if (reason) throw Error(reason);
      if (command.room === 'well' && !run.wellUnlocked) {
        next.wellUnlocked = true;
        next.bag.splice(next.bag.indexOf('key'), 1);
      }
    }
    // The canonical v3 command log owns item actions. Only pass the last timed action to v2's hide rule.
    const base = {
      ...next,
      actions: run.lastTimed === 'wait' ? [{ kind: 'wait' } as HauntAction] : [],
    };
    next = actNight(base, command as HauntAction) as SurvivalRun;
    next.actions = [...run.actions, command as HauntAction];
    next.commands = [...run.commands];
    next.message = next.message.replace(
      /\n背後で、濡れた髪が床を擦った。もう、扉は見えない。$/,
      '',
    );
    if (next.phase === 'taken') {
      next.phase = 'play';
      next.reason = '';
    }
    if (command.kind === 'wait' && next.passage) evading = true;
    if (command.kind === 'search') {
      noise = 2;
      const newClue =
        run.room === 'living'
          ? !run.orderKnown
          : !run.clues.includes(run.room as 'bath' | 'study' | 'well');
      if (newClue) {
        next.supplies[run.room] = [...rules.supplies[run.room]];
        if (!run.key && next.key) {
          next.cooldown = 1;
          next.message +=
            '\n鍵が冷たく鳴った。井戸から足音が動き始める。マップで白い影の居場所を確かめよう。';
        }
        next.message += `\n周囲に残る物資：${next.supplies[run.room].map((item) => itemById(item).name).join('・') || 'なし'}。マップ・持ち物から拾える。`;
      }
    } else if (command.kind === 'move') {
      const quiet = 'pace' in command && command.pace === 'quiet';
      if (quiet) {
        if (run.battery < 1) throw Error('慎重な移動には電池1が必要です');
        next.battery--;
        if (run.turn + 2 > nightLimits(run).turns) throw Error('慎重な移動には2手必要です');
        next.turn++;
        next.fear += run.tv ? 1 : 0;
        next.watchTurns += run.tv ? 1 : 0;
        next.message += '\n2手と電池1で床を照らし、足音を抑えた。追跡者に移動音を聞かせない。';
      }
      noise = quiet ? 0 : 1;
      evading = run.passage || quiet;
    }
  }
  next.commands.push(structuredClone(command));
  if (timed) {
    next.lastTimed = command.kind;
    hunterStep(next, noise, evading);
    finish(next);
  }
  next.log = [next.message, ...run.log].slice(0, 8);
  return next;
}
export function survivalDiagnosis(run: PlayRun) {
  if (!isSurvival(run) || run.phase !== 'escaped') return nightDiagnosis(run);
  if (run.remembered.length === 3)
    return {
      title: '館の記憶を持ち帰った者',
      body: '限られた持ち物と明かりで、逃げ道だけでなく三つの記憶をつないだ。近道を開き、恐怖の奥にあった声を朝へ持ち帰った。',
    };
  if (run.encounters === 0)
    return {
      title: '白い影の死角を歩く者',
      body: '音を抑え、影の居場所を読み、触れられる前に道を開いた。残された物資も、逃げるための大切な選択だった。',
    };
  return {
    title: '傷を抱えて生還した探索者',
    body: `${run.encounters}度の接触をくぐり抜け、道具と逃げ道を使って朝へ戻った。次の夜は、保管箱と近道が別の作戦を支えてくれる。`,
  };
}
const itemSchema = z.enum(['cloth', 'powder', 'key', 'herb', 'battery', 'flare']);
const commandSchema = z.union([
  z
    .object({
      kind: z.literal('move'),
      room: z.enum(['living', 'bath', 'study', 'well', 'door']),
      pace: z.literal('quiet').optional(),
    })
    .strict(),
  z.object({ kind: z.literal('search'), light: z.boolean() }).strict(),
  z.object({ kind: z.enum(['wait', 'unplug', 'plug', 'craft']) }).strict(),
  z.object({ kind: z.enum(['take', 'store', 'retrieve', 'use']), item: itemSchema }).strict(),
  z
    .object({ kind: z.literal('seal'), symbols: z.array(z.enum(['○', '△', '×'])).length(3) })
    .strict(),
]);
const saveSchema = z
  .object({
    version: z.literal(3),
    seed: z.number().int().min(1).max(0xffffffff),
    mode: z.enum(['quick', 'slow']),
    commands: z.array(commandSchema).max(240),
  })
  .strict();
export function encodeSurvival(run: PlayRun) {
  return isSurvival(run)
    ? JSON.stringify({ version: 3, seed: run.seed, mode: run.mode, commands: run.commands })
    : encodeNight(run);
}
export function decodeSurvival(text: string): PlayRun {
  if (text.length > 32000) throw Error('保存データが大きすぎます');
  const raw = JSON.parse(text);
  if (raw?.version === 1 || raw?.version === 2) return decodeNight(text);
  const saved = saveSchema.parse(raw);
  let run: PlayRun = createSurvival(saved.seed, saved.mode);
  for (const command of saved.commands) run = actSurvival(run, command);
  return run;
}
export function survivalShare(run: PlayRun, site: string) {
  if (!isSurvival(run)) return nightShare(run, site);
  return nightShare(run, site)
    .replace(`「${nightDiagnosis(run).title}」`, `「${survivalDiagnosis(run).title}」`)
    .replace('\n#零時の残響', `\n残体力 ${run.health}/3 / 接触 ${run.encounters}回\n#零時の残響`);
}
export function survivalRestHint(run: PlayRun) {
  if (!isSurvival(run)) return '';
  return omen(run).id === 'steps' && run.lastTimed !== 'wait'
    ? `1手 / 気配−${run.tv ? 2 : 3}・次の移動を守る`
    : `1手 / 今は気配＋${run.tv ? 3 : 2}・足音のときだけ有効`;
}

export function hunterClose(run: PlayRun) {
  return (
    isSurvival(run) && run.key && run.room !== 'living' && run.hunter === run.room && run.stun === 0
  );
}
