/**
 * Loads environment variables. Import this module first so every other module
 * sees the values. Looks for backend/.env, then the monorepo root .env.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
