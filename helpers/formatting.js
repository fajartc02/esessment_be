module.exports = {
    padTwoDigits: (number) => {
        if (number)
        {
            return (parseInt(number) < 10) ? '0' + number.toString() : number.toString();
        }

        return null
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
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}