# Chrome Web Store Listing & Submission Guide: DraftPilot

**Extension Name**: DraftPilot — AI Support Reply Assistant  
**Current Version**: 0.1.0  
**Manifest Version**: 3  
**Package File**: `draftpilot-chrome-extension-v0.1.0.zip`

---

## 1. Store Listing Metadata

### Summary (132 characters max)
AI-drafted customer support replies inside Gmail. Connects your knowledge base to draft human, accurate responses in seconds.

### Detailed Description
DraftPilot is an AI-assisted reply co-pilot for customer support teams and founders that lives right inside Gmail.

Stop copy-pasting from shared docs or switching between separate help desk tabs. DraftPilot detects incoming customer inquiries in your Gmail compose window, matches them against your team's knowledge base and macros, and drafts complete, contextual replies.

#### Key Features:
- ⚡ **Instant AI Drafts in Gmail**: Seamlessly detects open email threads and drafts natural, human replies with 1-click insertion.
- 📚 **Knowledge Base & Macro Grounding**: Ground drafts in your team's specific FAQs, return policies, and product documentation.
- 🛡️ **Client-Side Privacy Scrubber**: Automatically redacts credit cards, SSNs, phone numbers, and sensitive customer data before processing.
- 👥 **Team Workspaces**: Share macros and support templates across your entire support team.
- 📊 **Velocity & Accuracy Analytics**: Monitor response time improvements and macro matching rates.

---

## 2. Permissions Justifications (For Review Team)

| Permission / Host | Plain-English Justification for Chrome Web Store Reviewers |
| :--- | :--- |
| **`sidePanel`** | Required to display the DraftPilot support assistant panel alongside Gmail, allowing agents to view AI suggestions and customize drafts without covering the email compose view. |
| **`storage`** | Required to persist the authenticated user session token and local preferences securely across browser sessions. |
| **`activeTab`** | Required to insert the approved AI-generated draft into the user's active Gmail compose window when they click the "Insert into Email" button. |
| **`tabs`** | Required to detect when the user is viewing an active Gmail thread (`mail.google.com`) and ensure draft suggestions match the currently active conversation. |
| **`*://mail.google.com/*`** | Scoped strictly to Gmail to detect support email threads and insert drafted replies into Gmail compose boxes upon agent confirmation. |

---

## 3. Privacy & Data Use Disclosures

- **Single Purpose**: Draft customer support replies inside Gmail using the user's configured knowledge base macros.
- **Data Collection**:
  - Authentication info (stored securely in `chrome.storage.local`).
  - Email thread content (processed solely to generate the requested support reply; scrubbed of PII client-side).
- **Data Sharing**: No user data is sold, transferred to data brokers, or used for unrelated advertising.

---

## 4. How to Publish to the Chrome Web Store

1. Open the **[Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)**.
2. Click **"New Item"**.
3. Upload the package file: **`draftpilot-chrome-extension-v0.1.0.zip`**.
4. Fill in the **Store Listing** fields using the copy from Section 1 above.
5. In the **Privacy** tab:
   - Copy-paste the justifications from Section 2 for each permission requested.
   - Declare that data is not sold or used for creditworthiness.
6. Upload at least one screenshot (1280×800 or 640×400) showing the side panel in Gmail.
7. Click **"Submit for Review"**.
