import { useEffect, useState } from 'react';
import { EMPTY_METRICS, parseLhmData } from '../utils/parseMetrics';
import type { ParseOptions, SystemMetrics } from '../utils/parseMetrics';

export type ConnectionState = 'connecting' | 'online' | 'offline';

const REQUEST_TIMEOUT_MS = 3000;

/**
 * Polls the Libre Hardware Monitor web server.
 *
 * The next request is only scheduled after the previous one finishes, so slow
 * responses never pile up. Each request gets its own AbortController and a
 * timeout. When LHM cannot be reached the metrics reset to empty instead of
 * showing stale numbers.
 *
 * `options` should be a stable reference (for example a module-level constant).
 */
export function useLhmMetrics(url: string, intervalMs: number, options: ParseOptions) {
  const [metrics, setMetrics] = useState<SystemMetrics>(EMPTY_METRICS);
  const [status, setStatus] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: AbortController | undefined;

    const poll = async () => {
      // A new controller per request: an aborted controller can never be reused.
      const controller = new AbortController();
      current = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!cancelled) {
          setMetrics(parseLhmData(data, options));
          setStatus('online');
        }
      } catch {
        if (!cancelled) {
          setMetrics(EMPTY_METRICS);
          setStatus('offline');
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) timer = setTimeout(poll, intervalMs);
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      current?.abort();
    };
  }, [url, intervalMs, options]);

  return { metrics, status };
}
