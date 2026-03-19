'use strict'

const test = require('tape')
const proxyquire = require('proxyquire').noCallThru()

test('config exports all expected keys', t => {
  const mockConfig = {
    PORT: 3082,
    EFK_CLIENT: { host: 'localhost:9200', log: 'error', index: { name: 'mojaloop', template: '{{index}}-{{date}}' } },
    APM: { serviceName: 'event-stream-processor' },
    KAFKA: { CONSUMER: {}, PRODUCER: {} },
    CACHE: { ttl: 300000, segment: 'trace' },
    SPAN: { START_CRITERIA: {}, END_CRITERIA: {} }
  }

  const Config = proxyquire('../../../src/lib/config', {
    'parse-strings-in-object': () => mockConfig,
    rc: () => mockConfig,
    '../../config/default.json': {}
  })

  t.equal(Config.PORT, 3082, 'PORT is correct')
  t.deepEqual(Config.EFK_CLIENT, mockConfig.EFK_CLIENT, 'EFK_CLIENT is correct')
  t.deepEqual(Config.APM, mockConfig.APM, 'APM is correct')
  t.deepEqual(Config.KAFKA_CONFIG, mockConfig.KAFKA, 'KAFKA_CONFIG maps to KAFKA')
  t.deepEqual(Config.CACHE, mockConfig.CACHE, 'CACHE is correct')
  t.deepEqual(Config.SPAN, mockConfig.SPAN, 'SPAN is correct')
  t.end()
})

test('config PORT is a number', t => {
  const mockConfig = {
    PORT: 3082,
    EFK_CLIENT: {},
    APM: {},
    KAFKA: {},
    CACHE: { ttl: 300000, segment: 'trace' },
    SPAN: {}
  }

  const Config = proxyquire('../../../src/lib/config', {
    'parse-strings-in-object': () => mockConfig,
    rc: () => mockConfig,
    '../../config/default.json': {}
  })

  t.equal(typeof Config.PORT, 'number', 'PORT is a number')
  t.ok(Config.CACHE.ttl, 'CACHE has ttl')
  t.ok(Config.CACHE.segment, 'CACHE has segment')
  t.end()
})
