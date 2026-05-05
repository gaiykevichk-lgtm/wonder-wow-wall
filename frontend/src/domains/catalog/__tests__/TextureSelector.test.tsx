import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextureSelector from '../ui/TextureSelector';
import type { Texture } from '../model/types';

const makeTexture = (overrides?: Partial<Texture>): Texture => ({
  id: 'tex-1',
  name: 'Бетон',
  slug: 'concrete',
  swatchImage: '/img/concrete.jpg',
  colors: [],
  ...overrides,
});

describe('TextureSelector', () => {
  it('returns null when textures array is empty', () => {
    const { container } = render(
      <TextureSelector textures={[]} activeId="tex-1" onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders texture names', () => {
    const textures: Texture[] = [
      makeTexture({ id: 'tex-1', name: 'Бетон' }),
      makeTexture({ id: 'tex-2', name: 'Дерево', slug: 'wood' }),
    ];

    render(
      <TextureSelector textures={textures} activeId="tex-1" onChange={vi.fn()} />,
    );

    expect(screen.getByText('Текстура')).toBeInTheDocument();
    expect(screen.getByText('Бетон')).toBeInTheDocument();
    expect(screen.getByText('Дерево')).toBeInTheDocument();
  });

  it('calls onChange when a texture is clicked', () => {
    const onChange = vi.fn();
    const textures: Texture[] = [
      makeTexture({ id: 'tex-1', name: 'Бетон' }),
      makeTexture({ id: 'tex-2', name: 'Дерево', slug: 'wood' }),
    ];

    render(
      <TextureSelector textures={textures} activeId="tex-1" onChange={onChange} />,
    );

    fireEvent.click(screen.getByText('Дерево'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('tex-2');
  });

  it('shows swatch image when available, fallback emoji when not', () => {
    const textures: Texture[] = [
      makeTexture({ id: 'tex-1', name: 'Бетон', swatchImage: '/img/concrete.jpg' }),
      makeTexture({ id: 'tex-2', name: 'Дерево', slug: 'wood', swatchImage: '' }),
    ];

    render(
      <TextureSelector textures={textures} activeId="tex-1" onChange={vi.fn()} />,
    );

    const img = screen.getByAltText('Бетон');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/img/concrete.jpg');

    expect(screen.getByText('🧱')).toBeInTheDocument();
  });
});
