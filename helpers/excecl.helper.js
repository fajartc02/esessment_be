const copyExcelImageToFile = ({fs, workbook, outputDir}) => {
    if (!fs && !workbook && !outputDir) {
        return;
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
    }

    const media = workbook.media;
    media.forEach((item, index) => {
        if (item.type === 'image') {
            const outputPath = `${outputDir}/xlsx_image_${index + 1}.${item.extension}`;
            fs.writeFileSync(outputPath, item.buffer);
            console.log(`image saved at: ${outputPath}`);
        }
    });
};

module.exports = {
    copyExcelImageToFile
};