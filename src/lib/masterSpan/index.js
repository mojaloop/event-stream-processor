const Catbox = require('@hapi/catbox')
const CatboxMemory = require('@hapi/catbox-memory')
const { merge } = require('lodash')
const crypto = require('crypto')
const TraceParent = require('traceparent')
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
    const { traceId, parentSpanId, tags } = spanContext
    const key = {
      segment: 'master-span',
      id: traceId
    }
    const newSpanId = crypto.randomBytes(8).toString('hex')
    if (!parentSpanId) {
      const newChildContext = merge({ parentSpanId: newSpanId }, { ...spanContext })
      const newMasterSpanContext = merge({ tags: { ...tags, masterSpan: newSpanId } }, { ...spanContext }, { spanId: newSpanId, service: 'master-span' })
      await client.set(key, [{ spanContext: newMasterSpanContext, state, content }], Config.CACHE.ttl)
      return cacheSpanContext(newChildContext, state)
    }
    let trace = await client.get(key)
    let masterTags = (trace && trace[0]) ? trace[0].tags : { masterSpan: newSpanId }
    trace.item.push({spanContext: merge({tags: { ...tags, masterSpan: masterTags['masterSpan'] }}, { ...spanContext }), state, content})
    await client.set(key, trace.item, Config.CACHE.ttl)
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
    const trace = await client.get(key)
    trace.item[0].spanContext.finishTimestamp = trace.item[trace.item.length - 1].spanContext.finishTimestamp
    for (let currentSpan of trace.item) {
      const { service, traceId, parentSpanId, spanId, startTimestamp, finishTimestamp, flags, tags = {}, version = 0 } = currentSpan.spanContext
      const { status, code, description } = currentSpan.state
      const { content } = currentSpan
      const versionBuffer = Buffer.alloc(1).fill(version)
      const flagsBuffer = Buffer.alloc(1).fill(flags | 0x01)
      const traceIdBuffer = Buffer.from(traceId, 'hex')
      const spanIdBuffer = Buffer.from(spanId, 'hex')
      let parentSpanIdBuffer = parentSpanId && Buffer.from(parentSpanId, 'hex')
      Logger.info(`version: ${versionBuffer.toString('hex')} traceId: ${traceId} spanId: ${spanId} parentSpanId: ${parentSpanId} flags: ${flagsBuffer.toString('hex')}`)
      const context =
        parentSpanIdBuffer
          ? new TraceParent(Buffer.concat([versionBuffer, traceIdBuffer, spanIdBuffer, flagsBuffer, parentSpanIdBuffer]))
          : new TraceParent(Buffer.concat([versionBuffer, traceIdBuffer, spanIdBuffer, flagsBuffer]))
      let span = tracer.startSpan(`${service}`, { startTime: Date.parse(startTimestamp), tags }, context)
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
      span.finish(Date.parse(finishTimestamp))
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
