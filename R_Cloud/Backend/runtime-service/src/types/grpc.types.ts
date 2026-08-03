import { RuntimeStatus, HealthStatus } from '../constants/runtime.constants.js'

export interface ServicePlan {
  name: string
  entrypoint: string
  execute_route: string
  health_route: string
  metadata_route: string
}

export interface CreateRuntimeRequest {
  deployment_id: string
  provider: string
  mode: string
  runtime: string
  framework: string
  build_command: string
  start_command: string
  environment: Record<string, string>
  services: ServicePlan[]
}

export interface DeployedAgent {
  agent_id: string
  agent_url: string
}

export interface CreateRuntimeResponse {
  runtime_id: string
  status: RuntimeStatus
  agents: DeployedAgent[]
}

export interface StopRuntimeRequest {
  runtime_id: string
  deployment_id: string
}

export interface StopRuntimeResponse {
  runtime_id: string
  status: RuntimeStatus
  message: string
}

export interface RestartRuntimeRequest {
  runtime_id: string
  deployment_id: string
}

export interface RestartRuntimeResponse {
  runtime_id: string
  status: RuntimeStatus
  message: string
}

export interface DeleteRuntimeRequest {
  runtime_id: string
  deployment_id: string
}

export interface DeleteRuntimeResponse {
  success: boolean
  message: string
}

export interface GetRuntimeStatusRequest {
  runtime_id: string
  deployment_id: string
}

export interface AgentStatus {
  agent_id: string
  agent_url: string
  health: HealthStatus
}

export interface GetRuntimeStatusResponse {
  runtime_id: string
  status: RuntimeStatus
  overall_health: HealthStatus
  last_checked_at: string
  agents: AgentStatus[]
}
