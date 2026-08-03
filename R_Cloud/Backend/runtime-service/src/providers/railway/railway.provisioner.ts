import { railwayClient } from './railway.client.js'
import { CreateRuntimeRequest } from '../../types/grpc.types.js'
import { ProvisionResult, DeployedService } from '../../types/provider.types.js'
import { logger } from '../../telemetry/logger.js'
import { db } from '../../database/postgres.js'


async function waitForDeployment(serviceId: string, environmentId: string): Promise<void> {
  const timeoutMs = 10 * 60 * 1000 // 10 minutes 
  const intervalMs = 10000 
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await railwayClient.getLatestDeploymentStatus(serviceId, environmentId)
      logger.info({ serviceId, status }, 'Polling Railway deployment status')

      if (status === 'SUCCESS') {
        logger.info({ serviceId }, 'Railway deployment succeeded!')
        return
      }

      if (status === 'FAILED' || status === 'CRASHED') {
        throw new Error(`Railway build/deploy failed with status: ${status}`)
      }
    } catch (err) {
      logger.warn({ err, serviceId }, 'Error polling deployment status, retrying...')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('Railway deployment timed out')
}


async function getDeploymentRepoInfo(deploymentId: string): Promise<{ repoUrl: string; branch: string }> {
  const query = `
    SELECT p.github_repo_url as "repoUrl", d.branch
    FROM deployments d
    JOIN projects p ON d.project_id = p.id
    WHERE d.id = $1
    LIMIT 1;
  `
  const result = await db.query(query, [deploymentId])
  if (result.rows.length === 0) {
    throw new Error(`Deployment metadata not found for ID: ${deploymentId}`)
  }

  const row = result.rows[0]
  if (!row.repoUrl) {
    throw new Error(`GitHub repository URL is missing for deployment: ${deploymentId}`)
  }

  return {
    repoUrl: row.repoUrl,
    branch: row.branch || 'main'
  }
}


export async function provisionMonolith(req: CreateRuntimeRequest): Promise<ProvisionResult> {
  logger.info({ deploymentId: req.deployment_id }, 'Provisioning Monolith Runtime on Railway')

  const { repoUrl, branch } = await getDeploymentRepoInfo(req.deployment_id)

  const projectName = `rcloud-monolith-${req.deployment_id.substring(0, 8)}`
  const { projectId, environmentId } = await railwayClient.createProject(projectName)
  logger.info({ projectId, environmentId }, 'Created Railway project')

  
  const startCommand = req.start_command || 'python app.py'
  const serviceId = await railwayClient.createService(projectId, repoUrl, branch, startCommand)
  logger.info({ serviceId }, 'Created Railway service')

  if (req.environment && Object.keys(req.environment).length > 0) {
    await railwayClient.setEnvironmentVariables(projectId, environmentId, serviceId, req.environment)
    logger.info('Injected environment variables')
  }

  const domain = await railwayClient.createServiceDomain(environmentId, serviceId)
  const serviceUrl = `https://${domain}`
  logger.info({ serviceUrl }, 'Provisioned public domain')

  await waitForDeployment(serviceId, environmentId)

  const deployedService: DeployedService = {
    name: 'main',
    serviceId,
    url: serviceUrl   
  }

  return {
    projectId,
    environmentId,
    services: [deployedService]
  }
}



export async function provisionMicroservices(req: CreateRuntimeRequest): Promise<ProvisionResult> {
  logger.info({ deploymentId: req.deployment_id }, 'Provisioning Microservices Runtime on Railway')

  const { repoUrl, branch } = await getDeploymentRepoInfo(req.deployment_id)

  // 1. Create a single Railway project for the entire collection of agents
  const projectName = `rcloud-micro-${req.deployment_id.substring(0, 8)}`
  const { projectId, environmentId } = await railwayClient.createProject(projectName)
  logger.info({ projectId, environmentId }, 'Created Railway project for microservices')

  const deployedServices: DeployedService[] = []

  // 2. Provision each agent service independently inside the project
  for (const svcPlan of req.services) {
    logger.info({ agentName: svcPlan.name }, 'Provisioning service for agent')
    
    // The start command runs the specific agent entrypoint
    const startCommand = `python ${svcPlan.entrypoint}`
    const serviceId = await railwayClient.createService(projectId, repoUrl, branch, startCommand)

    // Set env variables
    if (req.environment && Object.keys(req.environment).length > 0) {
      await railwayClient.setEnvironmentVariables(projectId, environmentId, serviceId, req.environment)
    }

    // Set public domain
    const domain = await railwayClient.createServiceDomain(environmentId, serviceId)
    const serviceUrl = `https://${domain}`

    deployedServices.push({
      name: svcPlan.name,
      serviceId,
      url: serviceUrl
    })
  }

  // 3. Wait for all agents to build and deploy successfully
  logger.info('Waiting for all microservices deployments to finish...')
  await Promise.all(
    deployedServices.map((s) => waitForDeployment(s.serviceId, environmentId))
  )

  return {
    projectId,
    environmentId,
    services: deployedServices
  }
}
