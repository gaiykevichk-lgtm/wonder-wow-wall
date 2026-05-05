import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PanelPicker } from '../ui/PanelPicker';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

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
    render(<PanelPicker {...defaultProps} />, { wrapper });
    const skeletons = document.querySelectorAll('.ant-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders design thumbnails with img elements', () => {
    render(<PanelPicker {...defaultProps} />, { wrapper });
    const images = document.querySelectorAll('[data-testid="panel-picker"] img');
    expect(images.length).toBeGreaterThan(0);
  });
});
