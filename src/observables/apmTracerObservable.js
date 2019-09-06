const TraceParent = require('traceparent')
const Rx = require('rxjs')
const Logger = require('@mojaloop/central-services-shared').Logger
const { tracer } = require('../lib/tracer')
const deserializeError = require('deserialize-error')
// const serializeError = require('serialize-error')

const apmTracerObservable = ({ message }) => {
  return Rx.Observable.create(observable => {
    const { service, traceId, parentSpanId, spanId, startTimestamp, finishTimestamp, flags, tags } = message.value.metadata.trace
    const { status, code, description } = message.value.metadata.event.state
    const version = Buffer.alloc(1).fill(0)
    const flagsBuffer = Buffer.alloc(1).fill(flags | 0x01)
    const traceIdBuff = Buffer.from(traceId, 'hex')
    const spanIdBuff = Buffer.from(spanId, 'hex')
    const parentSpanIdBuff = parentSpanId && Buffer.from(parentSpanId, 'hex')
    Logger.info(`version: ${version.toString('hex')} traceId: ${traceId} spanId: ${spanId} parentSpanId: ${parentSpanId} flags: ${flagsBuffer.toString('hex')}`)
    const context = parentSpanIdBuff
      ? new TraceParent(Buffer.concat([version, traceIdBuff, spanIdBuff, flagsBuffer, parentSpanIdBuff]))
      : new TraceParent(Buffer.concat([version, traceIdBuff, spanIdBuff, flagsBuffer]))
    const span = tracer.startSpan(`${service}`, { startTime: Date.parse(startTimestamp) }, context)
    if (tags) {
      for (const [key, value] of Object.entries(tags)) {
        span.setTag(key, value)
      }
    }
    if (status === 'failed') { // TODO add the enums from EventSDK
      span.setTag('error', true)
      !!code && span.setTag('errorCode', code)
      !!description && span.setTag('errorDescription', `error code: ${code} :: description: ${description}`)
      if (!message.value.content.error) {
        const passedError = message.value.content.payload ? new Error(message.value.content.payload) : Object.assign(new Error(description), message.value.content)
        span.log({
          event: 'error',
          'error.object': passedError
        })
      } else {
        span.log({
          event: 'error',
          'error.object': deserializeError(message.value.content.error)
        })
        // span._span._agent.captureError(deserializeError(message.value.content.error))
      }
    }
    span.finish(Date.parse(finishTimestamp))
    observable.next({ span })
  })
}

module.exports = {
  apmTracerObservable
}
