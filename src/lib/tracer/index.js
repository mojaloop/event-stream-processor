const Agent = require('@mojaloop/elastic-apm-node')
const Tracer = require('@mojaloop/elastic-apm-node-opentracing')
const Config = require('../config')

const agent = (function () {
  const self = Agent.start(Config.APM)
  this.agent = self
  self.captureError()
  return this
})()

const tracer = (function () {
  const self = new Tracer(agent.agent)
  this.tracer = self
  return this
})()

module.exports = {
  agent: agent.agent,
  tracer: tracer.tracer
}
