import { Redis } from 'ioredis';

export const REDIS = 'REDIS';

// One Redis connection per api copy. Host comes from compose (service name = DNS name).
export const redisProvider = {
  provide: REDIS,
  useFactory: () =>
    new Redis({
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: 1, // fail fast if Redis is down instead of hanging
    }),
};
