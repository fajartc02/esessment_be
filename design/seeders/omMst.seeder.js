const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({ path: envFilePath })

const { uuid } = require('uuidv4');
const table = require('../../config/table')
const { queryTransaction } = require('../../helpers/query')
const { bulkToSchema } = require('../../helpers/schema');
const { databasePool } = require('../../config/database');

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

const methodArr = [
    "Check",
    "Ganti",
    "Cleaning",
    "Check Up",
    "Grease Up",
    "Check",
    "Oiling",
    "Ganti",
    "Check Kebocoran",
    "Check",
    "Grase",
    "Check Kebocoran",
    "Check Crek"
]

const standart = [
    "Tidak Aus",
    "No Abnormality",
    "Bersih",
    "No Abnormality",
    "Bersih",
    "Grease Ada",
    "Ada Grease",
    "Tidak Kendor",
    "No Abnormal",
    "Ada Grease",
    "Tidak Aus",
    "No Abnormal",
    "No Abnormal",
    "Tidak Bocor",
    "Tidak Retak",
    "Tidak Bocor",
    "Baru",
    "Tidak Ada Retak",
    "Berfungsi",
    "Putaran Smooth",
    "Tidak Putus",
    "Tidak Crack"
]

const machineArr = [
    "IMAM-0001",
    "IMAM-0002",
    "IMAM-0003",
    "IMAM-0015",
    "IMAM-0005",
    "IMAM-0016",
    "IMAM-0006",
    "IMAM-0009",
    "IMAM-0011",
    "IMAM-0014",
    "IMAM 0011A",
    "IMAM 0008A",
    "IMAT-0011",
    "IMCK-0005-1-1",
    "IMCK-0005-2-1",
    "IMCK-0005-3-1",
    "IMTS-0027",
    "IMTS-0031",
    "IMTS-0053",
    "IMTS-0028",
    "IMTS-0030",
    "IMTS-0037",
    "IMTS-0038",
    "IMTS-0039",
    "IMTS-0040",
    "IMTS-0041",
    "IMZY-0020",
    "IMZY-0021",
    "IMZY-0026",
    "IMZY-0027",
    "IMZY-0022",
    "HOIST C/S",
    "SST BOLT TQ C/S",
    "ID MATCHING",
    "IMPACK CONROD",
    "AGV",
    "OIL 50CC",
    "HOIST CYL.HEAD",
    "HOIST CAM HOUSING",
    "HOIST TURN E/G",
    "HOIST E/G FINISH",
    "BLOCK TRANSFER",
    "CHECK CRANK",
    "CHECK PISTON",
    "OILING BORE",
    "RAKU RAKU"
]

const clearRows = async () => {
    await queryTransaction(async (db) => {
        console.log('clearing start')
        await db.query(`SET session_replication_role = 'replica'`)

        const mstItemCheck = [
            "'OM_KANBAN'", "'OM_STANDARD'", "'OM_METHOD'",
        ]

        const mstFinding = [
            "'OM_PRIORITY'", "'OM_TAG'", "'OM_PROGRESS'", "'OM_REQUEST'"
        ]

        const mstAdditional = [
            "'OM_SET_WEEKENDS_THRESHOLD_DURATION'", "'OM_DAY_TOTAL_DURATION'", "'OM_WEEK_TOTAL_DURATION'"
        ]

        //weekends <8 hours duration
        //daily <1 hours duration

        const whereIn = [
            ...mstItemCheck,
            ...mstFinding,
            ...mstAdditional
        ]

        const mstSystemSql = `DELETE FROM ${table.tb_m_system} WHERE system_type in (${whereIn.join(', ')})`
        console.log('mstSystemSql', mstSystemSql);
        await db.query(mstSystemSql)

        await db.query(`DELETE FROM ${table.tb_m_om_item_check_kanbans} CASCADE`)
        await db.query(`ALTER TABLE ${table.tb_m_om_item_check_kanbans} ALTER COLUMN om_item_check_kanban_id RESTART WITH 1`)

        await db.query(`SET session_replication_role = 'origin'`)
        console.log('clearing succeed')
    })
}

const migrate = async () => {
    await queryTransaction(async (db) => {
        await clearRows(db)

        //#region oemMst insert tb_m_system
        const mstItemCheckSchema = [
            //#region oemMst OM_KANBAN schema
            {
                uuid: uuid(),
                system_type: 'OM_KANBAN',
                system_value: 'Putih',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_KANBAN',
                system_value: 'Pink',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_KANBAN',
                system_value: 'Biru',
                system_desc: null
            },
            //#endregion
            //#region oemMst OM_STANDARD schema
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: '0.9 Mpa',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Bersih',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Normal',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: '1/2 Tangki +- 10 cm',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Tidak Terseumbat dan Berlubang',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Cairan Keiko Dalam Standard Konsentrat',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Jernih (Penuh)',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Bersih Dari Debu',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_STANDARD',
                system_value: 'Air Limbah Dalam Batas Level',
                system_desc: null
            },
            //#endregion
            //#region oemMst methods schema
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Visual',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Check Level',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Visual Water Cooling Dalam Tanki',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Level Pada Penampung',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Bersih',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Cleaning Berkala',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Pergantian Berkala',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Ganti Oli Baru',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Lap Majun dan Gardosol',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Lap Majun dan Kemoceng',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_METHOD',
                system_value: 'Buang Air Limbah Dari Dolly Ke TPA (Bila Lewat Batas Level)',
                system_desc: null
            },
            //#endregion
        ]

        const mstFindingSchema = [
            //#region OM_PRIORITY
            {
                uuid: uuid(),
                system_type: 'OM_PRIORITY',
                system_value: '1',
                system_desc: 'Safety'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PRIORITY',
                system_value: '2',
                system_desc: 'Quality'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PRIORITY',
                system_value: '3',
                system_desc: 'Productifity'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PRIORITY',
                system_value: '4',
                system_desc: 'Cost'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PRIORITY',
                system_value: '5',
                system_desc: 'Environtment'
            },
            //#endregion
            //#region OM_TAG
            {
                uuid: uuid(),
                system_type: 'OM_TAG',
                system_value: 'Tag Red',
                system_desc: null
            },
            {
                uuid: uuid(),
                system_type: 'OM_TAG',
                system_value: 'Tag White',
                system_desc: null
            },
            //#endregion
            //#region OM_PROGRESS
            {
                uuid: uuid(),
                system_type: 'OM_PROGRESS',
                system_value: '1',
                system_desc: 'Progress 1'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PROGRESS',
                system_value: '2',
                system_desc: 'Progress 2'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PROGRESS',
                system_value: '3',
                system_desc: 'Progress 3'
            },
            {
                uuid: uuid(),
                system_type: 'OM_PROGRESS',
                system_value: '4',
                system_desc: 'Progress 4'
            },
            //#endregion
            //#region OM_REQUEST
            {
                uuid: uuid(),
                system_type: 'OM_REQUEST',
                system_value: 'Production',
                system_desc: null
            },
            //#endregion
            //#region addtional
            {
                uuid: uuid(),
                system_type: 'OM_SET_WEEKENDS_THRESHOLD_DURATION',
                system_value: 60,
                system_desc: 'Minutes'
            },
            {
                uuid: uuid(),
                system_type: 'OM_DAY_TOTAL_DURATION',
                system_value: 60,
                system_desc: 'Minutes'
            },
            {
                uuid: uuid(),
                system_type: 'OM_WEEK_TOTAL_DURATION',
                system_value: 60 * 8,
                system_desc: 'Minutes'
            },
            //#endregion
        ]

        const systemSchema = await bulkToSchema([
            ...mstItemCheckSchema,
            ...mstFindingSchema
        ])

        await db.query(`insert into ${table.tb_m_system} (${systemSchema.columns}) VALUES ${systemSchema.values}`)
        console.log('tb_m_system OM', 'inserted')
        //#endregion

        //#region iteem check
        const itemCheckSchema = await bulkToSchema([
            {
                uuid: uuid(),
                freq_id: 1,
                machine_id: 1,
                kanban_nm: 'Pink',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Lock Slide Tilt Table",
            },
            {
                uuid: uuid(),
                freq_id: 1,
                machine_id: 1,
                kanban_nm: 'Pink',
                location_nm: null,
                method_nm: 'Ganti',
                standart_nm: 'No Abnormal',
                standart_time: '5',
                item_check_nm: "Socket"
            },
            {
                uuid: uuid(),
                freq_id: 2,
                machine_id: 2,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Cleaning',
                standart_nm: 'Bersih',
                standart_time: '5',
                item_check_nm: "Ls Pneumatik"
            },
            {
                uuid: uuid(),
                freq_id: 2,
                machine_id: 2,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Cleaning',
                standart_nm: 'Bersih',
                standart_time: '5',
                item_check_nm: "Filter Air Regulator"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 3,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Cleaning',
                standart_nm: 'Bersih',
                standart_time: '5',
                item_check_nm: "Fan"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 3,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Grase',
                standart_nm: 'Ada Grease',
                standart_time: '5',
                item_check_nm: "Locating Pin"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 3,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Chain Balancer"
            },
            {
                uuid: uuid(),
                freq_id: 2,
                machine_id: 4,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Jig Steam"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 4,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Cam Follower"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 4,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Datum Seat"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 5,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Locating Pin"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 5,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Tidak Aus',
                standart_time: '5',
                item_check_nm: "Roller Stopper Completed"
            },
            {
                uuid: uuid(),
                freq_id: 3,
                machine_id: 6,
                kanban_nm: 'Putih',
                location_nm: null,
                method_nm: 'Check',
                standart_nm: 'Putaran Smooth',
                standart_time: '5',
                item_check_nm: "Lm Guide Z Axis"
            },
            /* { item_check_nm: "Lm Guide X Axis" },
            { item_check_nm: "Lm Guide Tilting" },
            { item_check_nm: "Ball Screw Z Axis" },
            { item_check_nm: "Ball Screw X Axis" },
            { item_check_nm: "Chain" },
            { item_check_nm: "Filter Chiller" },
            { item_check_nm: "All Pressure" },
            { item_check_nm: "Bolt Motor" },
            { item_check_nm: "Stoper Fuller" },
            { item_check_nm: "Grease Up Slide Unit" },
            { item_check_nm: "Rubber Cap Oil" },
            { item_check_nm: "Masking Rubber" },
            { item_check_nm: "Coupler" },
            { item_check_nm: "All Rubber" },
            { item_check_nm: "Master Chamber" },
            { item_check_nm: "All Pressure" },
            { item_check_nm: "Strainer" },
            { item_check_nm: "Air Filter Regulator" },
            { item_check_nm: "Cek Valve" },
            { item_check_nm: "Filter Vacum Throtle" },
            { item_check_nm: "Handle Cover Pullly" },
            { item_check_nm: "Sling Balancer" },
            { item_check_nm: "Filter Regulator" },
            { item_check_nm: "Grease Gear" },
            { item_check_nm: "Stand Units" },
            { item_check_nm: "Water Strainer" },
            { item_check_nm: "Mist Collector" },
            { item_check_nm: "All Pipa" },
            { item_check_nm: "O-Ring" },
            { item_check_nm: "Exhaust Fan" },
            { item_check_nm: "All Host" },
            { item_check_nm: "Hoist" },
            { item_check_nm: "Jig Urethan Vacum" },
            { item_check_nm: "Antiback" },
            { item_check_nm: "Rubber Oli" },
            { item_check_nm: "Clamp Urethane" },
            { item_check_nm: "Chain Rope" },
            { item_check_nm: "Unit Hook" },
            { item_check_nm: "Lock Hook" },
            { item_check_nm: "Engine Hanger" },
            { item_check_nm: "Roda" },
            { item_check_nm: "Seling Wire Rope" },
            { item_check_nm: "Uretan Hanger" },
            { item_check_nm: "Anti Back" },
            { item_check_nm: "Stopper" },
            { item_check_nm: "Stopper Set" },
            { item_check_nm: "Seling Stopper" },
            { item_check_nm: "Hanger" } */
        ])

        await db.query(`insert into ${table.tb_m_om_item_check_kanbans} (${itemCheckSchema.columns}) VALUES ${itemCheckSchema.values}`)
        console.log('tb_m_om_item_check_kanbans OM', 'inserted')
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

//clearRows()