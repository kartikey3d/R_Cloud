import { connect, NatsConnection, JSONCodec } from 'nats'
import { config } from '../config/config.js'
import { logger } from '../telemetry/logger.js'

let natsConn: NatsConnection | null = null
const jc = JSONCodec()

export async function connectNATS(): Promise<void> {
  try {
    logger.info({ natsUrl: config.NATS_URL }, 'Connecting to NATS')
    natsConn = await connect({ 
      servers: config.NATS_URL,
      reconnect: true,
      maxReconnectAttempts: 10,
    })
    logger.info({ natsUrl: config.NATS_URL }, 'Successfully connected to NATS')
  } catch (err) {
    logger.error({ err, natsUrl: config.NATS_URL }, 'Failed to connect to NATS')
    // We do not hard-throw in development to let the service run without NATS locally
    if (config.NODE_ENV === 'production') {
      throw err
    }
  }
}

export async function disconnectNATS(): Promise<void> {
  if (natsConn) {
    await natsConn.close()
    natsConn = null
    logger.info('Disconnected from NATS')
  }
}

export function publishEvent(subject: string, data: any): void {
  if (!natsConn) {
    logger.warn({ subject, data }, 'NATS not connected. Event was dropped.')
    return
  }

  try {
    const payload = {
      event: subject,
      timestamp: new Date().toISOString(),
      data
    }
    natsConn.publish(subject, jc.encode(payload))
    logger.info({ subject }, 'Published event to NATS')
  } catch (err) {
    logger.error({ err, subject }, 'Failed to publish event to NATS')
  }
}
