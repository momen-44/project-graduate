import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity.ts', 'dist/**/*.entity.js'],
  // Keep CLI migrations source-only to avoid duplicate migration classes from dist.
  migrations: ['src/database/migrations/*.ts'],
  synchronize: true, // Set to false in production and use migrations instead
});

