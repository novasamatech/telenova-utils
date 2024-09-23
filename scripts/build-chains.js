const path = require('path');
const { writeFile } = require('fs/promises');
const { z } = require('zod');
const fs = require('fs');

const envSchema = z.object({
  NOVA_CONFIG_VERSION: z.string(),
  TELENOVA_CONFIG_VERSION: z.string(),
});
const ENV = envSchema.parse(process.env);

// Replacement values for asset.typeExtras.currencyIdType
const TYPE_EXTRAS_REPLACEMENTS = {
  'baf5aabe40646d11f0ee8abbdc64f4a4b7674925cba08e4a05ff9ebed6e2126b':   'AcalaPrimitivesCurrencyCurrencyId',
  'fc41b9bd8ef8fe53d58c7ea67c794c7ec9a73daf05e6d54b14ff6342c99ba64c':   'AcalaPrimitivesCurrencyCurrencyId',
  '262e1b2ad728475fd6fe88e62d34c200abe6fd693931ddad144059b1eb884e5b':   'BifrostPrimitivesCurrencyCurrencyId',
  '9f28c6a68e0fc9646eff64935684f6eeeece527e37bbe1f213d22caa1d9d6bed':   'BifrostPrimitivesCurrencyCurrencyId',
  'f22b7850cdd5a7657bbfd90ac86441275bbc57ace3d2698a740c7b0ec4de5ec3':   'BitCountryPrimitivesFungibleTokenId',
  'bf88efe70e9e0e916416e8bed61f2b45717f517d7f3523e33c7b001e5ffcbc72':   'InterbtcPrimitivesCurrencyId',
  '3a5a5cd27eb15fd26c37315a0f0b938733bb798c897428448efac5e6150cad06':   'InterbtcPrimitivesCurrencyId',
  '418ae94c9fce02b1ab3b5bc211cd2f2133426f2861d97482bbdfdac1bbb0fb92':   'InterbtcPrimitivesCurrencyId',
  '9af9a64e6e4da8e3073901c3ff0cc4c3aad9563786d89daf6ad820b6e14a0b8b':   'InterbtcPrimitivesCurrencyId',
  'cceae7f3b9947cdb67369c026ef78efa5f34a08fe5808d373c04421ecf4f1aaf':   'SpacewalkPrimitivesCurrencyId',
  '5d3c298622d5634ed019bf61ea4b71655030015bde9beb0d6a24743714462c86':   'SpacewalkPrimitivesCurrencyId'
}

const ASSET_ICONS_DIR = `icons/v1/assets/color`
const NOVA_CONFIG_VERSION = ENV.NOVA_CONFIG_VERSION;
const TELENOVA_CONFIG_VERSION = ENV.TELENOVA_CONFIG_VERSION;
const CONFIG_PATH = `chains/${TELENOVA_CONFIG_VERSION}/`;
const TELENOVA_CONFIG_URL = `https://raw.githubusercontent.com/novasamatech/nova-utils/master/chains/${NOVA_CONFIG_VERSION}/`;

const CHAINS_ENV = ['chains_dev.json', 'chains.json'];
const ALLOWED_CHAINS = require('./data/allowed-chains.json');

async function getDataViaHttp(url, filePath) {
  try {
    const response = await fetch(url + filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
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
      name: allowedAsset.name,
      assetId: asset.assetId,
      chainId: `0x${chain.chainId}`,
      symbol: asset.symbol,
      precision: asset.precision,
      type: asset.type || 'native',
      priceId: asset.priceId,
      icon: replaceUrl(asset.icon, 'asset', asset.symbol),
      typeExtras: replaceTypeExtras(asset.typeExtras, chain.chainId),
    });
  }

  return assetsList;
}

function replaceTypeExtras(typeExtras, chainId) {
  if (!typeExtras || !typeExtras.currencyIdType) return typeExtras;

  const replacement = TYPE_EXTRAS_REPLACEMENTS[chainId];

  return replacement ? { ...typeExtras, currencyIdType: replacement  } : typeExtras;
}

function getTransformedData(rawData) {
  const filteredData = rawData.filter(chain => chain.chainId in ALLOWED_CHAINS);

  return filteredData.map((chain) => {
    const assets = fillAssetData(chain);
    const nodes = chain.nodes
      .filter(node => !node.url.includes('{'))
      .map(node => ({ url: node.url, name: node.name }));

    return {
      name: chain.name,
      chainIndex: ALLOWED_CHAINS[chain.chainId].chainIndex,
      addressPrefix: chain.addressPrefix,
      chainId: `0x${chain.chainId}`,
      parentId: chain.parentId ? `0x${chain.parentId}` : undefined,
      icon: replaceUrl(chain.icon, 'chain'),
      options: chain.options?.includes("ethereumBased") ? ['evm'] : undefined,
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
    const jsonContent = JSON.stringify(newJson, null, 2);
    const contentWithNewline = jsonContent + '\n';
    await writeFile(filePath, contentWithNewline);
    console.log('🌟 Successfully saved file: ' + file_name);
  } catch (error) {
    console.log('Error: ', error?.message || '🛑 Something went wrong in writing file');
  }
}

async function buildChainsConfig() {
  const requests = CHAINS_ENV.map(async (chain) => {
    try {
      const novaChainsConfig = await getDataViaHttp(TELENOVA_CONFIG_URL, chain);
      const modifiedData = await getTransformedData(novaChainsConfig);
      const saveAs = chain === 'chains.json' ? 'chains_prod.json' : 'chains_dev.json';
      await saveNewFile(modifiedData, saveAs);
    } catch (e) {
      console.error('️🔴 Error for: ', chain, e);
      process.exit(1);
    }
  });

  await Promise.allSettled(requests);
}

buildChainsConfig()
  .then(() => console.log('🏁 Build chains configs finished'))
  .catch(e => {
    console.error('🔴 Error in buildChainsConfig: ', e);
    process.exit(1);
  });
