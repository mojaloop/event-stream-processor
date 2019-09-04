const logger = require('fluent-logger')
const Config = require('../../lib/config')

const configuration = Config.util.toObject()

module.exports.initLogger = async (prefix, options) => {
  logger.configure(prefix, options)

  logger.on('connect', () => {
    Promise.resolve({ status: 'succes' })
  })

  logger.on('error', (error) => {
    Promise.reject(error)
  })
}

const elasticsearch = require('elasticsearch')

const elasticSearchClient = (function () {
  let self = new elasticsearch.Client({
    host: configuration.efkClient.host,
    log: configuration.efkClient.log
  })
  this.client = self
  return this
})()

module.exports.elasticSearchClient = elasticSearchClient
module.exports.logger = logger
