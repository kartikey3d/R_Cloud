import pino from 'pino'
import { config } from '../config/config.js'

export const logger = pino({
  level: config.LOG_LEVEL,

  // Pretty-print in development, raw JSON in production (for log aggregators)
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,

  base: {
    service: config.OTEL_SERVICE_NAME,
    env: config.NODE_ENV,
  },

  // Rename 'msg' → 'message' for compatibility with log aggregators
  messageKey: 'message',

  timestamp: pino.stdTimeFunctions.isoTime,
})

export type Logger = typeof logger
