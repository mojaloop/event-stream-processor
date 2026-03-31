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

test('FluentdLoggerObservable emits on logger and completes', t => {
  const emitStub = sinon.stub().callsFake((ns, val, cb) => cb(null))
  const floggerMock = { emit: emitStub }
  const configMock = { efk: { namespace: 'test-ns' } }

  const { FluentdLoggerObservable } = proxyquire('../../../src/observables/fluentd-logger', {
    '../lib/efk': { flogger: floggerMock },
    '../lib/config': configMock
  })

  const message = { value: { key: 'data' } }
  const observable = FluentdLoggerObservable({ message })

  let completed = false
  observable.subscribe({
    error: (e) => t.fail(`should not error: ${e.message}`),
    complete: () => { completed = true }
  })

  t.ok(emitStub.calledOnce, 'emit called')
  t.equal(emitStub.firstCall.args[0], 'test-ns', 'uses namespace from config')
  t.deepEqual(emitStub.firstCall.args[1], { key: 'data' }, 'passes message value')
  t.ok(completed, 'observable completed')
  t.end()
})

test('FluentdLoggerObservable errors when emit callback has error', t => {
  const emitErr = new Error('emit failed')
  const emitStub = sinon.stub().callsFake((ns, val, cb) => cb(emitErr))
  const floggerMock = { emit: emitStub }
  const configMock = { efk: { namespace: 'test-ns' } }

  const { FluentdLoggerObservable } = proxyquire('../../../src/observables/fluentd-logger', {
    '../lib/efk': { flogger: floggerMock },
    '../lib/config': configMock
  })

  const observable = FluentdLoggerObservable({ message: { value: {} } })

  observable.subscribe({
    error: (e) => {
      t.equal(e.message, 'emit failed', 'error propagated')
      t.end()
    },
    complete: () => t.fail('should not complete')
  })
})

test('FluentdLoggerObservable errors when emit throws exception', t => {
  const floggerMock = {
    emit: sinon.stub().throws(new Error('emit threw'))
  }
  const configMock = { efk: { namespace: 'test-ns' } }

  const { FluentdLoggerObservable } = proxyquire('../../../src/observables/fluentd-logger', {
    '../lib/efk': { flogger: floggerMock },
    '../lib/config': configMock
  })

  const observable = FluentdLoggerObservable({ message: { value: {} } })

  observable.subscribe({
    error: (e) => {
      t.equal(e.message, 'emit threw', 'exception propagated')
      t.end()
    },
    complete: () => t.fail('should not complete')
  })
})
