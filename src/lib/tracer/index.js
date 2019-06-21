const Agent = require('@mojaloop/elastic-apm-node')
const Tracer = require('@mojaloop/elastic-apm-node-opentracing')

const agent = (function () {
  let self = Agent.start({serviceName: 'event-stream-processor'})
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
