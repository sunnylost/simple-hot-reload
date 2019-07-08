;(function() {
    let thisScript = document.currentScript
    let dummyLink = document.createElement('a')
    let ws = new WebSocket(`ws://localhost:${thisScript.dataset.port}`)

    ws.onmessage = ({ data }) => {
        if (data === 'reload') {
            location.reload()
        } else {
            reloadCSS(data)
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

    function reloadCSS(linkPath) {
        let links = document.querySelectorAll('link')

        for (let i = 0; i < links.length; i++) {
            let link = links[i]
            dummyLink.href = link.href

            if (dummyLink.pathname === linkPath) {
                dummyLink.search = '_=' + +new Date()
                link.href = dummyLink.href
                return
            }
        }
    }
})()
