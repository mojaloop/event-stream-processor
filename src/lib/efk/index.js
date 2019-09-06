const flogger = require('fluent-logger')
const Config = require('../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger

const configuration = Config.util.toObject()

module.exports.initLogger = async (prefix, options) => {
  flogger.configure(prefix, options)

  flogger.on('connect', () => {
    Promise.resolve({ status: 'succes' })
  })

  flogger.on('error', (error) => {
    Promise.reject(error)
  })
}

const elasticsearch = require('elasticsearch')

const elasticSearchClient = (async function () {
  try {
    let self = new elasticsearch.Client({
      host: configuration.efkClient.host,
      log: configuration.efkClient.log
    })
    this.client = self
    const resultPing = await self.ping({
      // ping usually has a 3000ms timeout
      requestTimeout: 1000
    })
    Logger.info(`elasticsearch client connection result - ${resultPing}`)
    return this
  } catch (e) {
    Logger.error(e)
    throw e
  }
})()

module.exports.elasticSearchClient = elasticSearchClient
module.exports.logger = flogger
