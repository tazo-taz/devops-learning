// Used by the TypeORM CLI (`npm run migration:run`), NOT by the Nest app.
// The CLI runs outside Nest, so it needs its own DB connection settings.
import { DataSource } from 'typeorm';
import { User } from './users/user.entity.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User],
  // load every compiled migration next to this file (dist/migrations/*.js),
  // so a new migration file is picked up without editing this list
  migrations: [`${import.meta.dirname}/migrations/*.js`],
  synchronize: false,
});
