// eslint-disable-next-line import/no-unresolved
const { createRemoteFileNode } = require('gatsby-source-filesystem')
const { logInfo } = require('./logger')

const SUPPORTED_IMAGE_TYPES = ['png', 'jpg', 'jpeg']

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
    const [type, subType] = contentType.split('/')
    if (type === 'image' && SUPPORTED_IMAGE_TYPES.includes(subType)) {
      results.push(entry)
    }
  }

  // run recursively on array & object
  const entryList = Array.isArray(entry) ? entry : Object.values(entry)
  results = entryList.reduce((acc, value) => acc.concat(locateImageFields(value)), results)

  return results
}

exports.locateImageFields = locateImageFields

const downloadEntryImages = async ({
  entry,
  store,
  getNode,
  touchNode,
  cache,
  createNode,
  createNodeId,
  reporter
}) => {
  const entryImages = locateImageFields(entry)
  logInfo(`Found images for entry with ID: ${entry.flamelink_id}`, entryImages.length)
  return Promise.all(
    entryImages.map(async image => {
      const { id, url } = image
      let fileNodeID
      const mediaDataCacheKey = `flamelink-media-${image.flamelink_id || image.id}`
      const cacheMediaData = await cache.get(mediaDataCacheKey)

      if (cacheMediaData && cacheMediaData.fileNodeID) {
        const fileNode = getNode(cacheMediaData.fileNodeID)

        if (fileNode) {
          logInfo('Found image in cache:', image.file)
          // eslint-disable-next-line prefer-destructuring
          fileNodeID = cacheMediaData.fileNodeID
          touchNode({
            nodeId: fileNodeID
          })
        }
      } else {
        try {
          logInfo('Downloading image:', image.file)
          const fileNode = await createRemoteFileNode({
            url,
            store,
            cache,
            createNode,
            createNodeId,
            parentNodeId: id
          })

          if (fileNode) {
            fileNodeID = fileNode.id
            await cache.set(mediaDataCacheKey, {
              fileNodeID
            })
          }
        } catch (e) {
          reporter.warn(`failed to download ${image.file}`)
        }
      }

      // eslint-disable-next-line no-param-reassign
      image.localFile___NODE = fileNodeID || null

      return image
    })
  )
}

exports.downloadEntryImages = downloadEntryImages
