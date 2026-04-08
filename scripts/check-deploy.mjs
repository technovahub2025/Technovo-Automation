const [, , rawTargetUrl] = process.argv;

const targetUrl = rawTargetUrl || process.env.DEPLOY_CHECK_URL || "https://technovahub.in/nexion/";

const toAssetSet = (html = "") => {
  const assets = new Set();
  const assetPattern = /(?:src|href)="([^"]+\.(?:js|css))"/gi;
  let match;
  while ((match = assetPattern.exec(html))) {
    assets.add(match[1]);
  }
  return assets;
};

const extractTitle = (html = "") => {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
};

const readLocalBuild = async () => {
  const { readFile } = await import("node:fs/promises");
  const url = new URL("../dist/index.html", import.meta.url);
  return readFile(url, "utf8");
};

const fetchLiveHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const main = async () => {
  const [localHtml, liveHtml] = await Promise.all([
    readLocalBuild(),
    fetchLiveHtml(targetUrl)
  ]);

  const localAssets = toAssetSet(localHtml);
  const liveAssets = toAssetSet(liveHtml);
  const localTitle = extractTitle(localHtml);
  const liveTitle = extractTitle(liveHtml);

  const missingAssets = [...localAssets].filter((asset) => !liveAssets.has(asset));
  const extraAssets = [...liveAssets].filter((asset) => !localAssets.has(asset));
  const titleMatches = localTitle === liveTitle;

  console.log(`Target URL: ${targetUrl}`);
  console.log(`Local title: ${localTitle || "(none)"}`);
  console.log(`Live title: ${liveTitle || "(none)"}`);
  console.log(`Local assets: ${[...localAssets].join(", ") || "(none)"}`);
  console.log(`Live assets: ${[...liveAssets].join(", ") || "(none)"}`);

  if (!titleMatches || missingAssets.length || extraAssets.length) {
    console.error("Deployment mismatch detected.");
    if (!titleMatches) {
      console.error(`Title mismatch: expected "${localTitle}", got "${liveTitle}"`);
    }
    if (missingAssets.length) {
      console.error(`Missing live assets: ${missingAssets.join(", ")}`);
    }
    if (extraAssets.length) {
      console.error(`Unexpected live assets: ${extraAssets.join(", ")}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Live deployment matches the current local dist build.");
};

main().catch((error) => {
  console.error(`Deployment check failed: ${error.message}`);
  process.exitCode = 1;
});
