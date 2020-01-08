const compose = require('compose-then')
const { result, isPlainObject, curry, get } = require('lodash')
const pascalCase = require('pascalcase')
const { downloadEntryImages } = require('./images')

// RESERVED_FIELDS from here https://www.gatsbyjs.org/docs/node-interface/
const RESERVED_FIELDS = ['id', 'children', 'parent', 'fields', 'internal', '__meta__']
const CONFLICT_FIELD_PREFIX = `flamelink_`

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

const prepNav = compose(prepareKeys, checkNavigationTypes)

const DATAFIELD_TO_MEDIATYPE = {
  'markdown-editor': 'text/markdown',
  wysiwyg: 'text/html',
  'wysiwyg-cke': 'text/html'
}

const CONTENT_DATAFIELDS = Object.keys(DATAFIELD_TO_MEDIATYPE)

/**
 * turn editor content into a node
 * with `node.internal.mediaType`
 * so it can be picked up by gatsby's
 * markdown & other transformer plugins
 */
const prepareEditorContentNode = ({ fieldType, editorContent, nodeId, gatsbyHelpers }) => {
  const mediaType = DATAFIELD_TO_MEDIATYPE[fieldType]

  return {
    id: gatsbyHelpers.createNodeId(`flamelink-content-${nodeId}`),
    parent: nodeId,
    children: [],
    content: editorContent,
    internal: {
      mediaType,
      type: `Flamelink${pascalCase(mediaType)}ContentNode`,
      content: editorContent,
      contentDigest: gatsbyHelpers.createContentDigest(editorContent)
    }
  }
}

const processContentEntry = async ({ schema, locale, entry, gatsbyHelpers }) => {
  const contentType = schema.id
  const schemaFields = get(schema, 'fields', [])
  const fieldTypes = schemaFields.reduce(
    (acc, val) => Object.assign(acc, { [val.key]: val.type }),
    {}
  )

  const prepEntry = compose(prepareKeys, checkContentEntryTypes(fieldTypes))

  const preppedEntry = await prepEntry(entry)
  const nodeId = gatsbyHelpers.createNodeId(
    `flamelink-entry-${locale}-${preppedEntry.flamelink_id}`
  )
  const childrenNodes = []

  const contentNodes = Object.entries(fieldTypes).reduce((nodes, fieldEntry) => {
    const [key, fieldType] = fieldEntry
    const editorContent = preppedEntry[key]

    if (!CONTENT_DATAFIELDS.includes(fieldType) || !editorContent) return nodes

    const contentNode = prepareEditorContentNode({
      fieldType,
      editorContent,
      nodeId,
      gatsbyHelpers
    })

    childrenNodes.push(contentNode.id)
    preppedEntry[`${key}___NODE`] = contentNode.id
    delete preppedEntry[key]

    return [...nodes, contentNode]
  }, [])

  const entryNode = {
    ...preppedEntry,
    ...{
      flamelink_locale: locale,
      id: nodeId,
      parent: null,
      children: childrenNodes,
      internal: {
        type: `Flamelink${pascalCase(contentType)}Content`,
        content: JSON.stringify(preppedEntry),
        contentDigest: gatsbyHelpers.createContentDigest(preppedEntry)
      }
    }
  }

  // download & inject local image
  await downloadEntryImages({
    entry: entryNode,
    gatsbyHelpers
  })

  contentNodes.forEach(contentNode => gatsbyHelpers.createNode(contentNode))
  gatsbyHelpers.createNode(entryNode)
}
exports.processContentEntry = processContentEntry

const processNavigation = async ({ locale, nav, gatsbyHelpers }) => {
  const preppedNav = await prepNav(nav)
  const nodeId = gatsbyHelpers.createNodeId(`flamelink-nav-${locale}-${preppedNav.flamelink_id}`)

  return {
    ...preppedNav,
    ...{
      flamelink_locale: locale,
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `Flamelink${pascalCase(preppedNav.flamelink_id)}Navigation`,
        content: JSON.stringify(preppedNav),
        contentDigest: gatsbyHelpers.createContentDigest(preppedNav)
      }
    }
  }
}

exports.processNavigation = processNavigation

const processGlobals = ({ globalsData, gatsbyHelpers }) => {
  const preppedGlobals = prepareKeys(globalsData)
  const nodeId = gatsbyHelpers.createNodeId(`flamelink-globals`)

  return {
    ...preppedGlobals,
    ...{
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `FlamelinkGlobals`,
        content: JSON.stringify(preppedGlobals),
        contentDigest: gatsbyHelpers.createContentDigest(preppedGlobals)
      }
    }
  }
}

exports.processGlobals = processGlobals
