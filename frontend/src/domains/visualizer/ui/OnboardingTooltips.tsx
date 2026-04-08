import { useEffect, useState, useRef } from 'react';
import { Tour } from 'antd';
import type { TourProps } from 'antd';

const LS_KEY = 'wow-wall-visualizer-onboarding';

interface OnboardingTooltipsProps {
  /** Whether the editor is in ready state (scene loaded) */
  isReady: boolean;
}

export function OnboardingTooltips({ isReady }: OnboardingTooltipsProps) {
  const [open, setOpen] = useState(false);
  const uploaderRef = useRef<HTMLElement | null>(null);
  const maskToolbarRef = useRef<HTMLElement | null>(null);
  const panelPickerRef = useRef<HTMLElement | null>(null);
  const placementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isReady) return;

    // Check if onboarding was already shown
    try {
      if (localStorage.getItem(LS_KEY) === 'done') return;
    } catch {
      // localStorage unavailable
    }

    // Find target elements by data-testid
    uploaderRef.current = document.querySelector('[data-testid="panel-picker"]');
    maskToolbarRef.current = document.querySelector('[data-testid="mask-toolbar-trigger"]');
    panelPickerRef.current = document.querySelector('[data-testid="panel-picker"]');
    placementRef.current = document.querySelector('[data-testid="placement-controls"]');

    // Small delay to ensure elements are rendered
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [isReady]);

  const handleClose = () => {
    setOpen(false);
    try {
      localStorage.setItem(LS_KEY, 'done');
    } catch {
      // ignore
    }
  };

  const steps: TourProps['steps'] = [
    {
      title: 'Корректируйте маску стены',
      description: 'Подправьте маску стены кистью, если автоматическое распознавание неточно.',
      target: () => maskToolbarRef.current!,
      nextButtonProps: { children: 'Далее' },
    },
    {
      title: 'Выберите дизайн и размер',
      description: 'Подберите дизайн панелей, размер и цвет для вашей стены.',
      target: () => panelPickerRef.current!,
      nextButtonProps: { children: 'Далее' },
      prevButtonProps: { children: 'Назад' },
    },
    {
      title: 'Разместите панели',
      description: 'Нажмите «Авто» для автозаполнения стены или размещайте панели вручную.',
      target: () => placementRef.current!,
      nextButtonProps: { children: 'Готово' },
      prevButtonProps: { children: 'Назад' },
    },
  ];

  if (!isReady) return null;

  return (
    <Tour
      open={open}
      onClose={handleClose}
      steps={steps}
      indicatorsRender={(current, total) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i === current ? '#4CAF50' : '#E5E7EB',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      )}
    />
  );
}
