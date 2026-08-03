import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { StopRuntimeRequest, StopRuntimeResponse } from '../../types/grpc.types.js'
import { runtimeService } from '../../registry/runtime.service.js'

export async function stopRuntimeHandler(
  call: ServerUnaryCall<StopRuntimeRequest, StopRuntimeResponse>,
  callback: sendUnaryData<StopRuntimeResponse>
): Promise<void> {
  const result = await runtimeService.stopRuntime(call.request)
  callback(null, result)
}
