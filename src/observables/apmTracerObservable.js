const Rx = require('rxjs')
const Logger = require('@mojaloop/central-services-logger')
const { Tracer } = require('@mojaloop/event-sdk')
const { cacheSpanContext } = require('../lib/masterSpan')

const apmTracerObservable = ({ message }) => {
  Logger.info(`Received trace :: Payload: \n${JSON.stringify(message.value, null, 2)}`)
  return Rx.Observable.create(async observable => {
    try {
      const spanContext = Tracer.extractContextFromMessage(message.value)
      await cacheSpanContext(spanContext, message.value.metadata.event.state, message.value.content)
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
