import type { Room } from './config';
import { adjacent, isSurvival } from './survival';
import type { PlayRun, SurvivalRun } from './survival';

export const storyConfig = {
  premise:
    'あなたは、取り壊し前の館を片付けに来た。居間には「私を覚えてる？」と書かれたビデオが残されていた。',
  promise:
    '再生すると、玄関が開かなくなる。館に残る三つの印と封印の順番を探し、夜明け前に脱出する。',
  beats: {
    arrival: {
      title: '01 / 閉じ込められた夜',
      speaker: 'あなた',
      line: 'さっきまで開いた扉が動かない。テレビの中の井戸から、誰かがこちらを見ている。',
      meaning: 'まず居間の映像を調べる。出口を開く手がかりが映っている。',
    },
    video: {
      title: '02 / 三つの封印',
      speaker: '映像の声',
      line: '「鏡。日記。井戸。三つの印を、正しい順に結んで。」',
      meaning: '印は三か所にある。映像は最後の場所を、日記は残りの順番を教えてくれる。',
    },
    study: {
      title: '日記 / 忘れられた少女',
      speaker: '濡れた日記',
      line: '「井戸に落ちたあの子のことを、誰も話さなくなった。忘れるために、私たちは扉を封じた。」',
      meaning:
        '追ってくる影は、この館で忘れられた少女。挟まっていた鍵で井戸への鉄格子を開けられる。',
    },
    bath: {
      title: '鏡 / 消えない記憶',
      speaker: '鏡の中の声',
      line: '「ここにいたの。ずっと、ここに。」',
      meaning:
        '鏡に残る印を記録した。彼女が求めているのは、忘れられた自分を見つけてもらうことかもしれない。',
    },
    well: {
      title: '井戸 / 本当の願い',
      speaker: '井戸の底の声',
      line: '「逃げてもいい。でも、私がいたことだけは、忘れないで。」',
      meaning:
        '井戸の印を記録した。三つ揃えたら玄関へ。テレビをつけたまま見つけた記憶は、彼女の願いを知る結末につながる。',
    },
    escaped: {
      title: '終章 / 朝へ',
      speaker: 'あなた',
      line: '扉の向こうから、朝の光が差し込んだ。',
      meaning: '封印を正しい順に結び直し、館から抜け出した。',
    },
    remembered: {
      title: '終章 / 忘れない',
      speaker: '少女',
      line: '「ありがとう。もう、ひとりじゃない。」',
      meaning:
        '三つの記憶を抱えて脱出した。少女を館に縛っていたのは、誰にも覚えてもらえない孤独だった。',
    },
    taken: {
      title: '終章 / 夜の向こう',
      speaker: 'あなた',
      line: '扉が遠ざかる。呼びかける声だけが、すぐそばにあった。',
      meaning:
        'この夜は終わった。同じ夜なら印と順番は同じ。次は危険の予告と道具を使い、帰り道を変えてみよう。',
    },
  },
} as const;
export type StoryId = keyof typeof storyConfig.beats;
export function storyIds(run: PlayRun): StoryId[] {
  const ids: StoryId[] = ['arrival'];
  const seen = new Set<Room>();
  let room: Room = 'living';
  for (const action of isSurvival(run) ? run.commands : run.actions) {
    if (action.kind === 'move') room = action.room;
    if (action.kind !== 'search' || seen.has(room)) continue;
    seen.add(room);
    if (room === 'living') ids.push('video');
    else if (room !== 'door') ids.push(room);
  }
  if (run.phase === 'taken') ids.push('taken');
  if (run.phase === 'escaped')
    ids.push('remembered' in run && run.remembered.length === 3 ? 'remembered' : 'escaped');
  return ids;
}
export function currentStory(run: PlayRun) {
  const id = storyIds(run).at(-1)!;
  return { id, ...storyConfig.beats[id] };
}
function nextHop(run: SurvivalRun, target: Room): Room | undefined {
  const queue: Room[][] = [[run.room]];
  const seen = new Set<Room>([run.room]);
  while (queue.length) {
    const path = queue.shift()!;
    if (path.at(-1) === target) return path[1];
    for (const room of adjacent(run, path.at(-1)!)) {
      if (seen.has(room)) continue;
      seen.add(room);
      queue.push([...path, room]);
    }
  }
}
export function objective(run: SurvivalRun) {
  let target: Room;
  let text: string;
  let progress: number;
  if (!run.orderKnown) {
    target = 'living';
    text = run.tv ? '居間の映像から封印の手がかりを読む' : '居間でテレビをつけ、映像を調べる';
    progress = 0;
  } else if (!run.clues.includes('study')) {
    target = 'study';
    text = '書斎の日記から順番と鍵を見つける';
    progress = 1;
  } else if (!run.wellUnlocked && !run.bag.includes('key')) {
    target = 'study';
    text = run.box.includes('key') ? '居間の保管箱から鍵を取り出す' : '書斎の「鉄格子の鍵」を拾う';
    if (run.box.includes('key')) target = 'living';
    progress = 2;
  } else if (!run.clues.includes('well')) {
    target = 'well';
    text = '鍵で井戸へ進み、井戸の印を調べる';
    progress = 2;
  } else if (!run.clues.includes('bath')) {
    target = 'bath';
    text = '開いた近道から浴室へ進み、鏡の印を調べる';
    progress = 3;
  } else {
    target = 'door';
    text = '玄関で、映像と日記をもとに三つの印を並べる';
    progress = 4;
  }
  return { target, text, progress, next: nextHop(run, target) };
}
