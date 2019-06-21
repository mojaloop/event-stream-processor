const logger = require('fluent-logger')

module.exports.initLogger = (prefix, options) => {
  return logger.configure(prefix, options)
}
