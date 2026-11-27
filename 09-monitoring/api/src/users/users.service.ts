import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { QueryFailedError, Repository } from 'typeorm';
import { REDIS } from '../redis.provider.js';
import { CreateUserDto } from './create-user.dto.js';
import { User } from './user.entity.js';

const CACHE_KEY = 'users:all';
const TTL_SECONDS = 60;

@Injectable()
export class UsersService {
  private readonly log = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async create(dto: CreateUserDto) {
    try {
      const user = await this.users.save(dto);
      // invalidation: the cached list is now wrong → delete it
      await this.redis.del(CACHE_KEY).catch(() => undefined);
      return user;
    } catch (err) {
      // 23505 = Postgres unique_violation (email already taken)
      if (
        err instanceof QueryFailedError &&
        err.driverError?.code === '23505'
      ) {
        throw new ConflictException('email already exists');
      }
      throw err;
    }
  }

  // cache-aside: 1) look in Redis  2) miss → DB  3) save in Redis with a TTL
  async findAll(): Promise<{ users: User[]; cache: 'HIT' | 'MISS' }> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) return { users: JSON.parse(cached), cache: 'HIT' };
    } catch (err) {
      this.log.warn(`Redis read failed, using DB: ${(err as Error).message}`);
    }

    const users = await this.users.find();
    await this.redis
      .set(CACHE_KEY, JSON.stringify(users), 'EX', TTL_SECONDS)
      .catch(() => undefined);
    return { users, cache: 'MISS' };
  }
}
