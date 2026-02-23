import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18n, ZH_MESSAGES, EN_MESSAGES } from '../src/i18n/index.js';
import { detectLocale } from '../src/i18n/detector.js';

describe('I18n', () => {
  it("locale='zh' returns Chinese messages", () => {
    const i18n = new I18n({ locale: 'zh', fallback: 'en' });
    expect(i18n.t('rpi.init')).toBe(ZH_MESSAGES['rpi.init']);
    expect(i18n.t('rpi.plan')).toBe(ZH_MESSAGES['rpi.plan']);
  });

  it("locale='en' returns English messages", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    expect(i18n.t('rpi.init')).toBe(EN_MESSAGES['rpi.init']);
    expect(i18n.t('rpi.plan')).toBe(EN_MESSAGES['rpi.plan']);
  });

  it("t(key, params) substitutes {name} parameter correctly", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('rpi.research', { name: 'my-feature' });
    expect(result).toContain('my-feature');
    expect(result).not.toContain('{name}');
  });

  it("t(key, params) substitutes {percent} parameter correctly", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('autopilot.contextWarning', { percent: 80 });
    expect(result).toContain('80');
    expect(result).not.toContain('{percent}');
  });

  it("t(key, params) substitutes {phase} parameter correctly", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('autopilot.cancelled', { phase: 'research' });
    expect(result).toContain('research');
    expect(result).not.toContain('{phase}');
  });

  it("t(key, params) substitutes multiple parameters", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('ralph.iteration', { current: 2, max: 5 });
    expect(result).toContain('2');
    expect(result).toContain('5');
    expect(result).not.toContain('{current}');
    expect(result).not.toContain('{max}');
  });

  it("t(key) without params returns template as-is (with placeholders)", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('ralph.iteration');
    // No params provided, placeholders remain
    expect(result).toContain('{current}');
    expect(result).toContain('{max}');
  });

  it("t(key, params) leaves unmatched placeholders intact", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    // Pass wrong param name
    const result = i18n.t('rpi.research', { wrongParam: 'value' });
    expect(result).toContain('{name}');
  });

  it("unknown key returns the key itself", () => {
    const i18n = new I18n({ locale: 'zh', fallback: 'en' });
    // Cast to bypass TypeScript type check for this test
    const result = i18n.t('nonexistent.key' as Parameters<typeof i18n.t>[0]);
    expect(result).toBe('nonexistent.key');
  });

  it("setLocale() changes the language", () => {
    const i18n = new I18n({ locale: 'zh', fallback: 'en' });
    const zhResult = i18n.t('rpi.init');
    i18n.setLocale('en');
    const enResult = i18n.t('rpi.init');
    expect(zhResult).toBe(ZH_MESSAGES['rpi.init']);
    expect(enResult).toBe(EN_MESSAGES['rpi.init']);
    expect(zhResult).not.toBe(enResult);
  });

  it("getLocale() returns current locale", () => {
    const i18n = new I18n({ locale: 'zh', fallback: 'en' });
    expect(i18n.getLocale()).toBe('zh');
    i18n.setLocale('en');
    expect(i18n.getLocale()).toBe('en');
  });

  it("Chinese messages use Chinese characters", () => {
    const i18n = new I18n({ locale: 'zh', fallback: 'en' });
    const result = i18n.t('rpi.init');
    // Chinese init message should contain Chinese characters
    expect(result).toMatch(/[\u4e00-\u9fff]/);
  });

  it("English messages don't contain Chinese characters for basic keys", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('rpi.init');
    expect(result).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("t(key, params) with number value substitutes correctly", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('ralph.started', { max: 10 });
    expect(result).toContain('10');
    expect(result).not.toContain('{max}');
  });

  it("team.progress substitutes {completed} and {total}", () => {
    const i18n = new I18n({ locale: 'en', fallback: 'zh' });
    const result = i18n.t('team.progress', { completed: 3, total: 7 });
    expect(result).toContain('3');
    expect(result).toContain('7');
  });
});

describe('detectLocale', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean relevant env vars before each test
    delete process.env['OH_MY_CCG_LOCALE'];
    delete process.env['LANG'];
    delete process.env['LANGUAGE'];
  });

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv);
    // Remove keys that weren't in originalEnv
    for (const key of ['OH_MY_CCG_LOCALE', 'LANG', 'LANGUAGE']) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
  });

  it("returns 'zh' by default when no env vars set", () => {
    const locale = detectLocale();
    expect(locale).toBe('zh');
  });

  it("reads OH_MY_CCG_LOCALE env for 'zh'", () => {
    process.env['OH_MY_CCG_LOCALE'] = 'zh';
    expect(detectLocale()).toBe('zh');
  });

  it("reads OH_MY_CCG_LOCALE env for 'en'", () => {
    process.env['OH_MY_CCG_LOCALE'] = 'en';
    expect(detectLocale()).toBe('en');
  });

  it("ignores invalid OH_MY_CCG_LOCALE values and falls through", () => {
    process.env['OH_MY_CCG_LOCALE'] = 'fr';
    // 'fr' is not valid, falls through to LANG check, then defaults to 'zh'
    const locale = detectLocale();
    expect(['zh', 'en']).toContain(locale);
  });

  it("reads LANG env for 'zh' prefix", () => {
    process.env['LANG'] = 'zh_CN.UTF-8';
    expect(detectLocale()).toBe('zh');
  });

  it("reads LANG env starting with 'zh' returns 'zh'", () => {
    process.env['LANG'] = 'zh_TW.UTF-8';
    expect(detectLocale()).toBe('zh');
  });

  it("OH_MY_CCG_LOCALE takes priority over LANG", () => {
    process.env['OH_MY_CCG_LOCALE'] = 'en';
    process.env['LANG'] = 'zh_CN.UTF-8';
    expect(detectLocale()).toBe('en');
  });

  it("reads LANGUAGE env for 'zh' prefix in first entry", () => {
    process.env['LANGUAGE'] = 'zh:en';
    expect(detectLocale()).toBe('zh');
  });

  it("reads LANGUAGE env for 'en' prefix in first entry", () => {
    process.env['LANGUAGE'] = 'en:zh';
    expect(detectLocale()).toBe('en');
  });

  it("LANG takes priority over LANGUAGE", () => {
    process.env['LANG'] = 'zh_CN.UTF-8';
    process.env['LANGUAGE'] = 'en:zh';
    expect(detectLocale()).toBe('zh');
  });
});
