import axios from "axios";

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

const checkAssetTree = async (html, pageUrl) => {
  const queue = [...toAssetSet(html)].map((asset) => new URL(asset, pageUrl));
  const seen = new Set();
  const failures = [];
  while (queue.length && seen.size < 250) {
    const batch = queue.splice(0, 8).filter((url) => url.origin === new URL(pageUrl).origin && !seen.has(url.href));
    if (!batch.length) continue;
    batch.forEach((url) => seen.add(url.href));
    const results = await Promise.all(batch.map(async (url) => {
      const extension = url.pathname.split('.').pop().toLowerCase();
      try {
        const response = await axios.get(url.href, {
          responseType: extension === 'js' || extension === 'mjs' ? 'text' : 'arraybuffer',
          headers: { 'cache-control': 'no-cache' },
          validateStatus: () => true
        });
        const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
        const isJavaScript = ['js', 'mjs'].includes(extension);
        const expectedMime = isJavaScript
          ? /(?:application|text)\/(?:javascript|ecmascript)/.test(contentType)
          : extension !== 'css' || contentType.includes('text/css');
        const bodyText = typeof response.data === 'string'
          ? response.data
          : Buffer.from(response.data || []).subarray(0, 200).toString('utf8');
        const isHtmlBody = /^\s*(?:<!doctype\s+html|<html)/i.test(bodyText);
        const ok = response.status >= 200 && response.status < 300 && expectedMime && !isHtmlBody;
        if (!ok) {
          failures.push({
            asset: url.pathname,
            status: response.status,
            contentType: contentType || '(missing)',
            returnedHtml: isHtmlBody
          });
        }
        return isJavaScript && ok ? { url, body: response.data } : null;
      } catch (error) {
        failures.push({ asset: url.pathname, error: error?.message || 'request failed' });
        return null;
      }
    }));
    results.filter(Boolean).forEach(({ url, body }) => {
      const importPattern = /(?:import\s*\(\s*|\bfrom\s*)["']([^"']+\.(?:m?js)(?:\?[^"']*)?)["']/g;
      let match;
      while ((match = importPattern.exec(body))) {
        const childUrl = new URL(match[1], url);
        if (childUrl.origin === new URL(pageUrl).origin && !seen.has(childUrl.href)) queue.push(childUrl);
      }
    });
  }
  return { checkedCount: seen.size, failures };
};

const fetchLiveHtml = async (url) => {
  const response = await axios.get(url, {
    headers: {
      "cache-control": "no-cache"
    },
    responseType: "text",
    validateStatus: () => true
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed with ${response.status} ${response.statusText || ""}`.trim());
  }

  const resolvedUrl = response.request?.res?.responseUrl || response.config?.url || url;
  return { html: response.data, resolvedUrl };
};

const main = async () => {
  const [localHtml, livePage] = await Promise.all([
    readLocalBuild(),
    fetchLiveHtml(targetUrl)
  ]);
  const liveHtml = livePage.html;

  const localAssets = toAssetSet(localHtml);
  const liveAssets = toAssetSet(liveHtml);
  const localTitle = extractTitle(localHtml);
  const liveTitle = extractTitle(liveHtml);

  const missingAssets = [...localAssets].filter((asset) => !liveAssets.has(asset));
  const extraAssets = [...liveAssets].filter((asset) => !localAssets.has(asset));
  const titleMatches = localTitle === liveTitle;
  const assetCheck = await checkAssetTree(liveHtml, livePage.resolvedUrl);

  console.log(`Target URL: ${targetUrl}`);
  if (livePage.resolvedUrl !== targetUrl) console.log(`Resolved URL: ${livePage.resolvedUrl}`);
  console.log(`Local title: ${localTitle || "(none)"}`);
  console.log(`Live title: ${liveTitle || "(none)"}`);
  console.log(`Local assets: ${[...localAssets].join(", ") || "(none)"}`);
  console.log(`Live assets: ${[...liveAssets].join(", ") || "(none)"}`);
  console.log(`Live JavaScript/CSS assets checked: ${assetCheck.checkedCount}`);
  console.log(`Asset MIME/status failures: ${assetCheck.failures.length}`);
  assetCheck.failures.forEach((failure) => console.error(`Invalid deployment asset: ${JSON.stringify(failure)}`));

  if (!titleMatches || missingAssets.length || extraAssets.length || assetCheck.failures.length) {
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
