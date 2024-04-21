const { padTwoDigits } = require('./formatting')

function daysInYear(year) {
    return (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 1000 / 60 / 60 / 24
}

module.exports = {
    generateMonthlyDates: (year, month) => {
        var monthIndex = month - 1; // date index start with 0
        var names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        var date = new Date(year, monthIndex, 1);
        var result = [];
        while (date.getMonth() == monthIndex)
        {
            result.push({
                date: `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`,
                is_holiday: names[date.getDay()] == 'sat' || names[date.getDay()] == 'sun',
            });

            date.setDate(date.getDate() + 1);
        }
        return result;
    },
    totalDaysOfYear: (year = null) => {
        if (!year)
        {
            year = new Date().getFullYear();
        }

        return ((year % 4 === 0 && year % 100 > 0) || year % 400 == 0) ? 366 : 365;
    }
}