import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { DeleteRuntimeRequest, DeleteRuntimeResponse } from '../../types/grpc.types.js'
import { runtimeService } from '../../registry/runtime.service.js'

export async function deleteRuntimeHandler(
  call: ServerUnaryCall<DeleteRuntimeRequest, DeleteRuntimeResponse>,
  callback: sendUnaryData<DeleteRuntimeResponse>
): Promise<void> {
  const result = await runtimeService.deleteRuntime(call.request)
  callback(null, result)
}
