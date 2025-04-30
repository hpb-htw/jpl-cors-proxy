# jpl-cors-proxy

A fork of [Zibri/cloudflare-cors-anywhere](https://github.com/Zibri/cloudflare-cors-anywhere)

## Source:

[jpl-cors-proxy](https://github.com/hpb-htw/jpl-cors-proxy)

## Deployment

This project is written in [Cloudfalre Workers](https://workers.cloudflare.com/), and can be easily deployed with [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/).

```bash
wrangler deploy
```

## Usage Example

```javascript
const YOUR_CLOUDFLAIRE_PROXY_SERVER = "https://your-cloudflare.workers.dev";
const YOUR_TARGET = "https://what-every-api.org/?a=1&b=2";
const response = await fetch("${YOUR_CLOUDFLAIRE_PROXY_SERVER}?${YOUR_TARGET}", {
  mode: 'cors'
});
const body = await response.arrayBuffer();
```

Note:

All received headers are also returned in "cors-received-headers" header.

Note about the DEMO url:

Abuse (other than testing) of the demo will result in a ban.  
The demo accepts only fetch and XmlHttpRequest.

To create your own is very easy, you just need to set up a cloudflare account and upload the worker code.


