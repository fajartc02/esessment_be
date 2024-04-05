var winston = require('winston');
const env = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : 'dev';
const logDir = 'logs';
const fs = require('fs');

if (!fs.existsSync(logDir))
{
    fs.mkdirSync(logDir);
}

const now = new Date();
var logger = new (winston.Logger)({
    transports: [
        new winston.transports.File({
            name: 'error-file',
            filename: './logs/exceptions.log',
            level: 'error',
            json: false
        }),

        new (require('winston-daily-rotate-file'))({
            filename: `${logDir}/-apimodules.log`,
            timestamp: now,
            datePattern: 'dd-MM-yyyy',
            prepend: true,
            json: false,
            level: env === 'dev' ? 'verbose' : 'info'
        })
    ],
    exitOnError: false
});

module.exports = logger;
module.exports.stream = {
    write: function (message, encoding) {
        logger.info(message);
        console.log('message=', message);
    }
};