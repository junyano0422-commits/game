import { useRef } from 'react';
import { hauntConfig } from './config';
import { adjacent, hunterHint, travelReason } from './survival';
import type { SurvivalCommand, SurvivalRun } from './survival';
import { survivalConfig as config, itemById } from './survival-config';
import type { ItemId } from './survival-config';
const positions = {
  living: [160, 112],
  study: [270, 40],
  well: [270, 190],
  bath: [50, 190],
  door: [50, 40],
} as const;
export function SurvivalTracker({ run }: { run: SurvivalRun }) {
  return (
    <section className="echo-tracker" aria-label="追跡者の気配">
      <span>白い影：{configRoom(run.hunter)}</span> <p>{hunterHint(run)}</p>
    </section>
  );
}
export function SurvivalPanel({
  run,
  onCommand,
}: {
  run: SurvivalRun;
  onCommand: (command: SurvivalCommand) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const bagActions = (item: ItemId) => {
    const usable = ['herb', 'battery', 'flare'].includes(item);
    const unavailable =
      item === 'herb'
        ? run.health >= config.maxHealth
        : item === 'battery'
          ? run.battery >= config.maxBattery
          : false;
    return (
      <>
        <button disabled={!usable || unavailable} onClick={() => onCommand({ kind: 'use', item })}>
          {usable ? (unavailable ? '今は不要' : '使う（1手）') : '場所・調合で使う'}
        </button>
        {run.room === 'living' && (
          <button onClick={() => onCommand({ kind: 'store', item })}>保管する</button>
        )}
      </>
    );
  };
  return (
    <>
      <button className="echo-bag-button" onClick={() => dialog.current?.showModal()}>
        探索マップ・持ち物{' '}
        <span>
          {run.bag.length}/{config.capacity}枠
        </span>
      </button>
      <dialog className="echo-survival-dialog" ref={dialog} aria-labelledby="echo-survival-title">
        <button autoFocus className="echo-notes-close" onClick={() => dialog.current?.close()}>
          探索に戻る ×
        </button>
        <h2 id="echo-survival-title">探索マップ・持ち物</h2>
        <p className="echo-bag-summary">
          体力 {run.health}/{config.maxHealth} ／ 持ち物 {run.bag.length}/{config.capacity}枠 ／
          追跡の音 {run.alert}/{config.hunterThreshold}
        </p>
        <svg
          className="echo-map"
          viewBox="0 0 320 245"
          role="img"
          aria-label={`現在地は${configRoom(run.room)}。白い影は${configRoom(run.hunter)}。居間は安全拠点。`}
        >
          {config.edges.map(([a, b]) => {
            const gate = [a, b].includes('well') && [a, b].includes('bath');
            return (
              <line
                key={`${a}-${b}`}
                x1={positions[a][0]}
                y1={positions[a][1]}
                x2={positions[b][0]}
                y2={positions[b][1]}
                stroke={gate && !run.clues.includes('well') ? '#745a4b' : '#83967b'}
                strokeDasharray={gate && !run.clues.includes('well') ? '5 5' : undefined}
              />
            );
          })}
          {hauntConfig.rooms.map((room) => {
            const [x, y] = positions[room.id];
            const visited =
              room.id === 'living' ||
              run.actions.some((a) => a.kind === 'move' && a.room === room.id);
            return (
              <g key={room.id}>
                <rect
                  x={x - 42}
                  y={y - 20}
                  width="84"
                  height="42"
                  rx="4"
                  fill={room.id === run.room ? '#59714b' : visited ? '#243728' : '#15221b'}
                  stroke={run.supplies[room.id].length ? '#d5a674' : '#799372'}
                />
                <text x={x} y={y + 1} textAnchor="middle" fill="#e5ecd9" fontSize="12">
                  {room.name}
                </text>
                <text x={x} y={y + 34} textAnchor="middle" fill="#bdcba9" fontSize="10">
                  {room.id === run.room
                    ? '現在地'
                    : run.supplies[room.id].length
                      ? '物資あり'
                      : visited
                        ? '訪問済み'
                        : '未探索'}
                </text>
                {room.id === run.hunter && (
                  <circle cx={x + 34} cy={y - 18} r="5" fill={run.stun ? '#c0dca4' : '#c98b7d'} />
                )}
              </g>
            );
          })}
        </svg>
        <p className="echo-map-help">
          線でつながる部屋へ移動できます。破線は井戸側から開く近道。色の丸は白い影。居間には追跡者が入りません。
        </p>
        <div className="echo-map-exits" aria-label="マップから移動">
          {adjacent(run, run.room).map((room) => (
            <button
              key={room}
              disabled={!!travelReason(run, room)}
              onClick={() => {
                onCommand({ kind: 'move', room });
                dialog.current?.close();
              }}
            >
              {configRoom(room)}へ（通常1手）
              {travelReason(run, room) ? `（${travelReason(run, room)}）` : ''}
            </button>
          ))}
        </div>
        <h3>
          持ち物 <small>整理と拾う操作は手数を使いません</small>
        </h3>
        <div className="echo-bag-grid">
          {run.bag.map((id, index) => {
            const item = itemById(id);
            return (
              <article key={`${id}-${index}`}>
                <strong>
                  {item.icon} {item.name}
                </strong>
                <p>{item.description}</p>
                {bagActions(id)}
              </article>
            );
          })}
          {Array.from({ length: config.capacity - run.bag.length }, (_, index) => (
            <div className="echo-empty-slot" key={`empty-${index}`}>
              空き枠
            </div>
          ))}
        </div>
        <button
          className="echo-craft"
          disabled={!run.bag.includes('cloth') || !run.bag.includes('powder')}
          onClick={() => onCommand({ kind: 'craft' })}
        >
          調合：布切れ ＋ 浄化粉 → 閃光札（1手）
        </button>
        <p className="echo-map-help">
          調合と使用も1手進み、追跡者が動きます。足音や影の位置を見て使おう。
        </p>
        <h3>この部屋の物資</h3>
        {run.supplies[run.room].length ? (
          <div className="echo-supply-list">
            {run.supplies[run.room].map((id, index) => (
              <button
                key={`${id}-${index}`}
                disabled={run.bag.length >= config.capacity}
                onClick={() => onCommand({ kind: 'take', item: id })}
              >
                {itemById(id).icon} {itemById(id).name}を拾う
              </button>
            ))}
          </div>
        ) : (
          <p className="echo-map-help">まだ調べていないか、物資を拾い終えています。</p>
        )}
        {run.bag.length === config.capacity && (
          <p className="echo-map-help">
            持ち物がいっぱいです。居間の保管箱か、必要な道具の使用・調合で空きを作れます。
          </p>
        )}
        {run.room === 'living' && (
          <section className="echo-storage">
            <h3>居間の保管箱</h3>
            {run.box.length ? (
              run.box.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  disabled={run.bag.length >= config.capacity}
                  onClick={() => onCommand({ kind: 'retrieve', item })}
                >
                  {itemById(item).name}を取り出す
                </button>
              ))
            ) : (
              <p>保管箱は空です。持ち物の「保管する」で預けられます。</p>
            )}
          </section>
        )}
      </dialog>
    </>
  );
}
function configRoom(id: SurvivalRun['room']) {
  return hauntConfig.rooms.find((room) => room.id === id)!.name;
}
