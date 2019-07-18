const packager = require('electron-packager');
const rebuild = require('electron-rebuild');

packager({
    dir: './',
    overwrite: true,
    asar: true,
    platform: 'win32',
    arch: 'ia32',
    prune: true,
    out: 'release-builds-folder',
    executableName: 'my-app',
    icon: 'icon/myicon.ico',

    afterCopy: [(buildPath, electronVersion, platform, arch, callback) => {

    rebuild.rebuild({ buildPath, electronVersion, arch })

      .then(() => callback())

      .catch((error) => callback(error));

  }],

})