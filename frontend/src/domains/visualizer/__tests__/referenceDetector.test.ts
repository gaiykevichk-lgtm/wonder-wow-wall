import { describe, it, expect } from 'vitest';
import {
  createOnnxReferenceDetector,
  OnnxNotInstalledError,
} from '../lib/referenceDetector';
import { defaultCvWorkerHost } from '../lib/cvWorkerHost';

describe('createOnnxReferenceDetector (stub)', () => {
  it('throws OnnxNotInstalledError when invoked', async () => {
    const detector = createOnnxReferenceDetector({
      workerHost: defaultCvWorkerHost,
    });
    await expect(
      detector({
        imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
        photoSize: { width: 1024, height: 768 },
      }),
    ).rejects.toBeInstanceOf(OnnxNotInstalledError);
  });

  it('exposes a stable error code for store-side discrimination', async () => {
    const detector = createOnnxReferenceDetector({
      workerHost: defaultCvWorkerHost,
    });
    try {
      await detector({
        imageUrl: '',
        photoSize: { width: 100, height: 100 },
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OnnxNotInstalledError);
      expect((err as OnnxNotInstalledError).code).toBe('onnx-not-installed');
    }
  });

  it('honours the OnnxReferenceDetectorOptions surface (smoke)', () => {
    // The TODO options are accepted at construction and don't affect the stub.
    const detector = createOnnxReferenceDetector({
      workerHost: defaultCvWorkerHost,
      scoreThreshold: 0.4,
      maxCandidates: 10,
    });
    expect(typeof detector).toBe('function');
  });
});
