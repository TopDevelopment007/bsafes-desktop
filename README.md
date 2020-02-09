# Welcome to BSafes
Hi, **BSafes** is Encrypted Note Taking and Office Filing Solution for You and Your Teams.
## Features
 - Privacy by design.
 - Team collaboration.
 - End-to-End Encryption.
 - Opening multiple notes at the same time.
 - Web app, no software installation.
 - Open source encryption reviewed by security experts.
 - Support attachments of all media files, up to 500MB per file. No limit on number of attachments.
 
Though there are a lot of note taking apps already, we found only few apps are designed for privacy with **End-to-End Encryption**, and even fewer for **teams**.

Further more, few apps allow you to open multiple notes at the same time, this really kills productivity. Imagine you want to reference different notes for a project, and you have to repeatedly close a note and open another note. **BSafes** takes advantages of **tabs** of modern browser, you could open as many notes as you want on all devices. 
## Privacy & Security
Most cloud services such as Evernote, Google, Dropbox, features **encryption-in-transit** and **encryption-at-rest**, but without **End-to-End Encryption**, they could still see your data. And with modern **A.I.**, you don't really know how they use your data.

Also, only End-to-End encryption allows you and security experts to openly review the **client side encryption** code, to make sure your data is encrypted before being sent to servers.

## bsafes-desktop
bsafes-desktop is the desktop application for bsafes-web. Built with [Electron](https://github.com/atom/electron).*

This repository gives you all the javascript and stylsheet files used in BSafes and developed by BSafes. Since the rich text editor, Froala editor, requires commercial license, we only publish patch files here. 

For developers and security experts, you could also contribute to this project. You are welcome to create a fork of this project, test your code with **BSafes test server**, and create a pull request. 
## How To Use

To clone and run this repository you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](https://www.npmjs.com/)) installed on your computer. From your command line:

``` bash
# Clone this repository
git clone https://github.com/<Your github account>/bsafes-desktop.git
# Go into the repository
cd bsafes-desktop
# Install dependencies and run the app
npm install && npm start
```

To pack into an app, simply type one of these:

``` shell
npm run build:osx
npm run build:linux
npm run build:win32
npm run build:win64
```


```bash
brew cask install bsafes-desktop
```


## Packaging Electron App for Windows / MAC / Linux:

Numerous target formats:
This works for all platforms. Just run in windows / mac / linux to generate the respective platform.
The details can be verified in below link

Steps:

1.	Download and install “yarn”. It is recommended to use yarn instead of npm for the packaging.
2.	Install electron-builder package by running below script
yarn add electron-builder --dev

3.	Configure package.json file and include “dist” as below
"scripts": {
    ...
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build":{
    "appId": "com.your.app ",
    "productName": "Your Product",
    "asar": "false"
  },

4.	Run the below command
yarn dist

5.	It will generate artifact in the “dist” folder of project directory



https://github.com/electron-userland/electron-builder
