import { status, ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { logger } from '../../telemetry/logger.js'

export type GrpcHandler<Req, Res> = (
  call: ServerUnaryCall<Req, Res>,
  callback: sendUnaryData<Res>,
) => Promise<void>

export function withLogger<Req, Res>(
  methodName: string,
  handler: GrpcHandler<Req, Res>,
): GrpcHandler<Req, Res> {
  return async (call, callback) => {
    const start = Date.now()

    logger.info({ method: methodName }, 'gRPC call received')

    const wrappedCallback: sendUnaryData<Res> = (err, response, trailer, flags) => {
      const duration = Date.now() - start

      if (err) {
        const errorDetails = (err as any).details || (err as any).message || 'Unknown gRPC error'
        logger.warn(
          { method: methodName, duration, code: err.code, err: errorDetails },
          'gRPC call finished with error',
        )
      } else {
        logger.info({ method: methodName, duration }, 'gRPC call completed successfully')
      }

      callback(err, response, trailer, flags)
    }

    await handler(call, wrappedCallback)
  }
}
