import { describe, it, expect, vi } from 'vitest';
import { withRetry, isTransient } from '../sync/retry';

describe('isTransient', () => {
  it('treats network failures (no status) as transient', () => {
    expect(isTransient(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('retries 429 and 5xx', () => {
    expect(isTransient({ status: 429 })).toBe(true);
    expect(isTransient({ status: 500 })).toBe(true);
    expect(isTransient({ status: 503 })).toBe(true);
    expect(isTransient({ statusCode: 502 })).toBe(true);
    expect(isTransient({ response: { status: 504 } })).toBe(true);
  });

  it('does NOT retry auth/client errors', () => {
    expect(isTransient({ status: 401 })).toBe(false);
    expect(isTransient({ status: 403 })).toBe(false);
    expect(isTransient({ status: 404 })).toBe(false);
    expect(isTransient({ status: 409 })).toBe(false);
  });

  it('does NOT retry our reconnect_required signal', () => {
    expect(isTransient({ code: 'reconnect_required', status: 500 })).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns immediately on success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { baseMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    await expect(withRetry(fn, { retries: 3, baseMs: 1, onRetry })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget and rethrows', async () => {
    const err = { status: 500 };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retries: 2, baseMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does NOT retry a non-transient error', async () => {
    const err = { status: 401 };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retries: 3, baseMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
