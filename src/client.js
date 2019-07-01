;(function() {
    let thisScript = document.currentScript
    let ws = new WebSocket(`ws://localhost:${thisScript.dataset.port}`)

    ws.onmessage = ({ data }) => {
        if (data === 'reload') {
            location.reload()
        }
    }

    ws.onopen = () => {
        collectExternalLinks()
    }

    function collectExternalLinks() {
        let assets = []
        let links = document.querySelectorAll('link')
        let scripts = document.scripts

        for (let i = 0; i < links.length; i++) {
            assets.push(links[i].href)
        }

        for (let i = 0; i < scripts.length; i++) {
            if (scripts[i] !== thisScript) {
                assets.push(scripts[i].src)
            }
        }

        ws.send(JSON.stringify(assets))
    }
})()
