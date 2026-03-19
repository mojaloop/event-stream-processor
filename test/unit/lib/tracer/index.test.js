'use strict'

const test = require('tape')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

test('tracer module starts agent and creates tracer', t => {
  const agentInstance = {
    captureError: sinon.stub()
  }
  const AgentMock = {
    start: sinon.stub().returns(agentInstance)
  }
  const tracerInstance = { startSpan: sinon.stub() }
  const TracerMock = sinon.stub().returns(tracerInstance)
  const configMock = {
    APM: { serviceName: 'test-service' }
  }

  const tracerModule = proxyquire('../../../../src/lib/tracer/index', {
    '@mojaloop/elastic-apm-node': AgentMock,
    '@mojaloop/elastic-apm-node-opentracing': TracerMock,
    '../config': configMock
  })

  t.ok(AgentMock.start.calledOnce, 'Agent.start called')
  t.ok(AgentMock.start.calledWith(configMock.APM), 'Agent.start called with APM config')
  t.ok(agentInstance.captureError.calledOnce, 'captureError called')
  t.equal(tracerModule.agent, agentInstance, 'exports agent')
  t.ok(TracerMock.calledWith(agentInstance), 'Tracer created with agent')
  t.equal(tracerModule.tracer, tracerInstance, 'exports tracer')
  t.end()
})
