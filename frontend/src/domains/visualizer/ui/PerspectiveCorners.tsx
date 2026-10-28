import { useCallback } from 'react';
import { Circle, Line } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { PerspectiveCorners as CornersType } from '../model/types';

interface PerspectiveCornersProps {
  corners: CornersType;
  scale: number;
  onCornersChange: (corners: CornersType) => void;
}

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'] as const;

export function PerspectiveCorners({
  corners,
  scale,
  onCornersChange,
}: PerspectiveCornersProps) {
  const handleDragEnd = useCallback(
    (index: number, e: KonvaEventObject<DragEvent>) => {
      const node = e.target as Konva.Circle;
      const newCorners = [...corners] as CornersType;
      newCorners[index] = { x: node.x(), y: node.y() };
      onCornersChange(newCorners);
    },
    [corners, onCornersChange],
  );

  // Flat points for the outline polygon
  const flatPoints = corners.flatMap((p) => [p.x, p.y]);

  return (
    <>
      {/* Outline polygon */}
      <Line
        points={flatPoints}
        closed
        stroke="#4CAF50"
        strokeWidth={2 / scale}
        opacity={0.8}
        dash={[6 / scale, 4 / scale]}
        listening={false}
      />

      {/* Corner markers */}
      {corners.map((point, i) => (
        <Circle
          key={CORNER_LABELS[i]}
          x={point.x}
          y={point.y}
          radius={10 / scale}
          fill="#FFFFFF"
          stroke="#4CAF50"
          strokeWidth={2 / scale}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={4 / scale}
          shadowOffsetY={2 / scale}
          draggable
          onDragEnd={(e) => handleDragEnd(i, e)}
          onMouseEnter={(e) => {
            const node = e.target as Konva.Circle;
            node.radius(12 / scale);
            node.stroke('#43A047');
            node.getLayer()?.batchDraw();
            const stage = node.getStage();
            if (stage) {
              const container = stage.container();
              container.style.cursor = 'move';
            }
          }}
          onMouseLeave={(e) => {
            const node = e.target as Konva.Circle;
            node.radius(10 / scale);
            node.stroke('#4CAF50');
            node.getLayer()?.batchDraw();
            const stage = node.getStage();
            if (stage) {
              const container = stage.container();
              container.style.cursor = 'default';
            }
          }}
        />
      ))}
    </>
  );
}
