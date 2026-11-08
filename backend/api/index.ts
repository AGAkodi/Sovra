/**
 * Vercel serverless entry point: the whole Express API as one function.
 * vercel.json rewrites every path here, and Express routes on the original URL.
 */
import { app } from '../src/server';

export default app;
