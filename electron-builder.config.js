module.exports = {
  appId: 'com.contrary.whiteboard',
  productName: 'Contrary Whiteboard',
  directories: {
    output: 'release'
  },
  win: {
    target: ['nsis', 'portable'],
    icon: 'assets/icon.ico',
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    deleteAppDataOnUninstall: false
  },
  mac: {
    target: ['dmg'],
    icon: 'assets/icon.icns',
    artifactName: '${productName}-${version}.${ext}',
    category: 'public.app-category.education'
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ]
  },
  linux: {
    target: ['AppImage'],
    icon: 'assets/icon.png',
    artifactName: '${productName}-${version}.${ext}',
    category: 'Education'
  },
  files: [
    'main/**',
    'dist/**',
    'assets/**',
    'package.json'
  ],
  publish: {
    provider: 'github',
    owner: 'AroseEditor',
    repo: 'Contrary-Whiteboard'
  }
};
