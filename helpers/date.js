const moment = require('moment')

function daysInYear(year) {
    return (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 1000 / 60 / 60 / 24
}

function padTwoDigits(number) {
    if (number)
    {
        return (parseInt(number) < 10) ? '0' + parseInt(number).toString() : parseInt(number).toString();
    }

    return null
}

module.exports = {
    generateMonthlyDates: (year, month) => {
        var monthIndex = month - 1; // date index start with 0
        var names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        var date = new Date(year, monthIndex, 1);
        var result = [];
        while (date.getMonth() == monthIndex)
        {
            let a = padTwoDigits(date.getMonth() + 1);
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
    },
    addBusinessDaysToDate: (date, businessDays) => {
        // bit of type checking, and making sure not to mutate inputs :: 
        const momentDate = date instanceof moment ? date.clone() : moment(date);

        if (!Number.isSafeInteger(businessDays) || businessDays <= 0)
        {
            // handle these situations as appropriate for your program; here I'm just returning the moment instance :: 
            return momentDate;
        }
        else
        {
            // for each full set of five business days, we know we want to add 7 calendar days :: 
            const calendarDaysToAdd = Math.floor(businessDays / 5) * 7;
            momentDate.add(calendarDaysToAdd, "days");

            // ...and we calculate the additional business days that didn't fit neatly into groups of five :: 
            const remainingDays = businessDays % 5;

            // if the date is currently on a weekend, we need to adjust it back to the most recent Friday :: 
            const dayOfWeekNumber = momentDate.day();
            if (dayOfWeekNumber === 6)
            {
                // Saturday -- subtract one day :: 
                momentDate.subtract(1, "days");
            } else if (dayOfWeekNumber === 0)
            {
                // Sunday -- subtract two days :: 
                momentDate.subtract(2, "days");
            }

            // now we need to deal with any of the remaining days calculated above :: 
            if ((momentDate.day() + remainingDays) > 5)
            {
                // this means that adding the remaining days has caused us to hit another weekend; 
                // we must account for this by adding two extra calendar days :: 
                return momentDate.add(remainingDays + 2, "days");
            } else
            {
                // we can just add the remaining days :: 
                return momentDate.add(remainingDays, "days");
            }
        }
    },
    /**
     * default year: current year
     * default month: next 2 month
     * 
    **/
    getLastWeekendOfMonth: (year, month) => {
        // month is 0-indexed in moment (0 = January, 11 = December)
        if (!year)
        {
            year = new Date().getFullYear();
        }

        if (!month)
        {
            month = new Date().getMonth() + 2;
        }

        let lastDay = moment([year, month]).endOf('month');
        while (lastDay.day() !== 6)
        {
            lastDay = lastDay.subtract(1, 'day');
        }

        return lastDay.format('YYYY-MM-DD');
    }
}

