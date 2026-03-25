/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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
 - Name Surname <name.surname@mojaloop.io>
 --------------
 ******/

'use strict'

const test = require('tape')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

test('index.js calls setup() on require', t => {
  const setupStub = sinon.stub()
  const loggerMock = { error: sinon.stub() }

  proxyquire('../../src/index', {
    './setup': { setup: setupStub },
    '@mojaloop/central-services-logger': loggerMock
  })

  t.ok(setupStub.calledOnce, 'setup() called')
  t.end()
})

test('index.js catch block logs error when setup throws', t => {
  const setupErr = new Error('setup failed')
  setupErr.stack = 'setup failed stack'
  const setupStub = sinon.stub().throws(setupErr)
  const loggerMock = { error: sinon.stub() }

  proxyquire('../../src/index', {
    './setup': { setup: setupStub },
    '@mojaloop/central-services-logger': loggerMock
  })

  t.ok(loggerMock.error.called, 'Logger.error called')
  const errorArg = loggerMock.error.firstCall.args[0]
  t.ok(errorArg.includes('setup failed stack'), 'logs error stack')
  t.end()
})

test('index.js registers unhandledRejection handler', t => {
  const setupStub = sinon.stub()
  const loggerMock = { error: sinon.stub() }
  const processOnStub = sinon.stub(process, 'on')

  proxyquire('../../src/index', {
    './setup': { setup: setupStub },
    '@mojaloop/central-services-logger': loggerMock
  })

  const unhandledCall = processOnStub.getCalls().find(
    c => c.args[0] === 'unhandledRejection'
  )
  t.ok(unhandledCall, 'unhandledRejection handler registered')

  // Invoke the handler to test it
  if (unhandledCall) {
    const consoleErrorStub = sinon.stub(console, 'error')
    unhandledCall.args[1]('test reason', Promise.resolve())
    t.ok(loggerMock.error.called, 'Logger.error called in handler')
    consoleErrorStub.restore()
  }

  processOnStub.restore()
  t.end()
})
