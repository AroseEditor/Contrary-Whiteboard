module.exports = {
  appId: 'com.contrary.whiteboard',
  productName: 'Contrary Whiteboard',
  directories: {
    output: 'release'
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'assets/icon.ico',
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Contrary Whiteboard',
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    deleteAppDataOnUninstall: false,
    installerSidebar: null,
    license: null
  },
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'assets/icon.icns',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    category: 'public.app-category.education'
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ]
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      }
    ],
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
