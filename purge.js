const EdgeGrid = require('akamai-edgegrid');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
const edgercPath = path.join(process.env.USERPROFILE, '.edgerc');
const section = 'akamaip';
const baseUrl = 'https://videsa1.scoe-sil.net';

const changedImages = [
    "/public/assets/images/hoodie.jpg",
    "/public/assets/images/sneakers.jpg",
    "/public/assets/images/backpack.jpg",
    "/default/public/assets/images/hoodie.jpg",
    "/default/public/assets/images/sneakers.jpg",
    "/default/public/assets/images/backpack.jpg"
];

console.log("🔹 Initializing Akamai EdgeGrid Authenticator...");

// Instantiate client
const eg = new EdgeGrid({
    path: edgercPath,
    section: section
});

// 🛠️ AUTOMATED ACCOUNT SWITCH KEY EXTRACTION
let accountSwitchKey = null;
try {
    const edgercContent = fs.readFileSync(edgercPath, 'utf8');
    const lines = edgercContent.split('\n');
    let insideSection = false;

    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('[') && line.endsWith(']')) {
            insideSection = line.slice(1, -1).trim() === section;
            continue;
        }
        if (insideSection && line.includes('=')) {
            const parts = line.split('=');
            const key = parts[0].trim();
            const val = parts[1].trim();
            if (key === 'account_switch_key' || key === 'account_key') {
                accountSwitchKey = val;
            }
        }
    }
} catch (e) {
    console.log("⚠️ Could not scan .edgerc for accountSwitchKey metadata fallback.");
}

// Target the Fast Purge endpoint
let apiPath = '/ccu/v3/invalidate/url/staging';

// Append the switch key query parameter safely if present
if (accountSwitchKey) {
    console.log(`🔑 Account Switch Context Detected: Impersonating Account Key [${accountSwitchKey}]`);
    apiPath += `?accountSwitchKey=${encodeURIComponent(accountSwitchKey)}`;
} else {
    console.log("ℹ️ No accountSwitchKey found in .edgerc. Executing via direct native identity context.");
}

// Format asset paths
const absoluteUrls = changedImages.map(img => `${baseUrl}${img}`);
const payload = { objects: absoluteUrls };

console.log("🔹 Submitting Fast Purge Request to Akamai API Control Plane...");

eg.auth({
    path: apiPath,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
});

eg.send(function (error, response, body) {
    if (error) {
        console.error("❌ Network execution layer failure:", error);
        return;
    }

    let data;
    try {
        data = JSON.parse(body);
    } catch (e) {
        data = body;
    }

    // Determine the status code regardless of how the library returns it
    const statusCode = (response && response.statusCode) || (response && response.status) || (data && data.httpStatus);

    if (statusCode === 201 || (data && data.detail === "Request accepted")) {
        console.log("🎉 Success! Akamai Fast Purge accepted your cache request:");
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.error(`❌ Akamai API rejected the request with Status ${statusCode}:`);
        console.log(JSON.stringify(data, null, 2));
    }
});