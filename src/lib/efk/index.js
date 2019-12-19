/*****
 * @file This registers all handlers for the central-ledger API
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Valentin Genev <valentin.genev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const flogger = require('fluent-logger')
const Config = require('../../lib/config')
const Logger = require('@mojaloop/central-services-logger')
const Mustache = require('mustache')
const Moment = require('moment')

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

const ElasticSearchClient = (() => {
  let instance
  let index
  let currentDate
  const createInstance = async () => {
    try {
      const client = new elasticsearch.Client({
        host: Config.EFK_CLIENT.host,
        log: Config.EFK_CLIENT.log
      })
      const resultPing = await client.ping({
        // ping usually has a 3000ms timeout
        requestTimeout: 1000
      })
      Logger.info(`elasticsearch client connection result - ${resultPing}`)
      return client
    } catch (e) {
      Logger.error(e.stack)
      throw e
    }
  }

  return {
    getIndex: () => {
      const nowDate = Moment()
      if (!index || nowDate.diff(currentDate, 'days') > 0) {
        const indexConfig = Config.EFK_CLIENT.index
        currentDate = nowDate
        const dateString = currentDate.format('YYYY.MM.DD')
        index = Mustache.render(indexConfig.template, {
          index: indexConfig.name,
          date: dateString
        })
      }
      return index
    },
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
