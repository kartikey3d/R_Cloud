import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { CreateRuntimeRequest, CreateRuntimeResponse } from '../../types/grpc.types.js'
import { runtimeService } from '../../registry/runtime.service.js'

export async function createRuntimeHandler(call: ServerUnaryCall<CreateRuntimeRequest, CreateRuntimeResponse>, callback: sendUnaryData<CreateRuntimeResponse>): Promise<void> {
  const result = await runtimeService.createRuntime(call.request)
  callback(null, result)
}
