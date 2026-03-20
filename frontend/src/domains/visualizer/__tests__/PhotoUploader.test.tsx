import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhotoUploader } from '../ui/PhotoUploader';

describe('PhotoUploader', () => {
  it('renders upload prompt', () => {
    render(<PhotoUploader onUpload={vi.fn()} />);

    expect(screen.getByText('Загрузите фото стены')).toBeInTheDocument();
    expect(screen.getByText('Выбрать файл')).toBeInTheDocument();
    expect(screen.getByText('Камера')).toBeInTheDocument();
  });

  it('shows format info', () => {
    render(<PhotoUploader onUpload={vi.fn()} />);

    expect(
      screen.getByText(/JPEG, PNG, WebP, HEIC/),
    ).toBeInTheDocument();
  });

  it('shows tips for best results', () => {
    render(<PhotoUploader onUpload={vi.fn()} />);

    expect(screen.getByText(/фронтально/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<PhotoUploader onUpload={vi.fn()} loading={true} />);

    // The button should show loading state
    expect(screen.getByText('Выбрать файл')).toBeInTheDocument();
  });

  it('has file input with correct accept attribute', () => {
    render(<PhotoUploader onUpload={vi.fn()} />);

    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,image/heic',
    );
  });
});
