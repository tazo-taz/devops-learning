import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto } from './create-user.dto.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateUserDto) {
    try {
      return await this.users.save(dto);
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

  findAll() {
    return this.users.find();
  }
}
