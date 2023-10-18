class WickrBrain {
  constructor(wickr) {
    this.wickr = wickr
  }

  get(key) {
    let value
    try {
      value = this.wickr.cmdGetKeyValue(key)
    } catch (error) {
      console.log(`Error getting key ${key}:`, error)
      return null
    }

    return value
  }

  set(key, value) {
    return this.wickr.cmdAddKeyValue(key, value)
  }

  delete(key) {
    return this.wickr.cmdDeleteKeyValue(key)
  }

  clear() {
    return this.wickr.cmdClearAllKeyValues()
  }
}

module.exports = WickrBrain
