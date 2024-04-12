const fs = require('fs')
const winston = require('winston');
const moment = require('moment')
const { splat, combine, timestamp, printf } = winston.format;
const env = process.env.NODE_ENV?.trim() ? process.env.NODE_ENV?.trim() : 'dev';
const logDir = 'logs';


if (!fs.existsSync(logDir))
{
    fs.mkdirSync(logDir);
}

const rawFormat = printf(({ timestamp, level, message, meta, data }) => {
    let json = ''
    if (meta)
    {
        if (typeof meta === 'object')
        {
            if (meta.isJson)
            {
                json = JSON.stringify(meta.message)
            }
            else
            {
                json = meta.message
            }
        }
        else
        {
            json = JSON.stringify(meta)
        }
    }
    else if (data)
    {
        json = JSON.stringify(data)
    }

    return `${moment(timestamp).format('YYYY-MM-DD HH:mm:ss')}; level=${level}; message=${message}; ${json ? `${json}` : ``}`;
});

const now = new Date();
const logger = winston.createLogger({
    //format: winston.format.json(), // for json format
    format: combine(
        timestamp(),
        splat(),
        rawFormat
    ),
    transports: [
        new (require('winston-daily-rotate-file'))({
            filename: `${logDir}/log-%DATE%.log`,
            timestamp: now,
            datePattern: 'DD-MM-yyyy',
            prepend: true,
            json: false,
            level: env === 'dev' || env === 'local' ? 'verbose' : 'info'
        })
    ],
    exitOnError: false
});

const logRaw = (text, message = 'log', level = 'info', isJson = false) => {
    logger.log(
        level,
        message,
        {
            meta: {
                isJson: isJson,
                message: text
            }
        }
    )
}

module.exports = logRaw