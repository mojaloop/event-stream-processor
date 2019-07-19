const logger = require('fluent-logger')

module.exports.initLogger = (prefix, options) => {
  logger.configure(prefix, options)
  logger.on('error', (error) => {
    console.log(error)
  })
  logger.on('connect', (v) => {
    console.log('connected!' + v)
  })
}

module.exports.logger = logger
