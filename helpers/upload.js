const multer = require("multer");

const path = require("path");

const checkFileType = function(file, cb) { //Allowed file extensions
    const fileTypes = /jpeg|jpg|png|gif|svg|pdf/;
    console.log(file);

    //check extension names

    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());


    const mimeType = fileTypes.test(file.mimetype);


    if (mimeType && extName) { return cb(null, true); } else {
        cb("Error: You can Only Upload Images!!");
    }
};

//Setting storage engine
const storageEngine = multer.diskStorage({  
    destination: function(req, file, cb) {
        console.log(file);
        cb(null, `./uploads/${req.body.dest}/`)
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}--${file.originalname}`);
    },
});

//initializing multer
const upload = multer({  
    storage: storageEngine,
    limits: { fileSize: 1000000 }, // 10 MB Max
    fileFilter: (req, file, cb) => {     checkFileType(file, cb);   },
});


module.exports = upload