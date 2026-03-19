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
