const Rx = require('rxjs')
const logger = require('../lib/efk').flogger
const Config = require('../lib/config')

const configuration = Config.util.toObject()

const FluentdLoggerObservable = ({ message }) => {
  return Rx.Observable.create(observable => {
    try {
      logger.emit(configuration.efk.namespace, message.value, (err) => {
        if (err) { observable.error(err) }
      })
      observable.complete()
    } catch (e) {
      observable.error(e)
    }
  })
}

module.exports = {
  FluentdLoggerObservable
}
