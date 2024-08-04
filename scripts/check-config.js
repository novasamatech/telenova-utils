const fs = require('fs');
const jp = require('jsonpath');
const path = require('path');

const BASE_ICON_PATH = "/telenova-utils/main/icons/"
const ASSET_ICON_PATH = "/assets/color/"

let hasError = false;
let allReferencedIcons = new Set();

function checkChainsFile(filePath) {
    let chainsFile = fs.readFileSync(filePath);
    let chainsJSON = JSON.parse(chainsFile);

    let allIcons = jp.query(chainsJSON, "$..icon");
    allIcons.forEach(icon => {
        allReferencedIcons.add(icon);
    });
    let relativeIcons = [];
    for (let i in allIcons) {
        relativeIcons.push('.' + allIcons[i].substring(allIcons[i].indexOf('/icons/')))
    }

    let badPath = new Set();
    for (i in relativeIcons) {
        let path = relativeIcons[i];
        try {
            fs.readFileSync(path);
        } catch (error) {
            badPath.add(path);
        }
    }
    if (badPath.size > 0) {
        console.error("No icons for chains or assets in " + filePath);
        console.log(badPath);
        hasError = true;
    } else {
        console.log("All icons found in " + filePath);
    }

    let assetIcons = jp.query(chainsJSON, "$..assets[*].icon");
    let badAssetIcon = new Set();
    for (let i in assetIcons) {
        if (assetIcons[i].indexOf(`${BASE_ICON_PATH}`) === -1) {
            badAssetIcon.add(assetIcons[i]);
        }
        if (assetIcons[i].indexOf(ASSET_ICON_PATH) === -1) {
            badAssetIcon.add(assetIcons[i]);
        }
    }
    if (badAssetIcon.size > 0) {
        console.error("Bad asset icons paths in " + filePath);
        console.log(badAssetIcon);
        hasError = true;
    } else {
        console.log("All asset icons path is correct in " + filePath);
    }

    let chainIcons = jp.query(chainsJSON, "$[*].icon");
    let badChainIcons = new Set();
    for (let i in chainIcons) {
        if (chainIcons[i].indexOf(`${BASE_ICON_PATH}`) === -1) {
            badChainIcons.add(chainIcons[i]);
        }
        if (chainIcons[i].indexOf(`/chains/`) === -1) {
            badChainIcons.add(chainIcons[i]);
        }
    }
    if (badChainIcons.size > 0) {
        console.error("Bad chain icons paths in " + filePath);
        console.log(badChainIcons);
        hasError = true;
    } else {
        console.log("All chain icons path is correct in " + filePath);
    }

    let chainTypes = jp.query(chainsJSON, "$..types");
    if (chainTypes.length > 0) {
        console.error("Chain types has to be removed from " + filePath);
        console.log(chainTypes);
        hasError = true;
    }
}

function traverseDir(dirPath, checkFunction, callback) {
    fs.readdir(dirPath, function (err, files) {
        if (err) {
            console.error('Error while reading directory:', err);
            return callback(err);
        }

        let pending = files.length;

        if (!pending) return callback(null);

        files.forEach(function (file) {
            const fullPath = path.join(dirPath, file);
            fs.stat(fullPath, function (err, stats) {
                if (err) {
                    console.error('Error while getting file stats:', err);
                    return callback(err);
                }

                if (stats.isDirectory()) {
                    // Recursive call in order to support nested directories
                    traverseDir(fullPath, checkFunction, function (err) {
                        if (!--pending) callback(err);
                    });
                } else if (path.extname(file) === '.json') {
                    checkFunction(fullPath);
                    if (!--pending) callback(null);
                } else {
                    if (!--pending) callback(null);
                }
            });
        });
    });
}

function deleteUnusedIcons() {
    const iconsDir = path.join(__dirname, '../icons/v1');
    
    function traverseIconsDir(dir) {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                traverseIconsDir(fullPath);
            } else if (path.extname(file) === '.svg') {
                const relativePath = fullPath.split('icons/v1')[1].replace(/\\/g, '/');
                const iconPath = `/telenova-utils/main/icons/v1${relativePath}`;
                
                if (!allReferencedIcons.has(iconPath)) {
                    console.log(`Deleting unused icon: ${fullPath}`);
                    fs.unlinkSync(fullPath);
                }
            }
        });
    }

    traverseIconsDir(iconsDir);
}

traverseDir(path.join(__dirname, '../chains/'), checkChainsFile, function (err) {
    if (err) {
        console.error('traverseDir failed - ', err);
        throw new Error('Error while traversing directory');
    }

    // All files and directories have been processed
    if (hasError) {
        throw new Error('Some chains file have problems with path, check the log');
    }

    console.log('All files processed successfully');

    // Delete unused icons
    deleteUnusedIcons();
});
