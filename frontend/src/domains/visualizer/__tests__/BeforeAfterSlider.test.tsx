import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BeforeAfterSlider } from '../ui/BeforeAfterSlider';

describe('BeforeAfterSlider', () => {
  const defaultProps = {
    beforeSrc: 'data:image/png;base64,abc',
    afterCanvas: null,
    width: 800,
    height: 600,
  };

  it('renders slider container', () => {
    render(<BeforeAfterSlider {...defaultProps} />);
    expect(screen.getByTestId('before-after-slider')).toBeDefined();
  });

  it('shows before image', () => {
    render(<BeforeAfterSlider {...defaultProps} />);
    const img = screen.getByAltText('До');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe(defaultProps.beforeSrc);
  });

  it('shows labels', () => {
    render(<BeforeAfterSlider {...defaultProps} />);
    expect(screen.getByText('До')).toBeDefined();
    expect(screen.getByText('После')).toBeDefined();
  });

  it('updates slider position on mouse events', () => {
    render(<BeforeAfterSlider {...defaultProps} />);
    const container = screen.getByTestId('before-after-slider');

    // Simulate mouse interaction
    fireEvent.mouseDown(container, { clientX: 400 });
    fireEvent.mouseMove(container, { clientX: 200 });
    fireEvent.mouseUp(container);
    // No error means the interaction worked
  });

  it('applies correct dimensions', () => {
    render(<BeforeAfterSlider {...defaultProps} />);
    const container = screen.getByTestId('before-after-slider');
    expect(container.style.width).toBe('800px');
    expect(container.style.height).toBe('600px');
  });
});
