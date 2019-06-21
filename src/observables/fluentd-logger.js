const Rx = require('rxjs')
const logger = require('fluent-logger')

const FluentdLoggerObservable = ({ message }) => {
  return Rx.Observable.create(observable => {
    logger.emit('logstash', message)
    observable.complete()
  })
}

module.exports = {
  FluentdLoggerObservable
}
