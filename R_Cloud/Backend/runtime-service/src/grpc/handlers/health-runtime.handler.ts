import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { GetRuntimeStatusRequest, GetRuntimeStatusResponse } from '../../types/grpc.types.js'
import { runtimeService } from '../../registry/runtime.service.js'

export async function healthRuntimeHandler(
  call: ServerUnaryCall<GetRuntimeStatusRequest, GetRuntimeStatusResponse>,
  callback: sendUnaryData<GetRuntimeStatusResponse>
): Promise<void> {
  const result = await runtimeService.getRuntimeStatus(call.request)
  callback(null, result)
}

export { healthRuntimeHandler as getRuntimeStatusHandler }
