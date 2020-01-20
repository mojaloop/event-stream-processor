const { actionDictionary } = require('@mojaloop/event-sdk')
const Config = require('../config')
const efkLogFilterMap = (() => {
  let filterMap = new Map()

  const getActionValue = (key, value) => {
    const actionValue = (value === '*') ? actionDictionary[key] : [value]
    return actionValue
  }

  Config.EFK_CLIENT.LOG_FILTER.split(',').forEach(filter => {
    const [key, value] = filter.trim().split(':')
    if (key === '*') {
      filterMap = new Map(Object.entries(actionDictionary))
      return filterMap
    }
    const valueToAdd = getActionValue(key, value)
    if (!filterMap.has(key)) {
      filterMap.set(key, valueToAdd)
    } else {
      if (valueToAdd.length === actionDictionary[key].length) {
        filterMap.set(key, valueToAdd)
      } else {
        const valueToUpdate = filterMap.get(key)
        if (!valueToUpdate.includes(valueToAdd[0])) {
          valueToUpdate.push(valueToAdd[0])
          filterMap.set(key, valueToUpdate)
        }
      }
    }
  })
  return filterMap
})()

const shouldLogToEfk = (eventType, eventAction) => {
  const allowedActions = efkLogFilterMap.get(eventType)
  if (allowedActions && eventAction) {
    return allowedActions.includes(eventAction)
  } else {
    return false
  }
}

module.exports = {
  shouldLogToEfk
}
