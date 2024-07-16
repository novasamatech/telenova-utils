const path = require('path');
const { writeFile } = require('fs/promises');
const { z } = require('zod');

const envSchema = z.object({
  NOVA_CONFIG_VERSION: z.string(),
  TELENOVA_CONFIG_VERSION: z.string(),
});
const env = envSchema.parse(process.env);

const NOVA_CONFIG_VERSION = env.NOVA_CONFIG_VERSION;
const TELENOVA_CONFIG_VERSION = env.TELENOVA_CONFIG_VERSION;
const CONFIG_PATH = `chains/${TELENOVA_CONFIG_VERSION}/`;
const TELENOVA_CONFIG_URL = `https://raw.githubusercontent.com/novasamatech/nova-utils/master/chains/${NOVA_CONFIG_VERSION}/`;

const CHAINS_ENV = ['chains_dev.json', 'chains_prod.json'];
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

  chain.assets.map(asset => {
    const allowedAsset = allowedAssets.find(a => a.symbol === asset.symbol);
    if (allowedAsset) {
      assetsList.push({
        assetId: asset.assetId,
        symbol: asset.symbol,
        precision: asset.precision,
        type: asset.type,
        priceId: asset.priceId,
        name: allowedAsset.name,
      });
    }
  });
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
      assets,
      nodes,
    };
  });
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
      await saveNewFile(modifiedData, chain);
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
