import type { GameDefinition } from '../core/schema';

export function Scene({
  theme,
  small = false,
}: {
  theme: GameDefinition['theme'];
  small?: boolean;
}) {
  return (
    <div className={`scene scene-${theme}${small ? ' scene-small' : ''}`} aria-hidden="true">
      <div className="scene-sun" />
      <div className="scene-cloud cloud-one" />
      <div className="scene-cloud cloud-two" />
      <div className="scene-hill hill-back" />
      <div className="scene-hill hill-front" />
      <div className="skyline">
        {(theme === 'tower' ? [5, 8, 11, 6, 4] : [2, 3, 4, 2, 3]).map((floors, i) => (
          <div
            className={`building building-${i}`}
            key={i}
            style={{ height: `${floors * (small ? 8 : 13)}px` }}
          >
            {Array.from({ length: floors * 3 }, (_, j) => (
              <i className={j % 4 === 0 ? 'lit' : ''} key={j} />
            ))}
          </div>
        ))}
        <div className="tree tree-one" />
        <div className="tree tree-two" />
      </div>
      <div className="scene-ground" />
      <span className="scene-caption">YOUR LITTLE WORLD</span>
    </div>
  );
}
