import { env } from '../lib/env';
import { api as real } from './supabaseApi';
import { api as mock } from './mockApi';

export const api = env.DEMO ? mock : real;
