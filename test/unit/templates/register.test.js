'use strict'

const test = require('tape')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noCallThru()

test('registerMojaloopTemplate pings and puts template', async t => {
  const pingStub = sinon.stub().resolves(true)
  const putTemplateStub = sinon.stub().resolves({ acknowledged: true })
  const clientMock = {
    ping: pingStub,
    indices: { putTemplate: putTemplateStub }
  }

  const loggerMock = { debug: sinon.stub(), error: sinon.stub() }

  const configMock = {
    util: {
      toObject: sinon.stub().returns({
        efkClient: { host: 'localhost:9200', log: 'error' }
      })
    }
  }

  proxyquire('../../../src/templates/register', {
    '../lib/config': configMock,
    elasticsearch: { Client: sinon.stub().returns(clientMock) },
    '@mojaloop/central-services-logger': loggerMock,
    '../../config/template-mojaloop.json': { template: 'data' }
  })

  // registerMojaloopTemplate auto-executes on require, wait for async
  await new Promise(resolve => setTimeout(resolve, 50))

  t.ok(pingStub.calledOnce, 'ping called')
  t.ok(putTemplateStub.calledOnce, 'putTemplate called')
  t.equal(putTemplateStub.firstCall.args[0].name, 'mojatemplate', 'template name correct')
  t.deepEqual(putTemplateStub.firstCall.args[0].body, { template: 'data' }, 'template body correct')
  t.end()
})
