/**
 * # Flamelink source plugin for Gatsby
 *
 * DISCLAIMER: This plugin is heavily inspired by the awesome work done on the `gatsby-source-wordpress` plugin
 * (https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-source-wordpress) as well as others
 */
const present = require('present')
const api = require('./helpers/api')
const normalize = require('./helpers/normalize')
const { logInfo, logError } = require('./helpers/logger')

/**
 *
 *
 * @param {*} { actions, createNodeId }
 * @param {*} [configOptions={}]
 */
exports.sourceNodes = async (
  { actions, getNode, createNodeId, createContentDigest, reporter, store, cache },
  configOptions = {}
) => {
  const { createNode, touchNode, createParentChildLink } = actions
  const {
    content = true,
    navigation = true,
    globals = true,
    environment = 'production',
    dbType = 'rtdb',
    populate = true,
    firebaseConfig
  } = configOptions

  const gatsbyHelpers = {
    getNode,
    touchNode,
    createNode,
    createNodeId,
    createContentDigest,
    createParentChildLink,
    store,
    cache,
    reporter
  }

  try {
    logInfo('Starting with config:', JSON.stringify(configOptions))
    const startTime = present()

    // Initialize Flamelink app
    const app = api.initApp({ firebaseConfig, environment, dbType })
    await app.settings.setEnvironment(environment)

    if (globals) {
      logInfo('Globals started')
      const globalsData = await app.settings.getGlobals()
      createNode(normalize.processGlobals({ globalsData, gatsbyHelpers }))
      logInfo('Globals finished')
    }

    const availableLocales = await api.getLocales(configOptions)
    logInfo(`Available Locales: ${availableLocales.join()}`)

    await Promise.all(
      availableLocales.map(async locale => {
        logInfo(`Start processing locale: ${locale}`)
        await api.setLocale(locale)

        if (content) {
          logInfo('Content started:', JSON.stringify(content))
          const schemas = await api.getSchemas(configOptions)

          await Promise.all(
            schemas.map(async schema => {
              let contentData

              if (Array.isArray(content)) {
                const schemaKey = content.find(
                  type =>
                    (Array.isArray(type)
                      ? type[0]
                      : typeof type === 'object'
                      ? type.schemaKey
                      : type) === schema.id
                )

                logInfo(`Schema Key: ${JSON.stringify(schemaKey)}`)

                if (!schemaKey) {
                  return
                }

                const contentConfig = Array.isArray(schemaKey)
                  ? schemaKey
                  : typeof schemaKey === 'object'
                  ? [schemaKey]
                  : [{ schemaKey }]

                contentData = await app.content.get(...contentConfig)
              } else {
                const contentConfig = { schemaKey: schema.id, populate }
                contentData = await app.content.get(contentConfig)
              }

              if (contentData) {
                const entries =
                  schema.type === 'single' ? [contentData] : Object.values(contentData)

                await Promise.all(
                  entries.map(async entry => {
                    return normalize.processContentEntry({ schema, locale, entry, gatsbyHelpers })
                  })
                )
              }
            })
          )

          logInfo('Content finished')
        }

        if (navigation) {
          logInfo('Navigation started:', JSON.stringify(navigation))
          let navs

          if (Array.isArray(navigation)) {
            navs = await Promise.all(
              navigation.map(nav =>
                app.nav.get(
                  ...(Array.isArray(nav)
                    ? nav
                    : typeof nav === 'object'
                    ? [nav]
                    : [{ navigationKey: nav }])
                )
              )
            )
          } else {
            const navigationData = await app.nav.get()
            navs = Object.values(navigationData)
          }

          await Promise.all(
            navs.map(async nav => {
              const data = await normalize.processNavigation({ locale, nav, gatsbyHelpers })
              return createNode(data)
            })
          )
          logInfo('Navigation finished')
        }

        logInfo(`Finished processing locale: ${locale}`)
      })
    )

    const endTime = present()
    logInfo(`Successfully ended in ${endTime - startTime} milliseconds`)
  } catch (error) {
    logError(error)
    throw error
  }
}
