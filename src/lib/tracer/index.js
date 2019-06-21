const Agent = require('elastic-apm-node')
const Tracer = require('elastic-apm-node-opentracing')

const agent = (function () {
  let self = Agent.start()
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
