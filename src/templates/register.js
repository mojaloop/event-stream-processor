/*****
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
 - Miguel de Barros <migue.debarros@modusbox.com>
 --------------
 ******/
'use strict'

const Logger = require('@mojaloop/central-services-logger')
const Config = require('../lib/config').util.toObject()

const elasticsearch = require('elasticsearch')
const client = new elasticsearch.Client({
  host: Config.efkClient.host,
  log: Config.efkClient.log
})

/**
 * Function to register Mojaloop Templates for a Mojaloop specific Index on Elasticsearch.
 * This is required as the event.content model needs to be `flattened` to support the dynamic content.
 * Note that the content field must be of type Object (not a stirng, etc) to be correctly indexed.
 *
 * TODO: To be added to an init or migration script on startup. This file is manually executed at this moment. The init-script would need to first check if the template exists, and/if not it would then create the template.
 *
 * One can also run the following curl commands from project root:
 *  curl -X PUT "http://localhost:9200/_template/mojatemplate?pretty" -H 'Content-Type: application/json' -d @config/template-mojaloop.json'
 *  curl -X DELETE "http://localhost:9200/_template/mojatemplate"
 *  curl -X GET "http://localhost:9200/_template/mojatemplate" | jq
 *
 * @returns {Promise<void>}
 */
const registerMojaloopTemplate = async () => {
  const resultPing = await client.ping({
        // ping usually has a 3000ms timeout
    requestTimeout: 1000
  })

  Logger.debug(`connection result=${resultPing}`)

  const templateMojaloop = require('../../config/template-mojaloop.json')
  const resultTemplate = await client.indices.putTemplate({
    name: 'mojatemplate',
    create: false,
    body: templateMojaloop
  })

  Logger.debug(`template create result=${JSON.stringify(resultTemplate)}`)
}

registerMojaloopTemplate()
