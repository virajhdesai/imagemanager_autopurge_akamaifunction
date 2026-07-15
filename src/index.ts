// Standard CSS Layout Parameters
const CSS_DATA = `
  body { font-family: system-ui, -apple-system, sans-serif; background: #f4f6f9; color: #2d3748; margin: 0; padding: 0; }
  header { background: linear-gradient(135deg, #0052cc, #002266); color: white; padding: 2rem; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  h1 { margin: 0; font-size: 2.2rem; }
  .nav-tabs { display: flex; justify-content: center; gap: 0.5rem; margin-top: 1rem; }
  .tab-btn { background: rgba(255,255,255,0.15); color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
  .tab-btn.active { background: white; color: #0052cc; }
  .container { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
  .card-panel, .video-showcase, .cart-panel, .chat-panel { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 1.5rem; }
  video { width: 100%; border-radius: 8px; background: #000; }
  .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
  .product-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; flex-direction: column; border: 1px solid #e2e8f0; }
  .product-card img { width: 100%; height: 160px; object-fit: cover; background: #edf2f7; display: block; border-bottom: 1px solid #e2e8f0; }
  .product-info { padding: 1rem; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; }
  .product-name { font-size: 1.2rem; font-weight: bold; margin: 0 0 0.5rem 0; }
  .product-price { font-size: 1.1rem; color: #0052cc; font-weight: bold; margin-bottom: 0.75rem; }
  .btn { background: #ff8c00; color: white; font-weight: bold; padding: 0.6rem 1rem; border: none; border-radius: 6px; cursor: pointer; text-align: center; width: 100%; }
  .chat-box { height: 100px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem; margin-bottom: 0.5rem; }
  .chat-input { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box; }
`;

// Product Definitions
const PRODUCTS = [
    { id: "1", name: "Akamai Edge Hoodie", price: 49.99, image: "/public/assets/images/hoodie.jpg", description: "Ultra-warm performance wear deployed close to your skin." },
    { id: "2", name: "WebAssembly Sneakers", price: 89.95, image: "/public/assets/images/sneakers.jpg", description: "Run through your day at lightning fast near-native speeds." },
    { id: "3", name: "Cloud Storage Backpack", price: 35.00, image: "/public/assets/images/backpack.jpg", description: "Secure, durable, and highly accessible storage." }
];

const SHOWCASE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

// --- 🛠️ AKAMAI FAST PURGE CONFIGURATION (With Script Placeholders) ---
const AKAMAI_CONFIG = {
    host: "%%AKAMAI_HOST_PLACEHOLDER%%",
    clientToken: "%%AKAMAI_CLIENT_TOKEN_PLACEHOLDER%%",
    clientSecret: "%%AKAMAI_CLIENT_SECRET_PLACEHOLDER%%",
    accessToken: "%%AKAMAI_ACCESS_TOKEN_PLACEHOLDER%%",
    baseUrl: "https://videsa1.scoe-sil.net"
};

// Cryptographic signing utility native to Web Worker Runtimes
async function hmacSha256Base64(keyStr: string, dataStr: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyStr);
    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(dataStr));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Executes a cache invalidation request against Akamai's CCU v3 Fast Purge API on STAGING
 */
async function purgeAkamaiCacheStaging(paths: string[]): Promise<any> {
    const fullUrls = paths.map(path => `${AKAMAI_CONFIG.baseUrl}${path}`);
    const apiPath = "/ccu/v3/invalidate/url/staging";
    const purgeEndpoint = `https://${AKAMAI_CONFIG.host}${apiPath}`;

    const bodyPayload = JSON.stringify({ objects: fullUrls });

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const nonce = crypto.randomUUID();

    const authHeaderBase = `EG1-HMAC-SHA256 client_token=${AKAMAI_CONFIG.clientToken};access_token=${AKAMAI_CONFIG.accessToken};timestamp=${timestamp};nonce=${nonce};`;
    const signingKey = await hmacSha256Base64(AKAMAI_CONFIG.clientSecret, timestamp);

    const contentHash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyPayload)))));
    const dataToSign = ["POST", "https", AKAMAI_CONFIG.host, apiPath, "", contentHash, authHeaderBase].join("\t");

    const finalSignature = await hmacSha256Base64(signingKey, dataToSign);
    const authorizationHeader = `${authHeaderBase}signature=${finalSignature}`;

    const response = await fetch(purgeEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": authorizationHeader
        },
        body: bodyPayload
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Akamai Purge Failed Status [${response.status}]: ${errText}`);
    }
    return await response.json();
}

// Centralized Routing Pipeline
async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // Standardize path by removing trailing slashes for clean matching
    const path = url.pathname.replace(/\/$/, "");

    // 🚀 CRITICAL FIX: Intercept the deploy-sync route IMMEDIATELY before anything else
    if ((path === "/default/api/deploy-sync" || path === "/api/deploy-sync") && request.method === "POST") {
        try {
            const body = await request.json();
            const changedImages: string[] = body.images || [];

            if (changedImages.length === 0) {
                return new Response(JSON.stringify({ message: "No image targets provided." }), {
                    status: 200, headers: { "Content-Type": "application/json" }
                });
            }

            const purgeResult = await purgeAkamaiCacheStaging(changedImages);

            return new Response(JSON.stringify({
                success: true,
                message: "Akamai STAGING cache cleared successfully.",
                details: purgeResult
            }), {
                status: 200, headers: { "Content-Type": "application/json" }
            });
        } catch (error: any) {
            return new Response(JSON.stringify({ success: false, error: error.message }), {
                status: 500, headers: { "Content-Type": "application/json" }
            });
        }
    }

    // 1. ROUTE: CSS Stylesheet Delivery
    if (path === "/default/assets/styles.css" || path === "/assets/styles.css") {
        return new Response(CSS_DATA, { headers: { "Content-Type": "text/css; charset=utf-8" } });
    }

    // 2. ROUTE: Client Script Interactivity Asset
    if (path === "/default/assets/app.js" || path === "/assets/app.js") {
        const jsCode = `
          function switchTab(tabId, el) {
            document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).style.display = 'block';
            el.classList.add('active');
          }
          let count = 0;
          function addToCart(id, name, price) {
            count++;
            document.getElementById('cart-count').innerText = count;
            const container = document.getElementById('cart-items');
            if (count === 1) container.innerHTML = '';
            container.innerHTML += '<div style="display:flex;justify-content:space-between;font-size:0.9rem;margin-bottom:0.4rem"><span>' + name + '</span><b>$' + price + '</b></div>';
          }
        `;
        return new Response(jsCode, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
    }

    // 3. ROUTE: Home Application Layout (Matches: "", /default)
    if (path === "" || path === "/default") {
        const pathPrefix = path.startsWith("/default") ? "/default" : "";

        let itemsHtml = '';
        for (const p of PRODUCTS) {
            itemsHtml += `
              <div class="product-card">
                <img src="${p.image}" alt="${p.name}">
                <div class="product-info">
                  <div>
                    <div class="product-name">${p.name}</div>
                    <p style="color:#718096;font-size:0.85rem;margin:0 0 1rem 0">${p.description}</p>
                  </div>
                  <div>
                    <div class="product-price">$${p.price.toFixed(2)}</div>
                    <button class="btn" onclick="addToCart('${p.id}','${p.name}',${p.price})">Add to Cart</button>
                  </div>
                </div>
              </div>
            `;
        }

        const htmlDocument = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Akamai Store</title>
            <link rel="stylesheet" href="${pathPrefix}/assets/styles.css">
        </head>
        <body>
            <header>
                <h1>🚀 Akamai WebAssembly Store</h1>
                <p>High Performance E-Commerce Rendered at the Edge</p>
                <div class="nav-tabs">
                    <button class="tab-btn active" onclick="switchTab('home-tab', this)">🏠 Home</button>
                    <button class="tab-btn" onclick="switchTab('contact-tab', this)">✉️ Help Desk</button>
                </div>
            </header>

            <div class="container">
                <div class="main-content">
                    <div id="home-tab" class="tab-content">
                        <div class="video-showcase">
                            <h2>🎥 Commercial Showcase</h2>
                            <video controls muted autoplay loop>
                                <source src="${SHOWCASE_VIDEO_URL}" type="video/mp4">
                            </video>
                        </div>
                        <h2>📦 Featured Inventory</h2>
                        <div class="product-grid">${itemsHtml}</div>
                    </div>
                    
                    <div id="contact-tab" class="tab-content" style="display:none">
                        <div class="card-panel">
                            <h2>✉️ Technical Support Ingestion Node</h2>
                            <p>Your requests are processed directly via high speed native edge execution runtimes.</p>
                        </div>
                    </div>
                </div>

                <div class="sidebar">
                    <div class="cart-panel">
                        <div style="font-weight:bold;font-size:1.1rem;margin-bottom:1rem;display:flex;justify-content:space-between">
                            <span>🛒 Shopping Cart</span>
                            <span id="cart-count" style="background:#0052cc;color:white;border-radius:10px;padding:0 0.5rem;font-size:0.85rem;line-height:1.5">0</span>
                        </div>
                        <div id="cart-items" style="color:#a0aec0;font-style:italic;font-size:0.85rem;text-align:center;padding:1rem 0">Your shopping cart is currently empty.</div>
                    </div>
                    <div class="chat-panel">
                        <div style="font-weight:bold;margin-bottom:0.5rem;font-size:1.1rem">💬 Edge Assistant</div>
                        <div class="chat-box" style="font-size:0.85rem;color:#4a5568">Hello! Ask me about our performance wear collection!</div>
                        <input type="text" class="chat-input" placeholder="Ask a question...">
                    </div>
                </div>
            </div>
            <script src="${pathPrefix}/assets/app.js"></script>
        </body>
        </html>`;

        return new Response(htmlDocument, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("Not Found", { status: 404 });
}

addEventListener("fetch", (event: any) => {
    event.respondWith(handleRequest(event.request));
});