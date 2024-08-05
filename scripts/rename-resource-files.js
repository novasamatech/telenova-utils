const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, '../icons/');

function renameFiles(parentDir, callback) {
  fs.readdir(parentDir, function(err, files) {
    if (err) {
      console.error('Error while reading directory:', err);
      return;
    }

    files.forEach(function(file) {
      const oldPath = path.join(parentDir, file);

      fs.stat(oldPath, function(err, stats) {
        if (err) {
          console.error('Error while getting file stats:', err);
          return;
        }

        if (stats.isDirectory()) {
          renameFiles(oldPath, callback);  // Recursively rename files in subdirectory
        } else if (stats.isFile()) {
          const newFilename = file.replace(/\s+/g, '_');  // Replace spaces with underscores
          const newPath = path.join(parentDir, newFilename);

          fs.rename(oldPath, newPath, function(err) {
            if (err) {
              console.error(`Error while renaming file '${oldPath}':`, err);
            } else {
              console.log(`Renamed file '${oldPath}' to '${newPath}'`);
              callback();  // Call the callback function when file is successfully processed
            }
          });
        }
      });
    });
  });
}

renameFiles(dirPath, () => {
  console.log('Done renaming files.');
});
