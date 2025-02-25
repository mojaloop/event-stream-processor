/*****
 * @file This registers all handlers for the central-ledger API
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Valentin Genev <valentin.genev@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

const addElasticsearchMetaData = (value) => {
  if (value.metadata && value.metadata.event && value.metadata.trace) {
    const elasticsearchMetaData = {
      processor: {
        name: 'transaction',
        event: 'transaction'
      },
      trace: {
        id: value.metadata.trace.traceId
      },
      '@timestamp': value.metadata.event.createdAt,
      transaction: {
        result: (value.metadata.event.state.status === 'success') ? 'success' : 'error',
        name: value.metadata.trace.service,
        id: value.metadata.trace.spanId,
        sampled: !value.metadata.trace.sampled
      }
    }
    return { ...value, ...elasticsearchMetaData }
  } else {
    return value
  }
}

const Rx = require('rxjs')
const { ElasticSearchClient } = require('../lib/efk')
const Logger = require('@mojaloop/central-services-logger')

const elasticsearchClientObservable = ({ message }) => {
  return Rx.Observable.create(async observable => {
    try {
      const client = await ElasticSearchClient.getInstance()
      await client.index({
        index: ElasticSearchClient.getIndex(),
        body: addElasticsearchMetaData(message.value)
      })
      // TODO: Investigate the reason/cause for this error being thrown when the next line is uncommented: "TypeError: teardown.unsubscribe is not a function" to be thrown.
      // observable.complete()
    } catch (e) {
      observable.error(e)
      Logger.error(e.stack)
    }
  })
}

module.exports = {
  elasticsearchClientObservable
}
