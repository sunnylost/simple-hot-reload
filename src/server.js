const path = require('path')
const http = require('http')
const fs = require('fs')
const open = require('open')
const WebSocket = require('ws')
const chokidar = require('chokidar')

let wss
let sender
let port = 8080
let failedTimes = 10
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

module.exports = function init(filePath) {
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
        wss = new WebSocket.Server({
            port: port + 1
        })

        wss.on('connection', ws => {
            sender = ws
            /*ws.on('message', message => {
                console.log('received: %s', message)
            })*/
        })
        // open(`http://localhost:${port}/${filename}`)
    })

    server.on('error', err => {
        if (err && err.code === 'EADDRINUSE') {
            port++
            failedTimes--

            if (failedTimes) {
                process.nextTick(() => {
                    server = null
                    init(filePath)
                })
            }
        }
    })

    server.on('close', () => {
        wss && wss.close()
    })

    server.listen(port)
}
