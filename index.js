/*
CORS Anywhere as a Cloudflare Worker!
rewrite original implementation of https://github.com/Zibri/cloudflare-cors-anywhere

https://github.com/hpb-htw/jpl-cors-proxy

This Cloudflare Worker script acts as a CORS proxy that allows
cross-origin resource sharing for specified origins and URLs.
It handles OPTIONS preflight requests and modifies response headers accordingly to enable CORS.
The script also includes functionality to parse custom headers and provide detailed information
about the CORS proxy service when accessed without specific parameters.
The script is configurable with whitelist and blacklist patterns, although the blacklist feature is currently unused.
The main goal is to facilitate cross-origin requests while enforcing specific security and rate-limiting policies.
*/

// Configuration: Whitelist and Blacklist (not used in this version)
// whitelist = [ "^http.?://www.zibri.org$", "zibri.org$", "test\\..*" ];  // regexp for whitelisted urls
const blacklistUrls = []; // regexp for blacklisted urls
const whitelistOrigins = [
    ".*"
]; // regexp for whitelisted origins

const GITHUB_REPO = "https://github.com/hpb-htw/jpl-cors-proxy";

// Event listener for incoming fetch requests
addEventListener("fetch", async event => {
    event.respondWith(
        (async function () {
            const originUrl = new URL(event.request.url);
            const customHeaders = makeCustomHeader(event);
            if(originUrl.search.startsWith('?')) {
                const targetUrl = decodeURIComponent(
                    decodeURIComponent(originUrl.search.slice(1))
                );
                const originHeader = event.request.headers.get("Origin");
                if ( originHeader &&
                    !isListedIn(targetUrl, blacklistUrls) &&
                    isListedIn(originHeader, whitelistOrigins)
                ){
                    return createProxyResponse(event, customHeaders, targetUrl);
                }else {
                    return createForbiddenResponse();
                }
            } else {
                return createEmptyUriResponse(event, customHeaders);
            }
        })()
    );
});

function makeCustomHeader(event) {
    try {
        const xCorsHeader = event.request.headers.get("x-cors-headers");
        return JSON.parse(xCorsHeader);
    }catch (e) {
        return null
    }
}

async function createProxyResponse(event, customHeaders, targetUrl) {
    const response = await fetchTargetUrl(targetUrl, customHeaders, event);

    const isPreflightRequest = event.request.method === "OPTIONS";
    const responseBody = isPreflightRequest
        ? null
        : await response.arrayBuffer();

    const status = isPreflightRequest ?
        ({status: 200,             statusText: "OK"}) :
        ({status: response.status, statusText: response.statusText});

    const responseInit = {
        headers: extractHeader(response, event),
        ...status
    };
    return new Response(responseBody, responseInit);
}

async function fetchTargetUrl(targetUrl, customHeaders, event) {
    const filteredHeaders = {};
    for (const [key, value] of event.request.headers.entries()) {
        if (
            key.match("^origin") === null &&
            key.match("eferer") === null &&
            key.match("^cf-") === null &&
            key.match("^x-forw") === null &&
            key.match("^x-cors-headers") === null
        ) {
            filteredHeaders[key] = value;
        }
    }
    if (customHeaders !== null) {
        Object.entries(customHeaders).forEach(
            entry => (filteredHeaders[entry[0]] = entry[1])
        );
    }
    const newRequest = new Request(event.request, {
        redirect: "follow",
        headers: filteredHeaders
    });
    return await fetch(targetUrl, newRequest);
}

function extractHeader(response, event) {
    const responseHeaders = new Headers(response.headers);
    const exposedHeaders = [];
    const allResponseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
        exposedHeaders.push(key);
        allResponseHeaders[key] = value;
    }
    exposedHeaders.push("cors-received-headers");
    setupCORSHeaders(responseHeaders, event);

    responseHeaders.set(
        "Access-Control-Expose-Headers",
        exposedHeaders.join(",")
    );
    responseHeaders.set(
        "cors-received-headers",
        JSON.stringify(allResponseHeaders)
    );
    return responseHeaders;
}

function createEmptyUriResponse(event, customHeaders) {
    const responseHeaders = new Headers();
    setupCORSHeaders(responseHeaders, event);

    return new Response(
        "CLOUDFLARE-CORS-ANYWHERE\n\n" +
        `Source:\n${GITHUB_REPO}\n\n` +
        (customHeaders !== null
            ? "\nx-cors-headers: " + JSON.stringify(customHeaders)
            : ""),
        {
            status: 200,
            headers: responseHeaders
        }
    );
}

function createForbiddenResponse() {
    return new Response(
        "Create your own CORS proxy</br>\n" +
        `<a href='${GITHUB_REPO}'>${GITHUB_REPO}</a></br>\n` ,
        {
            status: 403,
            statusText: "Forbidden",
            headers: {
                "Content-Type": "text/html"
            }
        }
    );
}

// Function to check if a given URI or origin is listed in the whitelist or blacklist
function isListedIn(uri, listing) {
    let isListed = false;
    if (typeof uri === "string") {
        for(const pattern of listing) {
            if (uri.match(pattern)) {
                return true;
            }
        }
    } else {
        // When URI is null (e.g., when Origin header is missing), decide based on the implementation
        isListed = true; // true accepts null origins, false would reject them
    }
    return isListed;
}

// Function to modify headers to enable CORS
function setupCORSHeaders(headers, event) {
    const isPreflightRequest = event.request.method === "OPTIONS";
    headers.set(
        "Access-Control-Allow-Origin",
        event.request.headers.get("Origin")
    );
    if (isPreflightRequest) {
        headers.set(
            "Access-Control-Allow-Methods",
            event.request.headers.get("access-control-request-method")
        );
        const requestedHeaders = event.request.headers.get(
            "access-control-request-headers"
        );

        if (requestedHeaders) {
            headers.set("Access-Control-Allow-Headers", requestedHeaders);
        }

        headers.delete("X-Content-Type-Options"); // Remove X-Content-Type-Options header
    }
    return headers;
}