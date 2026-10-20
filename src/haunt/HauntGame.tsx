import { useEffect, useRef, useState } from 'react';
import atlasUrl from './assets/nightmares.webp';
import { useHorrorMedia } from './useHorrorMedia';
import { hauntConfig as config } from './config';
import type { ClueRoom, HauntMode, Rune } from './config';
import {
  actSurvival as actHaunt,
  canSeal,
  createSurvival as createHaunt,
  decodeSurvival as decodeHaunt,
  encodeSurvival as encodeHaunt,
  survivalDiagnosis as hauntDiagnosis,
  hauntSaveKey,
  survivalShare as hauntShare,
  omen,
  puzzle,
  isRevised,
  fragments,
  apparition,
  isSurvival,
  nightLimits,
  travelReason,
  survivalRestHint,
  hunterClose,
} from './survival';
import { restHint } from './revised';
import { SurvivalPanel, SurvivalTracker } from './SurvivalPanel';
import { survivalConfig } from './survival-config';
import { revisionConfig } from './revision-config';
import type { SurvivalCommand } from './survival';
import './haunt.css';
function load() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(hauntSaveKey);
    return { run: raw ? decodeHaunt(raw) : null, error: '', hasRaw: !!raw };
  } catch {
    return {
      run: null,
      error: raw
        ? '記録を読み込めません。新規開始まで上書きしません。'
        : '保存を利用できません。この画面を閉じずに遊んでください。',
      hasRaw: !!raw,
    };
  }
}
function SceneArt({ scene }: { scene: string }) {
  return (
    <div className={`echo-art echo-art-${scene}`} aria-hidden="true">
      <img className="echo-atlas-image" src={atlasUrl} alt="" />
    </div>
  );
}
function Figure() {
  return (
    <svg viewBox="0 0 160 290" focusable="false">
      <path
        d="M60 95 Q38 132 24 218 L15 243 29 247 53 193 43 285 125 285 112 185 140 243 151 236 133 180 109 101Z"
        fill="#d9dcd3"
      />
      <path
        d="M49 63 Q43 6 83 5 Q126 10 119 68 L126 157 105 148 96 64 90 171 75 150 68 75 59 160 43 154Z"
        fill="#090b0e"
      />
      <path d="M75 46 Q83 40 95 49 L92 71 74 74Z" fill="#c2c6b9" />
      <path d="M68 18 Q85 5 102 22 L89 95 77 78Z" fill="#0c0e10" />
      <path d="M91 57L99 55" stroke="#353d3a" strokeWidth="2" />
      <path
        d="M60 116L57 240M105 125L113 252M83 176L77 272"
        stroke="#9caaa0"
        opacity=".35"
        fill="none"
      />
    </svg>
  );
}
export function HauntGame({ onExit }: { onExit: () => void }) {
  const [initial] = useState(load);
  const [run, setRun] = useState(initial.run);
  const [playing, setPlaying] = useState(false);
  const media = useHorrorMedia(run, playing);
  const [artReady, setArtReady] = useState(false);
  const mediaDialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<HauntMode>('quick');
  const [notice, setNotice] = useState(initial.error);
  const [saveError, setSaveError] = useState(false);
  const [quietTravel, setQuietTravel] = useState(false);
  const [symbols, setSymbols] = useState<Rune[]>([]);
  const [shared, setShared] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const notesDialog = useRef<HTMLDialogElement>(null);
  const gameHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const old = document.title;
    document.title = '零時の残響 — 井戸の向こうに、誰かいる';
    return () => {
      document.title = old;
    };
  }, []);
  useEffect(() => {
    if (!run) return;
    try {
      localStorage.setItem(hauntSaveKey, encodeHaunt(run));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [run]);
  useEffect(() => {
    if (!playing) return;
    if (run?.phase === 'play') gameHeading.current?.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [playing, run?.phase]);
  function start(seed?: number, nextMode: HauntMode = mode) {
    if ((run || initial.hasRaw) && !window.confirm('前の夜の記録を上書きして始めますか？')) return;
    void media.activate();
    setRun(createHaunt(seed ?? Math.floor(Math.random() * 0xfffffffe) + 1, nextMode));
    setPlaying(true);
    setNotice('');
    setSymbols([]);
    setShared(false);
  }
  function act(action: SurvivalCommand) {
    setRun((prev) => (prev ? actHaunt(prev, action) : prev));
    if (action.kind === 'move' || action.kind === 'seal') setSymbols([]);
  }
  const room = config.rooms.find((r) => r.id === run?.room) ?? config.rooms[0];
  const knowledge = run ? puzzle(run) : null;
  const limits = run ? nightLimits(run) : survivalConfig.modes[mode];
  const result = run ? hauntDiagnosis(run) : null;
  const evidence = run ? fragments(run) : null;
  const appearance = run ? apparition(run) : null;
  const searched =
    run &&
    isRevised(run) &&
    (run.room === 'living'
      ? run.orderKnown
      : run.clues.includes(run.room as 'bath' | 'study' | 'well'));
  const cautious = !!(
    quietTravel &&
    run &&
    isSurvival(run) &&
    run.battery > 0 &&
    limits.turns - run.turn >= 2
  );
  const share = run ? hauntShare(run, window.location.href) : '';
  return (
    <main
      className={`echo-app ${playing ? 'echo-playing' : ''} ${run && isSurvival(run) ? 'echo-survival' : ''} ${artReady ? 'echo-illustrated' : ''} ${media.settings.impact ? 'echo-cinematic' : 'echo-restrained'}`}
      data-sound={
        media.ready && media.settings.sound
          ? 'on'
          : media.paused && media.settings.sound
            ? 'paused'
            : 'off'
      }
    >
      <img
        className="echo-art-source"
        src={atlasUrl}
        alt=""
        onLoad={() => setArtReady(true)}
        onError={() => setArtReady(false)}
      />
      <div className="echo-grain" aria-hidden="true" />
      <header className="echo-nav">
        <div className="echo-nav-main">
          <button onClick={onExit}>← ゲーム一覧</button>
          {playing && run && isSurvival(run) && (
            <button className="echo-mobile-pause" onClick={() => setPlaying(false)}>
              中断する
            </button>
          )}
        </div>
        <div className="echo-media-toolbar">
          <button
            className="echo-sound-toggle"
            onClick={media.toggle}
            aria-pressed={media.ready && media.settings.sound}
          >
            {media.ready && media.settings.sound
              ? '消音にする'
              : media.paused && media.settings.sound
                ? '音を再開'
                : '音を入れる'}
          </button>
          <button className="echo-media-settings" onClick={() => mediaDialog.current?.showModal()}>
            音・演出の設定
          </button>
        </div>
      </header>
      {!playing || !run ? (
        <section className="echo-home">
          <p className="echo-eyebrow">その映像は、まだ終わっていない。</p>
          <h1>
            零時の<span>残響</span>
          </h1>
          <p className="echo-subtitle">ZERO HOUR / ECHOES FROM THE WELL</p>
          <div className="echo-poster" aria-hidden="true">
            <SceneArt scene="portrait" />
            <div className="echo-poster-well" />
            <div className="echo-poster-figure">
              <Figure />
            </div>
            <span>
              午前零時。
              <br />
              消えたテレビが、ひとりでについた。
            </span>
          </div>
          <p className="echo-intro">
            濡れた日記。曇った鏡。鍵のかかった井戸。
            <br />
            三つの印を集め、夜があなたを見つける前に
            <br />
            最後の封印を結んでください。
          </p>
          <div className="echo-home-panel">
            <h2>振り返らずに、調べる。</h2>
            <ol>
              <li>映像と日記に残る、封印の順番の手がかりを集める。</li>
              <li>部屋を移動し、三つの記号を集める。書斎の鍵で井戸へ。</li>
              <li>二つの手がかりから順番を推理し、玄関で印を結ぶ。</li>
            </ol>
            <p>
              1回の行動で1手進みます。現実の時間制限はありません。
              <br />
              ライトは「視線」を防ぎます。足音のときに息をひそめると、気配が遠ざかり次の移動が安全に。足音がないときや連続使用は逆効果です。
            </p>
            <fieldset className="echo-modes">
              <legend>館探索モード / 今夜の猶予</legend>
              {Object.entries(config.modes).map(([id, item]) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="echo-mode"
                    checked={mode === id}
                    onChange={() => setMode(id as HauntMode)}
                  />
                  {item.label}
                  <small>
                    {survivalConfig.modes[id as HauntMode].turns}手 / 電池{item.battery}
                  </small>
                </label>
              ))}
            </fieldset>
            <p className="echo-survival-intro">
              持ち物は4枠。物資を拾い、調合し、部屋をつなぐ近道を開く。居間は追跡者の入れない拠点です。
            </p>
            <label className="echo-sound-choice">
              <input
                type="checkbox"
                checked={media.settings.sound}
                onChange={(event) =>
                  media.update({ ...media.settings, sound: event.target.checked })
                }
              />
              音ありで遊ぶ <small>足音・水滴・ノイズ。対応端末ではささやき声も。</small>
            </label>
            {run && !isSurvival(run) && (
              <p className="echo-classic-note">
                前の記録は、その夜のルールのまま再開します。新しく始めると、持ち物と追跡を加えた館探索モードになります。
              </p>
            )}
            {run && (
              <button
                className="echo-primary"
                onClick={() => {
                  void media.activate();
                  setPlaying(true);
                  setSymbols([]);
                }}
              >
                {run.phase === 'play' ? '記録した夜の続きへ' : '前の夜の結末を見る'}
              </button>
            )}
            <button className={run ? 'echo-secondary' : 'echo-primary'} onClick={() => start()}>
              {run ? '新しい夜をはじめる' : '映像を再生する'}
            </button>
            {(notice || saveError) && (
              <p className="echo-alert" role="alert">
                {notice || '保存できません。画面を閉じずに遊んでください。'}
              </p>
            )}
            <small className="echo-credit">
              貞子をモチーフにした、オリジナルの非公式短編ゲーム。
              <br />
              音声なしで遊べます。記録はこのブラウザに保存します。
            </small>
          </div>
        </section>
      ) : (
        <>
          {media.failed && (
            <p className="echo-media-notice" role="status">
              この端末では音を開始できませんでした。画像と文章で遊べます。
            </p>
          )}
          <div className="echo-game-title">
            <div>
              <p className="echo-eyebrow">THE NIGHT IS WATCHING YOU</p>
              <h1 ref={gameHeading} tabIndex={-1}>
                零時の残響
              </h1>
            </div>
            <button className="echo-home-button" onClick={() => setPlaying(false)}>
              中断する
            </button>
          </div>
          <div className={`echo-stats ${isSurvival(run) ? 'echo-survival-stats' : ''}`}>
            {isSurvival(run) && (
              <div>
                <small>体力</small>
                <strong aria-label={`体力 ${run.health}/3`}>
                  {'♥'.repeat(Math.max(0, run.health))}
                  <span>{run.health}/3</span>
                </strong>
              </div>
            )}
            <div>
              <small>残された猶予</small>
              <strong>
                {Math.max(0, limits.turns - run.turn)}
                <span>手</span>
              </strong>
            </div>
            <div>
              <small>ライトの電池</small>
              <strong>
                {run.battery}
                <span>回</span>
              </strong>
            </div>
            <div>
              <small>集めた印</small>
              <strong>
                {run.clues.length}
                <span>/ 3</span>
              </strong>
            </div>
          </div>
          {saveError && (
            <p className="echo-alert" role="alert">
              保存できません。この画面のまま遊んでください。
            </p>
          )}
          {run.phase === 'play' ? (
            <>
              <section className="echo-pressure" aria-label="迫る気配">
                <div>
                  <span>
                    {run.fear < limits.fear * 0.4
                      ? '遠くに、水音がする。'
                      : run.fear < limits.fear * 0.7
                        ? '廊下に、誰かいる。'
                        : 'すぐ後ろで、髪が擦れる。'}
                  </span>
                  <b>
                    {run.fear} / {limits.fear}
                  </b>
                </div>
                <div
                  className="echo-pressure-meter"
                  role="meter"
                  aria-label="呪いの強さ"
                  aria-valuenow={run.fear}
                  aria-valuemin={0}
                  aria-valuemax={limits.fear}
                >
                  <span style={{ width: `${(run.fear / limits.fear) * 100}%` }} />
                </div>
              </section>
              <nav className="echo-rooms" aria-label="探索する部屋">
                {config.rooms.map((item) => (
                  <button
                    key={item.id}
                    disabled={!!travelReason(run, item.id)}
                    aria-pressed={run.room === item.id}
                    className={run.room === item.id ? 'selected' : ''}
                    onClick={() => {
                      if (run.room !== item.id)
                        act(
                          isSurvival(run) && cautious
                            ? { kind: 'move', room: item.id, pace: 'quiet' }
                            : { kind: 'move', room: item.id },
                        );
                    }}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.name}
                    {travelReason(run, item.id) && <small>{travelReason(run, item.id)}</small>}
                  </button>
                ))}
              </nav>
              {isSurvival(run) && (
                <label className="echo-quiet-travel">
                  <input
                    type="checkbox"
                    checked={cautious}
                    disabled={run.battery < 1 || limits.turns - run.turn < 2}
                    onChange={(event) => setQuietTravel(event.target.checked)}
                  />
                  慎重に移動（2手・電池1・移動音を聞かせない）
                </label>
              )}
              <section
                key={`scene-${run.seed}-${run.turn}`}
                data-apparition={appearance!.id}
                className={`echo-scene ${run.actions.at(-1)?.kind === 'search' ? 'echo-reveal' : ''} echo-scene-${run.room} echo-apparition-${appearance!.id} ${(!isSurvival(run) || run.stun === 0) && (run.fear >= limits.fear * 0.7 || hunterClose(run)) ? 'close' : ''}`}
                aria-label={`${room.name}の様子`}
              >
                <SceneArt scene={run.room} />
                <div className="echo-atmosphere" aria-hidden="true" />
                <div className="echo-intruder" aria-hidden="true">
                  <SceneArt scene="portrait" />
                </div>
                {run.clues.includes(run.room as ClueRoom) && (
                  <span
                    className="echo-found-rune"
                    aria-label={`この部屋の印 ${knowledge!.marks[run.room as ClueRoom]}`}
                  >
                    {knowledge!.marks[run.room as ClueRoom]}
                  </span>
                )}
                <div className="echo-scene-window" aria-hidden="true" />
                {run.room === 'living' ? (
                  <div className={`echo-tv ${!run.tv ? 'off' : ''}`} aria-hidden="true">
                    <div className="echo-tv-screen">
                      <span>◎</span>
                    </div>
                    <i />
                  </div>
                ) : run.room === 'bath' ? (
                  <div className="echo-mirror" aria-hidden="true">
                    <span>{run.clues.includes('bath') ? knowledge!.marks.bath : '？'}</span>
                  </div>
                ) : run.room === 'study' ? (
                  <div className="echo-book" aria-hidden="true">
                    <span>{run.clues.includes('study') ? knowledge!.marks.study : '…'}</span>
                  </div>
                ) : run.room === 'well' ? (
                  <div className="echo-well" aria-hidden="true">
                    <span>{run.clues.includes('well') ? knowledge!.marks.well : ''}</span>
                  </div>
                ) : (
                  <div className="echo-door" aria-hidden="true">
                    <span>○　△　×</span>
                  </div>
                )}
                <div
                  className="echo-presence"
                  style={{ opacity: Math.max(0.05, (run.fear / limits.fear) * 0.8) }}
                  aria-hidden="true"
                >
                  <Figure />
                </div>
                <div className="echo-scene-caption">
                  <small>ROOM / {room.name}</small>
                  <h2>{room.object}</h2>
                  <p>{isRevised(run) ? appearance!.text : room.description}</p>
                </div>
              </section>
              {isSurvival(run) && <SurvivalTracker run={run} />}
              <section className="echo-omen" aria-label="次の危険の予告">
                <span>
                  {run.tv ? '砂嵐からの予告' : '電源を消した部屋の気配'}
                  {isRevised(run) ? ` / ${omen(run).title}` : ''}
                  {isRevised(run) && run.passage ? ' / 次の移動は安全' : ''}
                </span>
                <p>
                  {run.tv
                    ? omen(run).text
                    : isRevised(run)
                      ? revisionConfig.sensory[omen(run).id]
                      : '映像が呼ぶ呪いは止まった。次の危険は見えない。ライトと休息を頼りに進もう。'}
                </p>
              </section>
              <section
                className="echo-feedback"
                key={`feedback-${run.seed}-${run.turn}`}
                aria-label="今回の行動結果"
              >
                <p role="status">{run.message.split('\n')[0]}</p>
                {run.message.includes('\n') && (
                  <details>
                    <summary>行動結果の全文</summary>
                    <p>{run.message}</p>
                  </details>
                )}
              </section>
              <div className="echo-actions">
                {run.room !== 'door' ? (
                  <>
                    <button
                      className="echo-primary"
                      disabled={!!searched || (run.room === 'living' && !run.tv)}
                      onClick={() => act({ kind: 'search', light: false })}
                    >
                      {searched ? '調査済み' : `${room.object}を調べる`}
                      <span>{searched ? '記録は手がかり帳へ' : '1手 / 視線に注意'}</span>
                    </button>
                    <button
                      className="echo-secondary"
                      disabled={!!searched || !run.battery || (run.room === 'living' && !run.tv)}
                      onClick={() => act({ kind: 'search', light: true })}
                    >
                      ライトで調べる<span>1手・電池1 / 視線を防ぐ</span>
                    </button>
                  </>
                ) : (
                  <section className="echo-seal">
                    <h2>最後の封印</h2>
                    {canSeal(run) ? (
                      <>
                        <p>
                          {isRevised(run)
                            ? '二つの手がかりを組み合わせ、各部屋の印を並べる。'
                            : '映像が示した部屋の順に、そこで見つけた印を並べる。'}
                        </p>
                        {evidence && (
                          <div className="echo-seal-evidence">
                            <p>映像：{evidence.video}</p>
                            <p>日記：{evidence.diary}</p>
                            <p>
                              {config.clueRooms
                                .map(
                                  (id) =>
                                    `${config.rooms.find((r) => r.id === id)!.name} ${knowledge!.marks[id]}`,
                                )
                                .join(' ／ ')}
                            </p>
                          </div>
                        )}
                        <div
                          className="echo-seal-slots"
                          aria-label={`並べた印 ${symbols.join(' ') || 'なし'}`}
                        >
                          {[0, 1, 2].map((i) => (
                            <span key={i}>{symbols[i] ?? '―'}</span>
                          ))}
                        </div>
                        <div className="echo-runes" role="group" aria-label="封印の記号">
                          {config.runes.map((mark) => (
                            <button
                              key={mark}
                              disabled={symbols.length === 3}
                              onClick={() => setSymbols((prev) => [...prev, mark])}
                              aria-label={`印 ${mark}`}
                            >
                              {mark}
                            </button>
                          ))}
                        </div>
                        <button
                          className="echo-primary"
                          disabled={symbols.length !== 3}
                          onClick={() => act({ kind: 'seal', symbols })}
                        >
                          封印を結ぶ <span>1手 / 誤ると気配＋4</span>
                        </button>
                        <button className="echo-reset" onClick={() => setSymbols([])}>
                          並べ直す（手数を使いません）
                        </button>
                      </>
                    ) : (
                      <p>映像の順番と、三つの印が必要です。下の手がかり帳を確認してください。</p>
                    )}
                  </section>
                )}
                <button className="echo-secondary echo-wait" onClick={() => act({ kind: 'wait' })}>
                  息をひそめる{' '}
                  <span>{isSurvival(run) ? survivalRestHint(run) : restHint(run)}</span>
                </button>
                {run.room === 'living' && !run.tv && (
                  <button className="echo-unplug" onClick={() => act({ kind: 'plug' })}>
                    テレビの電源を戻す<span>1手 / 予告と映像を再び見る</span>
                  </button>
                )}
                {run.room === 'living' && run.tv && (
                  <button className="echo-unplug" onClick={() => act({ kind: 'unplug' })}>
                    テレビのプラグを抜く
                    <span>
                      {isRevised(run)
                        ? '1手 / 基本増加なし・危険時＋5・記憶の収集を止める'
                        : '1手 / 呪いの増加を止める代わりに、予告を失う'}
                    </span>
                  </button>
                )}
              </div>
              <div
                className={`echo-exploration-tools ${isSurvival(run) ? 'echo-survival-tools' : ''}`}
              >
                {isSurvival(run) && <SurvivalPanel run={run} onCommand={act} />}
                <button
                  className="echo-notebook-button"
                  onClick={() => notesDialog.current?.showModal()}
                >
                  手がかり帳を開く{' '}
                  <span>
                    {run.clues.length}/3
                    {isRevised(run) ? ` ／ 記憶 ${run.remembered.length}/3` : ''}
                  </span>
                </button>
              </div>
              <dialog
                ref={notesDialog}
                className="echo-notes-dialog"
                aria-labelledby="echo-notes-title"
              >
                <button
                  className="echo-notes-close"
                  autoFocus
                  onClick={() => notesDialog.current?.close()}
                >
                  探索に戻る ×
                </button>
                <section className="echo-notes">
                  <h2 id="echo-notes-title">手がかり帳</h2>
                  {evidence ? (
                    <div className="echo-fragments">
                      <p>
                        映像の断片：<b>{evidence.video ?? '未確認。居間の映像を調べる。'}</b>
                      </p>
                      <p>
                        日記の断片：<b>{evidence.diary ?? '未確認。書斎の日記を調べる。'}</b>
                      </p>
                      <p>最後の部屋を決め、残り二つを日記の前後関係で並べよう。</p>
                    </div>
                  ) : (
                    <p>
                      封印の順番：
                      <b>
                        {run.orderKnown
                          ? knowledge!.order
                              .map((id) => config.rooms.find((r) => r.id === id)!.name)
                              .join(' → ')
                          : '未確認。居間の映像を調べる。'}
                      </b>
                    </p>
                  )}
                  <div className="echo-clue-grid">
                    {config.clueRooms.map((id) => (
                      <div key={id}>
                        <small>{config.rooms.find((r) => r.id === id)!.name}</small>
                        <strong>{run.clues.includes(id) ? knowledge!.marks[id] : '？'}</strong>
                      </div>
                    ))}
                  </div>
                  <small>
                    {run.key ? '鍵：入手済み' : '鍵：書斎に手がかり'} /{' '}
                    {run.ward ? '護符：一度だけ視線を防ぐ' : '護符：なし'} /{' '}
                    {run.tv
                      ? 'テレビ点灯中：行動ごとに気配＋1'
                      : 'テレビ消灯中：基本の気配増加なし'}
                  </small>
                  {isRevised(run) && (
                    <div className="echo-memories">
                      <h3>映像と重なった記憶 {run.remembered.length}/3</h3>
                      {run.remembered.length ? (
                        run.remembered.map((id) => <p key={id}>{revisionConfig.memories[id]}</p>)
                      ) : (
                        <p>
                          テレビをつけたまま各部屋を初めて調べると、映像と同じ記憶が見える。呪いの増加と引き換えに、もう一つの結末へつながる。
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </dialog>
              <details className="echo-history">
                <summary>これまでの記録</summary>
                {run.log.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </details>
            </>
          ) : (
            <section className={`echo-result ${run.phase === 'taken' ? 'echo-bad-ending' : ''}`}>
              <p className="echo-eyebrow">
                {run.phase === 'escaped' ? 'DAWN / 夜明け' : 'SHE FOUND YOU'}
              </p>
              {run.phase === 'taken' && (
                <div className="echo-ending-figure" aria-hidden="true">
                  <SceneArt scene="portrait" />
                  <Figure />
                </div>
              )}
              <h2 ref={heading} tabIndex={-1}>
                {result!.title}
              </h2>
              <p className="echo-ending-message">{run.message}</p>
              {run.reason && <p>{run.reason}</p>}
              <p>{result!.body}</p>
              <div className="echo-ending-stats">
                <span>
                  行動 <b>{run.turn}手</b>
                </span>
                <span>
                  集めた印 <b>{run.clues.length}/3</b>
                </span>
                {isSurvival(run) && (
                  <>
                    <span>
                      残り体力 <b>{run.health}/3</b>
                    </span>
                    <span>
                      影との接触 <b>{run.encounters}回</b>
                    </span>
                  </>
                )}
              </div>
              <button
                className="echo-primary"
                onClick={async () => {
                  setShared(true);
                  setShareNotice('');
                  try {
                    if (navigator.share) await navigator.share({ text: share });
                    else if (navigator.clipboard) {
                      await navigator.clipboard.writeText(share);
                      setShareNotice('結末をコピーしました。');
                    }
                  } catch (error) {
                    if (!(error instanceof DOMException && error.name === 'AbortError'))
                      setShareNotice('下の文章を選択して共有できます。');
                  }
                }}
              >
                この夜の結末を共有する
              </button>
              {shared && (
                <>
                  <textarea aria-label="共有する結末" readOnly value={share} />
                  <p role="status">{shareNotice}</p>
                </>
              )}
              <button className="echo-secondary" onClick={() => start(run.seed, run.mode)}>
                同じ夜を、もう一度
              </button>
              <button className="echo-reset" onClick={() => setPlaying(false)}>
                タイトルに戻る
              </button>
            </section>
          )}
        </>
      )}
      <dialog ref={mediaDialog} className="echo-media-dialog" aria-labelledby="echo-media-title">
        <button className="echo-notes-close" autoFocus onClick={() => mediaDialog.current?.close()}>
          ゲームに戻る ×
        </button>
        <h2 id="echo-media-title">音・演出の設定</h2>
        <label>
          <input
            type="checkbox"
            checked={media.settings.sound}
            onChange={(event) => media.update({ ...media.settings, sound: event.target.checked })}
          />
          環境音と効果音
        </label>
        <label className="echo-volume">
          音量 <output>{media.settings.volume}%</output>
          <input
            type="range"
            aria-label="効果音の音量"
            min="0"
            max="100"
            value={media.settings.volume}
            onChange={(event) =>
              media.update({ ...media.settings, volume: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={media.settings.voice}
            onChange={(event) => media.update({ ...media.settings, voice: event.target.checked })}
          />
          ささやき声
        </label>
        <p>端末内に日本語音声がある場合に再生します。声がない端末でも環境音と効果音は使えます。</p>
        <label>
          <input
            type="checkbox"
            checked={media.settings.impact}
            onChange={(event) => media.update({ ...media.settings, impact: event.target.checked })}
          />
          画面の接近・揺れの演出
        </label>
        <p>
          音を消しても、文章と画面の合図で危険を判断できます。別のアプリに移ると音は止まります。
        </p>
      </dialog>
      <footer className="echo-footer">画面の向こうと、目を合わせないで。</footer>
    </main>
  );
}
