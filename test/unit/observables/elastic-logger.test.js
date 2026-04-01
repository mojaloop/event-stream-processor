/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Juan Correa <code@juancorrea.io>
 --------------
 ******/

'use strict'

const test = require('tape')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

const setupMocks = () => {
  const clientMock = { index: sinon.stub().resolves() }
  const efkMock = {
    ElasticSearchClient: {
      getInstance: sinon.stub().resolves(clientMock),
      getIndex: sinon.stub().returns('mojaloop-2026.03.19')
    }
  }
  const loggerMock = { error: sinon.stub(), info: sinon.stub() }

  const mod = proxyquire('../../../src/observables/elastic-logger', {
    '../lib/efk': efkMock,
    '@mojaloop/central-services-logger': loggerMock
  })

  return { mod, efkMock, clientMock, loggerMock }
}

test('elasticsearchClientObservable indexes message', t => {
  const { mod, clientMock, efkMock } = setupMocks()
  const message = { value: { data: 'test' } }
  const observable = mod.elasticsearchClientObservable({ message })

  observable.subscribe({
    error: (e) => t.fail(`should not error: ${e.message}`)
  })

  setTimeout(() => {
    t.ok(efkMock.ElasticSearchClient.getInstance.calledOnce, 'getInstance called')
    t.ok(efkMock.ElasticSearchClient.getIndex.calledOnce, 'getIndex called')
    t.ok(clientMock.index.calledOnce, 'client.index called')
    const indexCall = clientMock.index.firstCall.args[0]
    t.equal(indexCall.index, 'mojaloop-2026.03.19', 'correct index')
    t.end()
  }, 50)
})

test('elasticsearchClientObservable error path', t => {
  const clientMock = { index: sinon.stub().rejects(new Error('index failed')) }
  const efkMock = {
    ElasticSearchClient: {
      getInstance: sinon.stub().resolves(clientMock),
      getIndex: sinon.stub().returns('mojaloop-2026.03.19')
    }
  }
  const loggerMock = { error: sinon.stub() }

  const mod = proxyquire('../../../src/observables/elastic-logger', {
    '../lib/efk': efkMock,
    '@mojaloop/central-services-logger': loggerMock
  })

  // Suppress the UnsubscriptionError from async Observable.create teardown
  const handler = (err) => {
    if (err && err.message && err.message.includes('unsubscribe is not a function')) { /* suppress */ }
  }
  process.on('unhandledRejection', handler)

  const observable = mod.elasticsearchClientObservable({ message: { value: {} } })

  observable.subscribe({
    error: (e) => {
      t.equal(e.message, 'index failed', 'error propagated')
      // Delay cleanup to allow async rejection to be caught
      setTimeout(() => {
        process.removeListener('unhandledRejection', handler)
        t.end()
      }, 100)
    }
  })
})

test('addElasticsearchMetaData with full metadata adds fields', t => {
  const { mod, clientMock } = setupMocks()
  const message = {
    value: {
      metadata: {
        event: {
          createdAt: '2026-01-01T00:00:00Z',
          state: { status: 'success' }
        },
        trace: {
          traceId: 'trace-123',
          service: 'ml-api-adapter',
          spanId: 'span-456',
          sampled: false
        }
      }
    }
  }

  const observable = mod.elasticsearchClientObservable({ message })
  observable.subscribe({
    error: (e) => t.fail(`should not error: ${e.message}`)
  })

  setTimeout(() => {
    const body = clientMock.index.firstCall.args[0].body
    t.equal(body.processor.name, 'transaction', 'processor.name set')
    t.equal(body.trace.id, 'trace-123', 'trace.id set')
    t.equal(body.transaction.result, 'success', 'transaction.result is success')
    t.equal(body.transaction.name, 'ml-api-adapter', 'transaction.name set')
    t.equal(body.transaction.id, 'span-456', 'transaction.id set')
    t.equal(body.transaction.sampled, true, 'sampled is negated')
    t.end()
  }, 50)
})

test('addElasticsearchMetaData with error status', t => {
  const { mod, clientMock } = setupMocks()
  const message = {
    value: {
      metadata: {
        event: {
          createdAt: '2026-01-01T00:00:00Z',
          state: { status: 'error' }
        },
        trace: {
          traceId: 'trace-123',
          service: 'svc',
          spanId: 'span-456',
          sampled: true
        }
      }
    }
  }

  const observable = mod.elasticsearchClientObservable({ message })
  observable.subscribe({
    error: (e) => t.fail(`should not error: ${e.message}`)
  })

  setTimeout(() => {
    const body = clientMock.index.firstCall.args[0].body
    t.equal(body.transaction.result, 'error', 'transaction.result is error')
    t.end()
  }, 50)
})

test('addElasticsearchMetaData without metadata passes through', t => {
  const { mod, clientMock } = setupMocks()
  const message = { value: { data: 'no-metadata' } }

  const observable = mod.elasticsearchClientObservable({ message })
  observable.subscribe({
    error: (e) => t.fail(`should not error: ${e.message}`)
  })

  setTimeout(() => {
    const body = clientMock.index.firstCall.args[0].body
    t.equal(body.data, 'no-metadata', 'value passed through')
    t.notOk(body.processor, 'no processor added')
    t.end()
  }, 50)
})
