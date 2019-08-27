const { get } = require('lodash')
const admin = require('firebase-admin')
const flamelink = require('flamelink/app')
require('flamelink/content')
require('flamelink/storage')
require('flamelink/settings')
require('flamelink/users')
require('flamelink/navigation')
const { logWarning } = require('./logger')

let app = null
let allSchemas = null

const initApp = config => {
  const { firebaseConfig, environment, dbType } = config
  const {
    pathToServiceAccount,
    projectId,
    clientEmail,
    privateKey,
    databaseURL,
    storageBucket
  } = firebaseConfig

  if (!databaseURL || !storageBucket) {
    throw new Error(
      'Make sure you always specify the "databaseURL" and "storageBucket" Firebase config options in the plugin options'
    )
  }

  if (!pathToServiceAccount && !projectId && !clientEmail && !privateKey) {
    throw new Error(
      'If you do not specify the `pathToServiceAccount` in the Firebase config, you have to alternatively specify the `projectId`, `clientEmail` and `privateKey`.'
    )
  }

  const firebaseApp = pathToServiceAccount
    ? admin.initializeApp({
        // eslint-disable-next-line import/no-dynamic-require
        credential: admin.credential.cert(require(pathToServiceAccount)),
        databaseURL,
        storageBucket
      })
    : admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        databaseURL,
        storageBucket
      })

  // I do not necessarily love the `app` closure variable, but hey...
  app = flamelink({ firebaseApp, dbType, environment })

  return app
}

exports.initApp = initApp

const getSchemas = async () => {
  if (!app) {
    throw new Error('No existing Flamelink app instance. Make sure the app is initialized first.')
  }

  if (allSchemas) {
    return allSchemas
  }

  const schemasData = await app.schemas.get()

  if (!schemasData) {
    logWarning('[FLAMELINK]: It seems like you do not have any available schemas setup just yet.')
  }

  allSchemas = Object.keys(schemasData || {})
    .filter(schema => schemasData[schema].enabled)
    .map(schema => schemasData[schema])

  return allSchemas
}

exports.getSchemas = getSchemas

const setLocale = async locale => {
  if (!app) {
    throw new Error('No existing Flamelink app instance. Make sure the app is initialized first.')
  }

  return app.settings.setLocale(locale)
}

exports.setLocale = setLocale

const getLocales = async options => {
  if (!app) {
    throw new Error('No existing Flamelink app instance. Make sure the app is initialized first.')
  }

  if (Array.isArray(get(options, 'locales'))) {
    return options.locales
  }

  const locales = await app.settings.getAvailableLocales()
  return Array.isArray(locales) ? locales : Object.keys(locales)
}

exports.getLocales = getLocales
