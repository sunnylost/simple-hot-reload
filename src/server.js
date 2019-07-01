const path = require('path')
const http = require('http')
const fs = require('fs')
const open = require('open')
const WebSocket = require('ws')
const chokidar = require('chokidar')
const chalk = require('chalk')

let wss
let sender
let indexFilePath
let clientName = `client.${+new Date()}.js`

function watchChange(dir, isVerbose) {
    let watcher = chokidar.watch(dir)

    watcher.on('change', path => {
        if (isVerbose) {
            console.log(chalk.green(path), 'has changed.')
        }

        if (indexFilePath.endsWith(path)) {
            sender && sender.send('reload')
        }
    })
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

module.exports = function(filePath) {
    getAvailablePort(port => {
        init(port, filePath)
    })
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
            this.init(port)
        })
    }

    init(port) {
        let { baseDir, indexHtmlPath, indexHtmlUrl, isVerbose } = this.opts

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
                        res.end(`<script src="/${clientName}"></script>`)
                    }
                })
                stream.pipe(res)

                if (isVerbose) {
                    console.log('serve file ' + chalk.green(url))
                }
            } catch (e) {
                res.writeHead(404).end()
            }
        })

        server.on('listening', () => {
            watchChange(baseDir, isVerbose)

            getAvailablePort(port => {
                wss = new WebSocket.Server({
                    port
                })

                wss.on('connection', ws => {
                    sender = ws
                })
            }, port + 1)

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
