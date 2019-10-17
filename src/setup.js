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

const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Consumer = Kafka.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Logger = require('@mojaloop/central-services-logger')
const Rx = require('rxjs')
const { share, filter, flatMap } = require('rxjs/operators')
const Config = require('./lib/config')
const HealthCheck = require('@mojaloop/central-services-shared').HealthCheck.HealthCheck
const { createHealthCheckServer, defaultHealthHandler } = require('@mojaloop/central-services-health')
const packageJson = require('../package.json')
const { getSubServiceHealthBroker } = require('./lib/healthCheck/subServiceHealth')
const Observables = require('./observables')
const { initializeCache } = require('./lib/masterSpan')

const setup = async () => {
  await registerEventHandler()
  await initializeCache(Config.CACHE_CONFIG)
  const topicName = Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Action.EVENT)
  const consumer = Consumer.getConsumer(topicName)
  const healthCheck = new HealthCheck(packageJson, [
    getSubServiceHealthBroker
  ])
  await createHealthCheckServer(Config.PORT, defaultHealthHandler(healthCheck))

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
      for (let span in spans) {
        Logger.info(spans[span].context())
      }
    },
    error: (e) => Logger.error(e),
    completed: () => Logger.info('trace info sent')
  })
}

/**
 * @function registerEventHandler
 *
 * @description This is used to register the handler for the Event topic according to a specified Kafka congfiguration
 *
 * @returns true
 * @throws {Error} - if handler failed to create
 */
const registerEventHandler = async () => {
  try {
    const EventHandler = {
      topicName: Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Action.EVENT),
      config: Kafka.getKafkaConfig(Config.KAFKA_CONFIG, Enum.Kafka.Config.CONSUMER, Enum.Events.Event.Type.EVENT.toUpperCase())

    }
    EventHandler.config.rdkafkaConf['client.id'] = EventHandler.topicName
    await Consumer.createHandler(EventHandler.topicName, EventHandler.config)
    return true
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

module.exports = {
  setup
}
