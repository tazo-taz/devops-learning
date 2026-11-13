import { mkdirSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // the app writes files at runtime (like uploads/cache): record the last start time
  const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
  mkdirSync(uploadDir, { recursive: true });
  writeFileSync(`${uploadDir}/last-start.txt`, new Date().toISOString());

  const app = await NestFactory.create(AppModule);
  // react to SIGTERM from `docker stop`: close the server + DB connection, then exit
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
