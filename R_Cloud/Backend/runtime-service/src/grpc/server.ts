import path from 'path'
import { fileURLToPath } from 'url'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { config } from '../config/config.js'
import { logger } from '../telemetry/logger.js'
import { withInterceptors } from './interceptors/error.interceptor.js'

import { createRuntimeHandler } from './handlers/create-runtime.handler.js'
import { stopRuntimeHandler } from './handlers/stop-runtime.handler.js'
import { restartRuntimeHandler } from './handlers/restart-runtime.handler.js'
import { deleteRuntimeHandler } from './handlers/delete-runtime.handler.js'
import { healthRuntimeHandler } from './handlers/health-runtime.handler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROTO_PATH = path.resolve(__dirname, '../../../../proto/runtime.proto')

let server: grpc.Server | null = null

export async function startGrpcServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      logger.info({ protoPath: PROTO_PATH }, 'Loading protobuf definition')
      
      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      })

      const protoDescription = grpc.loadPackageDefinition(packageDefinition) as any
      const runtimeProto = protoDescription.rcloud.runtime

      if (!runtimeProto || !runtimeProto.RuntimeService) {
        throw new Error('RuntimeService not found in loaded package definitions')
      }

      server = new grpc.Server()

      server.addService(runtimeProto.RuntimeService.service, {
        CreateRuntime: withInterceptors('CreateRuntime', createRuntimeHandler),
        StopRuntime: withInterceptors('StopRuntime', stopRuntimeHandler),
        RestartRuntime: withInterceptors('RestartRuntime', restartRuntimeHandler),
        DeleteRuntime: withInterceptors('DeleteRuntime', deleteRuntimeHandler),
        GetRuntimeStatus: withInterceptors('GetRuntimeStatus', healthRuntimeHandler),
      })

      const port = `0.0.0.0:${config.GRPC_PORT}`
      server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
        if (err) {
          logger.error({ err }, 'Failed to bind gRPC server')
          reject(err)
          return
        }

        server?.start()
        logger.info({ port, boundPort }, 'gRPC server successfully started')
        resolve()
      })
    } catch (err) {
      logger.error({ err }, 'Failed to initialize gRPC server')
      reject(err)
    }
  })
}

export async function stopGrpcServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve()
      return
    }

    logger.info('Stopping gRPC server')
    server.tryShutdown((err) => {
      if (err) {
        logger.warn({ err }, 'Failed to shutdown gRPC server gracefully, forcing kill')
        server?.forceShutdown()
      }
      server = null
      logger.info('gRPC server stopped')
      resolve()
    })
  })
}
