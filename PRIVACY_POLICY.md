# Privacy Policy for DraftPilot

**Effective Date: August 2026**

DraftPilot ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your data when you use the DraftPilot Chrome Extension and associated services.

## 1. What Data We Collect
We only collect the data necessary to provide our service:
- **Account Information:** Email address used for authentication.
- **Macro Content:** The canned responses or templates you save in DraftPilot to provide context for AI drafting.
- **Email Thread Text (Ephemeral):** When you click "Generate Draft," we read the text of the current email thread. **This text is scrubbed of Personally Identifiable Information (PII) in your browser before being sent to our servers.**
- **Usage Metrics:** Basic telemetry such as the number of drafts generated to manage usage limits.

## 2. What Data We Do NOT Collect
- **Raw PII:** Phone numbers, credit card details, and standard PII patterns are redacted client-side.
- **Email Content Storage:** We **do not** store the content of your emails. The thread text is sent to the AI for generation and immediately discarded.
- **AI Training Data:** Your data is **not** used to train our AI models or third-party AI models.

## 3. How Data is Processed
When you generate a draft:
1. The extension reads the visible email thread.
2. A client-side scrubber removes recognizable PII.
3. The scrubbed text is sent securely to our API.
4. The API forwards the scrubbed text and your relevant macros to our AI provider (OpenAI).
5. The generated draft is returned to your browser.
6. The thread text is discarded from our servers.

## 4. Data Storage and Third Parties
We use trusted third-party services to operate DraftPilot:
- **Supabase:** For database hosting and authentication. Stores your email, user ID, macros, and anonymized draft history (snippets only).
- **OpenAI:** For AI draft generation. They process the scrubbed text ephemerally and do not use it for training (per their API data privacy policies).
- **Stripe:** For billing and subscription management.

## 5. Data Retention
- **Account and Macros:** Retained until you delete your account.
- **Draft History:** Anonymized usage metadata is retained for 90 days.
- **Thread Content:** Not retained.

## 6. Your Rights (GDPR Compliance)
You have the right to:
- Access the data we hold about you.
- Request an export of your data.
- Request the deletion of your account and all associated data.

To exercise these rights, please contact us at [Contact Email Placeholder].

## 7. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify users of any material changes via email or an in-app notification.
