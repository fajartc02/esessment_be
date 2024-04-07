const fs = require('fs')
var winston = require('winston');
const env = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : 'dev';
const logDir = 'logs';


if (!fs.existsSync(logDir))
{
    fs.mkdirSync(logDir);
}

const now = new Date();
const logger = winston.createLogger({
    transports: [
        /* new winston.transports.File({
            filename: './logs/all.log',
        }), */
        new (require('winston-daily-rotate-file'))({
            filename: `${logDir}/log-%DATE%.log`,
            timestamp: now,
            datePattern: 'DD-MM-yyyy',
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