const jwt = require('jsonwebtoken');
const response = require('./response')
const { queryGET } = require('./query')
const { v4 } = require('uuid');

async function userCheck(noreg) {
    const table = 'tb_m_users'
    return await queryGET(table, `WHERE noreg = '${noreg}'`, ['noreg', 'fullname'])
        .then((result) => {
            return result[0]
        }).catch((err) => {
            console.log(err);
            return err
        });
}


module.exports = {
    generateToken: async(payload) => {
        var token = await jwt.sign(payload, process.env.SECRET_KEY);
        return token
    },
    verifyToken: async(req, res, next) => {
        try {
            let authorization = req.headers["authorization"];

            if (!authorization) {
                return response.notAllowed(res, 'No token provide')
            }
            let token = authorization.split(" ")[1];
            if (!token) response.notAllowed(res, 'No token provide');
            let userDataVerify = await jwt.verify(token, process.env.SECRET_KEY)
            let userData = await userCheck(userDataVerify.noreg)
            req.user = userData
            req.uuid = v4
            next()
        } catch (error) {
            response.notAllowed(res, 'Token Is Invalid');
        }

    },
    verifyTokenImage: async(req, res, next) => {
        try {
            console.log(req.query.token);
            let authorization = req.query.token;

            if (!authorization) {
                return response.notAllowed(res, 'No token provide')
            }
            let token = authorization
            if (!token) response.notAllowed(res, 'No token provide');
            let userDataVerify = await jwt.verify(token, process.env.SECRET_KEY)
            let userData = await userCheck(userDataVerify.noreg)
            req.user = userData
            return true
        } catch (error) {
            response.notAllowed(res, 'Token Is Invalid');
        }

    },
}