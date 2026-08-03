import { CreateRuntimeRequest } from '../types/grpc.types.js'
import { ProvisionResult } from '../types/provider.types.js'
import { provisionMonolith, provisionMicroservices } from './railway/railway.provisioner.js'

export interface Provider {
  provision(req: CreateRuntimeRequest): Promise<ProvisionResult>
}

export const railwayProvider: Provider = {
  async provision(req: CreateRuntimeRequest): Promise<ProvisionResult> {
    if (req.mode.toUpperCase() === 'MICROSERVICES') {
      return provisionMicroservices(req)
    }
    return provisionMonolith(req)
  }
}

export function getProvider(name: string): Provider {
  const normalized = name.toLowerCase()
  if (normalized === 'railway') {
    return railwayProvider
  }
  throw new Error(`Unsupported provider: ${name}`)
}
