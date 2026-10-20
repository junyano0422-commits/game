import { hauntConfig } from './config';
import { objective } from './story';
import { nightLimits, travelReason, omen } from './survival';
import type { SurvivalCommand, SurvivalRun } from './survival';
export function TravelPrompt({
  run,
  cautious,
  onCautious,
  onCommand,
}: {
  run: SurvivalRun;
  cautious: boolean;
  onCautious: (value: boolean) => void;
  onCommand: (command: SurvivalCommand) => void;
}) {
  const goal = objective(run);
  const next = goal.next;
  return (
    <section className="echo-travel-prompt" aria-label="今の目的">
      <p>
        <small>今の目的 {goal.progress + 1}/5</small>
        {goal.text}
      </p>
      <div className="echo-travel-row">
        {next && (
          <button
            disabled={!!travelReason(run, next)}
            onClick={() =>
              onCommand(
                cautious
                  ? { kind: 'move', room: next, pace: 'quiet' }
                  : { kind: 'move', room: next },
              )
            }
          >
            {hauntConfig.rooms.find((room) => room.id === next)!.name}へ進む →
            <small>
              {cautious ? '2手・電池1' : '1手'}
              {omen(run).id === 'steps' && !run.passage ? ' / 足音に注意' : ''}
            </small>
          </button>
        )}
        <label className="echo-quiet-travel">
          <input
            type="checkbox"
            checked={cautious}
            disabled={run.battery < 1 || nightLimits(run).turns - run.turn < 2}
            onChange={(event) => onCautious(event.target.checked)}
          />
          <span>
            慎重に移動<small>2手・電池1・追跡を避ける</small>
          </span>
        </label>
      </div>
    </section>
  );
}
