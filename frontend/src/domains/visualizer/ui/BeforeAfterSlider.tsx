import { useState, useRef, useCallback } from 'react';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterCanvas: HTMLCanvasElement | null;
  width: number;
  height: number;
}

export function BeforeAfterSlider({
  beforeSrc,
  afterCanvas,
  width,
  height,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updatePosition = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setPosition(pct);
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true;
      updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingRef.current) updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const afterDataUrl = afterCanvas?.toDataURL('image/jpeg', 0.85);

  return (
    <div
      ref={containerRef}
      data-testid="before-after-slider"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        borderRadius: 20,
        cursor: 'ew-resize',
        userSelect: 'none',
      }}
    >
      {/* Before (full) */}
      <img
        src={beforeSrc}
        alt="До"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* After (clipped) */}
      {afterDataUrl && (
        <img
          src={afterDataUrl}
          alt="После"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            clipPath: `inset(0 ${100 - position}% 0 0)`,
          }}
        />
      )}

      {/* Slider line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${position}%`,
          width: 3,
          background: '#FFFFFF',
          boxShadow: '0 0 6px rgba(0,0,0,0.3)',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        {/* Handle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: '#1d1d1f',
            fontWeight: 600,
          }}
        >
          ⟷
        </div>
      </div>

      {/* Labels */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          background: 'rgba(0,0,0,0.5)',
          color: '#FFF',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        До
      </div>
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(0,113,227,0.8)',
          color: '#FFF',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        После
      </div>
    </div>
  );
}
