// const { createRemoteFileNode } = require('gatsby-source-filesystem')
const supportedExtensions = ['jpeg', 'jpg', 'png', 'webp', 'tif', 'tiff']

/**
 * Recursively search for image fields in content
 *
 * @param {any} entry
 * @return {array} an Array of all node with { contentType: 'image/png', url: ... }
 */
const locateImageFields = entry => {
  if (typeof entry !== 'object' || entry == null) return []

  let results = []

  // perfect condition
  const { contentType, url } = entry
  if (contentType && url) {
    const ext = contentType.split('/')[1]
    if (supportedExtensions.includes(ext)) results.push(entry)
  }

  // run recursively on array & object
  const entryList = Array.isArray(entry) ? entry : Object.values(entry)
  results = entryList.reduce((acc, value) => acc.concat(locateImageFields(value)), results)

  return results
}

exports.locateImageFields = locateImageFields
