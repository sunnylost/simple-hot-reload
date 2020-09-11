const path = require('path')
const http = require('http')
const fs = require('fs')
const url = require('url')
const WebSocket = require('ws')
const chokidar = require('chokidar')
const chalk = require('chalk')

const MIME_MAP = {
    js: 'text/javascript',
    html: 'text/html',
    css: 'text/css'
}

let serverPort
let wss
let wssPort
let sender
let indexFilePath
let externalAssets = []
let curBaseDir
let clientName = `client.${+new Date()}.js`

function link(text, url) {
    return `\u001B]8;;${url}\u0007${chalk.green(text)}\u001B]8;;\u0007`
}

function send(msg) {
    if (!sender) {
        return
    }

    sender.send(msg)
}

function watchChange(isVerbose) {
    let watcher = chokidar.watch(curBaseDir)

    watcher.on('change', (path) => {
        if (isVerbose) {
            console.log(chalk.green(path), 'has changed.')
        }

        let shouldReload = false

        let flag = externalAssets.some((v) => {
            if (path.endsWith(v)) {
                if (v.endsWith('.css')) {
                    send(v)
                } else {
                    shouldReload = true
                }
                return true
            }
        })

        // index html change
        if (!flag && indexFilePath.endsWith(path)) {
            shouldReload = true
        }

        if (shouldReload) {
            send('reload')
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
            assets.forEach((v) => {
                let _url = url.parse(v)

                if (_url.host !== `localhost:${serverPort}`) {
                    return
                }
                externalAssets.push(_url.pathname)
            })
    } catch (e) {
        //do nothing
    }
}

function getAvailablePort(callback, port = 8080, failedTimes = 10) {
    let tmpServer = new http.createServer()

    tmpServer.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            if (failedTimes) {
                process.nextTick(() => {
                    getAvailablePort(callback, port + 1, failedTimes - 1)
                })
            }
        }

        tmpServer = null
    })

    tmpServer.on('listening', () => {
        tmpServer.close()
    })

    tmpServer.on('close', () => {
        process.nextTick(() => {
            callback(port)
        })
    })

    tmpServer.listen(port)
}

function createWebsocketServer(port) {
    getAvailablePort((port) => {
        wssPort = port
        wss = new WebSocket.Server({
            port
        })

        wss.on('connection', (ws) => {
            sender = ws

            ws.on('message', (data) => {
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

        getAvailablePort((port) => {
            this.create(port)
        })
    }

    create(port) {
        serverPort = port
        let { baseDir, indexHtmlPath, indexHtmlUrl, isVerbose } = this.opts

        curBaseDir = baseDir
        indexFilePath = indexHtmlPath

        let server = new http.createServer((req, res) => {
            let _url = req.url

            if (_url[0] === '/') {
                _url = _url.substring(1)
            }

            _url = url.parse(_url)

            let requestFile
            let isClient = false

            if (_url.pathname === clientName) {
                isClient = true
                requestFile = path.resolve(__dirname, '../client/client.js')
            } else {
                requestFile = path.resolve(baseDir, _url.pathname)
            }

            let fileExt = requestFile.match(/\.[^.]+$/)

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

                if (fileExt) {
                    let mime = MIME_MAP[fileExt[0].substring(1)]
                    mime && res.setHeader('Content-Type', mime)
                }
                stream.pipe(res)

                if (isVerbose && !isClient) {
                    console.log('serve file ' + chalk.green(_url.href))
                }
            } catch (e) {
                res.writeHead(404)
                res.end()
            }
        })

        server.on('listening', () => {
            watchChange(isVerbose)
            createWebsocketServer(serverPort)
            let url = `http://localhost:${serverPort}/${indexHtmlUrl}`
            console.log(link(url, url))
        })

        server.on('error', (err) => {
            console.log(err)
        })

        server.on('close', () => {
            wss && wss.close()
        })

        server.listen(serverPort)

        this.server = server
    }

    clean() {
        wss && wss.close()
        this.server.close()
    }
}

module.exports = Server
