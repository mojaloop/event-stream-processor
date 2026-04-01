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

const setupMocks = (opts = {}) => {
  const consumerStubs = {}
  const topics = opts.topics || ['topic-1', 'topic-2']

  for (const topic of topics) {
    consumerStubs[topic] = {
      isHealthy: sinon.stub().resolves(opts.healthResults ? opts.healthResults[topic] : true)
    }
  }

  if (opts.throwOnIsHealthy) {
    consumerStubs[opts.throwOnIsHealthy].isHealthy = sinon.stub().rejects(new Error('health check failed'))
  }

  const ConsumerMock = {
    getListOfTopics: opts.throwOnGetTopics
      ? sinon.stub().throws(new Error('getListOfTopics failed'))
      : sinon.stub().returns(topics),
    getConsumer: sinon.stub().callsFake(topic => consumerStubs[topic])
  }

  const loggerMock = {
    isWarnEnabled: true,
    warn: sinon.stub(),
    error: sinon.stub()
  }

  const mod = proxyquire('../../../../src/lib/healthCheck/subServiceHealth', {
    '@mojaloop/central-services-shared': {
      HealthCheck: {
        HealthCheckEnums: {
          statusEnum: { OK: 'OK', DOWN: 'DOWN' },
          serviceName: { broker: 'broker' }
        }
      }
    },
    '@mojaloop/central-services-logger': loggerMock,
    '@mojaloop/central-services-stream': {
      Util: { Consumer: ConsumerMock }
    }
  })

  return { mod, ConsumerMock, loggerMock }
}

test('getSubServiceHealthBroker - all healthy returns OK', async t => {
  const { mod } = setupMocks()
  const result = await mod.getSubServiceHealthBroker()
  t.equal(result.name, 'broker', 'name is broker')
  t.equal(result.status, 'OK', 'status is OK')
  t.end()
})

test('getSubServiceHealthBroker - one unhealthy returns DOWN', async t => {
  const { mod } = setupMocks({
    healthResults: { 'topic-1': true, 'topic-2': false }
  })
  const result = await mod.getSubServiceHealthBroker()
  t.equal(result.status, 'DOWN', 'status is DOWN')
  t.end()
})

test('getSubServiceHealthBroker - isHealthy throws returns DOWN', async t => {
  const { mod } = setupMocks({
    throwOnIsHealthy: 'topic-1'
  })
  const result = await mod.getSubServiceHealthBroker()
  t.equal(result.status, 'DOWN', 'status is DOWN when isHealthy throws')
  t.end()
})

test('getSubServiceHealthBroker - getListOfTopics throws returns DOWN', async t => {
  const { mod, loggerMock } = setupMocks({
    throwOnGetTopics: true
  })
  const result = await mod.getSubServiceHealthBroker()
  t.equal(result.status, 'DOWN', 'status is DOWN')
  t.ok(loggerMock.warn.called, 'logs warning')
  t.end()
})

test('getSubServiceHealthBroker - no topics returns OK', async t => {
  const { mod } = setupMocks({ topics: [] })
  const result = await mod.getSubServiceHealthBroker()
  t.equal(result.status, 'OK', 'status is OK with no topics')
  t.end()
})
