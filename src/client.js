;(function() {
    let ws = new WebSocket('ws://localhost:8081')
    ws.onmessage = ({ data }) => {
        if (data === 'reload') {
            location.reload()
        }
    }
})()
