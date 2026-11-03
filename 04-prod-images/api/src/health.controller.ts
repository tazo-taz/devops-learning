import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller("health")
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  // readiness: 200 only if the DB answers too, otherwise 503
  @Get()
  async getHealth() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: "error", db: "down" });
    }
    return {
      status: "ok",
      db: "up",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  }
}
