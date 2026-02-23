import env from './env.js'

const isProduction = env.nodeEnv === 'production'

function formatLog(level, ...args) {
  const timestamp = new Date().toISOString()
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')
  return JSON.stringify({ timestamp, level, message })
}

const logger = {
  info(...args) {
    if (isProduction) {
      process.stdout.write(formatLog('info', ...args) + '\n')
    } else {
      console.log(...args)
    }
  },
  warn(...args) {
    if (isProduction) {
      process.stdout.write(formatLog('warn', ...args) + '\n')
    } else {
      console.warn(...args)
    }
  },
  error(...args) {
    if (isProduction) {
      process.stderr.write(formatLog('error', ...args) + '\n')
    } else {
      console.error(...args)
    }
  },
}

export default logger
