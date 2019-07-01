const path = require('path')
const http = require('http')
const fs = require('fs')
const open = require('open')
const WebSocket = require('ws')
const chokidar = require('chokidar')
const chalk = require('chalk')

let wss
let wssPort
let sender
let indexFilePath
let externalAssets = []
let curBaseDir
let clientName = `client.${+new Date()}.js`

function watchChange(isVerbose) {
    let watcher = chokidar.watch(curBaseDir)

    watcher.on('change', path => {
        if (isVerbose) {
            console.log(chalk.green(path), 'has changed.')
        }

        let flag = externalAssets.some(v => {
            if (v.endsWith(path)) {
                sender && sender.send('reload')
                return true
            }
        })

        if (!flag && indexFilePath.endsWith(path)) {
            sender && sender.send('reload')
        }
    })
}

function collectExternalAssets(data) {
    if (!data) {
        return
    }

    try {
        let assets = JSON.parse(data)
        externalAssets.length = 0

        Array.isArray(assets) &&
            assets.forEach(v => {
                let matches = v.match(/^http:\/\/[^:]+:\d+\/(.+)/)

                if (matches && matches.length > 1) {
                    externalAssets.push(path.resolve(curBaseDir, matches[1]))
                }
            })
    } catch (e) {
        //do nothing
    }
}

function getAvailablePort(callback, port = 8080, failedTimes = 10) {
    let tmpServer = new http.createServer()

    tmpServer.on('error', err => {
        if (err && err.code === 'EADDRINUSE') {
            if (failedTimes) {
                process.nextTick(() => {
                    tmpServer = null
                    getAvailablePort(callback, port + 1, failedTimes - 1)
                })
            }
        }
    })

    tmpServer.on('listening', () => {
        tmpServer.close()
    })

    tmpServer.on('close', () => {
        callback(port)
    })

    tmpServer.listen(port)
}

function createWebsocketServer(port) {
    getAvailablePort(port => {
        wssPort = port
        wss = new WebSocket.Server({
            port
        })

        wss.on('connection', ws => {
            sender = ws

            ws.on('message', data => {
                collectExternalAssets(data)
            })
        })
    }, port + 1)
}

class Server {
    constructor(opts) {
        this.opts = Object.assign(
            {
                isVerbose: false
            },
            opts
        )

        getAvailablePort(port => {
            this.create(port)
        })
    }

    create(port) {
        let { baseDir, indexHtmlPath, indexHtmlUrl, isVerbose } = this.opts

        curBaseDir = baseDir
        indexFilePath = indexHtmlPath

        let server = new http.createServer((req, res) => {
            let url = req.url

            if (url[0] === '/') {
                url = url.substring(1)
            }

            let requestFile

            if (url === clientName) {
                requestFile = path.resolve(__dirname, './client.js')
            } else {
                requestFile = path.resolve(baseDir, url)
            }

            try {
                let stream = fs.createReadStream(requestFile)
                stream.on('error', () => {
                    res.writeHead(404)
                    res.end()
                })
                stream.on('end', () => {
                    if (requestFile === indexHtmlPath) {
                        res.end(`<script src="/${clientName}" data-port="${wssPort}"></script>`)
                    }
                })
                stream.pipe(res)

                if (isVerbose) {
                    console.log('serve file ' + chalk.green(url))
                }
            } catch (e) {
                res.writeHead(404)
                res.end()
            }
        })

        server.on('listening', () => {
            watchChange(isVerbose)
            createWebsocketServer(port)
            // open(`http://localhost:${port}/${indexHtmlUrl}`)
        })

        server.on('error', err => {
            console.log(err)
        })

        server.on('close', () => {
            wss && wss.close()
        })

        server.listen(port)
    }
}

module.exports = Server
