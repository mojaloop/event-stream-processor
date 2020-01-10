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

const clientOptions = Config.CACHE.CATBOX_MEMORY
let client
const schedulers = {}

const initializeCache = async () => {
  client = new Catbox.Client(CatboxMemory, clientOptions)
  await client.start()
  return true
}

const getKey = (traceId, tags) => {
  const incomingVendor = (!!tags && !!tags.tracestate) ? (tags.tracestate).split(',')[0].split('=')[0] : null
  return {
    segment: `${Config.CACHE.segment}`,
    id: incomingVendor ? `${traceId}_${incomingVendor}` : traceId
  }
}

const updateTraceToCache = async (key, trace) => {
  try {
    const currentTrace = await client.get(key)
    if (currentTrace && (currentTrace.ttl > (Config.CACHE.ttl - Config.CACHE.expectSpanTimeout) && schedulers[key.id] && schedulers[key.id].id)) schedulers[key.id].unsubscribe()
    await client.set(key, trace, Config.CACHE.ttl)
    schedulers[key.id] = Rx.asyncScheduler.schedule(finishStaleTrace, Config.CACHE.expectSpanTimeout, key.id)
  } catch (e) {
    Logger.error(e.stack)
  }
}

const extractContextObservable = ({ message }) => {
  console.log(Date.now().toLocaleString())
  return Rx.Observable.create(observable => {
    try {
      Logger.debug(`Received event message :: Payload: \n${JSON.stringify(message.value, null, 2)}`)
      Logger.info(`Received Event :: transactionId: ${message.value.metadata.trace.tags.transactionId} :: type: ${message.value.metadata.trace.tags.transactionType} :: action: ${message.value.metadata.trace.tags.transactionAction} *** Span :: traceId: ${message.value.metadata.trace.traceId} :: spanId: ${message.value.metadata.trace.spanId} :: tracestate: ${message.value.metadata.trace.tags.tracestate}`)
      const spanContext = Tracer.extractContextFromMessage(message.value)
      observable.next({ spanContext, state: message.value.metadata.event.state, content: message.value.content })
    } catch (e) {
      Logger.error(e.stack)
      observable.error(e)
    }
  })
}

const cacheSpanContextObservable = ({ spanContext, state, content }) => {
  return Rx.Observable.create(async observable => {
    const { traceId, parentSpanId, tags, service, spanId } = spanContext
    const key = getKey(traceId, tags)
    const isStartSpan = () => {
      const { transactionType, transactionAction } = tags
      if (Config.SPAN.START_CRITERIA[transactionType]) {
        for (const criteria of Config.SPAN.START_CRITERIA[transactionType]) {
          if (criteria[transactionAction] && (criteria[transactionAction].service === service)) {
            return true
          }
        }
      }
      return false
    }

    try {
      let cachedTrace = await client.get(key)
      let cachedTraceItem
      if ((!isStartSpan() && !parentSpanId) || (!!parentSpanId && !cachedTrace)) {
        sendSpanToApm({ spanContext, state, content })
        return observable.complete()
      } else {
        if (!cachedTrace) cachedTrace = { item: { spans: {}, masterSpan: null, lastSpan: null } }
        cachedTraceItem = cachedTrace.item
        if (!parentSpanId) {
          const newSpanId = crypto.randomBytes(8).toString('hex')
          const newChildContext = merge({ parentSpanId: newSpanId }, { ...spanContext })
          const newMasterSpanContext = merge({ tags: { ...tags, masterSpan: newSpanId } }, { ...spanContext }, { spanId: newSpanId, service: `master-${tags.transactionType}` })
          cachedTraceItem.spans[newSpanId] = { spanContext: newMasterSpanContext, state, content }
          cachedTraceItem.masterSpan = newMasterSpanContext
          spanContext = newChildContext
        }
        cachedTraceItem.spans[spanId] = { spanContext, state, content }
        await updateTraceToCache(key, cachedTraceItem, traceId)
        observable.next({ traceId, tags, spanId })
      }
      // await client.set(key, cachedTrace, Config.CACHE.ttl)
    } catch (e) {
      Logger.error(e.stack)
      observable.error(e)
    }
  })
}

const findLastSpanObservable = ({ traceId, tags, latestSpanId }) => {
  return Rx.Observable.create(async observable => {
    const key = getKey(traceId, tags)

    const cachedTrace = (await client.get(key)).item
    if (!cachedTrace) {
      return observable.complete()
    }
    const sortedSpans = Array.from(Object.entries(cachedTrace.spans)).sort((a, b) => a[1].spanContext.startTimestamp > b[1].spanContext.startTimestamp ? -1 : a[1].spanContext.startTimestamp < b[1].spanContext.startTimestamp ? 1 : 0)
    for (const spanKey of sortedSpans) {
      const { spanContext, state, content } = cachedTrace.spans[spanKey[0]]
      const { parentSpanId, tags, service, spanId } = spanContext
      const { status, code } = state
      const parentSpan = cachedTrace.spans[parentSpanId]
      if (!parentSpan) continue
      const parentSpanTags = parentSpan ? parentSpan.spanContext.tags : null
      const errorTags = ('errorCode' in parentSpanTags)
        ? { errorCode: parentSpanTags.errorCode }
        : ('code' in parentSpan.state && parentSpan.state.status === EventStatusType.failed)
          ? { errorCode: parentSpan.state.code }
          : null
      const masterTags = ('masterSpan' in parentSpanTags) ? { masterSpan: parentSpanTags.masterSpan } : null
      const tagsToApply = merge({ ...errorTags }, { tags: { ...tags, ...masterTags } })
      cachedTrace.spans[spanId] = { spanContext: merge(tagsToApply, { ...spanContext }), state, content }

      const isLastSpan = () => {
        const { transactionAction, transactionType } = tags
        const isError = (!!(code) && status === EventStatusType.failed) || !!errorTags
        if (Config.SPAN.END_CRITERIA[transactionType]) {
          for (const criteria of Config.SPAN.END_CRITERIA[transactionType]) {
            if (criteria[transactionAction]) {
              if (criteria[transactionAction].service === service) {
                if (('isError' in criteria[transactionAction]) && criteria[transactionAction].isError && isError) {
                  return true
                } else if (!('isError' in criteria[transactionAction])) {
                  return true
                }
              }
            }
          }
        }
        return false
      }

      if (isLastSpan() || Config.SPAN.END_CRITERIA.exceptionList.includes(service)) { // TODO remove exceptionList when all traces have right tags
        cachedTrace.lastSpan = spanContext
        await updateTraceToCache(key, cachedTrace, traceId)
        return observable.next({ traceId, tags })
      }
    }
    await updateTraceToCache(key, cachedTrace, traceId)
    observable.complete()
  })
}

const recreateTraceObservable = ({ traceId, tags }) => {
  const key = getKey(traceId, tags)
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
      Logger.error(e.stack)
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
  Logger.info(`Send span to APM :: traceId: ${traceId} :: spanId: ${spanId} :: parentSpanId: ${parentSpanId} :: flags: ${flagsBuffer.toString('hex')} *** Event :: type: ${tags.transactionType} :: action: ${tags.transactionAction}`)
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
  const { traceId, tags } = trace[0].spanContext
  const key = getKey(traceId, tags)
  return Rx.Observable.create(async observable => {
    try {
      for (const currentSpan of trace) {
        sendSpanToApm(currentSpan)
      }
      await client.drop(key)
      if (schedulers[traceId]) {
        schedulers[traceId].unsubscribe()
        delete schedulers[traceId]
      }
      observable.next(traceId)
    } catch (e) {
      Logger.error(e.stack)
      observable.error(e)
    }
  })
}

const finishStaleTrace = async (keyId) => {
  const key = {
    segment: `${Config.CACHE.segment}`,
    id: keyId
  }
  try {
    const cachedTraceElement = await client.get(key)
    if (!cachedTraceElement) return
    const cachedTrace = cachedTraceElement.item
    const sortedSpans = Array.from(Object.values(cachedTrace.spans)).sort((a, b) => b.spanContext.startTimestamp > a.spanContext.startTimestamp ? -1 : b.spanContext.startTimestamp < a.spanContext.startTimestamp ? 1 : 0)
    const resultTrace = []
    cachedTrace.lastSpan = sortedSpans[sortedSpans.length - 1].spanContext
    for (const spanId in sortedSpans) {
      const span = sortedSpans[spanId]
      if (span.spanContext.service === `master-${span.spanContext.tags.transactionType}`) {
        span.spanContext.finishTimestamp = sortedSpans[sortedSpans.length - 1].spanContext.finishTimestamp
        span.spanContext.tags.staleTrace = true
        resultTrace.unshift(span)
        continue
      } else if (cachedTrace.lastSpan && span.spanContext.spanId === cachedTrace.lastSpan.spanId) {
        resultTrace.push(span)
        break
      } else if (sortedSpans[Number(spanId) + 1].spanContext.parentSpanId === span.spanContext.spanId) {
        resultTrace.push(span)
        continue
      } else {
        span.spanContext.tags.missingParent = true
        sortedSpans[Number(spanId) + 1].spanContext.parentSpanId = span.spanContext.spanId
        resultTrace.push(span)
      }
    }
    for (const span of resultTrace) {
      sendSpanToApm(span)
    }
    delete schedulers[keyId]
    await client.drop(key)
  } catch (e) {
    Logger.error(e.stack)
  }
}

module.exports = {
  extractContextObservable,
  initializeCache,
  findLastSpanObservable,
  cacheSpanContextObservable,
  recreateTraceObservable,
  sendTraceToApmObservable
}
