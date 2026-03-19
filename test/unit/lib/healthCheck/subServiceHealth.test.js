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
