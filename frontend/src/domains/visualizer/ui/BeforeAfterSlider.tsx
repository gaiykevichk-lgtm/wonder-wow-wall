import { useState, useRef, useCallback, useMemo } from 'react';
import { ColumnWidthOutlined } from '@ant-design/icons';

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

  // Snapshot canvas once when component mounts (not on every drag move)
  const afterDataUrl = useMemo(
    () => afterCanvas?.toDataURL('image/jpeg', 0.85) ?? null,
    [afterCanvas],
  );

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

  // Mouse handlers
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

  // Touch handlers (mobile support)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      draggingRef.current = true;
      if (e.touches[0]) updatePosition(e.touches[0].clientX);
    },
    [updatePosition],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (draggingRef.current && e.touches[0]) {
        e.preventDefault();
        updatePosition(e.touches[0].clientX);
      }
    },
    [updatePosition],
  );

  const handleTouchEnd = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="before-after-slider"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        borderRadius: 16,
        cursor: 'ew-resize',
        userSelect: 'none',
        touchAction: 'none',
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

      {/* Slider divider line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${position}%`,
          width: 4,
          background: '#FFFFFF',
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        {/* Handle circle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#FFFFFF',
            border: '2px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: '#2D2D2D',
          }}
        >
          <ColumnWidthOutlined />
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
          background: 'rgba(45,45,45,0.7)',
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
