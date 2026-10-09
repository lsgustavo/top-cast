import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

describe('Tooltip animations & styling', () => {
  const cssPath = path.resolve('src/renderer/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('defines smooth cubic-bezier directional entrance keyframes and exit keyframe', () => {
    assert.ok(cssContent.includes('@keyframes topcast-tooltip-slide-up'));
    assert.ok(cssContent.includes('@keyframes topcast-tooltip-slide-down'));
    assert.ok(cssContent.includes('@keyframes topcast-tooltip-slide-left'));
    assert.ok(cssContent.includes('@keyframes topcast-tooltip-slide-right'));
    assert.ok(cssContent.includes('@keyframes topcast-tooltip-exit'));
  });

  it('binds directional entrance to Radix states delayed-open and instant-open', () => {
    assert.ok(cssContent.includes("[data-state='delayed-open'][data-side='top']"));
    assert.ok(cssContent.includes("[data-state='instant-open'][data-side='top']"));
    assert.ok(cssContent.includes("[data-state='delayed-open'][data-side='bottom']"));
    assert.ok(cssContent.includes("[data-state='instant-open'][data-side='bottom']"));
    assert.ok(cssContent.includes("[data-state='delayed-open'][data-side='left']"));
    assert.ok(cssContent.includes("[data-state='instant-open'][data-side='left']"));
    assert.ok(cssContent.includes("[data-state='delayed-open'][data-side='right']"));
    assert.ok(cssContent.includes("[data-state='instant-open'][data-side='right']"));
  });

  it('binds fast exit animation to Radix closed state', () => {
    assert.ok(cssContent.includes("[data-state='closed']"));
    assert.ok(cssContent.includes('topcast-tooltip-exit'));
  });

  it('respects prefers-reduced-motion accessibility setting', () => {
    assert.ok(cssContent.includes('.topcast-tooltip-content'));
    assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'));
  });

  it('attaches the topcast-tooltip-content class to TooltipContent component', () => {
    const tooltipComponentPath = path.resolve('src/renderer/components/ui/tooltip.tsx');
    const componentCode = fs.readFileSync(tooltipComponentPath, 'utf8');
    assert.ok(componentCode.includes('topcast-tooltip-content'));
  });
});

