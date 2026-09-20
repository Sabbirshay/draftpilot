/**
 * Draft Generation Utilities & Honest Fallback Synthesizer
 * Provides text cleaning, sender name extraction, and truthful fallback draft synthesis.
 */

export function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think> tags
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // 2. Strip Reasoning Chains & Thinking Process Headers (DeepSeek R1 / Gemma 4 / Qwen)
  if (
    /^(?:(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is) (?:a |the )?)?(?:thinking process|thought process|reasoning):?(?:\*\*)?|\d+\.\s*\*\*Analyze User Input)/i.test(
      text
    )
  ) {
    const emailMatch = text.match(
      /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
    );
    if (emailMatch) {
      text = (emailMatch[1] + emailMatch[2]).trim();
    } else {
      const splitMatch = text.split(/(?:\*\*|#{1,4}\s*)?(?:Final Response|Reply|Draft|Email|Response):?(?:\*\*)?/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        return '';
      }
    }
  }

  // 3. Double-check if the resulting text is still just a thinking process fragment
  if (
    /^(?:(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is) (?:a |the )?)?(?:thinking process|thought process|reasoning)|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Robust Code Fence & Wrapper Removal
  const fullWrapperMatch = text.match(/^```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```$/i);
  if (fullWrapperMatch) {
    text = fullWrapperMatch[1].trim();
  } else {
    const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
      const prefix = text.slice(0, codeBlockMatch.index).trim();
      const innerContent = codeBlockMatch[1].trim();
      const prefixHasGreeting = /^(?:> )?(?:Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good\s+(?:morning|afternoon|evening)\b|Greetings\b)/im.test(prefix);
      const innerHasGreeting = /^(?:> )?(?:Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good\s+(?:morning|afternoon|evening)\b|Greetings\b)/im.test(innerContent);
      const prefixIsPreamble = /^(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is)|Draft|Suggested|Email|Response)\b/i.test(prefix);

      if (!prefixHasGreeting && (prefixIsPreamble || innerHasGreeting)) {
        text = innerContent;
      } else {
        text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
      }
    } else {
      text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
  }

  // 5. Remove Meta Headers & Label Lines
  let prevText = '';
  while (prevText !== text) {
    prevText = text;
    text = text
      .replace(
        /^(?:\*\*|\*|#{1,4}\s*)?(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Draft:?|Response:?|(?:Subject|Re):\s*[^\n]*|Email:?|Suggested Reply:?|Thinking Process:?|Thought Process:?|Reasoning:?)(?:\*\*)?\s*\n+/i,
        ''
      )
      .trim();
  }

  // 5b. Strip trailing tip/note postscripts
  text = text.replace(/\n+---\s*\n+\*?(?:Tip|Note):?[\s\S]*$/i, '').trim();
  text = text.replace(/\n+\*(?:Tip|Note):?[\s\S]*$/i, '').trim();

  // 6. Template Variable Normalization
  text = text
    .replace(/{{name}}/gi, customerName)
    .replace(/{{customer_name}}/gi, customerName)
    .replace(/\[Customer(?:\s*Name)?\]/gi, customerName)
    .replace(/\[Name\]/gi, customerName)
    .replace(/\[Client(?:\s*Name)?\]/gi, customerName);

  // 7. Sign-off Placeholder Scrubbing
  const defaultSignoff = 'Customer Support Team';
  text = text
    .replace(/\[Your Name\]/gi, defaultSignoff)
    .replace(/\[Agent Name\]/gi, defaultSignoff)
    .replace(/\[Support Representative\]/gi, defaultSignoff)
    .replace(/\[Representative Name\]/gi, defaultSignoff)
    .replace(/\[Your Title\]/gi, defaultSignoff)
    .replace(/\[Company Name\]/gi, 'DraftPilot Support')
    .replace(/\[Company\]/gi, 'DraftPilot Support')
    .replace(/\[Contact Information\]/gi, 'support@draftpilot.com')
    .replace(/\[Support Team\]/gi, defaultSignoff)
    .replace(/{{agent_name}}/gi, defaultSignoff);

  // 8. Greeting Normalization
  const cleanName = customerName ? customerName.replace(/[.,:;!?]+$/, '').trim() : '';
  if (cleanName && cleanName.toLowerCase() !== 'there') {
    const lineMatch = text.match(/^(?:Hi|Hello|Dear|Hey|Good\s+(?:morning|afternoon|evening)|Greetings)\b[^\n]*/i);
    if (lineMatch && lineMatch[0].length < 60 && !/[.!?]\s+[A-Z]/.test(lineMatch[0])) {
      text = text.replace(/^(?:Hi|Hello|Dear|Hey|Good\s+(?:morning|afternoon|evening)|Greetings)\b[^\n]*/i, `Hi ${cleanName},`);
    } else {
      text = text.replace(/^(?:Hi|Hello|Dear|Hey|Good\s+(?:morning|afternoon|evening)|Greetings)\b[^\n,!:?]*[.,:;!?]*/im, `Hi ${cleanName},`);
    }
  } else {
    text = text.replace(/^(?:Hi|Hello|Dear|Hey)\s+(?:\[(?:Name|Customer)\]|there)[.,:;!?]*/im, 'Hi there,');
    text = text.replace(/^(?:Hi|Hello|Dear|Hey),/im, 'Hi there,');
  }

  return text;
}

export const SALUTATION_BLACKLIST = [
  'there',
  'team',
  'support',
  'all',
  'everyone',
  'sir',
  'madam',
  'sir/madam',
  'madam/sir',
  "ma'am",
  'concern',
  'customer',
  'user',
  'client',
  'can',
  'could',
  'would',
  'please',
  'whom',
  'whomever',
  'party',
  'friend',
  'member',
  'anyone',
  'somebody',
  'someone',
  'help',
  'info',
  'admin',
  'administrator',
  'greetings',
  'morning',
  'afternoon',
  'evening',
  'folks',
  'colleague',
  'colleagues',
  'i',
  'we',
  'my',
  'our',
  'thank',
  'just',
];

export function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/i);
  const signMatch = text.match(
    /(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*)/i
  );
  const greetMatch = text.match(
    /(?:hi|hello|dear|hey|good\s+(?:morning|afternoon|evening|day)|greetings),?[^\S\r\n]+(?:(?:mr|mrs|ms|miss|dr|prof)\.?[^\S\r\n]+)?([A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*(?:\s*[/]\s*[A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*)?)/i
  );

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      const candidate = clean.split(' ')[0].replace(/[.,:;!?]+$/, '').trim();
      if (candidate && !SALUTATION_BLACKLIST.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (!clean.toLowerCase().startsWith('subject')) {
      const candidate = clean.split(' ')[0].replace(/[.,:;!?]+$/, '').trim();
      if (candidate && !SALUTATION_BLACKLIST.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }
  if (signMatch && signMatch[1]) {
    const clean = signMatch[1].replace(/[.,:;!?]+$/, '').trim();
    if (clean && !SALUTATION_BLACKLIST.includes(clean.toLowerCase())) {
      return clean;
    }
  }
  if (greetMatch && greetMatch[1]) {
    const rawCandidate = greetMatch[1].trim();
    const candidate = rawCandidate.replace(/[.,:;!?]+$/, '').trim();
    const normalized = candidate.replace(/\s*[/]\s*/, '/').toLowerCase();
    if (candidate && !SALUTATION_BLACKLIST.includes(normalized)) {
      return candidate;
    }
  }
  return 'there';
}

/**
 * Truthful, review-required fallback draft synthesizer.
 * Does NOT invent completed actions, fabricated refunds, false tracking claims, or generated reset links.
 */
export function synthesizeSmartSupportDraft(
  promptOrThread: string,
  customerName = 'there',
  kbSnippets: string[] = [],
  macroHint = ''
): string {
  const lower = (promptOrThread || '').toLowerCase();
  const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';

  // Extract Knowledge Base facts (URLs, phone numbers, clean excerpts)
  let kbFact = '';
  if (kbSnippets && kbSnippets.length > 0) {
    const urls = Array.from(new Set(kbSnippets.flatMap((s) => s.match(/https?:\/\/[^\s)]+/g) || [])));
    const phoneMatches = Array.from(
      new Set(
        kbSnippets.flatMap(
          (s) => s.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}/g) || []
        )
      )
    ).filter((p) => p.replace(/\D/g, '').length >= 8);

    if (urls.length > 0 && phoneMatches.length > 0) {
      kbFact = `For more details and direct access, please visit ${urls[0]} or contact our team at ${phoneMatches[0]}.`;
    } else if (urls.length > 0) {
      kbFact = `For additional details and self-service resources, you can visit ${urls[0]}.`;
    } else if (phoneMatches.length > 0) {
      kbFact = `If you need immediate assistance, please feel free to reach our team at ${phoneMatches[0]}.`;
    } else {
      const firstSnippet = kbSnippets.find((s) => s && s.trim().length > 10);
      if (firstSnippet) {
        const cleanSnippet = firstSnippet
          .replace(/^(?:###|#|\*\*).*\n*/gm, '')
          .replace(/\n+/g, ' ')
          .trim();
        if (cleanSnippet.length > 15) {
          const excerpt = cleanSnippet.length > 180 ? cleanSnippet.slice(0, 177) + '...' : cleanSnippet;
          kbFact = `As noted in our documentation: ${excerpt}`;
        }
      }
    }
  }

  // Extract custom guidance / macroHint instructions
  let hintParagraph = '';
  const trimmedHint = (macroHint || '').trim();
  if (trimmedHint) {
    const formatted = trimmedHint.endsWith('.') || trimmedHint.endsWith('!') ? trimmedHint : `${trimmedHint}.`;
    hintParagraph = `Please note: ${formatted}`;
  }

  const extras: string[] = [];
  if (kbFact) extras.push(kbFact);
  if (hintParagraph) extras.push(hintParagraph);
  const extraBlock = extras.length > 0 ? `\n\n${extras.join('\n\n')}` : '';

  // 1. Refund & Return intent (Truthful: acknowledges request, requests order details if needed, explains review process)
  if (lower.includes('refund') || lower.includes('return') || lower.includes('money back')) {
    return `Hi ${name},\n\nThank you for reaching out regarding your return and refund inquiry. I would be happy to help you with this.\n\nTo ensure we process your request promptly and in accordance with our return policy, could you please confirm your order number or the email address used during purchase? Once confirmed, our team will review the details and assist you with the next steps.${extraBlock}\n\nPlease let me know if you have any questions in the meantime!\n\nBest regards,\nCustomer Support Team`;
  }

  // 2. Order Status & Shipping intent (Truthful: acknowledges inquiry, offers to check tracking, requests order details)
  if (
    lower.includes('track') ||
    lower.includes('shipping') ||
    lower.includes('where is my order') ||
    lower.includes('where is') ||
    lower.includes('delivery') ||
    lower.includes('delay') ||
    lower.includes('package')
  ) {
    return `Hi ${name},\n\nThank you for checking in on your order status!\n\nI would be glad to look into this for you. Could you please reply with your order number or tracking number so I can check the latest transit milestone with our carrier?${extraBlock}\n\nWe appreciate your patience and will follow up with an update as soon as possible.\n\nWarm regards,\nCustomer Support Team`;
  }

  // 3. Password / Account Access intent (Truthful: provides secure password reset instructions)
  if (
    lower.includes('password') ||
    lower.includes('login') ||
    lower.includes('2fa') ||
    lower.includes('account') ||
    lower.includes('locked') ||
    lower.includes('reset') ||
    lower.includes('sign in')
  ) {
    return `Hi ${name},\n\nThank you for contacting support regarding your account access.\n\nTo regain access, you can request a secure password reset link directly from our sign-in page by clicking "Forgot Password." Please be sure to check your inbox (and spam folder) for the password reset link.${extraBlock}\n\nIf you continue to experience any issues with two-factor authentication or account recovery, please reply to this message and our team will be glad to assist!\n\nBest regards,\nCustomer Support Team`;
  }

  // 4. Billing / Invoice intent (Truthful: directs to portal for self-service invoices and offers assistance)
  if (
    lower.includes('invoice') ||
    lower.includes('receipt') ||
    lower.includes('charge') ||
    lower.includes('card') ||
    lower.includes('billing') ||
    lower.includes('subscription') ||
    lower.includes('payment')
  ) {
    return `Hi ${name},\n\nThank you for contacting our billing team.\n\nYou can view your billing history and download itemized receipts anytime directly through your account billing portal. If you are inquiring about a specific charge or need an updated invoice with custom VAT/tax details, please reply with the details and we will gladly review it for you.${extraBlock}\n\nBest regards,\nCustomer Support Team`;
  }

  // 5. Partnership & Collaboration intent
  if (
    lower.includes('partner') ||
    lower.includes('collaboration') ||
    lower.includes('collaborate') ||
    lower.includes('affiliate') ||
    lower.includes('sponsor')
  ) {
    return `Hi ${name},\n\nThank you for reaching out and for your interest in partnering with us! We are always excited to explore new collaboration opportunities.\n\nCould you please share a bit more detail about your organization, your audience, and what kind of partnership structure you have in mind? I'll make sure this gets routed directly to our partnerships team.${extraBlock}\n\nLooking forward to hearing from you,\nCustomer Support Team`;
  }

  // 6. Technical Troubleshooting intent
  if (
    lower.includes('error') ||
    lower.includes('bug') ||
    lower.includes('crash') ||
    lower.includes('issue') ||
    lower.includes('not working') ||
    lower.includes('broken') ||
    lower.includes('failed') ||
    lower.includes('troubleshoot') ||
    lower.includes('glitch')
  ) {
    return `Hi ${name},\n\nThank you for reaching out regarding the issue you are experiencing. I apologize for the inconvenience this has caused.\n\nTo help resolve this quickly, could you please try clearing your browser cache or testing in an incognito window? If the issue persists, please reply with any relevant error codes, screenshots, or the exact steps to reproduce the problem so our technical team can investigate.${extraBlock}\n\nWe appreciate your patience and look forward to getting this sorted out for you!\n\nBest regards,\nCustomer Support Team`;
  }

  // 7. General Inquiry intent
  return `Hi ${name},\n\nThank you for reaching out to us!\n\nI have received your message and our support team is reviewing your request. If there are any additional details or context you can share, please feel free to reply directly to this thread.${extraBlock}\n\nWe will get back to you as soon as possible.\n\nBest regards,\nCustomer Support Team`;
}
