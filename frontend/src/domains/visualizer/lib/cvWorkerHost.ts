/**
 * Generic task queue for heavy CV work (vanishing-point detection in
 * Phase 3, YOLO inference in Phase 4). Runs tasks **sequentially** so two
 * memory-heavy WASM workers never live at the same time on low-RAM
 * devices. Designed to work with either a real Web Worker or an inline
 * function — the host doesn't care, it just needs `(input) => Promise<output>`.
 *
 * Why not a thread pool: OpenCV.js + onnxruntime-web each allocate ~80 MB
 * of WASM heap. Running them concurrently OOM-kills mid-range Android
 * Chrome. Sequential queue is the safest default; future revisions can
 * upgrade to a small pool when device class is known.
 */

export type TaskRunner<I, O> = (input: I, signal: AbortSignal) => Promise<O>;

interface QueueEntry<I, O> {
  input: I;
  runner: TaskRunner<I, O>;
  resolve: (value: O) => void;
  reject: (reason: unknown) => void;
  controller: AbortController;
}

export interface CvWorkerHost {
  /**
   * Enqueue a task. Returns a promise that settles when the task finishes
   * or is aborted. If the host is busy, the task waits in FIFO order.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enqueue<I, O>(runner: TaskRunner<I, O>, input: I): { promise: Promise<O>; abort: () => void };
  /** Number of tasks currently waiting (does not include the running one). */
  pendingCount(): number;
  /** Whether a task is currently executing. */
  isRunning(): boolean;
}

export function createCvWorkerHost(): CvWorkerHost {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: QueueEntry<any, any>[] = [];
  let running = false;

  async function pump(): Promise<void> {
    if (running) return;
    const next = queue.shift();
    if (!next) return;
    running = true;
    try {
      if (next.controller.signal.aborted) {
        next.reject(new DOMException('Aborted', 'AbortError'));
      } else {
        const out = await next.runner(next.input, next.controller.signal);
        next.resolve(out);
      }
    } catch (err) {
      next.reject(err);
    } finally {
      running = false;
      // Schedule next tick — avoid deep stacks for fast tasks.
      if (queue.length > 0) queueMicrotask(pump);
    }
  }

  return {
    enqueue<I, O>(runner: TaskRunner<I, O>, input: I) {
      const controller = new AbortController();
      let resolve!: (value: O) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<O>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      queue.push({ input, runner, resolve, reject, controller });
      queueMicrotask(pump);
      return {
        promise,
        abort: () => controller.abort(),
      };
    },
    pendingCount() {
      return queue.length;
    },
    isRunning() {
      return running;
    },
  };
}

/**
 * Default singleton host. Both Phase 3 (VP detector) and Phase 4 (YOLO)
 * SHOULD share this instance so they serialise instead of competing.
 */
export const defaultCvWorkerHost: CvWorkerHost = createCvWorkerHost();
