const logger = require('fluent-logger')

module.exports.initLogger = async (prefix, options) => {
  logger.configure(prefix, options)

  logger.on('connect', () => {
    Promise.resolve({ status: 'succes' })
  })

  logger.on('error', (error) => {
    Promise.reject(error)
  })
}

module.exports.logger = logger
