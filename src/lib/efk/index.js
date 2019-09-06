const flogger = require('fluent-logger')
const Config = require('../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger

const configuration = Config.util.toObject()

const initLogger = async (prefix, options) => {
  flogger.configure(prefix, options)

  flogger.on('connect', () => {
    Promise.resolve({ status: 'succes' })
  })

  flogger.on('error', (error) => {
    Promise.reject(error)
  })
}

const elasticsearch = require('elasticsearch')

const ElasticSearchClient = (function () {
  let instance
  const createInstance = async () => {
    try {
      const client = new elasticsearch.Client({
        host: configuration.efkClient.host,
        log: configuration.efkClient.log
      })
      const resultPing = await client.ping({
        // ping usually has a 3000ms timeout
        requestTimeout: 1000
      })
      Logger.info(`elasticsearch client connection result - ${resultPing}`)
      return client
    } catch (e) {
      Logger.error(e)
      throw e
    }
  }

  return {
    getInstance: async () => {
      if (!instance) {
        instance = await createInstance()
      }
      return instance
    }
  }
})()

module.exports = {
  initLogger,
  logger: flogger,
  ElasticSearchClient
}
