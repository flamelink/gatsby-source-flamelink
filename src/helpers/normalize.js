const compose = require('compose-then')
const { result, isPlainObject, curry, get, keys } = require('lodash')
const pascalCase = require('pascalcase')
const { downloadEntryImages } = require('./images')
const { parseFirebaseTimestamps } = require('./helpers')

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

  let newEntry = { ...entry }
  keys(newEntry).forEach(key => {
    const newKey = getValidKey(key)
    newEntry[newKey] = newEntry[key]

    if (newKey !== key) {
      delete newEntry[key]
    }

    if (Array.isArray(newEntry[newKey])) {
      newEntry[newKey] = newEntry[newKey].map(prepareKeys)
    }
  })

  // Find and convert Firebase Timestamp objects to UTC strings
  newEntry = parseFirebaseTimestamps(newEntry)

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
  keys(newEntry).forEach(async key => {
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
  keys(newNav).forEach(key => {
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

/**
 * turn editor content into a node
 * with `node.internal.mediaType`
 * so it can be picked up by gatsby's
 * markdown & other transformer plugins
 */
const prepareEditorContentNode = ({
  fieldType,
  fieldKey,
  editorContent,
  nodeId,
  gatsbyHelpers
}) => {
  const mediaType = DATAFIELD_TO_MEDIATYPE[fieldType]

  if (!mediaType) {
    gatsbyHelpers.reporter.warn(`No media type found for field type: ${fieldType}.`)
  }

  return {
    id: gatsbyHelpers.createNodeId(`flamelink-content-node-${nodeId}-${fieldType}-${fieldKey}`),
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

const createContentEntryNode = async ({ entryNode, gatsbyHelpers }) => {
  // download & inject local image
  await downloadEntryImages({
    entry: entryNode,
    gatsbyHelpers
  })

  gatsbyHelpers.createNode(entryNode)
}

const processContentEntryFields = async ({
  contentType,
  fields,
  nodeEntry,
  nodeId,
  parentFieldKey = '',
  gatsbyHelpers
}) => {
  const children = []

  if (!fields || !fields.length || !isPlainObject(nodeEntry)) {
    return children
  }

  await Promise.all(
    fields.map(async field => {
      const fieldKey = field.key
      const fieldType = field.type
      const fieldValue = nodeEntry[field.key]

      switch (fieldType) {
        case 'markdown-editor':
        case 'wysiwyg':
        case 'wysiwyg-cke': {
          const contentNode = prepareEditorContentNode({
            fieldType,
            fieldKey,
            editorContent: fieldValue,
            nodeId,
            gatsbyHelpers
          })

          gatsbyHelpers.createNode(contentNode)

          children.push(contentNode.id)
          nodeEntry[`${fieldKey}___NODE`] = contentNode.id
          delete nodeEntry[fieldKey]
          break
        }

        case 'fieldset': {
          const fieldNode = fieldValue || {}
          const fieldNodeId = gatsbyHelpers.createNodeId(
            `flamelink-field-${nodeId}-${parentFieldKey}${fieldKey}`
          )
          const fieldNodeType = `Flamelink${pascalCase(
            contentType
          )}ContentField${parentFieldKey}${pascalCase(fieldKey)}`

          const contentNode = {
            ...fieldNode,
            ...{
              id: fieldNodeId,
              parent: nodeId,
              children: await processContentEntryFields({
                contentType,
                nodeId: fieldNodeId,
                nodeEntry: fieldNode,
                parentFieldKey: `${parentFieldKey}${pascalCase(fieldKey)}`,
                fields: field.options,
                gatsbyHelpers
              }),
              internal: {
                type: fieldNodeType,
                content: JSON.stringify(fieldNode),
                contentDigest: gatsbyHelpers.createContentDigest(fieldNode)
              }
            }
          }

          children.push(contentNode.id)
          nodeEntry[`${fieldKey}___NODE`] = contentNode.id
          delete nodeEntry[fieldKey]

          await createContentEntryNode({ entryNode: contentNode, gatsbyHelpers })

          break
        }

        case 'repeater': {
          const repeaterFieldNode = fieldValue || []

          const repeaterFieldNodeId = gatsbyHelpers.createNodeId(
            `flamelink-field-${nodeId}-${parentFieldKey}${fieldKey}`
          )
          const repeaterFieldNodeType = `Flamelink${pascalCase(
            contentType
          )}ContentField${parentFieldKey}${pascalCase(fieldKey)}`

          const rowNodes = await Promise.all(
            repeaterFieldNode.map(async (item, idx) => {
              // A repeater row item is basically a field group
              const fieldNode = item || {}
              const fieldNodeId = gatsbyHelpers.createNodeId(
                `flamelink-field-${nodeId}-${parentFieldKey}${fieldKey}${idx}`
              )
              const fieldNodeType = `Flamelink${pascalCase(
                contentType
              )}ContentField${parentFieldKey}${pascalCase(fieldKey)}Item`

              const contentNode = {
                ...fieldNode,
                ...{
                  id: fieldNodeId,
                  parent: repeaterFieldNodeId,
                  children: await processContentEntryFields({
                    contentType,
                    nodeId: fieldNodeId,
                    nodeEntry: fieldNode,
                    parentFieldKey: `${parentFieldKey}${pascalCase(fieldKey)}`,
                    fields: field.options,
                    gatsbyHelpers
                  }),
                  internal: {
                    type: fieldNodeType,
                    content: JSON.stringify(fieldNode),
                    contentDigest: gatsbyHelpers.createContentDigest(fieldNode)
                  }
                }
              }

              children.push(contentNode.id)
              nodeEntry[`${fieldKey}___NODE`] = contentNode.id
              delete nodeEntry[fieldKey]

              await createContentEntryNode({ entryNode: contentNode, gatsbyHelpers })

              return fieldNodeId
            })
          )

          const contentNode = {
            ...repeaterFieldNode,
            ...{
              id: repeaterFieldNodeId,
              parent: nodeId,
              children: rowNodes,
              internal: {
                type: repeaterFieldNodeType,
                content: JSON.stringify(repeaterFieldNode),
                contentDigest: gatsbyHelpers.createContentDigest(repeaterFieldNode)
              }
            }
          }

          children.push(contentNode.id)
          nodeEntry[`${fieldKey}___NODE`] = rowNodes
          delete nodeEntry[fieldKey]

          await createContentEntryNode({ entryNode: contentNode, gatsbyHelpers })

          break
        }

        default:
          break
      }
    })
  )

  return children
}

const getEntryNode = async ({ contentType, nodeType, fields, entry, locale, gatsbyHelpers }) => {
  const fieldTypes = fields.reduce((acc, val) => Object.assign(acc, { [val.key]: val.type }), {})
  const prepEntry = compose(prepareKeys, checkContentEntryTypes(fieldTypes))

  const preppedEntry = await prepEntry(entry)

  const nodeId = gatsbyHelpers.createNodeId(
    `flamelink-entry-${locale}-${preppedEntry.flamelink_id}`
  )

  return {
    ...preppedEntry,
    ...{
      flamelink_locale: locale,
      id: nodeId,
      parent: null,
      children: await processContentEntryFields({
        contentType,
        nodeId,
        nodeEntry: preppedEntry,
        fields,
        gatsbyHelpers
      }),
      internal: {
        type: nodeType,
        content: JSON.stringify(preppedEntry),
        contentDigest: gatsbyHelpers.createContentDigest(preppedEntry)
      }
    }
  }
}

const processContentEntry = async ({ schema, locale, entry, gatsbyHelpers }) => {
  const contentType = schema.id
  const fields = get(schema, 'fields', [])

  const entryNode = await getEntryNode({
    contentType,
    nodeType: `Flamelink${pascalCase(contentType)}Content`,
    fields,
    entry,
    locale,
    gatsbyHelpers
  })

  await createContentEntryNode({ entryNode, gatsbyHelpers })
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
  const preppedGlobals = prepareKeys(globalsData || {})
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
