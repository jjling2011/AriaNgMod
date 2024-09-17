# AriaNgMod
[![License](https://img.shields.io/github/license/jjling2011/AriaNgMod.svg?style=flat)](https://github.com/jjling2011/AriaNgMod/blob/master/LICENSE)

## Introduction
AriaNgMod是[AriaNg](https://github.com/mayswind/AriaNg) v1.3.8的修改版。增加了批量导入BT种子和按扩展名选择文件功能。

#### Online demo
Demo: [https://jjling2011.github.io/AriaNgMod/](https://jjling2011.github.io/AriaNgMod/)

#### Prebuilt release
Latest Release: [https://github.com/jjling2011/AriaNgMod/releases](https://github.com/jjling2011/AriaNgMod/releases)

#### Building from source
Make sure you have [Node.js](https://nodejs.org/), [NPM](https://www.npmjs.com/) and [Gulp](https://gulpjs.com/) installed. Then download the source code, and follow these steps.

##### Standard Version

    $ npm install
    $ gulp clean build

##### All-In-One Version

    $ npm install
    $ gulp clean build-bundle

The builds will be placed in the dist directory.

#### Usage Notes
Since AriaNg standard version loads language resources asynchronously, you may not open index.html directly on the local file system to run AriaNg. It is recommended that you can use the all-in-one version or deploy AriaNg in a web container or download [AriaNg Native](https://github.com/mayswind/AriaNg-Native) that does not require a browser to run.

## Translating

Everyone is welcome to contribute translations. All translations files are put in `/src/langs/`. You can just modify and commit a new pull request.

If you want to translate AriaNg to a new language, you can add language configuration to `/src/scripts/config/languages.js`, then copy `/i18n/en.sample.txt` to `/src/langs/` and rename it to the language code to be translated, then you can start the translation work.

## Documents
1. [English](http://ariang.mayswind.net)
2. [Simplified Chinese (简体中文)](http://ariang.mayswind.net/zh_Hans)

## License
[MIT](https://github.com/jjling2011/AriaNg/blob/master/LICENSE)
