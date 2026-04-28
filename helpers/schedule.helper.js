const moment = require('moment');
const {padTwoDigits} = require("./formatting");

const now = moment();
const currentDateIdx = parseInt(now.format('DD'));
const currentMonth = (new Date().getMonth() + 1);

const yearMonthMapper = (yearMonth) => {
    let month = parseInt(now.format("MM")) + 1,
        year = now.format("YYYY");

    const endDateIdx = parseInt(moment(`${year}-${month}`, 'YYYY-MM').endOf("month").format("DD"));

    if (typeof yearMonth === "string" && /[0-9]{4}-[0-9]{2}/g.test(yearMonth)) {
        const splitter = yearMonth.split("-");
        month = splitter[1];
        year = splitter[0];
    }

    return {
        month,
        year: parseInt(year),
        endDateIdx
    }
};

const generatePeriodicSchedule = (yearMonthStr, intervalDays, startDay = 1, {exceptionDateIdxs = []} = {}) => {
    const {year, month} = yearMonthMapper(yearMonthStr);
    const daysInMonth = new Date(year, month, 0).getDate();
    const schedule = [];

    while (startDay <= daysInMonth) {
        if (!(Array.isArray(exceptionDateIdxs) && exceptionDateIdxs.includes(startDay))) {
            schedule.push(`${year}-${padTwoDigits(month)}-${padTwoDigits(startDay)}`);
        }

        startDay += intervalDays;
    }

    return schedule;
}

module.exports = {
    generatePeriodicSchedule,
};