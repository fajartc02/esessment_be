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
const moment = require('moment');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

//#region cron
const cron = require('node-cron');
const _4sSchedule = require('./schedulers/4s.scheduler');
const omSchedule = require('./schedulers/om.scheduler');
const yearlyDates = require('./schedulers/yearDates.scheduler');
const { getLastWeekendOfMonth } = require('./helpers/date');

global.appRoot = path.resolve(__dirname);

// monthly
cron.schedule('0 20 * * 6', async () => {
    const lastWeekend = getLastWeekendOfMonth();
    const currentDate = moment().format('YYYY-MM-DD');
    
    if (lastWeekend === currentDate)
    {
        _4sSchedule();
        omSchedule();
    }
});


// yearly
cron.schedule('0 0 25 12 *', async () => {
    //yearlyDates()
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

//#region Security Middleware

// 1. Helmet - Security Headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, etc.)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Remove X-Powered-By header
app.disable('x-powered-by');

// 2. CORS - Restrictive policy (hanya domain yang diizinkan)
const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:3200',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:3000',
    'https://mt-system.id',
    process.env.APP_HOST
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400
}));

// 3. Rate Limiting - max 10000 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Too many requests, please try again later.'
    }
});
app.use('/api/', apiLimiter);

// 4. Global SQL Injection Sanitizer Middleware
const SQL_INJECTION_PATTERNS = [
    /('\s*(OR|AND)\s+'\d+'\s*=\s*'\d+')/i,
    /(;\s*(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|CREATE|EXEC)\s)/i,
    /(UNION\s+(ALL\s+)?SELECT)/i,
    /(pg_sleep|waitfor\s+delay|benchmark\s*\()/i,
    /(--\s|#|\*\/|\*!)/,
    /(xp_cmdshell|xp_regread)/i,
    /(LOAD_FILE|INTO\s+(OUT|DUMP)FILE)/i,
    /(information_schema|pg_catalog|pg_tables)/i,
    /(CHAR\s*\(|CHR\s*\(|CONCAT\s*\(.*SELECT)/i,
];

function containsSqlInjection(value) {
    if (typeof value !== 'string') return false;
    return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
}

function scanObject(obj) {
    if (!obj || typeof obj !== 'object') return false;
    for (const key in obj) {
        const val = obj[key];
        if (typeof val === 'string' && containsSqlInjection(val)) {
            return true;
        }
        if (typeof val === 'object' && val !== null && scanObject(val)) {
            return true;
        }
    }
    return false;
}

app.use('/api/', (req, res, next) => {
    if (scanObject(req.body) || scanObject(req.query) || scanObject(req.params)) {
        console.warn(`[SQL-INJECTION-BLOCKED] ${req.method} ${req.originalUrl} from ${req.ip}`);
        return res.status(400).json({
            status: 400,
            message: 'Request blocked: potentially dangerous input detected.'
        });
    }
    next();
});

// 5. Cache-Control for API responses (prevent Cacheable SSL Page)
app.use('/api/', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

//#endregion Security Middleware

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, 'uploads')));




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

//#region Global Error Handler
// Catches all unhandled errors and prevents stack trace / path disclosure
app.use((err, req, res, next) => {
    // Log full error for debugging (server-side only)
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);

    // CORS error
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            status: 403,
            message: 'Origin not allowed'
        });
    }

    // Generic safe response — no stack trace, no path disclosure
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        status: statusCode,
        message: process.env.NODE_ENV?.trim() === 'production'
            ? 'Internal Server Error'
            : (err.message || 'Internal Server Error')
    });
});
//#endregion

module.exports = app;