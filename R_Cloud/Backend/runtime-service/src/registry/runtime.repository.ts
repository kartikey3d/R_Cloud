import { db } from '../database/postgres.js'
import { RuntimeStatus, HealthStatus } from '../constants/runtime.constants.js'

export class RuntimeRepository {
  
  async createRuntime(
    deploymentId: string,
    railwayProjectId: string
  ) {
    const query = `
      INSERT INTO runtime_registry (
        deployment_id, 
        provider, 
        railway_project_id, 
        status, 
        health
      ) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *;
    `
    
    const values = [
      deploymentId,
      'railway',
      railwayProjectId,
      RuntimeStatus.CREATING, 
      HealthStatus.STARTING   
    ]

    const result = await db.query(query, values)
    return result.rows[0] 
  }

  async createAgent(
    runtimeId: string,
    name: string,
    agentUrl: string,
    railwayServiceId: string
  ) {
    const query = `
      INSERT INTO agent_registry (
        runtime_id,
        name,
        agent_url,
        railway_service_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `
    const values = [runtimeId, name, agentUrl, railwayServiceId]
    const result = await db.query(query, values)
    return result.rows[0]
  }
  async getRuntime(runtimeId: string) {
    const query = 'SELECT * FROM runtime_registry WHERE id = $1 LIMIT 1;'
    const result = await db.query(query, [runtimeId])
    return result.rows[0]
  }

  async getAgentsByRuntime(runtimeId: string) {
    const query = 'SELECT * FROM agent_registry WHERE runtime_id = $1;'
    const result = await db.query(query, [runtimeId])
    return result.rows
  }

  async updateRuntimeStatus(runtimeId: string, status: RuntimeStatus, health?: HealthStatus) {
    let query = ''
    let values = []
    
    if (health) {
      query = 'UPDATE runtime_registry SET status = $1, health = $2, updated_at = NOW() WHERE id = $3 RETURNING *;'
      values = [status, health, runtimeId]
    } else {
      query = 'UPDATE runtime_registry SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;'
      values = [status, runtimeId]
    }
    
    const result = await db.query(query, values)
    return result.rows[0]
  }

  async updateAgentMetadata(agentId: string, framework: string, version: string, capabilities: string[]) {
    const query = `
      UPDATE agent_registry 
      SET framework = $1, version = $2, capabilities = $3 
      WHERE id = $4 
      RETURNING *;
    `
    const values = [framework, version, capabilities, agentId]
    const result = await db.query(query, values)
    return result.rows[0]
  }

  async getActiveRuntimes() {
    const query = 'SELECT * FROM runtime_registry WHERE status = $1;'
    const result = await db.query(query, [RuntimeStatus.RUNNING])
    return result.rows
  }

  async incrementRestartCount(runtimeId: string) {
    const query = 'UPDATE runtime_registry SET restart_count = restart_count + 1, updated_at = NOW() WHERE id = $1 RETURNING *;'
    const result = await db.query(query, [runtimeId])
    return result.rows[0]
  }
}

export const runtimeRepository = new RuntimeRepository()
