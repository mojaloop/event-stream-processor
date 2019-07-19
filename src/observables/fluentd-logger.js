const Rx = require('rxjs')
const logger = require('../lib/efk').logger
const initLogger = require('../lib/efk').initLogger

const Config = require('../lib/config')

const configuration = Config.util.toObject()

// initLogger('fluentd.test', configuration.efk)

const FluentdLoggerObservable = ({ message }) => {
  return Rx.Observable.create(observable => {

    logger.configure('logstash', configuration.efk)
    logger.on('error', (error) => {
      console.log(error)
    })
    logger.on('connect', () => {
      console.log('connected!')
    })

    logger.emit('logstash', message.value, (err) => console.log(`fluentd err ${err}`))
    observable.complete()
  })
}

module.exports = {
  FluentdLoggerObservable
}
