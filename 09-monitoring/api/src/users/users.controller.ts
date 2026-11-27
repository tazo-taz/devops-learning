import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CreateUserDto } from './create-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  async findAll(@Res({ passthrough: true }) res: Response) {
    const { users, cache } = await this.usersService.findAll();
    res.setHeader('X-Cache', cache); // HIT = from Redis, MISS = from Postgres
    return users;
  }
}
