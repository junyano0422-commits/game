export const stallConfig = {
  version: 1,
  tickMs: 200,
  golden: { min: 42, max: 69 },
  modes: {
    quick: { label: 'ひと晩体験', nights: 1, guests: 4, closing: 210 },
    story: { label: '3夜の屋台日記', nights: 3, guests: 6, closing: 300 },
  },
  flavors: [
    { id: 'soy', name: 'しょうゆ', icon: '🟤', color: '#995b36' },
    { id: 'miso', name: 'みそ', icon: '🟠', color: '#cf813f' },
    { id: 'butter', name: 'バター', icon: '🟡', color: '#f1c755' },
  ],
  guests: [
    { name: '散歩中のミケ', icon: '🐈', line: '香ばしい匂いにつられたにゃ。' },
    { name: '配達帰りのタヌ', icon: '🦝', line: '今日も一日、走り回ったよ。' },
    { name: '星を見ていたウサ', icon: '🐇', line: 'あったかいのを、ひとつください。' },
    { name: '夜勤前のクマ', icon: '🐻', line: 'おなかが鳴って困っちゃう。' },
    { name: '旅するキツネ', icon: '🦊', line: 'この町の味を教えて。' },
    { name: '本屋のパンダ', icon: '🐼', line: '閉店後のお楽しみなんです。' },
  ],
  evenings: [
    {
      title: '星のきれいな夜',
      description: '今夜はいつもの焼き加減。焦らず、こんがり。',
      heat: 3,
      interval: 40,
      tip: 0,
    },
    {
      title: '冷たい風の夜',
      description: '焼き上がりがゆっくり。2つの焼き台をうまく使おう。',
      heat: 2,
      interval: 45,
      tip: 0,
    },
    {
      title: '小さなお祭りの夜',
      description: 'お客さんが少し早めに到着。お祭りの心づけ＋5円。',
      heat: 3,
      interval: 30,
      tip: 5,
    },
  ],
  upgrades: [
    {
      id: 'lantern',
      name: 'あったか提灯',
      icon: '🏮',
      cost: 70,
      description: '待ち時間が5秒長くなる。のんびり焼きたい店主へ。',
    },
    {
      id: 'grill',
      name: '3つめの焼き台',
      icon: '🔥',
      cost: 90,
      description: '同時に3個焼ける。忙しさも売上も、自分次第。',
    },
    {
      id: 'premium',
      name: 'こだわりのお米',
      icon: '🌾',
      cost: 80,
      description: '正しい味で出すと売上＋8円。ひと皿を大切に。',
    },
  ],
} as const;
export type Flavor = (typeof stallConfig.flavors)[number]['id'];
export type Upgrade = (typeof stallConfig.upgrades)[number]['id'];
export type StallMode = keyof typeof stallConfig.modes;
