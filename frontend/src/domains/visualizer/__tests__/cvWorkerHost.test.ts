import { describe, it, expect } from 'vitest';
import { createCvWorkerHost } from '../lib/cvWorkerHost';

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

describe('cvWorkerHost', () => {
  it('runs a single task and resolves with the value', async () => {
    const host = createCvWorkerHost();
    const { promise } = host.enqueue(async (n: number) => n * 2, 21);
    expect(await promise).toBe(42);
    expect(host.isRunning()).toBe(false);
    expect(host.pendingCount()).toBe(0);
  });

  it('serialises two tasks in FIFO order (no concurrency)', async () => {
    const host = createCvWorkerHost();
    const events: string[] = [];

    const a = host.enqueue(async (label: string) => {
      events.push(`start:${label}`);
      await delay(20);
      events.push(`end:${label}`);
      return label;
    }, 'A');

    const b = host.enqueue(async (label: string) => {
      events.push(`start:${label}`);
      await delay(5);
      events.push(`end:${label}`);
      return label;
    }, 'B');

    await Promise.all([a.promise, b.promise]);

    // B must NOT start before A finishes.
    expect(events).toEqual(['start:A', 'end:A', 'start:B', 'end:B']);
  });

  it('abort() rejects a queued task before it runs', async () => {
    const host = createCvWorkerHost();
    let ran = false;
    // Block the host with a long task first.
    const blocker = host.enqueue(async () => {
      await delay(30);
      return 1;
    }, undefined);

    const queued = host.enqueue(async () => {
      ran = true;
      return 2;
    }, undefined);
    queued.abort();

    await blocker.promise;
    await expect(queued.promise).rejects.toThrowError(/abort/i);
    expect(ran).toBe(false);
  });

  it('abort signal is propagated to a running task', async () => {
    const host = createCvWorkerHost();
    let observedAborted = false;

    const task = host.enqueue(async (_input: number, signal) => {
      // Simulate cooperative cancellation: poll signal during work.
      for (let i = 0; i < 20; i++) {
        await delay(5);
        if (signal.aborted) {
          observedAborted = true;
          throw new DOMException('Aborted', 'AbortError');
        }
      }
      return 'done';
    }, 0);

    await delay(15); // let it start
    task.abort();

    await expect(task.promise).rejects.toThrowError(/abort/i);
    expect(observedAborted).toBe(true);
  });

  it('one task throwing does not block subsequent tasks', async () => {
    const host = createCvWorkerHost();
    const failing = host.enqueue(async () => {
      throw new Error('boom');
    }, undefined);
    const ok = host.enqueue(async () => 'ok', undefined);

    await expect(failing.promise).rejects.toThrow('boom');
    expect(await ok.promise).toBe('ok');
  });

  it('pendingCount reflects queued-but-not-running tasks', async () => {
    const host = createCvWorkerHost();
    host.enqueue(async () => {
      await delay(20);
      return 1;
    }, undefined);
    const t2 = host.enqueue(async () => 2, undefined);
    const t3 = host.enqueue(async () => 3, undefined);

    // Microtask hasn't run yet — but synchronously after enqueue, all are pending.
    // After a tick, the first will be running and queue will hold the other two.
    await delay(0);
    expect(host.isRunning()).toBe(true);
    expect(host.pendingCount()).toBe(2);

    await Promise.all([t2.promise, t3.promise]);
    expect(host.pendingCount()).toBe(0);
  });
});
