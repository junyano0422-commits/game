export const revisionConfig = {
  restRelief: 3,
  blindRestFear: 2,
  darkDangerFear: 5,
  sensory: {
    silence: '物音が途切れた。廊下には誰もいない。',
    steps: '扉のすぐ前で、濡れた足音が止まった。今は移動せず、息をひそめよう。',
    eyes: '鏡も画面もないのに、視線を感じる。調べるなら明かりか護符が必要だ。',
  },
  memories: {
    bath: '鏡の中の彼女は、あなたではなく、遠い日の自分を見ていた。',
    study: '日記にあったのは呪いの言葉ではなく、「私を忘れないで」という一行だった。',
    well: '白い指が井戸の縁に触れた。誰かに見つけてほしかった、その記憶だけが残った。',
  },
} as const;
