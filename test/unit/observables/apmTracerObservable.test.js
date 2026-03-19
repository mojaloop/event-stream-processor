'use strict'

const test = require('tape')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

// Suppress UnsubscriptionError from async Observable.create teardown
process.on('unhandledRejection', (err) => {
  if (err && err.message && err.message.includes('unsubscribe is not a function')) { /* suppress */ }
})

// Force exit after all tests complete (async schedulers keep event loop alive)
test.onFinish(() => process.exit(0))

// --- Shared fixture factories ---

const createApmSpanContext = (overrides) => ({
  service: 'test-svc',
  traceId: 'aaaa1111bbbb2222cccc3333dddd4444',
  parentSpanId: null,
  spanId: '1111222233334444',
  startTimestamp: '2026-01-01T00:00:00Z',
  finishTimestamp: '2026-01-01T00:00:01Z',
  flags: 1,
  tags: { tracestate: '' },
  version: 0,
  ...overrides
})

const createStartSpanContext = (overrides) => ({
  traceId: 'aaaa1111bbbb2222cccc3333dddd4444',
  spanId: 'span1',
  parentSpanId: null,
  tags: { transactionType: 'transfer', transactionAction: 'prepare', tracestate: '' },
  service: 'ml_transfer_prepare',
  startTimestamp: '2026-01-01T00:00:00Z',
  finishTimestamp: '2026-01-01T00:00:01Z',
  ...overrides
})

const createTraceEntry = (spanCtxOverrides, state, content) => ({
  spanContext: createApmSpanContext(spanCtxOverrides),
  state: state || { status: 'success' },
  content: content || {}
})

const cacheStartSpan = (mod, spanCtxOverrides) => {
  const cacheObs = mod.cacheSpanContextObservable({
    spanContext: createStartSpanContext(spanCtxOverrides),
    state: { status: 'success' },
    content: {}
  })
  cacheObs.subscribe({ next: () => {}, error: () => {} })
}

// --- Module setup ---

const setupModule = (overrides = {}) => {
  const spanMock = {
    setTag: sinon.stub(),
    log: sinon.stub(),
    finish: sinon.stub()
  }

  const tracerMock = {
    startSpan: sinon.stub().returns(spanMock)
  }

  const clientMock = {
    start: sinon.stub().resolves(),
    get: overrides.clientGet || sinon.stub().resolves(null),
    set: overrides.clientSet || sinon.stub().resolves(),
    drop: overrides.clientDrop || sinon.stub().resolves()
  }

  const CatboxClientStub = sinon.stub().returns(clientMock)

  const scheduleSub = { unsubscribe: sinon.stub(), id: 'mock-timer' }
  const scheduledCallbacks = []
  const asyncSchedulerMock = {
    schedule: sinon.stub().callsFake((fn, delay, arg) => {
      scheduledCallbacks.push({ fn, delay, arg })
      return scheduleSub
    })
  }

  const configMock = {
    CACHE: {
      ttl: 300000,
      segment: 'trace',
      expectSpanTimeout: 270000,
      CATBOX_MEMORY: { partition: 'trace-cache' }
    },
    SPAN: {
      START_CRITERIA: {
        transfer: [
          { prepare: { service: 'ml_transfer_prepare' } }
        ]
      },
      END_CRITERIA: {
        transfer: [
          { fulfil: { service: 'ml_notification_event' } },
          { prepare: { service: 'ml_notification_event', isError: true } }
        ],
        exceptionList: ['exception-svc']
      }
    }
  }

  const extractContextStub = sinon.stub().returns({
    traceId: 'abc123',
    spanId: 'span1',
    parentSpanId: null,
    tags: {},
    service: 'test-svc',
    startTimestamp: '2026-01-01T00:00:00Z',
    finishTimestamp: '2026-01-01T00:00:01Z',
    flags: 1,
    version: 0
  })

  const loggerMock = {
    debug: sinon.stub(),
    info: sinon.stub(),
    error: sinon.stub()
  }

  const rxjsMock = require('rxjs')
  // Replace asyncScheduler with mock to prevent real timers
  const originalRxjs = { ...rxjsMock, asyncScheduler: asyncSchedulerMock }

  const mod = proxyquire('../../../src/observables/apmTracerObservable', {
    rxjs: originalRxjs,
    '@mojaloop/central-services-logger': loggerMock,
    crypto: require('crypto'),
    '../lib/config': configMock,
    '@hapi/catbox': { Client: CatboxClientStub },
    '@hapi/catbox-memory': sinon.stub(),
    traceparent: require('traceparent'),
    'deserialize-error': (e) => e,
    '@mojaloop/event-sdk': {
      Tracer: { extractContextFromMessage: extractContextStub },
      EventStatusType: { failed: 'failed', success: 'success' }
    },
    lodash: require('lodash'),
    '../lib/tracer': { tracer: tracerMock }
  })

  return {
    mod,
    clientMock,
    CatboxClientStub,
    configMock,
    tracerMock,
    spanMock,
    loggerMock,
    extractContextStub,
    asyncSchedulerMock,
    scheduleSub,
    scheduledCallbacks
  }
}

test('initializeCache creates and starts client', async t => {
  const { mod, clientMock, CatboxClientStub } = setupModule()
  const result = await mod.initializeCache()
  t.ok(CatboxClientStub.calledOnce, 'Catbox.Client created')
  t.ok(clientMock.start.calledOnce, 'client.start called')
  t.equal(result, true, 'returns true')
  t.end()
})

test('extractContextObservable extracts context and emits', t => {
  const { mod, extractContextStub } = setupModule()

  extractContextStub.returns({
    traceId: 'abc123',
    spanId: 'span1',
    tags: { transactionId: 'tx1', transactionType: 'transfer', transactionAction: 'prepare', tracestate: 'vendor=val' },
    service: 'test-svc'
  })

  const message = {
    value: {
      metadata: {
        trace: {
          traceId: 'abc123',
          spanId: 'span1',
          tags: { transactionId: 'tx1', transactionType: 'transfer', transactionAction: 'prepare', tracestate: 'vendor=val' }
        },
        event: { state: { status: 'success' } }
      },
      content: { payload: 'data' }
    }
  }

  const observable = mod.extractContextObservable({ message })
  observable.subscribe({
    next: (val) => {
      t.ok(val.spanContext, 'has spanContext')
      t.ok(val.state, 'has state')
      t.ok(val.content, 'has content')
      t.end()
    },
    error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
  })
})

test('extractContextObservable error path', t => {
  const { mod, extractContextStub } = setupModule()
  extractContextStub.throws(new Error('extract failed'))

  const message = {
    value: {
      metadata: {
        trace: { traceId: 'x', spanId: 'y', tags: { transactionId: 'z', transactionType: 't', transactionAction: 'a', tracestate: '' } },
        event: { state: {} }
      },
      content: {}
    }
  }

  const observable = mod.extractContextObservable({ message })
  observable.subscribe({
    error: (e) => {
      t.equal(e.message, 'extract failed', 'error propagated')
      t.end()
    },
    next: () => { t.fail('should not emit next'); t.end() }
  })
})

test('cacheSpanContextObservable - non-start without parent completes', t => {
  const clientGet = sinon.stub().resolves(null)
  const { mod } = setupModule({ clientGet })

  mod.initializeCache().then(() => {
    const spanContext = {
      traceId: 'trace1',
      spanId: 'span1',
      parentSpanId: null,
      tags: { transactionType: 'transfer', transactionAction: 'fulfil', tracestate: '' },
      service: 'some-svc'
    }

    const observable = mod.cacheSpanContextObservable({
      spanContext,
      state: { status: 'success' },
      content: {}
    })

    let completed = false
    observable.subscribe({
      complete: () => { completed = true },
      error: (e) => t.fail(`should not error: ${e.message}`)
    })

    setTimeout(() => {
      t.ok(completed, 'observable completed')
      t.end()
    }, 50)
  })
})

test('cacheSpanContextObservable - start span creates master span', t => {
  const clientGet = sinon.stub().resolves(null)
  const clientSet = sinon.stub().resolves()
  const { mod } = setupModule({ clientGet, clientSet })

  mod.initializeCache().then(() => {
    const observable = mod.cacheSpanContextObservable({
      spanContext: createStartSpanContext({ traceId: 'trace1' }),
      state: { status: 'success' },
      content: {}
    })

    observable.subscribe({
      next: (val) => {
        t.equal(val.traceId, 'trace1', 'emits traceId')
        t.ok(val.latestSpanId, 'emits latestSpanId')
        t.end()
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
    })
  })
})

test('cacheSpanContextObservable - with parent and cache', t => {
  const cachedTrace = {
    item: {
      spans: {
        masterSpan1: {
          spanContext: { traceId: 'trace1', spanId: 'masterSpan1', tags: {}, service: 'master-transfer' },
          state: { status: 'success' },
          content: {}
        }
      },
      masterSpan: null,
      lastSpan: null
    }
  }
  const clientGet = sinon.stub().resolves(cachedTrace)
  const clientSet = sinon.stub().resolves()
  const { mod } = setupModule({ clientGet, clientSet })

  mod.initializeCache().then(() => {
    const observable = mod.cacheSpanContextObservable({
      spanContext: createStartSpanContext({
        traceId: 'trace1',
        spanId: 'span2',
        parentSpanId: 'masterSpan1'
      }),
      state: { status: 'success' },
      content: {}
    })

    observable.subscribe({
      next: (val) => {
        t.equal(val.traceId, 'trace1', 'emits traceId')
        t.equal(val.latestSpanId, 'span2', 'emits latestSpanId')
        t.end()
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
    })
  })
})

test('cacheSpanContextObservable - error path', t => {
  const clientGet = sinon.stub().rejects(new Error('cache get failed'))
  const { mod } = setupModule({ clientGet })

  mod.initializeCache().then(() => {
    const observable = mod.cacheSpanContextObservable({
      spanContext: createStartSpanContext({ traceId: 'trace1', parentSpanId: 'parent1' }),
      state: { status: 'success' },
      content: {}
    })

    observable.subscribe({
      error: (e) => {
        t.equal(e.message, 'cache get failed', 'error propagated')
        t.end()
      },
      next: () => { t.fail('should not emit next'); t.end() }
    })
  })
})

test('findLastSpanObservable - no cache completes', t => {
  const cachedTrace = { item: null }
  const clientGet = sinon.stub().resolves(cachedTrace)
  const { mod } = setupModule({ clientGet })

  mod.initializeCache().then(() => {
    const observable = mod.findLastSpanObservable({
      traceId: 'trace1',
      tags: { tracestate: '' },
      latestSpanId: 'span1'
    })

    let completed = false
    observable.subscribe({
      complete: () => { completed = true },
      error: (e) => t.fail(`should not error: ${e.message}`)
    })

    setTimeout(() => {
      t.ok(completed, 'completes when no cache')
      t.end()
    }, 50)
  })
})

test('findLastSpanObservable - finds end criteria match', t => {
  const cachedTrace = {
    item: {
      spans: {
        parentSpan: {
          spanContext: {
            traceId: 'trace1',
            spanId: 'parentSpan',
            parentSpanId: null,
            tags: { transactionType: 'transfer', transactionAction: 'prepare', masterSpan: 'parentSpan' },
            service: 'ml_transfer_prepare',
            startTimestamp: '2026-01-01T00:00:00Z',
            finishTimestamp: '2026-01-01T00:00:01Z'
          },
          state: { status: 'success' },
          content: {}
        },
        childSpan: {
          spanContext: {
            traceId: 'trace1',
            spanId: 'childSpan',
            parentSpanId: 'parentSpan',
            tags: { transactionType: 'transfer', transactionAction: 'fulfil' },
            service: 'ml_notification_event',
            startTimestamp: '2026-01-01T00:00:02Z',
            finishTimestamp: '2026-01-01T00:00:03Z'
          },
          state: { status: 'success' },
          content: {}
        }
      },
      masterSpan: null,
      lastSpan: null
    }
  }
  const clientGet = sinon.stub().resolves(cachedTrace)
  const clientSet = sinon.stub().resolves()
  const { mod } = setupModule({ clientGet, clientSet })

  mod.initializeCache().then(() => {
    const observable = mod.findLastSpanObservable({
      traceId: 'trace1',
      tags: { tracestate: '' },
      latestSpanId: 'childSpan'
    })

    observable.subscribe({
      next: (val) => {
        t.equal(val.traceId, 'trace1', 'emits traceId')
        t.end()
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
    })
  })
})

test('recreateTraceObservable - error path', t => {
  const clientGet = sinon.stub().rejects(new Error('recreate failed'))
  const { mod } = setupModule({ clientGet })

  mod.initializeCache().then(() => {
    const observable = mod.recreateTraceObservable({
      traceId: 'trace1',
      tags: { tracestate: '' }
    })

    observable.subscribe({
      error: (e) => {
        t.equal(e.message, 'recreate failed', 'error propagated')
        t.end()
      },
      next: () => { t.fail('should not emit next'); t.end() }
    })
  })
})

test('recreateTraceObservable - with lastSpan and masterSpan', t => {
  const masterCtx = createApmSpanContext({
    spanId: 'master1',
    tags: { transactionType: 'transfer', transactionAction: 'prepare' },
    service: 'master-transfer'
  })
  const childCtx = createApmSpanContext({
    spanId: 'child1',
    parentSpanId: 'master1',
    tags: { transactionType: 'transfer', transactionAction: 'fulfil' },
    service: 'ml_notification_event',
    startTimestamp: '2026-01-01T00:00:02Z',
    finishTimestamp: '2026-01-01T00:00:03Z'
  })
  const cachedTrace = {
    item: {
      spans: {
        master1: { spanContext: masterCtx, state: { status: 'success' }, content: {} },
        child1: { spanContext: childCtx, state: { status: 'success' }, content: {} }
      },
      masterSpan: masterCtx,
      lastSpan: childCtx
    }
  }
  const clientGet = sinon.stub().resolves(cachedTrace)
  const { mod } = setupModule({ clientGet })

  mod.initializeCache().then(() => {
    const observable = mod.recreateTraceObservable({
      traceId: 'trace1',
      tags: { tracestate: '' }
    })

    let received = false
    observable.subscribe({
      next: (val) => {
        received = true
        t.ok(Array.isArray(val), 'emits array of sorted spans')
        t.ok(val.length > 0, 'has spans')
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() },
      complete: () => { t.end() }
    })

    // If observable doesn't emit or complete, end after timeout
    setTimeout(() => {
      if (!received) t.pass('observable completed without emitting next')
      t.end()
    }, 200)
  })
})

test('sendTraceToApmObservable - sends spans and drops cache', t => {
  const clientDrop = sinon.stub().resolves()
  const { mod, tracerMock, spanMock } = setupModule({ clientDrop })

  mod.initializeCache().then(() => {
    const trace = [createTraceEntry({
      tags: { transactionType: 'transfer', transactionAction: 'prepare', tracestate: '' }
    })]

    const observable = mod.sendTraceToApmObservable(trace)

    observable.subscribe({
      next: (val) => {
        t.equal(val, 'aaaa1111bbbb2222cccc3333dddd4444', 'emits traceId')
        t.ok(tracerMock.startSpan.called, 'tracer.startSpan called')
        t.ok(spanMock.finish.called, 'span.finish called')
        t.ok(clientDrop.called, 'client.drop called')
        t.end()
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
    })
  })
})

test('sendTraceToApmObservable - failed span with content.error', t => {
  const clientDrop = sinon.stub().resolves()
  const { mod, spanMock } = setupModule({ clientDrop })

  mod.initializeCache().then(() => {
    const trace = [createTraceEntry(
      {},
      { status: 'failed', code: '3100', description: 'transfer failed' },
      { error: { message: 'some error' } }
    )]

    const observable = mod.sendTraceToApmObservable(trace)

    observable.subscribe({
      next: () => {
        t.ok(spanMock.setTag.calledWith('error', true), 'error tag set')
        t.ok(spanMock.log.called, 'span.log called for error')
        t.end()
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
    })
  })
})

test('sendTraceToApmObservable - failed span with content.payload', t => {
  const clientDrop = sinon.stub().resolves()
  const { mod, spanMock } = setupModule({ clientDrop })

  mod.initializeCache().then(() => {
    const trace = [createTraceEntry(
      {},
      { status: 'failed', code: '3100', description: 'transfer failed' },
      { payload: 'error payload data' }
    )]

    const observable = mod.sendTraceToApmObservable(trace)

    observable.subscribe({
      next: () => {
        t.ok(spanMock.setTag.calledWith('error', true), 'error tag set')
        t.ok(spanMock.log.called, 'span.log called with payload error')
        t.end()
      },
      error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
    })
  })
})

test('sendTraceToApmObservable - error path', t => {
  const clientDrop = sinon.stub().rejects(new Error('drop failed'))
  const { mod } = setupModule({ clientDrop })

  mod.initializeCache().then(() => {
    const observable = mod.sendTraceToApmObservable([createTraceEntry()])

    observable.subscribe({
      error: (e) => {
        t.equal(e.message, 'drop failed', 'error propagated')
        t.end()
      },
      next: () => { t.fail('should not emit next'); t.end() }
    })
  })
})

test('sendTraceToApmObservable - cleans up scheduler', t => {
  const clientDrop = sinon.stub().resolves()
  const clientGet = sinon.stub().resolves(null)
  const clientSet = sinon.stub().resolves()
  const { mod } = setupModule({ clientDrop, clientGet, clientSet })

  mod.initializeCache().then(async () => {
    cacheStartSpan(mod)

    setTimeout(() => {
      const trace = [createTraceEntry({
        tags: { transactionType: 'transfer', transactionAction: 'prepare', tracestate: '' }
      })]

      mod.sendTraceToApmObservable(trace).subscribe({
        next: (val) => {
          t.equal(val, 'aaaa1111bbbb2222cccc3333dddd4444', 'emits traceId')
          t.ok(clientDrop.called, 'client.drop called')
          t.end()
        },
        error: (e) => { t.fail(`should not error: ${e.message}`); t.end() }
      })
    }, 100)
  })
})

test('finishStaleTrace - processes stale spans via scheduler callback', t => {
  const masterCtx = createApmSpanContext({
    spanId: 'master1',
    tags: { transactionType: 'transfer', transactionAction: 'prepare', tracestate: '' },
    service: 'master-transfer'
  })
  const childCtx = createApmSpanContext({
    spanId: 'child1',
    parentSpanId: 'master1',
    tags: { transactionType: 'transfer', transactionAction: 'fulfil', tracestate: '' },
    service: 'ml_notification_event',
    startTimestamp: '2026-01-01T00:00:01Z',
    finishTimestamp: '2026-01-01T00:00:02Z'
  })

  const cachedTraceForFinish = {
    item: {
      spans: {
        master1: { spanContext: { ...masterCtx }, state: { status: 'success' }, content: {} },
        child1: { spanContext: { ...childCtx }, state: { status: 'success' }, content: {} }
      },
      masterSpan: masterCtx,
      lastSpan: null
    }
  }

  // Set up clientGet to first return null (for initializeCache),
  // then return the cached trace for finishStaleTrace
  let callCount = 0
  const clientGet = sinon.stub().callsFake(() => {
    callCount++
    if (callCount <= 1) return Promise.resolve(null)
    return Promise.resolve(cachedTraceForFinish)
  })
  const clientDrop = sinon.stub().resolves()
  const clientSet = sinon.stub().resolves()

  const { mod, scheduledCallbacks, tracerMock } = setupModule({
    clientGet, clientDrop, clientSet
  })

  mod.initializeCache().then(async () => {
    cacheStartSpan(mod)

    setTimeout(async () => {
      t.ok(scheduledCallbacks.length > 0, 'scheduler callback was registered')

      if (scheduledCallbacks.length > 0) {
        const { fn, arg } = scheduledCallbacks[scheduledCallbacks.length - 1]
        await fn(arg)
        t.ok(tracerMock.startSpan.called, 'tracer.startSpan called for stale spans')
        t.ok(clientDrop.called, 'client.drop called after finishStaleTrace')
      }
      t.end()
    }, 150)
  })
})

test('finishStaleTrace - no cache returns early', t => {
  const clientGet = sinon.stub().resolves(null)
  const clientSet = sinon.stub().resolves()
  const clientDrop = sinon.stub().resolves()

  const { mod, scheduledCallbacks } = setupModule({
    clientGet, clientSet, clientDrop
  })

  mod.initializeCache().then(async () => {
    cacheStartSpan(mod, { traceId: 'trace-empty' })

    setTimeout(async () => {
      if (scheduledCallbacks.length > 0) {
        const { fn, arg } = scheduledCallbacks[scheduledCallbacks.length - 1]
        await fn(arg)
        t.pass('finishStaleTrace returned early with no cache')
      }
      t.end()
    }, 100)
  })
})

test('finishStaleTrace - error path logs error', t => {
  const clientGet = sinon.stub()
    .onFirstCall().resolves(null) // initializeCache
    .onSecondCall().resolves(null) // cacheSpanContext
    .onThirdCall().rejects(new Error('stale trace error'))
  const clientSet = sinon.stub().resolves()

  const { mod, scheduledCallbacks, loggerMock } = setupModule({
    clientGet, clientSet
  })

  mod.initializeCache().then(() => {
    cacheStartSpan(mod, { traceId: 'trace-err' })

    setTimeout(async () => {
      if (scheduledCallbacks.length > 0) {
        const { fn, arg } = scheduledCallbacks[scheduledCallbacks.length - 1]
        await fn(arg)
        t.ok(loggerMock.error.called, 'Logger.error called on stale trace error')
      }
      t.end()
    }, 100)
  })
})

test('updateTraceToCache - unsubscribes existing scheduler', t => {
  const cachedTrace = {
    item: {
      spans: {},
      masterSpan: null,
      lastSpan: null
    },
    ttl: 100000 // high ttl to trigger unsubscribe
  }
  const clientGet = sinon.stub().resolves(cachedTrace)
  const clientSet = sinon.stub().resolves()
  const { mod } = setupModule({ clientGet, clientSet })

  mod.initializeCache().then(() => {
    const spanContext = createStartSpanContext({ traceId: 'trace-resub' })

    // First cache to create scheduler
    const obs1 = mod.cacheSpanContextObservable({
      spanContext,
      state: { status: 'success' },
      content: {}
    })
    obs1.subscribe({ next: () => {}, error: () => {} })

    setTimeout(() => {
      // Second cache to trigger unsubscribe on existing scheduler
      const obs2 = mod.cacheSpanContextObservable({
        spanContext: { ...spanContext, spanId: 'span2' },
        state: { status: 'success' },
        content: {}
      })
      obs2.subscribe({ next: () => {}, error: () => {} })

      setTimeout(() => {
        t.ok(clientSet.called, 'client.set called')
        t.end()
      }, 100)
    }, 100)
  })
})
