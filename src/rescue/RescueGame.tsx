import { useEffect, useRef, useState } from 'react';
import { rescueConfig as config } from './config';
import {
  cabin,
  countPeople,
  createRescue,
  dailyRescueSeed,
  decodeRescue,
  encodeRescue,
  forecast,
  moveElevator,
  previewRoute,
  rescueResult,
  rescueSaveKey,
  rescueShare,
  savedPeople,
} from './engine';
import type { RescueMode, RescueRun, TravelMode } from './engine';
import './rescue.css';

function initialSave() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(rescueSaveKey);
    return { run: raw ? decodeRescue(raw) : null, problem: '', hasRaw: !!raw };
  } catch {
    return {
      run: null,
      problem: raw
        ? '保存データを読み込めませんでした。新しく始めると上書きします。'
        : 'このブラウザでは保存できません。画面を閉じずに遊んでください。',
      hasRaw: !!raw,
    };
  }
}

export function RescueGame({ onExit }: { onExit: () => void }) {
  const [initial] = useState(initialSave);
  const [run, setRun] = useState<RescueRun | null>(initial.run);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<RescueMode>('standard');
  const [travel, setTravel] = useState<TravelMode>('normal');
  const [target, setTarget] = useState(3);
  const [notice, setNotice] = useState(initial.problem);
  const [canSave, setCanSave] = useState(true);
  const [help, setHelp] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = `${config.title} — 最後の1席に、誰を乗せる？`;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!run) return;
    try {
      localStorage.setItem(rescueSaveKey, encodeRescue(run));
      setCanSave(true);
    } catch {
      setCanSave(false);
    }
  }, [run]);
  useEffect(() => {
    if (run?.finished && playing) resultHeading.current?.focus();
  }, [run?.finished, playing]);

  function start(random = false) {
    if ((run || initial.hasRaw) && !window.confirm('前の救出記録を上書きして、新しく始めますか？'))
      return;
    const seed = random
      ? crypto.getRandomValues(new Uint32Array(1))[0] || 1
      : dailyRescueSeed(new Date());
    setRun(createRescue(seed, mode));
    setPlaying(true);
    setTarget(3);
    setTravel('normal');
    setNotice('');
  }

  async function share(copy = false) {
    if (!run) return;
    const text = rescueShare(run, window.location.href);
    try {
      if (!copy && navigator.share) await navigator.share({ title: config.title, text });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setNotice('救出結果をコピーしました！');
      } else setNotice('下の結果テキストを選択してコピーできます。');
    } catch (error) {
      setNotice(
        error instanceof DOMException && error.name === 'AbortError'
          ? '共有をキャンセルしました。'
          : '共有できませんでした。下の結果テキストをコピーできます。',
      );
    }
  }

  const current = run ?? createRescue(dailyRescueSeed(new Date()), mode);
  const settings = config.modes[current.mode];
  const passengers = cabin(current);
  const onBoard = countPeople(passengers);
  const safe = savedPeople(current);
  const route = previewRoute(current, target, travel);
  const event = forecast(current);
  const result = rescueResult(current);
  const remaining = settings.turns - current.turn;

  return (
    <div className="rescue-app">
      <header className="rescue-header">
        <button onClick={onExit} className="rescue-back">
          ← ゲーム一覧
        </button>
        <span>SMALL WORLDS / 003</span>
        <button onClick={() => setHelp(!help)} className="rescue-help" aria-expanded={help}>
          遊び方 ?
        </button>
      </header>
      <main className="rescue-main">
        {!playing ? (
          <section className="rescue-intro">
            <div className="rescue-intro-copy">
              <p className="rescue-kicker">
                <i /> A TINY RESCUE STRATEGY
              </p>
              <h1>
                ラスト<span>・</span>
                <br />
                エレベーター<span className="rescue-title-dot">。</span>
              </h1>
              <p className="rescue-tagline">最後の1席に、誰を乗せる？</p>
              <p className="rescue-description">
                停電したタワマン。動くエレベーターは、あと1台。
                <br />
                電力も、時間も、座席も足りない。
                <br />
                でも、助けた人が、次の誰かを助けてくれる。
              </p>
              <div className="rescue-intro-labels">
                <span>約3分</span>
                <span>タップだけ</span>
                <span>時間制限なし</span>
              </div>
              <fieldset className="rescue-mode">
                <legend>救出プラン</legend>
                {(['standard', 'practice'] as const).map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="rescue-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    <span>
                      {config.modes[value].label}
                      <small>
                        電力{config.modes[value].battery} / {config.modes[value].turns}手
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
              {run && (
                <button
                  className="rescue-primary"
                  onClick={() => {
                    setPlaying(true);
                    setTarget(run.floor === 0 ? 3 : 0);
                    setNotice('');
                  }}
                >
                  {run.finished ? '前の救出結果を見る' : '救出の続きから'} <span>→</span>
                </button>
              )}
              <button
                className={run ? 'rescue-secondary' : 'rescue-primary'}
                onClick={() => start()}
              >
                {run ? '今日のタワーをやり直す' : '救出をはじめる'} <span>↗</span>
              </button>
              <p className="rescue-daily">
                今日の配置はみんな同じ。まずは14人救出、ランクAを目指そう。
              </p>
            </div>
            <div className="rescue-poster" aria-hidden="true">
              <div className="rescue-moon" />
              <div className="rescue-radio">
                SOS <i />
                <i />
                <i />
              </div>
              <div className="poster-building">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i}>
                    <span>{11 - i}F</span>
                    <b className={i % 3 === 0 ? 'lit' : ''} />
                    <b />
                    <b className={i % 4 === 0 ? 'sos' : ''} />
                  </div>
                ))}
                <div className="poster-door">
                  <span>↑</span>
                  <small>LAST LIFT</small>
                </div>
              </div>
              <div className="poster-ground" />
              <span className="poster-caption">POWER IS LIMITED. HOPE IS NOT.</span>
            </div>
          </section>
        ) : (
          <>
            <div className="rescue-play-heading">
              <div>
                <p className="rescue-kicker">
                  <i /> EMERGENCY POWER / {config.modes[current.mode].label}
                </p>
                <h1>ラスト・エレベーター</h1>
              </div>
              <button className="rescue-pause" onClick={() => setPlaying(false)}>
                中断する
              </button>
            </div>
            <div className="rescue-status">
              <div className={current.battery < 15 ? 'low' : ''}>
                <span>非常電源</span>
                <strong>
                  {current.battery}
                  <small>POWER</small>
                </strong>
                <div className="rescue-battery">
                  <i
                    style={{
                      width: `${Math.min(100, (current.battery / settings.battery) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className={remaining <= 4 ? 'low' : ''}>
                <span>残りの行動</span>
                <strong>
                  {remaining}
                  <small>手</small>
                </strong>
                <p>時計を気にせず考えてOK</p>
              </div>
              <div>
                <span>避難所に到着</span>
                <strong>
                  {safe}
                  <small>/ {countPeople(current.people)}人</small>
                </strong>
                <p>目標14人でランクA</p>
              </div>
            </div>
            {!canSave && (
              <p className="rescue-warning" role="alert">
                保存できません。画面を閉じると救出の進行が失われます。
              </p>
            )}
            {!current.finished ? (
              <div className="rescue-play-layout">
                <section className="rescue-tower" aria-label="建物と住民の状況">
                  <div className="rescue-tower-top">
                    <span>MIKAZUKI TOWER</span>
                    <span>屋上避難チームも活動中</span>
                  </div>
                  <div className="rescue-tower-body">
                    <div className="rescue-shaft" aria-hidden="true">
                      <div className="rescue-rail" />
                      <div
                        className="rescue-lift"
                        style={{ bottom: `calc(${current.floor} * var(--floor-height) + 4px)` }}
                      >
                        <span>{current.floor + 1}F</span>
                        <b>▥</b>
                      </div>
                    </div>
                    <div className="rescue-floors">
                      {Array.from({ length: config.floors + 1 }, (_, i) => config.floors - i).map(
                        (floor) => {
                          const waiting = current.people.filter(
                            (p) => p.floor === floor && p.status === 'waiting',
                          );
                          const count = countPeople(waiting);
                          const minDeadline = waiting.length
                            ? Math.min(...waiting.map((p) => p.deadline - current.turn))
                            : 0;
                          const preview = previewRoute(current, floor, travel);
                          return (
                            <button
                              key={floor}
                              data-floor={floor}
                              className={`rescue-floor ${target === floor ? 'selected' : ''} ${floor === 0 ? 'refuge' : ''} ${minDeadline > 0 && minDeadline <= 3 ? 'urgent' : ''} ${!count && floor > 0 ? 'empty' : ''}`}
                              onClick={() => setTarget(floor)}
                              aria-pressed={target === floor}
                              aria-label={`${floor + 1}F ${floor === 0 ? '避難所' : `${count}人が待機中`} 行き先に選ぶ`}
                            >
                              <span className="rescue-floor-number">
                                {floor + 1}
                                <small>F</small>
                              </span>
                              <span className="rescue-floor-people">
                                {floor === 0 ? (
                                  <>
                                    <b>避難所</b>
                                    <small>ここで降ろすと救出完了</small>
                                  </>
                                ) : (
                                  <>
                                    <b>
                                      {waiting.map((p) => (
                                        <span key={p.id} title={p.name}>
                                          {p.icon}
                                          <small>{p.count}</small>
                                        </span>
                                      ))}
                                      {!count && (
                                        <span className="rescue-empty-label">
                                          {current.people.some((p) => p.floor === floor)
                                            ? 'この階の待機なし'
                                            : '呼び出しなし'}
                                        </span>
                                      )}
                                    </b>
                                    <small>
                                      {count > 0
                                        ? `${count}人 ${waiting.some((p) => p.perk) ? ' / 助けになる住民' : ''}`
                                        : ''}
                                    </small>
                                  </>
                                )}
                              </span>
                              <span className="rescue-floor-time">
                                {floor === 0 ? (
                                  <span>SAFE</span>
                                ) : count > 0 ? (
                                  <>
                                    <strong>あと{minDeadline}手</strong>
                                    <small>
                                      {preview.available ? `電力${preview.cost}` : '階段避難まで'}
                                    </small>
                                  </>
                                ) : null}
                              </span>
                              {current.floor === floor && (
                                <span className="rescue-current-label">現在地</span>
                              )}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                </section>
                <section className="rescue-controls" aria-label="エレベーターの操作">
                  <div className="rescue-cabin">
                    <div>
                      <h2>いま乗っている人</h2>
                      <span>
                        {onBoard} / {current.capacity}席
                      </span>
                    </div>
                    <div className="rescue-seats" aria-label={`${onBoard}人が搭乗中`}>
                      {Array.from({ length: current.capacity }, (_, i) => (
                        <i key={i} className={i < onBoard ? 'occupied' : ''}>
                          <span />
                        </i>
                      ))}
                    </div>
                    <p>
                      {passengers.length
                        ? passengers.map((p) => p.name).join('・')
                        : '空席があります。呼び出しのある階へ！'}
                    </p>
                  </div>
                  <div className="rescue-radio-message" role="status">
                    <span>▸ 無線</span>
                    <p>{current.last}</p>
                    {current.lastBonus > 0 && (
                      <strong className="rescue-delivery-pop" key={current.moves.length}>
                        ＋{current.lastBonus} pt
                      </strong>
                    )}
                  </div>
                  {event && <p className="rescue-forecast">次の移動の予告：{event.title}</p>}
                  {!route.available &&
                    travel === 'normal' &&
                    previewRoute(current, target, 'eco').available && (
                      <button className="rescue-mode-hint" onClick={() => setTravel('eco')}>
                        節電走行なら、この階に届きます。切り替える →
                      </button>
                    )}
                  <fieldset className="rescue-travel">
                    <legend>走行モード</legend>
                    {(['normal', 'eco'] as const).map((value) => (
                      <label key={value} className={travel === value ? 'active' : ''}>
                        <input
                          type="radio"
                          name="travel"
                          checked={travel === value}
                          onChange={() => setTravel(value)}
                        />
                        <span>
                          {value === 'normal' ? '通常走行' : '節電走行'}
                          <small>
                            {value === 'normal' ? '1手 / 急ぐときに' : '2手 / 電力を節約'}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="rescue-route">
                    <span>NEXT STOP</span>
                    <h2>
                      {target + 1}F{' '}
                      <small>
                        {target === 0
                          ? '避難所'
                          : route.count
                            ? `${route.count}人を乗せられます`
                            : '行き先を選んでください'}
                      </small>
                    </h2>
                    <div>
                      <span>
                        消費電力 <b>{route.cost}</b>
                      </span>
                      <span>
                        必要な行動 <b>{route.ticks}手</b>
                      </span>
                      {target > 0 && (
                        <span>
                          帰還に確保 <b>{route.returnCost}</b>
                        </span>
                      )}
                    </div>
                    {target > 0 && (
                      <ul>
                        {route.boarding.map((p) => (
                          <li key={p.id}>
                            <b>
                              {p.icon} {p.name} / {p.count}人
                            </b>
                            <span>
                              {p.perk === 'battery'
                                ? '避難所に届けると、電力＋8'
                                : p.perk === 'capacity'
                                  ? '避難所に届けると、定員＋1'
                                  : p.perk === 'patience'
                                    ? '避難所に届けると、全員の待機時間＋2手'
                                    : `階段避難まであと${p.deadline - current.turn}手`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    className="rescue-primary rescue-go"
                    disabled={!route.available}
                    onClick={() => {
                      const next = moveElevator(current, target, travel);
                      setRun(next);
                      setTarget(target === 0 ? 3 : 0);
                      setNotice('');
                    }}
                  >
                    <span className="rescue-command-label">
                      <strong>
                        {route.available
                          ? target === 0
                            ? `${onBoard}人を避難所へ届ける`
                            : `${target + 1}Fへ向かう`
                          : route.reason}
                      </strong>
                      <small>
                        電力{route.cost} / {route.ticks}手 · 搭乗 {onBoard}/{current.capacity}人
                      </small>
                    </span>
                    <span>→</span>
                  </button>
                  {onBoard > 0 && target !== 0 && (
                    <button
                      className="rescue-return"
                      onClick={() => {
                        setTarget(0);
                        if (!previewRoute(current, 0, travel).available) setTravel('normal');
                      }}
                    >
                      満員になる前に1Fへ戻る ↙
                    </button>
                  )}
                  <p className="rescue-tip">
                    満員で届けると＋100pt。3つ以上の階から集めると＋80pt。助けになる住民を優先し、ほかは期限が近い順に乗ります。住民は期限が来ると階段チームに合流します。帰還分の電力は使い切れない仕組みです。
                  </p>
                </section>
              </div>
            ) : (
              <section className="rescue-result">
                <p className="rescue-kicker">EVERY LITTLE RESCUE COUNTS</p>
                <div className="rescue-rank">
                  {result.rank}
                  <small>RANK</small>
                </div>
                <h2 ref={resultHeading} tabIndex={-1}>
                  あなたが届けた、<em>{result.count}人</em>の安心。
                </h2>
                <p className="rescue-result-score">
                  {result.score.toLocaleString()} <small>POINTS</small>
                </p>
                <div className="rescue-result-diagnosis">
                  <span>あなたの救出タイプ</span>
                  <h3>{result.title}</h3>
                  <p>{result.body}</p>
                </div>
                <div className="rescue-result-stats">
                  <div>
                    <b>{current.trips}</b>
                    <span>避難所への便数</span>
                  </div>
                  <div>
                    <b>{current.fullTrips}</b>
                    <span>満員ボーナス</span>
                  </div>
                  <div>
                    <b>{current.urgent}</b>
                    <span>ぎりぎりの救出</span>
                  </div>
                </div>
                <p className="rescue-result-note">
                  {countPeople(current.people.filter((p) => p.status !== 'safe'))}
                  人は階段・別の避難チームに引き継ぎました。助けた人が増やした電力や定員も、あなたの作戦の一部です。
                </p>
                <div className="rescue-result-actions">
                  <button
                    className="rescue-primary"
                    onClick={() => {
                      setPlaying(false);
                      setNotice('');
                    }}
                  >
                    作戦を変えて、もう一度 <span>↗</span>
                  </button>
                  <button className="rescue-secondary" onClick={() => void share()}>
                    救出結果をシェア
                  </button>
                  <button className="rescue-text-button" onClick={() => void share(true)}>
                    結果をコピー
                  </button>
                  <button className="rescue-text-button" onClick={() => start(true)}>
                    別の配置で挑戦する
                  </button>
                </div>
                <details className="rescue-share-text">
                  <summary>共有用テキスト</summary>
                  <textarea
                    aria-label="救出結果の共有テキスト"
                    readOnly
                    value={rescueShare(current, window.location.href)}
                    rows={5}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </details>
                <p className="rescue-result-note">
                  診断はプレイ内容を振り返る娯楽です。同じ配置でも、ルート次第で救出人数が変わります。
                </p>
              </section>
            )}
          </>
        )}
        {help && (
          <section className="rescue-instructions">
            <h2>3分でわかる、最後の一便。</h2>
            <ol>
              <li>建物の階をタップして、行き先を選びます。</li>
              <li>「向かう」で移動。間に合う住民が定員まで自動で乗ります。</li>
              <li>1Fの避難所に届けて、初めて救出完了です。</li>
              <li>帰り道を考えて、別の階にも寄ってみましょう。満員と3フロアの連携にはボーナス。</li>
              <li>節電走行は安いかわりに2手必要。時計の時間制限はありません。</li>
            </ol>
            <p>
              期限は階段チームへ移るまでの行動数です。防災やエレベーター運用の実際の手順を再現したものではない、架空のパズルです。
            </p>
          </section>
        )}
        {notice && (
          <p className="rescue-notice" role="status">
            {notice}
          </p>
        )}
        <footer className="rescue-footer">
          <span>FICTIONAL TOWER. REAL LITTLE CHOICES.</span>
          <p>
            登録不要・この端末に自動保存・個人情報の入力なし
            <br />
            現実の停電・災害時は管理者や公的機関の案内に従ってください。
          </p>
        </footer>
      </main>
    </div>
  );
}
