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
  const eventHandlers = {}
  const floggerMock = {
    configure: sinon.stub(),
    on: sinon.stub().callsFake((event, handler) => {
      eventHandlers[event] = handler
    })
  }
  const pingStub = sinon.stub().resolves(true)
  const clientMock = { ping: pingStub }
  const elasticsearchMock = {
    Client: sinon.stub().returns(clientMock)
  }
  const configMock = {
    EFK_CLIENT: {
      host: 'localhost:9200',
      log: 'error',
      index: { name: 'mojaloop', template: '{{index}}-{{date}}' }
    }
  }
  const loggerMock = {
    info: sinon.stub(),
    error: sinon.stub()
  }

  const createModule = () => proxyquire('../../../../src/lib/efk/index', {
    'fluent-logger': floggerMock,
    elasticsearch: elasticsearchMock,
    '../../lib/config': configMock,
    '@mojaloop/central-services-logger': loggerMock,
    mustache: require('mustache'),
    moment: require('moment')
  })

  return { floggerMock, elasticsearchMock, configMock, loggerMock, clientMock, pingStub, eventHandlers, createModule }
}

test('initLogger calls flogger.configure and registers event handlers', async t => {
  const { floggerMock, createModule } = setupMocks()
  const efk = createModule()

  await efk.initLogger('test-prefix', { host: 'localhost' })
  t.ok(floggerMock.configure.calledOnce, 'flogger.configure called')
  t.ok(floggerMock.configure.calledWith('test-prefix', { host: 'localhost' }), 'correct args')
  t.ok(floggerMock.on.calledWith('connect'), 'connect handler registered')
  t.ok(floggerMock.on.calledWith('error'), 'error handler registered')
  t.end()
})

test('ElasticSearchClient.getIndex returns mojaloop-YYYY.MM.DD format', t => {
  const { createModule } = setupMocks()
  const efk = createModule()

  const index = efk.ElasticSearchClient.getIndex()
  t.ok(/^mojaloop-\d{4}\.\d{2}\.\d{2}$/.test(index), `index matches pattern: ${index}`)
  t.end()
})

test('ElasticSearchClient.getIndex caches result on second call', t => {
  const { createModule } = setupMocks()
  const efk = createModule()

  const index1 = efk.ElasticSearchClient.getIndex()
  const index2 = efk.ElasticSearchClient.getIndex()
  t.equal(index1, index2, 'same index returned on second call')
  t.end()
})

test('ElasticSearchClient.getInstance creates client and pings', async t => {
  const { elasticsearchMock, clientMock, pingStub, createModule } = setupMocks()
  const efk = createModule()

  const instance = await efk.ElasticSearchClient.getInstance()
  t.ok(elasticsearchMock.Client.calledOnce, 'Client constructor called')
  t.ok(pingStub.calledOnce, 'ping called')
  t.equal(instance, clientMock, 'returns client instance')
  t.end()
})

test('ElasticSearchClient.getInstance returns cached on second call', async t => {
  const { elasticsearchMock, createModule } = setupMocks()
  const efk = createModule()

  const instance1 = await efk.ElasticSearchClient.getInstance()
  const instance2 = await efk.ElasticSearchClient.getInstance()
  t.equal(instance1, instance2, 'same instance returned')
  t.equal(elasticsearchMock.Client.callCount, 1, 'Client constructor only called once')
  t.end()
})

test('ElasticSearchClient.getInstance error path logs and rethrows', async t => {
  const pingErr = new Error('ping failed')
  pingErr.stack = 'ping failed stack'
  const pingStub = sinon.stub().rejects(pingErr)
  const clientMock = { ping: pingStub }
  const elasticsearchMock = { Client: sinon.stub().returns(clientMock) }
  const loggerMock = { info: sinon.stub(), error: sinon.stub() }
  const configMock = {
    EFK_CLIENT: { host: 'localhost:9200', log: 'error', index: { name: 'mojaloop', template: '{{index}}-{{date}}' } }
  }
  const floggerMock = { configure: sinon.stub(), on: sinon.stub() }

  const efk = proxyquire('../../../../src/lib/efk/index', {
    'fluent-logger': floggerMock,
    elasticsearch: elasticsearchMock,
    '../../lib/config': configMock,
    '@mojaloop/central-services-logger': loggerMock,
    mustache: require('mustache'),
    moment: require('moment')
  })

  try {
    await efk.ElasticSearchClient.getInstance()
    t.fail('should have thrown')
  } catch (e) {
    t.equal(e.message, 'ping failed', 'rethrows error')
    t.ok(loggerMock.error.calledWith('ping failed stack'), 'logs error stack')
  }
  t.end()
})

test('initLogger connect handler executes', async t => {
  const { eventHandlers, createModule } = setupMocks()
  const efk = createModule()

  await efk.initLogger('prefix', {})
  t.ok(eventHandlers.connect, 'connect handler exists')
  eventHandlers.connect()
  t.pass('connect handler executed without error')
  t.end()
})

test('initLogger error handler executes', async t => {
  const { eventHandlers, createModule } = setupMocks()
  const efk = createModule()

  // Suppress unhandled rejection from Promise.reject in handler
  const handler = () => {}
  process.on('unhandledRejection', handler)
  t.teardown(() => process.removeListener('unhandledRejection', handler))

  await efk.initLogger('prefix', {})
  t.ok(eventHandlers.error, 'error handler exists')
  eventHandlers.error(new Error('test error'))
  t.pass('error handler executed')
  t.end()
})

test('logger export is the flogger mock', t => {
  const { floggerMock, createModule } = setupMocks()
  const efk = createModule()

  t.equal(efk.logger, floggerMock, 'logger export is fluent-logger')
  t.end()
})
