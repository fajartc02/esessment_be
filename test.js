const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const moment = require('moment')
const { shiftByGroupId, genMonthlySubScheduleSchema } = require("./services/4s.services")

const currentDate = moment()
const currentMonth = currentDate.month() + 1 // need +1 to determine current month
const currentYear = currentDate.year()

shiftByGroupId(currentYear, currentMonth, 2, 2)
    .then((result) => {
        console.log(result)
        process.exit()
    })
    .catch((error) => {
        console.log(error)
        process.exit()
    })