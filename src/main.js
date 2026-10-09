import { Actor } from 'apify';
import { gotScraping } from 'got-scraping';
import { PlaywrightCrawler, log } from 'crawlee';
import {
    parseGroupInviteHtml,
    parseChannelHtml,
    parsePhoneCheckHtml,
    cleanPhoneNumber
} from './extractors.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
    mode = 'AUTO_DETECT',
    targetUrls = [],
    phoneNumbers = [],
    searchKeywords = [],
    maxItems = 50,
    proxyConfiguration
} = input;

log.info('🚀 Starting WhatsApp Ultimate Scraper...', {
    mode,
    targetUrlsCount: targetUrls.length,
    phoneNumbersCount: phoneNumbers.length,
    searchKeywordsCount: searchKeywords.length
});

const proxyConfig = proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : undefined;

// Default sample targets if nothing provided
let urlsToProcess = [...targetUrls];
let numbersToProcess = [...phoneNumbers];
let keywordsToProcess = [...searchKeywords];

if (urlsToProcess.length === 0 && numbersToProcess.length === 0 && keywordsToProcess.length === 0) {
    urlsToProcess = [
        'https://chat.whatsapp.com/invite/sampleGroupCode'
    ];
    numbersToProcess = [
        '+14155552671'
    ];
    log.info('ℹ️ No inputs provided. Defaulting to sample target and phone number.');
}

function buildHeaders() {
    return {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1'
    };
}

// Fast HTML fetcher
async function fetchHtml(url) {
    const proxyUrl = proxyConfig ? await proxyConfig.newUrl() : undefined;
    const response = await gotScraping({
        url,
        headers: buildHeaders(),
        proxyUrl,
        timeout: { request: 25000 },
        retry: { limit: 2 }
    });
    return response.body;
}

// Playwright crawler fallback
async function fetchWithPlaywright(url) {
    let content = '';
    const crawler = new PlaywrightCrawler({
        proxyConfiguration: proxyConfig,
        maxRequestsPerCrawl: 1,
        headless: true,
        requestHandlerTimeoutSecs: 35,
        async requestHandler({ page }) {
            content = await page.content();
        }
    });
    await crawler.run([url]);
    return content;
}

// Detect mode per URL
function detectUrlMode(url, explicitMode) {
    if (explicitMode && explicitMode !== 'AUTO_DETECT') return explicitMode;
    const lower = url.toLowerCase();
    if (lower.includes('chat.whatsapp.com')) return 'GROUPS';
    if (lower.includes('/channel/')) return 'CHANNELS';
    if (lower.includes('wa.me') || lower.includes('send/?phone=')) return 'NUMBER_CHECK';
    return 'GROUPS';
}

const stats = {
    groups: 0,
    channels: 0,
    numbersChecked: 0,
    discoveredGroups: 0,
    failed: 0
};

// 1. PROCESS TARGET URLS
for (const rawUrl of urlsToProcess) {
    const url = rawUrl.trim();
    if (!url) continue;

    const currentMode = detectUrlMode(url, mode);
    log.info(`🎯 Processing [${currentMode}]: ${url}`);

    try {
        let html = '';
        try {
            html = await fetchHtml(url);
        } catch (fetchErr) {
            log.warning(`⚠️ HTTP fetch error for ${url} (${fetchErr.message}). Fallback to browser...`);
            html = await fetchWithPlaywright(url);
        }

        if (currentMode === 'GROUPS') {
            const group = parseGroupInviteHtml(html, url);
            if (group) {
                await Actor.pushData(group);
                stats.groups++;
                log.info(`✅ Successfully scraped WhatsApp Group: "${group.title}" [Status: ${group.status}, Members: ${group.membersCount}]`);
            }
        } else if (currentMode === 'CHANNELS') {
            const channel = parseChannelHtml(html, url);
            if (channel) {
                await Actor.pushData(channel);
                stats.channels++;
                log.info(`✅ Successfully scraped WhatsApp Channel: "${channel.title}" [Followers: ${channel.followersCount}]`);
            }
        } else if (currentMode === 'NUMBER_CHECK') {
            const phoneMatch = url.match(/(?:\/|\?phone=)(\+?\d+)/);
            const phone = phoneMatch ? phoneMatch[1] : url;
            const res = parsePhoneCheckHtml(html, phone);
            if (res) {
                await Actor.pushData(res);
                stats.numbersChecked++;
                log.info(`✅ Checked WhatsApp Number: ${res.phone} [Valid: ${res.phoneValid}, Business: ${res.isBusiness}]`);
            }
        }
    } catch (err) {
        log.error(`❌ Failed processing ${url}: ${err.message}`);
        stats.failed++;
    }
}

// 2. PROCESS PHONE NUMBERS (NUMBER CHECKER)
if (numbersToProcess.length > 0) {
    for (const rawNumber of numbersToProcess) {
        const phone = cleanPhoneNumber(rawNumber);
        if (!phone) continue;

        const checkUrl = `https://api.whatsapp.com/send/?phone=${phone.replace('+', '')}&text=&type=phone_number&app_absent=0`;
        log.info(`📞 Validating phone number on WhatsApp: ${phone}`);

        try {
            let html = '';
            try {
                html = await fetchHtml(checkUrl);
            } catch (_) {
                html = await fetchWithPlaywright(checkUrl);
            }

            const result = parsePhoneCheckHtml(html, phone);
            if (result) {
                await Actor.pushData(result);
                stats.numbersChecked++;
                log.info(`✅ Result for ${phone}: [Valid: ${result.phoneValid}, Business: ${result.isBusiness}]`);
            }
        } catch (err) {
            log.error(`❌ Phone check failed for ${phone}: ${err.message}`);
            stats.failed++;
        }
    }
}

// 3. PROCESS KEYWORD GROUP FINDER
if (keywordsToProcess.length > 0) {
    for (const keyword of keywordsToProcess) {
        log.info(`🔍 Searching public WhatsApp groups for keyword: "${keyword}"`);
        try {
            // Query search engines for public WhatsApp invite links
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:chat.whatsapp.com "${keyword}"`)}`;
            const searchHtml = await fetchHtml(searchUrl);

            // Extract group links
            const groupRegex = /https?:\/\/chat\.whatsapp\.com\/(?:invite\/)?[a-zA-Z0-9_-]+/gi;
            const foundLinks = searchHtml.match(groupRegex) || [];
            const uniqueLinks = [...new Set(foundLinks)].slice(0, maxItems);

            log.info(`🔗 Discovered ${uniqueLinks.length} candidate group links for: "${keyword}"`);

            for (const groupUrl of uniqueLinks) {
                try {
                    const gHtml = await fetchHtml(groupUrl);
                    const groupData = parseGroupInviteHtml(gHtml, groupUrl);
                    if (groupData) {
                        groupData.searchQuery = keyword;
                        await Actor.pushData(groupData);
                        stats.discoveredGroups++;
                        log.info(`🎉 Discovered & Verified Group: "${groupData.title}" (${groupData.url})`);
                    }
                } catch (_) {}
            }
        } catch (err) {
            log.error(`❌ Group finder failed for keyword "${keyword}": ${err.message}`);
            stats.failed++;
        }
    }
}

// Generate summary report
const summary = {
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    metrics: stats,
    totalRecordsExtracted: stats.groups + stats.channels + stats.numbersChecked + stats.discoveredGroups,
    message: 'WhatsApp Ultimate Scraper completed successfully.'
};

await Actor.setValue('OUTPUT', summary);
log.info('🏁 Execution Finished. Executive Summary:', summary);

await Actor.exit();
