import { useState, useRef, useCallback } from 'react';

interface ImageBeforeAfterProps {
  beforeSrc: string;
  afterSrc: string;
  height?: number;
  borderRadius?: number;
}

export function ImageBeforeAfter({
  beforeSrc,
  afterSrc,
  height = 280,
  borderRadius = 16,
}: ImageBeforeAfterProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingRef.current) updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius,
        overflow: 'hidden',
        cursor: 'ew-resize',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* After (full) */}
      <img
        src={afterSrc}
        alt="После"
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {/* Before (clipped) */}
      <img
        src={beforeSrc}
        alt="До"
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
      />
      {/* Divider */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${position}%`,
          width: 3,
          background: '#fff',
          transform: 'translateX(-50%)',
          boxShadow: '0 0 6px rgba(0,0,0,0.3)',
          zIndex: 2,
        }}
      />
      {/* Handle */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${position}%`,
          transform: 'translate(-50%, -50%)',
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
          fontSize: 14,
          color: '#6B7280',
          fontWeight: 600,
        }}
      >
        ↔
      </div>
      {/* Labels */}
      <span
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          padding: '2px 10px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          zIndex: 4,
        }}
      >
        До
      </span>
      <span
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          padding: '2px 10px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          zIndex: 4,
        }}
      >
        После
      </span>
    </div>
  );
}
