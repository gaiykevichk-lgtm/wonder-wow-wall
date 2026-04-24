import { describe, it, expect } from 'vitest';
import {
  createOpencvLsdProvider,
  OpencvNotInstalledError,
} from '../lib/opencvLsdAdapter';
import { createCvWorkerHost } from '../lib/cvWorkerHost';
import { createEmptyMask } from '../lib/maskUtils';

describe('opencvLsdAdapter (stub)', () => {
  it('throws OpencvNotInstalledError when invoked', async () => {
    const provider = createOpencvLsdProvider({ workerHost: createCvWorkerHost() });
    await expect(
      provider({
        imageUrl: 'photo://x',
        mask: createEmptyMask(10, 10, 255),
        photoSize: { width: 10, height: 10 },
      }),
    ).rejects.toBeInstanceOf(OpencvNotInstalledError);
  });

  it('exposes a stable error code so callers can branch on it', async () => {
    const provider = createOpencvLsdProvider({ workerHost: createCvWorkerHost() });
    try {
      await provider({
        imageUrl: '',
        mask: createEmptyMask(10, 10, 255),
        photoSize: { width: 10, height: 10 },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(OpencvNotInstalledError);
      expect((err as OpencvNotInstalledError).code).toBe('opencv-not-installed');
      return;
    }
    throw new Error('Provider should have rejected');
  });
});
