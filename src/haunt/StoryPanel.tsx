import { currentStory, storyConfig, storyIds } from './story';
import type { SurvivalRun } from './survival';
export function StoryPanel({
  run,
  onRead,
  canRead,
}: {
  run: SurvivalRun;
  onRead: () => void;
  canRead: boolean;
}) {
  const beat = currentStory(run);
  return (
    <section className="echo-story" aria-label="この館の物語" data-story={beat.id}>
      <div className="echo-story-heading">
        <span>{beat.title}</span>
        {canRead && (
          <button onClick={onRead} aria-label="この場面の声を聞く">
            声を聞く ▷
          </button>
        )}
      </div>
      <p className="echo-story-line">
        <small>{beat.speaker}</small>
        {beat.line}
      </p>
      <p className="echo-story-meaning">{beat.meaning}</p>
      <details>
        <summary>ここまでの物語</summary>
        <p>{storyConfig.premise}</p>
        {storyIds(run).map((id) => (
          <article key={id}>
            <strong>{storyConfig.beats[id].title}</strong>
            <p>{storyConfig.beats[id].line}</p>
            <p>{storyConfig.beats[id].meaning}</p>
          </article>
        ))}
      </details>
    </section>
  );
}
