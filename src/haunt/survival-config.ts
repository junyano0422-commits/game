import type { Room } from './config';
export const survivalConfig = {
  modes: { quick: { turns: 24, fear: 18, battery: 3 }, slow: { turns: 32, fear: 22, battery: 4 } },
  capacity: 4,
  maxHealth: 3,
  maxBattery: 6,
  heal: 2,
  batteryPack: 3,
  stun: 3,
  hunterThreshold: 2,
  edges: [
    ['living', 'bath'],
    ['living', 'study'],
    ['living', 'door'],
    ['study', 'well'],
    ['well', 'bath'],
  ] as readonly (readonly [Room, Room])[],
  items: [
    { id: 'cloth', name: '布切れ', icon: '▱', description: '浄化粉と調合して閃光札に。' },
    { id: 'powder', name: '浄化粉', icon: '✧', description: '布切れと調合できる。' },
    {
      id: 'key',
      name: '鉄格子の鍵',
      icon: '⚿',
      description: '書斎から井戸への扉を開くと役目を終える。',
    },
    { id: 'herb', name: '鎮静の薬草', icon: '♧', description: '1手で体力＋2（上限3）。' },
    { id: 'battery', name: '予備電池', icon: '▣', description: '1手で電池＋3（上限6）。' },
    {
      id: 'flare',
      name: '閃光札',
      icon: '☼',
      description: '1手で光を放ち、追跡者を次の2行動まで止める。',
    },
  ] as const,
  supplies: {
    living: ['battery', 'herb'],
    study: ['key', 'powder'],
    bath: ['herb'],
    well: ['cloth'],
    door: [],
  } as const,
} as const;
export type ItemId = (typeof survivalConfig.items)[number]['id'];
export const itemById = (id: ItemId) => survivalConfig.items.find((item) => item.id === id)!;
