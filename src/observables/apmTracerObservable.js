const Rx = require('rxjs')
const Logger = require('@mojaloop/central-services-logger')
const { Tracer } = require('@mojaloop/event-sdk')
const { cacheSpanContext, createTrace } = require('../lib/masterSpan')

const apmTracerObservable = ({ message }) => {
  return Rx.Observable.create(async observable => {
    try {
      const spanCtx = Tracer.extractContextFromMessage(message.value)
      await cacheSpanContext(spanCtx, message.value.metadata.event.state, message.value.content)
      if (spanCtx.service === 'final service') {
        await createTrace(spanCtx.traceId)
      }
      observable.next(true)
    } catch (e) {
      Logger.error(e)
      observable.error(e)
    }
  })
}

module.exports = {
  apmTracerObservable
}
