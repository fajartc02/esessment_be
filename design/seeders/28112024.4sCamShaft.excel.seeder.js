const envFilePath = process.env.NODE_ENV.trim() == 'production'
    ? './.env'
    : (process.env.NODE_ENV.trim() == 'dev' ? './dev.env' : './local.env')
require('dotenv').config({path: envFilePath})


const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const table = require('../../config/table');

const {uuid} = require('uuidv4');
const {database} = require('../../config/database');
const {totalDaysOfYear} = require('../../helpers/date')
const {readFile} = require('fs/promises');
const {cleanString} = require('../../helpers/formatting')
const {createNewKanbanSingleLineSchedule, clearRowSeeder} = require("../../services/4s.services");
const {copyExcelImageToFile} = require("../../helpers/excecl.helper");

console.log('env', {
    env: process.env.NODE_ENV,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    ssl: false
});

console.log(`Migration Running ...`);

const flagCreatedBy = 'SEEDER CamShaft 28112024 01'

const main = async () => {
    const db = database;
    db.connect((e) => {

    })

    try {
        await clearRowSeeder(db, flagCreatedBy);

        const lineQuery = await db.query(`select * from tb_m_lines where line_nm in ('Cam Shaft') and deleted_dt is null limit 1`);
        if (lineQuery.rowCount === 0) {
            throw "line empty";
        }

        const lineRow = lineQuery.rows[0];

        const workbook = new ExcelJS.Workbook();
        const filePath = path.resolve(__dirname, '../excel/28112024-cam-shaft-kanban.xlsx');
        await workbook.xlsx.readFile(filePath);

        const imagesSheet = workbook.worksheets[1];
        const stdImages = imagesSheet.getImages();

        //region image proceed
        /*for (const image of stdImages) {
            const { range, imageId } = image;

            // Ambil lokasi header (baris di atas gambar)
            const headerRow = range.tl.row - 1; // Header berada satu baris di atas gambar
            const headerCol = range.tl.col;

            const coordinateRow = String.fromCharCode(65 + headerRow) + 1;
            const coordinateColumn = String.fromCharCode(65 + headerCol) + 1; // That's the problem


            const headerCell = imagesSheet.getCell(headerRow, headerCol);
            const headerText = headerCell.text || `Image_${imageId}`; // Jika header kosong, gunakan ID gambar

            // Ambil data gambar dari workbook
            const workbookImage = workbook.model.media.find((media) => media.index === imageId);
            if (workbookImage) {
                const buffer = workbookImage.buffer;

                // Simpan gambar dengan nama header
                const fileName = `${headerText.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
                console.log(fileName);
                /!*const filePath = path.join(outputDir, fileName);

                fs.writeFileSync(filePath, buffer);*!/
                console.log(`Gambar disimpan: ${filePath}`);
            }
        }*/
        //endregion

        const itemCheckSheet = workbook.worksheets[0];
        const rows = [];

        let lastKanbanNo = null;
        itemCheckSheet.eachRow((row, rowNumber) => {
            const rowData = {};

            row.findCell();

            // stored data start from B (col 2)
            row.eachCell((cell, colNumber) => {
                rowData[`col${colNumber}`] = {
                    address: cell.address,
                    value: cell.value,
                };
            });

            rows.push(rowData);
        });

        console.log('rows', rows[11]);

    } catch (e) {
        await clearRowSeeder(db, flagCreatedBy);
        console.error(e);
        console.info('Seeder ERROR!!!');
    } finally {
        db.end((e) => {
            if (e) {
                console.log('error end db', e);
            }
        })
    }
}

main()
    .then(() => process.exit())
    .catch((e) => {
        console.log('error', e);
        process.exit()
    });