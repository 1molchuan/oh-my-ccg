import type { Locale, MessageKey, MessageCatalog, I18nConfig } from '../types.js';

// Chinese message catalog
export const ZH_MESSAGES: MessageCatalog = {
  'rpi.init': '初始化 RPI 环境',
  'rpi.research': '开始研究阶段：{name}',
  'rpi.plan': '开始规划阶段',
  'rpi.impl': '开始实现阶段',
  'rpi.review': '开始审查阶段',
  'autopilot.started': 'Autopilot 已启动，需求：{requirement}',
  'autopilot.cancelled': 'Autopilot 已在阶段 {phase} 取消，进度已保存',
  'autopilot.contextWarning': '上下文使用率 {percent}%，建议执行 /clear',
  'autopilot.phaseComplete': '阶段 {phase} 完成',
  'autopilot.allComplete': '所有阶段已完成',
  'ralph.started': 'Ralph 循环已启动（最大 {max} 次迭代）',
  'ralph.iteration': 'Ralph 迭代 {current}/{max}',
  'ralph.passed': '验证通过，Ralph 循环完成',
  'ralph.failed': '验证失败：{issues}',
  'ralph.maxReached': '已达最大迭代次数 ({max})',
  'team.created': '团队 {name} 已创建，{count} 个任务',
  'team.complete': '团队任务全部完成',
  'team.progress': '进度：{completed}/{total}',
  'worktree.created': 'Worktree 已创建：{branch}',
  'worktree.merged': 'Worktree 已合并：{branch}',
  'worktree.cleaned': '已清理 {count} 个 worktree',
  'error.noRpiState': '未找到 RPI 状态，请先执行 /oh-my-ccg:init',
  'error.invalidTransition': '无效的阶段转换：{from} → {to}',
  'error.modeNotActive': '模式 {mode} 未激活',
  'hud.contextWarning': '上下文使用率达到 {percent}%（警告阈值）',
  'hud.contextCritical': '上下文使用率达到 {percent}%（危险阈值）',
  'hud.budgetWarning': '预估费用 ${cost}（超过预算警告）',
};

// English message catalog
export const EN_MESSAGES: MessageCatalog = {
  'rpi.init': 'Initializing RPI environment',
  'rpi.research': 'Starting research phase: {name}',
  'rpi.plan': 'Starting plan phase',
  'rpi.impl': 'Starting implementation phase',
  'rpi.review': 'Starting review phase',
  'autopilot.started': 'Autopilot started, requirement: {requirement}',
  'autopilot.cancelled': 'Autopilot cancelled at phase {phase}, progress preserved',
  'autopilot.contextWarning': 'Context usage at {percent}%, suggest running /clear',
  'autopilot.phaseComplete': 'Phase {phase} completed',
  'autopilot.allComplete': 'All phases completed',
  'ralph.started': 'Ralph loop started (max {max} iterations)',
  'ralph.iteration': 'Ralph iteration {current}/{max}',
  'ralph.passed': 'Verification passed, Ralph loop complete',
  'ralph.failed': 'Verification failed: {issues}',
  'ralph.maxReached': 'Max iterations reached ({max})',
  'team.created': 'Team {name} created, {count} tasks',
  'team.complete': 'All team tasks completed',
  'team.progress': 'Progress: {completed}/{total}',
  'worktree.created': 'Worktree created: {branch}',
  'worktree.merged': 'Worktree merged: {branch}',
  'worktree.cleaned': 'Cleaned up {count} worktrees',
  'error.noRpiState': 'No RPI state found. Run /oh-my-ccg:init first.',
  'error.invalidTransition': 'Invalid phase transition: {from} → {to}',
  'error.modeNotActive': 'Mode {mode} is not active',
  'hud.contextWarning': 'Context usage at {percent}% (warning threshold)',
  'hud.contextCritical': 'Context usage at {percent}% (critical threshold)',
  'hud.budgetWarning': 'Estimated cost ${cost} (over budget warning)',
};

const CATALOGS: Record<Locale, MessageCatalog> = {
  zh: ZH_MESSAGES,
  en: EN_MESSAGES,
};

// I18n class for translating messages with parameter substitution
export class I18n {
  private locale: Locale;
  private fallback: Locale;

  constructor(config: I18nConfig) {
    this.locale = config.locale;
    this.fallback = config.fallback;
  }

  // Translate a message key, substituting {param} placeholders with provided values
  t(key: MessageKey, params?: Record<string, string | number>): string {
    const catalog = CATALOGS[this.locale] ?? CATALOGS[this.fallback];
    const fallbackCatalog = CATALOGS[this.fallback];
    const template = catalog[key] ?? fallbackCatalog[key] ?? key;

    if (!params) {
      return template;
    }

    return template.replace(/\{(\w+)\}/g, (match, paramKey: string) => {
      const value = params[paramKey];
      return value !== undefined ? String(value) : match;
    });
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  getLocale(): Locale {
    return this.locale;
  }
}
