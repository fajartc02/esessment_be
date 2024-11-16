const envFilePath = process.env.NODE_ENV?.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV?.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors')

//#region cron
const cron = require('node-cron');
cron.schedule('0 0 1 * *', async () => {
    const _4sSchedule = require('./schedulers/4s.scheduler')
    const omSchedule = require('./schedulers/om.scheduler')

    _4sSchedule()
    omSchedule()
});
//#endregion


var routerV1 = require('./routes/v1/index');

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

app.use('/api/v1', routerV1);


module.exports = app;