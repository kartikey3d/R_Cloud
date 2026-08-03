export interface DeployedService {
  name: string
  serviceId: string
  url: string
}

export interface ProvisionResult {
  projectId: string
  environmentId: string
  services: DeployedService[]
}
