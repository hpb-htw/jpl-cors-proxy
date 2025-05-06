/*
CORS Anywhere as a Cloudflare Worker!
rewrite original implementation of https://github.com/Zibri/cloudflare-cors-anywhere

https://github.com/hpb-htw/jpl-cors-proxy

*/

/**
 * Blacklist of target URLs which are blocked over this proxy
 * */
const blacklistUrls = []; // regexp for blacklisted urls

/**
 * Whitelist of origins, which are allowed to use this proxy
 * */
const whitelistOrigins = [
    ".*"
]; // regexp for whitelisted origins
// whitelist = [ "^http.?://www.zibri.org$", "zibri.org$", "test\\..*" ];  // regexp for whitelisted urls

const GITHUB_REPO = "https://github.com/hpb-htw/jpl-cors-proxy";

addEventListener("fetch", async event => {
    event.respondWith( handleRequest(event.request) );
});

async function handleRequest(request) {
    const originUrl = new URL(request.url);
    if(originUrl.search.startsWith('?')) {
        const targetUrl = decodeURIComponent(
            decodeURIComponent(originUrl.search.slice(1))
        );
        const originHeader = request.headers.get("Origin");
        if(originHeader) { // cross domain with origin header
            if (!isListedIn(targetUrl, blacklistUrls) &&
                isListedIn(originHeader, whitelistOrigins)
            ) {
                return createProxyResponse(request, targetUrl);
            } else {
                return createForbiddenResponse(`origin blocked ${originHeader}`);
            }
        } else { // mostly over browser
            return createForbiddenResponse(`Header 'Origin' is not set`);
        }
    } else {
        return createEmptyUriResponse(request);
    }
}



function makeXCorsHeader(request) {
    try {
        const xCorsHeader = request.headers.get("x-cors-headers");
        return JSON.parse(xCorsHeader);
    }catch (e) {
        return null
    }
}

async function createProxyResponse(request, targetUrl) {
    const targetResponse = await fetchTargetUrl(targetUrl, request);

    const isPreflightRequest = request.method === "OPTIONS";
    const responseBody = isPreflightRequest
        ? null
        : await targetResponse.arrayBuffer();

    const status = isPreflightRequest ?
        ({status: 200,             statusText: "OK"}) :
        ({status: targetResponse.status, statusText: targetResponse.statusText});

    const responseInit = {
        headers: makeProxyResponseHeader(request, targetResponse),
        ...status
    };
    return new Response(responseBody, responseInit);
}

async function fetchTargetUrl(targetUrl, request) {
    const filteredHeaders = {};
    for (const [key, value] of request.headers.entries()) {
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
    const customHeaders = makeXCorsHeader(request);
    if (customHeaders !== null) {
        Object.entries(customHeaders).forEach(
            entry => (filteredHeaders[entry[0]] = entry[1])
        );
    }
    const newRequest = new Request(request, {
        redirect: "follow",
        headers: filteredHeaders
    });
    return await fetch(targetUrl, newRequest);
}

function makeProxyResponseHeader(request, targetResponse) {
    const responseHeaders = new Headers(targetResponse.headers);
    const exposedHeaders = [];
    const allResponseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
        exposedHeaders.push(key);
        allResponseHeaders[key] = value;
    }
    exposedHeaders.push("cors-received-headers");
    setupCORSHeaders(responseHeaders, request);

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

function createEmptyUriResponse(request) {
    const responseHeaders = new Headers();
    setupCORSHeaders(responseHeaders, request);
    const customHeaders = makeXCorsHeader(request);
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

function createForbiddenResponse(msg) {
    const responseText = `${msg}\n
    Create your own CORS proxy by using
    ${GITHUB_REPO}\n`;
    return new Response(
        responseText,
        {
            status: 403,
            statusText: "Forbidden",
            headers: {
                "Content-Type": "text/plaintext"
            }
        }
    );
}

// Function to check if a given URI or origin is listed in a list
function isListedIn(uri, list) {
    let isListed = false;
    if (typeof uri === "string") {
        isListed = list.some( pattern => uri.match(pattern) );
    } else {
        // When URI is null (e.g., when Origin header is missing), decide based on the implementation
        isListed = true; // true accepts null origins, false would reject them
    }
    return isListed;
}

// Function to modify headers to enable CORS
function setupCORSHeaders(headers, request) {
    const isPreflightRequest = request.method === "OPTIONS";
    headers.set(
        "Access-Control-Allow-Origin",
        request.headers.get("Origin")
    );
    if (isPreflightRequest) {
        headers.set(
            "Access-Control-Allow-Methods",
            request.headers.get("access-control-request-method")
        );
        const requestedHeaders = request.headers.get(
            "access-control-request-headers"
        );

        if (requestedHeaders) {
            headers.set("Access-Control-Allow-Headers", requestedHeaders);
        }

        headers.delete("X-Content-Type-Options"); // Remove X-Content-Type-Options header
    }
    return headers;
}