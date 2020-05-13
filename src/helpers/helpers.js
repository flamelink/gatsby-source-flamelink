const flatten = require('flat')
const { set, get } = require('lodash')

/**
 * Parse a Firebase Timestamp object to a UTC string
 */
const parseFirebaseDate = timestampObject => {
  if (timestampObject && timestampObject.toDate && typeof timestampObject.toDate === 'function') {
    return timestampObject.toDate()
  }
  return timestampObject
}

/**
 * Iterate over an object and parse all Firebase Timestamp objects to UTC strings
 */
exports.parseMetaTimestamps = entry => {
  const flattenedEntry = flatten(entry)
  /**
   * After flattening the entry a Firebase timestamp can be found by looking for keys that
   * contains either a `_seconds` or a `_nanoseconds` property. We'll look for the `_seconds`
   * key. Once found we know that the related entry is a Firebase timestamp and we pass
   * it on to be parsed into a UTC string.
   */
  Object.keys(flattenedEntry)
    .filter(key => key.includes('_seconds'))
    .forEach(flattenedKey => {
      const key = flattenedKey.split('._seconds')[0]
      set(entry, key, parseFirebaseDate(get(entry, key)))
    })
  return entry
}
