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

describe('Application-wide animations (Dialogs, Modals, Selects, Toasts, Alerts)', () => {
  const cssPath = path.resolve('src/renderer/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('defines smooth cubic-bezier keyframes for dialogs, modals, selects, toasts, and alerts', () => {
    assert.ok(cssContent.includes('@keyframes topcast-dialog-overlay-in'));
    assert.ok(cssContent.includes('@keyframes topcast-dialog-overlay-out'));
    assert.ok(cssContent.includes('@keyframes topcast-dialog-content-in'));
    assert.ok(cssContent.includes('@keyframes topcast-dialog-content-out'));
    assert.ok(cssContent.includes('@keyframes topcast-select-in-top'));
    assert.ok(cssContent.includes('@keyframes topcast-select-in-bottom'));
    assert.ok(cssContent.includes('@keyframes topcast-select-out'));
    assert.ok(cssContent.includes('@keyframes topcast-toast-in'));
    assert.ok(cssContent.includes('@keyframes topcast-alert-in'));
  });

  it('binds entrance and exit states to Radix open and closed attributes', () => {
    assert.ok(cssContent.includes(".topcast-dialog-overlay[data-state='open']"));
    assert.ok(cssContent.includes(".topcast-dialog-overlay[data-state='closed']"));
    assert.ok(cssContent.includes(".topcast-dialog-content[data-state='open']"));
    assert.ok(cssContent.includes(".topcast-dialog-content[data-state='closed']"));
    assert.ok(cssContent.includes(".topcast-select-content[data-state='open'][data-side='top']"));
    assert.ok(cssContent.includes(".topcast-select-content[data-state='open'][data-side='bottom']"));
    assert.ok(cssContent.includes(".topcast-select-content[data-state='closed']"));
    assert.ok(cssContent.includes('.topcast-toast-animate'));
    assert.ok(cssContent.includes('.topcast-alert-animate'));
  });

  it('disables dialog, modal, select, toast, and alert animations when prefers-reduced-motion is active', () => {
    assert.ok(cssContent.includes('.topcast-dialog-overlay'));
    assert.ok(cssContent.includes('.topcast-dialog-content'));
    assert.ok(cssContent.includes('.topcast-select-content'));
    assert.ok(cssContent.includes('.topcast-toast-animate'));
    assert.ok(cssContent.includes('.topcast-alert-animate'));
  });

  it('binds animation classes to Dialog and AlertDialog primitives', () => {
    const dialogPath = path.resolve('src/renderer/components/ui/dialog.tsx');
    const dialogCode = fs.readFileSync(dialogPath, 'utf8');
    assert.ok(dialogCode.includes('topcast-dialog-overlay'));
    assert.ok(dialogCode.includes('topcast-dialog-content'));

    const alertDialogPath = path.resolve('src/renderer/components/ui/alert-dialog.tsx');
    const alertDialogCode = fs.readFileSync(alertDialogPath, 'utf8');
    assert.ok(alertDialogCode.includes('topcast-dialog-overlay'));
    assert.ok(alertDialogCode.includes('topcast-dialog-content'));
  });

  it('binds animation classes to Select primitive', () => {
    const selectPath = path.resolve('src/renderer/components/ui/select.tsx');
    const selectCode = fs.readFileSync(selectPath, 'utf8');
    assert.ok(selectCode.includes('topcast-select-content'));
  });

  it('binds animation classes to Toasts and Alerts in RoomPage and HomePage', () => {
    const roomPagePath = path.resolve('src/renderer/pages/RoomPage.tsx');
    const roomPageCode = fs.readFileSync(roomPagePath, 'utf8');
    assert.ok(roomPageCode.includes('topcast-toast-animate'));
    assert.ok(roomPageCode.includes('topcast-alert-animate'));

    const homePagePath = path.resolve('src/renderer/pages/HomePage.tsx');
    const homePageCode = fs.readFileSync(homePagePath, 'utf8');
    assert.ok(homePageCode.includes('topcast-alert-animate'));
  });
});

