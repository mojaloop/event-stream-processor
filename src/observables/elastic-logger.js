const Rx = require('rxjs')
const { client } = require('../lib/efk').elasticSearchClient

const elasticsearchClientObservable = ({ message }) => {
  return Rx.Observable.create(async observable => {
    try {
      await client.index({
        index: 'mojaloop',
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
