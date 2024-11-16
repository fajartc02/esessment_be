const {totalDaysOfYear} = require("./date");

module.exports = {
    padTwoDigits: (number) => {
        if (number) {
            return (parseInt(number) < 10) ? '0' + number.toString() : number.toString();
        }

        return null
    },
    orderAscString: (array, column, mode = 'ASC') => {
        array.sort((a, b) => (a[column] > b[column]) - (a[column] < b[column]))
        return array
    },
    arrayOrderBy: (arr, selector, desc = false) => {
        return [...arr].sort((a, b) => {
            a = selector(a);
            b = selector(b);

            if (a == b) return 0;
            return (desc ? a > b : a < b) ? -1 : 1;
        });
    },
    objToString: (obj, seperator = ';') => {
        return Object.keys(obj).map(key => obj[key]).join(seperator)
    },
    getRandomInt: (min, max) => {
        /*  min = Math.ceil(min);
         max = Math.floor(max);
         return Math.floor(Math.random() * (max - min + 1)) + min; */
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    cleanString: (value) => {
        if (value) {
            return value.replace(/ +/g, ' ').trim()
        }

        return null
    },
    freqMapper: (period) => {
        if (!period) {
            return null;
        }

        if (typeof period !== "string") {
            return null;
        }

        if (
            !period.toLowerCase().includes("day")
            && !period.toLowerCase().includes("daily")
            && !period.toLowerCase().includes("week")
            && !period.toLowerCase().includes("weekly")
            && !period.toLowerCase().includes("month")
            && !period.toLowerCase().includes("monthly")
            && !period.toLowerCase().includes("year")
            && !period.toLowerCase().includes("yearly")
        ) {
            return null;
        }

        if (period.toLowerCase() === "2d") {
            return {
                freqNm: '2 Day',
                precitionVal: 2,
            };
        }

        const splitPeriodic = period.split(' ')
        let freqNm = 'Day'
        let precitionVal = 1

        if (splitPeriodic.length >= 2) {
            switch (splitPeriodic[1].toLowerCase()) {
                case 'day':
                case 'daily':
                    precitionVal = 1 * splitPeriodic[0]
                    freqNm = `${splitPeriodic[0]} Day`
                    break;
                case 'week':
                case 'weekly':
                    precitionVal = 7 * splitPeriodic[0]
                    freqNm = `${splitPeriodic[0]} Week`
                    break;
                case 'month':
                case 'monthly':
                    precitionVal = 30 * splitPeriodic[0]
                    freqNm = `${splitPeriodic[0]} Month`
                    break;
                case 'year':
                case 'yearly':
                    precitionVal = totalDaysOfYear() * splitPeriodic[0]
                    freqNm = `${splitPeriodic[0]} Year`
                    break;
            }
        } else {
            freqNm = splitPeriodic[0].toLowerCase()
            switch (freqNm) {
                case 'day':
                case 'daily':
                    precitionVal = 1
                    freqNm = `1 Day`
                    break;
                case 'week':
                case 'weekly':
                    precitionVal = 7
                    freqNm = `1 Week`
                    break;
                case 'month':
                case 'monthly':
                    precitionVal = 30
                    freqNm = `1 Month`
                    break;
                case 'year':
                case 'yearly':
                    precitionVal = totalDaysOfYear()
                    freqNm = `1 Year`
                    break;
            }
        }

        return {
            freqNm: freqNm,
            precitionVal: precitionVal
        }
    },
    arrayObjectGroupBy: (arr, property) => {
        return arr.reduce(function (memo, x) {
            if (!memo[x[property]]) { memo[x[property]] = []; }
            memo[x[property]].push(x);
            return memo;
        }, {});
    }
}