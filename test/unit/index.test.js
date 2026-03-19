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
