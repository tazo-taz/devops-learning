import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

// one registry = the list of everything this process reports at /metrics
export const register = new client.Registry();

// free metrics about the Node process itself: CPU, memory, event loop lag, ...
client.collectDefaultMetrics({ register });

// COUNTER: only goes up. One series per method + route + status combination.
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'How many HTTP requests the api answered',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// HISTOGRAM: how long requests took, counted into buckets (<= 0.05s, <= 0.1s, ...)
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'How long HTTP requests took, in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// runs for every request: start a timer, and when the response is sent, count it
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const stop = httpRequestDuration.startTimer();
  res.on('finish', () => {
    // the route PATTERN (/users/:id), not the real URL (/users/123):
    // a label value per user id would create millions of series
    const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
    if (route === '/metrics') return; // don't count Prometheus' own scrapes
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    stop(labels);
  });
  next();
}
