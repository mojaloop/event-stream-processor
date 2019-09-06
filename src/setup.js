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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * @module src/setup
 */
const Consumer = require('./lib/kafka/consumer')
const Utility = require('./lib/kafka/util')
const Enums = require('./lib/enum')
const Logger = require('@mojaloop/central-services-shared').Logger
const Rx = require('rxjs')
const { share, filter, flatMap } = require('rxjs/operators')
const createHealtcheck = require('healthcheck-server')
const Config = require('./lib/config')
const { initLogger } = require('./lib/efk')
const configuration = Config.util.toObject()
// const { initTracer } = require('./lib/tracer')
const Observables = require('./observables')

const setup = async () => {
  await initLogger(configuration.efk.namespace, configuration.efk)
  // await initTracer(configuration.apm)
  await Consumer.registerEventHandler()
  const topicName = Utility.transformGeneralTopicName(Enums.eventType.EVENT)
  const consumer = Consumer.getConsumer(topicName)

  createHealtcheck({
    port: Config.get('PORT'),
    path: '/health',
    status: ({ cpu, memory }) => {
      if (consumer._status.running) return true
      else return false
    }
  })

  const topicObservable = Rx.Observable.create((observer) => {
    consumer.on('message', async (message) => {
      Logger.info(`Central-Event-Processor :: Topic ${topicName} :: Payload: \n${JSON.stringify(message.value, null, 2)}`)
      observer.next({ message })
      if (!Consumer.isConsumerAutoCommitEnabled(topicName)) {
        consumer.commitMessageSync(message)
      }
    })
  })

  const sharedMessageObservable = topicObservable.pipe(share())

  sharedMessageObservable.subscribe(async props => {
    // Observables.fluentdObservable(props).subscribe({
    //   next: v => Logger.info(v),
    //   error: (e) => Logger.error(e),
    //   completed: () => Logger.info('fluentd log completed')
    // })
    Observables.elasticsearchClientObservable(props).subscribe({
      next: v => Logger.info(v),
      error: (e) => Logger.error(e),
      completed: () => Logger.info('elastic API log completed')
    })
  })

  const tracingObservable = sharedMessageObservable.pipe(
    filter(props => props.message.value.metadata.event.type === 'trace'),
    flatMap(Observables.apmTracerObservable))

  tracingObservable.subscribe({
    next: spans => {
      for (const span in spans) {
        Logger.info(spans[span].context())
      }
    },
    error: (e) => Logger.error(e),
    completed: () => Logger.info('trace info sent')
  })
}

module.exports = {
  setup
}
