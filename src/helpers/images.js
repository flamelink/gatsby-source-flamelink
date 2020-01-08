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
  if (typeof entry !== 'object' || !entry) return []

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

const downloadEntryImages = async ({ entry, gatsbyHelpers }) => {
  const { getNode, touchNode, reporter, store, cache, createNode, createNodeId } = gatsbyHelpers
  const entryImages = locateImageFields(entry)
  logInfo(`Found images for entry with ID: ${entry.flamelink_id}`, entryImages.length)
  return Promise.all(
    entryImages.map(async image => {
      const { id, flamelink_id, url } = image
      const fileId = flamelink_id || id
      const mediaDataCacheKey = `flamelink-media-${fileId}`
      const cacheMediaData = await cache.get(mediaDataCacheKey)

      let fileNodeID

      if (cacheMediaData && cacheMediaData.fileNodeID) {
        const fileNode = getNode(cacheMediaData.fileNodeID)

        if (fileNode) {
          logInfo('Found image in cache:', fileId)
          // eslint-disable-next-line prefer-destructuring
          fileNodeID = cacheMediaData.fileNodeID
          touchNode({
            nodeId: fileNodeID
          })
        }
      } else {
        try {
          logInfo('Downloading image:', fileId)
          const fileNode = await createRemoteFileNode({
            url,
            store,
            cache,
            createNode,
            createNodeId,
            parentNodeId: fileId
          })

          if (fileNode) {
            fileNodeID = fileNode.id
            await cache.set(mediaDataCacheKey, {
              fileNodeID
            })
          }
        } catch (e) {
          reporter.warn(`Failed to download image: ${fileId}`)
        }
      }

      // eslint-disable-next-line no-param-reassign
      image.localFile___NODE = fileNodeID || null

      return image
    })
  )
}

exports.downloadEntryImages = downloadEntryImages
