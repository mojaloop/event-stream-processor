const crypto = require('crypto')
const TraceParent = require('traceparent')
const Catbox = require('@hapi/catbox')
const CatboxMemory = require('@hapi/catbox-memory')
const deserializeError = require('deserialize-error')
const { merge } = require('lodash')
const Logger = require('@mojaloop/central-services-logger')
const { EventStatusType } = require('@mojaloop/event-sdk')
const { tracer } = require('../tracer')
const Config = require('../config')
const partition = 'endpoint-cache'
const clientOptions = { partition }
let client

const sleep = (ms) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

const initializeCache = async () => {
  client = new Catbox.Client(CatboxMemory, clientOptions)
  await client.start()
  return true
}

const cacheSpanContext = async (spanContext, state, content) => {
  const { traceId, parentSpanId, tags, service, spanId } = spanContext
  const { status, code } = state
  const newSpanId = crypto.randomBytes(8).toString('hex')

  const masterKey = {
    segment: `${Config.CACHE.segment}-${traceId}`,
    id: newSpanId
  }

  const parentKey = {
    segment: `${Config.CACHE.segment}-${traceId}`,
    id: parentSpanId
  }

  const key = {
    segment: `${Config.CACHE.segment}-${traceId}`,
    id: spanId
  }

  try {
    if (!parentSpanId) {
      const newChildContext = merge({ parentSpanId: newSpanId }, { ...spanContext })
      const newMasterSpanContext = merge({ tags: { ...tags, masterSpan: newSpanId } }, { ...spanContext }, { spanId: newSpanId, service: `master-${tags.transactionType}` })
      await client.set(masterKey, { spanContext: newMasterSpanContext, state, content }, Config.CACHE.ttl)
      return cacheSpanContext(newChildContext, state)
    }
    const parentSpan = !!parentSpanId && (await client.get(parentKey)).item.spanContext
    const parentSpanTags = parentSpan ? parentSpan.tags : null
    const errorTags = ('errorCode' in parentSpanTags) ? { errorCode: parentSpanTags.errorCode } : null
    const masterTags = ('masterSpan' in parentSpanTags) ? { masterSpan: parentSpanTags.masterSpan } : null
    const tagsToApply = merge({ ...errorTags }, { tags: { ...tags, ...masterTags } })

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

    await client.set(key, { spanContext: merge(tagsToApply, { ...spanContext }), state, content }, Config.CACHE.ttl)

    if (isLastSpan() || Config.SPAN.END_CRITERIA.exceptionList.includes(service)) { // TODO remove exceptionList when all traces have right tags
      const trace = await createTraceArray(traceId, spanId)
      const result = await createTrace(trace)
      return result
    }
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

const createTraceArray = async (traceId, lastSpanId) => {
  const segment = `${Config.CACHE.segment}-${traceId}`
  const key = { segment, id: lastSpanId }
  let lastSpan = (await client.get(key)).item
  const trace = [lastSpan]
  do {
    const span = (await client.get({ segment, id: lastSpan.spanContext.parentSpanId })).item
    if (span) {
      trace.unshift(span)
      lastSpan = span
    } else {
      await sleep(Config.CACHE.expectSpanTimeout)
    }
  } while (lastSpan.spanContext.parentSpanId)
  return trace
}

const createTrace = async (trace) => {
  try {
    trace[0].spanContext.finishTimestamp = trace[trace.length - 1].spanContext.finishTimestamp
    for (const currentSpan of trace) {
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
    }
    for (const span of trace) {
      await client.drop({
        segment: `${Config.CACHE.segment}-${span.spanContext.traceId}`,
        id: span.spanContext.spanId
      })
    }
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

module.exports = {
  initializeCache,
  cacheSpanContext
}
