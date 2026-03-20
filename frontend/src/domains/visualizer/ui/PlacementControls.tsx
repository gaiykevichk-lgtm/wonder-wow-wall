import { Button, Segmented, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  EditOutlined,
  BorderOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { PlacementMode } from '../model/types';

interface PlacementControlsProps {
  mode: PlacementMode;
  panelCount: number;
  onModeChange: (mode: PlacementMode) => void;
  onAutoFill: () => void;
  onClearAll: () => void;
}

export function PlacementControls({
  mode,
  panelCount,
  onModeChange,
  onAutoFill,
  onClearAll,
}: PlacementControlsProps) {
  return (
    <div
      data-testid="placement-controls"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <Segmented
        block
        value={mode}
        onChange={(val) => onModeChange(val as PlacementMode)}
        options={[
          {
            label: (
              <Tooltip title="Размещайте панели кликом">
                <span>
                  <EditOutlined /> Вручную
                </span>
              </Tooltip>
            ),
            value: 'manual',
          },
          {
            label: (
              <Tooltip title="Заполнить всю стену автоматически">
                <span>
                  <AppstoreOutlined /> Авто
                </span>
              </Tooltip>
            ),
            value: 'auto',
          },
          {
            label: (
              <Tooltip title="Выделите зону для панелей">
                <span>
                  <BorderOutlined /> Зона
                </span>
              </Tooltip>
            ),
            value: 'accent',
          },
        ]}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          block
          type="primary"
          icon={<AppstoreOutlined />}
          onClick={onAutoFill}
          style={{
            background: '#4CAF50',
            borderColor: '#4CAF50',
            borderRadius: 8,
          }}
        >
          Заполнить стену
        </Button>
        <Tooltip title="Удалить все панели">
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={onClearAll}
            disabled={panelCount === 0}
            style={{ borderRadius: 8 }}
          />
        </Tooltip>
      </div>
    </div>
  );
}
