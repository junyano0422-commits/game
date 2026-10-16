import { useEffect, useRef, useState } from 'react';
import {
  advance,
  canAfford,
  currentEvent,
  decide,
  diagnosis,
  newRun,
  previewChoice,
  score,
  shareText,
} from '../core/engine';
import type { Run } from '../core/engine';
import { metricKeys, strategyKeys } from '../core/schema';
import type { Effects, GameDefinition, Mode } from '../core/schema';
import { readSave, writeSave } from '../core/storage';
import type { SaveResult } from '../core/storage';
import { gameById, games } from '../games';
import { Scene } from './Scene';

const strategyNames = { people: '人とのつながり', finance: '資金の余裕', future: '未来への投資' };
const numbers = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });

function load(game: GameDefinition): SaveResult {
  try {
    return readSave(game, window.localStorage);
  } catch {
    return {
      kind: 'error',
      message: 'このブラウザでは保存機能を利用できません。保存せずに遊ぶことはできます。',
    };
  }
}

function EffectsList({ game, effects }: { game: GameDefinition; effects: Effects }) {
  return (
    <span className="effects">
      {metricKeys
        .filter((key) => effects[key])
        .map((key) => (
          <span key={key} className={(effects[key] ?? 0) < 0 ? 'cost' : ''}>
            {game.metrics[key].label} {(effects[key] ?? 0) > 0 ? '+' : ''}
            {numbers.format(effects[key]!)}
            {game.metrics[key].unit}
          </span>
        ))}
      {!Object.keys(effects).length && <span>直接の費用・効果なし</span>}
    </span>
  );
}

export function App() {
  const [game, setGame] = useState(() =>
    gameById(new URLSearchParams(window.location.search).get('game')),
  );
  const [initialSave] = useState(() => load(game));
  const [run, setRun] = useState<Run | null>(() =>
    initialSave.kind === 'ready' ? initialSave.run : null,
  );
  const [screen, setScreen] = useState<'home' | 'play'>('home');
  const [mode, setMode] = useState<Mode>('quick');
  const [notice, setNotice] = useState(initialSave.kind === 'error' ? initialSave.message : '');
  const [loadFailed, setLoadFailed] = useState(initialSave.kind === 'error');
  const [saved, setSaved] = useState(true);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!run) return;
    let ok = false;
    try {
      ok = writeSave(run, window.localStorage);
    } catch {
      /* Storage may be disabled. */
    }
    setSaved(ok);
  }, [run]);

  useEffect(() => {
    if (screen === 'play') heading.current?.focus({ preventScroll: true });
  }, [screen, run?.turn, run?.phase]);

  function selectGame(next: GameDefinition) {
    const result = load(next);
    setGame(next);
    setRun(result.kind === 'ready' ? result.run : null);
    setNotice(result.kind === 'error' ? result.message : '');
    setLoadFailed(result.kind === 'error');
    setSaved(true);
    const url = new URL(window.location.href);
    url.searchParams.set('game', next.id);
    window.history.replaceState(null, '', url);
  }

  function startNew() {
    if (
      (run || loadFailed) &&
      !window.confirm('このゲームの保存データを上書きして、新しくはじめますか？')
    )
      return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    setRun(newRun(game, mode, seed));
    setNotice('');
    setLoadFailed(false);
    setScreen('play');
  }

  async function share(useNative: boolean) {
    if (!run) return;
    const text = shareText(game, run, window.location.origin);
    try {
      if (useNative && navigator.share) {
        await navigator.share({ title: game.title, text });
        setNotice('共有しました。');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setNotice('結果をコピーしました。');
      } else setNotice('下の共有テキストを選択してコピーしてください。');
    } catch (error) {
      setNotice(
        error instanceof DOMException && error.name === 'AbortError'
          ? '共有をキャンセルしました。'
          : '共有できませんでした。下のテキストを選択してコピーできます。',
      );
    }
  }

  const event = run?.phase === 'decision' ? currentEvent(game, run) : null;
  const result = run ? diagnosis(game, run) : null;
  const total = game.modes[run?.mode ?? mode].turns;

  return (
    <div className={`app theme-${game.theme}`}>
      <header className="site-header">
        <button
          className="wordmark"
          onClick={() => {
            setScreen('home');
            setNotice('');
          }}
          aria-label="Small Worlds ゲーム一覧へ"
        >
          <span className="brand-symbol" aria-hidden="true">
            ▧
          </span>
          <span>
            SMALL WORLDS<small>小さな決断、大きな未来。</small>
          </span>
        </button>
        <a className="legacy-link" href="/legacy/">
          タワマン理事長！原作版 <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        {screen === 'home' && (
          <>
            <section className="intro-section">
              <div>
                <p className="eyebrow">
                  <span className="live-dot" /> LITTLE SIMULATION GAMES
                </p>
                <h1>
                  ひとつの決断から、
                  <br />
                  まだ見ぬ<span>未来</span>へ。
                </h1>
                <p className="intro-copy">
                  正解は、ひとつじゃない。
                  <br className="mobile-break" />
                  人の声を聴き、ときには先を見て。
                  <br />
                  あなただけの小さな世界を育てよう。
                </p>
                <div className="intro-notes">
                  <span>◷ 5分から遊べる</span>
                  <span>↳ いつでも保存・再開</span>
                  <span>✧ あなたらしさを診断</span>
                </div>
              </div>
              <Scene theme={game.theme} />
            </section>

            <section className="library" aria-labelledby="library-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CHOOSE YOUR WORLD</p>
                  <h2 id="library-title">今日、どんな未来をつくる？</h2>
                </div>
                <span className="subtle">02 WORLDS</span>
              </div>
              <div className="game-grid">
                {games.map((item) => (
                  <button
                    className={`game-card ${game.id === item.id ? 'selected' : ''}`}
                    key={item.id}
                    onClick={() => selectGame(item)}
                    aria-pressed={game.id === item.id}
                  >
                    <Scene theme={item.theme} small />
                    <div className="card-copy">
                      <div className="card-kicker">
                        <span>
                          {item.theme === 'tower' ? 'BUILDING & PEOPLE' : 'ISLAND & COMMUNITY'}
                        </span>
                        <span>{game.id === item.id ? '選択中 ✓' : '選ぶ ↗'}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="card-tags">
                        <span>5分モード</span>
                        <span>
                          {item.theme === 'tower' ? '暮らし × 資産' : '人口 × まちづくり'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="start-panel" aria-label={`${game.title}のプレイ設定`}>
              <div>
                <p className="eyebrow">YOUR NEXT CHAPTER</p>
                <h2>{game.title}</h2>
                <p className="subtle">{game.subtitle}</p>
              </div>
              <fieldset className="mode-picker">
                <legend>遊ぶ長さを選ぶ</legend>
                {(['quick', 'full'] as const).map((value) => (
                  <label key={value} className={mode === value ? 'active' : ''}>
                    <input
                      type="radio"
                      name="mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    <span>
                      <b>{game.modes[value].label}</b>
                      <small>
                        {game.modes[value].turns}回の決断 · {game.modes[value].duration}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="start-actions">
                {run && (
                  <button
                    className="primary"
                    onClick={() => {
                      setScreen('play');
                      setNotice('');
                    }}
                  >
                    {run.phase === 'finished'
                      ? '保存した結果を見る'
                      : `続きからあそぶ（${run.turn} / ${game.modes[run.mode].turns}）`}{' '}
                    <span>→</span>
                  </button>
                )}
                <button className={run ? 'secondary' : 'primary'} onClick={startNew}>
                  {run ? '新しくはじめる' : 'この世界をはじめる'} <span>→</span>
                </button>
              </div>
            </section>
            <aside className="how-to">
              <span className="round-icon">?</span>
              <div>
                <h3>相談を読んで、ひとつ選ぶ。それだけ。</h3>
                <p>
                  選んだ方針は、次の相談や数年後の変化に。3回続けて同じ方針を選ぶと、効果が小さくなり、満足も下がります。今の暮らしと未来の備え、どちらも大切に。
                </p>
              </div>
            </aside>
          </>
        )}

        {screen === 'play' && run && (
          <>
            <div className="play-top">
              <button
                className="text-button"
                onClick={() => {
                  setScreen('home');
                  setNotice('');
                }}
              >
                ← ゲーム一覧
              </button>
              <span className={saved ? 'save-state' : 'save-state warning'}>
                {saved ? '● この端末に自動保存' : '保存できません。画面を閉じると進行を失います。'}
              </span>
            </div>
            <div className="play-heading">
              <div>
                <p className="eyebrow">{game.setting}</p>
                <h1 className="play-title">{game.title}</h1>
              </div>
              <span className="mode-badge">{game.modes[run.mode].label}</span>
            </div>
            <section className="metrics" aria-label="現在の状況">
              {metricKeys.map((key) => (
                <div className="metric" key={key}>
                  <span>{game.metrics[key].label}</span>
                  <strong data-testid={`metric-${key}`}>
                    {numbers.format(run.stats[key])}
                    <small>{game.metrics[key].unit}</small>
                  </strong>
                  <div className="meter">
                    <i
                      style={{
                        width: `${((run.stats[key] - game.metrics[key].min) / (game.metrics[key].max - game.metrics[key].min)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
            <div className="progress-row">
              <span>
                {run.phase === 'finished' ? 'あなたが育てた未来' : `${run.turn}年目の決断`}
              </span>
              <span>
                {run.turn} / {total}
              </span>
            </div>
            <progress
              aria-label="ゲームの進行"
              value={run.phase === 'finished' ? total : run.turn - 1}
              max={total}
            />

            {event && (
              <section className="decision-panel" aria-labelledby="decision-title">
                <div className="event-label">
                  <span>LETTER {String(run.turn).padStart(2, '0')}</span>
                  <span>{event.category}</span>
                </div>
                <h2 ref={heading} tabIndex={-1} id="decision-title">
                  {event.title}
                </h2>
                <p className="event-body">{event.body}</p>
                <div className="choices">
                  {event.choices.map((choice, i) => (
                    <button
                      key={choice.id}
                      className="choice"
                      data-choice={choice.id}
                      disabled={!canAfford(run, choice)}
                      onClick={() => setRun(decide(game, run, choice.id))}
                    >
                      <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="choice-content">
                        <span className="choice-tag">{strategyNames[choice.strategy]}</span>
                        <strong>{choice.label}</strong>
                        <span>{choice.description}</span>
                        <EffectsList
                          game={game}
                          effects={previewChoice(game, run, choice).effects}
                        />
                        {previewChoice(game, run, choice).repeated && (
                          <small className="delayed-note">
                            同じ方針が続くため効果を調整済み。満足に追加で−
                            {game.repetition.satisfactionCost}
                          </small>
                        )}
                        {choice.delayed && (
                          <small className="delayed-note">
                            ↳ {choice.delayed.after}年後にも変化があります
                          </small>
                        )}
                        {!canAfford(run, choice) && <small>今は必要な資金・状態が足りません</small>}
                      </span>
                      <span className="choice-arrow">↗</span>
                    </button>
                  ))}
                </div>
                <p className="panel-footnote">
                  表示は選択による直接の変化。年末には通常運営と相場の変化も反映されます。
                </p>
              </section>
            )}

            {run.phase === 'report' && run.report && (
              <section className="report-panel" aria-labelledby="report-title">
                <p className="eyebrow">A YEAR IN YOUR WORLD</p>
                <h2 id="report-title" ref={heading} tabIndex={-1}>
                  小さな決断が、景色を変えた。
                </h2>
                <p className="event-body">{run.report.outcome}</p>
                {run.report.repeated && (
                  <p className="notice warning" role="note">
                    同じ方針が続いています。今回のプラス効果は{game.repetition.factor * 100}
                    %になり、満足がさらに{game.repetition.satisfactionCost}
                    下がりました。別の視点も試してみましょう。
                  </p>
                )}
                {run.report.delayed.map((text) => (
                  <p className="delayed-message" key={text}>
                    ↳ {text}
                  </p>
                ))}
                <div className="report-deltas">
                  {metricKeys.map((key) => {
                    const diff = Math.round((run.stats[key] - run.report!.before[key]) * 100) / 100;
                    return (
                      <div key={key}>
                        <span>{game.metrics[key].label}</span>
                        <strong className={diff < 0 ? 'negative' : ''}>
                          {diff > 0 ? '+' : ''}
                          {numbers.format(diff)}
                          <small>{game.metrics[key].unit}</small>
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <p className="panel-footnote">
                  選択・通常運営・過去の投資・相場を含む、この1年の変化です。
                  <br />
                  相場による{game.metrics[game.market.metric].label}の変化：
                  {run.report.market > 0 ? '+' : ''}
                  {run.report.market}
                  {game.metrics[game.market.metric].unit}
                </p>
                {run.endReason && <p className="notice">{run.endReason}</p>}
                <button className="primary" onClick={() => setRun(advance(game, run))}>
                  {run.endReason || run.turn === total ? '育てた未来と診断を見る' : '次の相談へ'}{' '}
                  <span>→</span>
                </button>
              </section>
            )}

            {run.phase === 'finished' && result && (
              <section className="result-panel" aria-labelledby="result-title">
                <div className="result-scene">
                  <Scene theme={game.theme} small />
                  <span className="result-score">
                    {score(game, run)}
                    <small>未来スコア / 100</small>
                  </span>
                </div>
                <p className="eyebrow">YOUR WAY OF BUILDING A FUTURE</p>
                <p>{run.history.length}回の決断で見えた、あなたらしさ。</p>
                <h2 id="result-title" ref={heading} tabIndex={-1}>
                  {result.title}
                </h2>
                <p className="diagnosis-body">{result.body}</p>
                {run.endReason && <p className="notice">{run.endReason}</p>}
                <div className="strategy-bars">
                  {strategyKeys.map((key) => (
                    <div key={key}>
                      <span>{strategyNames[key]}</span>
                      <progress
                        max={Math.max(1, run.history.length)}
                        value={result.counts[key]}
                        aria-label={strategyNames[key]}
                      />
                      <b>{result.counts[key]}回</b>
                    </div>
                  ))}
                </div>
                <p className="panel-footnote">
                  診断は実際に選んだ方針から作る、娯楽のための振り返りです。相場の運や最終資産は診断に含めません。心理検査ではありません。
                </p>
                {run.pending.length > 0 && (
                  <p className="panel-footnote">
                    まだ効果が現れていない投資が{run.pending.length}
                    件あります。結果の数値には含めていません。
                  </p>
                )}
                <details className="history">
                  <summary>あなたの決断を振り返る</summary>
                  <ol>
                    {run.history.map((item) => (
                      <li key={item.turn}>
                        <span>
                          {item.turn}年目 · {item.eventTitle}
                        </span>
                        <strong>{item.choiceLabel}</strong>
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="share-actions">
                  <button className="primary" onClick={() => void share(true)}>
                    結果を共有する ↗
                  </button>
                  <button className="secondary" onClick={() => void share(false)}>
                    テキストをコピー
                  </button>
                </div>
                <label className="share-text">
                  共有テキスト
                  <textarea
                    readOnly
                    value={shareText(game, run, window.location.origin)}
                    rows={5}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    setScreen('home');
                    setNotice('');
                  }}
                >
                  別の未来をつくる →
                </button>
              </section>
            )}

            <details className="in-game-guide">
              <summary>遊び方・このゲームについて</summary>
              <p>
                毎年の相談に答えて未来を育てます。運営資金が0、または満足が10以下になると途中で引き継ぎとなります。繰り返しの方針はプラス効果が小さくなります。相場はランダムですが、読み込み直しても変わりません。
              </p>
              <p>
                途中経過はこのブラウザに自動保存。ブラウザのデータを消すと失われます。別の端末や以前の公開サイトからは自動で移りません。
              </p>
            </details>
          </>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!saved && screen === 'home' && (
          <p className="notice warning" role="alert">
            保存できていません。画面を閉じると進行を失います。
          </p>
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          SMALL WORLDS <span>·</span> 小さく遊ぶ。未来を育てる。
        </span>
        <p>
          登録不要・プレイデータはこの端末だけに保存。個人情報の入力やアクセス解析はありません。
        </p>
        <p>
          新作は架空の設定です。<a href="/legacy/">既存の「タワマン理事長！」はこちら ↗</a>
        </p>
      </footer>
    </div>
  );
}
