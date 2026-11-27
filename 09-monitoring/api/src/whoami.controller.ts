import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { hostname } from 'os';

// Echoes what the api sees about the caller: useful behind a proxy.
@Controller('whoami')
export class WhoamiController {
  @Get()
  whoami(@Req() req: Request) {
    return {
      servedBy: hostname(), // which api container answered (Step 5)
      hotReload: 'works through nginx_', // Step 7: added while the stack was running
      socketIp: req.socket.remoteAddress, // who opened the TCP connection
      host: req.headers['host'],
      xRealIp: req.headers['x-real-ip'] ?? null,
      xForwardedFor: req.headers['x-forwarded-for'] ?? null,
      xForwardedProto: req.headers['x-forwarded-proto'] ?? null,
    };
  }
}
