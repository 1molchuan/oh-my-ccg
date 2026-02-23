import type { Locale } from '../types.js';

// Detect locale from environment variables in priority order
export function detectLocale(): Locale {
  // 1. Check explicit override
  const explicit = process.env['OH_MY_CCG_LOCALE'];
  if (explicit === 'zh' || explicit === 'en') {
    return explicit;
  }

  // 2. Check LANG (e.g. "zh_CN.UTF-8")
  const lang = process.env['LANG'];
  if (lang && lang.startsWith('zh')) {
    return 'zh';
  }

  // 3. Check LANGUAGE (may be colon-separated list, e.g. "zh:en")
  const language = process.env['LANGUAGE'];
  if (language) {
    const first = language.split(':')[0] ?? '';
    if (first.startsWith('zh')) {
      return 'zh';
    }
    if (first.startsWith('en')) {
      return 'en';
    }
  }

  // 4. Default to Chinese
  return 'zh';
}
