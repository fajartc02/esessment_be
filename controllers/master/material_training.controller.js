const moment = require('moment')
const table = require('../../config/table')
const { queryPOST, queryCustom, queryGET, queryPUT } = require('../../helpers/query')

const response = require('../../helpers/response')
const getLastIdData = require('../../helpers/getLastIdData')
const attrsUserInsertData = require('../../helpers/addAttrsUserInsertData')
const attrsUserUpdateData = require('../../helpers/addAttrsUserUpdateData')

const fs = require('fs')
const path = require('path')

const condDataNotDeleted = `WHERE deleted_dt IS NULL`

const ALLOWED_CATEGORIES = ['Safety', 'Quality', 'Productivity', 'Cost', 'HR']

module.exports = {
    getMaterialTrainings: async (req, res) => {
        try {
            let { category } = req.query
            let containerQuery = ''
            if (category && category !== 'All') {
                containerQuery += ` AND category = '${category}'`
            }

            let q = `
                SELECT *
                FROM ${table.tb_m_material_trainings}
                ${condDataNotDeleted}
                ${containerQuery}
                ORDER BY created_dt DESC
            `
            const result = await queryCustom(q)

            response.success(res, 'Success to get material trainings', result.rows)
        } catch (error) {
            console.error('[getMaterialTrainings] ERROR:', error)
            response.failed(res, error.message || error)
        }
    },

    postMaterialTraining: async (req, res) => {
        try {
            const { material_name, material_desc, category } = req.body

            if (!material_name) {
                return response.failed(res, 'material_name wajib diisi')
            }
            if (!category || !ALLOWED_CATEGORIES.includes(category)) {
                return response.failed(res, `category wajib diisi dan harus salah satu dari: ${ALLOWED_CATEGORIES.join(', ')}`)
            }
            if (!req.file) {
                return response.failed(res, 'File PDF wajib diunggah')
            }

            // Validate file is PDF
            const ext = path.extname(req.file.originalname).toLowerCase()
            if (ext !== '.pdf') {
                // Remove the uploaded file
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Failed to delete non-PDF file:', err)
                })
                return response.failed(res, 'Hanya file PDF yang diperbolehkan')
            }

            let idLast = await getLastIdData(table.tb_m_material_trainings, 'material_training_id') + 1

            let insertBody = {
                material_training_id: idLast,
                uuid: req.uuid(),
                material_name: material_name,
                material_desc: material_desc || null,
                category: category,
                file_path: `./${req.file.path}`,
            }

            let attrsUserInsert = attrsUserInsertData(req, insertBody)
            const result = await queryPOST(table.tb_m_material_trainings, attrsUserInsert)

            response.success(res, 'Success to add material training', result)
        } catch (error) {
            console.error('[postMaterialTraining] ERROR:', error)
            response.failed(res, error.message || error)
        }
    },

    putMaterialTraining: async (req, res) => {
        try {
            const { id } = req.params
            const { material_name, material_desc, category } = req.body

            if (!id) {
                return response.failed(res, 'Material Training id wajib ada')
            }
            if (category && !ALLOWED_CATEGORIES.includes(category)) {
                return response.failed(res, `category harus salah satu dari: ${ALLOWED_CATEGORIES.join(', ')}`)
            }

            let updateBody = {}
            if (material_name) updateBody.material_name = material_name
            if (material_desc !== undefined) updateBody.material_desc = material_desc
            if (category) updateBody.category = category

            // If a new file is uploaded, replace the old one
            if (req.file) {
                const ext = path.extname(req.file.originalname).toLowerCase()
                if (ext !== '.pdf') {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error('Failed to delete non-PDF file:', err)
                    })
                    return response.failed(res, 'Hanya file PDF yang diperbolehkan')
                }

                // Delete old file
                const existing = await queryGET(table.tb_m_material_trainings, `WHERE uuid = '${id}'`, ['file_path'])
                if (existing.length > 0 && existing[0].file_path) {
                    fs.unlink(existing[0].file_path, (err) => {
                        if (err) console.error('Failed to delete old file:', err)
                    })
                }
                updateBody.file_path = `./${req.file.path}`
            }

            let attrsUserUpdate = attrsUserUpdateData(req, updateBody)
            const result = await queryPUT(table.tb_m_material_trainings, attrsUserUpdate, `WHERE uuid = '${id}'`)

            response.success(res, 'Success to update material training', result)
        } catch (error) {
            console.error('[putMaterialTraining] ERROR:', error)
            response.failed(res, error.message || error)
        }
    },

    deleteMaterialTraining: async (req, res) => {
        try {
            let obj = {
                deleted_dt: moment().format().split('+')[0].split('T').join(' '),
                deleted_by: req.user.fullname
            }
            let attrsUserUpdate = attrsUserUpdateData(req, obj)
            const result = await queryPUT(table.tb_m_material_trainings, attrsUserUpdate, `WHERE uuid = '${req.params.id}'`)

            response.success(res, 'Success to delete material training', result)
        } catch (error) {
            console.error('[deleteMaterialTraining] ERROR:', error)
            response.failed(res, error.message || error)
        }
    }
}
