module.exports = {
    padTwoDigits: (number) => {
        if (number)
        {
            return (parseInt(number) < 10) ? '0' + number.toString() : number.toString();
        }

        return null
    }
}