# Telenova Utils

## About
This repo contains static information (logos, links, etc.) to support Telenova app.

### Chains
Contains JSON file with networks info.

### Icons
Contains the iconography for Telenova.

### How to add a new chain
1. Paste chain data (`genesisHash`, `name`, `assets`) **at the very end** of `allowedChains.json` according to the existing structure
2. Export [chain](https://www.figma.com/design/fZhnS1PeyxBPMflVugmXk6/Nova-Assets-%E2%80%94-Tokens.-Networks.-DApps?node-id=3075-6479&t=sKetu70kL3dErqf4-0) & [assets](https://www.figma.com/design/fZhnS1PeyxBPMflVugmXk6/Nova-Assets-%E2%80%94-Tokens.-Networks.-DApps?node-id=3072-3965&t=sKetu70kL3dErqf4-0) icons from Figma using a shortcut `cmd+shift+E` 
3. Paste icons in project directories for chains and assets respectively
4. Substitute `env` variables for `NOVA_CONFIG_VERSION` & `TELENOVA_CONFIG_VERSION` 
5. Run script `npm run build:chains`