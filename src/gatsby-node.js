/**
 * # Flamelink source plugin for Gatsby
 *
 * DISCLAIMER: This plugin is heavily inspired by the awesome work done on the `gatsby-source-wordpress` plugin
 * (https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-source-wordpress) as well as others
 */
const api = require('./helpers/api')
const normalize = require('./helpers/normalize')

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
    verbose = false,
    firebaseConfig
  } = configOptions

  if (verbose) console.time(`Flamelink Source Plugin`)

  // Initialize Flamelink app
  const app = api.initApp(firebaseConfig)
  await app.settings.setEnvironment(environment)

  if (globals) {
    const globalsData = await app.settings.getGlobals()
    createNode(normalize.processGlobals(globalsData, createNodeId))
  }

  const availableLocales = await api.getLocales(configOptions)

  await Promise.all(
    availableLocales.map(async locale => {
      await api.setLocale(locale)

      if (content) {
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
              const entries = schema.type === 'single' ? [contentData] : Object.values(contentData)

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
      }

      if (navigation) {
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
      }
    })
  )

  if (verbose) {
    console.log('\n')
    console.timeEnd(`Flamelink Source Plugin`)
    console.log('\n')
  }
}
