# 💬 WhatsApp Ultimate Scraper & Lead Generator (Groups, Channels, Numbers & Business Leads)

All-in-one WhatsApp data extractor and lead generator on Apify. Extract **WhatsApp Group Invites** (metadata, participant counts, status), **WhatsApp Channels** (followers, verified badges), **Phone Number Validation / Checker** (active WhatsApp status & business profiles), and **Automated Group Finder by Keyword**.

---

## ⚡ Key Features

- 👥 **WhatsApp Group Scraper**: Extract Group Name, Description, Group Icon/Avatar, Total Participants count, and Invite Status (`Active`, `Full`, `Revoked`).
- 📢 **WhatsApp Channels**: Scrape public WhatsApp Channels, follower counts, descriptions, and verified badges.
- 📱 **Phone Number Checker & Validator**: Check if a list of phone numbers is registered on WhatsApp, detect WhatsApp Business accounts, and extract profile names.
- 🔍 **Automated Group Finder**: Search the web for public WhatsApp group invite links based on any keyword, industry, or niche (e.g., *crypto trading*, *real estate dubai*, *dropshipping leads*).
- 📧 **Direct Lead Generation**: Automatically extracts business emails and external links found in group or channel descriptions.
- 🛡️ **Dual-Engine Architecture**: Blazing fast HTTP requests via `got-scraping` paired with an intelligent Playwright browser fallback.

---

## 📥 Input Configuration

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `mode` | String | `AUTO_DETECT` | Extraction mode: `AUTO_DETECT`, `GROUPS`, `CHANNELS`, `NUMBER_CHECK`, `GROUP_FINDER`. |
| `targetUrls` | Array | `[...]` | List of WhatsApp Group invites (`chat.whatsapp.com/...`), Channels, or `wa.me` links. |
| `phoneNumbers` | Array | `[]` | List of phone numbers to check/verify in international format (`+1...`, `+971...`). |
| `searchKeywords` | Array | `[]` | Keywords to discover public WhatsApp group links automatically. |
| `maxItems` | Integer | `50` | Maximum items to extract per run. |
| `proxyConfiguration` | Object | `{ useApifyProxy: true }` | Apify Residential proxy configuration (recommended). |

---

## 📤 Output Data Format

### 1. WhatsApp Group Record

```json
{
  "type": "GROUP",
  "id": "B1234567890abcdef",
  "groupCode": "B1234567890abcdef",
  "url": "https://chat.whatsapp.com/B1234567890abcdef",
  "title": "Crypto & AI Alpha Traders",
  "description": "Daily market updates, trade signals, and networking. Contact: admin@alphaseek.io",
  "iconUrl": "https://pps.whatsapp.net/...",
  "status": "Active",
  "membersCount": "840 participants",
  "membersCountRaw": 840,
  "emails": [
    "admin@alphaseek.io"
  ],
  "scrapedAt": "2026-10-09T12:30:00.000Z"
}
```

### 2. WhatsApp Channel Record

```json
{
  "type": "CHANNEL",
  "id": "0029Va4K00494444",
  "url": "https://www.whatsapp.com/channel/0029Va4K00494444",
  "title": "Tech Innovations Daily",
  "description": "Curated tech breakthroughs, startup launches, and AI updates.",
  "iconUrl": "https://pps.whatsapp.net/...",
  "followersCount": "1.4M followers",
  "followersCountRaw": 1400000,
  "isVerified": true,
  "scrapedAt": "2026-10-09T12:30:00.000Z"
}
```

### 3. Phone Number Validation Record

```json
{
  "type": "NUMBER_CHECK",
  "id": "+14155552671",
  "phone": "+14155552671",
  "url": "https://wa.me/14155552671",
  "title": "Acme Global Solutions",
  "phoneValid": true,
  "isBusiness": true,
  "scrapedAt": "2026-10-09T12:30:00.000Z"
}
```

---

## 💼 Business & Lead Generation Use Cases

- **B2B Cold Outreach**: Verify large phone number lists before sending WhatsApp messages to keep your delivery score pristine.
- **Niche Community Prospecting**: Discover high-intent WhatsApp groups around your industry to connect with targeted prospects.
- **Competitor Channel Tracking**: Monitor follower growth and updates across major WhatsApp Channels.

---

## 📄 License
Apache-2.0
