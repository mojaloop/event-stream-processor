const RC = require('parse-strings-in-object')(require('rc')('EVENTSP', require('../../config/default.json')))

module.exports = {
  PORT: RC.PORT,
  EFK_CLIENT: RC.EFK_CLIENT,
  APM: RC.APM,
  KAFKA_CONFIG: RC.KAFKA
}
