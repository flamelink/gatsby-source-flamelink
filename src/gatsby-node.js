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
exports.sourceNodes = async ({ actions, createNodeId }, configOptions = {}) => {
  const { createNode } = actions
  const {
    content = true,
    navigation = true,
    globals = true,
    environment = 'production',
    populate = true,
    firebaseConfig
  } = configOptions

  try {
    logInfo('Starting with config:', JSON.stringify(configOptions))
    const startTime = present()

    // Initialize Flamelink app
    const app = api.initApp(firebaseConfig)
    await app.settings.setEnvironment(environment)

    if (globals) {
      logInfo('Globals started')
      const globalsData = await app.settings.getGlobals()
      createNode(normalize.processGlobals(globalsData, createNodeId))
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
                const contentType = content.find(
                  type => (Array.isArray(type) ? type[0] : type) === schema.id
                )

                if (!contentType) {
                  return
                }

                contentData = await app.content.get(
                  ...(Array.isArray(contentType) ? contentType : [contentType])
                )
              } else {
                contentData = await app.content.get(schema.id, { populate })
              }

              if (contentData) {
                const entries =
                  schema.type === 'single' ? [contentData] : Object.values(contentData)

                await Promise.all(
                  entries.map(async entry => {
                    const data = await normalize.processContentEntry(
                      schema.id,
                      locale,
                      entry,
                      createNodeId
                    )
                    return createNode(data)
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
              navigation.map(nav => app.nav.get(...(Array.isArray(nav) ? nav : [nav])))
            )
          } else {
            const navigationData = await app.nav.get()
            navs = Object.values(navigationData)
          }

          navs.forEach(nav => createNode(normalize.processNavigation(locale, nav, createNodeId)))
          logInfo('Content finished')
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
