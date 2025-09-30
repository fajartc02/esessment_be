const envFilePath = process.env.NODE_ENV?.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV?.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

var express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors')

//#region cron
const cron = require('node-cron');
const _4sSchedule = require('./schedulers/4s.scheduler')
const omSchedule = require('./schedulers/om.scheduler')
const yearlyDates = require('./schedulers/yearDates.scheduler');

global.appRoot = path.resolve(__dirname);

// monthly
cron.schedule('0 0 25 * *', async () => {
    _4sSchedule()
    omSchedule()
});


// yearly
cron.schedule('0 0 25 12 *', async () => {
    yearlyDates()
});
//#endregion


const routerV1 = require('./routes/v1');
const routerV2 = require('./routes/v2');

const { database } = require('./config/database')

database.connect()
console.log('DB Connecttion:');
console.log({
    env: process.env.NODE_ENV?.trim(),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
});
console.log(`SERVER PORT: ${process.env.PORT}`, 'SERVER HOST :', process.env.APP_HOST);

var app = express();
app.use(cors())

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));




// Swagger definition
const swaggerOptions = {
    definition: {
        openapi: '3.0.0', // OpenAPI version
        info: {
            title: 'My API',
            version: '1.0.0',
            description: 'Automatically generated Swagger docs',
        },
        servers: [
            {
                url: 'http://localhost:3200',
                description: 'Local server',
            },
            {
                url: 'https://mt-system.id/eobservation/be/api/v1',
                description: 'Prod server',
            },
        ],
    },
    // Path to the API docs (where you write JSDoc comments)
    apis: ['./routes/v1/*.js', './routes/v2/*.js', './routes/v1/auth/*.js', './routes/v1/operational/*.js', './routes/v1/master/*.js',
        './routes/v2/operational/*.js', './routes/v2/master/*.js',
    ], // or wherever your route files are
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1', routerV1);
app.use('/api/v2', routerV2);


module.exports = app;