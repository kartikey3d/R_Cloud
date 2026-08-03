import { status, ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'
import { BaseError } from '../../errors/base.error.js'
import { logger } from '../../telemetry/logger.js'
import { GrpcHandler, withLogger } from './logger.interceptor.js'


export function withError<Req, Res>(handler: GrpcHandler<Req, Res>,): GrpcHandler<Req, Res> {

  return async (call: ServerUnaryCall<Req, Res>, callback: sendUnaryData<Res>) => {
    try {
      await handler(call, callback)
    } catch (err: unknown) {
      if (err instanceof BaseError) {
        logger.error(
          {
            err,
            errorCode: err.code,
            grpcStatus: err.grpcStatus,
            details: err.details,
          },
          `Handled error in gRPC handler: ${err.message}`,
        )

        callback({
          code: err.grpcStatus,
          message: err.message,
        })
      } else {
        logger.error({ err }, 'Unhandled error in gRPC handler')

        callback({
          code: status.INTERNAL,
          message: 'An internal server error occurred',
        })
      }
    }
  }
}


export function withInterceptors<Req, Res>(methodName: string,handler: GrpcHandler<Req, Res>,): GrpcHandler<Req, Res> {
  return withLogger(methodName, withError(handler))
}
