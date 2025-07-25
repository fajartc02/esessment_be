const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const moment = require("moment")
const { uuid } = require("uuidv4")

const existsFreq = async (req) => {
    const exists = await queryGET(
        table.tb_m_freqs,
        `
                    where
                        freq_nm = '${req.body.freq_nm}'
                        or precition_val = '${req.body.precition_val}'
                `,
        [
            'freq_nm',
            'precition_val'
        ]
    )

    if (exists.length > 0) {
        throw `Freq Name ${req.body.freq_nm} or Precition Range ${req.body.precition_val} already exists, try different value`
    }

    return exists
}

module.exports = {
    getFreqs: async (req, res) => {
        try {
            const freqs = await queryGET(
                table.tb_m_freqs,
                `where deleted_dt is null order by no`,
                [
                    `row_number () over (
                            order by
                            freq_id
                        )::integer as no`,
                    'uuid as id',
                    'freq_nm',
                    'precition_val',
                    'created_by',
                    'created_dt'
                ]
            )

            response.success(res, 'Success to get freq', freqs)
        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get freq')
        }
    },
    postFreq: async (req, res) => {
        try {
            await existsFreq(req)

            const insertBody = {
                ...req.body,
                uuid: uuid(),
            }

            const attrsInsert = await attrsUserInsertData(req, insertBody)
            const result = await queryPOST(table.tb_m_freqs, attrsInsert)
            response.success(res, "Success to add freq", result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    editFreq: async (req, res) => {
        try {
            await existsFreq(req)

            const updateBody = {
                ...req.body,
            }

            const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(
                table.tb_m_freqs,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )

            response.success(res, "Success to edit freq", result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    deleteFreq: async (req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_m_freqs,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete freq", result)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
}
