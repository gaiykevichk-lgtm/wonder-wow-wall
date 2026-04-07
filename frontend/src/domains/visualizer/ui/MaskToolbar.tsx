import { Button, Slider, Tooltip, Segmented } from 'antd';
import {
  HighlightOutlined,
  ScissorOutlined,
  UndoOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import type { MaskTool } from '../model/types';

interface MaskToolbarProps {
  activeTool: MaskTool;
  brushSize: number;
  maskVisible: boolean;
  maskOpacity: number;
  canUndo: boolean;
  onToolChange: (tool: MaskTool) => void;
  onBrushSizeChange: (size: number) => void;
  onToggleMask: () => void;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
}

export function MaskToolbar({
  activeTool,
  brushSize,
  maskVisible,
  maskOpacity,
  canUndo,
  onToolChange,
  onBrushSizeChange,
  onToggleMask,
  onOpacityChange,
  onUndo,
}: MaskToolbarProps) {
  return (
    <div
      data-testid="mask-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        background: '#1d1d1f',
        borderRadius: 10,
        flexWrap: 'wrap',
      }}
    >
      {/* Tool selector */}
      <Segmented
        value={activeTool}
        onChange={(val) => onToolChange(val as MaskTool)}
        options={[
          {
            label: (
              <Tooltip title="Кисть — добавить стену">
                <HighlightOutlined style={{ color: '#0071e3' }} />
              </Tooltip>
            ),
            value: 'brush',
          },
          {
            label: (
              <Tooltip title="Ластик — убрать стену">
                <ScissorOutlined style={{ color: '#EF4444' }} />
              </Tooltip>
            ),
            value: 'eraser',
          },
        ]}
        style={{ background: '#404040' }}
      />

      {/* Brush size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#86868b', fontSize: 12, whiteSpace: 'nowrap' }}>
          Размер:
        </span>
        <Slider
          min={5}
          max={80}
          value={brushSize}
          onChange={onBrushSizeChange}
          style={{ width: 100 }}
        />
        <span style={{ color: '#FFFFFF', fontSize: 12, minWidth: 28 }}>
          {brushSize}
        </span>
      </div>

      {/* Mask opacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#86868b', fontSize: 12, whiteSpace: 'nowrap' }}>
          Прозрачность:
        </span>
        <Slider
          min={0.1}
          max={0.8}
          step={0.05}
          value={maskOpacity}
          onChange={onOpacityChange}
          style={{ width: 80 }}
        />
      </div>

      {/* Toggle mask */}
      <Tooltip title={maskVisible ? 'Скрыть маску' : 'Показать маску'}>
        <Button
          type="text"
          icon={
            maskVisible ? (
              <EyeOutlined style={{ color: '#FFFFFF' }} />
            ) : (
              <EyeInvisibleOutlined style={{ color: '#86868b' }} />
            )
          }
          onClick={onToggleMask}
        />
      </Tooltip>

      {/* Undo */}
      <Tooltip title="Отменить (Ctrl+Z)">
        <Button
          type="text"
          icon={<UndoOutlined style={{ color: canUndo ? '#FFFFFF' : '#86868b' }} />}
          disabled={!canUndo}
          onClick={onUndo}
        />
      </Tooltip>
    </div>
  );
}
