const Agent = require('@mojaloop/elastic-apm-node')
const Tracer = require('@mojaloop/elastic-apm-node-opentracing')
const Config = require('../config')
const configuration = Config.util.toObject()

const agent = (function () {
  let self = Agent.start(configuration.apm)
  this.agent = self
  return this
})()

const tracer = (function () {
  let self = new Tracer(agent.agent)
  this.tracer = self
  return this
})()

module.exports = {
  agent: agent.agent,
  tracer: tracer.tracer
}
