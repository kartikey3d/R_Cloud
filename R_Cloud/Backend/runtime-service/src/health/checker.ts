import { logger } from '../telemetry/logger.js'
import { config } from '../config/config.js'

/**
 * Pings an agent's health endpoint to check if it is active.
 * Expects a 200 OK response with a JSON payload indicating health status.
 *
 * Route path: /health (defined by runtime contract)
 */
export async function checkAgentHealth(agentUrl: string): Promise<boolean> {
  const healthUrl = `${agentUrl.replace(/\/$/, '')}/health`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.HEALTH_CHECK_TIMEOUT_MS)

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      logger.warn({ agentUrl, status: response.status }, 'Health check failed: Non-200 response status')
      return false
    }

    const body = (await response.json()) as any
    const isHealthy = body && (body.status === 'healthy' || body.status === 'HEALTHY' || body.healthy === true)

    if (!isHealthy) {
      logger.warn({ agentUrl, body }, 'Health check failed: Body status is not healthy')
      return false
    }

    return true
  } catch (err: any) {
    logger.error(
      { err: err.message || err, agentUrl },
      'Health check failed: Network error or timeout occurred'
    )
    return false
  }
}
