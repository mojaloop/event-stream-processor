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
const Util = require('@mojaloop/central-services-stream').Util
const Consumer = Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Logger = require('@mojaloop/central-services-logger')
const Rx = require('rxjs')
const { share, filter, mergeMap, catchError } = require('rxjs/operators')
const Config = require('./lib/config')
const HealthCheck = require('@mojaloop/central-services-shared').HealthCheck.HealthCheck
const { createHealthCheckServer, defaultHealthHandler } = require('@mojaloop/central-services-health')
const packageJson = require('../package.json')
const { getSubServiceHealthBroker } = require('./lib/healthCheck/subServiceHealth')
const Observables = require('./observables')
const { initializeCache } = Observables.TraceObservable

const setup = async () => {
  await registerEventHandler()
  await initializeCache()
  const topicName = Kafka.transformGeneralTopicName(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, Enum.Events.Event.Action.EVENT)
  const consumer = Consumer.getConsumer(topicName)
  const healthCheck = new HealthCheck(packageJson, [
    getSubServiceHealthBroker
  ])
  await createHealthCheckServer(Config.PORT, defaultHealthHandler(healthCheck))

  const topicObservable = Rx.Observable.create((observer) => {
    consumer.on('message', async (message) => {
      Logger.debug(`Central-Event-Processor :: Topic ${topicName} :: Payload: \n${JSON.stringify(message.value, null, 2)}`)
      observer.next({ message })
      if (!Consumer.isConsumerAutoCommitEnabled(topicName)) {
        consumer.commitMessageSync(message)
      }
    })
  })

  const sharedMessageObservable = topicObservable.pipe(share(), catchError(e => { 
    Logger.error(e.stack)
    return Rx.onErrorResumeNext(sharedMessageObservable) 
  }))

  sharedMessageObservable.subscribe(async props => {
    Observables.elasticsearchClientObservable(props).subscribe({
      next: v => Logger.debug(v),
      error: (e) => Logger.error(e.stack),
      completed: () => Logger.debug('elastic API log completed')
    })
  })

  const tracingObservable = sharedMessageObservable.pipe(
    filter(props => props.message.value.metadata.event.type === 'trace'),
    mergeMap(Observables.TraceObservable.extractContextObservable),
    mergeMap(Observables.TraceObservable.cacheSpanContextObservable),
    mergeMap(Observables.TraceObservable.findLastSpanObservable),
    mergeMap(Observables.TraceObservable.recreateTraceObservable),
    mergeMap(Observables.TraceObservable.sendTraceToApmObservable),
    catchError(e => {
      Logger.error(e.stack)
      return Rx.onErrorResumeNext(tracingObservable) 
    }))

  tracingObservable.subscribe({
    next: traceId => {
      Logger.debug(`traceId ${traceId} sent to APM`)
    },
    error: (e) => Logger.error(e.stack),
    completed: () => Logger.debug('trace info sent')
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
    Logger.error(e.stack)
    throw e
  }
}

module.exports = {
  setup
}
