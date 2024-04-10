const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const table = require('../../config/table')
const { queryTransaction } = require('../../helpers/query')
const { bulkToSchema } = require('../../helpers/schema')

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
})

console.log(`Migration Running ...`)

const migrate = async () => {
    const clearRows = async (db) => {
        console.log('clearing start')
        await db.query(`SET session_replication_role = 'replica'`)

        const mstItemCheck = [
            'OEM_KANBAN', 'OEM_STANDARD', 'OEM_METHOD'
        ]

        const mstFinding = [
            'OEM_PRIORITY', 'OEM_TAG', 'OEM_PROGRESS', 'OEM_REQUEST'
        ]

        const whereIn = [
            ...mstItemCheck,
            ...mstFinding
        ]

        await db.query(`DELETE FROM ${table.tb_m_system} WHERE system_type in (${whereIn.join(', ')})`)

        await db.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    }

    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region oemMst insert tb_m_system
        const mstItemCheckSchema = [
            //#region oemMst OEM_KANBAN schema
            {
                uuid: uuid(),
                system_type: 'OEM_KANBAN',
                system_value: 'Putih',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_KANBAN',
                system_value: 'Pink',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_KANBAN',
                system_value: 'Biru',
                system_desc: null
            },
            //#endregion
            //#region oemMst OEM_STANDARD schema
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: '0.9 Mpa',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Bersih',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Normal',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: '1/2 Tangki +- 10 cm',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Tidak Terseumbat dan Berlubang',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Cairan Keiko Dalam Standard Konsentrat',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Jernih (Penuh)',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Bersih Dari Debu',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_STANDARD',
                system_value: 'Air Limbah Dalam Batas Level',
                system_desc: null
            },
            //#endregion
            //#region oemMst methods schema
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Visual',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Check Level',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Visual Water Cooling Dalam Tanki',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Level Pada Penampung',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Bersih',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Cleaning Berkala',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Pergantian Berkala',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Ganti Oli Baru',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Lap Majun dan Gardosol',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Lap Majun dan Kemoceng',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_METHOD',
                system_value: 'Buang Air Limbah Dari Dolly Ke TPA (Bila Lewat Batas Level)',
                system_desc: null
            },
            //#endregion
        ]

        const mstFindingSchema = [
            //#region OEM_PRIORITY
            {
                uuid: uuid(),
                system_type: 'OEM_PRIORITY',
                system_value: '1',
                system_desc: 'Safety'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PRIORITY',
                system_value: '2',
                system_desc: 'Quality'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PRIORITY',
                system_value: '3',
                system_desc: 'Productifity'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PRIORITY',
                system_value: '4',
                system_desc: 'Cost'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PRIORITY',
                system_value: '5',
                system_desc: 'Environtment'
            },
            //#endregion
            //#region OEM_TAG
            {
                uuid: uuid(),
                system_type: 'OEM_TAG',
                system_value: 'Tag Red',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OEM_TAG',
                system_value: 'Tag White',
                system_desc: null
            },
            //#endregion
            //#region OEM_PROGRESS
            {
                uuid: uuid(),
                system_type: 'OEM_PROGRESS',
                system_value: '1',
                system_desc: 'Progress 1'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PROGRESS',
                system_value: '2',
                system_desc: 'Progress 2'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PROGRESS',
                system_value: '3',
                system_desc: 'Progress 3'
            },
            {
                uuid: uuid(),
                system_type: 'OEM_PROGRESS',
                system_value: '4',
                system_desc: 'Progress 4'
            },
            //#endregion
            //#region OEM_REQUEST
            {
                uuid: uuid(),
                system_type: 'OEM_REQUEST',
                system_value: 'Production',
                system_desc: null
            },
            //#endregion 
        ]

        const systemSchema = await bulkToSchema([
            ...mstItemCheckSchema,
            ...mstFindingSchema
        ])
        await db.query(`insert into ${table.tb_m_system} (${systemSchema.columns}) VALUES ${systemSchema.values}`)
        console.log('tb_m_system OEM', 'inserted')
        //#endregion

        console.log('Seeder Completed!!!')
    }).then((res) => {
        return 0
    }).catch((err) => {
        console.log('err', err)
        return 0
    })
}

migrate()