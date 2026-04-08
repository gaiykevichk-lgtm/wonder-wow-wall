import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelPicker } from '../ui/PanelPicker';

describe('PanelPicker skeleton loading', () => {
  const defaultProps = {
    selectedDesignId: '',
    selectedSizeKey: '30x30' as const,
    selectedColor: '',
    onDesignSelect: vi.fn(),
    onSizeSelect: vi.fn(),
    onColorSelect: vi.fn(),
  };

  it('shows skeleton before image loads', () => {
    render(<PanelPicker {...defaultProps} />);
    // Skeleton should be present for at least some images (before onLoad fires)
    const skeletons = document.querySelectorAll('.ant-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders design thumbnails with img elements', () => {
    render(<PanelPicker {...defaultProps} />);
    const images = document.querySelectorAll('[data-testid="panel-picker"] img');
    expect(images.length).toBeGreaterThan(0);
  });
});
