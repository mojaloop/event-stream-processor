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
