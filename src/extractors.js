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
    if (typeof str === 'number') return str;
    const text = String(str).trim().toUpperCase();

    let multiplier = 1;
    if (text.includes('M')) multiplier = 1_000_000;
    else if (text.includes('K')) multiplier = 1_000;

    const cleaned = text.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
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
        scrapedAt: new Date().toISOString()
    };
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
    const titleMatch = html.match(/Chat on WhatsApp with\s+([^<.]+)/i)
        || html.match(/<title>([^<]+)<\/title>/i);
    const name = titleMatch ? titleMatch[1].replace(/on WhatsApp/gi, '').trim() : formatted;

    return {
        type: 'NUMBER_CHECK',
        id: formatted,
        phone: formatted,
        url: `https://wa.me/${formatted.replace('+', '')}`,
        title: name,
        phoneValid,
        isBusiness,
        scrapedAt: new Date().toISOString()
    };
}
