import { WhoamiController } from './whoami.controller.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true, // pick up entities from modules (step 6)
      synchronize: false, // tables come from migrations now (npm run migration:run)
    }),
    UsersModule,
  ],
  controllers: [AppController, HealthController, WhoamiController],
  providers: [AppService],
})
export class AppModule {}
