'use strict'

const test = require('tape')
const proxyquire = require('proxyquire').noCallThru()

test('observables/index re-exports all three modules', t => {
  const fluentdMock = { FluentdLoggerObservable: () => {} }
  const apmMock = { initializeCache: () => {} }
  const elasticMock = { elasticsearchClientObservable: () => {} }

  const observables = proxyquire('../../../src/observables/index', {
    './fluentd-logger': fluentdMock,
    './apmTracerObservable': apmMock,
    './elastic-logger': elasticMock
  })

  t.equal(observables.fluentdObservable, fluentdMock.FluentdLoggerObservable, 'exports fluentdObservable')
  t.equal(observables.TraceObservable, apmMock, 'exports TraceObservable')
  t.equal(observables.elasticsearchClientObservable, elasticMock.elasticsearchClientObservable, 'exports elasticsearchClientObservable')
  t.end()
})
