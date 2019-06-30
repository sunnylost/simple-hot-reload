const { resolve } = require('path')
const fs = require('fs')
const argv = require('yargs').argv
const Server = require('./server')
const DEFAULT_NAME = 'index.html'

let cwd = process.cwd()
let htmlOrDir = argv._
let indexHtml = ''

if (!htmlOrDir || !htmlOrDir.length) {
    htmlOrDir = cwd
    indexHtml = resolve(cwd, 'index.html')
} else {
    htmlOrDir = resolve(cwd, htmlOrDir[0])
}

try {
    if (!indexHtml) {
        if (htmlOrDir.endsWith('.html')) {
            indexHtml = htmlOrDir
        } else {
            let stats = fs.statSync(htmlOrDir)

            if (stats.isDirectory()) {
                indexHtml = resolve(htmlOrDir, DEFAULT_NAME)
            } else {
                indexHtml = htmlOrDir
            }
        }
    }

    fs.statSync(indexHtml)
    Server(indexHtml)
} catch (e) {
    console.error(e)
}
