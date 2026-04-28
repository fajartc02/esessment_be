const table = require("../../config/table")
const { queryPUT, queryGET, queryCustom, queryPOST } = require("../../helpers/query")

const response = require("../../helpers/response")
const attrsUserInsertData = require("../../helpers/addAttrsUserInsertData")
const attrsUserUpdateData = require("../../helpers/addAttrsUserUpdateData")
const multipleUUidToIds = require("../../helpers/multipleUuidToId")

const moment = require("moment")
const { uuid } = require("uuidv4")

module.exports = {
    getSystems: async (req, res) => {
        try {
            let systemType = req.params.system_type;

            if (!systemType) {
                systemType = req.query.system_type;
            }

            // =========================
            // ✅ NORMALISASI
            // =========================
            if (systemType === '4S_OPT_DEPT') {
                systemType = 'OPT_DEPT';
            }

            // =========================
            // ✅ VALIDASI KETAT (ANTI INJECTION)
            // =========================

            if (systemType) {
                systemType = systemType.trim();

                // ❌ blok karakter berbahaya
                const forbiddenPattern = /('|--|;|\|\||\bOR\b|\bAND\b|\*|=)/i;

                if (forbiddenPattern.test(systemType)) {
                    return response.failed(res, "Invalid system_type (dangerous pattern)");
                }

                // ✅ hanya huruf, angka, underscore
                const safePattern = /^[A-Za-z0-9_]+$/;

                if (!safePattern.test(systemType)) {
                    return response.failed(res, "Invalid system_type format");
                }

                // optional: limit panjang (biar makin aman)
                if (systemType.length > 30) {
                    return response.failed(res, "system_type too long");
                }
            }

            // =========================
            // ✅ BUILD QUERY AMAN
            // =========================

            let whereType = '';

            if (systemType) {
                whereType = `AND system_type = '${systemType}'`;
            }

            const freqs = await queryGET(
                table.tb_m_system,
                `WHERE deleted_dt IS NULL ${whereType} ORDER BY system_desc`,
                [
                    `row_number () over (order by created_dt)::integer as no`,
                    'uuid as id',
                    'system_type',
                    'system_value',
                    'system_desc',
                    'created_by',
                    'created_dt',
                    'abnormality_id'
                ]
            );

            response.success(res, 'Success to get system', freqs);

        } catch (error) {
            console.log(error);
            response.failed(res, 'Error to get system');
        }
    },
    postSystem: async (req, res) => {
        try {
            const insertBody = {
                ...req.body,
                uuid: uuid(),
            }

            const attrsInsert = await attrsUserInsertData(req, insertBody)
            const result = await queryPOST(table.tb_m_system, attrsInsert)
            response.success(res, "Success to add system", result.rows)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    editSystem: async (req, res) => {
        try {
            const updateBody = {
                ...req.body,
            }

            const attrsUserUpdate = await attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(
                table.tb_m_system,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )

            response.success(res, "Success to edit system", result.rows)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
    deleteSystem: async (req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split("+")[0].split("T").join(" "),
                deleted_by: req.user.fullname,
            }

            let attrsUserUpdate = await attrsUserUpdateData(req, obj)
            const result = await queryPUT(
                table.tb_m_system,
                attrsUserUpdate,
                `WHERE uuid = '${req.params.id}'`
            )
            response.success(res, "Success to soft delete system", result.rows)
        } catch (error) {
            console.log(error)
            response.failed(res, error)
        }
    },
}