const logger = require('debug')('flamelink')

// Enable with DEBUG=flamelink:error node server.js
exports.logError = logger.extend('error')

// Enable with DEBUG=flamelink:warning node server.js
exports.logWarning = logger.extend('warning')

// Enable with DEBUG=flamelink:info node server.js
exports.logInfo = logger.extend('info')
