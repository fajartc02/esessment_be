const fs = require('fs')

fs.unlink('./amjaddihapus.txt', function(err) {
    if (err) {
        console.log(err);
    }
    console.log('BERHASIL DI HAPUS');
})