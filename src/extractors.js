/**
 * WhatsApp Ultimate Scraper - Extractors & Parsers
 * Robust extraction for Groups, Channels, Phone Numbers, and Business Catalogs.
 */

// Helper to clean and format phone numbers
export function cleanPhoneNumber(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/[^\d+]/g, '');
    if (!cleaned) return null;
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// Parse numeric count from strings like "2.5K", "1.2M", "250 participants"
export function parseCount(str) {
    if (!str) return 0;
    if (typeof str === 'number') return Number.isFinite(str) ? Math.round(str) : 0;
    const text = String(str).replace(/,/g, '').trim().toUpperCase();
    const match = text.match(/([\d.]+)\s*([KMB])?/);
    if (!match) return 0;

    let multiplier = 1;
    if (match[2] === 'B') multiplier = 1_000_000_000;
    else if (match[2] === 'M') multiplier = 1_000_000;
    else if (match[2] === 'K') multiplier = 1_000;

    const num = parseFloat(match[1]);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
}

// Extract email addresses from text
export function extractEmails(text) {
    if (!text || typeof text !== 'string') return [];
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailRegex) || [];
    const ignored = ['whatsapp.com', 'facebook.com', 'example.com'];
    const unique = [...new Set(matches.map(m => m.trim().toLowerCase()))];
    return unique.filter(e => !ignored.some(d => e.endsWith(`@${d}`)));
}

// Extract external social / website links from text
export function extractLinks(text) {
    if (!text || typeof text !== 'string') return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches.filter(u => !u.includes('whatsapp.com')))];
}

// Parse WhatsApp Group Invite Page HTML
export function parseGroupInviteHtml(html, url) {
    if (!html) return null;

    // Extract group code
    const codeMatch = url.match(/chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]+)/i);
    const code = codeMatch ? codeMatch[1] : null;

    // Title from og:title or title tag
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1]
        || html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';

    // Description from og:description
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] || '';

    // Icon / Avatar
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || null;

    // Determine Status
    let status = 'Active';
    const lower = html.toLowerCase();
    if (lower.includes('reset') || lower.includes("can't join this group") || lower.includes('invalid') || lower.includes('revoked')) {
        status = 'Revoked';
    } else if (lower.includes('group is full') || lower.includes('full')) {
        status = 'Full';
    }

    // Members count extraction
    let membersCount = null;
    let membersCountRaw = 0;
    const membersMatch = html.match(/(\d[\d,\s]*)\s+participants?/i)
        || html.match(/(\d[\d,\s]*)\s+members?/i);
    if (membersMatch) {
        membersCount = membersMatch[1].trim();
        membersCountRaw = parseCount(membersCount);
    }

    // Group Title cleanup
    let title = ogTitle.replace(/WhatsApp Group Invite/gi, '').trim();
    if (!title && ogDesc && !ogDesc.includes('WhatsApp Group Invite')) {
        title = ogDesc;
    }

    const emails = extractEmails(`${title} ${ogDesc}`);
    const links = extractLinks(`${title} ${ogDesc}`);

    return {
        type: 'GROUP',
        id: code,
        groupCode: code,
        url: `https://chat.whatsapp.com/${code}`,
        title: title || `WhatsApp Group (${code})`,
        description: ogDesc !== 'WhatsApp Group Invite' ? ogDesc : '',
        iconUrl: ogImage,
        status,
        membersCount: membersCount || (status === 'Active' ? 'Unknown' : '0'),
        membersCountRaw,
        emails: emails.length > 0 ? emails : undefined,
        externalLinks: links.length > 0 ? links : undefined,
        scrapedAt: new Date().toISOString()
    };
}

// Parse WhatsApp Channel Page HTML
export function parseChannelHtml(html, url) {
    if (!html) return null;

    const channelIdMatch = url.match(/\/channel\/([a-zA-Z0-9_-]+)/i);
    const channelId = channelIdMatch ? channelIdMatch[1] : null;

    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1]
        || html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';

    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] || '';
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || null;

    // Followers count
    let followersCount = null;
    let followersCountRaw = 0;
    const followersMatch = html.match(/([\d.,]+[KkMmBb]?)\s+followers?/i);
    if (followersMatch) {
        followersCount = followersMatch[1].trim();
        followersCountRaw = parseCount(followersCount);
    }

    // Verified check
    const isVerified = Boolean(
        html.includes('verified_badge') ||
        html.includes('Verified channel') ||
        html.includes('aria-label="Verified"')
    );

    const channelUpdates = [];
    const updateMatches = html.matchAll(/<div[^>]*class="[^"]*(?:update|message|post)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    for (const m of updateMatches) {
        const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text && text.length > 5 && channelUpdates.length < 20) {
            channelUpdates.push({ text });
        }
    }

    return {
        type: 'CHANNEL',
        id: channelId,
        url,
        title: ogTitle.replace(/\| WhatsApp/gi, '').trim(),
        description: ogDesc,
        iconUrl: ogImage,
        followersCount: followersCount || '0',
        followersCountRaw,
        isVerified,
        channelUpdates: channelUpdates.length > 0 ? channelUpdates : undefined,
        scrapedAt: new Date().toISOString()
    };
}

const DIAL_CODE_COUNTRIES = [
    ['+1', 'US/CA'],
    ['+44', 'GB'],
    ['+33', 'FR'],
    ['+49', 'DE'],
    ['+34', 'ES'],
    ['+39', 'IT'],
    ['+55', 'BR'],
    ['+52', 'MX'],
    ['+91', 'IN'],
    ['+971', 'AE'],
    ['+966', 'SA'],
    ['+212', 'MA'],
    ['+20', 'EG'],
    ['+27', 'ZA'],
    ['+234', 'NG'],
    ['+61', 'AU'],
    ['+81', 'JP'],
    ['+82', 'KR'],
    ['+86', 'CN'],
    ['+62', 'ID'],
    ['+63', 'PH'],
    ['+65', 'SG'],
    ['+60', 'MY'],
    ['+90', 'TR'],
    ['+7', 'RU/KZ'],
];

function detectPhoneRegion(formattedPhone) {
    if (!formattedPhone) return { phoneDialCode: undefined, phoneCountry: undefined };
    const sorted = [...DIAL_CODE_COUNTRIES].sort((a, b) => b[0].length - a[0].length);
    for (const [dial, country] of sorted) {
        if (formattedPhone.startsWith(dial)) {
            return { phoneDialCode: dial, phoneCountry: country };
        }
    }
    const dialMatch = formattedPhone.match(/^(\+\d{1,3})/);
    return { phoneDialCode: dialMatch ? dialMatch[1] : undefined, phoneCountry: undefined };
}

// Parse Phone Number Check HTML
export function parsePhoneCheckHtml(html, phoneNumber) {
    const formatted = cleanPhoneNumber(phoneNumber);
    if (!formatted) return null;

    const lower = html ? html.toLowerCase() : '';

    // Check validity
    let phoneValid = true;
    if (lower.includes('phone number shared via url is invalid') ||
        lower.includes('invalid phone number') ||
        lower.includes('not on whatsapp')) {
        phoneValid = false;
    }

    // Business account indicators
    const isBusiness = Boolean(
        lower.includes('business account') ||
        lower.includes('official business account') ||
        lower.includes('catalog')
    );

    // Business Name / Profile Name
    const titleMatch = html.match(/Chat on WhatsApp with\s+([^<."]+)/i)
        || html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)
        || html.match(/<title>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/Chat on WhatsApp with/gi, '').replace(/on WhatsApp/gi, '').replace(/Share on WhatsApp/gi, '').trim() : formatted;
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1]?.trim() || undefined;
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || undefined;
    const { phoneDialCode, phoneCountry } = detectPhoneRegion(formatted);
    const emails = extractEmails(html);
    const links = extractLinks(html);
    const categoryMatch = html.match(/"category"\s*:\s*"([^"]+)"/i);
    const addressMatch = html.match(/"address"\s*:\s*"([^"]+)"/i);

    return {
        type: 'NUMBER_CHECK',
        id: formatted,
        phone: formatted,
        phoneDialCode,
        phoneCountry,
        url: `https://wa.me/${formatted.replace('+', '')}`,
        title: name || formatted,
        description: ogDesc && !/whatsappmessenger/i.test(ogDesc) ? ogDesc : undefined,
        iconUrl: ogImage,
        phoneValid,
        isBusiness,
        businessCategory: categoryMatch ? categoryMatch[1] : undefined,
        businessAddress: addressMatch ? addressMatch[1] : undefined,
        businessEmail: emails[0] || undefined,
        businessWebsite: links[0] || undefined,
        emails: emails.length > 0 ? emails : undefined,
        externalLinks: links.length > 0 ? links : undefined,
        scrapedAt: new Date().toISOString()
    };
}

// Parse WhatsApp Business Catalog HTML (e.g. https://wa.me/c/<phone>)
export function parseCatalogHtml(html, url) {
    if (!html) return null;

    const phoneMatch = url.match(/wa\.me\/c\/(\+?\d+)/i) || url.match(/(\+?\d{8,15})/);
    const phone = phoneMatch ? cleanPhoneNumber(phoneMatch[1]) : undefined;
    const { phoneDialCode, phoneCountry } = detectPhoneRegion(phone);

    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1]
        || html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
    const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] || '';
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || undefined;

    const products = [];
    const productRegex = /"name"\s*:\s*"([^"]+)"[\s\S]{0,300}?(?:"price"\s*:\s*"([^"]+)"|"formatted_price"\s*:\s*"([^"]+)")?/gi;
    let pm;
    while ((pm = productRegex.exec(html)) !== null && products.length < 50) {
        const prodName = pm[1].trim();
        if (prodName && !/^whatsapp$/i.test(prodName)) {
            products.push({
                name: prodName,
                price: pm[2] || pm[3] || undefined,
            });
        }
    }

    const emails = extractEmails(`${ogTitle} ${ogDesc} ${html}`);
    const links = extractLinks(`${ogTitle} ${ogDesc}`);

    return {
        type: 'CATALOG',
        id: phone || url,
        url,
        phone,
        phoneDialCode,
        phoneCountry,
        title: ogTitle.replace(/Catalog\s*[-|]\s*WhatsApp/gi, '').replace(/on WhatsApp/gi, '').trim() || `WhatsApp Catalog (${phone || url})`,
        description: ogDesc || undefined,
        iconUrl: ogImage,
        isBusiness: true,
        businessEmail: emails[0] || undefined,
        businessWebsite: links[0] || undefined,
        catalogProductsCount: products.length,
        products: products.length > 0 ? products : undefined,
        emails: emails.length > 0 ? emails : undefined,
        externalLinks: links.length > 0 ? links : undefined,
        scrapedAt: new Date().toISOString()
    };
}
