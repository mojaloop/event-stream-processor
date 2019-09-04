const Rx = require('rxjs')
const efkClient = require('../lib/efk').elasticSearchClient

const elasticsearchClientObservable = ({ message }) => {
  return Rx.Observable.create(async observable => {
    try {
      await efkClient.client.index({
        index: 'mojaloop',
        type: 'mytype',
        body: message.value
      })
      observable.complete()
    } catch (e) {
      observable.error(e)
    }
  })
}

module.exports = {
  elasticsearchClientObservable
}
