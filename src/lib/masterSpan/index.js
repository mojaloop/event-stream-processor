const Catbox = require('@hapi/catbox')
const CatboxMemory = require('@hapi/catbox-memory')
const { merge } = require('lodash')
const crypto = require('crypto')
const deserializeError = require('deserialize-error')
const Logger = require('@mojaloop/central-services-logger')
const { EventStatusType } = require('@mojaloop/event-sdk')
const { tracer } = require('../tracer')
const Config = require('../config')
const partition = 'endpoint-cache'
const clientOptions = { partition }
let client

const initializeCache = async (policyOptions) => {
  try {
    client = new Catbox.Client(CatboxMemory, clientOptions)
    await client.start()
    return true
  } catch (err) {
    throw (err)
  }
}

const cacheSpanContext = async (spanContext, state, content) => {
  try {
    const { traceId, parentSpanId, tags, service } = spanContext

    const key = {
      segment: 'master-span',
      id: traceId
    }

    let trace = await client.get(key)

    const isFulfil = () => {
      return (service === 'ml_notification_event' && tags.transactionType === 'transfer' && tags.transactionAction === 'fulfil')
    }

    const isPrepareError = () => {
      return (
        service === 'ml_notification_event' &&
        tags.transactionType === 'transfer' &&
        tags.transactionAction === 'prepare' &&
        (!!tags.errorCode || (!!trace && !!trace[trace.length - 1].spanContext.tags.errorCode)))
    }

    const isLastSpan = () => {
      return (isPrepareError() || isFulfil() || service === 'final service')
    }

    const newSpanId = crypto.randomBytes(8).toString('hex')
    if (!parentSpanId) {
      const newChildContext = merge({ parentSpanId: newSpanId }, { ...spanContext })
      const newMasterSpanContext = merge({ tags: { ...tags, masterSpan: newSpanId } }, { ...spanContext }, { spanId: newSpanId, service: 'master-span' })
      await client.set(key, [{ spanContext: newMasterSpanContext, state, content }], Config.CACHE.ttl)
      return cacheSpanContext(newChildContext, state)
    }
    let masterTags = (trace && trace[0]) ? trace[0].tags : { masterSpan: newSpanId }
    trace.item.push({spanContext: merge({tags: { ...tags, masterSpan: masterTags['masterSpan'] }}, { ...spanContext }), state, content})
    await client.set(key, trace.item, Config.CACHE.ttl)
    if (isLastSpan()) return createTrace(traceId)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

const createTrace = async (traceId) => {
  try {
    const key = {
      segment: 'master-span',
      id: traceId
    }
    let spans = []
    const trace = await client.get(key)
    trace.item[0].spanContext.finishTimestamp = trace.item[trace.item.length - 1].spanContext.finishTimestamp
    for (let currentSpanId in trace.item) {
      let currentSpan = trace.item[currentSpanId]
      const { service, parentSpanId, startTimestamp, finishTimestamp, tags = {} } = currentSpan.spanContext
      const { status, code, description } = currentSpan.state
      const { content } = currentSpan
      let span
      if (parentSpanId) {
        span = tracer.startSpan(`${service}`, { startTime: Date.parse(startTimestamp), childOf: spans[currentSpanId - 1].span.context(), tags })
      } else {
        span = tracer.startSpan(`${service}`, { startTime: Date.parse(startTimestamp), tags })
      }
      if (status === EventStatusType.failed) {
        span.setTag('error', true)
        !!code && span.setTag('errorCode', code)
        !!description && span.setTag('errorDescription', `error code: ${code} :: description: ${description}`)
        if (!content.error) {
          let passedError = content.payload ? new Error(content.payload) : Object.assign(new Error(description), content)
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
      spans.push({span, finishTimestamp})
    }
    for (let span of spans) {
      span.span.finish(Date.parse(span.finishTimestamp))
    }
    await client.drop(key)
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

module.exports = {
  initializeCache,
  cacheSpanContext,
  createTrace
}
