import { describe, it, expect } from 'vitest';
import {
  AICODE_RATIO_REPORT_CMD_MARKER,
  buildAicodeRatioReportCommandMarkdown,
  defaultReportMonthUtc,
} from '../../src/editors/report-slash-command.js';

describe('defaultReportMonthUtc', () => {
  it('returns half-open month bounds and YYYY-MM stem', () => {
    const r = defaultReportMonthUtc();
    expect(r.since).toMatch(/^\d{4}-\d{2}-01$/);
    expect(r.until).toMatch(/^\d{4}-\d{2}-01$/);
    expect(r.stem).toMatch(/^\d{4}-\d{2}$/);
    expect(r.since.slice(0, 7)).toBe(r.stem);
  });
});

describe('buildAicodeRatioReportCommandMarkdown', () => {
  it('includes marker, placeholders, forbids running without dates, and npx report', () => {
    const md = buildAicodeRatioReportCommandMarkdown();
    expect(md).toContain(AICODE_RATIO_REPORT_CMD_MARKER);
    expect(md).toContain('<SINCE_YYYY-MM-DD>');
    expect(md).toContain('<UNTIL_YYYY-MM-DD>');
    expect(md).toContain('npx aicode-ratio@latest report');
    expect(md).toContain('.aicode-ratio/reports/aicode-ratio-<OUTPUT_STEM>.md');
    expect(md).toContain('禁止');
    expect(md).toContain('始终无法识别');
    expect(md).toContain('不能生成报表');
    expect(md).not.toMatch(/--since 20\d{2}-\d{2}-\d{2}/);
    expect(md).not.toMatch(/--until 20\d{2}-\d{2}-\d{2}/);
  });
});
