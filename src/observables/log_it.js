var message = { message: 'helloworld_new' }

var Logger = require('fluent-logger-stream')
var logger = new Logger({ tag: 'logstash', type: 'http', host: 'dev1-fluentd.mojaloop.live', port: 80 }) // in_http
logger.send('logstash', message)
