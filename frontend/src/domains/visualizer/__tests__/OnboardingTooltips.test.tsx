import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { OnboardingTooltips } from '../ui/OnboardingTooltips';

const LS_KEY = 'wow-wall-visualizer-onboarding';

beforeEach(() => {
  localStorage.removeItem(LS_KEY);
});

describe('OnboardingTooltips', () => {
  it('renders nothing when not ready', () => {
    const { container } = render(<OnboardingTooltips isReady={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('does not open tour if already shown', () => {
    localStorage.setItem(LS_KEY, 'done');
    const { container } = render(<OnboardingTooltips isReady={true} />);
    // Tour should not open — no tour overlay in DOM
    expect(container.querySelector('.ant-tour')).toBeNull();
  });

  it('renders when ready and not previously shown', () => {
    // Just verify it mounts without errors
    const { unmount } = render(<OnboardingTooltips isReady={true} />);
    unmount();
  });
});
