const path = require('path')
const http = require('http')
const fs = require('fs')
const open = require('open')
const WebSocket = require('ws')
const chokidar = require('chokidar')

let wss
let sender
let indexFilePath
let clientName = `client.${+new Date()}.js`

function watchChange(dir) {
    let watcher = chokidar.watch(dir)

    watcher.on('change', path => {
        if (path === indexFilePath) {
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

function init(port, filePath) {
    indexFilePath = filePath

    let dir = path.dirname(filePath)
    let filename = path.basename(filePath)

    let server = new http.createServer((req, res) => {
        let url = req.url

        if (url[0] === '/') {
            url = url.substring(1)
        }

        let requestFile

        if (url === clientName) {
            requestFile = path.resolve(__dirname, './client.js')
        } else {
            requestFile = path.resolve(dir, url)
        }

        try {
            let stream = fs.createReadStream(requestFile)
            stream.on('error', () => {
                res.writeHead(404)
            })
            stream.on('end', () => {
                if (requestFile === filePath) {
                    res.end(`<script src="/${clientName}"></script>`)
                }
            })
            stream.pipe(res)
        } catch (e) {
            res.writeHead(404)
        }
    })

    server.on('listening', () => {
        watchChange(dir, filename)

        getAvailablePort(port => {
            wss = new WebSocket.Server({
                port
            })

            wss.on('connection', ws => {
                sender = ws
            })
        }, port + 1)

        open(`http://localhost:${port}/${filename}`)
    })

    server.on('error', err => {
        console.log(err)
    })

    server.on('close', () => {
        wss && wss.close()
    })

    server.listen(port)
}

module.exports = function(filePath) {
    getAvailablePort(port => {
        init(port, filePath)
    })
}
