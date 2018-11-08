const crypto = require('crypto')
const compose = require('compose-then')
const { result, isPlainObject, curry, get } = require('lodash')
const pascalCase = require('pascalcase')
const api = require('./api')

// RESERVED_FIELDS from here https://www.gatsbyjs.org/docs/node-interface/
const RESERVED_FIELDS = ['id', 'children', 'parent', 'fields', 'internal', '__meta__']
const CONFLICT_FIELD_PREFIX = `flamelink_`

/**
 * Encrypts a String using md5 hash of hexadecimal digest.
 *
 * @param {any} str
 */
const digest = str =>
  crypto
    .createHash(`md5`)
    .update(str)
    .digest(`hex`)

/**
 * Validate the GraphQL naming conventions & protect specific fields.
 * DISCLAIMER: Adapted from `gatsby-source-wordpress`
 *
 * @param {any} key
 * @returns the valid name
 */
function getValidKey(key) {
  let nkey = String(key)
  const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/
  // Replace invalid characters
  if (!NAME_RX.test(nkey)) {
    nkey = nkey.replace(/-|__|:|\.|\s/g, `_`)
  }
  // Prefix if first character isn't a letter.
  if (!NAME_RX.test(nkey.slice(0, 1))) {
    nkey = `${CONFLICT_FIELD_PREFIX}${nkey}`
  }
  if (RESERVED_FIELDS.includes(nkey)) {
    nkey = `${CONFLICT_FIELD_PREFIX}${nkey}`.replace(/-|__|:|\.|\s/g, `_`)
  }

  return nkey
}
exports.getValidKey = getValidKey

const prepareKeys = entry => {
  if (!isPlainObject(entry)) {
    return entry
  }

  const newEntry = { ...entry }
  Object.keys(newEntry).forEach(key => {
    const newKey = getValidKey(key)
    newEntry[newKey] = newEntry[key]

    if (newKey !== key) {
      delete newEntry[key]
    }

    if (Array.isArray(newEntry[newKey])) {
      newEntry[newKey] = newEntry[newKey].map(prepareKeys)
    }
  })

  return newEntry
}

const DATAFIELD_TO_DATATYPE = {
  autocomplete: 'string',
  boolean: 'boolean',
  checkbox: 'string',
  color: 'string',
  date: 'string',
  'datetime-local': 'string',
  email: 'string',
  fieldset: 'object',
  'linked-text': 'string',
  location: 'object',
  'markdown-editor': 'string',
  media: 'object',
  number: 'number',
  password: 'string',
  radio: 'string',
  range: 'string',
  repeater: 'object',
  select: 'object',
  'select-relational': 'object',
  tag: 'object',
  text: 'string',
  textarea: 'string',
  time: 'string',
  'tree-relational': 'object',
  wysiwyg: 'string',
  'wysiwyg-cke': 'string'
}

const checkContentEntryTypes = curry(async (fieldTypes, entry) => {
  if (!isPlainObject(entry)) {
    return entry
  }

  const newEntry = { ...entry }
  Object.keys(newEntry).forEach(async key => {
    const dataType =
      key === 'order'
        ? 'number'
        : DATAFIELD_TO_DATATYPE[fieldTypes[key]] || (typeof newEntry[key] === 'number' && 'string')

    switch (dataType) {
      case 'string':
        newEntry[key] = result(newEntry[key], 'toString', '')
        break

      case 'number':
        newEntry[key] = parseFloat(newEntry[key], 10)
        break

      // no default
    }

    if (Array.isArray(newEntry[key])) {
      newEntry[key] = await Promise.all(newEntry[key].map(checkContentEntryTypes({})))
    }
  })

  return newEntry
})

const checkNavigationTypes = nav => {
  if (!isPlainObject(nav)) {
    return nav
  }

  const newNav = { ...nav }
  Object.keys(newNav).forEach(key => {
    switch (key) {
      case 'id':
      case 'uuid':
      case 'title':
      case 'component':
      case 'cssClass':
      case 'parentIndex':
      case 'url':
        if (typeof newNav[key] !== 'string') {
          newNav[key] = result(newNav[key], 'toString', '')
        }
        break

      case 'items':
      case 'children':
        if (!Array.isArray(newNav[key])) {
          newNav[key] = []
        }
        break

      case 'newWindow':
        if (typeof newNav[key] !== 'boolean') {
          newNav[key] = Boolean(newNav[key])
        }
        break

      case 'order':
        if (typeof newNav[key] !== 'number') {
          newNav[key] = parseInt(newNav[key], 10)
        }
        break

      // no default
    }

    if (Array.isArray(newNav[key])) {
      newNav[key] = newNav[key].map(checkNavigationTypes)
    }
  })

  return newNav
}

const prepNav = compose(
  prepareKeys,
  checkNavigationTypes
)

const processContentEntry = async (contentType, locale, entry, createNodeId) => {
  const schemas = await api.getSchemas()
  const fieldTypes = get(schemas.find(schema => schema.id === contentType), 'fields', []).reduce(
    (acc, val) => Object.assign(acc, { [val.key]: val.type }),
    {}
  )

  const prepEntry = compose(
    prepareKeys,
    checkContentEntryTypes(fieldTypes)
  )

  const preppedEntry = await prepEntry(entry)
  const nodeId = createNodeId(`flamelink-entry-${locale}-${preppedEntry.flamelink_id}`)
  const nodeContent = JSON.stringify(preppedEntry)

  return {
    ...preppedEntry,
    ...{
      flamelink_locale: locale,
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `Flamelink${pascalCase(contentType)}Content`,
        content: nodeContent,
        contentDigest: digest(nodeContent)
      }
    }
  }
}
exports.processContentEntry = processContentEntry

const processNavigation = async (locale, nav, createNodeId) => {
  const preppedNav = await prepNav(nav)
  const nodeId = createNodeId(`flamelink-nav-${locale}-${preppedNav.flamelink_id}`)
  const nodeContent = JSON.stringify(preppedNav)

  return {
    ...preppedNav,
    ...{
      flamelink_locale: locale,
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `Flamelink${pascalCase(preppedNav.flamelink_id)}Navigation`,
        content: nodeContent,
        contentDigest: digest(nodeContent)
      }
    }
  }
}

exports.processNavigation = processNavigation

const processGlobals = (globalsData, createNodeId) => {
  const preppedGlobals = prepareKeys(globalsData)
  const nodeId = createNodeId(`flamelink-globals`)
  const nodeContent = JSON.stringify(preppedGlobals)

  return {
    ...preppedGlobals,
    ...{
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `FlamelinkGlobals`,
        content: nodeContent,
        contentDigest: digest(nodeContent)
      }
    }
  }
}

exports.processGlobals = processGlobals
