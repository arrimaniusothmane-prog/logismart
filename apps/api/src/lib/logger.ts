import { env } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/** Clés jamais écrites dans les logs, même si elles transitent par un objet. */
const REDACT_KEYS = /^(password|passwordhash|newpassword|currentpassword|token|accesstoken|refreshtoken|authorization|cookie|secret|apikey|ai_api_key|embedding_api_key|jwt_secret|cookiesecret|signatureData)$/i;
const REDACT_VALUE = '[redacted]';

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limit]';
  if (value instanceof Error) return { name: value.name, message: value.message, stack: env.isProd ? undefined : value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.test(k) ? REDACT_VALUE : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[env.LOG_LEVEL]) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  };
  const line = env.isProd ? JSON.stringify(entry) : `${entry.time} ${level.toUpperCase()} ${msg}${meta ? ` ${JSON.stringify(redact(meta))}` : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
};

export type Logger = typeof logger;
