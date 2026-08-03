import { runtimeRepository } from '../registry/runtime.repository.js'
import { db } from '../database/postgres.js'
import { checkAgentHealth } from './checker.js'
import { handleUnhealthyRuntime } from './restart-manager.js'
import { publishEvent } from '../events/publisher.js'
import { RuntimeStatus, HealthStatus } from '../constants/runtime.constants.js'
import { config } from '../config/config.js'
import { logger } from '../telemetry/logger.js'

let intervalId: NodeJS.Timeout | null = null

/**
 * Periodically checks the health of all active runtimes.
 * Runs every HEALTH_CHECK_INTERVAL_MS (default: 30 seconds).
 */
export function startHealthScheduler(): void {
  if (intervalId) {
    logger.warn('Health scheduler is already running')
    return
  }

  const intervalMs = config.HEALTH_CHECK_INTERVAL_MS
  logger.info({ intervalMs }, 'Starting periodic health check scheduler')

  intervalId = setInterval(async () => {
    try {
      const query = `
        SELECT * FROM runtime_registry 
        WHERE status IN ($1, $2);
      `
      const result = await db.query(query, [
        RuntimeStatus.RUNNING,
        RuntimeStatus.RESTARTING
      ])
      const activeRuntimes = result.rows

      if (activeRuntimes.length === 0) {
        logger.debug('No active runtimes to health check')
        return
      }

      logger.info({ count: activeRuntimes.length }, 'Performing periodic health checks')

      for (const runtime of activeRuntimes) {
        const runtimeId = runtime.id
        const agents = await runtimeRepository.getAgentsByRuntime(runtimeId)

        if (!agents || agents.length === 0) {
          logger.warn({ runtimeId }, 'Active runtime has no registered agents, skipping check')
          continue
        }

        let allAgentsHealthy = true
        let failedAgentUrl = ''

        for (const agent of agents) {
          if (!agent.agent_url) continue

          const isHealthy = await checkAgentHealth(agent.agent_url)
          if (!isHealthy) {
            allAgentsHealthy = false
            failedAgentUrl = agent.agent_url
            break // No need to check other agents once one is down
          }
        }

        if (allAgentsHealthy) {
          // If the runtime was previously unhealthy or restarting, update it to running & healthy
          if (runtime.health !== HealthStatus.HEALTHY || runtime.status !== RuntimeStatus.RUNNING) {
            logger.info({ runtimeId }, 'Runtime is healthy. Restoring healthy status.')
            await runtimeRepository.updateRuntimeStatus(runtimeId, RuntimeStatus.RUNNING, HealthStatus.HEALTHY)
          }
        } else {
          logger.warn({ runtimeId, failedAgentUrl }, 'Runtime health check failed!')
          
          publishEvent('health.failed', {
            runtimeId,
            url: failedAgentUrl
          })

          await handleUnhealthyRuntime(runtimeId)
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error during runtime health check cycle')
    }
  }, intervalMs)
}

/**
 * Stops the periodic health check scheduler.
 */
export function stopHealthScheduler(): void {
  if (intervalId) {
    logger.info('Stopping health check scheduler')
    clearInterval(intervalId)
    intervalId = null
  }
}
