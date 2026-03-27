import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadHnAdapterConfig } from '../src/adapters/hackernews/fetchHnStories';

describe('hackernews-adapter', () => {
  describe('loadHnAdapterConfig', () => {
    it('defaults to enabled with top+new', () => {
      const cfg = loadHnAdapterConfig({});
      expect(cfg.enabled).toBe(true);
      expect(cfg.storyTypes).toEqual(['top', 'new']);
      expect(cfg.fetchLimit).toBe(30);
    });

    it('parses custom limit', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_FETCH_LIMIT: '50' });
      expect(cfg.fetchLimit).toBe(50);
    });

    it('caps limit at 100', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_FETCH_LIMIT: '500' });
      expect(cfg.fetchLimit).toBe(100);
    });

    it('disables when PIH_HN_ENABLED=false', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_ENABLED: 'false' });
      expect(cfg.enabled).toBe(false);
    });

    it('parses best story type', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_STORY_TYPES: 'best' });
      expect(cfg.storyTypes).toEqual(['best']);
    });

    it('parses multiple story types', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_STORY_TYPES: 'top,new,best' });
      expect(cfg.storyTypes).toEqual(['top', 'new', 'best']);
    });

    it('fallbackToRss defaults to true', () => {
      const cfg = loadHnAdapterConfig({});
      expect(cfg.fallbackToRss).toBe(true);
    });

    it('fallbackToRss false when disabled', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_FALLBACK_RSS: 'false' });
      expect(cfg.fallbackToRss).toBe(false);
    });
  });
});
