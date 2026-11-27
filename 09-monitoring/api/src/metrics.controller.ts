import { Controller, Get, Header } from '@nestjs/common';
import { register } from './metrics.js';

// Prometheus calls this every few seconds and stores what it reads
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  getMetrics() {
    return register.metrics(); // plain text, one line per series
  }
}
