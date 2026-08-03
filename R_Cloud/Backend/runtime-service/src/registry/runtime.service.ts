import { getProvider } from '../providers/provider.factory.js'
import { runtimeRepository } from './runtime.repository.js'
import { db } from '../database/postgres.js'
import { publishEvent } from '../events/publisher.js'
import { RuntimeEvent } from '../constants/events.constants.js'
import { RuntimeStatus, HealthStatus } from '../constants/runtime.constants.js'
import { logger } from '../telemetry/logger.js'
import { 
  CreateRuntimeRequest, 
  CreateRuntimeResponse, 
  StopRuntimeRequest, 
  StopRuntimeResponse,
  RestartRuntimeRequest,
  RestartRuntimeResponse,
  DeleteRuntimeRequest,
  DeleteRuntimeResponse,
  GetRuntimeStatusRequest,
  GetRuntimeStatusResponse,
  AgentStatus
} from '../types/grpc.types.js'
import { railwayClient } from '../providers/railway/railway.client.js'

export class RuntimeService {
  

  async createRuntime(req: CreateRuntimeRequest): Promise<CreateRuntimeResponse> {
    logger.info({ deploymentId: req.deployment_id, provider: req.provider }, 'Starting runtime creation')

    const runtimeRecord = await runtimeRepository.createRuntime(
      req.deployment_id,
      '' 
    )
    const runtimeId = runtimeRecord.id

    try {

      const provider = getProvider(req.provider)
      const provisionResult = await provider.provision(req)

      await runtimeRepository.updateRuntimeStatus(runtimeId, RuntimeStatus.RUNNING, HealthStatus.HEALTHY)
      
 
      const updateQuery = 'UPDATE runtime_registry SET railway_project_id = $1, runtime_url = $2 WHERE id = $3;'
 
      const mainService = provisionResult.services.find(s => s.name === 'main') || provisionResult.services[0]
      await db.query(updateQuery, [provisionResult.projectId, mainService.url, runtimeId])


      const agentsList = []
      for (const service of provisionResult.services) {
        const agentRecord = await runtimeRepository.createAgent(
          runtimeId,
          service.name,
          service.url,
          service.serviceId
        )


        try {
          logger.info({ agentName: service.name, url: service.url }, 'Fetching agent metadata')
          const metadataUrl = `${service.url}/metadata`
          const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(5000) })
          if (response.ok) {
            const metadata = await response.json() as any
            await runtimeRepository.updateAgentMetadata(
              agentRecord.id,
              metadata.framework || req.framework,
              metadata.version || '1.0.0',
              metadata.capabilities || []
            )
            logger.info({ agentName: service.name }, 'Fetched and updated agent metadata successfully')
          }
        } catch (metadataErr) {
          logger.warn({ metadataErr, agentName: service.name }, 'Failed to fetch agent metadata, continuing')
        }

        agentsList.push({
          agent_id: service.name,
          agent_url: service.url
        })
      }

      
      publishEvent(RuntimeEvent.STARTED, {
        runtimeId,
        deploymentId: req.deployment_id,
        runtimeUrl: mainService.url
      })

      return {
        runtime_id: runtimeId,
        status: RuntimeStatus.RUNNING,
        agents: agentsList
      }

    } catch (error) {
      logger.error({ error, runtimeId }, 'Failed to create runtime. Reverting status to FAILED')
      await runtimeRepository.updateRuntimeStatus(runtimeId, RuntimeStatus.FAILED, HealthStatus.UNHEALTHY)
      
      publishEvent(RuntimeEvent.FAILED, {
        runtimeId,
        deploymentId: req.deployment_id,
        reason: error instanceof Error ? error.message : 'Unknown provisioning error'
      })
      
      throw error
    }
  }

  async stopRuntime(req: StopRuntimeRequest): Promise<StopRuntimeResponse> {
    logger.info({ runtimeId: req.runtime_id }, 'Stopping runtime')

    const runtime = await runtimeRepository.getRuntime(req.runtime_id)
    if (!runtime) {
      throw new Error(`Runtime not found: ${req.runtime_id}`)
    }

    await runtimeRepository.updateRuntimeStatus(req.runtime_id, RuntimeStatus.STOPPED, HealthStatus.UNKNOWN)
    
    publishEvent(RuntimeEvent.STOPPED, {
      runtimeId: req.runtime_id,
      deploymentId: req.deployment_id
    })

    return {
      runtime_id: req.runtime_id,
      status: RuntimeStatus.STOPPED,
      message: 'Runtime stopped successfully'
    }
  }


  async restartRuntime(req: RestartRuntimeRequest): Promise<RestartRuntimeResponse> {
    logger.info({ runtimeId: req.runtime_id }, 'Restarting runtime')

    const runtime = await runtimeRepository.getRuntime(req.runtime_id)
    if (!runtime) {
      throw new Error(`Runtime not found: ${req.runtime_id}`)
    }

    const agents = await runtimeRepository.getAgentsByRuntime(req.runtime_id)
    if (!agents || agents.length === 0) {
      throw new Error(`No agents registered for runtime: ${req.runtime_id}`)
    }

    await runtimeRepository.updateRuntimeStatus(req.runtime_id, RuntimeStatus.RESTARTING, HealthStatus.STARTING)

    try {
      // Restart every agent container in Railway
      for (const agent of agents) {
        if (agent.railway_service_id) {
          logger.info({ agentName: agent.name, serviceId: agent.railway_service_id }, 'Restarting Railway service')
          await railwayClient.restartService(agent.railway_service_id)
        }
      }

      await runtimeRepository.updateRuntimeStatus(req.runtime_id, RuntimeStatus.RUNNING, HealthStatus.HEALTHY)
      await runtimeRepository.incrementRestartCount(req.runtime_id)

      publishEvent(RuntimeEvent.RESTARTED, {
        runtimeId: req.runtime_id,
        restartCount: runtime.restart_count + 1
      })

      return {
        runtime_id: req.runtime_id,
        status: RuntimeStatus.RUNNING,
        message: 'Runtime restarted successfully'
      }
    } catch (err) {
      logger.error({ err, runtimeId: req.runtime_id }, 'Failed to restart runtime')
      await runtimeRepository.updateRuntimeStatus(req.runtime_id, RuntimeStatus.FAILED, HealthStatus.UNHEALTHY)
      throw err
    }
  }


  async deleteRuntime(req: DeleteRuntimeRequest): Promise<DeleteRuntimeResponse> {
    logger.info({ runtimeId: req.runtime_id }, 'Deleting runtime')

    const runtime = await runtimeRepository.getRuntime(req.runtime_id)
    if (!runtime) {
      throw new Error(`Runtime not found: ${req.runtime_id}`)
    }

    try {
      if (runtime.railway_project_id) {
        logger.info({ projectId: runtime.railway_project_id }, 'Deleting Railway project')
        await railwayClient.deleteProject(runtime.railway_project_id)
      }

      await runtimeRepository.updateRuntimeStatus(req.runtime_id, RuntimeStatus.DELETED, HealthStatus.UNKNOWN)

      publishEvent(RuntimeEvent.DELETED, {
        runtimeId: req.runtime_id,
        deploymentId: req.deployment_id
      })

      return {
        success: true,
        message: 'Runtime deleted successfully'
      }
    } catch (err) {
      logger.error({ err, runtimeId: req.runtime_id }, 'Failed to delete runtime')
      throw err
    }
  }

 
  async getRuntimeStatus(req: GetRuntimeStatusRequest): Promise<GetRuntimeStatusResponse> {
    logger.info({ runtimeId: req.runtime_id }, 'Retrieving runtime status')

    const runtime = await runtimeRepository.getRuntime(req.runtime_id)
    if (!runtime) {
      throw new Error(`Runtime not found: ${req.runtime_id}`)
    }

    const agents = await runtimeRepository.getAgentsByRuntime(req.runtime_id)

    const agentStatuses: AgentStatus[] = (agents || []).map((agent) => ({
      agent_id: agent.name,
      agent_url: agent.agent_url,
      health: runtime.health as HealthStatus
    }))

    return {
      runtime_id: req.runtime_id,
      status: runtime.status as RuntimeStatus,
      overall_health: runtime.health as HealthStatus,
      last_checked_at: runtime.updated_at ? runtime.updated_at.toISOString() : runtime.created_at.toISOString(),
      agents: agentStatuses
    }
  }
}

export const runtimeService = new RuntimeService()
