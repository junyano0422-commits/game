import { useEffect, useRef, useState } from 'react';
import { stallConfig as config } from './config';
import type { StallMode } from './config';
import {
  actStall,
  createStall,
  decodeStall,
  encodeStall,
  evening,
  quality,
  stallDiagnosis,
  stallSaveKey,
  stallShare,
} from './engine';
import type { Action, Pan } from './engine';
import './stall.css';

function readInitial() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(stallSaveKey);
    return { run: raw ? decodeStall(raw) : null, hasRaw: !!raw, error: '' };
  } catch {
    return {
      run: null,
      hasRaw: !!raw,
      error: raw
        ? '保存データを読み込めません。新しく始める場合だけ上書きします。'
        : '保存を利用できませんが、このまま遊べます。',
    };
  }
}
const gradeName = {
  raw: 'もう少し焼こう',
  burnt: '焦げちゃった',
  perfect: '両面こんがり！',
  good: '焼き上がり',
};
function Rice({ pan }: { pan: Pan }) {
  const heat = pan.heat[pan.side];
  return (
    <span
      className={`stall-rice ${pan.stage === 'empty' ? 'empty' : ''} ${heat >= 90 ? 'burnt' : heat >= 42 ? 'toasted' : ''}`}
      aria-hidden="true"
    >
      <span className="stall-rice-grain">· · ·</span>
      <span className="stall-nori">▰</span>
      {pan.stage === 'plated' && (
        <i style={{ background: config.flavors.find((f) => f.id === pan.flavor)!.color }} />
      )}
    </span>
  );
}
export function StallGame({ onExit }: { onExit: () => void }) {
  const [initial] = useState(readInitial);
  const [run, setRun] = useState(initial.run);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<StallMode>('story');
  const [panIndex, setPanIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState(initial.error);
  const [saveError, setSaveError] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const phaseHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const title = document.title;
    document.title = '夜空のおにぎり屋台 — こんがり、小さなお店を育てよう';
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!playing || !run || run.phase !== 'night' || paused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden)
        setRun((prev) =>
          prev && prev.phase === 'night' ? actStall(prev, { kind: 'tick', count: 1 }) : prev,
        );
    }, config.tickMs);
    return () => window.clearInterval(timer);
  }, [playing, run?.phase, run?.night, paused]);
  useEffect(() => {
    if (!run) return;
    try {
      localStorage.setItem(stallSaveKey, encodeStall(run));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [run]);
  useEffect(() => {
    if (playing && run?.phase !== 'night') {
      phaseHeading.current?.focus();
      window.scrollTo(0, 0);
    }
  }, [playing, run?.phase]);
  function start() {
    if (
      (run || initial.hasRaw) &&
      !window.confirm('前の屋台の記録を上書きして、新しく始めますか？')
    )
      return;
    setRun(createStall(Math.floor(Math.random() * 0xfffffffe) + 1, mode));
    setPlaying(true);
    setPaused(false);
    setPanIndex(0);
    setNotice('');
    setShareOpen(false);
  }
  function act(action: Action) {
    if (paused) return;
    setRun((prev) => (prev ? actStall(prev, action) : prev));
  }
  const selected = run?.pans[panIndex] ?? run?.pans[0];
  const diagnosis = run ? stallDiagnosis(run) : null;
  const share = run ? stallShare(run, window.location.href) : '';
  return (
    <main className={`stall-app ${playing ? 'stall-active' : ''}`}>
      <div className="stall-stars" aria-hidden="true">
        ✧ ·　　　　　✦　　　·　✧
      </div>
      <header className="stall-nav">
        <button
          onClick={() => {
            setPlaying(false);
            setPaused(true);
            onExit();
          }}
        >
          ← ゲーム一覧
        </button>
        <span>HOSHIZORA / 夜のおいしい寄り道</span>
      </header>
      {!playing || !run ? (
        <section className="stall-home">
          <p className="stall-eyebrow">焼き色を見て、ひっくり返す。</p>
          <h1>
            夜空の
            <br />
            <em>おにぎり屋台</em>
          </h1>
          <p className="stall-lead">
            じゅう、ぱりっ。
            <br />
            あなたの一皿が、だれかの夜をあたためる。
          </p>
          <div className="stall-shop" aria-hidden="true">
            <div className="stall-roof">お　に　ぎ　り</div>
            <div className="stall-curtain">
              <span>こ</span>
              <span>ん</span>
              <span>が</span>
              <span>り</span>
            </div>
            <div className="stall-shop-front">
              <b>🏮</b>
              <span>🍙　🍙　🍙</span>
              <b>🏮</b>
            </div>
            <div className="stall-counter">OPEN AFTER SUNSET</div>
          </div>
          <div className="stall-home-card">
            <h2>今夜、のれんを出してみよう。</h2>
            <ol className="stall-guide">
              <li>
                <b>1</b>
                <span>焼き台をタップして、おにぎりを置く</span>
              </li>
              <li>
                <b>2</b>
                <span>
                  焼き加減が<span className="stall-green">緑</span>になったら裏返す。両面焼いて皿へ
                </span>
              </li>
              <li>
                <b>3</b>
                <span>注文と同じ味をつけ、お客さんに出す</span>
              </li>
            </ol>
            <p className="stall-hint">皿に取れば焦げません。忙しいときは「一時停止」でひと休み。</p>
            <fieldset className="stall-modes">
              <legend>遊ぶ長さ</legend>
              {Object.entries(config.modes).map(([id, item]) => (
                <label key={id} className={mode === id ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="stall-mode"
                    checked={mode === id}
                    onChange={() => setMode(id as StallMode)}
                  />
                  <strong>{item.label}</strong>
                  <small>
                    {id === 'quick' ? '約1分 / まず焼いてみる' : '約3〜5分 / 設備と常連さん'}
                  </small>
                </label>
              ))}
            </fieldset>
            {run && (
              <button
                className="stall-primary"
                onClick={() => {
                  setPlaying(true);
                  setPaused(false);
                  setPanIndex(0);
                }}
              >
                {run.phase === 'result' ? '前の屋台の結果を見る' : '保存した屋台の続きから'}
              </button>
            )}
            <button className={run ? 'stall-secondary' : 'stall-primary'} onClick={start}>
              {run ? '新しい屋台をはじめる' : 'のれんを出す'}
            </button>
            {(notice || saveError) && (
              <p role="alert">
                {notice || 'このブラウザでは保存できません。画面を閉じずに遊んでください。'}
              </p>
            )}
            <small className="stall-privacy">
              登録なし・個人情報の入力なし。記録はこのブラウザだけに保存します。
            </small>
          </div>
        </section>
      ) : (
        <>
          <div className="stall-game-title">
            <div>
              <p className="stall-eyebrow">
                第{run.night}夜 / {config.modes[run.mode].nights}夜
              </p>
              <h1>夜空のおにぎり屋台</h1>
            </div>
            {run.phase === 'night' && (
              <button className="stall-pause" onClick={() => setPaused(true)}>
                Ⅱ 一時停止
              </button>
            )}
          </div>
          <div className="stall-stats">
            <div>
              <small>屋台のお財布</small>
              <b>
                {run.cash}
                <small>円</small>
              </b>
            </div>
            <div>
              <small>おいしい笑顔</small>
              <b>
                {run.served}
                <small>人</small>
              </b>
            </div>
            <div>
              <small>大成功</small>
              <b>
                {run.perfect}
                <small>皿</small>
              </b>
            </div>
          </div>
          {saveError && (
            <p className="stall-alert" role="alert">
              保存できません。画面を閉じると進行が失われます。
            </p>
          )}
          {run.phase === 'night' ? (
            <>
              <section className="stall-evening">
                <span>✦ {evening(run).title}</span>
                <small>
                  {Math.ceil(Math.max(0, config.modes[run.mode].closing - run.ticks) / 5)}秒で閉店 /
                  残りのお米 {run.stock}個
                </small>
                <p>{evening(run).description}</p>
              </section>
              <section className="stall-customers" aria-labelledby="stall-orders-title">
                <div className="stall-section-heading">
                  <h2 id="stall-orders-title">いらっしゃいませ</h2>
                  <small>
                    来店 {run.spawned}/{config.modes[run.mode].guests}組
                  </small>
                </div>
                <div className="stall-order-list">
                  {run.orders.length ? (
                    run.orders.map((order) => {
                      const guest = config.guests[order.guest]!;
                      const flavor = config.flavors.find((f) => f.id === order.flavor)!;
                      return (
                        <article className="stall-order" key={order.id} data-order={order.id}>
                          <span className="stall-guest" aria-hidden="true">
                            {guest.icon}
                          </span>
                          <div className="stall-order-detail">
                            <small>{order.regular ? '♡ また来てくれた常連さん' : guest.name}</small>
                            <strong>
                              {flavor.icon} {flavor.name}、ひとつ！
                            </strong>
                            <div
                              className="stall-patience"
                              role="meter"
                              aria-label={`${guest.name}の待ち時間`}
                              aria-valuemin={0}
                              aria-valuemax={order.maxPatience}
                              aria-valuenow={order.patience}
                            >
                              <span
                                style={{
                                  width: `${(order.patience / order.maxPatience) * 100}%`,
                                  background: order.patience < 30 ? '#d65d49' : undefined,
                                }}
                              />
                            </div>
                          </div>
                          <button
                            className="stall-serve"
                            disabled={paused || selected?.stage !== 'plated'}
                            onClick={() => act({ kind: 'serve', pan: panIndex, order: order.id })}
                            aria-label={`${flavor.name}の注文に出す`}
                          >
                            出す<span>→</span>
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <p className="stall-empty-orders">
                      夜風にのって、次のお客さんがやってきます。
                      <br />
                      先に焼いて、お皿で待ってもOK。
                    </p>
                  )}
                </div>
              </section>
              <section className="stall-kitchen" aria-labelledby="stall-kitchen-title">
                <div className="stall-awning" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="stall-section-heading">
                  <h2 id="stall-kitchen-title">こんがり焼き台</h2>
                  <small>
                    {run.combo > 1
                      ? `✧ ${run.combo}連続のおいしい笑顔`
                      : '緑の焼き加減が、おいしい合図'}
                  </small>
                </div>
                <div
                  className="stall-pan-grid"
                  style={{ gridTemplateColumns: `repeat(${run.pans.length},minmax(0,1fr))` }}
                >
                  {run.pans.map((pan, index) => (
                    <button
                      key={index}
                      className={`stall-pan ${index === panIndex ? 'selected' : ''}`}
                      aria-pressed={index === panIndex}
                      aria-label={`焼き台${index + 1}${pan.stage === 'empty' ? 'におにぎりを置く' : 'を選ぶ'}`}
                      disabled={paused}
                      onClick={() => {
                        setPanIndex(index);
                        if (pan.stage === 'empty' && run.stock > 0)
                          act({ kind: 'start', pan: index });
                      }}
                    >
                      <span className="stall-pan-label">
                        {index + 1}番{' '}
                        {pan.stage === 'empty'
                          ? '空いています'
                          : pan.stage === 'plated'
                            ? 'お皿で待機'
                            : `${pan.side === 0 ? 'おもて' : 'うら'}を焼いています`}
                      </span>
                      <span className="stall-grill-art">
                        <Rice pan={pan} />
                        {pan.stage === 'cooking' && <span className="stall-steam">〰 〰</span>}
                      </span>
                      {pan.stage === 'empty' ? (
                        <span className="stall-pan-help">＋ お米を置く</span>
                      ) : (
                        <>
                          <span className="stall-heat" aria-hidden="true">
                            <i />
                            <span style={{ left: `${pan.heat[pan.side]}%` }} />
                          </span>
                          <span className="stall-pan-help">
                            {pan.stage === 'plated'
                              ? `${config.flavors.find((f) => f.id === pan.flavor)!.name} / ${gradeName[quality(pan)]}`
                              : pan.heat[pan.side] >= 90
                                ? '焦げてきた！'
                                : pan.heat[pan.side] >= 42 && pan.heat[pan.side] <= 69
                                  ? '今がこんがり！'
                                  : pan.heat[pan.side] < 42
                                    ? 'じゅう…焼いています'
                                    : '焼けすぎ注意！'}
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <div className="stall-controls">
                  {selected?.stage === 'cooking' ? (
                    <>
                      <div className="stall-side-status">
                        <span>
                          おもて{' '}
                          {selected.heat[0] >= 90
                            ? '焦げ'
                            : selected.heat[0] >= 42
                              ? '焼き色あり'
                              : '焼き途中'}
                        </span>
                        <span>
                          うら{' '}
                          {selected.heat[1] >= 90
                            ? '焦げ'
                            : selected.heat[1] >= 42
                              ? '焼き色あり'
                              : '焼き途中'}
                        </span>
                      </div>
                      <button
                        className="stall-primary"
                        disabled={paused}
                        onClick={() =>
                          act({ kind: selected.side === 0 ? 'flip' : 'plate', pan: panIndex })
                        }
                      >
                        {selected.side === 0 ? 'くるっ！ 裏返す' : '火から下ろして、お皿へ'}
                        <span>
                          {selected.heat[selected.side] >= 42 && selected.heat[selected.side] <= 69
                            ? '今がいい焼き色！'
                            : '両面とも緑を狙おう'}
                        </span>
                      </button>
                    </>
                  ) : selected?.stage === 'plated' ? (
                    <>
                      <p className="stall-flavor-label">
                        {panIndex + 1}番のお皿に味つけ <small>注文と同じ色を選ぼう</small>
                      </p>
                      <div className="stall-flavors" role="group" aria-label="おにぎりの味">
                        {config.flavors.map((flavor) => (
                          <button
                            key={flavor.id}
                            disabled={paused}
                            aria-pressed={selected.flavor === flavor.id}
                            className={selected.flavor === flavor.id ? 'selected' : ''}
                            onClick={() =>
                              act({ kind: 'flavor', pan: panIndex, flavor: flavor.id })
                            }
                          >
                            {flavor.icon}
                            <strong>{flavor.name}</strong>
                          </button>
                        ))}
                      </div>
                      <p className="stall-hint">
                        ↑ 注文の「出す」をタップすると、このお皿を渡します。
                      </p>
                    </>
                  ) : (
                    <p className="stall-kitchen-tip">
                      焼き台をタップして、お米を置こう。
                      <br />
                      もう一方の焼き台でも同時に焼けます。
                    </p>
                  )}
                  {selected?.stage !== 'empty' && (
                    <button
                      className="stall-discard"
                      disabled={paused}
                      onClick={() => act({ kind: 'discard', pan: panIndex })}
                    >
                      このおにぎりを作り直す
                    </button>
                  )}
                </div>
              </section>
              <p className="stall-feedback" role="status">
                {run.message}
              </p>
              {paused && (
                <div className="stall-pause-backdrop">
                  <section
                    className="stall-pause-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="stall-pause-title"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setPaused(false);
                      if (event.key === 'Tab') {
                        const buttons = event.currentTarget.querySelectorAll('button');
                        const first = buttons[0];
                        const last = buttons[buttons.length - 1];
                        if (event.shiftKey && document.activeElement === first) {
                          event.preventDefault();
                          last?.focus();
                        } else if (!event.shiftKey && document.activeElement === last) {
                          event.preventDefault();
                          first?.focus();
                        }
                      }
                    }}
                  >
                    <span aria-hidden="true">🍵</span>
                    <h2 id="stall-pause-title">屋台も、ひと休み。</h2>
                    <p>
                      火と待ち時間は止まっています。
                      <br />
                      {saveError
                        ? '保存できないため、この画面のまま再開してください。'
                        : '閉じても、この状態から再開できます。'}
                    </p>
                    <button autoFocus className="stall-primary" onClick={() => setPaused(false)}>
                      営業を再開する
                    </button>
                    <button className="stall-secondary" onClick={() => setPlaying(false)}>
                      中断してタイトルへ
                    </button>
                  </section>
                </div>
              )}
            </>
          ) : run.phase === 'upgrade' ? (
            <section className="stall-between">
              <p className="stall-eyebrow">CLOSED / おつかれさまでした</p>
              <h2 ref={phaseHeading} tabIndex={-1}>
                次の夜は、どんな屋台に？
              </h2>
              <p>
                これまでのお財布 {run.cash}円。
                <br />
                設備は次の夜からずっと使えます。
              </p>
              <div className="stall-upgrades">
                {config.upgrades.map((item) => (
                  <button
                    key={item.id}
                    disabled={run.upgrades.includes(item.id) || run.cash < item.cost}
                    onClick={() => {
                      setPaused(false);
                      setPanIndex(0);
                      setRun(actStall(run, { kind: 'upgrade', id: item.id }));
                    }}
                  >
                    <span>{item.icon}</span>
                    <strong>
                      {item.name}
                      <small>{item.cost}円</small>
                    </strong>
                    <p>{item.description}</p>
                    <b>
                      {run.upgrades.includes(item.id)
                        ? '購入済み'
                        : run.cash < item.cost
                          ? 'お金がもう少し必要'
                          : '購入して次の夜へ →'}
                    </b>
                  </button>
                ))}
              </div>
              <button
                className="stall-secondary"
                onClick={() => {
                  setPaused(false);
                  setPanIndex(0);
                  setRun(actStall(run, { kind: 'upgrade', id: null }));
                }}
              >
                今の設備で、次の夜へ
              </button>
            </section>
          ) : (
            <section className="stall-result">
              <p className="stall-eyebrow">あなたの屋台の、ちいさな評判</p>
              <span className="stall-result-rice" aria-hidden="true">
                🍙
              </span>
              <h2 ref={phaseHeading} tabIndex={-1}>
                {diagnosis!.title}
              </h2>
              <p className="stall-result-stars" aria-label={`評判 ${diagnosis!.stars}つ星`}>
                {'★'.repeat(diagnosis!.stars)}
                {'☆'.repeat(5 - diagnosis!.stars)}
              </p>
              <p>{diagnosis!.body}</p>
              <div className="stall-result-data">
                <span>
                  最高の連続提供 <b>{run.bestCombo}組</b>
                </span>
                <span>
                  出会ったお客さん <b>{run.served + run.missed}組</b>
                </span>
                <span>
                  育てた設備 <b>{run.upgrades.length}つ</b>
                </span>
              </div>
              <blockquote>
                {run.served
                  ? '「今度は友だちも連れてくるね」\n明日もまた、のれんの向こうに笑顔が待っています。'
                  : '最初の夜は練習。次はひとつずつ、両面の緑を見守ってみよう。'}
              </blockquote>
              <button
                className="stall-primary"
                onClick={async () => {
                  setShareOpen(true);
                  setShareNotice('');
                  try {
                    if (navigator.share) await navigator.share({ text: share });
                    else if (navigator.clipboard) {
                      await navigator.clipboard.writeText(share);
                      setShareNotice('結果をコピーしました。');
                    }
                  } catch (error) {
                    if (!(error instanceof DOMException && error.name === 'AbortError'))
                      setShareNotice('下の文章を選択して共有できます。');
                  }
                }}
              >
                屋台の評判を共有する
              </button>
              {shareOpen && (
                <>
                  <textarea aria-label="共有する屋台の結果" readOnly value={share} />
                  <p role="status">{shareNotice}</p>
                </>
              )}
              <button
                className="stall-secondary"
                onClick={() => {
                  setPlaying(false);
                  setShareOpen(false);
                }}
              >
                次の屋台を考える
              </button>
            </section>
          )}
        </>
      )}
      <footer className="stall-footer">
        炊きたてのごはんと、夜のひと休み。
        <br />
        小さな屋台を、この町の思い出に。
      </footer>
    </main>
  );
}
