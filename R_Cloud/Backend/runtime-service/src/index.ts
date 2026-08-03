// MUST be the absolute first import in the application so OpenTelemetry can patch libraries before they load
import './telemetry/tracer.js'

import { connectDatabase } from './database/postgres.js'
import { startGrpcServer, stopGrpcServer } from './grpc/server.js'
import { connectNATS, disconnectNATS } from './events/publisher.js'
import { logger } from './telemetry/logger.js'
import { config } from './config/config.js'

async function bootstrap() {
  try {
    logger.info('Starting Runtime Service bootstrap...')

    try {
      await connectDatabase()
    } catch (err) {
      logger.error({ err }, 'Failed to connect to PostgreSQL')
      if (config.NODE_ENV === 'production') {
        throw err
      }
      logger.warn('Continuing bootstrap without PostgreSQL connection (development mode)')
    }

    await connectNATS()

    await startGrpcServer()

    logger.info('Runtime Service fully initialized and running.')
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during Runtime Service bootstrap. Shutting down.')
    process.exit(1)
  }
}

// Handle graceful shutdown signals
const shutdownSignals = ['SIGTERM', 'SIGINT']
shutdownSignals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ signal }, 'Graceful shutdown signal received')
    
    try {
      await stopGrpcServer()
      await disconnectNATS()
      logger.info('Process completed cleanup. Exiting.')
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown')
      process.exit(1)
    }
  })
})

bootstrap()
