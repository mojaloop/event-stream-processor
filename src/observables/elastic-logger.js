const Rx = require('rxjs')
const { ElasticSearchClient } = require('../lib/efk')
const Logger = require('@mojaloop/central-services-shared').Logger

const elasticsearchClientObservable = ({ message }) => {
  return Rx.Observable.create(async observable => {
    try {
      const client = await ElasticSearchClient.getInstance()
      await client.index({
        index: 'mojaloop',
        body: message.value
      })
      observable.complete()
    } catch (e) {
      observable.error(e)
      Logger.error(e)
    }
  })
}

module.exports = {
  elasticsearchClientObservable
}
