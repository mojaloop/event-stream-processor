const Rx = require('rxjs')
const Logger = require('@mojaloop/central-services-logger')
const crypto = require('crypto')
const Config = require('../lib/config')
const Catbox = require('@hapi/catbox')
const CatboxMemory = require('@hapi/catbox-memory')
const TraceParent = require('traceparent')
const deserializeError = require('deserialize-error')
const { Tracer, EventStatusType } = require('@mojaloop/event-sdk')
const { merge } = require('lodash')
const { tracer } = require('../lib/tracer')

const partition = 'endpoint-cache'
const clientOptions = { partition }
let client

const initializeCache = async () => {
  client = new Catbox.Client(CatboxMemory, clientOptions)
  await client.start()
  return true
}

const extractContextObservable = ({ message }) => {
  Logger.info(`Received trace :: Payload: \n${JSON.stringify(message.value, null, 2)}`)
  return Rx.Observable.create(observable => {
    try {
      const spanContext = Tracer.extractContextFromMessage(message.value)
      observable.next({ spanContext, state: message.value.metadata.event.state, content: message.value.content })
    } catch (e) {
      Logger.error(e)
      observable.error(e)
    }
  })
}

const cacheSpanContextObservable = ({ spanContext, state, content }) => {
  return Rx.Observable.create(async observable => {
    const { traceId, parentSpanId, tags, service, spanId } = spanContext
    const { status, code } = state

    const key = {
      segment: `${Config.CACHE.segment}`,
      id: traceId
    }
    const isCached = () => {
      const { tags, service } = spanContext
      const { transactionType, transactionAction } = tags
      for (const criteria of Config.SPAN.START_CRITERIA[transactionType]) {
        if (criteria[transactionAction] && (criteria[transactionAction].service === service)) {
          return true
        }
      }
      return false
    }

    try {
      let cachedTrace = await client.get(key)
      if ((!isCached() && !parentSpanId) || (!!parentSpanId && !cachedTrace)) {
        sendSpanToApm({ spanContext, state, content })
        observable.complete()
      } else {
        if (!cachedTrace) cachedTrace = { item: { spans: {}, master: null, lastSpan: null } }
        cachedTrace = cachedTrace.item
        if (!parentSpanId) {
          const newSpanId = crypto.randomBytes(8).toString('hex')
          const newChildContext = merge({ parentSpanId: newSpanId }, { ...spanContext })
          const newMasterSpanContext = merge({ tags: { ...tags, masterSpan: newSpanId } }, { ...spanContext }, { spanId: newSpanId, service: `master-${tags.transactionType}` })
          cachedTrace.spans[newSpanId] = { spanContext: newMasterSpanContext, state, content }
          cachedTrace.masterSpan = newMasterSpanContext
          spanContext = newChildContext
        }
        const parentSpanTags = cachedTrace.spans[spanContext.parentSpanId].spanContext.tags
        const errorTags = ('errorCode' in parentSpanTags) ? { errorCode: parentSpanTags.errorCode } : null
        const masterTags = ('masterSpan' in parentSpanTags) ? { masterSpan: parentSpanTags.masterSpan } : null
        const tagsToApply = merge({ ...errorTags }, { tags: { ...tags, ...masterTags } })
        cachedTrace.spans[spanId] = { spanContext: merge(tagsToApply, { ...spanContext }), state, content }

        const isLastSpan = () => {
          const { transactionAction, transactionType } = tags
          const isError = (!!(code) && status === EventStatusType.failed) || errorTags
          for (const criteria of Config.SPAN.END_CRITERIA[transactionType]) {
            if (criteria[transactionAction]) {
              if (('isError' in criteria[transactionAction]) && criteria[transactionAction].isError && isError) {
                return true
              } else if (!('isError' in criteria[transactionAction]) && criteria[transactionAction].service === service) {
                return true
              }
            }
          }
          return false
        }

        if (isLastSpan() || Config.SPAN.END_CRITERIA.exceptionList.includes(service)) { // TODO remove exceptionList when all traces have right tags
          cachedTrace.lastSpan = spanContext
        }
        await client.set(key, cachedTrace, Config.CACHE.ttl)
        observable.next(traceId)
      }
    } catch (e) {
      Logger.error(e)
      observable.error(e)
    }
  })
}

const recreateTraceObservable = (traceId) => {
  const key = {
    segment: `${Config.CACHE.segment}`,
    id: traceId
  }
  return Rx.Observable.create(async observable => {
    try {
      const cachedTrace = (await client.get(key)).item
      if (cachedTrace.lastSpan && cachedTrace.masterSpan) {
        let currentSpan = cachedTrace.spans[cachedTrace.lastSpan.spanId]
        const resultTrace = [currentSpan]
        for (let i = 0; i < Object.keys(cachedTrace.spans).length; i++) {
          const parentSpan = cachedTrace.spans[currentSpan.spanContext.parentSpanId]
          if (!parentSpan) break
          resultTrace.unshift(parentSpan)
          currentSpan = parentSpan
        }
        if (cachedTrace.masterSpan.spanId === currentSpan.spanContext.spanId) {
          resultTrace[0].spanContext.finishTimestamp = resultTrace[resultTrace.length - 1].spanContext.finishTimestamp
          observable.next(resultTrace)
        }
      }
    } catch (e) {
      Logger.error(e)
      observable.error(e)
    }
  })
}

const sendSpanToApm = currentSpan => {
  const { service, traceId, parentSpanId, spanId, startTimestamp, finishTimestamp, flags, tags = {}, version = 0 } = currentSpan.spanContext
  const { status, code, description } = currentSpan.state
  const { content } = currentSpan
  const versionBuffer = Buffer.alloc(1).fill(version)
  const flagsBuffer = Buffer.alloc(1).fill(flags | 0x01)
  const traceIdBuffer = Buffer.from(traceId, 'hex')
  const spanIdBuffer = Buffer.from(spanId, 'hex')
  const parentSpanIdBuffer = parentSpanId && Buffer.from(parentSpanId, 'hex')
  Logger.info(`version: ${versionBuffer.toString('hex')} traceId: ${traceId} spanId: ${spanId} parentSpanId: ${parentSpanId} flags: ${flagsBuffer.toString('hex')}`)
  const context =
    parentSpanIdBuffer
      ? new TraceParent(Buffer.concat([versionBuffer, traceIdBuffer, spanIdBuffer, flagsBuffer, parentSpanIdBuffer]))
      : new TraceParent(Buffer.concat([versionBuffer, traceIdBuffer, spanIdBuffer, flagsBuffer]))
  const span = tracer.startSpan(`${service}`, { startTime: Date.parse(startTimestamp), tags }, context)
  if (status === EventStatusType.failed) {
    span.setTag('error', true)
    !!code && span.setTag('errorCode', code)
    !!description && span.setTag('errorDescription', `error code: ${code} :: description: ${description}`)
    if (!content.error) {
      const passedError = content.payload ? new Error(content.payload) : Object.assign(new Error(description), content)
      span.log({
        event: 'error',
        'error.object': passedError
      })
    } else {
      span.log({
        event: 'error',
        'error.object': deserializeError(content.error)
      })
    }
  }
  span.finish(Date.parse(finishTimestamp))
  return currentSpan
}

const sendTraceToApmObservable = (trace) => {
  const traceId = trace[0].spanContext.traceId
  const key = {
    segment: `${Config.CACHE.segment}`,
    id: traceId
  }
  return Rx.Observable.create(async observable => {
    try {
      for (const currentSpan of trace) {
        sendSpanToApm(currentSpan)
      }
      await client.drop(key)
      observable.next(traceId)
    } catch (e) {
      Logger.error(e)
      observable.error(e)
    }
  })
}

module.exports = {
  extractContextObservable,
  initializeCache,
  cacheSpanContextObservable,
  recreateTraceObservable,
  sendTraceToApmObservable
}
