import tower from './tower.json' with { type: 'json' };
import island from './island.json' with { type: 'json' };
import { parseDefinition } from '../core/schema';

export const games = [parseDefinition(tower), parseDefinition(island)];
export const defaultGame = games[0]!;
export const gameById = (id: string | null) => games.find((game) => game.id === id) ?? defaultGame;
