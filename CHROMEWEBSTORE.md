# DraftPilot - Chrome Web Store Listing

## Metadata
- **Extension Name:** DraftPilot — AI Support Reply Assistant
- **Short Description (132 chars max):** AI-drafted replies inside Gmail. Drafts from your team's macros, PII scrubbed before leaving your browser.
- **Category:** Productivity
- **Language:** English
- **Privacy Policy URL:** [TBD]
- **Version:** v0.1.0 (Initial MVP release)

## Detailed Description
Stop copy-pasting from shared docs. DraftPilot is an AI assistant that lives directly in your Gmail inbox. It reads the customer's conversation, finds the right answer from your team's knowledge base (macros), and drafts a reply for you to review — all without leaving your tab.

**Why DraftPilot?**
- **Zero Migration:** You don't need to move to an expensive enterprise help desk to get AI capabilities. DraftPilot layers right on top of Gmail.
- **Your Voice:** Import your team's existing canned responses. DraftPilot uses them as context, ensuring drafts sound like you and follow your policies.
- **Privacy First:** We care about your customers' data. Built-in client-side PII scrubbing removes sensitive information like phone numbers and credit card details before the text ever leaves your browser.

**How it works:**
1. Open a customer email in Gmail.
2. Click "Generate Draft" in the DraftPilot side panel.
3. Review the drafted response, make any tweaks, and hit send.

## Permissions & Justifications
The extension requires the following permissions to function:
- `sidePanel`: The extension's primary user interface is a side panel where users manage macros and generate drafts.
- `storage`: Used to store authentication tokens, user preferences, and cached macro data locally for fast access.
- `activeTab`: Required to read the current Gmail tab content when the user explicitly clicks the button to generate a draft.
- `tabs`: Required to detect when the user is on Gmail and to read the tab URL for content script activation.
- `host_permissions: mail.google.com`: The extension reads email thread content from Gmail to provide context for AI-generated draft replies. It also injects generated drafts into Gmail's compose field.

## Data Privacy Disclosures
- **Personally Identifiable Information (PII):** Not collected. (PII is scrubbed client-side before any data leaves the browser).
- **Web History:** Not collected.
- **User Activity:** Collected. (Draft generation count for usage tracking and billing).
- **Website Content:** Collected. (Email thread text, scrubbed of PII, is sent to our API for draft generation. It is processed ephemerally and NOT persisted or used for AI training).
- **Authentication Info:** Collected. (Email and password for account authentication via Supabase).

## Assets Required for Submission
- [ ] 128x128 Extension Icon
- [ ] Promotional Tile (440x280)
- [ ] Marquee Promo (1400x560)
- [ ] Screenshot 1: Side panel open in Gmail next to an email thread (1280x800)
- [ ] Screenshot 2: AI draft being generated in the compose box (1280x800)
- [ ] Screenshot 3: Macro management view in the side panel (1280x800)
- [ ] Screenshot 4: Pricing/Upgrade screen (1280x800)
