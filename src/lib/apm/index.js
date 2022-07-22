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
 - Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const Logger = require('@mojaloop/central-services-logger')
const Client = require('elastic-apm-http-client')
const Config = require('../config')

const APMClient = (() => {
  let instance
  const createInstance = async () => {
    try {
      const client = new Client({
        serviceName: Config.APM.serviceName,
        agentName: Config.APM.serviceName,
        agentVersion: require('../../../package.json').version,
        userAgent: Config.APM.serviceName,
        serverUrl: Config.APM.serverUrl,
        keepAlive: true
      })
      client.on('request-error', err => {
        Logger.error(`apm::onEvent - request-error - ${err}`)
      })
      Logger.info(`apm client connection created - ${client}`)
      return client
    } catch (e) {
      Logger.error(e.stack)
      throw e
    }
  }

  return {
    getInstance: async () => {
      if (!instance) {
        instance = await createInstance()
      }
      return instance
    },
    destroy: async () => {
      if (!instance) {
        instance = await createInstance()
      }
      instance.destroy()
    }
  }
})()

module.exports = {
  APMClient
}
