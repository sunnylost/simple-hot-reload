const { resolve, relative } = require('path')
const fs = require('fs')
const chalk = require('chalk')
const argv = require('yargs').argv
const Server = require('./server')
const DEFAULT_NAME = 'index.html'

let isVerbose = !!argv.verbose
let htmlOrDir
let cwd = process.cwd()
let rawHtmlOrDir = argv._
let indexHtmlPath = ''
let baseDir = cwd
let notExistPath

if (!rawHtmlOrDir || !rawHtmlOrDir.length) {
    htmlOrDir = cwd
    indexHtmlPath = resolve(cwd, 'index.html')
} else {
    htmlOrDir = resolve(cwd, rawHtmlOrDir[0])
}

try {
    if (!indexHtmlPath) {
        if (htmlOrDir.endsWith('.html')) {
            indexHtmlPath = htmlOrDir
        } else {
            notExistPath = htmlOrDir
            let stats = fs.statSync(htmlOrDir)

            if (stats.isDirectory()) {
                indexHtmlPath = resolve(htmlOrDir, DEFAULT_NAME)
            } else {
                indexHtmlPath = htmlOrDir
            }
        }
    }

    notExistPath = indexHtmlPath
    fs.statSync(indexHtmlPath)

    let server = new Server({
        baseDir,
        indexHtmlPath,
        indexHtmlUrl: relative(cwd, indexHtmlPath),
        isVerbose
    })

    let cleanHandler = () => {
        server.clean()
    }

    process.on('beforeExit', cleanHandler)
    process.on('uncaughtException', cleanHandler)
} catch (e) {
    console.error(`path ${chalk.redBright(notExistPath)} does not exist.`)
}
