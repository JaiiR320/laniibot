/**
 * Standardized logging utility for the project
 */
function formatMessage(module, message) {
  return `[${new Date().toISOString()}] [${module}] ${message}`;
}

const logger = {
  error: (module, message, error = null) => {
    const formattedMessage = formatMessage(module, message);
    if (error) {
      console.error(formattedMessage, error);
    } else {
      console.error(formattedMessage);
    }
  },

  warn: (module, message) => {
    console.warn(formatMessage(module, message));
  },

  info: (module, message) => {
    console.info(formatMessage(module, message));
  },

  debug: (module, message) => {
    console.debug(formatMessage(module, message));
  },
};

module.exports = logger;
