export const hauntConfig = {
  title: '零時の残響',
  modes: {
    quick: { label: '短編 / 約3分', turns: 18, fear: 14, battery: 3 },
    slow: { label: 'じっくり / 約5分', turns: 24, fear: 16, battery: 4 },
  },
  rooms: [
    {
      id: 'living',
      name: '居間',
      icon: '▣',
      description: '消したはずのテレビ。砂嵐の奥で、誰かが井戸を見下ろしている。',
      object: '呪いの映像',
      clue: '映像の最後に、三つの場所が映った。封印を結ぶ順番らしい。',
    },
    {
      id: 'bath',
      name: '浴室',
      icon: '◈',
      description: '鏡が内側から曇っている。あなたの背後だけが、映らない。',
      object: '曇った鏡',
      clue: '鏡の曇りをぬぐうと、記号と小さな護符が現れた。護符は一度だけ、視線から守ってくれる。',
    },
    {
      id: 'study',
      name: '書斎',
      icon: '▤',
      description: '濡れた日記。最後のページだけ、今もインクが滲んでいる。',
      object: '濡れた日記',
      clue: '日記の余白に記号がある。挟まっていた古い鍵は、中庭の鉄格子に合いそうだ。',
    },
    {
      id: 'well',
      name: '中庭の井戸',
      icon: '◎',
      description: '水音が、下ではなく後ろから聞こえる。縁には長い黒髪が絡みついている。',
      object: '井戸の縁',
      clue: '底から伸びる白い手。その指がなぞった記号を、あなたは覚えた。もう振り返らない。',
    },
    {
      id: 'door',
      name: '玄関',
      icon: '⛩',
      description: '出口の扉に三つの空洞。正しい順に記号を結べば、夜は終わる。',
      object: '三つの封印',
      clue: '',
    },
  ],
  clueRooms: ['bath', 'study', 'well'],
  runes: ['○', '△', '×'],
  omens: [
    { id: 'silence', title: '静寂', text: '次は、物音がしない。動くなら今。' },
    {
      id: 'steps',
      title: '廊下の足音',
      text: '次に移動すると、気配が一気に近づく。息をひそめるか、今いる部屋を調べよう。',
    },
    {
      id: 'eyes',
      title: '画面の視線',
      text: '次に素手で調べると、見つかる。ライトなら視線をそらせる。',
    },
  ],
  rules: { baseFear: 1, omenFear: 3, wrongSealFear: 4, waitRelief: 2, repeatedWaitFear: 2 },
} as const;
export type Room = (typeof hauntConfig.rooms)[number]['id'];
export type ClueRoom = (typeof hauntConfig.clueRooms)[number];
export type Rune = (typeof hauntConfig.runes)[number];
export type HauntMode = keyof typeof hauntConfig.modes;
