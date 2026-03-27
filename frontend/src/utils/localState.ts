import type { AppView, LevelFilter, UiLang } from '../types/ui';

export function loadStoredView(): AppView {
  try {
    const v = localStorage.getItem('pih.view');
    if (v === 'homepage') return 'homepage';
    if (v === 'sources') return 'sources';
    if (v === 'personalize') return 'personalize';
    if (v === 'push') return 'push';
    return 'search';
  } catch {
    return 'search';
  }
}

export function loadStoredPushApiToken(): string {
  try {
    return localStorage.getItem('pih.push.apiToken') ?? '';
  } catch {
    return '';
  }
}

export function loadStoredLevel(key: string, fallback: LevelFilter): LevelFilter {
  try {
    const v = localStorage.getItem(key);
    if (v === 'ALL' || v === 'HIGH' || v === 'MEDIUM') return v;
    return fallback;
  } catch {
    return fallback;
  }
}

export function loadStoredSearchQuery(): string {
  try {
    return localStorage.getItem('pih.search.query') ?? '';
  } catch {
    return '';
  }
}

export function loadStoredLang(): UiLang {
  try {
    const v = localStorage.getItem('pih.lang');
    return v === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

export function loadStoredDataLang(): UiLang | null {
  try {
    const v = localStorage.getItem('pih.data.lang');
    if (v === 'zh' || v === 'en') return v;
    return null;
  } catch {
    return null;
  }
}
