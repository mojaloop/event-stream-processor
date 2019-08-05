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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>

 --------------
 ******/

'use strict'

const Config = require('../../lib/config')
const Mustache = require('mustache')
const KafkaConfig = Config.KAFKA
const Logger = require('@mojaloop/central-services-shared').Logger
const Kafka = require('./index')
const Enum = require('../../lib/enum')

/**
 * The Producer config required
 *
 * @description This ENUM is for the PRODUCER of the topic being created
 *
 * @enum {object} ENUMS~PRODUCER
 * @property {string} PRODUCER - PRODUCER config to be fetched
 */
const PRODUCER = 'PRODUCER'
const CONSUMER = 'CONSUMER'

/**
 * ENUMS
 *
 * @description Global ENUMS object
 *
 * @enum {string} ENUMS
 * @property {string} PRODUCER - This ENUM is for the PRODUCER
 * @property {string} CONSUMER - This ENUM is for the CONSUMER
 */
const ENUMS = {
  PRODUCER,
  CONSUMER
}

/**
 * @function GeneralTopicTemplate
 *
 * @description Generates a general topic name from the 2 inputs, which are used in the placeholder general topic template found in the default.json
 *
 * @param {string} functionality - the functionality flow. Example: 'event'
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const generalTopicTemplate = (functionality) => {
  try {
    return Mustache.render(Config.KAFKA.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, { functionality })
  } catch (e) {
    Logger.error(e)
    throw e
  }
}

/**
 * @function TransformGeneralTopicName
 *
 * @description generalTopicTemplate called which generates a general topic name from the input, which are used in the placeholder general topic template found in the default.json
 *
 * @param {string} functionality - the functionality flow. Example: 'event'
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const transformGeneralTopicName = (functionality) => {
  try {
    if (Enum.topicMap[functionality] && Enum.topicMap[functionality]) {
      return generalTopicTemplate(Enum.topicMap[functionality].functionality)
    }
    return generalTopicTemplate(functionality)
  } catch (e) {
    throw e
  }
}

/**
 * @function GetKafkaConfig
 *
 * @description participantTopicTemplate called which generates a participant topic name from the 2 inputs, which are used in the placeholder participant topic template found in the default.json
 *
 * @param {string} flow - This is required for the config for the Stream Processing API. Example: 'PRODUCER' ie: note the case of text
 * @param {string} functionality - the functionality flow. Example: 'EVENT' ie: note the case of text
 *
 * @returns {string} - Returns topic name to be created, throws error if failure occurs
 */
const getKafkaConfig = (flow, functionality) => {
  try {
    const flowObject = KafkaConfig[flow]
    const functionalityObject = flowObject[functionality]
    functionalityObject.config.logger = Logger
    return functionalityObject.config
  } catch (e) {
    throw new Error(`No config found for those parameters flow='${flow}', functionality='${functionality}'`)
  }
}

/**
 * @function createGeneralTopicConfig
 *
 * @param {string} functionality - the functionality flow. Example: 'transfer' ie: note the case of text
 * @param {string} key - the key that gets assigned to the topic
 * @param {number} partition - optional partition to produce to
 * @param {*} opaqueKey - optional opaque token, which gets passed along to your delivery reports
 *
 * @returns {object} - Returns newly created general topicConfig
 */
const createGeneralTopicConf = (functionality, key = null, partition = null, opaqueKey = null) => {
  return {
    topicName: transformGeneralTopicName(functionality),
    key,
    partition,
    opaqueKey
  }
}

/**
 * @function produceGeneralMessage
 *
 * @async
 * @description This is an async method that produces a message against a generated Kafka topic. it is called multiple times
 *
 * Kafka.Producer.produceMessage called to persist the message to the configured topic on Kafka
 * Utility.updateMessageProtocolMetadata called updates the messages metadata
 * Utility.createGeneralTopicConf called dynamically generates the general topic configuration
 * Utility.getKafkaConfig called dynamically gets Kafka configuration
 *
 * @param {string} functionality - the functionality flow. Example: 'event' ie: note the case of text
 * @param {object} message - a list of messages to consume for the relevant topic
 * @param {string} key - key applicable to topic
 * @param {string} partition - which partition the message should be produced to
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const produceGeneralMessage = async (functionality, message, key, partition) => {
  let functionalityMapped = functionality
  if (Enum.topicMap[functionality] && Enum.topicMap[functionality]) {
    functionalityMapped = Enum.topicMap[functionality].functionality
  }
  Logger.info(`topicConf: ${JSON.stringify(createGeneralTopicConf(functionalityMapped, key, partition))}`)
  let result = await Kafka.Producer.produceMessage(message,
    createGeneralTopicConf(functionalityMapped, key, partition),
    getKafkaConfig(ENUMS.PRODUCER, functionalityMapped.toUpperCase()))
  return result
}

module.exports = {
  ENUMS,
  transformGeneralTopicName,
  getKafkaConfig,
  createGeneralTopicConf,
  produceGeneralMessage
}
