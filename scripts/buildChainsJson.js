const path = require('path');
const { writeFile } = require('fs/promises');
const { z } = require('zod');
const fs = require('fs');

const envSchema = z.object({
  NOVA_CONFIG_VERSION: z.string(),
  TELENOVA_CONFIG_VERSION: z.string(),
});
const env = envSchema.parse(process.env);

const ASSET_ICONS_DIR = `icons/v1/assets/color`
const NOVA_CONFIG_VERSION = env.NOVA_CONFIG_VERSION;
const TELENOVA_CONFIG_VERSION = env.TELENOVA_CONFIG_VERSION;
const CONFIG_PATH = `chains/${TELENOVA_CONFIG_VERSION}/`;
const TELENOVA_CONFIG_URL = `https://raw.githubusercontent.com/novasamatech/nova-utils/master/chains/${NOVA_CONFIG_VERSION}/`;

const CHAINS_ENV = ['chains_dev.json', 'chains.json'];
const ALLOWED_CHAINS = require('./data/allowedChains.json');

async function getDataViaHttp(url, filePath) {
  try {
    const response = await fetch(url + filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('🔴 Error in getDataViaHttp: ', error?.message || 'getDataViaHttp failed');
    process.exit(1);
  }
}

function fillAssetData(chain) {
  const assetsList = [];
  const allowedAssets = ALLOWED_CHAINS[chain.chainId]?.assets || [];
  const allowedAssetsMap = new Map(allowedAssets.map(asset => [asset.symbol, asset]));

  for (const asset of chain.assets) {
    const allowedAsset = allowedAssetsMap.get(asset.symbol);
    if (!allowedAsset) continue;

    assetsList.push({
      assetId: asset.assetId,
      symbol: asset.symbol,
      precision: asset.precision,
      type: asset.assetId === 0 ? 'native' : asset.type,
      priceId: asset.priceId,
      name: allowedAsset.name,
      icon: replaceUrl(asset.icon, 'asset', asset.symbol),
    });
  }
  return assetsList;
}

function getTransformedData(rawData) {
  const filteredData = rawData.filter(chain => chain.chainId in ALLOWED_CHAINS);

  return filteredData.map((chain, index) => {
    const assets = fillAssetData(chain);
    const nodes = chain.nodes
      .filter(node => !node.url.includes('{'))
      .map(node => ({ url: node.url, name: node.name }));

    return {
      name: chain.name,
      chainIndex: index,
      addressPrefix: chain.addressPrefix,
      chainId: `0x${chain.chainId}`,
      icon: replaceUrl(chain.icon, 'chain'),
      assets,
      nodes,
    };
  });
}

function replaceUrl(url, type, name = undefined) {
  const changedBaseUrl = url.replace("nova-utils/master", "telenova-utils/main");
  const lastPartOfUrl = url.split("/").pop()

  // handling for 'xc' prefixed token names
  const processedName = name ? name.replace(/^xc/, '') : name;

  switch (type) {
    case "chain":
      return changedBaseUrl.replace(
        /\/icons\/.*/,
        `/icons/${TELENOVA_CONFIG_VERSION}/chains/${lastPartOfUrl}`
      );
    case "asset":
      const tickerNames = [processedName, processedName.split("-")[0]];
      const relativePath = findFileByTicker(tickerNames, ASSET_ICONS_DIR);
      if (!relativePath) {
        console.error(`Can't find file for: ${processedName} in: ${ASSET_ICONS_DIR}`);
        return changedBaseUrl.replace(/\/icons\/.*/, `/${processedName}`);
      }

      return changedBaseUrl.replace(/\/icons\/.*/, `/${relativePath}`);
    default:
      throw new Error("Unknown type: " + type);
  }
}

function findFileByTicker(tickers, dirPath) {
  const [fullName, shortName, mappedName] = tickers;

  try {
    const files = fs.readdirSync(dirPath);
    // Loop through files to find match based on ticker pattern
    for (let i = 0; i < files.length; i++) {
      // Check if file satisfies ticker pattern
      const currentFile = files[i];

      const byFullName = new RegExp(`^${fullName}.svg\\b|\\(${fullName}\\)\\.svg`, "i");
      const byShortName = new RegExp(`^${shortName}.svg\\b|\\(${shortName}\\)\\.svg`, "i");
      const byMappedName = new RegExp(`^${mappedName}.svg\\b|\\(${mappedName}\\)\\.svg`, "i");

      if (
          currentFile.match(byFullName)
          || currentFile.match(byShortName)
          || currentFile.match(byMappedName)
      ) {
        return path.join(dirPath, currentFile);
      }
    }
  } catch (error) {
    throw new Error(error);
  }
}

async function saveNewFile(newJson, file_name) {
  try {
    const filePath = path.resolve(CONFIG_PATH, file_name);

    await writeFile(filePath, JSON.stringify(newJson, null, 2));
    console.log('Successfully saved file: ' + file_name);
  } catch (error) {
    console.log('Error: ', error?.message || '🛑 Something went wrong in writing file');
  }
}

async function buildFullChainsJSON() {
  const requests = CHAINS_ENV.map(async (chain) => {
    try {
      const novaChainsConfig = await getDataViaHttp(TELENOVA_CONFIG_URL, chain);
      const modifiedData = await getTransformedData(novaChainsConfig);
      const saveAs = chain === 'chains.json' ? 'chains_prod.json' : 'chains_dev.json';
      await saveNewFile(modifiedData, saveAs);
      console.log('❇️ Successfully generated for: ' + chain);
    } catch (e) {
      console.error('️🔴 Error for: ', chain, e);
      process.exit(1);
    }
  });

  await Promise.allSettled(requests);
}

buildFullChainsJSON()
  .then(() => console.log('🏁 buildFullChainsJSON finished'))
  .catch(e => {
    console.error('🔴 Error in buildFullChainsJSON: ', e);
    process.exit(1);
  });
