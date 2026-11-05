// Used by the TypeORM CLI (`npm run migration:run`), NOT by the Nest app.
// The CLI runs outside Nest, so it needs its own DB connection settings.
import { DataSource } from 'typeorm';
import { User } from './users/user.entity.js';
import { InitUsers1793865600000 } from './migrations/1793865600000-InitUsers.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User],
  // every migration class, oldest first; new migrations get added here
  migrations: [InitUsers1793865600000],
  synchronize: false,
});
