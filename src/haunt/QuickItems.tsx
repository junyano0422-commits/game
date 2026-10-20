import { itemById, survivalConfig } from './survival-config';
import type { SurvivalCommand, SurvivalRun } from './survival';
export function QuickItems({
  run,
  onCommand,
}: {
  run: SurvivalRun;
  onCommand: (command: SurvivalCommand) => void;
}) {
  const supplies = run.supplies[run.room];
  const usable = [...new Set(run.bag)].filter((id) =>
    id === 'herb'
      ? run.health < survivalConfig.maxHealth
      : id === 'battery'
        ? run.battery < survivalConfig.maxBattery
        : id === 'flare',
  );
  const craft = run.bag.includes('cloth') && run.bag.includes('powder');
  if (!supplies.length && !usable.length && !craft) return null;
  return (
    <section className="echo-quick-items" aria-label="すぐ使える道具">
      {supplies.map((item, index) => (
        <button
          key={`${item}-${index}`}
          disabled={run.bag.length >= survivalConfig.capacity}
          onClick={() => onCommand({ kind: 'take', item })}
        >
          <span>
            {itemById(item).icon} {itemById(item).name}を拾う
          </span>
          <small>
            {run.bag.length >= survivalConfig.capacity ? '持ち物がいっぱい' : '拾うだけなら0手'}
          </small>
        </button>
      ))}
      {craft && (
        <button onClick={() => onCommand({ kind: 'craft' })}>
          <span>✧ 閃光札を調合</span>
          <small>1手・布切れ＋浄化粉</small>
        </button>
      )}
      {usable.map((item) => (
        <button key={`use-${item}`} onClick={() => onCommand({ kind: 'use', item })}>
          <span>
            {itemById(item).icon} {itemById(item).name}を使う
          </span>
          <small>
            1手・{item === 'herb' ? '体力＋2' : item === 'battery' ? '電池＋3' : '追跡者を止める'}
          </small>
        </button>
      ))}
    </section>
  );
}
