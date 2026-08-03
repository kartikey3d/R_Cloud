import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { RestartRuntimeRequest, RestartRuntimeResponse } from '../../types/grpc.types.js'
import { runtimeService } from '../../registry/runtime.service.js'

export async function restartRuntimeHandler(
  call: ServerUnaryCall<RestartRuntimeRequest, RestartRuntimeResponse>,
  callback: sendUnaryData<RestartRuntimeResponse>
): Promise<void> {
  const result = await runtimeService.restartRuntime(call.request)
  callback(null, result)
}
