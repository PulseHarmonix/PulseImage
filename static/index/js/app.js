// ============================================================
// Pulse Image — Desktop Shell
// ============================================================

let isTauri = false;
let isComfyConnected = false;
let isOllamaConnected = false;
let allAssets = [];
let windows = {};
let windowZIndex = 10;
let nextWindowId = 1;
let _windowStates = {};

let currentImageModel = 'schnell';
let currentI2iModel = 'klein';
let currentVideoModel = 'ltx';
let currentLtxVersion = '2.3';
let currentFastH3Mode = 'reference';
let qwenTurbo = false;

// ============================================================
// Theme System
// ============================================================
const THEMES = {
  'macOS Dark': {
    '--bg-page': '#1a1a2e', '--bg-surface': '#1a1a2e', '--bg-surface-alt': '#16162a',
    '--bg-titlebar': 'rgba(255,255,255,0.55)', '--bg-menubar': 'rgba(40,40,60,0.45)', '--bg-input': '#16162a', '--bg-hover': '#2e2e48',
    '--bg-window-body': 'rgba(40,40,60,0.45)', '--bg-window-light': '#f5f5f5', '--bg-card': '#16162a',
    '--text-primary': '#e0e0e0', '--text-secondary': 'rgba(255,255,255,0.5)', '--text-muted': '#888',
    '--text-titlebar': '#333', '--text-menubar': '#c0c0d0', '--text-menubar-hover': '#fff',
    '--text-window': '#e0e0f0', '--text-window-subtitle': '#8888aa', '--text-on-accent': '#fff',
    '--accent': '#6366f1', '--accent-hover': '#4f46e5', '--accent-light': '#818cf8',
    '--accent-bg': 'rgba(99,102,241,0.15)', '--accent-border': 'rgba(99,102,241,0.3)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(40,40,60,0.45)', '--glass-bg-alt': 'rgba(20,20,40,0.6)',
    '--glass-blur': '20px', '--glass-border': 'rgba(255,255,255,0.08)', '--glass-border-alt': '#2e2e48', '--glass-shadow': 'rgba(0,0,0,0.25)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.25)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.4)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.4)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.3)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.4)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#3a3a5a', '--scrollbar-thumb-hover': '#5a5a7a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#3a3a5a', '--spinner-top': '#6366f1', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(30,30,50,0.95)', '--submenu-border': '#3a3a5a',
    '--bb-bg': '#fff', '--bb-border': '#c0c0c8', '--bb-text': '#000', '--bb-text-muted': '#888',
    '--bb-pill-border': '#d0d0d8', '--bb-pill-hover-border': '#000', '--bb-pill-hover-text': '#000', '--bb-pill-active-bg': '#000', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#e8e8ed', '--bb-mode-active-bg': '#000', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#333',
    '--bb-menu-bg': 'rgba(255,255,255,0.95)', '--bb-menu-border': '#d0d0d8', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.12)',
    '--bb-option-hover-bg': '#e8e8ed', '--bb-option-active-text': '#000',
    '--bb-plus-bg': '#e0e0e0', '--bb-plus-hover-bg': '#d0d0d0', '--bb-plus-color': '#666', '--bb-plus-hover-color': '#333',
    '--bb-send-bg': '#d0d0d0', '--bb-send-hover-bg': '#bbb', '--bb-send-color': '#666', '--bb-send-hover-color': '#333',
    '--bb-input-placeholder': '#999', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.15)',
    '--chat-bg': '#fff', '--chat-input-color': '#000', '--chat-input-placeholder': '#999',
    '--chat-bar-bg': '#fff', '--chat-bar-border': '#c0c0c8',
    '--chat-btn-bg': '#e0e0e0', '--chat-btn-hover-bg': '#d0d0d0', '--chat-btn-color': '#666', '--chat-btn-hover-color': '#333',
    '--chat-msg-user-bg': '#007aff', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#e9e9eb', '--chat-msg-assistant-text': '#000',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#666',
    '--tl-bg': 'linear-gradient(180deg, rgba(26,26,46,1) 0%, rgba(16,16,30,1) 100%)',
    '--tl-viz-bg': '#0a0a14', '--tl-viz-border': '#2e2e48', '--tl-clips-bg': '#12121e',
    '--tl-preview-bg': '#0d0d1a', '--tl-preview-border': '#2e2e48', '--tl-header-text': '#e0e0f0',
    '--tl-meta-text': '#818cf8', '--tl-meta-hover': '#a5b4fc',
    '--tl-toolbar-btn-bg': '#2e2e48', '--tl-toolbar-btn-hover': '#3e3e5a', '--tl-toolbar-btn-text': '#c0c0d8', '--tl-time-text': '#a0a0c0',
    '--cp-bg': 'rgba(20,20,40,0.6)', '--cp-border': '#2e2e48', '--cp-name-text': '#e0e0f0',
    '--cp-time-text': '#818cf8', '--cp-label-text': '#888', '--cp-muted-text': '#aaa',
    '--cp-input-bg': '#0e0e1e', '--cp-input-border': '#2e2e48', '--cp-input-text': '#e0e0f0',
    '--cp-section-border': 'rgba(255,255,255,0.06)',
    '--cp-btn-bg': '#2e2e48', '--cp-btn-text': '#c0c0d8', '--cp-btn-hover-bg': '#3e3e5a',
    '--cp-btn-primary-bg': '#6366f1', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#818cf8',
    '--lib-view-btn-bg': '#f5f5f5', '--lib-view-btn-border': '#d1d5db', '--lib-view-btn-text': '#666',
    '--lib-view-btn-hover-bg': '#e8e8e8', '--lib-view-btn-active-bg': '#222', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#e0e0e0', '--story-placeholder': 'rgba(255,255,255,0.25)',
    '--story-select-bg': '#1a1a2e', '--story-select-text': '#e0e0e0',
    '--glass-btn-bg': 'rgba(255,255,255,0.05)', '--glass-btn-border': 'rgba(255,255,255,0.1)', '--glass-btn-text': 'rgba(255,255,255,0.7)',
    '--glass-btn-hover-bg': 'rgba(255,255,255,0.1)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(30,30,50,0.96), rgba(20,20,40,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.6)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.8)', '--dialog-bg': '#16162a', '--dialog-border': '#2e2e48',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-input-bg': '#0e0e1e', '--dialog-input-border': '#2e2e48', '--dialog-input-text': '#e0e0f0',
    '--divider-color': '#e0e0e0',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.7)', '--drag-accent': '#818cf8', '--drag-text': '#e0e0f0', '--danger-hover': '#991b1b', '--drag-muted': '#8888aa'
  },
  'macOS Light': {
    '--bg-page': '#f0f0f3', '--bg-surface': '#f5f5f7', '--bg-surface-alt': '#fff',
    '--bg-titlebar': 'rgba(245,245,247,0.85)', '--bg-menubar': 'rgba(235,235,240,0.6)', '--bg-input': '#fff', '--bg-hover': '#e8e8ed',
    '--bg-window-body': 'rgba(245,245,247,0.85)', '--bg-window-light': '#fff', '--bg-card': '#fff',
    '--text-primary': '#1d1d1f', '--text-secondary': 'rgba(0,0,0,0.4)', '--text-muted': '#86868b',
    '--text-titlebar': '#1d1d1f', '--text-menubar': '#1d1d1f', '--text-menubar-hover': '#000',
    '--text-window': '#1d1d1f', '--text-window-subtitle': '#6e6e73', '--text-on-accent': '#fff',
    '--accent': '#6366f1', '--accent-hover': '#4f46e5', '--accent-light': '#818cf8',
    '--accent-bg': 'rgba(99,102,241,0.1)', '--accent-border': 'rgba(99,102,241,0.25)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#fef2f2', '--danger-text': '#dc2626',
    '--glass-bg': 'rgba(245,245,247,0.7)', '--glass-bg-alt': 'rgba(255,255,255,0.8)',
    '--glass-blur': '20px', '--glass-border': 'rgba(0,0,0,0.08)', '--glass-border-alt': '#d1d1d6', '--glass-shadow': 'rgba(0,0,0,0.1)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.12)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.15)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.1)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.1)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.1)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#c7c7cc', '--scrollbar-thumb-hover': '#a1a1a6',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#d1d1d6', '--spinner-top': '#6366f1', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(245,245,247,0.95)', '--submenu-border': '#d1d1d6',
    '--bb-bg': '#fff', '--bb-border': '#c0c0c8', '--bb-text': '#000', '--bb-text-muted': '#888',
    '--bb-pill-border': '#d0d0d8', '--bb-pill-hover-border': '#000', '--bb-pill-hover-text': '#000', '--bb-pill-active-bg': '#000', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#e8e8ed', '--bb-mode-active-bg': '#000', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#333',
    '--bb-menu-bg': 'rgba(255,255,255,0.95)', '--bb-menu-border': '#d0d0d8', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.12)',
    '--bb-option-hover-bg': '#e8e8ed', '--bb-option-active-text': '#000',
    '--bb-plus-bg': '#e0e0e0', '--bb-plus-hover-bg': '#d0d0d0', '--bb-plus-color': '#666', '--bb-plus-hover-color': '#333',
    '--bb-send-bg': '#d0d0d0', '--bb-send-hover-bg': '#bbb', '--bb-send-color': '#666', '--bb-send-hover-color': '#333',
    '--bb-input-placeholder': '#999', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.08)',
    '--chat-bg': '#fff', '--chat-input-color': '#000', '--chat-input-placeholder': '#999',
    '--chat-bar-bg': '#fff', '--chat-bar-border': '#c0c0c8',
    '--chat-btn-bg': '#e0e0e0', '--chat-btn-hover-bg': '#d0d0d0', '--chat-btn-color': '#666', '--chat-btn-hover-color': '#333',
    '--chat-msg-user-bg': '#007aff', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#e9e9eb', '--chat-msg-assistant-text': '#000',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#666',
    '--tl-bg': 'linear-gradient(180deg, rgba(245,245,247,1) 0%, rgba(235,235,240,1) 100%)',
    '--tl-viz-bg': '#e8e8ed', '--tl-viz-border': '#d1d1d6', '--tl-clips-bg': '#e0e0e5',
    '--tl-preview-bg': '#e8e8ed', '--tl-preview-border': '#d1d1d6', '--tl-header-text': '#1d1d1f',
    '--tl-meta-text': '#6366f1', '--tl-meta-hover': '#4f46e5',
    '--tl-toolbar-btn-bg': '#e0e0e5', '--tl-toolbar-btn-hover': '#d1d1d6', '--tl-toolbar-btn-text': '#1d1d1f', '--tl-time-text': '#6e6e73',
    '--cp-bg': 'rgba(255,255,255,0.85)', '--cp-border': '#d1d1d6', '--cp-name-text': '#1d1d1f',
    '--cp-time-text': '#6366f1', '--cp-label-text': '#86868b', '--cp-muted-text': '#6e6e73',
    '--cp-input-bg': '#fff', '--cp-input-border': '#d1d1d6', '--cp-input-text': '#1d1d1f',
    '--cp-section-border': 'rgba(0,0,0,0.06)',
    '--cp-btn-bg': '#e8e8ed', '--cp-btn-text': '#1d1d1f', '--cp-btn-hover-bg': '#d1d1d6',
    '--cp-btn-primary-bg': '#6366f1', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#818cf8',
    '--lib-view-btn-bg': '#e8e8ed', '--lib-view-btn-border': '#d1d1d6', '--lib-view-btn-text': '#666',
    '--lib-view-btn-hover-bg': '#d1d1d6', '--lib-view-btn-active-bg': '#1d1d1f', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#1d1d1f', '--story-placeholder': 'rgba(0,0,0,0.25)',
    '--story-select-bg': '#fff', '--story-select-text': '#1d1d1f',
    '--glass-btn-bg': 'rgba(0,0,0,0.05)', '--glass-btn-border': 'rgba(0,0,0,0.1)', '--glass-btn-text': 'rgba(0,0,0,0.7)',
    '--glass-btn-hover-bg': 'rgba(0,0,0,0.1)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(245,245,247,0.96), rgba(235,235,240,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.15)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.4)', '--dialog-bg': '#fff', '--dialog-border': '#d1d1d6',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.15)',
    '--dialog-input-bg': '#f5f5f7', '--dialog-input-border': '#d1d1d6', '--dialog-input-text': '#1d1d1f',
    '--divider-color': '#c6c6c8',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(255,255,255,0.85)', '--drag-accent': '#6366f1', '--drag-text': '#1d1d1f', '--danger-hover': '#991b1b', '--drag-muted': '#6e6e73'
  },
  'Cyberpunk': {
    '--bg-page': '#0d0d1a', '--bg-surface': '#0d0d1a', '--bg-surface-alt': '#111128',
    '--bg-titlebar': 'rgba(10,10,30,0.85)', '--bg-menubar': 'rgba(10,10,30,0.6)', '--bg-input': '#111128', '--bg-hover': '#1a1a3a',
    '--bg-window-body': 'rgba(10,10,30,0.75)', '--bg-window-light': '#1a1a3a', '--bg-card': '#111128',
    '--text-primary': '#e0e0ff', '--text-secondary': 'rgba(180,180,255,0.5)', '--text-muted': '#8888bb',
    '--text-titlebar': '#e0e0ff', '--text-menubar': '#c0c0ee', '--text-menubar-hover': '#fff',
    '--text-window': '#e0e0ff', '--text-window-subtitle': '#8888bb', '--text-on-accent': '#fff',
    '--accent': '#06b6d4', '--accent-hover': '#0891b2', '--accent-light': '#22d3ee',
    '--accent-bg': 'rgba(6,182,212,0.15)', '--accent-border': 'rgba(6,182,212,0.3)',
    '--success': '#10b981', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(10,10,30,0.55)', '--glass-bg-alt': 'rgba(10,10,30,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(6,182,212,0.15)', '--glass-border-alt': 'rgba(6,182,212,0.2)', '--glass-shadow': 'rgba(0,0,0,0.4)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.5)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.5)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.4)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.4)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.4)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#1a1a3a', '--scrollbar-thumb-hover': '#2a2a5a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#1a1a3a', '--spinner-top': '#06b6d4', '--playhead': '#d946ef',
    '--submenu-bg': 'rgba(10,10,30,0.95)', '--submenu-border': 'rgba(6,182,212,0.2)',
    '--bb-bg': '#111128', '--bb-border': 'rgba(6,182,212,0.2)', '--bb-text': '#e0e0ff', '--bb-text-muted': '#8888bb',
    '--bb-pill-border': 'rgba(6,182,212,0.2)', '--bb-pill-hover-border': '#06b6d4', '--bb-pill-hover-text': '#22d3ee', '--bb-pill-active-bg': '#06b6d4', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#1a1a3a', '--bb-mode-active-bg': '#06b6d4', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#22d3ee',
    '--bb-menu-bg': 'rgba(10,10,30,0.95)', '--bb-menu-border': 'rgba(6,182,212,0.2)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.5)',
    '--bb-option-hover-bg': '#1a1a3a', '--bb-option-active-text': '#22d3ee',
    '--bb-plus-bg': '#1a1a3a', '--bb-plus-hover-bg': '#2a2a5a', '--bb-plus-color': '#8888bb', '--bb-plus-hover-color': '#e0e0ff',
    '--bb-send-bg': '#1a1a3a', '--bb-send-hover-bg': '#2a2a5a', '--bb-send-color': '#8888bb', '--bb-send-hover-color': '#e0e0ff',
    '--bb-input-placeholder': '#6666aa', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.3)',
    '--chat-bg': '#111128', '--chat-input-color': '#e0e0ff', '--chat-input-placeholder': '#6666aa',
    '--chat-bar-bg': '#111128', '--chat-bar-border': 'rgba(6,182,212,0.2)',
    '--chat-btn-bg': '#1a1a3a', '--chat-btn-hover-bg': '#2a2a5a', '--chat-btn-color': '#8888bb', '--chat-btn-hover-color': '#e0e0ff',
    '--chat-msg-user-bg': '#06b6d4', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#1a1a3a', '--chat-msg-assistant-text': '#e0e0ff',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#8888bb',
    '--tl-bg': 'linear-gradient(180deg, rgba(13,13,26,1) 0%, rgba(8,8,20,1) 100%)',
    '--tl-viz-bg': '#0a0a18', '--tl-viz-border': 'rgba(6,182,212,0.15)', '--tl-clips-bg': '#0d0d20',
    '--tl-preview-bg': '#0a0a18', '--tl-preview-border': 'rgba(6,182,212,0.15)', '--tl-header-text': '#e0e0ff',
    '--tl-meta-text': '#06b6d4', '--tl-meta-hover': '#22d3ee',
    '--tl-toolbar-btn-bg': '#1a1a3a', '--tl-toolbar-btn-hover': '#2a2a5a', '--tl-toolbar-btn-text': '#c0c0ee', '--tl-time-text': '#8888bb',
    '--cp-bg': 'rgba(10,10,30,0.7)', '--cp-border': 'rgba(6,182,212,0.15)', '--cp-name-text': '#e0e0ff',
    '--cp-time-text': '#06b6d4', '--cp-label-text': '#8888bb', '--cp-muted-text': '#6666aa',
    '--cp-input-bg': '#0a0a18', '--cp-input-border': 'rgba(6,182,212,0.2)', '--cp-input-text': '#e0e0ff',
    '--cp-section-border': 'rgba(6,182,212,0.06)',
    '--cp-btn-bg': '#1a1a3a', '--cp-btn-text': '#c0c0ee', '--cp-btn-hover-bg': '#2a2a5a',
    '--cp-btn-primary-bg': '#06b6d4', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#22d3ee',
    '--lib-view-btn-bg': '#1a1a3a', '--lib-view-btn-border': 'rgba(6,182,212,0.2)', '--lib-view-btn-text': '#8888bb',
    '--lib-view-btn-hover-bg': '#2a2a5a', '--lib-view-btn-active-bg': '#06b6d4', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#e0e0ff', '--story-placeholder': 'rgba(180,180,255,0.25)',
    '--story-select-bg': '#111128', '--story-select-text': '#e0e0ff',
    '--glass-btn-bg': 'rgba(6,182,212,0.1)', '--glass-btn-border': 'rgba(6,182,212,0.2)', '--glass-btn-text': 'rgba(180,180,255,0.8)',
    '--glass-btn-hover-bg': 'rgba(6,182,212,0.2)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(13,13,26,0.96), rgba(8,8,20,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.6)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.85)', '--dialog-bg': '#111128', '--dialog-border': 'rgba(6,182,212,0.2)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-input-bg': '#0a0a18', '--dialog-input-border': 'rgba(6,182,212,0.2)', '--dialog-input-text': '#e0e0ff',
    '--divider-color': 'rgba(6,182,212,0.15)',
    '--toast-success-border': '#10b981', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.8)', '--drag-accent': '#06b6d4', '--drag-text': '#e0e0ff', '--danger-hover': '#991b1b', '--drag-muted': '#8888bb'
  },
  'Nature': {
    '--bg-page': '#1a2e1a', '--bg-surface': '#1a2e1a', '--bg-surface-alt': '#0d1f0d',
    '--bg-titlebar': 'rgba(26,46,26,0.85)', '--bg-menubar': 'rgba(26,46,26,0.6)', '--bg-input': '#0d1f0d', '--bg-hover': '#2a4a2a',
    '--bg-window-body': 'rgba(26,46,26,0.75)', '--bg-window-light': '#2a4a2a', '--bg-card': '#0d1f0d',
    '--text-primary': '#d4f0d4', '--text-secondary': 'rgba(200,240,200,0.5)', '--text-muted': '#88bb88',
    '--text-titlebar': '#d4f0d4', '--text-menubar': '#b0ddb0', '--text-menubar-hover': '#fff',
    '--text-window': '#d4f0d4', '--text-window-subtitle': '#88bb88', '--text-on-accent': '#fff',
    '--accent': '#84cc16', '--accent-hover': '#65a30d', '--accent-light': '#a3e635',
    '--accent-bg': 'rgba(132,204,22,0.15)', '--accent-border': 'rgba(132,204,22,0.3)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(13,31,13,0.55)', '--glass-bg-alt': 'rgba(13,31,13,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(132,204,22,0.1)', '--glass-border-alt': 'rgba(132,204,22,0.15)', '--glass-shadow': 'rgba(0,0,0,0.35)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.35)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.4)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.3)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.3)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.3)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#2a4a2a', '--scrollbar-thumb-hover': '#3a6a3a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#2a4a2a', '--spinner-top': '#84cc16', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(13,31,13,0.95)', '--submenu-border': 'rgba(132,204,22,0.15)',
    '--bb-bg': '#0d1f0d', '--bb-border': 'rgba(132,204,22,0.2)', '--bb-text': '#d4f0d4', '--bb-text-muted': '#88bb88',
    '--bb-pill-border': 'rgba(132,204,22,0.2)', '--bb-pill-hover-border': '#84cc16', '--bb-pill-hover-text': '#a3e635', '--bb-pill-active-bg': '#84cc16', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#1a2e1a', '--bb-mode-active-bg': '#84cc16', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#a3e635',
    '--bb-menu-bg': 'rgba(13,31,13,0.95)', '--bb-menu-border': 'rgba(132,204,22,0.2)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.4)',
    '--bb-option-hover-bg': '#1a2e1a', '--bb-option-active-text': '#a3e635',
    '--bb-plus-bg': '#1a2e1a', '--bb-plus-hover-bg': '#2a4a2a', '--bb-plus-color': '#88bb88', '--bb-plus-hover-color': '#d4f0d4',
    '--bb-send-bg': '#1a2e1a', '--bb-send-hover-bg': '#2a4a2a', '--bb-send-color': '#88bb88', '--bb-send-hover-color': '#d4f0d4',
    '--bb-input-placeholder': '#669966', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.3)',
    '--chat-bg': '#0d1f0d', '--chat-input-color': '#d4f0d4', '--chat-input-placeholder': '#669966',
    '--chat-bar-bg': '#0d1f0d', '--chat-bar-border': 'rgba(132,204,22,0.2)',
    '--chat-btn-bg': '#1a2e1a', '--chat-btn-hover-bg': '#2a4a2a', '--chat-btn-color': '#88bb88', '--chat-btn-hover-color': '#d4f0d4',
    '--chat-msg-user-bg': '#84cc16', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#1a2e1a', '--chat-msg-assistant-text': '#d4f0d4',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#88bb88',
    '--tl-bg': 'linear-gradient(180deg, rgba(26,46,26,1) 0%, rgba(13,31,13,1) 100%)',
    '--tl-viz-bg': '#0d1f0d', '--tl-viz-border': 'rgba(132,204,22,0.1)', '--tl-clips-bg': '#112211',
    '--tl-preview-bg': '#0d1f0d', '--tl-preview-border': 'rgba(132,204,22,0.1)', '--tl-header-text': '#d4f0d4',
    '--tl-meta-text': '#84cc16', '--tl-meta-hover': '#a3e635',
    '--tl-toolbar-btn-bg': '#1a2e1a', '--tl-toolbar-btn-hover': '#2a4a2a', '--tl-toolbar-btn-text': '#b0ddb0', '--tl-time-text': '#88bb88',
    '--cp-bg': 'rgba(13,31,13,0.7)', '--cp-border': 'rgba(132,204,22,0.1)', '--cp-name-text': '#d4f0d4',
    '--cp-time-text': '#84cc16', '--cp-label-text': '#88bb88', '--cp-muted-text': '#669966',
    '--cp-input-bg': '#0a1a0a', '--cp-input-border': 'rgba(132,204,22,0.15)', '--cp-input-text': '#d4f0d4',
    '--cp-section-border': 'rgba(132,204,22,0.05)',
    '--cp-btn-bg': '#1a2e1a', '--cp-btn-text': '#b0ddb0', '--cp-btn-hover-bg': '#2a4a2a',
    '--cp-btn-primary-bg': '#84cc16', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#a3e635',
    '--lib-view-btn-bg': '#1a2e1a', '--lib-view-btn-border': 'rgba(132,204,22,0.2)', '--lib-view-btn-text': '#88bb88',
    '--lib-view-btn-hover-bg': '#2a4a2a', '--lib-view-btn-active-bg': '#84cc16', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#d4f0d4', '--story-placeholder': 'rgba(200,240,200,0.25)',
    '--story-select-bg': '#0d1f0d', '--story-select-text': '#d4f0d4',
    '--glass-btn-bg': 'rgba(132,204,22,0.1)', '--glass-btn-border': 'rgba(132,204,22,0.15)', '--glass-btn-text': 'rgba(200,240,200,0.8)',
    '--glass-btn-hover-bg': 'rgba(132,204,22,0.2)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(26,46,26,0.96), rgba(13,31,13,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.7)', '--dialog-bg': '#0d1f0d', '--dialog-border': 'rgba(132,204,22,0.15)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.4)',
    '--dialog-input-bg': '#0a1a0a', '--dialog-input-border': 'rgba(132,204,22,0.15)', '--dialog-input-text': '#d4f0d4',
    '--divider-color': 'rgba(132,204,22,0.15)',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.7)', '--drag-accent': '#84cc16', '--drag-text': '#d4f0d4', '--danger-hover': '#991b1b', '--drag-muted': '#88bb88'
  },
  'Ocean': {
    '--bg-page': '#0a1628', '--bg-surface': '#0a1628', '--bg-surface-alt': '#0a1a30',
    '--bg-titlebar': 'rgba(10,22,40,0.85)', '--bg-menubar': 'rgba(10,22,40,0.6)', '--bg-input': '#0a1a30', '--bg-hover': '#0f2040',
    '--bg-window-body': 'rgba(10,22,40,0.75)', '--bg-window-light': '#0f2040', '--bg-card': '#0a1a30',
    '--text-primary': '#e0f0ff', '--text-secondary': 'rgba(200,230,255,0.5)', '--text-muted': '#88bbdd',
    '--text-titlebar': '#e0f0ff', '--text-menubar': '#b0d4ee', '--text-menubar-hover': '#fff',
    '--text-window': '#e0f0ff', '--text-window-subtitle': '#88bbdd', '--text-on-accent': '#fff',
    '--accent': '#0ea5e9', '--accent-hover': '#0284c7', '--accent-light': '#38bdf8',
    '--accent-bg': 'rgba(14,165,233,0.15)', '--accent-border': 'rgba(14,165,233,0.3)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(10,22,40,0.55)', '--glass-bg-alt': 'rgba(10,22,40,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(14,165,233,0.1)', '--glass-border-alt': 'rgba(14,165,233,0.15)', '--glass-shadow': 'rgba(0,0,0,0.35)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.35)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.4)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.3)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.3)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.3)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#0f2040', '--scrollbar-thumb-hover': '#1a3a5a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#0f2040', '--spinner-top': '#0ea5e9', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(10,22,40,0.95)', '--submenu-border': 'rgba(14,165,233,0.15)',
    '--bb-bg': '#0a1a30', '--bb-border': 'rgba(14,165,233,0.2)', '--bb-text': '#e0f0ff', '--bb-text-muted': '#88bbdd',
    '--bb-pill-border': 'rgba(14,165,233,0.2)', '--bb-pill-hover-border': '#0ea5e9', '--bb-pill-hover-text': '#38bdf8', '--bb-pill-active-bg': '#0ea5e9', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#0f2040', '--bb-mode-active-bg': '#0ea5e9', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#38bdf8',
    '--bb-menu-bg': 'rgba(10,22,40,0.95)', '--bb-menu-border': 'rgba(14,165,233,0.2)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.4)',
    '--bb-option-hover-bg': '#0f2040', '--bb-option-active-text': '#38bdf8',
    '--bb-plus-bg': '#0f2040', '--bb-plus-hover-bg': '#1a3a5a', '--bb-plus-color': '#88bbdd', '--bb-plus-hover-color': '#e0f0ff',
    '--bb-send-bg': '#0f2040', '--bb-send-hover-bg': '#1a3a5a', '--bb-send-color': '#88bbdd', '--bb-send-hover-color': '#e0f0ff',
    '--bb-input-placeholder': '#6699bb', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.3)',
    '--chat-bg': '#0a1a30', '--chat-input-color': '#e0f0ff', '--chat-input-placeholder': '#6699bb',
    '--chat-bar-bg': '#0a1a30', '--chat-bar-border': 'rgba(14,165,233,0.2)',
    '--chat-btn-bg': '#0f2040', '--chat-btn-hover-bg': '#1a3a5a', '--chat-btn-color': '#88bbdd', '--chat-btn-hover-color': '#e0f0ff',
    '--chat-msg-user-bg': '#0ea5e9', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#0f2040', '--chat-msg-assistant-text': '#e0f0ff',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#88bbdd',
    '--tl-bg': 'linear-gradient(180deg, rgba(10,22,40,1) 0%, rgba(8,16,30,1) 100%)',
    '--tl-viz-bg': '#0a1628', '--tl-viz-border': 'rgba(14,165,233,0.1)', '--tl-clips-bg': '#0a1a30',
    '--tl-preview-bg': '#0a1628', '--tl-preview-border': 'rgba(14,165,233,0.1)', '--tl-header-text': '#e0f0ff',
    '--tl-meta-text': '#0ea5e9', '--tl-meta-hover': '#38bdf8',
    '--tl-toolbar-btn-bg': '#0f2040', '--tl-toolbar-btn-hover': '#1a3a5a', '--tl-toolbar-btn-text': '#b0d4ee', '--tl-time-text': '#88bbdd',
    '--cp-bg': 'rgba(10,22,40,0.7)', '--cp-border': 'rgba(14,165,233,0.1)', '--cp-name-text': '#e0f0ff',
    '--cp-time-text': '#0ea5e9', '--cp-label-text': '#88bbdd', '--cp-muted-text': '#6699bb',
    '--cp-input-bg': '#080e20', '--cp-input-border': 'rgba(14,165,233,0.15)', '--cp-input-text': '#e0f0ff',
    '--cp-section-border': 'rgba(14,165,233,0.05)',
    '--cp-btn-bg': '#0f2040', '--cp-btn-text': '#b0d4ee', '--cp-btn-hover-bg': '#1a3a5a',
    '--cp-btn-primary-bg': '#0ea5e9', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#38bdf8',
    '--lib-view-btn-bg': '#0f2040', '--lib-view-btn-border': 'rgba(14,165,233,0.2)', '--lib-view-btn-text': '#88bbdd',
    '--lib-view-btn-hover-bg': '#1a3a5a', '--lib-view-btn-active-bg': '#0ea5e9', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#e0f0ff', '--story-placeholder': 'rgba(200,230,255,0.25)',
    '--story-select-bg': '#0a1a30', '--story-select-text': '#e0f0ff',
    '--glass-btn-bg': 'rgba(14,165,233,0.1)', '--glass-btn-border': 'rgba(14,165,233,0.15)', '--glass-btn-text': 'rgba(200,230,255,0.8)',
    '--glass-btn-hover-bg': 'rgba(14,165,233,0.2)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(10,22,40,0.96), rgba(8,16,30,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.7)', '--dialog-bg': '#0a1a30', '--dialog-border': 'rgba(14,165,233,0.15)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.4)',
    '--dialog-input-bg': '#080e20', '--dialog-input-border': 'rgba(14,165,233,0.15)', '--dialog-input-text': '#e0f0ff',
    '--divider-color': 'rgba(14,165,233,0.15)',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.7)', '--drag-accent': '#0ea5e9', '--drag-text': '#e0f0ff', '--danger-hover': '#991b1b', '--drag-muted': '#88bbdd'
  },
  'Sunset': {
    '--bg-page': '#2e1a1a', '--bg-surface': '#2e1a1a', '--bg-surface-alt': '#1f0d0d',
    '--bg-titlebar': 'rgba(46,26,26,0.85)', '--bg-menubar': 'rgba(46,26,26,0.6)', '--bg-input': '#1f0d0d', '--bg-hover': '#4a2a2a',
    '--bg-window-body': 'rgba(46,26,26,0.75)', '--bg-window-light': '#4a2a2a', '--bg-card': '#1f0d0d',
    '--text-primary': '#f0ddd4', '--text-secondary': 'rgba(240,200,180,0.5)', '--text-muted': '#bb8888',
    '--text-titlebar': '#f0ddd4', '--text-menubar': '#ddb0b0', '--text-menubar-hover': '#fff',
    '--text-window': '#f0ddd4', '--text-window-subtitle': '#bb8888', '--text-on-accent': '#fff',
    '--accent': '#f97316', '--accent-hover': '#ea580c', '--accent-light': '#fb923c',
    '--accent-bg': 'rgba(249,115,22,0.15)', '--accent-border': 'rgba(249,115,22,0.3)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(31,13,13,0.55)', '--glass-bg-alt': 'rgba(31,13,13,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(249,115,22,0.1)', '--glass-border-alt': 'rgba(249,115,22,0.15)', '--glass-shadow': 'rgba(0,0,0,0.35)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.35)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.4)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.3)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.3)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.3)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#4a2a2a', '--scrollbar-thumb-hover': '#6a3a3a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#4a2a2a', '--spinner-top': '#f97316', '--playhead': '#ef4444',
    '--submenu-bg': 'rgba(31,13,13,0.95)', '--submenu-border': 'rgba(249,115,22,0.15)',
    '--bb-bg': '#1f0d0d', '--bb-border': 'rgba(249,115,22,0.2)', '--bb-text': '#f0ddd4', '--bb-text-muted': '#bb8888',
    '--bb-pill-border': 'rgba(249,115,22,0.2)', '--bb-pill-hover-border': '#f97316', '--bb-pill-hover-text': '#fb923c', '--bb-pill-active-bg': '#f97316', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#4a2a2a', '--bb-mode-active-bg': '#f97316', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#fb923c',
    '--bb-menu-bg': 'rgba(31,13,13,0.95)', '--bb-menu-border': 'rgba(249,115,22,0.2)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.4)',
    '--bb-option-hover-bg': '#4a2a2a', '--bb-option-active-text': '#fb923c',
    '--bb-plus-bg': '#4a2a2a', '--bb-plus-hover-bg': '#6a3a3a', '--bb-plus-color': '#bb8888', '--bb-plus-hover-color': '#f0ddd4',
    '--bb-send-bg': '#4a2a2a', '--bb-send-hover-bg': '#6a3a3a', '--bb-send-color': '#bb8888', '--bb-send-hover-color': '#f0ddd4',
    '--bb-input-placeholder': '#996666', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.3)',
    '--chat-bg': '#1f0d0d', '--chat-input-color': '#f0ddd4', '--chat-input-placeholder': '#996666',
    '--chat-bar-bg': '#1f0d0d', '--chat-bar-border': 'rgba(249,115,22,0.2)',
    '--chat-btn-bg': '#4a2a2a', '--chat-btn-hover-bg': '#6a3a3a', '--chat-btn-color': '#bb8888', '--chat-btn-hover-color': '#f0ddd4',
    '--chat-msg-user-bg': '#f97316', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#4a2a2a', '--chat-msg-assistant-text': '#f0ddd4',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#bb8888',
    '--tl-bg': 'linear-gradient(180deg, rgba(46,26,26,1) 0%, rgba(31,13,13,1) 100%)',
    '--tl-viz-bg': '#1f0d0d', '--tl-viz-border': 'rgba(249,115,22,0.1)', '--tl-clips-bg': '#221111',
    '--tl-preview-bg': '#1f0d0d', '--tl-preview-border': 'rgba(249,115,22,0.1)', '--tl-header-text': '#f0ddd4',
    '--tl-meta-text': '#f97316', '--tl-meta-hover': '#fb923c',
    '--tl-toolbar-btn-bg': '#4a2a2a', '--tl-toolbar-btn-hover': '#6a3a3a', '--tl-toolbar-btn-text': '#ddb0b0', '--tl-time-text': '#bb8888',
    '--cp-bg': 'rgba(31,13,13,0.7)', '--cp-border': 'rgba(249,115,22,0.1)', '--cp-name-text': '#f0ddd4',
    '--cp-time-text': '#f97316', '--cp-label-text': '#bb8888', '--cp-muted-text': '#996666',
    '--cp-input-bg': '#1a0a0a', '--cp-input-border': 'rgba(249,115,22,0.15)', '--cp-input-text': '#f0ddd4',
    '--cp-section-border': 'rgba(249,115,22,0.05)',
    '--cp-btn-bg': '#4a2a2a', '--cp-btn-text': '#ddb0b0', '--cp-btn-hover-bg': '#6a3a3a',
    '--cp-btn-primary-bg': '#f97316', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#fb923c',
    '--lib-view-btn-bg': '#4a2a2a', '--lib-view-btn-border': 'rgba(249,115,22,0.2)', '--lib-view-btn-text': '#bb8888',
    '--lib-view-btn-hover-bg': '#6a3a3a', '--lib-view-btn-active-bg': '#f97316', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#f0ddd4', '--story-placeholder': 'rgba(240,200,180,0.25)',
    '--story-select-bg': '#1f0d0d', '--story-select-text': '#f0ddd4',
    '--glass-btn-bg': 'rgba(249,115,22,0.1)', '--glass-btn-border': 'rgba(249,115,22,0.15)', '--glass-btn-text': 'rgba(240,200,180,0.8)',
    '--glass-btn-hover-bg': 'rgba(249,115,22,0.2)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(46,26,26,0.96), rgba(31,13,13,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.7)', '--dialog-bg': '#1f0d0d', '--dialog-border': 'rgba(249,115,22,0.15)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.4)',
    '--dialog-input-bg': '#1a0a0a', '--dialog-input-border': 'rgba(249,115,22,0.15)', '--dialog-input-text': '#f0ddd4',
    '--divider-color': 'rgba(249,115,22,0.15)',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.7)', '--drag-accent': '#f97316', '--drag-text': '#f0ddd4', '--danger-hover': '#991b1b', '--drag-muted': '#bb8888'
  },
  'Monochrome': {
    '--bg-page': '#111111', '--bg-surface': '#111111', '--bg-surface-alt': '#0a0a0a',
    '--bg-titlebar': 'rgba(20,20,20,0.85)', '--bg-menubar': 'rgba(20,20,20,0.6)', '--bg-input': '#0a0a0a', '--bg-hover': '#222222',
    '--bg-window-body': 'rgba(20,20,20,0.75)', '--bg-window-light': '#222222', '--bg-card': '#0a0a0a',
    '--text-primary': '#ffffff', '--text-secondary': 'rgba(255,255,255,0.5)', '--text-muted': '#999999',
    '--text-titlebar': '#ffffff', '--text-menubar': '#cccccc', '--text-menubar-hover': '#ffffff',
    '--text-window': '#ffffff', '--text-window-subtitle': '#999999', '--text-on-accent': '#000000',
    '--accent': '#e0e0e0', '--accent-hover': '#ffffff', '--accent-light': '#f0f0f0',
    '--accent-bg': 'rgba(255,255,255,0.1)', '--accent-border': 'rgba(255,255,255,0.2)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(20,20,20,0.55)', '--glass-bg-alt': 'rgba(20,20,20,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(255,255,255,0.08)', '--glass-border-alt': 'rgba(255,255,255,0.12)', '--glass-shadow': 'rgba(0,0,0,0.4)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.5)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.5)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.4)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.4)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.4)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#333333', '--scrollbar-thumb-hover': '#555555',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#333333', '--spinner-top': '#e0e0e0', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(20,20,20,0.95)', '--submenu-border': 'rgba(255,255,255,0.12)',
    '--bb-bg': '#0a0a0a', '--bb-border': 'rgba(255,255,255,0.12)', '--bb-text': '#ffffff', '--bb-text-muted': '#999999',
    '--bb-pill-border': 'rgba(255,255,255,0.12)', '--bb-pill-hover-border': '#ffffff', '--bb-pill-hover-text': '#ffffff', '--bb-pill-active-bg': '#ffffff', '--bb-pill-active-text': '#000000',
    '--bb-mode-group-bg': '#222222', '--bb-mode-active-bg': '#ffffff', '--bb-mode-active-text': '#000000', '--bb-mode-hover-text': '#cccccc',
    '--bb-menu-bg': 'rgba(20,20,20,0.95)', '--bb-menu-border': 'rgba(255,255,255,0.12)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.5)',
    '--bb-option-hover-bg': '#222222', '--bb-option-active-text': '#ffffff',
    '--bb-plus-bg': '#222222', '--bb-plus-hover-bg': '#333333', '--bb-plus-color': '#999999', '--bb-plus-hover-color': '#ffffff',
    '--bb-send-bg': '#222222', '--bb-send-hover-bg': '#333333', '--bb-send-color': '#999999', '--bb-send-hover-color': '#ffffff',
    '--bb-input-placeholder': '#666666', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.4)',
    '--chat-bg': '#0a0a0a', '--chat-input-color': '#ffffff', '--chat-input-placeholder': '#666666',
    '--chat-bar-bg': '#0a0a0a', '--chat-bar-border': 'rgba(255,255,255,0.12)',
    '--chat-btn-bg': '#222222', '--chat-btn-hover-bg': '#333333', '--chat-btn-color': '#999999', '--chat-btn-hover-color': '#ffffff',
    '--chat-msg-user-bg': '#e0e0e0', '--chat-msg-user-text': '#000000',
    '--chat-msg-assistant-bg': '#222222', '--chat-msg-assistant-text': '#ffffff',
    '--chat-msg-user-time': 'rgba(0,0,0,0.6)', '--chat-msg-assistant-time': '#999999',
    '--tl-bg': 'linear-gradient(180deg, rgba(17,17,17,1) 0%, rgba(10,10,10,1) 100%)',
    '--tl-viz-bg': '#0a0a0a', '--tl-viz-border': 'rgba(255,255,255,0.08)', '--tl-clips-bg': '#0d0d0d',
    '--tl-preview-bg': '#0a0a0a', '--tl-preview-border': 'rgba(255,255,255,0.08)', '--tl-header-text': '#ffffff',
    '--tl-meta-text': '#e0e0e0', '--tl-meta-hover': '#ffffff',
    '--tl-toolbar-btn-bg': '#222222', '--tl-toolbar-btn-hover': '#333333', '--tl-toolbar-btn-text': '#cccccc', '--tl-time-text': '#999999',
    '--cp-bg': 'rgba(20,20,20,0.7)', '--cp-border': 'rgba(255,255,255,0.08)', '--cp-name-text': '#ffffff',
    '--cp-time-text': '#e0e0e0', '--cp-label-text': '#999999', '--cp-muted-text': '#666666',
    '--cp-input-bg': '#0a0a0a', '--cp-input-border': 'rgba(255,255,255,0.1)', '--cp-input-text': '#ffffff',
    '--cp-section-border': 'rgba(255,255,255,0.04)',
    '--cp-btn-bg': '#222222', '--cp-btn-text': '#cccccc', '--cp-btn-hover-bg': '#333333',
    '--cp-btn-primary-bg': '#e0e0e0', '--cp-btn-primary-text': '#000000', '--cp-btn-primary-hover': '#ffffff',
    '--lib-view-btn-bg': '#222222', '--lib-view-btn-border': 'rgba(255,255,255,0.12)', '--lib-view-btn-text': '#999999',
    '--lib-view-btn-hover-bg': '#333333', '--lib-view-btn-active-bg': '#ffffff', '--lib-view-btn-active-text': '#000000',
    '--story-text': '#ffffff', '--story-placeholder': 'rgba(255,255,255,0.25)',
    '--story-select-bg': '#0a0a0a', '--story-select-text': '#ffffff',
    '--glass-btn-bg': 'rgba(255,255,255,0.05)', '--glass-btn-border': 'rgba(255,255,255,0.1)', '--glass-btn-text': 'rgba(255,255,255,0.7)',
    '--glass-btn-hover-bg': 'rgba(255,255,255,0.1)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(17,17,17,0.96), rgba(10,10,10,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.6)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.85)', '--dialog-bg': '#0a0a0a', '--dialog-border': 'rgba(255,255,255,0.1)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-input-bg': '#0a0a0a', '--dialog-input-border': 'rgba(255,255,255,0.1)', '--dialog-input-text': '#ffffff',
    '--divider-color': 'rgba(255,255,255,0.12)',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.8)', '--drag-accent': '#e0e0e0', '--drag-text': '#ffffff', '--danger-hover': '#991b1b', '--drag-muted': '#999999'
  },
  'Forest': {
    '--bg-page': '#0d1f0d', '--bg-surface': '#0d1f0d', '--bg-surface-alt': '#0a180a',
    '--bg-titlebar': 'rgba(13,31,13,0.85)', '--bg-menubar': 'rgba(13,31,13,0.6)', '--bg-input': '#0a180a', '--bg-hover': '#1a3a1a',
    '--bg-window-body': 'rgba(13,31,13,0.75)', '--bg-window-light': '#1a3a1a', '--bg-card': '#0a180a',
    '--text-primary': '#c8e6c9', '--text-secondary': 'rgba(180,220,180,0.5)', '--text-muted': '#6ba86b',
    '--text-titlebar': '#c8e6c9', '--text-menubar': '#a8d5a8', '--text-menubar-hover': '#fff',
    '--text-window': '#c8e6c9', '--text-window-subtitle': '#6ba86b', '--text-on-accent': '#fff',
    '--accent': '#22c55e', '--accent-hover': '#16a34a', '--accent-light': '#4ade80',
    '--accent-bg': 'rgba(34,197,94,0.15)', '--accent-border': 'rgba(34,197,94,0.3)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(10,24,10,0.55)', '--glass-bg-alt': 'rgba(10,24,10,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(34,197,94,0.1)', '--glass-border-alt': 'rgba(34,197,94,0.15)', '--glass-shadow': 'rgba(0,0,0,0.4)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.4)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.4)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.3)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.3)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.3)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#1a3a1a', '--scrollbar-thumb-hover': '#2a5a2a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#1a3a1a', '--spinner-top': '#22c55e', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(10,24,10,0.95)', '--submenu-border': 'rgba(34,197,94,0.15)',
    '--bb-bg': '#0a180a', '--bb-border': 'rgba(34,197,94,0.2)', '--bb-text': '#c8e6c9', '--bb-text-muted': '#6ba86b',
    '--bb-pill-border': 'rgba(34,197,94,0.2)', '--bb-pill-hover-border': '#22c55e', '--bb-pill-hover-text': '#4ade80', '--bb-pill-active-bg': '#22c55e', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#1a3a1a', '--bb-mode-active-bg': '#22c55e', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#4ade80',
    '--bb-menu-bg': 'rgba(10,24,10,0.95)', '--bb-menu-border': 'rgba(34,197,94,0.2)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.4)',
    '--bb-option-hover-bg': '#1a3a1a', '--bb-option-active-text': '#4ade80',
    '--bb-plus-bg': '#1a3a1a', '--bb-plus-hover-bg': '#2a5a2a', '--bb-plus-color': '#6ba86b', '--bb-plus-hover-color': '#c8e6c9',
    '--bb-send-bg': '#1a3a1a', '--bb-send-hover-bg': '#2a5a2a', '--bb-send-color': '#6ba86b', '--bb-send-hover-color': '#c8e6c9',
    '--bb-input-placeholder': '#4a8a4a', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.3)',
    '--chat-bg': '#0a180a', '--chat-input-color': '#c8e6c9', '--chat-input-placeholder': '#4a8a4a',
    '--chat-bar-bg': '#0a180a', '--chat-bar-border': 'rgba(34,197,94,0.2)',
    '--chat-btn-bg': '#1a3a1a', '--chat-btn-hover-bg': '#2a5a2a', '--chat-btn-color': '#6ba86b', '--chat-btn-hover-color': '#c8e6c9',
    '--chat-msg-user-bg': '#22c55e', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#1a3a1a', '--chat-msg-assistant-text': '#c8e6c9',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#6ba86b',
    '--tl-bg': 'linear-gradient(180deg, rgba(13,31,13,1) 0%, rgba(10,24,10,1) 100%)',
    '--tl-viz-bg': '#0a180a', '--tl-viz-border': 'rgba(34,197,94,0.1)', '--tl-clips-bg': '#0d1f0d',
    '--tl-preview-bg': '#0a180a', '--tl-preview-border': 'rgba(34,197,94,0.1)', '--tl-header-text': '#c8e6c9',
    '--tl-meta-text': '#22c55e', '--tl-meta-hover': '#4ade80',
    '--tl-toolbar-btn-bg': '#1a3a1a', '--tl-toolbar-btn-hover': '#2a5a2a', '--tl-toolbar-btn-text': '#a8d5a8', '--tl-time-text': '#6ba86b',
    '--cp-bg': 'rgba(10,24,10,0.7)', '--cp-border': 'rgba(34,197,94,0.1)', '--cp-name-text': '#c8e6c9',
    '--cp-time-text': '#22c55e', '--cp-label-text': '#6ba86b', '--cp-muted-text': '#4a8a4a',
    '--cp-input-bg': '#081408', '--cp-input-border': 'rgba(34,197,94,0.15)', '--cp-input-text': '#c8e6c9',
    '--cp-section-border': 'rgba(34,197,94,0.04)',
    '--cp-btn-bg': '#1a3a1a', '--cp-btn-text': '#a8d5a8', '--cp-btn-hover-bg': '#2a5a2a',
    '--cp-btn-primary-bg': '#22c55e', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#4ade80',
    '--lib-view-btn-bg': '#1a3a1a', '--lib-view-btn-border': 'rgba(34,197,94,0.2)', '--lib-view-btn-text': '#6ba86b',
    '--lib-view-btn-hover-bg': '#2a5a2a', '--lib-view-btn-active-bg': '#22c55e', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#c8e6c9', '--story-placeholder': 'rgba(180,220,180,0.25)',
    '--story-select-bg': '#0a180a', '--story-select-text': '#c8e6c9',
    '--glass-btn-bg': 'rgba(34,197,94,0.1)', '--glass-btn-border': 'rgba(34,197,94,0.15)', '--glass-btn-text': 'rgba(180,220,180,0.8)',
    '--glass-btn-hover-bg': 'rgba(34,197,94,0.2)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(13,31,13,0.96), rgba(10,24,10,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.7)', '--dialog-bg': '#0a180a', '--dialog-border': 'rgba(34,197,94,0.15)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.4)',
    '--dialog-input-bg': '#081408', '--dialog-input-border': 'rgba(34,197,94,0.15)', '--dialog-input-text': '#c8e6c9',
    '--divider-color': 'rgba(34,197,94,0.15)',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.7)', '--drag-accent': '#22c55e', '--drag-text': '#c8e6c9', '--danger-hover': '#991b1b', '--drag-muted': '#6ba86b'
  },
  'Royal': {
    '--bg-page': '#1a0d2e', '--bg-surface': '#1a0d2e', '--bg-surface-alt': '#0f0820',
    '--bg-titlebar': 'rgba(26,13,46,0.85)', '--bg-menubar': 'rgba(26,13,46,0.6)', '--bg-input': '#0f0820', '--bg-hover': '#2a1a4a',
    '--bg-window-body': 'rgba(26,13,46,0.75)', '--bg-window-light': '#2a1a4a', '--bg-card': '#0f0820',
    '--text-primary': '#e8d4f0', '--text-secondary': 'rgba(220,180,240,0.5)', '--text-muted': '#9977bb',
    '--text-titlebar': '#e8d4f0', '--text-menubar': '#ccaadd', '--text-menubar-hover': '#fff',
    '--text-window': '#e8d4f0', '--text-window-subtitle': '#9977bb', '--text-on-accent': '#fff',
    '--accent': '#f59e0b', '--accent-hover': '#d97706', '--accent-light': '#fbbf24',
    '--accent-bg': 'rgba(245,158,11,0.15)', '--accent-border': 'rgba(245,158,11,0.3)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#7f1d1d', '--danger-text': '#fca5a5',
    '--glass-bg': 'rgba(15,8,32,0.55)', '--glass-bg-alt': 'rgba(15,8,32,0.7)',
    '--glass-blur': '20px', '--glass-border': 'rgba(245,158,11,0.1)', '--glass-border-alt': 'rgba(245,158,11,0.15)', '--glass-shadow': 'rgba(0,0,0,0.4)',
    '--shadow-window': '0 8px 32px rgba(0,0,0,0.4)', '--shadow-dropdown': '0 8px 24px rgba(0,0,0,0.4)',
    '--shadow-card': '0 4px 12px rgba(0,0,0,0.3)', '--shadow-preview': '0 4px 20px rgba(0,0,0,0.3)', '--shadow-toast': '0 4px 16px rgba(0,0,0,0.3)',
    '--radius-sm': '4px', '--radius-md': '8px', '--radius-lg': '12px', '--radius-xl': '16px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#2a1a4a', '--scrollbar-thumb-hover': '#3a2a6a',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#2a1a4a', '--spinner-top': '#f59e0b', '--playhead': '#ef4444',
    '--submenu-bg': 'rgba(15,8,32,0.95)', '--submenu-border': 'rgba(245,158,11,0.15)',
    '--bb-bg': '#0f0820', '--bb-border': 'rgba(245,158,11,0.2)', '--bb-text': '#e8d4f0', '--bb-text-muted': '#9977bb',
    '--bb-pill-border': 'rgba(245,158,11,0.2)', '--bb-pill-hover-border': '#f59e0b', '--bb-pill-hover-text': '#fbbf24', '--bb-pill-active-bg': '#f59e0b', '--bb-pill-active-text': '#fff',
    '--bb-mode-group-bg': '#2a1a4a', '--bb-mode-active-bg': '#f59e0b', '--bb-mode-active-text': '#fff', '--bb-mode-hover-text': '#fbbf24',
    '--bb-menu-bg': 'rgba(15,8,32,0.95)', '--bb-menu-border': 'rgba(245,158,11,0.2)', '--bb-menu-shadow': '0 8px 24px rgba(0,0,0,0.4)',
    '--bb-option-hover-bg': '#2a1a4a', '--bb-option-active-text': '#fbbf24',
    '--bb-plus-bg': '#2a1a4a', '--bb-plus-hover-bg': '#3a2a6a', '--bb-plus-color': '#9977bb', '--bb-plus-hover-color': '#e8d4f0',
    '--bb-send-bg': '#2a1a4a', '--bb-send-hover-bg': '#3a2a6a', '--bb-send-color': '#9977bb', '--bb-send-hover-color': '#e8d4f0',
    '--bb-input-placeholder': '#7755aa', '--bb-inner-shadow': '0 4px 24px rgba(0,0,0,0.3)',
    '--chat-bg': '#0f0820', '--chat-input-color': '#e8d4f0', '--chat-input-placeholder': '#7755aa',
    '--chat-bar-bg': '#0f0820', '--chat-bar-border': 'rgba(245,158,11,0.2)',
    '--chat-btn-bg': '#2a1a4a', '--chat-btn-hover-bg': '#3a2a6a', '--chat-btn-color': '#9977bb', '--chat-btn-hover-color': '#e8d4f0',
    '--chat-msg-user-bg': '#f59e0b', '--chat-msg-user-text': '#fff',
    '--chat-msg-assistant-bg': '#2a1a4a', '--chat-msg-assistant-text': '#e8d4f0',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#9977bb',
    '--tl-bg': 'linear-gradient(180deg, rgba(26,13,46,1) 0%, rgba(15,8,32,1) 100%)',
    '--tl-viz-bg': '#0f0820', '--tl-viz-border': 'rgba(245,158,11,0.1)', '--tl-clips-bg': '#140a28',
    '--tl-preview-bg': '#0f0820', '--tl-preview-border': 'rgba(245,158,11,0.1)', '--tl-header-text': '#e8d4f0',
    '--tl-meta-text': '#f59e0b', '--tl-meta-hover': '#fbbf24',
    '--tl-toolbar-btn-bg': '#2a1a4a', '--tl-toolbar-btn-hover': '#3a2a6a', '--tl-toolbar-btn-text': '#ccaadd', '--tl-time-text': '#9977bb',
    '--cp-bg': 'rgba(15,8,32,0.7)', '--cp-border': 'rgba(245,158,11,0.1)', '--cp-name-text': '#e8d4f0',
    '--cp-time-text': '#f59e0b', '--cp-label-text': '#9977bb', '--cp-muted-text': '#7755aa',
    '--cp-input-bg': '#0a0418', '--cp-input-border': 'rgba(245,158,11,0.15)', '--cp-input-text': '#e8d4f0',
    '--cp-section-border': 'rgba(245,158,11,0.04)',
    '--cp-btn-bg': '#2a1a4a', '--cp-btn-text': '#ccaadd', '--cp-btn-hover-bg': '#3a2a6a',
    '--cp-btn-primary-bg': '#f59e0b', '--cp-btn-primary-text': '#fff', '--cp-btn-primary-hover': '#fbbf24',
    '--lib-view-btn-bg': '#2a1a4a', '--lib-view-btn-border': 'rgba(245,158,11,0.2)', '--lib-view-btn-text': '#9977bb',
    '--lib-view-btn-hover-bg': '#3a2a6a', '--lib-view-btn-active-bg': '#f59e0b', '--lib-view-btn-active-text': '#fff',
    '--story-text': '#e8d4f0', '--story-placeholder': 'rgba(220,180,240,0.25)',
    '--story-select-bg': '#0f0820', '--story-select-text': '#e8d4f0',
    '--glass-btn-bg': 'rgba(245,158,11,0.1)', '--glass-btn-border': 'rgba(245,158,11,0.15)', '--glass-btn-text': 'rgba(220,180,240,0.8)',
    '--glass-btn-hover-bg': 'rgba(245,158,11,0.2)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(26,13,46,0.96), rgba(15,8,32,0.96))',
    '--glass-panel-shadow': '0 8px 32px rgba(0,0,0,0.5)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.7)', '--dialog-bg': '#0f0820', '--dialog-border': 'rgba(245,158,11,0.15)',
    '--dialog-shadow': '0 8px 32px rgba(0,0,0,0.4)',
    '--dialog-input-bg': '#0a0418', '--dialog-input-border': 'rgba(245,158,11,0.15)', '--dialog-input-text': '#e8d4f0',
    '--divider-color': 'rgba(245,158,11,0.15)',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(0,0,0,0.7)', '--drag-accent': '#f59e0b', '--drag-text': '#e8d4f0', '--danger-hover': '#991b1b', '--drag-muted': '#9977bb'
  },
  'Minimal': {
    '--bg-page': '#f8f8fa', '--bg-surface': '#f8f8fa', '--bg-surface-alt': '#ffffff',
    '--bg-titlebar': 'rgba(255,255,255,0.85)', '--bg-menubar': 'rgba(240,240,245,0.6)', '--bg-input': '#ffffff', '--bg-hover': '#e8e8ee',
    '--bg-window-body': 'rgba(245,245,248,0.85)', '--bg-window-light': '#ffffff', '--bg-card': '#ffffff',
    '--text-primary': '#111111', '--text-secondary': 'rgba(0,0,0,0.4)', '--text-muted': '#8e8e93',
    '--text-titlebar': '#111111', '--text-menubar': '#1d1d1f', '--text-menubar-hover': '#000',
    '--text-window': '#1d1d1f', '--text-window-subtitle': '#8e8e93', '--text-on-accent': '#fff',
    '--accent': '#000000', '--accent-hover': '#333333', '--accent-light': '#555555',
    '--accent-bg': 'rgba(0,0,0,0.05)', '--accent-border': 'rgba(0,0,0,0.12)',
    '--success': '#22c55e', '--warning': '#eab308', '--danger': '#ef4444',
    '--danger-bg': '#fef2f2', '--danger-text': '#dc2626',
    '--glass-bg': 'rgba(255,255,255,0.8)', '--glass-bg-alt': 'rgba(255,255,255,0.9)',
    '--glass-blur': '20px', '--glass-border': 'rgba(0,0,0,0.06)', '--glass-border-alt': 'rgba(0,0,0,0.1)', '--glass-shadow': 'rgba(0,0,0,0.08)',
    '--shadow-window': '0 2px 12px rgba(0,0,0,0.06)', '--shadow-dropdown': '0 4px 16px rgba(0,0,0,0.08)',
    '--shadow-card': '0 1px 6px rgba(0,0,0,0.04)', '--shadow-preview': '0 2px 12px rgba(0,0,0,0.06)', '--shadow-toast': '0 2px 12px rgba(0,0,0,0.08)',
    '--radius-sm': '2px', '--radius-md': '4px', '--radius-lg': '8px', '--radius-xl': '12px', '--radius-full': '9999px',
    '--scrollbar-thumb': '#d1d1d6', '--scrollbar-thumb-hover': '#a1a1a6',
    '--btn-close': '#ef4444', '--btn-minimize': '#eab308', '--btn-maximize': '#22c55e',
    '--spinner-border': '#d1d1d6', '--spinner-top': '#000000', '--playhead': '#f43f5e',
    '--submenu-bg': 'rgba(255,255,255,0.95)', '--submenu-border': '#d1d1d6',
    '--bb-bg': '#ffffff', '--bb-border': '#d1d1d6', '--bb-text': '#111111', '--bb-text-muted': '#8e8e93',
    '--bb-pill-border': '#d1d1d6', '--bb-pill-hover-border': '#000000', '--bb-pill-hover-text': '#000000', '--bb-pill-active-bg': '#000000', '--bb-pill-active-text': '#ffffff',
    '--bb-mode-group-bg': '#e8e8ee', '--bb-mode-active-bg': '#000000', '--bb-mode-active-text': '#ffffff', '--bb-mode-hover-text': '#333333',
    '--bb-menu-bg': 'rgba(255,255,255,0.95)', '--bb-menu-border': '#d1d1d6', '--bb-menu-shadow': '0 4px 16px rgba(0,0,0,0.08)',
    '--bb-option-hover-bg': '#e8e8ee', '--bb-option-active-text': '#000000',
    '--bb-plus-bg': '#e8e8ee', '--bb-plus-hover-bg': '#d1d1d6', '--bb-plus-color': '#8e8e93', '--bb-plus-hover-color': '#111111',
    '--bb-send-bg': '#e8e8ee', '--bb-send-hover-bg': '#d1d1d6', '--bb-send-color': '#8e8e93', '--bb-send-hover-color': '#111111',
    '--bb-input-placeholder': '#aeaeb2', '--bb-inner-shadow': '0 2px 12px rgba(0,0,0,0.06)',
    '--chat-bg': '#ffffff', '--chat-input-color': '#111111', '--chat-input-placeholder': '#aeaeb2',
    '--chat-bar-bg': '#ffffff', '--chat-bar-border': '#d1d1d6',
    '--chat-btn-bg': '#e8e8ee', '--chat-btn-hover-bg': '#d1d1d6', '--chat-btn-color': '#8e8e93', '--chat-btn-hover-color': '#111111',
    '--chat-msg-user-bg': '#000000', '--chat-msg-user-text': '#ffffff',
    '--chat-msg-assistant-bg': '#f2f2f7', '--chat-msg-assistant-text': '#111111',
    '--chat-msg-user-time': 'rgba(255,255,255,0.8)', '--chat-msg-assistant-time': '#8e8e93',
    '--tl-bg': 'linear-gradient(180deg, rgba(248,248,250,1) 0%, rgba(240,240,245,1) 100%)',
    '--tl-viz-bg': '#ffffff', '--tl-viz-border': '#d1d1d6', '--tl-clips-bg': '#f5f5f7',
    '--tl-preview-bg': '#ffffff', '--tl-preview-border': '#d1d1d6', '--tl-header-text': '#111111',
    '--tl-meta-text': '#8e8e93', '--tl-meta-hover': '#111111',
    '--tl-toolbar-btn-bg': '#e8e8ee', '--tl-toolbar-btn-hover': '#d1d1d6', '--tl-toolbar-btn-text': '#1d1d1f', '--tl-time-text': '#8e8e93',
    '--cp-bg': 'rgba(255,255,255,0.85)', '--cp-border': '#d1d1d6', '--cp-name-text': '#111111',
    '--cp-time-text': '#8e8e93', '--cp-label-text': '#8e8e93', '--cp-muted-text': '#aeaeb2',
    '--cp-input-bg': '#f8f8fa', '--cp-input-border': '#d1d1d6', '--cp-input-text': '#111111',
    '--cp-section-border': 'rgba(0,0,0,0.05)',
    '--cp-btn-bg': '#e8e8ee', '--cp-btn-text': '#1d1d1f', '--cp-btn-hover-bg': '#d1d1d6',
    '--cp-btn-primary-bg': '#000000', '--cp-btn-primary-text': '#ffffff', '--cp-btn-primary-hover': '#333333',
    '--lib-view-btn-bg': '#e8e8ee', '--lib-view-btn-border': '#d1d1d6', '--lib-view-btn-text': '#8e8e93',
    '--lib-view-btn-hover-bg': '#d1d1d6', '--lib-view-btn-active-bg': '#000000', '--lib-view-btn-active-text': '#ffffff',
    '--story-text': '#111111', '--story-placeholder': 'rgba(0,0,0,0.2)',
    '--story-select-bg': '#ffffff', '--story-select-text': '#111111',
    '--glass-btn-bg': 'rgba(0,0,0,0.03)', '--glass-btn-border': 'rgba(0,0,0,0.08)', '--glass-btn-text': 'rgba(0,0,0,0.6)',
    '--glass-btn-hover-bg': 'rgba(0,0,0,0.06)',
    '--glass-panel-bg': 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,245,248,0.96))',
    '--glass-panel-shadow': '0 2px 12px rgba(0,0,0,0.06)',
    '--dialog-overlay-bg': 'rgba(0,0,0,0.2)', '--dialog-bg': '#ffffff', '--dialog-border': '#d1d1d6',
    '--dialog-shadow': '0 4px 16px rgba(0,0,0,0.1)',
    '--dialog-input-bg': '#f8f8fa', '--dialog-input-border': '#d1d1d6', '--dialog-input-text': '#111111',
    '--divider-color': '#c6c6c8',
    '--toast-success-border': '#22c55e', '--toast-error-border': '#ef4444',
    '--drag-bg': 'rgba(255,255,255,0.9)', '--drag-accent': '#000000', '--drag-text': '#111111', '--danger-hover': '#991b1b', '--drag-muted': '#8e8e93'
  }
};

const THEME_NAMES = ['macOS Dark', 'macOS Light', 'Cyberpunk', 'Nature', 'Ocean', 'Sunset', 'Monochrome', 'Forest', 'Royal', 'Minimal'];
let activeTheme = 'macOS Dark';
let customTheme = null;

function applyTheme(name) {
  const vars = THEMES[name];
  if (!vars) return;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  activeTheme = name;
}

function populateThemeSubmenu() {
  const sub = document.getElementById('theme-submenu');
  if (!sub) return;
  sub.innerHTML = '';
  THEME_NAMES.forEach(t => {
    const active = t === activeTheme;
    const d = document.createElement('div');
    d.className = 'theme-submenu-item';
    d.dataset.theme = t;
    d.innerHTML = `<span class="dot ${active ? 'active' : 'inactive'}"></span> ${t === 'macOS Dark' ? '<i class="fa-solid fa-moon"></i> ' : t === 'macOS Light' ? '<i class="fa-solid fa-sun"></i> ' : ''}${t}`;
    d.addEventListener('click', () => {
      applyTheme(t);
      customTheme = null;
      saveTheme();
      populateThemeSubmenu();
      showToast(`Theme: ${t}`);
    });
    sub.appendChild(d);
  });
  const div = document.createElement('div');
  div.className = 'theme-divider';
  sub.appendChild(div);
  const edit = document.createElement('div');
  edit.className = 'theme-submenu-item';
  edit.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Custom...';
  edit.addEventListener('click', () => {
    openThemeEditor();
  });
  sub.appendChild(edit);
}

async function loadTheme() {
  try {
    const s = await apiGet('/settings');
    if (s.theme && THEMES[s.theme]) {
      applyTheme(s.theme);
      populateThemeSubmenu();
    }
    if (s.customTheme) {
      customTheme = s.customTheme;
      const root = document.documentElement;
      for (const [key, val] of Object.entries(customTheme)) {
        root.style.setProperty(key, val);
      }
    }
  } catch (e) {
    // Use default
  }
}

async function saveTheme() {
  try {
    const s = await apiGet('/settings');
    s.theme = activeTheme;
    if (customTheme) s.customTheme = customTheme;
    await apiPost('/settings', s);
  } catch (e) {
    // Silently fail
  }
}

const TE_CATEGORIES = [
  { name: 'Backgrounds', match: v => v.startsWith('--bg-') },
  { name: 'Text', match: v => v.startsWith('--text-') },
  { name: 'Accents', match: v => /^--(accent|success|warning|danger)/.test(v) },
  { name: 'Glass', match: v => v.startsWith('--glass-') },
  { name: 'Shadows', match: v => v.startsWith('--shadow-') },
  { name: 'Radii', match: v => v.startsWith('--radius-') },
  { name: 'Misc', match: v => /^--(scrollbar|btn-|spinner|playhead|submenu|divider)/.test(v) },
  { name: 'Bottom Bar', match: v => v.startsWith('--bb-') },
  { name: 'Chat', match: v => v.startsWith('--chat-') },
  { name: 'Timeline', match: v => v.startsWith('--tl-') },
  { name: 'Cue Panel', match: v => v.startsWith('--cp-') },
  { name: 'Library', match: v => v.startsWith('--lib-') },
  { name: 'Story Mode', match: v => v.startsWith('--story-') },
  { name: 'Glass Buttons', match: v => v.startsWith('--glass-btn') || v.startsWith('--glass-panel') },
  { name: 'Dialog', match: v => v.startsWith('--dialog-') },
  { name: 'Toast', match: v => v.startsWith('--toast-') },
  { name: 'Drag Overlay', match: v => v.startsWith('--drag-') },
];

function getCurrentThemeVars() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const vars = {};
  for (const key of Object.keys(THEMES['macOS Dark'])) {
    vars[key] = (root.style.getPropertyValue(key) || cs.getPropertyValue(key)).trim();
  }
  return vars;
}

function isHexColor(v) { return /^#[0-9a-fA-F]{3,8}$/.test(v); }

let _teSaveTimer = null;

function openThemeEditor() {
  const existing = document.querySelector('.te-container');
  if (existing) {
    const win = existing.closest('.app-window');
    if (win) { focusWindow(win.id); return; }
  }

  const vars = getCurrentThemeVars();
  const themedVars = JSON.parse(JSON.stringify(vars));

  let html = '<div class="te-container">';
  TE_CATEGORIES.forEach(cat => {
    const catVars = Object.keys(vars).filter(cat.match);
    if (!catVars.length) return;
    html += `<div class="te-category"><div class="te-category-header">${cat.name}</div>`;
    catVars.forEach(k => {
      const v = vars[k];
      const isHex = isHexColor(v);
      html += `<div class="te-row" data-var="${k}">
        <label class="te-label" title="${k}">${k.slice(2)}</label>
        <div class="te-input-wrap">${isHex ? `<input type="color" class="te-color" value="${v}">` : ''}<input type="text" class="te-input" value="${v.replace(/"/g, '&quot;')}"></div>
        <div class="te-preview" style="background:${v}"></div>
        <button class="te-reset" title="Reset to theme default"><i class="fa-solid fa-undo"></i></button>
      </div>`;
    });
    html += '</div>';
  });
  html += '<div class="te-footer"><button class="te-reset-all"><i class="fa-solid fa-undo"></i> Reset All to Theme</button><span class="te-status"></span></div>';
  html += '</div>';

  const wid = createWindow({ title: 'Theme Editor', icon: 'fa-palette', width: 520, height: 600, content: html, stateKey: 'Theme Editor' });

  setTimeout(() => {
    const container = document.querySelector(`#${wid} .te-container`);
    if (!container) return;

    const statusEl = container.querySelector('.te-status');

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg;
      clearTimeout(statusEl._hide);
      statusEl._hide = setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    }

    function triggerSave() {
      clearTimeout(_teSaveTimer);
      _teSaveTimer = setTimeout(() => {
        customTheme = { ...themedVars };
        saveTheme();
        setStatus('Saved');
      }, 500);
    }

    container.addEventListener('input', (e) => {
      const row = e.target.closest('.te-row');
      if (!row) return;
      const key = row.dataset.var;
      const input = row.querySelector('.te-input');
      const preview = row.querySelector('.te-preview');
      const colorInput = row.querySelector('.te-color');
      let val = input.value;
      if (colorInput && e.target === colorInput) {
        val = colorInput.value;
        input.value = val;
      } else if (colorInput && e.target === input && isHexColor(val)) {
        colorInput.value = val;
      }
      document.documentElement.style.setProperty(key, val);
      preview.style.background = val;
      themedVars[key] = val;
      triggerSave();
    });

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.te-reset');
      if (!btn) return;
      const row = btn.closest('.te-row');
      if (!row) return;
      const key = row.dataset.var;
      const defaultValue = THEMES[activeTheme] && THEMES[activeTheme][key];
      if (!defaultValue) return;
      document.documentElement.style.setProperty(key, defaultValue);
      const input = row.querySelector('.te-input');
      const preview = row.querySelector('.te-preview');
      const colorInput = row.querySelector('.te-color');
      input.value = defaultValue;
      preview.style.background = defaultValue;
      if (colorInput && isHexColor(defaultValue)) colorInput.value = defaultValue;
      themedVars[key] = defaultValue;
      triggerSave();
    });

    const resetAllBtn = container.querySelector('.te-reset-all');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        if (!confirm('Reset all variables to the current theme defaults?')) return;
        const defaults = THEMES[activeTheme];
        if (!defaults) return;
        const root = document.documentElement;
        container.querySelectorAll('.te-row').forEach(row => {
          const key = row.dataset.var;
          const dv = defaults[key];
          if (dv === undefined) return;
          root.style.setProperty(key, dv);
          themedVars[key] = dv;
          const input = row.querySelector('.te-input');
          const preview = row.querySelector('.te-preview');
          const colorInput = row.querySelector('.te-color');
          if (input) input.value = dv;
          if (preview) preview.style.background = dv;
          if (colorInput && isHexColor(dv)) colorInput.value = dv;
        });
        triggerSave();
        setStatus('Reset to theme defaults');
      });
    }
  }, 50);
}

// ============================================================
// Detect Tauri
// ============================================================
async function detectTauri() {
  isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

// ============================================================
// Clock
// ============================================================
function updateClock() {
  const el = document.getElementById('menubar-clock');
  if (!el) return;
  const now = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = days[now.getDay()];
  const month = months[now.getMonth()];
  const date = now.getDate();
  let time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  time = time.replace(/am|pm/i, m => m.toUpperCase());
  el.textContent = `${day}, ${month} ${date}  ${time}`;
}
setInterval(updateClock, 10000);
updateClock();

// ============================================================
// Toast notifications
// ============================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 6000);
}

// ============================================================
// API helpers
// ============================================================
async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} ${r.status}`);
  return r.json();
}

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${url} ${r.status}`);
  return r.json();
}

async function apiUpload(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/upload', { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Upload ${r.status}`);
  return r.json();
}

// ============================================================
// Rainbow border effect
// ============================================================
function ensureRainbowBorderStyles() {
  if (document.getElementById('rainbow-generating-border')) return;
  const style = document.createElement('style');
  style.id = 'rainbow-generating-border';
  style.textContent = `
    @property --angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
    @keyframes rainbow-spin { to { --angle: 360deg; } }
    .chat-bar.is-generating,
    .bb-inner.is-generating {
      border: 2px solid transparent;
      background:
        linear-gradient(#fff, #fff) padding-box,
        conic-gradient(from var(--angle),
          #ff0000, #ff7f00, #ffff00, #7fff00, #00ff00,
          #00ff7f, #00ffff, #007fff, #0000ff, #7f00ff,
          #ff00ff, #ff007f, #ff0000) border-box;
      animation: rainbow-spin 1.8s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// Generation Toast Panel
// ============================================================
let _genToastState = { pending: 0, cards: [] };
let _isGenerating = false;
let _genQueue = [];
let _isProcessingQueue = false;

function showGenToastPanel(count) {
  let panel = document.getElementById('gen-toast-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'gen-toast-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = '';
  _genToastState = { pending: count, cards: [] };
  const parts = (bbAr || '3:2').split(':').map(Number);
  const ratio = parts[0] && parts[1] ? parts[0] / parts[1] : 3/2;
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'gen-toast-card';
    card.style.aspectRatio = ratio;
    card.innerHTML = '<div class="spinner"></div><div class="gen-toast-progress"><div class="gen-toast-progress-fill"></div><span class="gen-toast-progress-text"></span></div>';
    panel.appendChild(card);
    _genToastState.cards.push(card);
  }
}

function fillGenToastCard(idx, innerHTML, onDone, delay = 1500) {
  const card = _genToastState.cards[idx];
  if (!card) return;
  card.innerHTML = innerHTML;
  setTimeout(() => {
    if (!card.isConnected) return;
    card.classList.add('slide-out');
    card.addEventListener('animationend', () => {
      card.remove();
      _genToastState.pending--;
      if (onDone) onDone();
      if (_genToastState.pending <= 0) {
        const p = document.getElementById('gen-toast-panel');
        if (p) p.remove();
        if (!_genQueue.length) {
          document.querySelector('.bb-inner')?.classList.remove('is-generating');
        }
      }
    }, { once: true });
  }, 1500);
}

function updateGenToastProgress(index, p) {
  const cards = _genToastState.cards;
  const card = (typeof index === 'number' && cards[index])
    ? cards[index]
    : cards.find(c => c && c.isConnected && c.querySelector('.gen-toast-progress'));
  if (!card) return;
  const fill = card.querySelector('.gen-toast-progress-fill');
  const text = card.querySelector('.gen-toast-progress-text');
  if (p && p.stage === 'upscaling') {
    const wf = Math.max(0, Math.min(100, Number(p.workflow_percent) || 0));
    if (fill) fill.style.width = wf + '%';
    if (text) text.textContent = 'Upscaling 2\u00d7 \u00b7 ' + wf + '%';
    return;
  }
  const wf = Math.max(0, Math.min(100, Number(p.workflow_percent) || 0));
  const node = Math.max(0, Math.min(100, Number(p.node_percent) || 0));
  if (fill) fill.style.width = wf + '%';
  if (text) text.textContent = `Workflow ${wf}% · Node ${node}%`;
}

function startProgressPolling(jobId, onUpdate, options = {}) {
  const stopOnFinished = options.stopOnFinished !== false;
  let stopped = false;
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const p = await apiGet('/comfy/progress/' + encodeURIComponent(jobId));
      if (!stopped && p) onUpdate(p);
      if (p && stopOnFinished && (p.state === 'finished' || p.state === 'error')) { stopped = true; return; }
    } catch (_) {}
    if (!stopped) timer = setTimeout(tick, 500);
  };
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

function autoResizeBbInput() {
  const el = document.getElementById('bb-input');
  if (!el || el.tagName !== 'TEXTAREA') return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  updateAttachmentsBarPosition();
}

function updateAttachmentsBarPosition() {
  const bar = document.getElementById('bb-attachments');
  const bottom = document.getElementById('bottom-bar');
  if (!bar || !bottom) return;
  bar.style.bottom = (20 + (bottom.offsetHeight || 0) + 8) + 'px';
}

async function refreshLibraryScrollPreserved(wid) {
  if (!wid || !windows[wid]) return;
  const scroller = document.getElementById('lib-scroller');
  const savedScroll = scroller ? scroller.scrollTop : 0;
  try {
    const assets = await apiGet('/history');
    _libCache.assets = assets || [];
    _libCache.childrenMap = buildChildrenMap(_libCache.assets);
    renderLibrary(wid);
  } catch (e) {}
  if (scroller) requestAnimationFrame(() => { scroller.scrollTop = savedScroll; });
}

// ============================================================
// Window Manager
// ============================================================
function createWindow(opts) {
  const id = `win-${nextWindowId++}`;
  const { title, icon, width = 600, height = 440, content = '', onClose, fixed = false, stateKey } = opts;

  const vw = window.innerWidth;
  const vh = window.innerHeight - 28 - 100;
  const left = Math.min(Math.max(40 + (Object.keys(windows).length * 24) % 320, 20), vw - width - 20);
  const top = Math.min(Math.max(40 + (Object.keys(windows).length * 24) % 240, 20), vh - height - 20);

  const el = document.createElement('div');
  el.id = id;
  el.className = 'app-window';
  el.style.cssText = `width:${width}px;height:${height}px;left:${left}px;top:${top}px;z-index:${++windowZIndex}`;
  el.dataset.windowId = id;

  el.innerHTML = `
    <div class="window-titlebar draggable" data-win="${id}">
      <span class="window-title">${icon ? `<i class="fa-solid ${icon}"></i>` : ''} ${title}</span>
      <div class="window-controls">
        <button class="window-btn minimize" data-action="minimize" data-win="${id}"></button>
        <button class="window-btn maximize" data-action="maximize" data-win="${id}"></button>
        <button class="window-btn close" data-action="close" data-win="${id}"></button>
      </div>
    </div>
    <div class="window-body">${content}</div>
  `;

  document.getElementById('window-layer').appendChild(el);
  windows[id] = { el, title, onClose, minimized: false, prevSize: null, stateKey };

  // Focus on creation
  focusWindow(id);

  // Restore saved position/size/maximized
  const restoreKey = stateKey || title;
  if (restoreKey && _windowStates[restoreKey]) {
    const s = _windowStates[restoreKey];
    el.style.left = s.left + 'px';
    el.style.top = s.top + 'px';
    el.style.width = s.width + 'px';
    el.style.height = s.height + 'px';
    if (s.maximized) {
      const w = windows[id];
      if (w) {
        w.prevSize = el.style.cssText;
        el.style.cssText = 'left:0;top:0;width:100%;height:100%;z-index:' + (++windowZIndex);
        w.maximized = true;
      }
    }
  }

  // ---- Window controls ----
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const wid = btn.dataset.win;
      if (action === 'close') closeWindow(wid);
      else if (action === 'minimize') minimizeWindow(wid);
      else if (action === 'maximize') maximizeWindow(wid);
    });
  });

  // ---- Drag ----
  const titlebar = el.querySelector('.window-titlebar');
  let dragging = false, dragOffX = 0, dragOffY = 0;
  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window-controls')) return;
    focusWindow(id);
    dragging = true;
    const rect = el.getBoundingClientRect();
    const layer = document.getElementById('window-layer');
    const layerRect = layer.getBoundingClientRect();
    dragOffX = e.clientX - rect.left + layerRect.left;
    dragOffY = e.clientY - rect.top + layerRect.top;
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const wid = Object.keys(windows).find(k => windows[k].el === el);
    if (!wid) return;
    const w = windows[wid];
    if (w.maximized) return;
    el.style.left = Math.max(0, e.clientX - dragOffX) + 'px';
    el.style.top = Math.max(0, e.clientY - dragOffY) + 'px';
  });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; saveWindowState(id); } });

  // ---- Resize handles (skip for fixed windows) ----
  if (!fixed) {
    ['n','s','e','w','ne','nw','se','sw'].forEach(dir => {
      const h = document.createElement('div');
      h.className = `resize-handle handle-${dir}`;
      h.dataset.dir = dir;
      el.appendChild(h);
    });
  }

  let resizing = false, resizeDir = '', resizeStart = {};

  if (!fixed) {
    el.querySelectorAll('.resize-handle').forEach(h => {
      h.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        focusWindow(id);
        resizing = true;
        resizeDir = h.dataset.dir;
        const rect = el.getBoundingClientRect();
        const layer = document.getElementById('window-layer');
        const layerRect = layer.getBoundingClientRect();
        resizeStart = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, l: rect.left - layerRect.left, t: rect.top - layerRect.top };
      });
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const wid = Object.keys(windows).find(k => windows[k].el === el);
    if (!wid) return;
    const w = windows[wid];
    if (w.maximized) return;
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    let newW = resizeStart.w, newH = resizeStart.h, newL = resizeStart.l, newT = resizeStart.t;
    if (resizeDir.includes('e')) newW = Math.max(300, resizeStart.w + dx);
    if (resizeDir.includes('w')) { newW = Math.max(300, resizeStart.w - dx); newL = resizeStart.l + resizeStart.w - newW; }
    if (resizeDir.includes('s')) newH = Math.max(200, resizeStart.h + dy);
    if (resizeDir.includes('n')) { newH = Math.max(200, resizeStart.h - dy); newT = resizeStart.t + resizeStart.h - newH; }
    el.style.width = newW + 'px';
    el.style.height = newH + 'px';
    el.style.left = newL + 'px';
    el.style.top = newT + 'px';
  });

  document.addEventListener('mouseup', () => { if (resizing) { resizing = false; saveWindowState(id); } });

  // ---- Click to focus (don't steal focus from clicked element) ----
  el.addEventListener('mousedown', () => focusWindow(id, false));

  return id;
}

function focusWindow(id, autoFocus = true) {
  const w = windows[id];
  if (!w) return;
  if (w.minimized) {
    w.minimized = false;
    w.el.style.display = 'flex';
  }
  w.el.style.zIndex = ++windowZIndex;
  if (autoFocus) {
    const inp = w.el.querySelector('input');
    if (inp) setTimeout(() => inp.focus(), 50);
  }
}

function saveWindowState(id) {
  const w = windows[id];
  if (!w) return;
  const key = w.stateKey || w.title;
  const rect = w.el.getBoundingClientRect();
  const layer = document.getElementById('window-layer');
  const off = layer ? layer.getBoundingClientRect() : { left: 0, top: 0 };
  const state = { left: rect.left - off.left, top: rect.top - off.top, width: rect.width, height: rect.height, maximized: !!w.maximized };
  _windowStates[key] = state;
  apiPost('/settings', { window_states: { ..._windowStates } }).catch(() => {});
}

function loadWindowStates() {
  return apiGet('/settings').then(s => { _windowStates = s.window_states || {}; }).catch(() => { _windowStates = {}; });
}

function closeWindow(id) {
  saveWindowState(id);
  const w = windows[id];
  if (!w) return;
  if (w.onClose) w.onClose();
  w.el.remove();
  delete windows[id];
}

function minimizeWindow(id) {
  const w = windows[id];
  if (!w) return;
  w.minimized = true;
  w.el.style.display = 'none';
}

function maximizeWindow(id) {
  const w = windows[id];
  if (!w) return;
  if (w.maximized) {
    w.el.style.cssText = w.prevSize || '';
    w.maximized = false;
  } else {
    w.prevSize = w.el.style.cssText;
    w.el.style.cssText = 'left:0;top:0;width:100%;height:100%;z-index:' + (++windowZIndex);
    w.maximized = true;
  }
  saveWindowState(id);
}

// ============================================================
// Desktop icons
// ============================================================
document.addEventListener('click', (e) => {
  const deskIcon = e.target.closest('.desk-icon');
  if (deskIcon) {
    const app = deskIcon.dataset.app;
    launchApp(app);
    return;
  }
});

function launchApp(app) {
  // If window already open, focus it
  const existing = Object.entries(windows).find(([id, w]) => w.title.toLowerCase() === app);
  if (existing) { focusWindow(existing[0]); return; }

  switch (app) {
    case 'generator': openGenerator(); break;
    case 'library': openLibrary(); break;
    case 'musicvideo': openMusicVideo(); break;
    case 'singleframe': openSingleFrame(); break;
  }
}

// ============================================================
// Status checker
// ============================================================
async function checkStatuses() {
  try {
    const [cs, os] = await Promise.all([
      fetch('/comfy/status').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/ollama/status').then(r => r.json()).catch(() => ({ connected: false })),
    ]);
    isComfyConnected = cs.connected;
    isOllamaConnected = os.connected;
  } catch { isComfyConnected = false; isOllamaConnected = false; }

  const comfyEl = document.getElementById('menubar-comfy');
  if (comfyEl) {
    comfyEl.innerHTML = isComfyConnected
      ? '<i class="fa-solid fa-circle status-online"></i> ComfyUI'
      : '<i class="fa-solid fa-circle status-offline"></i> ComfyUI';
    comfyEl.title = isComfyConnected ? 'ComfyUI connected' : 'ComfyUI disconnected';
  }

  const ollamaEl = document.getElementById('menubar-ollama');
  if (ollamaEl) {
    ollamaEl.innerHTML = isOllamaConnected
      ? '<i class="fa-solid fa-circle status-online"></i> Ollama'
      : '<i class="fa-solid fa-circle status-offline"></i> Ollama';
    ollamaEl.title = isOllamaConnected ? 'Ollama connected' : 'Ollama disconnected';
  }
}

// ============================================================
// APP: Generator
// ============================================================
function openGenerator() {
  const content = `
    <h2>Generator</h2>
    <div class="subtitle">Create images and videos</div>
    <div class="options-row" id="gen-modes">
      <button class="opt-btn active" data-mode="image"><i class="fa-solid fa-image"></i> Image</button>
      <button class="opt-btn" data-mode="video"><i class="fa-solid fa-video"></i> Video</button>
    </div>
    <div class="options-row" id="gen-options">
      <button class="opt-btn active" data-res="720p">720p</button>
      <button class="opt-btn" data-res="1080p">1080p</button>
      <button class="opt-btn" data-res="480p">480p</button>
      <span style="color:#666;font-size:11px;margin-left:4px">|</span>
      <button class="opt-btn active" data-ar="3:2">3:2</button>
      <button class="opt-btn" data-ar="16:9">16:9</button>
      <button class="opt-btn" data-ar="1:1">1:1</button>
      <button class="opt-btn" data-ar="9:16">9:16</button>
      <button class="opt-btn" data-ar="2:3">2:3</button>
    </div>
    <div class="prompt-row">
      <input type="text" id="gen-input" placeholder="Describe what you want to create..." autofocus>
      <button id="gen-send"><i class="fa-solid fa-arrow-up"></i></button>
    </div>
    <div id="gen-results" class="image-grid"></div>
  `;
  const wid = createWindow({ title: 'Generator', icon: 'fa-wand-magic-sparkles', width: 720, height: 560, content });

  setTimeout(() => {
    // Mode buttons
    document.querySelectorAll(`#${wid} [data-mode]`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${wid} [data-mode]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateGenOptions(wid, btn.dataset.mode);
      });
    });
    // Resolution / AR buttons
    document.querySelectorAll(`#${wid} .opt-btn[data-res], #${wid} .opt-btn[data-ar]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.res ? 'res' : 'ar';
        document.querySelectorAll(`#${wid} .opt-btn[data-${group}]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    // Send
    document.getElementById('gen-send').addEventListener('click', () => doGenerate(wid));
    document.getElementById('gen-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doGenerate(wid);
    });
  }, 50);
}

function updateGenOptions(wid, mode) {
  // Could show/hide duration buttons for video mode
}

async function doGenerate(wid) {
  const input = document.getElementById('gen-input');
  const prompt = input.value.trim();
  if (!prompt && !isImageMode(wid)) return; // video needs prompt
  if (!prompt && isImageMode(wid)) return;

  const mode = getActiveMode(wid);
  const res = getActiveRes(wid) || '720p';
  const ar = getActiveAR(wid) || '3:2';
  const count = mode === 'video' ? 1 : 4;
  const duration = mode === 'video' ? 6 : null;

  const resultsEl = document.getElementById('gen-results');
  resultsEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'grid-card';
    card.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%"><div class="spinner"></div></div>`;
    resultsEl.appendChild(card);
  }

  try {
    if (mode === 'video') {
      const res = await apiPost('/generate', { prompt, resolution: res, aspect_ratio: ar, mode: 'video', duration });
      if (res.success && res.results) {
        resultsEl.innerHTML = '';
        res.results.forEach(r => {
          if (r.success) {
            resultsEl.innerHTML += `<div class="grid-card"><video src="/videos/${r.local_filename}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video><div class="card-badge">${r.duration || ''}s</div></div>`;
          }
        });
        showToast('Video generated');
      }
    } else {
      const body = { prompt, resolution: res, aspect_ratio: ar, mode: 'image' };
      const r = await fetch('/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let idx = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const ev = JSON.parse(line.substring(6));
          if (ev.type === 'image_ready' && idx < count) {
            const cards = resultsEl.querySelectorAll('.grid-card');
            if (cards[idx]) {
              cards[idx].innerHTML = `<img src="/images/${ev.local_filename}" loading="lazy"><div class="card-badge">${ev.width}x${ev.height}</div>`;
            }
            idx++;
          }
        }
      }
      if (idx > 0) showToast(`${idx} image${idx > 1 ? 's' : ''} generated`);
    }
  } catch (e) {
    showToast('Generation failed: ' + e.message, 'error');
  }
}

function isImageMode(wid) {
  return document.querySelector(`#${wid} [data-mode].active`)?.dataset.mode === 'image';
}

function getActiveMode(wid) {
  return document.querySelector(`#${wid} [data-mode].active`)?.dataset.mode || 'image';
}

function getActiveRes(wid) {
  return document.querySelector(`#${wid} .opt-btn.active[data-res]`)?.dataset.res || '720p';
}

function getActiveAR(wid) {
  return document.querySelector(`#${wid} .opt-btn.active[data-ar]`)?.dataset.ar || '3:2';
}

// ============================================================
// APP: Library
// ============================================================
let libraryDensity = 'full';
let libraryFilters = ['image'];
let libSelectedAssetId = null;
let libResizeObs = null;

async function openLibrary() {
  try {
    const s = await apiGet('/settings');
    libraryDensity = s.library_density === 'compact' ? 'compact' : 'full';
    libraryFilters = Array.isArray(s.library_filters) ? s.library_filters.filter(t => ['image','video','audio','favorite','character','voice'].includes(t)) : [];
    _windowStates = s.window_states || {};
  } catch (e) { libraryDensity = 'full'; libraryFilters = []; }

  const content = `
    <div id="lib-body" style="display:flex;flex-direction:column;height:100%;position:relative">
      <div id="lib-drag-overlay" class="drag-overlay">
        <div class="drag-overlay-content">
          <i class="fa-solid fa-cloud-upload-alt"></i>
          <span>Drop your files here</span>
          <small>Images, Video, Audio</small>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;row-gap:6px;margin-bottom:8px;flex-shrink:0;flex-wrap:wrap">
        <button id="lib-view-full" class="lib-view-btn${libraryDensity === 'full' ? ' active' : ''}" title="Full"><i class="fa-solid fa-th-large"></i></button>
        <button id="lib-view-compact" class="lib-view-btn${libraryDensity === 'compact' ? ' active' : ''}" title="Compact"><i class="fa-solid fa-th"></i></button>
        <span style="width:1px;height:18px;background:#d1d5db;margin:0 4px"></span>
        <button class="lib-filter-btn${libraryFilters.includes('image') ? ' active' : ''}" data-type="image"><i class="fa-solid fa-image"></i> Images</button>
        <button class="lib-filter-btn${libraryFilters.includes('video') ? ' active' : ''}" data-type="video"><i class="fa-solid fa-video"></i> Videos</button>
        <button class="lib-filter-btn${libraryFilters.includes('audio') ? ' active' : ''}" data-type="audio"><i class="fa-solid fa-music"></i> Audio</button>
        <button class="lib-filter-btn${libraryFilters.includes('voice') ? ' active' : ''}" data-type="voice"><i class="fa-solid fa-microphone"></i> Voices</button>
        <button class="lib-filter-btn${libraryFilters.includes('favorite') ? ' active' : ''}" data-type="favorite"><i class="fa-solid fa-star"></i> Favourites</button>
        <button class="lib-filter-btn${libraryFilters.includes('character') ? ' active' : ''}" data-type="character"><i class="fa-solid fa-user"></i> Characters</button>
        <span style="flex:1"></span>
        <span id="lib-count" style="font-size:11px;color:#555"></span>
      </div>
      <div id="lib-scroller" style="flex:1;overflow-y:auto;min-height:0;background:#000">
        <div id="lib-masonry" style="position:relative;width:100%"></div>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Library', icon: 'fa-th-large', width: 900, height: 600, content, stateKey: 'Library' });
  setTimeout(async () => {
    await loadLibrary(wid);
    wireLibControls(wid);
    const scroller = document.getElementById('lib-scroller');
    if (scroller && libResizeObs) libResizeObs.disconnect();
    if (scroller) {
      libResizeObs = new ResizeObserver(() => { applyLibLayout(wid); });
      libResizeObs.observe(scroller);
    }

    // Drag and drop upload
    const dragOverlay = document.getElementById('lib-drag-overlay');
    let dragCounter = 0;
    const winEl = document.getElementById(wid);
    const bodyEl = winEl.querySelector('.window-body');

    bodyEl.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (dragCounter === 1) dragOverlay.classList.add('show');
    });

    bodyEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    bodyEl.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('show'); }
    });

    bodyEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dragOverlay.classList.remove('show');
      const files = e.dataTransfer.files;
      if (files.length === 0) return;
      const file = files[0];
      try {
        const uploadRes = await apiUpload(file);
        if (!uploadRes || uploadRes.error) throw new Error(uploadRes?.error || 'Upload failed');

        const label = file.name.replace(/\.[^/.]+$/, '');
        const name = prompt('Name this upload:', label);
        if (name === null) return;

        await apiPost('/save-generation', {
          prompt: name,
          filename: uploadRes.filename,
          type: uploadRes.type || 'image',
          width: 0, height: 0
        });
        showToast('Uploaded: ' + name, 'success');
        loadLibrary(wid);
      } catch (e) {
        showToast('Upload failed: ' + e.message, 'error');
      }
    });
  }, 50);
}

function getLibColCount(wid) {
  const scroller = document.getElementById('lib-scroller');
  if (!scroller) return libraryDensity === 'compact' ? 6 : 4;
  const w = scroller.clientWidth;
  if (libraryDensity === 'compact') {
    if (w < 500) return 4;
    if (w < 800) return 6;
    return 8;
  } else {
    if (w < 500) return 3;
    if (w < 800) return 4;
    return 5;
  }
}

function buildChildrenMap(assets) {
  const map = new Map();
  assets.forEach(a => {
    const pid = a.parent_id;
    if (pid) {
      if (!map.has(pid)) map.set(pid, { imageChildren: [], videoChildren: [], audioChildren: [] });
      const entry = map.get(pid);
      const isVideo = a.type === 'video' || (a.filename && a.filename.endsWith('.mp4'));
      const isAudio = a.type === 'audio' || (a.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(a.filename));
      if (isAudio) entry.audioChildren.push(a);
      else if (isVideo) entry.videoChildren.push(a);
      else entry.imageChildren.push(a);
    }
  });
  return map;
}

function parseAspectRatio(str) {
  if (!str) return 1.5;
  const parts = str.split(':');
  if (parts.length === 2) {
    const w = parseFloat(parts[0]), h = parseFloat(parts[1]);
    if (w > 0 && h > 0) return w / h;
  }
  return 1.5;
}

async function toggleFavorite(asset, wid) {
  asset.favorite = !asset.favorite;
  try {
    await apiPost('/update-generation', { id: asset.id, favorite: asset.favorite });
    renderLibrary(wid);
  } catch (e) {
    asset.favorite = !asset.favorite;
  }
}

async function toggleCharacter(asset, wid) {
  asset.character = !asset.character;
  try {
    await apiPost('/update-generation', { id: asset.id, character: asset.character });
    renderLibrary(wid);
  } catch (e) {
    asset.character = !asset.character;
  }
}

async function toggleVoice(asset, wid) {
  asset.voice = !asset.voice;
  try {
    await apiPost('/update-generation', { id: asset.id, voice: asset.voice });
    renderLibrary(wid);
  } catch (e) {
    asset.voice = !asset.voice;
  }
}

async function deleteLibraryItem(asset, wid) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await apiPost('/delete-generation', { id: asset.id });
    _libCache.assets = _libCache.assets.filter(a => a.id !== asset.id);
    _libCache.childrenMap = buildChildrenMap(_libCache.assets);
    renderLibrary(wid);
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

function getVariationBadgesHTML(assetId, childrenMap) {
  const entry = childrenMap.get(assetId);
  if (!entry || (!entry.imageChildren.length && !entry.videoChildren.length && !entry.audioChildren.length)) return '';
  let badges = [];
  if (entry.imageChildren.length) {
    badges.push(`<span style="background:rgba(0,0,0,0.75);color:#fff;font-size:9px;padding:1px 4px;border-radius:2px;display:flex;align-items:center;gap:2px;line-height:1.4"><i class="fa-solid fa-images"></i>${entry.imageChildren.length > 1 ? entry.imageChildren.length : ''}</span>`);
  }
  if (entry.videoChildren.length) {
    badges.push(`<span style="background:rgba(0,0,0,0.75);color:#fff;font-size:9px;padding:1px 4px;border-radius:2px;display:flex;align-items:center;gap:2px;line-height:1.4"><i class="fa-solid fa-video"></i>${entry.videoChildren.length > 1 ? entry.videoChildren.length : ''}</span>`);
  }
  if (entry.audioChildren.length) {
    badges.push(`<span style="background:rgba(0,0,0,0.75);color:#fff;font-size:9px;padding:1px 4px;border-radius:2px;display:flex;align-items:center;gap:2px;line-height:1.4"><i class="fa-solid fa-music"></i>${entry.audioChildren.length > 1 ? entry.audioChildren.length : ''}</span>`);
  }
  return `<div style="position:absolute;top:4px;right:4px;display:flex;gap:3px;z-index:2;pointer-events:none">${badges.join('')}</div>`;
}

function applyLibLayout(wid) {
  const masonry = document.getElementById('lib-masonry');
  const scroller = document.getElementById('lib-scroller');
  if (!masonry || !scroller) return;
  const cards = Array.from(masonry.children).filter(el => el.tagName === 'DIV' && el.dataset.assetId);
  if (!cards.length) return;
  const gap = 1;
  const containerWidth = scroller.clientWidth;
  const cols = getLibColCount(wid);
  const colWidth = Math.max(40, Math.floor((containerWidth - (cols - 1) * gap) / cols));
  const columnHeights = new Array(cols).fill(0);
  cards.forEach(card => {
    const ar = parseFloat(card.dataset.aspect) || 1.5;
    const ch = Math.round(colWidth / ar);
    let sc = 0;
    for (let c = 1; c < cols; c++) { if (columnHeights[c] < columnHeights[sc]) sc = c; }
    card.style.left = (sc * (colWidth + gap)) + 'px';
    card.style.top = columnHeights[sc] + 'px';
    card.style.width = colWidth + 'px';
    card.style.height = ch + 'px';
    columnHeights[sc] += ch + gap;
  });
  masonry.style.height = Math.max(...columnHeights) + 'px';
}

let _libCache = { assets: [], childrenMap: new Map() };
let libLazyObserver = null;

let _libScrollData = null;

function initLibLazyLoader(wid) {
  if (libLazyObserver) libLazyObserver.disconnect();
  if (_libScrollData) { _libScrollData.el.removeEventListener('scroll', _libScrollData.fn); _libScrollData = null; }
  const scroller = document.getElementById('lib-scroller');
  if (!scroller) return;

  libLazyObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const img = card.querySelector('img[data-src]');
      if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
      const vid = card.querySelector('video[data-src]');
      if (vid) { vid.src = vid.dataset.src; vid.removeAttribute('data-src'); }
      libLazyObserver.unobserve(card);
    });
  }, { root: scroller, rootMargin: '300px 0px', threshold: 0.01 });
  document.querySelectorAll(`#${wid} .lib-lazy-card`).forEach(card => libLazyObserver.observe(card));

  function playVisibleVideos() {
    if (!autoPlayEnabled) return;
    const sr = scroller.getBoundingClientRect();
    document.querySelectorAll(`#${wid} .lib-lazy-card video`).forEach(vid => {
      const card = vid.closest('.lib-lazy-card');
      if (!card) return;
      const cr = card.getBoundingClientRect();
      const visible = cr.bottom > sr.top && cr.top < sr.bottom;
      if (visible) { if (vid.paused) vid.play().catch(() => {}); }
      else { if (!vid.paused) vid.pause(); }
    });
  }

  _libScrollData = { el: scroller, fn: playVisibleVideos };
  scroller.addEventListener('scroll', playVisibleVideos, { passive: true });
  playVisibleVideos();
}

function buildAudioPlayer(card, url) {
  card.style.background = '#1a1a2e';
  card.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px;padding:6px">
      <i class="fa-solid fa-volume-up" style="font-size:24px;color:#22c55e"></i>
      <div style="width:100%;display:flex;align-items:center;gap:3px">
        <button class="ap-play" style="background:none;border:none;color:#22c55e;cursor:pointer;font-size:11px;padding:1px;line-height:1"><i class="fa-solid fa-play"></i></button>
        <button class="ap-stop" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;padding:1px;line-height:1"><i class="fa-solid fa-stop"></i></button>
        <input type="range" class="ap-seek" style="flex:1;height:3px;accent-color:#22c55e;min-width:0;cursor:pointer" min="0" max="1000" value="0">
        <span class="ap-time" style="font-size:8px;color:#aaa;white-space:nowrap;min-width:28px;text-align:right">0:00</span>
      </div>
    </div>
  `;
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.src = url;
  card.appendChild(audio);
  const playBtn = card.querySelector('.ap-play');
  const stopBtn = card.querySelector('.ap-stop');
  const seek = card.querySelector('.ap-seek');
  const timeEl = card.querySelector('.ap-time');
  playBtn.onclick = (e) => { e.stopPropagation();
    if (audio.paused) { audio.play().catch(() => {}); } else { audio.pause(); }
  };
  stopBtn.onclick = (e) => { e.stopPropagation();
    audio.pause(); audio.currentTime = 0; seek.value = 0;
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    timeEl.textContent = '0:00';
  };
  audio.onplay = () => { playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; };
  audio.onpause = () => { playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; };
  audio.ontimeupdate = () => {
    if (audio.duration) {
      seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
      const m = Math.floor(audio.currentTime / 60);
      const s = Math.floor(audio.currentTime % 60);
      timeEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }
  };
  seek.oninput = (e) => {
    e.stopPropagation();
    if (audio.duration) audio.currentTime = (parseInt(seek.value) / 1000) * audio.duration;
  };
}

function renderLibrary(wid) {
  const masonry = document.getElementById('lib-masonry');
  const scroller = document.getElementById('lib-scroller');
  const countEl = document.getElementById('lib-count');
  if (!masonry) return;

  const activeFilters = [];
  document.querySelectorAll(`#${wid} .lib-filter-btn.active`).forEach(b => activeFilters.push(b.dataset.type));
  const activeTypes = activeFilters.filter(t => t === 'image' || t === 'video' || t === 'audio');
  const wantFavorite = activeFilters.includes('favorite');
  const wantCharacter = activeFilters.includes('character');
  const wantVoice = activeFilters.includes('voice');

  const { assets, childrenMap } = _libCache;

  let filtered = assets;
  if (activeFilters.length) {
    filtered = assets.filter(a => {
      if (activeTypes.length) {
        const isVideo = a.type === 'video' || (a.filename && a.filename.endsWith('.mp4'));
        const isAudio = a.type === 'audio' || (a.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(a.filename));
        const isImage = !isVideo && !isAudio;
        const matchesType = (activeTypes.includes('image') && isImage) ||
                            (activeTypes.includes('video') && isVideo) ||
                            (activeTypes.includes('audio') && isAudio);
        if (!matchesType) return false;
      }
      if (wantFavorite && !a.favorite) return false;
      if (wantCharacter && !a.character) return false;
      if (wantVoice && !a.voice) return false;
      return true;
    });
  }

  filtered.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));

  if (libLazyObserver) libLazyObserver.disconnect();
  masonry.innerHTML = '';
  if (!filtered.length) {
    masonry.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#666;background:#000;gap:8px"><i class="fa-solid fa-image" style="font-size:48px;opacity:0.4"></i><span style="font-size:14px">Nothing to see</span></div>';
    masonry.style.height = '100%';
    if (scroller) scroller.scrollTop = 0;
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = filtered.length + ' item' + (filtered.length !== 1 ? 's' : '');

  const gap = 1;
  const containerWidth = scroller.clientWidth;
  const cols = getLibColCount(wid);
  const colWidth = Math.max(40, Math.floor((containerWidth - (cols - 1) * gap) / cols));
  const columnHeights = new Array(cols).fill(0);

  filtered.forEach(a => {
    const isAudio = a.type === 'audio' || (a.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(a.filename));
    const isVideo = a.type === 'video' || (a.filename && a.filename.endsWith('.mp4'));
    const url = isVideo ? `/videos/${a.filename}` : isAudio ? `/audio/${a.filename}` : `/images/${a.filename}`;
    const ar = (a.width && a.height) ? a.width / a.height : parseAspectRatio(a.aspect_ratio);
    const safeAr = isFinite(ar) && ar > 0 ? ar : 1.5;
    let cardHeight = Math.max(40, Math.round(colWidth / safeAr));
    if (isAudio) cardHeight = Math.max(cardHeight, 80);

    let sc = 0;
    for (let c = 1; c < cols; c++) { if (columnHeights[c] < columnHeights[sc]) sc = c; }

    const card = document.createElement('div');
    card.dataset.assetId = a.id || '';
    card.dataset.aspect = safeAr;
    card.style.cssText = `position:absolute;left:${sc * (colWidth + gap)}px;top:${columnHeights[sc]}px;width:${colWidth}px;height:${cardHeight}px;overflow:hidden;background:#000`;

    if (isAudio) {
      buildAudioPlayer(card, url);
    } else if (isVideo) {
      card.classList.add('lib-lazy-card');
      const ph = document.createElement('div');
      ph.style.cssText = 'width:100%;height:100%;background:#111;position:absolute;inset:0;z-index:0';
      card.appendChild(ph);
      const thumbUrl = `/thumbnails/${a.id}.jpg`;
      if (!autoPlayEnabled) {
        const el = document.createElement('img');
        el.draggable = false;
        el.dataset.src = thumbUrl;
        el.onerror = function() { if (this.src !== url) this.src = url; };
        el.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1';
        card.appendChild(el);
      } else {
        const el = document.createElement('video');
        el.dataset.src = url; el.muted = true; el.loop = true; el.playsinline = true; el.preload = 'metadata';
        el.poster = thumbUrl;
        el.onerror = function() { this.style.display = 'none'; };
        el.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1';
        card.appendChild(el);
      }
    } else {
      card.classList.add('lib-lazy-card');
      const ph = document.createElement('div');
      ph.style.cssText = 'width:100%;height:100%;background:#111;position:absolute;inset:0;z-index:0';
      card.appendChild(ph);
      const el = document.createElement('img');
      el.draggable = false;
      const thumbUrl = `/thumbnails/${a.id}.jpg`;
      el.dataset.src = thumbUrl;
      el.onerror = function() { if (this.src !== url) this.src = url; };
      el.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1';
      card.appendChild(el);
    }

    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      try {
        const safeAr = isFinite(ar) && ar > 0 ? ar : 1.5;
        const payload = JSON.stringify({
          type: isAudio ? 'audio' : (isVideo ? 'video' : 'image'),
          name: a.filename || '',
          src: url,
          aspect: safeAr,
          id: a.id || '',
          prompt: (a.prompt || '').trim(),
          voice: !!a.voice
        });
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copy';
      } catch (_) {}
    });

    const p = (a.prompt || '').trim();
    if (p) {
      const pt = document.createElement('div');
      pt.className = isAudio ? '' : 'lib-prompt-hover';
      pt.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:3px 5px;background:rgba(0,0,0,0.85);color:#ddd;font-size:10px;line-height:1.3;word-break:break-word;z-index:3;pointer-events:none';
      pt.textContent = p;
      card.appendChild(pt);
    }

    const dims = a.width && a.height ? `${a.width}\u00D7${a.height}` : '';
    const dur = a.metadata?.duration ? `${a.metadata.duration}s` : '';
    const badgeText = [dur, dims].filter(Boolean).join(' \u2022 ');
    if (badgeText) {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.8);color:#ddd;font-size:9px;padding:1px 4px;border-radius:2px;pointer-events:none;line-height:1.4;z-index:5';
      badge.textContent = badgeText;
      card.appendChild(badge);
    }

    const bottomLeft = document.createElement('div');
    bottomLeft.style.cssText = 'position:absolute;bottom:2px;left:2px;display:flex;gap:4px;align-items:center;z-index:2';

    if (a.favorite) {
      const star = document.createElement('span');
      star.style.cssText = 'color:#facc15;font-size:11px;cursor:pointer;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))';
      star.innerHTML = '<i class="fa-solid fa-star"></i>';
      star.title = 'Remove from favorites';
      star.onclick = (e) => { e.stopPropagation(); toggleFavorite(a, wid); };
      bottomLeft.appendChild(star);
    }

    if (a.character) {
      const charIcon = document.createElement('span');
      charIcon.style.cssText = 'color:#38bdf8;font-size:11px;cursor:pointer;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))';
      charIcon.innerHTML = '<i class="fa-solid fa-user"></i>';
      charIcon.title = 'Remove character flag';
      charIcon.onclick = (e) => { e.stopPropagation(); toggleCharacter(a, wid); };
      bottomLeft.appendChild(charIcon);
    }

    if (isAudio) {
      const voiceIcon = document.createElement('span');
      voiceIcon.style.cssText = `color:${a.voice ? '#a78bfa' : '#777'};font-size:11px;cursor:pointer;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))`;
      voiceIcon.innerHTML = a.voice ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-regular fa-microphone"></i>';
      voiceIcon.title = a.voice ? 'Remove voice flag' : 'Mark as voice';
      voiceIcon.onclick = (e) => { e.stopPropagation(); toggleVoice(a, wid); };
      bottomLeft.appendChild(voiceIcon);
    }

    const trash = document.createElement('span');
    trash.style.cssText = 'color:#ef4444;font-size:11px;cursor:pointer;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))';
    trash.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    trash.title = 'Delete';
    trash.onclick = (e) => { e.stopPropagation(); deleteLibraryItem(a, wid); };
    bottomLeft.appendChild(trash);

    card.appendChild(bottomLeft);

    const badgesHTML = getVariationBadgesHTML(a.id, childrenMap);
    if (badgesHTML) {
      const tmp = document.createElement('div');
      tmp.innerHTML = badgesHTML;
      card.appendChild(tmp.firstElementChild);
    }

    if (a.id && a.id === libSelectedAssetId) card.classList.add('lib-selected');
    card.onclick = (e) => { if (!e.target.closest('button,span,i,.fa-star,.fa-trash-can,.var-badge')) updatePreviewContent(a, wid); };
    masonry.appendChild(card);
    columnHeights[sc] += cardHeight + gap;
  });

  masonry.style.height = Math.max(...columnHeights) + 'px';
  initLibLazyLoader(wid);
}

function findRelated(asset) {
  const all = _libCache.assets || [];
  if (asset.parent_id) {
    const parent = all.find(a => a.id === asset.parent_id);
    const siblings = all.filter(a => a.parent_id === asset.parent_id && a.id !== asset.id);
    return [parent, ...siblings].filter(Boolean);
  }
  const entry = (_libCache.childrenMap || new Map()).get(asset.id);
  if (!entry) return [];
  return [...(entry.imageChildren || []), ...(entry.videoChildren || []), ...(entry.audioChildren || [])];
}

function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderPreviewInto(asset, libWid, wid) {
  // Same content-building as openPreview
  const isVideo = asset.type === 'video' || (asset.filename && asset.filename.endsWith('.mp4'));
  const isAudio = asset.type === 'audio' || (asset.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(asset.filename));
  const url = isVideo ? `/videos/${asset.filename}` : isAudio ? `/audio/${asset.filename}` : `/images/${asset.filename}`;
  const dims = asset.width && asset.height ? `${asset.width}\u00D7${asset.height}` : '';
  const dur = asset.metadata?.duration ? `${asset.metadata.duration}s` : '';
  const badgeText = [dur, dims].filter(Boolean).join(' \u2022 ');
  const related = findRelated(asset);

  const assetMeta = parseAssetMetadata(asset);
  const upscaleDone = isVideo && !!(assetMeta.gen && assetMeta.gen.upscale && assetMeta.gen.upscale.status === 'done');

  let relatedHTML = '';
  if (related.length) {
    const relatedW = 120;
    const items = related.map(r => {
      const rIsVideo = r.type === 'video' || (r.filename && r.filename.endsWith('.mp4'));
      const rUrl = rIsVideo ? `/videos/${r.filename}` : `/images/${r.filename}`;
      const rDims = r.width && r.height ? `${r.width}\u00D7${r.height}` : '';
      const rDur = r.metadata?.duration ? `${r.metadata.duration}s` : '';
      const rBadge = [rDur, rDims].filter(Boolean).join(' \u2022 ');
      const rAr = (r.width && r.height) ? r.width / r.height : parseAspectRatio(r.aspect_ratio);
      const rH = Math.round(relatedW / rAr);
      return `<div class="pv-related-item" data-rid="${r.id}" style="flex-shrink:0;width:${relatedW}px;height:${rH}px;background:#111;border-radius:4px;overflow:hidden;position:relative;cursor:pointer">
        ${rIsVideo
          ? `<video src="${rUrl}" muted loop playsinline${autoPlayEnabled ? ' autoplay' : ''} preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`
          : `<img src="${rUrl}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
        }
        ${rBadge ? `<div style="position:absolute;bottom:1px;right:1px;background:rgba(0,0,0,0.75);color:#ccc;font-size:8px;padding:0 3px;border-radius:1px;line-height:1.4">${rBadge}</div>` : ''}
        <div style="position:absolute;bottom:1px;left:1px;display:flex;gap:2px;align-items:center">
          ${r.favorite ? '<span style="color:#facc15;font-size:9px;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))"><i class="fa-solid fa-star"></i></span>' : ''}
          <span style="color:#ef4444;font-size:9px;cursor:pointer;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))" class="pv-related-trash" data-rid="${r.id}"><i class="fa-solid fa-trash-can"></i></span>
        </div>
      </div>`;
    }).join('');
    relatedHTML = `
      <div style="display:flex;gap:4px;padding:6px 8px;overflow-x:auto;flex-shrink:0;background:#0a0a0a;border-top:1px solid #222">
        ${items}
      </div>`;
  }

  const content = `
    <div style="display:flex;flex-direction:column;height:100%;background:#000;color:#fff">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:#111;flex-shrink:0;min-height:32px">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          ${asset.metadata?.name ? `<span style="font-size:12px;line-height:1.3;font-weight:600;word-break:break-word">${escHtml(asset.metadata.name)}</span>` : ''}
          <span style="font-size:${asset.metadata?.name ? '11px' : '12px'};line-height:1.3;word-break:break-word${asset.metadata?.name ? ';opacity:0.7' : ''}">${escHtml(asset.prompt || '')}</span>
        </div>
        <button id="pv-dl" title="Download" style="background:none;border:none;color:#888;cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-download"></i></button>
        <button id="pv-fav" title="${asset.favorite ? 'Remove from favorites' : 'Add to favorites'}" style="background:none;border:none;color:${asset.favorite ? '#facc15' : '#555'};cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-star"></i></button>${isAudio ? `
        <button id="pv-voice" title="${asset.voice ? 'Remove voice flag' : 'Mark as voice'}" style="background:none;border:none;color:${asset.voice ? '#a78bfa' : '#555'};cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-microphone"></i></button>` : ''}${(!isVideo && !isAudio) ? `
        <button id="pv-char" title="${asset.character ? 'Remove character flag' : 'Mark as character'}" style="background:none;border:none;color:${asset.character ? '#38bdf8' : '#555'};cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-user"></i></button>` : ''}
        <button id="pv-trash" title="Delete" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-trash-can"></i></button>${(!isVideo && !isAudio) ? `
        <button id="pv-var" title="Generate Variations" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:11px;padding:2px 6px;border:1px solid #60a5fa;border-radius:4px;flex-shrink:0;white-space:nowrap">Variations</button>` : ''}${isVideo ? `
        <button id="pv-upscale" title="${upscaleDone ? 'Already upscaled' : 'RelayVSR 2× upscale'}" ${upscaleDone ? 'disabled' : ''} style="background:none;border:1px solid #f59e0b;color:#f59e0b;cursor:${upscaleDone ? 'default' : 'pointer'};font-size:11px;padding:2px 6px;border-radius:4px;flex-shrink:0;white-space:nowrap;${upscaleDone ? 'opacity:0.5' : ''}">${upscaleDone ? 'Upscaled' : 'Upscale 2×'}</button>` : ''}${!isAudio ? `
        <button id="pv-to-prompt" title="Load prompt into bottom bar" style="background:none;border:none;color:#a855f7;cursor:pointer;font-size:11px;padding:2px 6px;border:1px solid #a855f7;border-radius:4px;flex-shrink:0;white-space:nowrap">To Prompt</button>` : ''}${(!isVideo && !isAudio) ? `
        <button id="pv-vid" title="Create Video from This" style="background:none;border:none;color:#22c55e;cursor:pointer;font-size:11px;padding:2px 6px;border:1px solid #22c55e;border-radius:4px;flex-shrink:0;white-space:nowrap">To Video</button>` : ''}
      </div>
      <div id="pv-stage" style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">
        <button id="pv-prev" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);z-index:20;background:rgba(0,0,0,0.6);border:none;color:#fff;width:32px;height:32px;border-radius:50%;display:none;align-items:center;justify-content:center;cursor:pointer;font-size:14px"><i class="fa-solid fa-chevron-left"></i></button>
        <button id="pv-next" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:20;background:rgba(0,0,0,0.6);border:none;color:#fff;width:32px;height:32px;border-radius:50%;display:none;align-items:center;justify-content:center;cursor:pointer;font-size:14px"><i class="fa-solid fa-chevron-right"></i></button>
        ${isVideo
          ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;position:relative">
              <video id="pv-media" src="${url}" loop playsinline autoplay style="max-width:100%;max-height:calc(100% - 28px);object-fit:contain"></video>
              <div id="pv-controls" style="display:flex;align-items:center;gap:4px;padding:4px 6px;width:calc(100% - 225px);flex-shrink:0;background:rgba(0,0,0,0.75);height:28px;box-sizing:border-box;margin:0 auto">
                <button id="pv-play-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:10px;width:18px;padding:0"><i class="fa-solid fa-pause"></i></button>
                <button id="pv-stop-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:9px;width:16px;padding:0"><i class="fa-solid fa-stop"></i></button>
                <input type="range" id="pv-seek" min="0" max="100" value="0" style="flex:1;height:3px;cursor:pointer;accent-color:#fff;min-width:30px">
                <span id="pv-time" style="font-size:8px;color:#ccc;white-space:nowrap;min-width:42px;text-align:right">0:00 / 0:00</span>
                <input type="range" id="pv-volume" min="0" max="100" value="100" style="width:36px;height:3px;cursor:pointer;accent-color:#fff">
                <button id="pv-mute-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:10px;width:18px;padding:0"><i class="fa-solid fa-volume-xmark"></i></button>
              </div>
             </div>`
          : isAudio
            ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;position:relative;background:#111">
                <i class="fa-solid fa-music" style="font-size:64px;color:#22c55e;opacity:0.6;margin-bottom:12px"></i>
                <audio id="pv-media" src="${url}" preload="metadata" style="display:none"></audio>
                <div id="pv-controls" style="display:flex;align-items:center;gap:8px;padding:6px 12px;width:90%;max-width:400px;background:rgba(255,255,255,0.08);border-radius:24px">
                  <button id="pv-play-btn" style="background:none;border:none;color:#22c55e;cursor:pointer;font-size:14px;width:28px;padding:0;text-align:center"><i class="fa-solid fa-play"></i></button>
                  <button id="pv-stop-btn" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;width:24px;padding:0;text-align:center"><i class="fa-solid fa-stop"></i></button>
                  <input type="range" id="pv-seek" min="0" max="100" value="0" style="flex:1;height:4px;cursor:pointer;accent-color:#22c55e">
                  <span id="pv-time" style="font-size:10px;color:#aaa;white-space:nowrap;min-width:60px;text-align:right">0:00 / 0:00</span>
                </div>
               </div>`
            : `<img id="pv-media" src="${url}" draggable="false" style="max-width:100%;max-height:100%;object-fit:contain;transform-origin:center center;will-change:transform;cursor:zoom-in">`
        }
        <div id="pv-zoom-ind" style="position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,0.7);color:#ccc;font-size:11px;padding:2px 6px;border-radius:3px;display:none;pointer-events:none">100%</div>
        ${badgeText ? `<div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.7);color:#ccc;font-size:11px;padding:2px 6px;border-radius:3px">${badgeText}</div>` : ''}
      </div>
      ${relatedHTML}
    </div>
  `;

  const body = document.querySelector(`#${wid} .window-body`);
  if (!body) return;
  body.innerHTML = content;

  // Wire handlers
  setTimeout(() => {
    let fav = !!asset.favorite;

    document.getElementById('pv-dl').onclick = () => {
      const a = document.createElement('a');
      const extMatch = (asset.filename || '').match(/\.[^.\/]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const niceName = asset.metadata?.name ? sanitizeFilename(asset.metadata.name) : '';
      a.href = url;
      a.download = niceName ? (niceName + ext) : (asset.filename || 'download');
      document.body.appendChild(a); a.click(); a.remove();
    };

    const favBtn = document.getElementById('pv-fav');
    favBtn.onclick = async () => {
      fav = !fav;
      favBtn.style.color = fav ? '#facc15' : '#555';
      favBtn.title = fav ? 'Remove from favorites' : 'Add to favorites';
      asset.favorite = fav;
      const a = _libCache.assets.find(x => x.id === asset.id);
      if (a) a.favorite = fav;
      try { await apiPost('/update-generation', { id: asset.id, favorite: fav }); renderLibrary(libWid); } catch (e) {}
    };

    const voiceBtn = document.getElementById('pv-voice');
    if (voiceBtn) {
      let isVoice = !!asset.voice;
      voiceBtn.onclick = async () => {
        isVoice = !isVoice;
        voiceBtn.style.color = isVoice ? '#a78bfa' : '#555';
        voiceBtn.title = isVoice ? 'Remove voice flag' : 'Mark as voice';
        asset.voice = isVoice;
        const a = _libCache.assets.find(x => x.id === asset.id);
        if (a) a.voice = isVoice;
        try { await apiPost('/update-generation', { id: asset.id, voice: isVoice }); renderLibrary(libWid); } catch (e) {
          isVoice = !isVoice;
          voiceBtn.style.color = isVoice ? '#a78bfa' : '#555';
          voiceBtn.title = isVoice ? 'Remove voice flag' : 'Mark as voice';
          asset.voice = isVoice;
          if (a) a.voice = isVoice;
        }
      };
    }

    const charBtn = document.getElementById('pv-char');
    if (charBtn) {
      let isChar = !!asset.character;
      charBtn.onclick = async () => {
        isChar = !isChar;
        charBtn.style.color = isChar ? '#38bdf8' : '#555';
        charBtn.title = isChar ? 'Remove character flag' : 'Mark as character';
        asset.character = isChar;
        const a = _libCache.assets.find(x => x.id === asset.id);
        if (a) a.character = isChar;
        try { await apiPost('/update-generation', { id: asset.id, character: isChar }); renderLibrary(libWid); } catch (e) {}
      };
    }

    document.getElementById('pv-trash').onclick = async () => {
      if (!confirm('Delete this item? This cannot be undone.')) return;
      try {
        await apiPost('/delete-generation', { id: asset.id });
        _libCache.assets = _libCache.assets.filter(a => a.id !== asset.id);
        _libCache.childrenMap = buildChildrenMap(_libCache.assets);
        renderLibrary(libWid);
        closeWindow(wid);
      } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
    };

    const toPromptBtn = document.getElementById('pv-to-prompt');
    if (toPromptBtn) toPromptBtn.onclick = () => applyGenToBottomBar(asset);

    const upscaleBtn = document.getElementById('pv-upscale');
    if (upscaleBtn) upscaleBtn.onclick = async () => {
      if (_isGenerating || upscaleBtn.disabled) return;
      _isGenerating = true;
      showGenToastPanel(1);
      document.querySelector('.bb-inner')?.classList.add('is-generating');
      const jobId = 'pvup_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const stopProgress = startProgressPolling(jobId, (p) => updateGenToastProgress(0, p));
      try {
        const res = await apiPost('/upscale-video', { asset_id: asset.id, job_id: jobId });
        if (res && res.success) {
          const rr = res.result || {};
          const savedAsset = res.asset || {};
          const filename = rr.local_filename || savedAsset.filename || '';
          const dur = rr.duration || savedAsset.duration || null;
          const badge = dur ? `${dur}s` : '';
          if (filename) {
            const html = `<video src="/videos/${filename}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
            fillGenToastCard(0, html, () => refreshLibraryFromDB());
          }
          await refreshLibraryFromDB();
          showToast('Upscaled video saved to Library');
        } else {
          showToast((res && res.error) || 'Upscale failed — RelayVSR may be unavailable in ComfyUI', 'error');
          cleanupGenToast();
        }
      } catch (e) {
        showToast('Upscale failed: ' + e.message, 'error');
        cleanupGenToast();
      } finally {
        stopProgress();
        _isGenerating = false;
      }
    };

    if (!isVideo && !isAudio) {
      const arStr = asset.aspect_ratio || (asset.width && asset.height ? `${asset.width}:${asset.height}` : bbAr);

      document.getElementById('pv-var').onclick = async () => {
        if (_isGenerating) return;
        _isGenerating = true;
        const count = 4;
        showGenToastPanel(count);
        document.querySelector('.bb-inner')?.classList.add('is-generating');
        const jobId = 'pvvar_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const stopProgress = startProgressPolling(jobId, (p) => updateGenToastProgress(p.index ?? 0, p));
        try {
          const r = await fetch('/generate/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: asset.prompt || '', resolution: bbRes, aspect_ratio: arStr, mode: 'image', source_image: asset.filename, job_id: jobId }),
          });
          const reader = r.body.getReader();
          const decoder = new TextDecoder();
          let buf = '', idx = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const ev = JSON.parse(line.substring(6));
              if (ev.type === 'image_ready' && idx < count) {
                try {
                  await apiPost('/save-generation', {
                    prompt: asset.prompt || '', filename: ev.local_filename, type: 'image',
                    aspect_ratio: arStr, width: ev.width || 0, height: ev.height || 0, parent_id: asset.id,
                    metadata: {
                      gen: {
                        mode: 'image', resolution: bbRes, aspect_ratio: arStr, duration: null,
                        enhancer_id: 'none', original_prompt: asset.prompt || '',
                        image_model: currentImageModel || 'schnell', i2i_model: currentI2iModel || 'klein',
                        attachments: {
                          images: [{ id: asset.id || '', name: asset.filename || '', type: 'image' }],
                          audio: null, lora: null,
                        },
                      },
                    },
                  });
                } catch (_) {}
                const badge = ev.width && ev.height ? `${ev.width}x${ev.height}` : '';
                const html = `<img src="/images/${ev.local_filename}" loading="lazy">${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
                fillGenToastCard(idx, html, () => refreshLibraryScrollPreserved(libWid));
                idx++;
              }
            }
          }
          if (idx === 0) { showToast('No results', 'error'); cleanupGenToast(); }
        } catch (e) { showToast('Variations failed: ' + e.message, 'error'); cleanupGenToast(); }
        finally { stopProgress(); }
      };

      document.getElementById('pv-vid').onclick = async () => {
        if (_isGenerating) return;
        _isGenerating = true;
        showGenToastPanel(1);
        document.querySelector('.bb-inner')?.classList.add('is-generating');
        const jobId = 'pvvideo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const stopProgress = startProgressPolling(jobId, (p) => updateGenToastProgress(0, p));
        try {
          const res = await apiPost('/generate', { prompt: asset.prompt || '', resolution: bbRes, aspect_ratio: arStr, mode: 'video', duration: bbDuration, source_image: asset.filename, ltx_version: currentLtxVersion, fasth3_mode: currentFastH3Mode || 'reference', job_id: jobId });
          if (res.success && res.results) {
            for (let idx = 0; idx < res.results.length; idx++) {
              const r = res.results[idx];
              if (r.success) {
                try {
                  await apiPost('/save-generation', {
                    prompt: asset.prompt || '', filename: r.local_filename, type: 'video',
                    aspect_ratio: arStr, width: r.width || 0, height: r.height || 0,
                    duration: r.duration || null, parent_id: asset.id,
                    metadata: {
                      gen: {
                        mode: 'video', resolution: bbRes, aspect_ratio: arStr, duration: bbDuration,
                        enhancer_id: 'none', original_prompt: asset.prompt || '',
                        image_model: currentImageModel || 'schnell', i2i_model: currentI2iModel || 'klein',
                        attachments: {
                          images: [{ id: asset.id || '', name: asset.filename || '', type: 'image' }],
                          audio: null, lora: null,
                        },
                      },
                    },
                  });
                } catch (_) {}
                const badge = r.duration ? `${r.duration}s` : '';
                const html = `<video src="/videos/${r.local_filename}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
                fillGenToastCard(idx, html, () => refreshLibraryScrollPreserved(libWid));
              }
            }
          } else { showToast('Video generation failed', 'error'); cleanupGenToast(); }
        } catch (e) { showToast('Failed: ' + e.message, 'error'); cleanupGenToast(); }
        finally { stopProgress(); }
      };
    }

    // Wire video / audio controls
    if (isVideo || isAudio) {
      const el = document.getElementById('pv-media');
      const playBtn = document.getElementById('pv-play-btn');
      const stopBtn = document.getElementById('pv-stop-btn');
      const seek = document.getElementById('pv-seek');
      const timeEl = document.getElementById('pv-time');
      const muteBtn = document.getElementById('pv-mute-btn');
      const volSlider = document.getElementById('pv-volume');
      let isSeeking = false;

      if (el && playBtn) {
        if (isVideo) el.muted = previewMuted;
        if (volSlider) {
          volSlider.value = String(Math.round(previewVolume * 100));
          el.volume = previewVolume;
        }
        if (muteBtn) muteBtn.innerHTML = previewMuted
          ? '<i class="fa-solid fa-volume-xmark"></i>'
          : '<i class="fa-solid fa-volume-high"></i>';
        const fmt = (s) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return m + ':' + (sec < 10 ? '0' : '') + sec; };
        el.addEventListener('timeupdate', () => {
          if (!isSeeking && seek) seek.value = el.duration ? (el.currentTime / el.duration * 100) : 0;
          if (timeEl) timeEl.textContent = fmt(el.currentTime) + ' / ' + fmt(el.duration || 0);
        });
        el.addEventListener('loadedmetadata', () => {
          if (seek) seek.max = 100;
          if (timeEl) timeEl.textContent = fmt(0) + ' / ' + fmt(el.duration || 0);
        });

        playBtn.onclick = () => {
          if (el.paused) { el.play(); playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; }
          else { el.pause(); playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
        };
        el.addEventListener('play', () => { playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; });
        el.addEventListener('pause', () => { playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; });

        if (stopBtn) stopBtn.onclick = () => { el.pause(); el.currentTime = 0; playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; if (seek) seek.value = 0; if (timeEl) timeEl.textContent = fmt(0) + ' / ' + fmt(el.duration || 0); };

        if (seek) {
          seek.addEventListener('input', () => { isSeeking = true; if (el.duration) el.currentTime = (seek.value / 100) * el.duration; });
          seek.addEventListener('change', () => { isSeeking = false; });
        }

        if (volSlider) volSlider.addEventListener('input', () => {
          previewVolume = parseFloat(volSlider.value) / 100;
          el.volume = previewVolume;
          if (previewVolume > 0 && previewMuted) { previewMuted = false; el.muted = false; if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>'; }
          if (previewVolume === 0 && !previewMuted) { previewMuted = true; el.muted = true; if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>'; }
        });

        if (muteBtn) muteBtn.onclick = () => {
          previewMuted = !previewMuted;
          el.muted = previewMuted;
          muteBtn.innerHTML = previewMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
          if (volSlider && !previewMuted) { el.volume = previewVolume; }
        };
      }
    }

    // Image/video zoom: wheel to cursor, drag to pan, double-click to reset
    if (!isAudio) {
      const stage = document.getElementById('pv-stage');
      const media = document.getElementById('pv-media');
      const ind = document.getElementById('pv-zoom-ind');
      if (stage && media) {
        let scale = 1, tx = 0, ty = 0;
        let dragging = false, dragStartX = 0, dragStartY = 0, startTx = 0, startTy = 0;
        const MIN = 1, MAX = 8;
        const clampScale = (v) => Math.min(MAX, Math.max(MIN, v));
        media.style.transformOrigin = 'center center';
        media.style.willChange = 'transform';
        const apply = () => {
          media.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
          media.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
          if (ind) {
            ind.textContent = Math.round(scale * 100) + '%';
            ind.style.display = scale > 1 ? 'block' : 'none';
          }
        };

        stage.addEventListener('wheel', (e) => {
          if (e.target.closest('#pv-controls, button, input, select')) return;
          e.preventDefault();
          const rect = media.getBoundingClientRect();
          const baseCenterX = rect.left + rect.width / 2 - tx;
          const baseCenterY = rect.top + rect.height / 2 - ty;
          const cx = e.clientX - baseCenterX;
          const cy = e.clientY - baseCenterY;
          const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
          const newScale = clampScale(scale * Math.exp(-delta * 0.0015));
          const factor = newScale / scale;
          tx = cx - (cx - tx) * factor;
          ty = cy - (cy - ty) * factor;
          scale = newScale;
          if (scale <= MIN) { tx = 0; ty = 0; }
          apply();
        }, { passive: false });

        media.addEventListener('dblclick', () => {
          scale = 1; tx = 0; ty = 0;
          apply();
        });

        media.addEventListener('pointerdown', (e) => {
          if (scale <= 1) return;
          e.preventDefault();
          dragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          startTx = tx;
          startTy = ty;
          try { media.setPointerCapture(e.pointerId); } catch (_) {}
          apply();
        });
        media.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          tx = startTx + (e.clientX - dragStartX);
          ty = startTy + (e.clientY - dragStartY);
          apply();
        });
        const endDrag = (e) => {
          if (!dragging) return;
          dragging = false;
          try { media.releasePointerCapture(e.pointerId); } catch (_) {}
          apply();
        };
        media.addEventListener('pointerup', endDrag);
        media.addEventListener('pointercancel', endDrag);

        apply();
      }
    }

    document.querySelectorAll('.pv-related-item').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('.pv-related-trash')) return;
        const rid = el.dataset.rid;
        const rAsset = _libCache.assets.find(a => a.id === rid);
        if (rAsset) updatePreviewContent(rAsset, libWid);
      };
    });

    document.querySelectorAll('.pv-related-trash').forEach(el => {
      el.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this item? This cannot be undone.')) return;
        const rid = el.dataset.rid;
        try {
          await apiPost('/delete-generation', { id: rid });
          _libCache.assets = _libCache.assets.filter(a => a.id !== rid);
          _libCache.childrenMap = buildChildrenMap(_libCache.assets);
          renderLibrary(libWid);
          updatePreviewContent(asset, libWid);
        } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
      };
    });

    // Prev/next arrows
    const allSorted = [...(_libCache.assets || [])].sort((a, b) => {
      return (b.created ? Date.parse(b.created) : 0) - (a.created ? Date.parse(a.created) : 0);
    });
    const curIdx = allSorted.findIndex(a => a.filename === asset.filename);
    const prevBtn = document.getElementById('pv-prev');
    const nextBtn = document.getElementById('pv-next');
    if (prevBtn) {
      prevBtn.style.display = curIdx > 0 ? 'flex' : 'none';
      prevBtn.onclick = () => { if (curIdx > 0) updatePreviewContent(allSorted[curIdx - 1], libWid); };
    }
    if (nextBtn) {
      nextBtn.style.display = curIdx >= 0 && curIdx < allSorted.length - 1 ? 'flex' : 'none';
      nextBtn.onclick = () => { if (curIdx < allSorted.length - 1) updatePreviewContent(allSorted[curIdx + 1], libWid); };
    }
  }, 50);
}

function selectLibraryAsset(assetId, wid) {
  libSelectedAssetId = assetId || null;
  const masonry = document.getElementById('lib-masonry');
  if (!masonry) return;
  masonry.querySelectorAll('.lib-selected').forEach(el => el.classList.remove('lib-selected'));
  if (!assetId) return;
  const card = masonry.querySelector(`[data-asset-id="${CSS.escape(assetId)}"]`);
  if (card) card.classList.add('lib-selected');
}

function updatePreviewContent(asset, libWid) {
  selectLibraryAsset(asset.id, libWid);
  const existing = Object.entries(windows).find(([id, w]) => w.title === 'Preview');
  if (!existing) { openPreview(asset, libWid); return; }
  renderPreviewInto(asset, libWid, existing[0]);
}

function openPreview(asset, libWid) {
  const existing = Object.entries(windows).find(([id, w]) => w.title === 'Preview');
  if (existing) closeWindow(existing[0]);

  const content = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#000"><div class="spinner"></div></div>`;
  const wid = createWindow({ title: 'Preview', icon: 'fa-image', width: 800, height: 700, content, stateKey: 'Preview' });

  // Give the DOM a tick to mount, then render content
  setTimeout(() => renderPreviewInto(asset, libWid, wid), 30);
}

async function loadLibrary(wid) {
  const masonry = document.getElementById('lib-masonry');
  const countEl = document.getElementById('lib-count');
  if (!masonry) return;

  try {
    const assets = await apiGet('/history');
    allAssets = assets || [];
    _libCache.assets = allAssets;
    _libCache.childrenMap = buildChildrenMap(allAssets);
    renderLibrary(wid);
  } catch (e) {
    masonry.innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;background:#000">Failed to load library</div>';
    if (countEl) countEl.textContent = '';
  }
}

function wireLibControls(wid) {
  document.querySelectorAll(`#${wid} .lib-filter-btn`).forEach(btn => {
    btn.onclick = () => {
      btn.classList.toggle('active');
      libraryFilters = [];
      document.querySelectorAll(`#${wid} .lib-filter-btn.active`).forEach(b => libraryFilters.push(b.dataset.type));
      apiPost('/settings', { library_filters: libraryFilters }).catch(() => {});
      renderLibrary(wid);
    };
  });

  const fullBtn = document.getElementById('lib-view-full');
  const compactBtn = document.getElementById('lib-view-compact');
  if (fullBtn && compactBtn) {
    fullBtn.onclick = () => {
      if (libraryDensity === 'full') return;
      libraryDensity = 'full';
      fullBtn.classList.add('active');
      compactBtn.classList.remove('active');
      apiPost('/settings', { library_density: 'full' }).catch(() => {});
      renderLibrary(wid);
    };
    compactBtn.onclick = () => {
      if (libraryDensity === 'compact') return;
      libraryDensity = 'compact';
      compactBtn.classList.add('active');
      fullBtn.classList.remove('active');
      apiPost('/settings', { library_density: 'compact' }).catch(() => {});
      renderLibrary(wid);
    };
  }
}

// ============================================================
// Attachments bar + LoRA picker
// ============================================================
async function showLoraPicker() {
  if (_bbAttachments.some(a => a.type === 'lora')) { showToast('Only one LoRA allowed'); return; }
  try {
    const s = await apiGet('/settings');
    const m = s.image_model || 'schnell';
    if (m === 'grok' || m === 'grok-quality') { showToast('LoRA is not supported with Grok Imagine — switch to Flux Schnell'); return; }
    if (m !== 'schnell') { showToast('LoRA requires Flux Schnell model — change in Models > Image Generation'); return; }
  } catch (_) {} // proceed if settings unavailable
  let loras = [];
  try {
    const res = await fetch('/loras');
    const d = await res.json();
    loras = Array.isArray(d.loras) ? d.loras : [];
  } catch (e) { showToast('Failed to load LoRAs', 'error'); return; }
  if (!loras.length) { showToast('No LoRAs available', 'error'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'bb-lora-overlay';
  overlay.innerHTML = `
    <div class="bb-lora-dialog">
      <h3>Select LoRA</h3>
      <div class="bb-lora-list">${loras.map((l, i) =>
        `<div class="bb-lora-item" data-idx="${i}"><i class="fa-solid fa-layer-group"></i><span>${l}</span></div>`
      ).join('')}</div>
      <div class="bb-lora-footer">
        <button class="bb-lora-cancel">Cancel</button>
        <button class="bb-lora-select">Select</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let selectedIdx = -1;
  const items = overlay.querySelectorAll('.bb-lora-item');
  items.forEach(el => el.addEventListener('click', () => {
    items.forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    selectedIdx = parseInt(el.dataset.idx);
  }));

  overlay.querySelector('.bb-lora-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.bb-lora-select').addEventListener('click', () => {
    if (selectedIdx < 0) { showToast('Select a LoRA first'); return; }
    _bbAttachments.push({ type: 'lora', name: loras[selectedIdx] });
    overlay.remove();
    renderAttachments();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function renderAttachments() {
  const bar = document.getElementById('bb-attachments');
  if (!bar) return;
  bar.innerHTML = '';
  if (!_bbAttachments.length) {
    bar.style.display = 'none';
    updatePromptModelBadge();
    return;
  }
  // Force visible (CSS default is display:none)
  bar.style.setProperty('display', 'flex', 'important');
  let imgNum = 0;
  let audNum = 0;
  _bbAttachments.forEach((att, i) => {
    const el = document.createElement('div');
    el.className = 'bb-att';
    let badge = '';
    if (att.type === 'image' || att.type === 'video') {
      imgNum++;
      badge = '<span class="bb-att-num">Img ' + imgNum + '</span>';
    } else if (att.type === 'audio') {
      audNum++;
      badge = '<span class="bb-att-num">Audio ' + audNum + '</span>';
    } else if (att.type === 'voice') {
      badge = '<span class="bb-att-num">Voice</span>';
    }
    if (att.type === 'lora') {
      el.innerHTML = '<i class="fa-solid fa-layer-group" style="font-size:13px;color:#6366f1"></i><span class="bb-att-name">' + escHtml(att.name) + '</span>';
    } else if (att.type === 'image' || att.type === 'video') {
      const safeAspect = att.aspect && isFinite(att.aspect) ? att.aspect : 1.5;
      el.innerHTML = badge + '<img src="' + att.src + '" class="bb-att-img" style="aspect-ratio:' + safeAspect + '">';
    } else if (att.type === 'audio') {
      const label = att.prompt || att.name;
      el.innerHTML = badge + '<i class="fa-solid fa-music" style="font-size:13px;color:#8b5cf6"></i><span class="bb-att-name">' + escHtml(label) + '</span>';
    } else if (att.type === 'voice') {
      const label = att.prompt || att.name;
      el.innerHTML = badge + '<i class="fa-solid fa-microphone-lines" style="font-size:13px;color:#a78bfa"></i><span class="bb-att-name">' + escHtml(label) + '</span>';
    }
    const trash = document.createElement('span');
    trash.className = 'bb-att-trash';
    trash.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    trash.onclick = (e) => { e.stopPropagation(); _bbAttachments.splice(i, 1); renderAttachments(); };
    el.appendChild(trash);
    bar.appendChild(el);
  });
  updatePromptModelBadge();
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function updatePromptHelpVisibility() {
  const btn = document.getElementById('bb-prompt-help');
  if (bbMode === 'speech') {
    if (btn) btn.style.display = 'none';
    const ov = document.getElementById('bb-help-overlay');
    if (ov) ov.remove();
    updateAutoPromptUI();
    return;
  }
  const isFastH3 = currentVideoModel === 'fasth3';
  if (btn) btn.style.display = isFastH3 ? '' : 'none';
  if (!isFastH3) {
    const ov = document.getElementById('bb-help-overlay');
    if (ov) ov.remove();
  }
  updateAutoPromptUI();
}

function showPromptHelp() {
  const existing = document.getElementById('bb-help-overlay');
  if (existing) { existing.remove(); return; }
  const ov = document.createElement('div');
  ov.id = 'bb-help-overlay';
  ov.className = 'bb-help-overlay';
  ov.innerHTML = `
    <div class="bb-help-modal">
      <div class="bb-help-head">
        <span><i class="fa-solid fa-circle-question"></i> How to write the prompt</span>
        <button id="bb-help-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="bb-help-body">
        <p><b>Attachments are numbered in the order you add them:</b></p>
        <ul>
          <li>Images (up to 6) → <code>&lt;Picture 1&gt;</code> … <code>&lt;Picture 6&gt;</code></li>
          <li>Audio (up to 3) → <code>&lt;Audio 1&gt;</code> … <code>&lt;Audio 3&gt;</code></li>
        </ul>
        <p><b>Each character (FastH3 multi-reference):</b></p>
        <ul>
          <li><code>&lt;Subject 1&gt;</code> comes from <code>&lt;Picture 1&gt;</code></li>
          <li><code>&lt;Audio 1&gt;</code> is the voice for <code>&lt;Subject 1&gt; (S1)</code></li>
          <li>…and so on for 2–6 (only 1–3 can have a voice reference).</li>
        </ul>
        <p><b>Dialogue</b> — write lines inline or on separate lines using <code>S1:</code> … <code>S6:</code>:</p>
        <pre>S1: Hello there. S2: Hi, how are you?</pre>
        <p>They are converted to <code>&lt;d&gt;[English] …&lt;/d&gt;</code> automatically.</p>
        <p><b>Example prompt:</b></p>
        <pre>A rainy café at night. S1: Hello there. S2: Hi, how are you?</pre>
        <p class="bb-help-note">Tip: if your prompt already contains a <code>subject_definitions:</code> section, it is used verbatim.</p>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  document.getElementById('bb-help-close').onclick = () => ov.remove();
}

// ============================================================
// APP: Servers
// ============================================================
function parseHostPort(url, defHost, defPort) {
  try {
    if (!url) return { host: defHost, port: defPort };
    let u = url;
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    const parsed = new URL(u);
    const h = parsed.hostname || defHost;
    const p = parsed.port || (parsed.protocol === 'https:' ? '443' : defPort);
    return { host: h, port: String(p) };
  } catch (e) {
    return { host: defHost, port: defPort };
  }
}
function composeUrl(host, port, defPort) {
  const h = (host || '').trim() || '127.0.0.1';
  const p = (port || '').trim() || defPort;
  return 'http://' + h + ':' + p;
}

async function openServers() {
  const content = `<div id="servers-body">Loading...</div>`;
  const wid = createWindow({ title: 'Servers', icon: 'fa-server', width: 700, height: 470, content, fixed: true });
  setTimeout(() => {
    const el = document.getElementById(wid);
    if (el) el.querySelector('.window-body').style.background = '#fff';
    loadServers(wid);
  }, 50);
}

async function loadServers(wid) {
  const body = document.getElementById('servers-body');
  if (!body) return;
  try {
    const s = await apiGet('/settings');
    const cs = isComfyConnected
      ? '<span style="color:#22c55e"><i class="fa-solid fa-circle" style="font-size:7px"></i> Connected</span>'
      : '<span style="color:#ef4444"><i class="fa-solid fa-circle" style="font-size:7px"></i> Disconnected</span>';
    const os = isOllamaConnected
      ? '<span style="color:#22c55e"><i class="fa-solid fa-circle" style="font-size:7px"></i> Connected</span>'
      : '<span style="color:#ef4444"><i class="fa-solid fa-circle" style="font-size:7px"></i> Disconnected</span>';

    const c = parseHostPort(s.comfyui_url, '127.0.0.1', '8188');
    const o = parseHostPort(s.ollama_url, '127.0.0.1', '11434');

    body.innerHTML = `
      <div class="servers-grid">
        <div class="servers-panel">
          <div class="servers-panel-header"><i class="fa-solid fa-cube" style="color:#d97706"></i> ComfyUI</div>
          <div class="server-field"><label>Host</label><input type="text" id="s-comfy-host" value="${c.host}" placeholder="127.0.0.1"></div>
          <div class="server-field"><label>Port</label><input type="text" id="s-comfy-port" value="${c.port}" placeholder="8188"></div>
          <div class="server-field"><label>Status</label><span class="server-status">${cs}</span></div>
          <div class="server-field"><label>Gen timeout (s)</label><input type="number" id="s-timeout" value="${s.failed_gen_clear_seconds || 600}"></div>
        </div>
        <div class="servers-panel">
          <div class="servers-panel-header"><i class="fa-solid fa-brain" style="color:#7c3aed"></i> Ollama</div>
          <div class="server-field"><label>Host</label><input type="text" id="s-ollama-host" value="${o.host}" placeholder="127.0.0.1"></div>
          <div class="server-field"><label>Port</label><input type="text" id="s-ollama-port" value="${o.port}" placeholder="11434"></div>
          <div class="server-field"><label>Status</label><span class="server-status">${os}</span></div>
          <div class="server-field"><label>Timeout (s)</label><input type="number" id="s-ollama-timeout" value="${s.ollama_timeout || 180}"></div>
          <div class="server-field">
            <label>Model <button id="s-ollama-refresh" class="server-refresh-btn" title="Refresh models"><i class="fa-solid fa-rotate"></i></button></label>
            <select id="s-ollama-model">
              <option value="${s.ollama_model || ''}">${s.ollama_model || 'Loading...'}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="servers-footer">
        <button id="servers-save" class="server-save-btn">Save</button>
      </div>
    `;

    // Populate models
    await populateOllamaModelSelect(s.ollama_model);

    // Refresh models button
    const refreshBtn = document.getElementById('s-ollama-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await populateOllamaModelSelect(s.ollama_model, true);
        setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
      });
    }

    // Save
    document.getElementById('servers-save').onclick = async () => {
      const updates = {
        comfyui_url: composeUrl(document.getElementById('s-comfy-host').value, document.getElementById('s-comfy-port').value, '8188'),
        ollama_url: composeUrl(document.getElementById('s-ollama-host').value, document.getElementById('s-ollama-port').value, '11434'),
        ollama_model: document.getElementById('s-ollama-model').value,
        ollama_timeout: parseInt(document.getElementById('s-ollama-timeout').value) || 180,
        failed_gen_clear_seconds: parseInt(document.getElementById('s-timeout').value) || 600,
      };
      try {
        await apiPost('/settings', updates);
        showToast('Settings saved');
        checkStatuses();
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    };
  } catch (e) {
    body.innerHTML = '<div style="color:#f87171">Failed to load settings</div>';
  }
}

async function populateOllamaModelSelect(currentModel, refresh = false) {
  const sel = document.getElementById('s-ollama-model');
  if (!sel) return;
  try {
    const r = await fetch('/ollama/models' + (refresh ? '?refresh=true' : ''));
    if (r.ok) {
      const d = await r.json();
      const models = Array.isArray(d.models) ? d.models : [];
      sel.innerHTML = '';
      if (models.length) {
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          if (m === currentModel) opt.selected = true;
          sel.appendChild(opt);
        });
        if (currentModel && !models.includes(currentModel)) {
          const opt = document.createElement('option');
          opt.value = currentModel;
          opt.textContent = currentModel + ' (not in list)';
          opt.selected = true;
          sel.appendChild(opt);
        }
      } else {
        sel.innerHTML = '<option value="' + currentModel + '">' + (currentModel || 'No models found') + '</option>';
      }
    } else {
      sel.innerHTML = '<option value="' + currentModel + '">' + (currentModel || 'Error loading') + '</option>';
    }
  } catch (e) {
    sel.innerHTML = '<option value="' + currentModel + '">' + (currentModel || 'Error loading') + '</option>';
  }
}

// ============================================================
// APP: ComfyUI Status
// ============================================================
async function openComfyUI() {
  const content = `
    <h2>ComfyUI Status</h2>
    <div class="subtitle">Monitor your ComfyUI backend</div>
    <div id="comfy-body">Loading...</div>
  `;
  const wid = createWindow({ title: 'ComfyUI', icon: 'fa-cube', width: 480, height: 360, content });
  setTimeout(() => loadComfyStatus(wid), 50);
}

async function loadComfyStatus(wid) {
  const body = document.getElementById('comfy-body');
  if (!body) return;
  try {
    const status = await apiGet('/comfy/status');
    body.innerHTML = `
      <div class="settings-row"><label>Status</label>${status.connected ? '<span style="color:#22c55e"><i class="fa-solid fa-circle"></i> Connected</span>' : '<span style="color:#ef4444"><i class="fa-solid fa-circle"></i> Disconnected</span>'}</div>
      <div class="settings-row"><label>URL</label><span style="color:#a0a0c0;font-size:12px">${status.url || 'N/A'}</span></div>
      <div style="margin-top:16px;display:flex;gap:8px">
        <button id="comfy-models" style="padding:8px 24px;border-radius:8px;border:1px solid #3a3a5a;background:transparent;color:#a0a0c0;cursor:pointer;font-size:12px">Check Models</button>
        <button id="comfy-refresh" style="padding:8px 24px;border-radius:8px;border:1px solid #3a3a5a;background:transparent;color:#a0a0c0;cursor:pointer;font-size:12px"><i class="fa-solid fa-rotate"></i> Refresh</button>
      </div>
      <div id="comfy-models-list" style="margin-top:12px;font-size:12px;color:#888"></div>
    `;
    document.getElementById('comfy-models').onclick = async () => {
      const ml = document.getElementById('comfy-models-list');
      ml.innerHTML = 'Loading...';
      try {
        const m = await apiGet('/comfy/models');
        ml.innerHTML = `Checkpoints: ${(m.checkpoints || []).length} · LoRAs: ${(m.loras || []).length} · VAEs: ${(m.vaes || []).length} · CLIPs: ${(m.clips || []).length}`;
      } catch (e) { ml.innerHTML = 'Failed to load models'; }
    };
    document.getElementById('comfy-refresh').onclick = () => { checkStatuses(); loadComfyStatus(wid); };
  } catch (e) {
    body.innerHTML = '<div style="color:#f87171">Failed to get status</div>';
  }
}

// ============================================================
// Bottom bar state
// ============================================================
let bbMode = 'image';
let currentSpeechEngine = 'qwen3';
let speechEngines = [];
let speechWizardWinId = null;
let bbRes = '720p';
let bbAr = '3:2';
let bbDuration = 6;
let bbUpscale = false;
let bbEnhancer = 'none';
let bbEnhancersList = [];
let autoPlayEnabled = false;
let previewMuted = true;
let previewVolume = 1;
let _bbAttachments = []; // {type:'lora'|'image'|'audio', name, src?, aspect?, id?}
let bbTabs = [];
let activeTabId = null;
let bbTabCounter = 0;
let h3WizardWinId = null;

function defaultSpeechConfig() {
  return { engine: (currentSpeechEngine || 'qwen3'), language: 'English', emotion: 'neutral', instruction: '', seed: 0, ref_text: '' };
}

function getSpeechConfig() {
  const tab = getActiveBbTab();
  if (!tab) return defaultSpeechConfig();
  if (!tab.speech) tab.speech = defaultSpeechConfig();
  if (!tab.speech.engine) tab.speech.engine = (currentSpeechEngine || 'qwen3');
  return tab.speech;
}

async function loadTtsEngines() {
  try {
    const r = await apiGet('/tts/engines');
    speechEngines = r.engines || [];
    const validCurrent = currentSpeechEngine && speechEngines.some(e => e.id === currentSpeechEngine);
    if (!validCurrent) {
      const firstInstalled = speechEngines.find(e => e.installed !== false);
      const chosen = firstInstalled || speechEngines[0];
      if (chosen) currentSpeechEngine = chosen.id || 'qwen3';
    }
  } catch (_) {
    speechEngines = [{ id:'qwen3', label:'Qwen3-TTS', default_language:'English', languages:['English','Chinese','Japanese','Korean','German','French','Russian','Portuguese','Spanish','Italian'], controls:{emotion:false,whisper:false,instruction:false,ref_text:true,seed:true,speed:false} }];
  }
}

const H3_PROMPT_PRESETS = [
  { id: 'none', name: 'None', scene: '', hasSpeech: false },
  { id: 'selfie', name: 'Selfie — talking to camera', scene: 'A selfie-style close-up: the subject holds the camera at arm\'s length and talks directly to the lens. Natural lighting, shallow depth of field.', hasSpeech: true },
  { id: 'selfie_walking', name: 'Selfie — walking', scene: 'A selfie-style walking shot: the subject holds the camera at arm\'s length while walking forward and talking to the lens. Slight handheld motion.', hasSpeech: true },
  { id: 'selfie_car', name: 'Selfie — in a car', scene: 'A selfie-style shot inside a car: the subject sits in the driver\'s seat, holds the camera at arm\'s length, and talks to the lens. Daylight through the windows.', hasSpeech: true },
  { id: 'selfie_outdoor', name: 'Selfie — outdoors', scene: 'A selfie-style outdoor shot: the subject holds the camera at arm\'s length, talking to the lens, with a natural landscape behind.', hasSpeech: true },
  { id: 'selfie_night', name: 'Selfie — night', scene: 'A selfie-style night shot: the subject holds the camera at arm\'s length, talking to the lens, with city lights bokeh behind.', hasSpeech: true },
  { id: 'selfie_group', name: 'Group selfie', scene: 'A group selfie: several subjects crowd the frame, talking to the camera, handheld.', hasSpeech: true },
  { id: 'performance', name: 'Music performance', scene: 'A cinematic music-video performance: the subject performs to camera in a dramatic setting.', hasSpeech: false },
  { id: 'portrait', name: 'Cinematic portrait', scene: 'A cinematic portrait: the subject looks at the camera, shallow depth of field, dramatic lighting.', hasSpeech: false },
  { id: 'product', name: 'Product showcase', scene: 'A clean product showcase: the subject presents the product to the camera in a well-lit studio.', hasSpeech: false },
];

let ltxWizardWinId = null;

const LTX_PROMPT_PRESETS = [
  { id: 'none', name: 'None', fields: {} },
  { id: 'selfie', name: 'Selfie — talking to camera', fields: { shotType: 'selfie close-up', action: 'talks directly to the camera', camera: 'is handheld', lighting: 'natural light', style: 'cinematic', hasSpeech: true, audioType: 'speech' } },
  { id: 'selfie_walking', name: 'Selfie — walking', fields: { shotType: 'selfie medium shot', action: 'walks forward while talking to the camera', camera: 'is handheld and tracking', lighting: 'natural light', style: 'cinematic', hasSpeech: true, audioType: 'speech' } },
  { id: 'selfie_car', name: 'Selfie — in a car', fields: { shotType: 'selfie close-up', action: 'talks to the camera while driving', setting: 'inside a car', camera: 'is handheld', lighting: 'daylight through the windows', style: 'cinematic', hasSpeech: true, audioType: 'speech' } },
  { id: 'cinematic_portrait', name: 'Cinematic portrait', fields: { shotType: 'close-up', action: 'looks toward the camera', camera: 'slowly dollies in', lighting: 'dramatic side light', style: 'cinematic film', hasSpeech: false } },
  { id: 'performance', name: 'Music performance', fields: { shotType: 'medium shot', action: 'performs to the camera', camera: 'slowly orbits the subject', lighting: 'stage lights', style: 'music video', hasSpeech: false, audioType: 'music' } },
  { id: 'product', name: 'Product showcase', fields: { shotType: 'close-up', action: 'presents the product to the camera', camera: 'slowly pans across the product', lighting: 'soft studio light', style: 'commercial', hasSpeech: false } },
  { id: 'golden_hour', name: 'Golden hour', fields: { shotType: 'wide shot', action: 'stands in the scene', camera: 'is static', lighting: 'golden hour', style: 'cinematic' } },
  { id: 'neon_night', name: 'Neon night', fields: { shotType: 'medium shot', action: 'walks through the scene', camera: 'is handheld', lighting: 'neon city lights', style: 'cinematic' } },
];

function populateEnhanceMenu() {
  const menu = document.getElementById('bb-enhance-menu');
  if (!menu) return;
  menu.innerHTML = '';
  const allOptions = [{ id: 'none', name: 'No enhancement', prompt: '' }, ...bbEnhancersList.filter(e => e && e.id !== 'none')];
  allOptions.forEach(enh => {
    const d = document.createElement('div');
    d.className = 'bb-enhance-option' + (bbEnhancer === enh.id ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = enh.name || enh.id;
    d.appendChild(label);
    if (bbEnhancer === enh.id) {
      const check = document.createElement('i');
      check.className = 'fa-solid fa-check';
      check.style.cssText = 'color:#007aff;font-size:10px';
      d.appendChild(check);
    }
    d.onclick = (e) => { e.stopPropagation();
      bbEnhancer = enh.id;
      document.getElementById('bb-enhance-text').textContent = enh.name || 'No enhancement';
      menu.classList.remove('show');
      populateEnhanceMenu();
    };
    menu.appendChild(d);
  });
}

// Close AR / enhancer dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.bb-ar-wrap')) document.querySelectorAll('.bb-ar-menu').forEach(m => m.classList.remove('show'));
  if (!e.target.closest('.bb-enhance-wrap')) document.querySelectorAll('.bb-enhance-menu').forEach(m => m.classList.remove('show'));
  if (!e.target.closest('.bb-model-wrap')) document.querySelectorAll('.bb-model-menu').forEach(m => m.classList.remove('show'));
});

// ============================================================
// APP: Image Generation Model
// ============================================================
async function openImageGen() {
  const s = await apiGet('/settings');
  const genModel = s.image_model || 'schnell';
  const qwenTurboOn = !!(s.qwen_turbo);
  const content = `
    <div id="img-gen-body">
      <div class="servers-panel" style="max-width:380px">
        <div class="servers-panel-header"><i class="fa-solid fa-bolt" style="color:#d97706"></i> Image Generation Model</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="img-model-btn ${genModel === 'schnell' ? 'active' : ''}" data-model="schnell"><i class="fa-solid fa-bolt"></i> Flux Schnell <span style="font-size:10px;opacity:0.6">(fast)</span></button>
          <button class="img-model-btn ${genModel === 'klein' ? 'active' : ''}" data-model="klein"><i class="fa-solid fa-microchip"></i> Flux 2 Klein</button>
          <button class="img-model-btn ${genModel === 'qwen' ? 'active' : ''}" data-model="qwen"><i class="fa-solid fa-magic"></i> Qwen 2.5 2512</button>
          <button class="img-model-btn ${genModel === 'grok' ? 'active' : ''}" data-model="grok"><i class="fa-solid fa-cloud"></i> Grok Imagine <span style="font-size:10px;opacity:0.6">(cloud)</span></button>
          <button class="img-model-btn ${genModel === 'grok-quality' ? 'active' : ''}" data-model="grok-quality"><i class="fa-solid fa-cloud"></i> Grok Imagine Quality <span style="font-size:10px;opacity:0.6">(cloud)</span></button>
        </div>
        <div style="font-size:10px;color:#888;margin-top:8px;line-height:1.4">Grok models use <code>xai_api_key</code> from Admin → Settings Editor. 480p/720p→1k, 1080p→2k.</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:0 2px">
          <span style="font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.4px">Qwen Turbo (4-step LoRA)</span>
          <label class="toggle-label">
            <input type="checkbox" id="qwen-turbo-toggle" ${qwenTurboOn ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
      <div style="text-align:right;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:12px">
        <button id="img-gen-save" class="server-save-btn">Save</button>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Image Generation', icon: 'fa-wand-magic-sparkles', width: 420, height: 420, content, fixed: true });
  setTimeout(() => {
    const _wb = document.getElementById(wid);
    if (_wb) _wb.querySelector('.window-body').style.background = '#fff';
    document.querySelectorAll(`#${wid} .img-model-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${wid} .img-model-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.getElementById('img-gen-save').onclick = async () => {
      const active = document.querySelector(`#${wid} .img-model-btn.active`);
      if (!active) return;
      const updates = {
        image_model: active.dataset.model,
        qwen_turbo: document.getElementById('qwen-turbo-toggle').checked,
      };
      try {
        await apiPost('/settings', updates);
        currentImageModel = active.dataset.model;
        qwenTurbo = !!updates.qwen_turbo;
        updatePromptModelBadge();
        refreshOpenModelDialogs();
        showToast('Image model saved');
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    };
  }, 50);
}

// ============================================================
// APP: Image Edit Model
// ============================================================
async function openImageEdit() {
  const s = await apiGet('/settings');
  const i2iModel = s.i2i_model || 'klein';
  const content = `
    <div id="img-edit-body">
      <div class="servers-panel" style="max-width:380px">
        <div class="servers-panel-header"><i class="fa-solid fa-pen" style="color:#7c3aed"></i> Image Edit Model</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="img-model-btn ${i2iModel === 'klein' ? 'active' : ''}" data-model="klein"><i class="fa-solid fa-microchip"></i> Flux 2 Klein <span style="font-size:10px;opacity:0.6">(default)</span></button>
          <button class="img-model-btn ${i2iModel === 'flux2' ? 'active' : ''}" data-model="flux2"><i class="fa-solid fa-image"></i> Flux 2</button>
          <button class="img-model-btn ${i2iModel === 'grok' ? 'active' : ''}" data-model="grok"><i class="fa-solid fa-cloud"></i> Grok Imagine <span style="font-size:10px;opacity:0.6">(cloud)</span></button>
          <button class="img-model-btn ${i2iModel === 'grok-quality' ? 'active' : ''}" data-model="grok-quality"><i class="fa-solid fa-cloud"></i> Grok Imagine Quality <span style="font-size:10px;opacity:0.6">(cloud)</span></button>
        </div>
        <div style="font-size:10px;color:#888;margin-top:8px;line-height:1.4">Grok edit uses natural-language prompts + attached image(s). Dual-ref supported. Key: <code>xai_api_key</code> in Settings Editor.</div>
      </div>
      <div style="text-align:right;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:12px">
        <button id="img-edit-save" class="server-save-btn">Save</button>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Image Edit', icon: 'fa-pen', width: 420, height: 340, content, fixed: true });
  setTimeout(() => {
    const _wb = document.getElementById(wid);
    if (_wb) _wb.querySelector('.window-body').style.background = '#fff';
    document.querySelectorAll(`#${wid} .img-model-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${wid} .img-model-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.getElementById('img-edit-save').onclick = async () => {
      const active = document.querySelector(`#${wid} .img-model-btn.active`);
      if (!active) return;
      try {
        await apiPost('/settings', { i2i_model: active.dataset.model });
        currentI2iModel = active.dataset.model;
        updatePromptModelBadge();
        refreshOpenModelDialogs();
        showToast('Edit model saved');
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    };
  }, 50);
}

// ============================================================
// APP: Video Generation Model
// ============================================================
async function openVideoGen() {
  const s = await apiGet('/settings');
  const vidModel = s.video_model || 'ltx';
  const vidVer = (String(s.ltx_version) === '2.5') ? '2.5' : '2.3';
  currentLtxVersion = vidVer;
  const verDisabled = vidModel !== 'ltx';
  const content = `
    <div id="vid-gen-body">
      <div class="servers-panel" style="max-width:380px">
        <div class="servers-panel-header"><i class="fa-solid fa-film" style="color:#0ea5e9"></i> Video Generation Model</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="img-model-btn vid-model-btn ${vidModel === 'ltx' ? 'active' : ''}" data-model="ltx"><i class="fa-solid fa-microchip"></i> LTX Video <span style="font-size:10px;opacity:0.6">(Comfy · default)</span></button>
          <button class="img-model-btn vid-model-btn ${vidModel === 'fasth3' ? 'active' : ''}" data-model="fasth3"><i class="fa-solid fa-bolt"></i> FastH3 <span style="font-size:10px;opacity:0.6">(MiniMax H3 · 8-step)</span></button>
          <button class="img-model-btn vid-model-btn ${vidModel === 'grok' ? 'active' : ''}" data-model="grok"><i class="fa-solid fa-cloud"></i> Grok Imagine <span style="font-size:10px;opacity:0.6">(cloud)</span></button>
        </div>
        <div id="vid-ltx-version-wrap" style="margin-top:12px;${verDisabled ? 'opacity:0.45;pointer-events:none' : ''}">
          <div style="font-size:10px;font-weight:600;color:#555;margin-bottom:6px">LTX Version</div>
          <div style="display:flex;gap:6px">
            <button class="img-model-btn vid-ver-btn ${vidVer === '2.3' ? 'active' : ''}" data-version="2.3" style="justify-content:center">LTX 2.3</button>
            <button class="img-model-btn vid-ver-btn ${vidVer === '2.5' ? 'active' : ''}" data-version="2.5" style="justify-content:center">LTX 2.5</button>
          </div>
        </div>
        <div id="vid-fasth3-mode-wrap" style="margin-top:12px;${vidModel !== 'fasth3' ? 'opacity:0.45;pointer-events:none' : ''}">
          <div style="font-size:10px;font-weight:600;color:#555;margin-bottom:6px">FastH3 Image Mode</div>
          <div style="display:flex;gap:6px">
            <button class="img-model-btn vid-h3-mode-btn ${(s.fasth3_mode || 'reference') !== 'i2v' ? 'active' : ''}" data-mode="reference" style="justify-content:center">Reference (best identity)</button>
            <button class="img-model-btn vid-h3-mode-btn ${s.fasth3_mode === 'i2v' ? 'active' : ''}" data-mode="i2v" style="justify-content:center">First frame (I2V)</button>
          </div>
          <div style="font-size:10px;color:#888;margin-top:4px;line-height:1.4">Reference keeps the character image as a persistent reference (max fidelity). First frame animates it as the opening frame.</div>
        </div>
        <div style="font-size:10px;color:#888;margin-top:8px;line-height:1.4">
          LTX and FastH3 (MiniMax H3) support text→video, image→video and image+audio→video.
          Grok is cloud-only (max 15s, no audio refs). FastH3 max ~15s.
          Key: <code>xai_api_key</code> in Settings Editor.
        </div>
      </div>
      <div style="text-align:right;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:12px">
        <button id="vid-gen-save" class="server-save-btn">Save</button>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Video Generation', icon: 'fa-film', width: 420, height: 520, content, fixed: true });
  setTimeout(() => {
    const _wb = document.getElementById(wid);
    if (_wb) _wb.querySelector('.window-body').style.background = '#fff';

    document.querySelectorAll(`#${wid} .vid-model-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${wid} .vid-model-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const wrap = document.getElementById('vid-ltx-version-wrap');
        if (wrap) {
          const isLtx = btn.dataset.model === 'ltx';
          wrap.style.opacity = isLtx ? '' : '0.45';
          wrap.style.pointerEvents = isLtx ? '' : 'none';
        }
        const h3Wrap = document.getElementById('vid-fasth3-mode-wrap');
        if (h3Wrap) {
          const isH3 = btn.dataset.model === 'fasth3';
          h3Wrap.style.opacity = isH3 ? '' : '0.45';
          h3Wrap.style.pointerEvents = isH3 ? '' : 'none';
        }
      });
    });
    document.querySelectorAll(`#${wid} .vid-ver-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${wid} .vid-ver-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    document.querySelectorAll(`#${wid} .vid-h3-mode-btn`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${wid} .vid-h3-mode-btn`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.getElementById('vid-gen-save').onclick = async () => {
      const activeModel = document.querySelector(`#${wid} .vid-model-btn.active`);
      const activeVer = document.querySelector(`#${wid} .vid-ver-btn.active`);
      if (!activeModel) return;
      const model = activeModel.dataset.model;
      const version = activeVer ? activeVer.dataset.version : (currentLtxVersion || '2.3');
      const activeH3Mode = document.querySelector(`#${wid} .vid-h3-mode-btn.active`);
      const h3Mode = activeH3Mode ? activeH3Mode.dataset.mode : (currentFastH3Mode || 'reference');
      try {
        await apiPost('/settings', { video_model: model, ltx_version: version, fasth3_mode: h3Mode });
        currentVideoModel = model;
        currentLtxVersion = version;
        currentFastH3Mode = h3Mode;
        updatePromptModelBadge();
        updatePromptHelpVisibility();
        refreshOpenModelDialogs();
        // Grok cannot use audio attachments — strip if switching to Grok
        if (currentVideoModel === 'grok') {
          const before = _bbAttachments.length;
          _bbAttachments = _bbAttachments.filter(a => a.type !== 'audio');
          if (_bbAttachments.length !== before) renderAttachments();
        }
        showToast(currentVideoModel === 'grok'
          ? 'Video model saved (Grok)'
          : currentVideoModel === 'fasth3'
            ? 'Video model saved (FastH3)'
            : `Video model saved (LTX ${currentLtxVersion})`);
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    };
  }, 50);
}

// ============================================================
// APP: LoRAs
// ============================================================
async function openLoras() {
  const content = `
    <div id="loras-body" style="min-height:200px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:600;font-size:12px;color:#444"><i class="fa-solid fa-layer-group" style="color:#d97706"></i> LoRAs (Flux Schnell)</div>
        <button id="loras-refresh" class="server-refresh-btn" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:5px;background:#fff;font-size:11px;color:#444;cursor:pointer"><i class="fa-solid fa-rotate"></i> Refresh</button>
      </div>
      <div id="loras-list" style="font-size:11px;color:#333;background:#f2f2f5;border:1px solid #e0e0e6;border-radius:6px;padding:8px;max-height:300px;overflow:auto"></div>
      <div id="loras-count" style="font-size:10px;color:#555;margin-top:4px"></div>
    </div>
  `;
  const wid = createWindow({ title: 'LoRAs', icon: 'fa-layer-group', width: 500, height: 420, content, fixed: true });
  setTimeout(() => {
    const _wb = document.getElementById(wid);
    if (_wb) _wb.querySelector('.window-body').style.background = '#fff';
    loadLoras(wid);
  }, 50);
}

async function loadLoras(wid) {
  const list = document.getElementById('loras-list');
  const count = document.getElementById('loras-count');
  const refreshBtn = document.getElementById('loras-refresh');
  if (!list) return;
  async function fetchLoras(refresh = false) {
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Loading...'; }
    list.innerHTML = '<div style="color:#888">Loading...</div>';
    try {
      const r = await fetch('/loras' + (refresh ? '?refresh=true' : ''));
      const d = await r.json();
      const loras = Array.isArray(d.loras) ? d.loras : [];
      list.innerHTML = '';
      if (loras.length) {
        loras.forEach(l => {
          const row = document.createElement('div');
          row.style.cssText = 'padding:3px 4px;border-bottom:1px solid #e8e8ee;display:flex;align-items:center;gap:6px';
          row.innerHTML = '<i class="fa-solid fa-layer-group" style="color:#aaa;font-size:9px"></i><span>' + l + '</span>';
          list.appendChild(row);
        });
      } else {
        list.innerHTML = '<div style="color:#888;padding:4px">No LoRAs found</div>';
      }
      if (count) count.textContent = loras.length + ' LoRA' + (loras.length !== 1 ? 's' : '');
    } catch (e) {
      list.innerHTML = '<div style="color:#ef4444">Failed to load LoRAs</div>';
    }
    if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh'; }
  }
  if (refreshBtn) refreshBtn.onclick = () => fetchLoras(true);
  fetchLoras(false);
}

// ============================================================
// APP: Workflow Models
// ============================================================
const REQUIRED_WORKFLOW_MODELS = {
  checkpoints: [
    "flux1-schnell-fp8.safetensors",
    "flux-2-klein-base-9b-fp8.safetensors",
    "ltx-2.3-22b-dev-fp8.safetensors",
    "flux2_dev_fp8mixed.safetensors",
    "flux1-schnell.safetensors",
    "qwen_image_2512_fp8_e4m3fn.safetensors",
    "relayvsr_x2_lightx2v_int8_convrot.safetensors"
  ],
  loras: [
    "Flux_2-Turbo-LoRA_comfyui.safetensors",
    "woman1ai.safetensors",
    "ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors",
    "gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors",
    "Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors"
  ],
  vaes: [
    "full_encoder_small_decoder.safetensors",
    "ae.safetensors",
    "qwen_image_vae.safetensors",
    "relayvsr_flash_vae_x2_fp32.safetensors"
  ],
  clips: [
    "mistral_3_small_flux2_bf16.safetensors",
    "qwen_3_8b_fp8mixed.safetensors",
    "t5xxl_fp16.safetensors",
    "clip_l.safetensors",
    "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    "gemma_3_12B_it_fp4_mixed.safetensors"
  ],
  upscalers: [
    "ltx-2.3-spatial-upscaler-x2-1.1.safetensors",
    "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"
  ]
};

function relayVsrCapabilityLabel(cap) {
  if (!cap) return 'Unavailable';
  if (typeof cap === 'string') {
    const s = cap.toLowerCase();
    if (s === 'ready' || s === 'available') return 'Ready';
    if (s.includes('node')) return 'Missing nodes';
    if (s.includes('weight') || s.includes('model')) return 'Missing weights';
    return 'Unavailable';
  }
  const statusRaw = String(cap.status || cap.state || '').toLowerCase();
  if (statusRaw === 'ready' || statusRaw === 'available') return 'Ready';
  if (statusRaw.includes('node')) return 'Missing nodes';
  if (statusRaw.includes('weight') || statusRaw.includes('model')) return 'Missing weights';
  if (statusRaw === 'unavailable' || statusRaw === 'disabled' || statusRaw === 'off') return 'Unavailable';
  const missing = cap.missing || {};
  const missingNodes = cap.missing_nodes || cap.missingNodes || missing.nodes || [];
  const missingModels = cap.missing_models || cap.missingModels || cap.missing_weights || cap.missingWeights || missing.models || missing.weights || [];
  if (Array.isArray(missingNodes) && missingNodes.length) return 'Missing nodes (' + missingNodes.join(', ') + ')';
  if (Array.isArray(missingModels) && missingModels.length) return 'Missing weights (' + missingModels.join(', ') + ')';
  const nodes = cap.nodes || cap.node_status || cap.nodeStatus;
  if (nodes && typeof nodes === 'object' && Object.values(nodes).some(v => v === false || (v && v.available === false))) return 'Missing nodes';
  const models = cap.models || cap.model_status || cap.modelStatus || cap.weights;
  if (models && typeof models === 'object' && Object.values(models).some(v => v === false || (v && v.available === false))) return 'Missing weights';
  if (cap.available === true || cap.ready === true || cap.supported === true || cap.ok === true) return 'Ready';
  if (cap.available === false || cap.ready === false || cap.supported === false || cap.ok === false) {
    if (cap.nodes_ok === false) return 'Missing nodes';
    if (cap.models_ok === false) return 'Missing weights';
    return 'Unavailable';
  }
  const nodesObj = nodes && typeof nodes === 'object';
  const modelsObj = models && typeof models === 'object';
  if (nodesObj && modelsObj) {
    const nodeVals = Object.values(nodes);
    const modelVals = Object.values(models);
    const allPresent = [...nodeVals, ...modelVals].every(v => v === true || (v && v.available !== false));
    if (allPresent) return 'Ready';
    return nodeVals.some(v => v === false) ? 'Missing nodes' : 'Missing weights';
  }
  return 'Unavailable';
}

async function loadWorkflowCapabilities() {
  const el = document.getElementById('wf-models-capabilities');
  if (!el) return;
  el.innerHTML = 'RelayVSR: <span style="color:#888">checking…</span>';
  try {
    const r = await fetch('/comfy/capabilities');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const cap = data.relayvsr || data.relayVsr || data.video_upscale || data.videoUpscale || data.upscale || data;
    const label = relayVsrCapabilityLabel(cap);
    const color = label === 'Ready' ? '#22c55e' : (label === 'Unavailable' ? '#ef4444' : '#f59e0b');
    el.innerHTML = 'RelayVSR: <span style="color:' + color + '">' + escHtml(label) + '</span>';
  } catch (_) {
    el.innerHTML = 'RelayVSR: <span style="color:#ef4444">Unavailable</span>';
  }
}

async function openWorkflowModels() {
  const content = `
    <div id="wf-models-body" style="min-height:200px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:600;font-size:12px;color:#444"><i class="fa-solid fa-cubes" style="color:#2563eb"></i> Workflow Models</div>
        <button id="wf-models-check" class="server-refresh-btn" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:5px;background:#fff;font-size:11px;color:#444;cursor:pointer"><i class="fa-solid fa-sync"></i> Check Models</button>
      </div>
      <div id="wf-models-summary" style="font-size:11px;color:#555;margin-bottom:6px">Click Check to scan ComfyUI</div>
      <div id="wf-models-current" style="font-size:11px;color:#555;margin-bottom:6px"></div>
      <div id="wf-models-capabilities" style="font-size:11px;color:#555;margin-bottom:6px">RelayVSR: <span style="color:#888">checking…</span></div>
      <div id="wf-models-list" style="font-size:11px;background:#f2f2f5;border:1px solid #e0e0e6;border-radius:6px;padding:8px;max-height:320px;overflow:auto"></div>
    </div>
  `;
  const wid = createWindow({ title: 'Workflow Models', icon: 'fa-cubes', width: 560, height: 480, content, fixed: true });
  setTimeout(() => {
    const _wb = document.getElementById(wid);
    if (_wb) _wb.querySelector('.window-body').style.background = '#fff';
    const checkBtn = document.getElementById('wf-models-check');
    const summary = document.getElementById('wf-models-summary');
    const list = document.getElementById('wf-models-list');
    updateWorkflowModelsCurrent();
    loadWorkflowCapabilities();
    if (!checkBtn) return;
    checkBtn.onclick = async () => {
      const orig = checkBtn.innerHTML;
      checkBtn.disabled = true;
      checkBtn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Checking...';
      try {
        const r = await fetch('/comfy/models');
        const data = await r.json();
        const connected = !!data.connected;
        const availableByCat = {
          checkpoints: data.checkpoints || [],
          loras: data.loras || [],
          vaes: data.vaes || data.vae || [],
          clips: data.clips || data.clip || [],
          upscalers: data.upscalers || data.upscale_models || []
        };
        list.innerHTML = '';
        if (!connected) {
          if (summary) summary.textContent = 'Could not connect to ComfyUI';
          list.innerHTML = '<div style="color:#ef4444">ComfyUI unreachable — start the server and try again.</div>';
          return;
        }
        let present = 0, total = 0;
        Object.keys(REQUIRED_WORKFLOW_MODELS).forEach(cat => {
          const models = REQUIRED_WORKFLOW_MODELS[cat] || [];
          if (!models.length) return;
          const hdr = document.createElement('div');
          hdr.style.cssText = 'font-size:10px;font-weight:600;color:#444;margin-top:8px;text-transform:capitalize';
          hdr.textContent = cat;
          list.appendChild(hdr);
          const available = new Set(availableByCat[cat] || []);
          models.forEach(model => {
            total++;
            const isPresent = available.has(model);
            if (isPresent) present++;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:2px 4px';
            row.innerHTML = '<span style="color:#333" title="' + model + '">' + model + '</span><span style="color:' + (isPresent ? '#22c55e' : '#ef4444') + ';font-size:10px;white-space:nowrap;margin-left:8px">' + (isPresent ? '✅ Present' : '❌ Missing') + '</span>';
            list.appendChild(row);
          });
        });
        if (summary) summary.textContent = present + ' of ' + total + ' models present on server';
        try {
          const ttsRes = await fetch('/tts/engines');
          const ttsData = await ttsRes.json();
          const engines = Array.isArray(ttsData.engines) ? ttsData.engines : [];
          const ttsHdr = document.createElement('div');
          ttsHdr.style.cssText = 'font-size:10px;font-weight:600;color:#444;margin-top:12px';
          ttsHdr.textContent = 'TTS Engines';
          list.appendChild(ttsHdr);
          if (!engines.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#888;padding:4px';
            empty.textContent = 'No TTS engines reported';
            list.appendChild(empty);
          }
          engines.forEach(e => {
            const installed = e.installed !== false;
            const controls = e.controls || {};
            const ctrlLabels = [];
            if (controls.emotion) ctrlLabels.push('Emotion');
            if (controls.whisper) ctrlLabels.push('Whisper');
            if (controls.instruction) ctrlLabels.push('Instruction');
            if (controls.ref_text) ctrlLabels.push('Ref transcript');
            if (controls.seed) ctrlLabels.push('Seed');
            const row = document.createElement('div');
            row.style.cssText = 'padding:4px;border-top:1px solid #e5e5ea';
            row.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'
              + '<span style="color:#333;font-weight:600">' + escHtml(e.label || e.id || '') + '</span>'
              + '<span style="font-size:10px;white-space:nowrap;margin-left:8px;color:' + (installed ? '#22c55e' : '#ef4444') + '">'
              + (installed ? '<i class="fa-solid fa-circle-check" style="color:#22c55e"></i> Installed' : '<i class="fa-solid fa-circle-xmark" style="color:#ef4444"></i> Not installed')
              + '</span></div>'
              + '<div style="font-size:10px;color:#666;margin-top:2px">Node pack: ' + escHtml(e.node_pack || '—') + ' | Model: ' + escHtml(e.model || '—') + '</div>'
              + (ctrlLabels.length ? '<div style="font-size:10px;color:#666;margin-top:2px">Controls: ' + ctrlLabels.join(', ') + '</div>' : '');
            list.appendChild(row);
          });
        } catch (_) {
          const err = document.createElement('div');
          err.style.cssText = 'color:#ef4444;margin-top:8px';
          err.textContent = 'Could not read TTS engines';
          list.appendChild(err);
        }
      } catch (e) {
        if (summary) summary.textContent = 'Check failed';
        list.innerHTML = '<div style="color:#ef4444">Failed to query ComfyUI</div>';
      }
      checkBtn.disabled = false;
      checkBtn.innerHTML = orig;
    };
  }, 50);
}

// ============================================================
// APP: Auto Play toggle
// ============================================================
async function toggleAutoPlay() {
  try {
    const s = await apiGet('/settings');
    const current = s.library_video_playback || '1st_frame';
    const newVal = current === 'play_loop' ? '1st_frame' : 'play_loop';
    await apiPost('/settings', { library_video_playback: newVal });
    autoPlayEnabled = newVal === 'play_loop';
    const icon = document.getElementById('menu-autoplay-icon');
    if (icon) icon.style.opacity = autoPlayEnabled ? '1' : '0.3';
    showToast(autoPlayEnabled ? 'Auto Play enabled' : 'Auto Play disabled');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

// ============================================================
// APP: Prompt Enhancers
// ============================================================
async function openPromptEnhancers() {
  const s = await apiGet('/settings');
  const enhancers = s.prompt_enhancers || [];
  const content = `
    <div id="penh-body" style="min-height:200px;display:flex;flex-direction:column;height:100%">
      <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="font-weight:600;font-size:12px;color:#444"><i class="fa-solid fa-wand-magic-sparkles" style="color:#7c3aed"></i> Prompt Enhancers</div>
        <button id="penh-add-btn" class="server-refresh-btn" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:5px;background:#fff;font-size:11px;color:#444;cursor:pointer"><i class="fa-solid fa-plus"></i> Add</button>
      </div>
      <div id="penh-list" style="flex:1;overflow-y:auto;min-height:0"></div>
      <div style="text-align:right;padding-top:10px;border-top:1px solid #e5e7eb;margin-top:10px;flex-shrink:0">
        <button id="penh-save-btn" class="server-save-btn">Save</button>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Prompt Enhancers', icon: 'fa-wand-magic-sparkles', width: 1000, height: 800, content, fixed: true });
  setTimeout(() => {
    const _wb = document.getElementById(wid);
    if (_wb) _wb.querySelector('.window-body').style.background = '#fff';
    renderEnhancers(wid, enhancers);
    document.getElementById('penh-add-btn').onclick = () => {
      enhancers.push({ id: 'custom-' + Date.now().toString(36), name: 'Custom Style', prompt: '' });
      renderEnhancers(wid, enhancers);
    };
    document.getElementById('penh-save-btn').onclick = async () => {
      try {
        await apiPost('/settings', { prompt_enhancers: enhancers });
        showToast('Prompt enhancers saved');
      } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    };
  }, 50);
}

function renderEnhancers(wid, enhancers) {
  const list = document.getElementById('penh-list');
  if (!list) return;
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;gap:6px;font-size:10px;font-weight:600;color:#555;padding:4px 2px 6px;border-bottom:1px solid #e0e0e6;margin-bottom:4px';
  header.innerHTML = '<div style="flex:0 0 140px">Name</div><div style="flex:1">Prompt</div><div style="flex:0 0 20px"></div>';
  list.innerHTML = '';
  list.appendChild(header);
  enhancers.forEach((enh, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;padding:3px 2px';
    const nameInput = document.createElement('input');
    nameInput.style.cssText = 'flex:0 0 140px;background:#f2f2f5;border:1px solid #e0e0e6;border-radius:4px;padding:4px 6px;font-size:11px;color:#333;outline:none';
    nameInput.value = enh.name || '';
    nameInput.onchange = () => { enh.name = nameInput.value.trim() || 'Untitled'; };
    row.appendChild(nameInput);
    const promptTextarea = document.createElement('textarea');
    promptTextarea.style.cssText = 'flex:1;background:#f2f2f5;border:1px solid #e0e0e6;border-radius:4px;padding:4px 6px;font-size:11px;color:#333;resize:vertical;min-height:28px;max-height:120px;outline:none;font-family:inherit';
    promptTextarea.value = enh.prompt || '';
    promptTextarea.onchange = () => { enh.prompt = promptTextarea.value.trim(); };
    row.appendChild(promptTextarea);
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    delBtn.style.cssText = 'flex:0 0 20px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;line-height:1;padding:4px 0';
    delBtn.title = 'Remove';
    delBtn.onclick = () => {
      if (enhancers.length <= 1) return;
      enhancers.splice(i, 1);
      renderEnhancers(wid, enhancers);
    };
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

// ============================================================
// Auto Play state load
// ============================================================
async function loadAutoPlayState() {
  try {
    const s = await apiGet('/settings');
    autoPlayEnabled = s.library_video_playback === 'play_loop';
    const icon = document.getElementById('menu-autoplay-icon');
    if (icon) icon.style.opacity = autoPlayEnabled ? '1' : '0.3';
  } catch (e) {
    // ignore
  }
}

// ============================================================
// Init
// ============================================================
async function init() {
  await detectTauri();
  ensureRainbowBorderStyles();
  await checkStatuses();
  setInterval(checkStatuses, 15000);

  // Bottom bar mode buttons
  document.querySelectorAll('.bb-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      setBottomBarMode(btn.dataset.mode);
    });
  });

  // Bottom bar res buttons
  document.querySelectorAll('.bb-pill[data-res]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bb-pill[data-res]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bbRes = btn.dataset.res;
    });
  });

  // Aspect ratio dropdown toggle
  const arBtn = document.getElementById('bb-ar-btn');
  const arMenu = document.getElementById('bb-ar-menu');
  if (arBtn && arMenu) {
    arBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.bb-enhance-menu, .bb-model-menu').forEach(m => m.classList.remove('show'));
      arMenu.classList.toggle('show');
    });
    arMenu.querySelectorAll('.bb-ar-option').forEach(opt => {
      opt.addEventListener('click', () => {
        arMenu.querySelectorAll('.bb-ar-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        bbAr = opt.dataset.ar;
        const iconHtml = opt.querySelector('i').outerHTML;
        arBtn.innerHTML = `${iconHtml} ${bbAr} <i class="fa-solid fa-chevron-down" style="font-size:8px;margin-left:2px"></i>`;
        arMenu.classList.remove('show');
      });
    });
  }

  // Duration buttons
  document.querySelectorAll('.bb-duration-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bb-duration-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bbDuration = parseInt(btn.dataset.dur) || 6;
    });
  });

  // Load enhancers for dropdown
  try {
    const s = await apiGet('/settings');
    bbEnhancersList = Array.isArray(s.prompt_enhancers) ? s.prompt_enhancers : [];
    currentImageModel = s.image_model || 'schnell';
    currentI2iModel = s.i2i_model || 'klein';
      currentVideoModel = s.video_model || 'ltx';
      currentLtxVersion = String(s.ltx_version) === '2.5' ? '2.5' : '2.3';
      currentFastH3Mode = s.fasth3_mode === 'i2v' ? 'i2v' : 'reference';
      if (typeof s.tts_engine === 'string') currentSpeechEngine = s.tts_engine || currentSpeechEngine || 'qwen3';
      setBottomBarUpscale(s.video_upscale === 'relayvsr_x2');
      updatePromptModelBadge();
      updatePromptHelpVisibility();
    qwenTurbo = s.qwen_turbo || false;
    // Theme
    if (s.theme) {
      activeTheme = s.theme;
      applyTheme(s.theme);
    }
    if (s.customTheme) {
      customTheme = s.customTheme;
    }
  } catch (e) { bbEnhancersList = []; }
  loadTtsEngines();
  populateThemeSubmenu();
  // Load available LoRAs for story mode character editor
  try {
    const lr = await fetch('/loras');
    const ld = await lr.json();
    window._availableLoras = Array.isArray(ld.loras) ? ld.loras : [];
  } catch (e) { window._availableLoras = []; }

  // Enhancement dropdown
  const enhanceBtn = document.getElementById('bb-enhance-btn');
  const enhanceMenu = document.getElementById('bb-enhance-menu');
  if (enhanceBtn && enhanceMenu) {
    enhanceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.bb-ar-menu, .bb-model-menu').forEach(m => m.classList.remove('show'));
      populateEnhanceMenu();
      enhanceMenu.classList.toggle('show');
    });
  }

  // Menu items
  document.querySelectorAll('#menu-system-dropdown .menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = item.dataset.action;
      if (action === 'servers') openServers();
      else if (action === 'autoplay') toggleAutoPlay();
    });
  });
  document.querySelectorAll('#menu-generation-dropdown .menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = item.dataset.action;
      if (action === 'prompt-enhancers') openPromptEnhancers();
    });
  });
  document.querySelectorAll('#menu-models-dropdown .menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = item.dataset.action;
      if (action === 'image-gen') openImageGen();
      else if (action === 'image-edit') openImageEdit();
      else if (action === 'video-gen') openVideoGen();
      else if (action === 'loras') openLoras();
      else if (action === 'workflow-models') openWorkflowModels();
    });
  });
  // Theme menu
  document.querySelectorAll('#menu-theme-dropdown .menu-item[data-action]').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = item.dataset.action;
      if (action === 'theme-dark') {
        applyTheme('macOS Dark');
        customTheme = null;
        saveTheme();
        populateThemeSubmenu();
        showToast('Theme: macOS Dark');
      } else if (action === 'theme-light') {
        applyTheme('macOS Light');
        customTheme = null;
        saveTheme();
        populateThemeSubmenu();
        showToast('Theme: macOS Light');
      }
    });
  });
  document.querySelectorAll('#menu-admin-dropdown .menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const action = item.dataset.action;
      if (action === 'settings-editor') openSettingsEditor();
      else if (action === 'library-editor') openLibraryEditor();

      else if (action === 'generate-thumbnails') generateAllThumbnails();
    });
  });
  // Attachments bar (sibling above bottom-bar)
  const attBar = document.createElement('div');
  attBar.id = 'bb-attachments';
  attBar.className = 'bb-attachments';
  attBar.style.display = 'none';
  document.getElementById('bottom-bar').parentNode.insertBefore(attBar, document.getElementById('bottom-bar'));

  // + button → LoRA picker
  document.querySelector('.bb-plus').addEventListener('click', showLoraPicker);

  function canAddAttachment(type) {
    if (bbMode === 'speech') return type === 'voice' && !_bbAttachments.some(a => a.type === 'voice');
    const hasLoRA = _bbAttachments.some(a => a.type === 'lora');
    const imgCount = _bbAttachments.filter(a => a.type === 'image').length;
    const audioCount = _bbAttachments.filter(a => a.type === 'audio').length;
    const isFastH3Video = bbMode === 'video' && currentVideoModel === 'fasth3';

    if (type === 'lora') return !_bbAttachments.length;
    if (type === 'image') {
      if (hasLoRA) return false;
      // FastH3 supports up to 6 reference images + 3 audios together
      if (isFastH3Video) return imgCount < 6;
      const hasAudio = audioCount > 0;
      return !hasAudio && imgCount < 2;
    }
    if (type === 'audio') {
      if (hasLoRA) return false;
      if (currentVideoModel === 'grok') return false;
      if (isFastH3Video) return audioCount < 3;
      return audioCount === 0;
    }
    return false;
  }

  // Drop target for library drag
  document.getElementById('bottom-bar').addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  document.getElementById('bottom-bar').addEventListener('drop', (e) => {
    e.preventDefault();
    let raw = e.dataTransfer.getData('application/json');
    if (!raw) raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (!data || !data.type) return;
      let type = data.type;
      if (bbMode === 'speech') {
        if (!data.voice) { showToast('Mark this audio as a Voice first (mic icon in the Library)', 'error'); return; }
        type = 'voice';
      }
      if (!canAddAttachment(type)) { showToast('Cannot add — incompatible combination'); return; }
      if (type === 'voice') {
        const tab = getActiveBbTab();
        if (tab) {
          if (!tab.speech) tab.speech = defaultSpeechConfig();
          const va = (allAssets || []).find(x => String(x.id) === String(data.id));
          tab.speech.ref_text = (va && va.metadata && va.metadata.voice && va.metadata.voice.transcript) || '';
        }
      }
      const asp = data.aspect && isFinite(data.aspect) ? data.aspect : 1.5;
      _bbAttachments.push({ type, name: data.name, src: data.src, aspect: asp, id: data.id, prompt: data.prompt || '' });
      renderAttachments();
    } catch (e) { showToast('Drop error: ' + e.message, 'error'); }
  });

  // Bottom bar send
  document.getElementById('bb-send').addEventListener('click', bbSend);
  document.getElementById('bb-upscale-btn')?.addEventListener('click', () => setBottomBarUpscale(!bbUpscale));
  document.getElementById('bb-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bbSend(); }
  });
  document.getElementById('bb-input').addEventListener('input', autoResizeBbInput);

  const promptHelpBtn = document.getElementById('bb-prompt-help');
  if (promptHelpBtn) promptHelpBtn.addEventListener('click', showPromptHelp);

  const modelBadgeBtn = document.getElementById('bb-model-badge');
  if (modelBadgeBtn) modelBadgeBtn.onclick = (e) => {
    e.stopPropagation();
    if (bbMode === 'speech') {
      document.querySelectorAll('.bb-ar-menu, .bb-enhance-menu').forEach(m => m.classList.remove('show'));
      renderModelMenu();
      document.getElementById('bb-model-menu')?.classList.toggle('show');
      return;
    }
    document.querySelectorAll('.bb-ar-menu, .bb-enhance-menu').forEach(m => m.classList.remove('show'));
    renderModelMenu();
    document.getElementById('bb-model-menu')?.classList.toggle('show');
  };

  const speechSetupBtn = document.getElementById('bb-speech-setup');
  if (speechSetupBtn) speechSetupBtn.onclick = () => openSpeechSetup();

  const autoPromptCb = document.getElementById('bb-auto-prompt-enabled');
  if (autoPromptCb) autoPromptCb.onchange = () => {
    const tab = getActiveBbTab();
    if (!tab) return;
    if (currentVideoModel === 'ltx') {
      if (autoPromptCb.checked) {
        if (!tab.ltx) initLtxStateFromAttachments(tab);
        applyLtxPrompt(tab);
      } else if (tab.ltx) {
        tab.ltx.enabled = false;
      }
    } else {
      if (autoPromptCb.checked) {
        if (!tab.h3) initH3StateFromAttachments(tab);
        applyH3Prompt(tab);
      } else if (tab.h3) {
        tab.h3.enabled = false;
      }
    }
    updateAutoPromptUI();
  };
  const autoPromptSetup = document.getElementById('bb-auto-prompt-setup');
  if (autoPromptSetup) autoPromptSetup.onclick = () => {
    if (currentVideoModel === 'ltx') openLtxWizard();
    else openH3Wizard();
  };

  initBbTabs();
  autoResizeBbInput();
  requestAnimationFrame(() => { autoResizeBbInput(); updateAttachmentsBarPosition(); });
  window.addEventListener('resize', () => { autoResizeBbInput(); updateAttachmentsBarPosition(); });

  loadAutoPlayState();

  console.log('Pulse Image Desktop initialized' + (isTauri ? ' [Tauri]' : ' [Browser]'));
}

// ============================================================
// Gen settings persist / To Prompt helpers
// ============================================================
function buildGenMetadata(job) {
  const meta = {
    mode: job.mode,
    resolution: job.resolution,
    aspect_ratio: job.aspect_ratio,
    duration: job.mode === 'video' ? job.duration : null,
    enhancer_id: job.enhancer_id || 'none',
    original_prompt: job.original_prompt ?? job.prompt,
    image_model: job.image_model,
    i2i_model: job.i2i_model,
    video_model: job.video_model,
    ltx_version: job.ltx_version,
    attachments: {
      images: (job.attImages || []).map(a => ({ id: a.id || '', name: a.name, type: 'image' })),
      audio: job.attAudio ? { id: job.attAudio.id || '', name: job.attAudio.name, type: 'audio' } : null,
      lora: job.attLora ? { name: job.attLora.name, type: 'lora' } : null,
    },
  };
  if (job.mode === 'video') {
    meta.fasth3_mode = job.fasth3_mode || 'reference';
    meta.video_upscale = job.video_upscale || 'off';
    if (job.upscale) meta.upscale = JSON.parse(JSON.stringify(job.upscale));
    meta.attachments.audios = (job.attAudios || []).map(a => ({ id: a.id || '', name: a.name, type: 'audio' }));
    if (job.h3) meta.h3 = JSON.parse(JSON.stringify(job.h3));
    if (job.ltx) meta.ltx = JSON.parse(JSON.stringify(job.ltx));
  }
  return meta;
}

function currentVideoModelLabel() {
  if (currentVideoModel === 'fasth3') {
    return 'FastH3 (' + (currentFastH3Mode === 'i2v' ? 'First frame' : 'Reference') + ')';
  }
  if (currentVideoModel === 'grok') return 'Grok Imagine';
  return 'LTX ' + (currentLtxVersion || '2.3');
}

function currentModelSummary() {
  const imageLabels = {
    schnell: 'Flux Schnell',
    klein: 'Flux 2 Klein',
    qwen: 'Qwen 2.5 2512',
    grok: 'Grok Imagine',
    'grok-quality': 'Grok Imagine Quality',
  };
  const i2iLabels = {
    klein: 'Flux 2 Klein',
    flux2: 'Flux 2',
    grok: 'Grok Imagine',
    'grok-quality': 'Grok Imagine Quality',
  };
  const image = imageLabels[currentImageModel] || currentImageModel || 'Flux Schnell';
  const edit = i2iLabels[currentI2iModel] || currentI2iModel || 'Flux 2 Klein';
  return currentVideoModelLabel() + ' · ' + image + ' · Edit: ' + edit;
}

function refreshOpenModelDialogs() {
  const setActive = (rootSel, btnSel, attr, val) => {
    const root = document.querySelector(rootSel);
    if (!root) return;
    root.querySelectorAll(btnSel).forEach(b => b.classList.toggle('active', b.dataset[attr] === val));
  };
  setActive('#img-gen-body', '.img-model-btn', 'model', currentImageModel);
  setActive('#img-edit-body', '.img-model-btn', 'model', currentI2iModel);
  updateWorkflowModelsCurrent();

  const vidBody = document.getElementById('vid-gen-body');
  if (!vidBody) return;
  vidBody.querySelectorAll('.vid-model-btn').forEach(b => b.classList.toggle('active', b.dataset.model === currentVideoModel));
  vidBody.querySelectorAll('.vid-ver-btn').forEach(b => b.classList.toggle('active', b.dataset.version === (currentLtxVersion || '2.3')));
  vidBody.querySelectorAll('.vid-h3-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === (currentFastH3Mode || 'reference')));
  const ltxWrap = document.getElementById('vid-ltx-version-wrap');
  if (ltxWrap) {
    const on = currentVideoModel === 'ltx';
    ltxWrap.style.opacity = on ? '' : '0.45';
    ltxWrap.style.pointerEvents = on ? '' : 'none';
  }
  const h3Wrap = document.getElementById('vid-fasth3-mode-wrap');
  if (h3Wrap) {
    const on = currentVideoModel === 'fasth3';
    h3Wrap.style.opacity = on ? '' : '0.45';
    h3Wrap.style.pointerEvents = on ? '' : 'none';
  }
}

function updateWorkflowModelsCurrent() {
  const el = document.getElementById('wf-models-current');
  if (!el) return;
  el.textContent = 'Current: ' + currentModelSummary();
}

function updatePromptModelBadge() {
  const el = document.getElementById('bb-model-badge');
  if (!el) return;
  if (bbMode === 'speech') {
    const sp = getSpeechConfig();
    const eng = speechEngines.find(e => e.id === sp.engine) || speechEngines.find(e => e.id === currentSpeechEngine);
    let label = eng ? eng.label : (currentSpeechEngine || 'Qwen3-TTS');
    if (eng && eng.installed === false) label += ' (not installed)';
    const voice = _bbAttachments.find(a => a.type === 'voice');
    if (voice) {
      const voiceLabel = voice.prompt || voice.name || 'Voice';
      label += ' · ' + (voiceLabel.length > 24 ? voiceLabel.slice(0, 24) + '…' : voiceLabel);
    }
    el.innerHTML = escHtml(label);
    el.title = 'Speech engine — click to choose';
    return;
  }
  const imageLabels = {
    schnell: 'Flux Schnell',
    klein: 'Flux 2 Klein',
    qwen: 'Qwen 2.5 2512',
    grok: 'Grok Imagine',
    'grok-quality': 'Grok Imagine Quality',
  };
  const i2iLabels = {
    klein: 'Flux 2 Klein',
    flux2: 'Flux 2',
    grok: 'Grok Imagine',
    'grok-quality': 'Grok Imagine Quality',
  };
  let label = '';
  if (bbMode === 'video') {
    if (currentVideoModel === 'fasth3') {
      label = 'FastH3 · ' + (currentFastH3Mode === 'i2v' ? 'First frame' : 'Reference');
    } else if (currentVideoModel === 'grok') {
      label = 'Grok Imagine';
    } else {
      label = 'LTX ' + (currentLtxVersion || '2.3');
    }
  } else {
    const hasImage = _bbAttachments.some(a => a.type === 'image');
    if (hasImage) {
      label = i2iLabels[currentI2iModel] || currentI2iModel || 'Flux 2 Klein';
    } else {
      label = imageLabels[currentImageModel] || currentImageModel || 'Flux Schnell';
      if (currentImageModel === 'qwen' && qwenTurbo) label += ' · Turbo';
    }
  }
  el.innerHTML = `${escHtml(label)} <i class="fa-solid fa-chevron-down" style="font-size:8px;margin-left:2px"></i>`;
  el.title = bbMode === 'video' ? 'Current video model' : 'Current image model';
}

function getModelItems() {
  if (bbMode === 'speech') {
    if (!speechEngines.length) {
      return [{
        id: 'qwen3', label: 'Qwen3-TTS', active: getSpeechConfig().engine === 'qwen3',
        settings: { tts_engine: 'qwen3' },
        apply: () => {
          currentSpeechEngine = 'qwen3';
          const tab = getActiveBbTab();
          if (tab) { tab.speech = tab.speech || defaultSpeechConfig(); tab.speech.engine = 'qwen3'; }
          if (speechWizardWinId && windows[speechWizardWinId]) renderSpeechSetup();
        },
      }];
    }
    return speechEngines.map(e => ({
      id: e.id,
      label: e.label + (e.installed === false ? ' (not installed)' : ''),
      active: e.id === getSpeechConfig().engine,
      settings: { tts_engine: e.id },
      apply: () => {
        currentSpeechEngine = e.id;
        const tab = getActiveBbTab();
        if (tab) { tab.speech = tab.speech || defaultSpeechConfig(); tab.speech.engine = e.id; }
        if (speechWizardWinId && windows[speechWizardWinId]) renderSpeechSetup();
      },
    }));
  }
  if (bbMode === 'video') {
    const is25 = String(currentLtxVersion) === '2.5';
    return [
      { id: 'ltx23', label: 'LTX 2.3', active: currentVideoModel === 'ltx' && !is25, settings: { video_model: 'ltx', ltx_version: '2.3' }, apply: () => { currentVideoModel = 'ltx'; currentLtxVersion = '2.3'; } },
      { id: 'ltx25', label: 'LTX 2.5', active: currentVideoModel === 'ltx' && is25, settings: { video_model: 'ltx', ltx_version: '2.5' }, apply: () => { currentVideoModel = 'ltx'; currentLtxVersion = '2.5'; } },
      { id: 'fasth3', label: 'FastH3', active: currentVideoModel === 'fasth3', settings: { video_model: 'fasth3' }, apply: () => { currentVideoModel = 'fasth3'; } },
      { id: 'grok', label: 'Grok Imagine', active: currentVideoModel === 'grok', settings: { video_model: 'grok' }, apply: () => { currentVideoModel = 'grok'; } },
    ];
  }
  const hasImage = _bbAttachments.some(a => a.type === 'image');
  if (hasImage) {
    return [
      { id: 'klein', label: 'Flux 2 Klein', active: currentI2iModel === 'klein', settings: { i2i_model: 'klein' }, apply: () => { currentI2iModel = 'klein'; } },
      { id: 'flux2', label: 'Flux 2', active: currentI2iModel === 'flux2', settings: { i2i_model: 'flux2' }, apply: () => { currentI2iModel = 'flux2'; } },
      { id: 'grok', label: 'Grok Imagine', active: currentI2iModel === 'grok', settings: { i2i_model: 'grok' }, apply: () => { currentI2iModel = 'grok'; } },
      { id: 'grok-quality', label: 'Grok Imagine Quality', active: currentI2iModel === 'grok-quality', settings: { i2i_model: 'grok-quality' }, apply: () => { currentI2iModel = 'grok-quality'; } },
    ];
  }
  return [
    { id: 'schnell', label: 'Flux Schnell', active: currentImageModel === 'schnell', settings: { image_model: 'schnell' }, apply: () => { currentImageModel = 'schnell'; } },
    { id: 'klein', label: 'Flux 2 Klein', active: currentImageModel === 'klein', settings: { image_model: 'klein' }, apply: () => { currentImageModel = 'klein'; } },
    { id: 'qwen', label: 'Qwen 2.5 2512', active: currentImageModel === 'qwen', settings: { image_model: 'qwen' }, apply: () => { currentImageModel = 'qwen'; } },
    { id: 'grok', label: 'Grok Imagine', active: currentImageModel === 'grok', settings: { image_model: 'grok' }, apply: () => { currentImageModel = 'grok'; } },
    { id: 'grok-quality', label: 'Grok Imagine Quality', active: currentImageModel === 'grok-quality', settings: { image_model: 'grok-quality' }, apply: () => { currentImageModel = 'grok-quality'; } },
  ];
}

function renderModelMenu() {
  const menu = document.getElementById('bb-model-menu');
  if (!menu) return;
  menu.innerHTML = '';
  getModelItems().forEach(item => {
    const d = document.createElement('div');
    d.className = 'bb-model-option' + (item.active ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = item.label;
    d.appendChild(label);
    if (item.active) {
      const check = document.createElement('i');
      check.className = 'fa-solid fa-check';
      check.style.cssText = 'color:#007aff;font-size:10px';
      d.appendChild(check);
    }
    d.onclick = async (e) => {
      e.stopPropagation();
      try {
        await apiPost('/settings', item.settings);
        item.apply();
        if (currentVideoModel === 'grok') {
          const before = _bbAttachments.length;
          _bbAttachments = _bbAttachments.filter(a => a.type !== 'audio');
          if (_bbAttachments.length !== before) renderAttachments();
        }
        updatePromptModelBadge();
        updatePromptHelpVisibility();
        refreshOpenModelDialogs();
        renderModelMenu();
        menu.classList.remove('show');
        showToast('Model: ' + item.label);
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    };
    menu.appendChild(d);
  });
}

function updateBottomBarModeUI() {
  const isSpeech = bbMode === 'speech';
  const setDisp = (sel, on) => { const el = document.querySelector(sel); if (el) el.style.display = on ? '' : 'none'; };
  setDisp('.bb-res-group', !isSpeech);
  setDisp('.bb-ar-wrap', !isSpeech);
  setDisp('#bb-duration-group', !isSpeech && bbMode === 'video');
  setDisp('#bb-upscale-wrap', !isSpeech && bbMode === 'video');
  setDisp('.bb-enhance-wrap', !isSpeech);
  setDisp('#bb-prompt-help', !isSpeech);
  setDisp('#bb-auto-prompt-wrap', !isSpeech);
  setDisp('#bb-speech-wrap', isSpeech);
  if (isSpeech) document.getElementById('bb-model-menu')?.classList.remove('show');
  const plus = document.querySelector('.bb-plus'); if (plus) plus.style.display = isSpeech ? 'none' : '';
  const input = document.getElementById('bb-input');
  if (input) input.placeholder = isSpeech ? 'Type to speak' : (bbMode === 'video' ? 'Describe the video' : 'Type to image');
  updatePromptModelBadge();
  updateAutoPromptUI();
}

function setBottomBarMode(mode) {
  bbMode = (mode === 'video' || mode === 'speech') ? mode : 'image';
  const activeTab = bbTabs.find(t => t.id === activeTabId);
  if (activeTab) activeTab.mode = bbMode;
  document.querySelectorAll('.bb-mode').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === bbMode);
  });
  if (bbMode === 'speech') {
    _bbAttachments = _bbAttachments.filter(a => a.type === 'voice');
  } else {
    _bbAttachments = _bbAttachments.filter(a => a.type !== 'voice');
  }
  renderAttachments();
  updateBottomBarModeUI();
}

function setBottomBarRes(res) {
  if (!res) return;
  // Normalize e.g. "720" → "720p"
  let r = String(res).trim().toLowerCase();
  if (r === '480' || r === '720' || r === '1080') r = r + 'p';
  if (!/^\d+p$/.test(r)) r = String(res).trim();
  bbRes = r;
  const root = document.getElementById('bottom-bar') || document;
  root.querySelectorAll('.bb-pill[data-res]').forEach(b => {
    b.classList.toggle('active', b.dataset.res === bbRes);
  });
}

function setBottomBarAr(ar) {
  if (!ar) return;
  bbAr = ar;
  const arMenu = document.getElementById('bb-ar-menu');
  const arBtn = document.getElementById('bb-ar-btn');
  if (arMenu) {
    arMenu.querySelectorAll('.bb-ar-option').forEach(o => {
      o.classList.toggle('active', o.dataset.ar === bbAr);
    });
  }
  if (arBtn) {
    const opt = arMenu ? arMenu.querySelector(`.bb-ar-option[data-ar="${bbAr}"]`) : null;
    const iconHtml = opt && opt.querySelector('i')
      ? opt.querySelector('i').outerHTML
      : '<i class="fa-solid fa-image"></i>';
    arBtn.innerHTML = `${iconHtml} ${bbAr} <i class="fa-solid fa-chevron-down" style="font-size:8px;margin-left:2px"></i>`;
  }
}

function setBottomBarDuration(dur) {
  if (dur == null) return;
  bbDuration = parseInt(dur, 10) || 6;
  document.querySelectorAll('.bb-duration-pill').forEach(b => {
    b.classList.toggle('active', String(b.dataset.dur) === String(bbDuration));
  });
}

function setBottomBarUpscale(on) {
  bbUpscale = !!on;
  const btn = document.getElementById('bb-upscale-btn');
  if (!btn) return;
  btn.classList.toggle('active', bbUpscale);
  btn.setAttribute('aria-pressed', bbUpscale ? 'true' : 'false');
  btn.title = bbUpscale
    ? 'RelayVSR 2× post-upscale: on'
    : 'RelayVSR 2× post-upscale: off';
}

function setBottomBarEnhancer(id) {
  bbEnhancer = id || 'none';
  const enh = bbEnhancersList.find(e => e.id === bbEnhancer);
  const label = bbEnhancer === 'none'
    ? 'No enhancement'
    : (enh ? (enh.name || enh.id) : bbEnhancer);
  const textEl = document.getElementById('bb-enhance-text');
  if (textEl) textEl.textContent = label;
  populateEnhanceMenu();
}

function clearBottomBarAttachments() {
  _bbAttachments = [];
  renderAttachments();
}

// ============================================================
// Prompt bar tabs
// ============================================================
function newBbTabId() {
  return 'bbtab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function snapshotActiveTab() {
  const tab = bbTabs.find(t => t.id === activeTabId);
  if (!tab) return;
  const input = document.getElementById('bb-input');
  tab.prompt = input ? input.value : tab.prompt;
  tab.mode = bbMode;
  tab.res = bbRes;
  tab.ar = bbAr;
  tab.duration = bbDuration;
  tab.enhancer = bbEnhancer;
  tab.upscale = bbUpscale;
  tab.attachments = _bbAttachments.map(a => ({ ...a }));
}

function applyTabState(tab) {
  if (!tab) return;
  const input = document.getElementById('bb-input');
  if (input) input.value = tab.prompt || '';
  setBottomBarMode(tab.mode || 'image');
  setBottomBarRes(tab.res || '720p');
  setBottomBarAr(tab.ar || '3:2');
  setBottomBarDuration(tab.duration || 6);
  setBottomBarEnhancer(tab.enhancer || 'none');
  setBottomBarUpscale(!!tab.upscale);
  _bbAttachments = (tab.attachments || []).map(a => ({ ...a }));
  tab.speech = tab.speech || defaultSpeechConfig();
  renderAttachments();
  updateAutoPromptUI();
  if (h3WizardWinId && windows[h3WizardWinId]) renderH3Wizard();
  if (ltxWizardWinId && windows[ltxWizardWinId]) renderLtxWizard();
  if (speechWizardWinId && windows[speechWizardWinId]) renderSpeechSetup();
  autoResizeBbInput();
}

function switchBbTab(id) {
  if (id === activeTabId) return;
  snapshotActiveTab();
  const tab = bbTabs.find(t => t.id === id);
  if (!tab) return;
  activeTabId = id;
  applyTabState(tab);
  renderBbTabs();
  document.getElementById('bb-input')?.focus();
}

function addBbTab() {
  snapshotActiveTab();
  const src = bbTabs.find(t => t.id === activeTabId);
  const tab = {
    id: newBbTabId(),
    label: `Tab ${++bbTabCounter}`,
    prompt: src ? src.prompt : '',
    mode: src ? src.mode : bbMode,
    res: src ? src.res : bbRes,
    ar: src ? src.ar : bbAr,
    duration: src ? src.duration : bbDuration,
    enhancer: src ? src.enhancer : bbEnhancer,
    upscale: src ? src.upscale : bbUpscale,
    attachments: src ? src.attachments.map(a => ({ ...a })) : [],
    h3: src && src.h3 ? JSON.parse(JSON.stringify(src.h3)) : null,
    ltx: src && src.ltx ? JSON.parse(JSON.stringify(src.ltx)) : null,
    speech: src && src.speech ? { ...src.speech } : null,
  };
  bbTabs.push(tab);
  activeTabId = tab.id;
  applyTabState(tab);
  renderBbTabs();
  document.getElementById('bb-input')?.focus();
}

function closeBbTab(id) {
  if (bbTabs.length <= 1) return;
  const idx = bbTabs.findIndex(t => t.id === id);
  if (idx < 0) return;
  const wasActive = id === activeTabId;
  bbTabs.splice(idx, 1);
  if (wasActive) {
    const next = bbTabs[Math.min(idx, bbTabs.length - 1)];
    activeTabId = next.id;
    applyTabState(next);
  }
  renderBbTabs();
}

function renderBbTabs() {
  const bar = document.getElementById('bb-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  bbTabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'bb-tab' + (tab.id === activeTabId ? ' active' : '');
    const label = document.createElement('span');
    label.className = 'bb-tab-label';
    label.textContent = tab.label;
    label.title = (tab.prompt || '').slice(0, 200);
    el.appendChild(label);
    if (bbTabs.length > 1) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'bb-tab-close';
      x.title = 'Close tab';
      x.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      x.onclick = (e) => { e.stopPropagation(); closeBbTab(tab.id); };
      el.appendChild(x);
    }
    el.onclick = () => switchBbTab(tab.id);
    bar.appendChild(el);
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'bb-tab-add';
  add.title = 'New tab';
  add.innerHTML = '<i class="fa-solid fa-plus"></i>';
  add.onclick = () => addBbTab();
  bar.appendChild(add);
}

function initBbTabs() {
  bbTabCounter = 0;
  const input = document.getElementById('bb-input');
  const tab = {
    id: newBbTabId(),
    label: `Tab ${++bbTabCounter}`,
    prompt: input ? input.value : '',
    mode: bbMode,
    res: bbRes,
    ar: bbAr,
    duration: bbDuration,
    enhancer: bbEnhancer,
    upscale: bbUpscale,
    attachments: _bbAttachments.map(a => ({ ...a })),
  };
  bbTabs = [tab];
  activeTabId = tab.id;
  renderBbTabs();
  updateAutoPromptUI();
}

// ============================================================
// FastH3 auto prompt builder
// ============================================================
function getH3Presets() {
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('pulse_h3_presets') || '[]'); } catch (_) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  return [...H3_PROMPT_PRESETS, ...custom.filter(p => p && p.id && p.name)];
}

function getActiveBbTab() {
  return bbTabs.find(t => t.id === activeTabId) || null;
}

function saveH3Preset() {
  const tab = getActiveBbTab();
  if (!tab || !tab.h3) return;
  const name = prompt('Preset name:', 'My preset');
  if (!name || !name.trim()) return;
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('pulse_h3_presets') || '[]'); } catch (_) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  custom.push({ id: 'custom_' + Date.now().toString(36), name: name.trim(), scene: tab.h3.scene || '', hasSpeech: !!tab.h3.hasSpeech });
  localStorage.setItem('pulse_h3_presets', JSON.stringify(custom));
  renderH3Wizard();
  showToast('Preset saved');
}

function looksLikeGuid(value) {
  const s = String(value || '').trim();
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(s) || /^[0-9a-f]{32}$/i.test(s);
}

function initH3StateFromAttachments(tab, forceScene = false) {
  if (!tab) return;
  const images = _bbAttachments.filter(a => a.type === 'image');
  const audios = _bbAttachments.filter(a => a.type === 'audio');
  const prev = tab.h3 || {};
  const prevSubjects = Array.isArray(prev.subjects) ? prev.subjects : [];
  const prevAudios = Array.isArray(prev.audios) ? prev.audios : [];
  const input = document.getElementById('bb-input');
  const inputVal = input ? input.value.trim() : '';
  const sceneFromInput = inputVal && !/^\s*subject_definitions:/i.test(inputVal) ? inputVal : '';
  const firstImg = images[0];
  const sceneDefault = (firstImg && (firstImg.prompt || '')) || '';

  tab.h3 = {
    enabled: !!prev.enabled,
    preset: prev.preset || 'none',
    scene: forceScene ? sceneDefault : (prev.scene || sceneFromInput || sceneDefault),
    hasSpeech: prev.hasSpeech != null ? !!prev.hasSpeech : false,
    subjects: images.map((img, i) => {
      const old = prevSubjects[i] || {};
      const rawFallback = (img.prompt || (img.name || '').replace(/\.[^.]+$/, '') || '').trim();
      const fallback = looksLikeGuid(rawFallback) ? '' : rawFallback;
      return {
        description: old.description || fallback,
        details: old.details || '',
        retention: old.retention || 'fully_preserved',
      };
    }),
    audios: audios.map((aud, j) => {
      const old = prevAudios[j] || {};
      return {
        type: old.type || 'speech',
        subjectIndex: Number.isInteger(old.subjectIndex) ? old.subjectIndex : 0,
        retention: old.retention || (old.type === 'speech' ? 'reference' : 'fully_copy'),
        language: old.language || 'English',
        description: old.description || '',
      };
    }),
    dialogue: Array.isArray(prev.dialogue) ? prev.dialogue.map(d => ({ ...d })) : [],
  };
  if (!tab.h3.dialogue.length) {
    tab.h3.dialogue = [{ speaker: 1, language: 'English', text: '' }];
  }
}

function buildH3AutoPrompt(tab) {
  const h3 = (tab && tab.h3) || {};
  const images = _bbAttachments.filter(a => a.type === 'image');
  const audios = _bbAttachments.filter(a => a.type === 'audio');
  const subjects = images.map((img, i) => (h3.subjects || [])[i] || { description: '', retention: 'fully_preserved' });
  const audioDefs = audios.map((aud, j) => (h3.audios || [])[j] || { type: 'speech', subjectIndex: 0, retention: 'reference', language: 'English', description: '' });
  const lines = ['subject_definitions:'];

  subjects.forEach((s, i) => {
    const desc = (s.description || '').trim() || `the subject shown in <Picture ${i + 1}>`;
    lines.push(`<Subject ${i + 1}> is ${desc}.`);
    const details = (s.details || '').trim();
    if (details) lines.push(`<Subject ${i + 1}> has ${details}.`);
  });
  audioDefs.forEach((a, j) => {
    if (a.type === 'speech') {
      if (subjects.length) {
        const si = Math.min(Math.max(0, Number(a.subjectIndex) || 0), subjects.length - 1);
        lines.push(`<Audio ${j + 1}> is the voice-timbre reference for <Subject ${si + 1}> (S${si + 1}).`);
      } else {
        lines.push(`<Audio ${j + 1}> is the voice-timbre reference for the speaker (S1).`);
      }
    } else {
      const label = a.type === 'music' ? 'music' : 'ambient sound';
      const extra = (a.description || '').trim();
      lines.push(`<Audio ${j + 1}> is a ${label} reference${extra ? ': ' + extra : '.'}`);
    }
  });
  lines.push('');

  const subjTags = subjects.map((_, i) => `<Subject ${i + 1}> (S${i + 1})`).join(', ');
  const audioTags = audioDefs.map((_, j) => `<Audio ${j + 1}>`).join(', ');
  lines.push('summary:');
  const hasSpeechAudio = audioDefs.some(a => a.type === 'speech');
  if (audioDefs.length && subjects.length) {
    if (hasSpeechAudio) {
      lines.push(`[reference generation + audio reference] The target video features ${subjTags}, with ${audioTags} used as audio references.`);
    } else {
      lines.push(`[reference generation + audio] The target video features ${subjTags}, with ${audioTags} used as the audio track.`);
    }
  } else if (subjects.length) {
    lines.push(`[reference generation] The target video features ${subjTags} from the attached reference images.`);
  } else if (audioDefs.length) {
    lines.push(`[audio reference] The target video uses ${audioTags} as audio references.`);
  } else {
    lines.push('[reference generation] The target video is generated from the prompt.');
  }
  lines.push('');

  lines.push('retention_analysis:');
  subjects.forEach((s, i) => {
    const ret = s.retention || 'fully_preserved';
    lines.push(`<Subject ${i + 1}> (appears in [Shot 1]): ${ret} - the subject from <Picture ${i + 1}> is retained.`);
  });
  audioDefs.forEach((a, j) => {
    const ret = a.retention || (a.type === 'speech' ? 'reference' : 'fully_copy');
    if (a.type === 'speech') {
      if (subjects.length) {
        const si = Math.min(Math.max(0, Number(a.subjectIndex) || 0), subjects.length - 1);
        if (ret === 'fully_copy') {
          lines.push(`<Audio ${j + 1}>: fully_copy - <Audio ${j + 1}> is reused 1:1 as the final audio.`);
        } else {
          lines.push(`<Audio ${j + 1}>: reference - <Subject ${si + 1}> (S${si + 1}) follows <Audio ${j + 1}>'s voice timbre without copying the original signal.`);
        }
      } else {
        lines.push(`<Audio ${j + 1}>: ${ret} - the voice reference is used for the speaker.`);
      }
    } else {
      const label = a.type === 'music' ? 'music track' : 'ambient track';
      lines.push(`<Audio ${j + 1}>: ${ret} - <Audio ${j + 1}> is used as the ${label}.`);
    }
  });
  lines.push('');

  lines.push('detailed_description:');
  lines.push('[Shot 1] ' + ((h3.scene || '').trim() || 'A cinematic shot.'));
  if (h3.hasSpeech) {
    (h3.dialogue || []).forEach((line) => {
      const text = (line.text || '').trim();
      if (!text) return;
      const speaker = Number(line.speaker) || 0;
      const lang = (line.language || 'English').trim() || 'English';
      if (speaker > 0 && speaker <= subjects.length) {
        lines.push(`<Subject ${speaker}> (S${speaker}) says, <d>[${lang}] ${text}</d>`);
      } else {
        lines.push(`A voice (S${speaker || 1}) says, <d>[${lang}] ${text}</d>`);
      }
    });
  }
  return lines.join('\n');
}

function stripTrailingPeriod(text) {
  return String(text == null ? '' : text).replace(/\.\s*$/, '').trim();
}

function parseH3PromptState(text) {
  const src = String(text || '');
  if (!/^\s*subject_definitions:/im.test(src)) return null;
  if (!/^\s*(retention_analysis|detailed_description):/im.test(src)) return null;

  const state = { subjects: [], audios: [], dialogue: [], hasSpeech: false };
  let section = '';

  src.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const header = line.match(/^(subject_definitions|summary|retention_analysis|detailed_description):\s*$/i);
    if (header) { section = header[1].toLowerCase(); return; }

    let m;
    if (section === 'subject_definitions') {
      m = line.match(/^<Subject (\d+)> is\s+(.+)$/i);
      if (m) {
        const i = Number(m[1]) - 1;
        state.subjects[i] = state.subjects[i] || {};
        state.subjects[i].description = stripTrailingPeriod(m[2]);
        return;
      }
      m = line.match(/^<Subject (\d+)> has\s+(.+)$/i);
      if (m) {
        const i = Number(m[1]) - 1;
        state.subjects[i] = state.subjects[i] || {};
        state.subjects[i].details = stripTrailingPeriod(m[2]);
        return;
      }
      m = line.match(/^<Audio (\d+)> is the voice-timbre reference for <Subject (\d+)>/i);
      if (m) {
        const j = Number(m[1]) - 1;
        state.audios[j] = state.audios[j] || {};
        state.audios[j].type = 'speech';
        state.audios[j].subjectIndex = Math.max(0, Number(m[2]) - 1);
        return;
      }
      m = line.match(/^<Audio (\d+)> is the voice-timbre reference for the speaker/i);
      if (m) {
        const j = Number(m[1]) - 1;
        state.audios[j] = state.audios[j] || {};
        state.audios[j].type = 'speech';
        state.audios[j].subjectIndex = 0;
        return;
      }
      m = line.match(/^<Audio (\d+)> is an? (music|ambient sound) reference(?::\s*(.*?))?\.?$/i);
      if (m) {
        const j = Number(m[1]) - 1;
        state.audios[j] = state.audios[j] || {};
        state.audios[j].type = /music/i.test(m[2]) ? 'music' : 'ambient';
        state.audios[j].description = stripTrailingPeriod(m[3] || '');
        return;
      }
      m = line.match(/^<Audio (\d+)> is (?:a |the )?(?:standalone )?reference audio\.?$/i);
      if (m) {
        const j = Number(m[1]) - 1;
        state.audios[j] = state.audios[j] || {};
        state.audios[j].type = 'speech';
        state.audios[j].subjectIndex = 0;
        return;
      }
    } else if (section === 'retention_analysis') {
      m = line.match(/^<Subject (\d+)>[^:]*:\s*(fully_preserved|partially_preserved|reference)\b/i);
      if (m) {
        const i = Number(m[1]) - 1;
        state.subjects[i] = state.subjects[i] || {};
        state.subjects[i].retention = m[2].toLowerCase();
        return;
      }
      m = line.match(/^<Audio (\d+)>:\s*(fully_copy|reference|fully_preserved|partially_preserved)\b/i);
      if (m) {
        const j = Number(m[1]) - 1;
        state.audios[j] = state.audios[j] || {};
        state.audios[j].retention = m[2].toLowerCase();
        return;
      }
    } else if (section === 'detailed_description') {
      m = line.match(/^\[Shot\s*1\]\s*(.*)$/i);
      if (m && m[1]) { state.scene = m[1].trim(); return; }
      m = line.match(/^<Subject (\d+)>\s*\(S\d+\)\s*says,\s*<d>\[([^\]]*)\]\s*([\s\S]*?)\s*<\/d>$/i);
      if (m) {
        state.dialogue.push({ speaker: Number(m[1]) || 0, language: m[2] || 'English', text: m[3] });
        return;
      }
      m = line.match(/^A voice\s*\(S\d+\)\s*says,\s*<d>\[([^\]]*)\]\s*([\s\S]*?)\s*<\/d>$/i);
      if (m) {
        state.dialogue.push({ speaker: 0, language: m[1] || 'English', text: m[2] });
        return;
      }
    }
  });

  state.hasSpeech = state.dialogue.length > 0;
  return state;
}

function applyH3Prompt(tab) {
  if (!tab || !tab.h3) return;
  const text = buildH3AutoPrompt(tab);
  const input = document.getElementById('bb-input');
  if (input) input.value = text;
  tab.prompt = text;
  tab.h3.enabled = true;
  updateAutoPromptUI();
  autoResizeBbInput();
}

function openSpeechSetup() {
  const tab = getActiveBbTab();
  if (!tab) return;
  if (speechWizardWinId && windows[speechWizardWinId]) {
    focusWindow(speechWizardWinId);
    renderSpeechSetup();
    return;
  }
  speechWizardWinId = createWindow({
    title: 'Speech Setup',
    icon: 'fa-microphone-lines',
    width: 540,
    height: 680,
    stateKey: 'SpeechSetup',
    onClose: () => { speechWizardWinId = null; },
  });
  renderSpeechSetup();
}

async function renderSpeechSetup() {
  if (!speechWizardWinId) return;
  const win = document.getElementById(speechWizardWinId);
  if (!win) return;
  const body = win.querySelector('.window-body');
  if (!body) return;
  const tab = getActiveBbTab();
  if (!tab) {
    body.innerHTML = '<div style="padding:20px;font-size:12px;color:#666">No prompt tab selected.</div>';
    return;
  }
  const sp = getSpeechConfig();
  if (!speechEngines.length) await loadTtsEngines();
  const engine = speechEngines.find(e => e.id === sp.engine) || speechEngines[0] || { id:'qwen3', label:'Qwen3-TTS', languages:['English'], controls:{} };
  const controls = engine.controls || {};
  const canEmotion = controls.emotion !== false;
  const canInstruction = controls.instruction !== false;
  const canRefText = controls.ref_text !== false;
  const voices = (allAssets || []).filter(a => a.voice && (a.type === 'audio' || /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(a.filename || '')));
  const attached = _bbAttachments.find(a => a.type === 'voice');
  const attachedAsset = attached ? (allAssets || []).find(a => String(a.id) === String(attached.id)) : null;
  const refText = sp.ref_text || (attachedAsset && attachedAsset.metadata && attachedAsset.metadata.voice && attachedAsset.metadata.voice.transcript) || '';
  const inputEl = document.getElementById('bb-input');
  const currentText = inputEl ? inputEl.value : (tab.prompt || '');
  const languages = Array.isArray(engine.languages) && engine.languages.length ? engine.languages : ['English'];
  const selLang = sp.language || engine.default_language || 'English';

  const voiceOpts = '<option value="">No voice — drag one from Voices</option>' + voices.map(v => {
    const label = v.prompt || v.filename || v.id;
    const sel = attached && String(attached.id) === String(v.id) ? ' selected' : '';
    return `<option value="${escAttr(String(v.id))}"${sel}>${escHtml(label)}</option>`;
  }).join('');
  const langOpts = languages.map(l => `<option value="${escAttr(l)}"${l === selLang ? ' selected' : ''}>${escHtml(l)}</option>`).join('');
  const emotions = [
    ['neutral', 'Neutral'], ['happy', 'Happy'], ['sad', 'Sad'], ['angry', 'Angry'],
    ['whisper', 'Whisper'], ['fearful', 'Fearful'], ['surprised', 'Surprised'],
    ['disgusted', 'Disgusted'], ['custom', 'Custom'],
  ];
  const emotionOpts = emotions.map(([v, l]) => `<option value="${v}"${(sp.emotion || 'neutral') === v ? ' selected' : ''}>${l}</option>`).join('');

  const builtInPresets = [
    { id: 'spk_neutral', name: 'Neutral', language: 'English', emotion: 'neutral', instruction: '', seed: 0 },
    { id: 'spk_happy', name: 'Happy', language: 'English', emotion: 'happy', instruction: '', seed: 0 },
    { id: 'spk_sad', name: 'Sad', language: 'English', emotion: 'sad', instruction: '', seed: 0 },
    { id: 'spk_angry', name: 'Angry', language: 'English', emotion: 'angry', instruction: '', seed: 0 },
    { id: 'spk_whisper', name: 'Whisper', language: 'English', emotion: 'whisper', instruction: '', seed: 0 },
    { id: 'spk_narrator', name: 'Narrator', language: 'English', emotion: 'neutral', instruction: 'A warm, measured narrator voice.', seed: 0 },
  ];
  let customPresets = [];
  try { customPresets = JSON.parse(localStorage.getItem('pulse_speech_presets') || '[]'); } catch (_) { customPresets = []; }
  if (!Array.isArray(customPresets)) customPresets = [];
  const presets = [...builtInPresets, ...customPresets.filter(p => p && p.id && p.name)];
  const presetOpts = '<option value="">Choose preset…</option>' + presets.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.name)}</option>`).join('');

  body.style.padding = '0';
  body.style.background = '#fff';
  body.innerHTML = `
    <div class="h3w speech-wizard">
      <div class="h3w-section">
        <h4>Voice</h4>
        ${speechEngines.length > 1 ? `
        <div class="speech-row">
          <label>Engine</label>
          <select id="sp-engine" class="h3w-grow">
            ${speechEngines.map(e => `<option value="${escAttr(e.id)}"${e.id === sp.engine ? ' selected' : ''}>${escHtml(e.label + (e.installed === false ? ' (not installed)' : ''))}</option>`).join('')}
          </select>
        </div>` : ''}
        ${engine.installed === false ? `<div class="speech-note">This engine is not installed yet. Install its node pack/model in ComfyUI before generating.</div>` : ''}
        <div class="speech-row">
          <label>Voice</label>
          <select id="sp-voice" class="h3w-grow">${voiceOpts}</select>
        </div>
        <div class="speech-note">Or drag a voice from the Voices library into the prompt bar.</div>
        <div class="speech-row">
          <label>Language</label>
          <select id="sp-language" class="h3w-grow">${langOpts}</select>
        </div>
        ${canEmotion ? `
        <div class="speech-row">
          <label>Emotion</label>
          <select id="sp-emotion" class="h3w-grow">${emotionOpts}</select>
        </div>` : ''}
        ${canInstruction ? `<textarea id="sp-instruction" placeholder="Optional custom instruction — overrides the emotion preset">${escHtml(sp.instruction || '')}</textarea>` : ''}
        ${(!canEmotion && !canInstruction) ? `<div class="speech-note">Emotion / Whisper instructions are not exposed by this engine's clone node. Install a Qwen3 pack that supports “instruct”, or use another engine.</div>` : ''}
      </div>
      <div class="h3w-section">
        <h4>Cloning</h4>
        ${canRefText ? `
        <textarea id="sp-ref-text" placeholder="Transcript of the reference voice">${escHtml(refText)}</textarea>
        <div class="speech-note">Transcript improves cloning; leave blank for x-vector mode.</div>` : `<div class="speech-note">This engine clones from the reference audio without a reference transcript.</div>`}
        <div class="speech-row">
          <label>Seed</label>
          <input type="number" id="sp-seed" class="h3w-grow" value="${Number(sp.seed) || 0}">
          ${canRefText ? `<button type="button" id="sp-save-transcript" class="h3w-btn"${attached ? '' : ' disabled'}>Save transcript</button>` : ''}
        </div>
      </div>
      <div class="h3w-section">
        <h4>Spoken text</h4>
        <textarea id="sp-text">${escHtml(currentText)}</textarea>
      </div>
      ${(canEmotion || canInstruction) ? `
      <div class="h3w-section">
        <h4>Preset</h4>
        <div class="speech-row">
          <select id="sp-preset" class="h3w-grow">${presetOpts}</select>
          <button type="button" id="sp-save-preset" class="h3w-btn">Save preset</button>
        </div>
      </div>` : ''}
      <div class="h3w-footer">
        <button type="button" id="sp-cancel" class="h3w-btn">Cancel</button>
        <button type="button" id="sp-apply" class="h3w-btn primary">Apply</button>
      </div>
    </div>`;

  const voiceEl = document.getElementById('sp-voice');
  if (voiceEl) voiceEl.onchange = () => {
    const id = voiceEl.value;
    _bbAttachments = _bbAttachments.filter(a => a.type !== 'voice');
    if (id) {
      const asset = voices.find(v => String(v.id) === String(id)) || (allAssets || []).find(a => String(a.id) === String(id));
      if (asset) _bbAttachments.push({ type: 'voice', name: asset.filename, src: '/audio/' + asset.filename, id: asset.id, prompt: asset.prompt || '', voice: true });
      sp.ref_text = (asset && asset.metadata && asset.metadata.voice && asset.metadata.voice.transcript) || '';
    } else {
      sp.ref_text = '';
    }
    renderAttachments();
    renderSpeechSetup();
  };

  const langEl = document.getElementById('sp-language');
  if (langEl) langEl.onchange = () => { sp.language = langEl.value; };
  const emotionEl = document.getElementById('sp-emotion');
  if (emotionEl) emotionEl.onchange = () => { sp.emotion = emotionEl.value; };
  const instructionEl = document.getElementById('sp-instruction');
  if (instructionEl) instructionEl.oninput = () => { sp.instruction = instructionEl.value; };
  const seedEl = document.getElementById('sp-seed');
  if (seedEl) seedEl.oninput = () => { sp.seed = Number(seedEl.value) || 0; };
  const refEl = document.getElementById('sp-ref-text');
  if (refEl) refEl.oninput = () => { sp.ref_text = refEl.value; };

  const saveTranscriptBtn = document.getElementById('sp-save-transcript');
  if (saveTranscriptBtn) saveTranscriptBtn.onclick = async () => {
    const v = _bbAttachments.find(a => a.type === 'voice');
    if (!v) return;
    const transcript = document.getElementById('sp-ref-text').value;
    const language = document.getElementById('sp-language').value;
    try {
      const res = await apiPost('/tts/voices/' + v.id, { transcript, language });
      const a = (allAssets || []).find(x => String(x.id) === String(v.id));
      if (a) {
        a.metadata = a.metadata || {};
        a.metadata.voice = Object.assign({}, a.metadata.voice || {}, (res && res.voice) || {}, { transcript, language });
      }
      sp.ref_text = transcript;
      showToast('Transcript saved');
      renderSpeechSetup();
    } catch (e) { showToast('Failed to save transcript: ' + e.message, 'error'); }
  };

  const presetEl = document.getElementById('sp-preset');
  if (presetEl) presetEl.onchange = () => {
    const p = presets.find(x => x.id === presetEl.value);
    if (!p) return;
    const langField = document.getElementById('sp-language');
    if (langField && languages.includes(p.language)) langField.value = p.language;
    const emField = document.getElementById('sp-emotion');
    if (emField) emField.value = p.emotion || 'neutral';
    const insField = document.getElementById('sp-instruction');
    if (insField) insField.value = p.instruction || '';
    const seedField = document.getElementById('sp-seed');
    if (seedField) seedField.value = Number(p.seed) || 0;
    sp.language = langField ? langField.value : sp.language;
    sp.emotion = emField ? emField.value : sp.emotion;
    sp.instruction = insField ? insField.value : sp.instruction;
    sp.seed = Number(seedField ? seedField.value : sp.seed) || 0;
  };

  const savePresetBtn = document.getElementById('sp-save-preset');
  if (savePresetBtn) savePresetBtn.onclick = () => {
    const name = prompt('Preset name:', 'My speech preset');
    if (!name || !name.trim()) return;
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('pulse_speech_presets') || '[]'); } catch (_) { custom = []; }
    if (!Array.isArray(custom)) custom = [];
  const engineEl = document.getElementById('sp-engine');
  if (engineEl) engineEl.onchange = async () => {
    const id = engineEl.value;
    sp.engine = id;
    currentSpeechEngine = id;
    try { await apiPost('/settings', { tts_engine: id }); } catch (_) {}
    renderSpeechSetup();
    updatePromptModelBadge();
  };

  const langEl = document.getElementById('sp-language');
    const emEl = document.getElementById('sp-emotion');
    const insEl = document.getElementById('sp-instruction');
    const seedEl = document.getElementById('sp-seed');
    custom.push({
      id: 'custom_' + Date.now().toString(36),
      name: name.trim(),
      language: langEl ? langEl.value : '',
      emotion: emEl ? emEl.value : 'neutral',
      instruction: insEl ? insEl.value : '',
      seed: Number(seedEl ? seedEl.value : 0) || 0,
    });
    localStorage.setItem('pulse_speech_presets', JSON.stringify(custom));
    renderSpeechSetup();
    showToast('Preset saved');
  };

  document.getElementById('sp-apply').onclick = () => {
    const langField = document.getElementById('sp-language');
    const emField = document.getElementById('sp-emotion');
    const insField = document.getElementById('sp-instruction');
    const seedField = document.getElementById('sp-seed');
    const refField = document.getElementById('sp-ref-text');
    sp.language = langField ? langField.value : sp.language;
    sp.emotion = emField ? emField.value : sp.emotion;
    sp.instruction = insField ? insField.value : sp.instruction;
    sp.seed = Number(seedField ? seedField.value : sp.seed) || 0;
    sp.ref_text = refField ? refField.value : sp.ref_text;
    const text = document.getElementById('sp-text').value;
    const input = document.getElementById('bb-input');
    if (input) { input.value = text; autoResizeBbInput(); }
    tab.prompt = text;
    closeWindow(speechWizardWinId);
    renderAttachments();
    updatePromptModelBadge();
    showToast('Speech settings applied');
  };

  document.getElementById('sp-cancel').onclick = () => closeWindow(speechWizardWinId);
}

function updateAutoPromptUI() {
  const wrap = document.getElementById('bb-auto-prompt-wrap');
  if (bbMode === 'speech') { if (wrap) wrap.style.display = 'none'; return; }
  const isAutoModel = currentVideoModel === 'fasth3' || currentVideoModel === 'ltx';
  if (wrap) wrap.style.display = isAutoModel ? 'flex' : 'none';
  const tab = getActiveBbTab();
  const cb = document.getElementById('bb-auto-prompt-enabled');
  if (cb) {
    const enabled = currentVideoModel === 'fasth3'
      ? !!(tab && tab.h3 && tab.h3.enabled)
      : currentVideoModel === 'ltx'
        ? !!(tab && tab.ltx && tab.ltx.enabled)
        : false;
    cb.checked = enabled;
  }
}

function openH3Wizard() {
  if (currentVideoModel !== 'fasth3') return;
  const tab = getActiveBbTab();
  if (!tab) return;
  if (!tab.h3) initH3StateFromAttachments(tab);
  if (h3WizardWinId && windows[h3WizardWinId]) {
    focusWindow(h3WizardWinId);
    renderH3Wizard();
    return;
  }
  h3WizardWinId = createWindow({
    title: 'FastH3 Auto Prompt',
    icon: 'fa-wand-magic-sparkles',
    width: 740,
    height: 800,
    stateKey: 'FastH3AutoPrompt',
    onClose: () => { h3WizardWinId = null; },
  });
  renderH3Wizard();
}

function renderH3Wizard() {
  if (!h3WizardWinId) return;
  const win = document.getElementById(h3WizardWinId);
  if (!win) return;
  const body = win.querySelector('.window-body');
  if (!body) return;
  const tab = getActiveBbTab();
  if (!tab) {
    body.innerHTML = '<div style="padding:20px;font-size:12px;color:#666">No prompt tab selected.</div>';
    return;
  }
  if (!tab.h3) initH3StateFromAttachments(tab);
  const h3 = tab.h3;
  const images = _bbAttachments.filter(a => a.type === 'image');
  const audios = _bbAttachments.filter(a => a.type === 'audio');
  const presets = getH3Presets();

  const presetOpts = presets.map(p => `<option value="${escAttr(p.id)}"${h3.preset === p.id ? ' selected' : ''}>${escHtml(p.name)}</option>`).join('');

  const subjectRows = images.map((img, i) => {
    const s = (h3.subjects || [])[i] || {};
    const label = img.prompt || img.name || `Image ${i + 1}`;
    const retOpts = ['fully_preserved', 'partially_preserved', 'reference'].map(v => `<option value="${v}"${(s.retention || 'fully_preserved') === v ? ' selected' : ''}>${v}</option>`).join('');
    return `<div class="h3w-row">
      <label>Subject ${i + 1}</label>
      <input type="text" class="h3w-grow h3w-subject-desc" data-idx="${i}" value="${escAttr(s.description || '')}" placeholder="Describe this subject">
      <select class="h3w-subject-ret" data-idx="${i}">${retOpts}</select>
      <span class="h3w-note" title="${escAttr(label)}">${escHtml(label).slice(0, 16)}</span>
    </div>
    <div class="h3w-row">
      <label></label>
      <input type="text" class="h3w-grow h3w-subject-details" data-idx="${i}" value="${escAttr(s.details || '')}" placeholder="Face, hair, clothing details (recommended for identity)">
    </div>`;
  }).join('');

  const audioRows = audios.map((aud, j) => {
    const a = (h3.audios || [])[j] || {};
    const type = a.type || 'speech';
    const subjectOpts = images.length
      ? images.map((_, i) => `<option value="${i}"${Number(a.subjectIndex) === i ? ' selected' : ''}>Subject ${i + 1}</option>`).join('')
      : '<option value="0">Voice</option>';
    const speechFields = type === 'speech'
      ? `<select class="h3w-audio-subject" data-idx="${j}">${subjectOpts}</select>
         <select class="h3w-audio-ret" data-idx="${j}">
           <option value="reference"${(a.retention || 'reference') === 'reference' ? ' selected' : ''}>reference (voice timbre)</option>
           <option value="fully_copy"${a.retention === 'fully_copy' ? ' selected' : ''}>fully_copy (reuse 1:1)</option>
         </select>`
      : `<select class="h3w-audio-ret" data-idx="${j}">
           <option value="fully_copy"${(a.retention || 'fully_copy') === 'fully_copy' ? ' selected' : ''}>fully_copy</option>
           <option value="reference"${a.retention === 'reference' ? ' selected' : ''}>reference</option>
         </select>
         <input type="text" class="h3w-grow h3w-audio-desc" data-idx="${j}" value="${escAttr(a.description || '')}" placeholder="Music/ambient description (optional)">`;
    return `<div class="h3w-row">
      <label>Audio ${j + 1}</label>
      <select class="h3w-audio-type" data-idx="${j}">
        <option value="speech"${type === 'speech' ? ' selected' : ''}>Speech / Voice</option>
        <option value="music"${type === 'music' ? ' selected' : ''}>Music</option>
        <option value="ambient"${type === 'ambient' ? ' selected' : ''}>Ambient / SFX</option>
      </select>
      ${speechFields}
      <span class="h3w-note" title="${escAttr(aud.name || '')}">${escHtml(aud.name || '').slice(0, 16)}</span>
    </div>`;
  }).join('');

  const dialogueRows = (h3.dialogue || []).map((line, k) => {
    const speakerOpts = `<option value="0"${Number(line.speaker) === 0 ? ' selected' : ''}>Voice</option>` +
      images.map((_, i) => `<option value="${i + 1}"${Number(line.speaker) === i + 1 ? ' selected' : ''}>Subject ${i + 1} (S${i + 1})</option>`).join('');
    return `<div class="h3w-row">
      <select class="h3w-dlg-speaker" data-idx="${k}">${speakerOpts}</select>
      <input type="text" class="h3w-dlg-lang" data-idx="${k}" value="${escAttr(line.language || 'English')}" placeholder="Language" style="width:70px">
      <input type="text" class="h3w-grow h3w-dlg-text" data-idx="${k}" value="${escAttr(line.text || '')}" placeholder="Dialogue line">
      <button type="button" class="h3w-btn h3w-dlg-del" data-idx="${k}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  }).join('');

  body.style.padding = '0';
  body.style.background = '#fff';
  body.innerHTML = `
    <div class="h3w">
      <div class="h3w-section">
        <h4>Preset</h4>
        <div class="h3w-row">
          <select id="h3w-preset" class="h3w-grow">${presetOpts}</select>
          <button type="button" id="h3w-save-preset" class="h3w-btn">Save as preset</button>
        </div>
        <div class="h3w-note">Presets fill the scene and speech setting; everything stays editable.</div>
      </div>
      <div class="h3w-section">
        <h4>Scene</h4>
        <textarea id="h3w-scene" placeholder="Describe the scene, action and camera style...">${escHtml(h3.scene || '')}</textarea>
        <label class="h3w-row" style="margin-top:6px">
          <input type="checkbox" id="h3w-has-speech"${h3.hasSpeech ? ' checked' : ''}> This video has dialogue / speech
        </label>
      </div>
      <div class="h3w-section">
        <h4>Subjects (${images.length})</h4>
        ${subjectRows || '<div class="h3w-note">Attach images to the prompt bar to add subjects.</div>'}
      </div>
      <div class="h3w-section">
        <h4>Audio (${audios.length})</h4>
        ${audioRows || '<div class="h3w-note">Attach audio to the prompt bar to add audio references.</div>'}
      </div>
      <div class="h3w-section" id="h3w-dialogue-section" style="${h3.hasSpeech ? '' : 'display:none'}">
        <h4>Dialogue</h4>
        ${dialogueRows || '<div class="h3w-note">No dialogue lines yet.</div>'}
        <button type="button" id="h3w-add-dialogue" class="h3w-btn" style="margin-top:6px">+ Add line</button>
      </div>
      <div class="h3w-section">
        <h4>Prompt preview</h4>
        <textarea id="h3w-preview" class="h3w-preview" readonly></textarea>
      </div>
      <div class="h3w-footer">
        <button type="button" id="h3w-refresh" class="h3w-btn">Refresh attachments</button>
        <button type="button" id="h3w-generate" class="h3w-btn primary">Use Prompt</button>
      </div>
    </div>`;

  const refreshPreview = () => {
    const prev = document.getElementById('h3w-preview');
    if (prev) prev.value = buildH3AutoPrompt(tab);
  };

  const presetEl = document.getElementById('h3w-preset');
  if (presetEl) presetEl.onchange = () => {
    const p = getH3Presets().find(x => x.id === presetEl.value);
    h3.preset = presetEl.value;
    if (p && p.id !== 'none') {
      h3.scene = p.scene || '';
      h3.hasSpeech = !!p.hasSpeech;
    }
    renderH3Wizard();
  };

  const savePresetBtn = document.getElementById('h3w-save-preset');
  if (savePresetBtn) savePresetBtn.onclick = saveH3Preset;

  const sceneEl = document.getElementById('h3w-scene');
  if (sceneEl) sceneEl.oninput = () => { h3.scene = sceneEl.value; refreshPreview(); };

  const speechEl = document.getElementById('h3w-has-speech');
  if (speechEl) speechEl.onchange = () => {
    h3.hasSpeech = speechEl.checked;
    const sec = document.getElementById('h3w-dialogue-section');
    if (sec) sec.style.display = h3.hasSpeech ? '' : 'none';
    refreshPreview();
  };

  body.querySelectorAll('.h3w-subject-desc').forEach(el => {
    el.oninput = () => { const i = Number(el.dataset.idx); h3.subjects[i] = h3.subjects[i] || {}; h3.subjects[i].description = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-subject-details').forEach(el => {
    el.oninput = () => { const i = Number(el.dataset.idx); h3.subjects[i] = h3.subjects[i] || {}; h3.subjects[i].details = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-subject-ret').forEach(el => {
    el.onchange = () => { const i = Number(el.dataset.idx); h3.subjects[i] = h3.subjects[i] || {}; h3.subjects[i].retention = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-audio-type').forEach(el => {
    el.onchange = () => {
      const j = Number(el.dataset.idx);
      h3.audios[j] = h3.audios[j] || {};
      h3.audios[j].type = el.value;
      h3.audios[j].retention = el.value === 'speech' ? 'reference' : 'fully_copy';
      renderH3Wizard();
    };
  });
  body.querySelectorAll('.h3w-audio-subject').forEach(el => {
    el.onchange = () => { const j = Number(el.dataset.idx); h3.audios[j] = h3.audios[j] || {}; h3.audios[j].subjectIndex = Number(el.value) || 0; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-audio-ret').forEach(el => {
    el.onchange = () => { const j = Number(el.dataset.idx); h3.audios[j] = h3.audios[j] || {}; h3.audios[j].retention = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-audio-desc').forEach(el => {
    el.oninput = () => { const j = Number(el.dataset.idx); h3.audios[j] = h3.audios[j] || {}; h3.audios[j].description = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-dlg-speaker').forEach(el => {
    el.onchange = () => { const k = Number(el.dataset.idx); h3.dialogue[k] = h3.dialogue[k] || {}; h3.dialogue[k].speaker = Number(el.value) || 0; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-dlg-lang').forEach(el => {
    el.oninput = () => { const k = Number(el.dataset.idx); h3.dialogue[k] = h3.dialogue[k] || {}; h3.dialogue[k].language = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-dlg-text').forEach(el => {
    el.oninput = () => { const k = Number(el.dataset.idx); h3.dialogue[k] = h3.dialogue[k] || {}; h3.dialogue[k].text = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.h3w-dlg-del').forEach(el => {
    el.onclick = () => {
      const k = Number(el.dataset.idx);
      h3.dialogue.splice(k, 1);
      if (!h3.dialogue.length) h3.dialogue = [{ speaker: 1, language: 'English', text: '' }];
      renderH3Wizard();
    };
  });

  const addDlg = document.getElementById('h3w-add-dialogue');
  if (addDlg) addDlg.onclick = () => {
    h3.dialogue.push({ speaker: 1, language: 'English', text: '' });
    renderH3Wizard();
  };

  const refreshBtn = document.getElementById('h3w-refresh');
  if (refreshBtn) refreshBtn.onclick = () => {
    initH3StateFromAttachments(tab);
    renderH3Wizard();
  };

  const genBtn = document.getElementById('h3w-generate');
  if (genBtn) genBtn.onclick = () => {
    applyH3Prompt(tab);
    refreshPreview();
    showToast('Auto prompt applied to the prompt bar');
  };

  refreshPreview();
}

// ============================================================
// LTX auto prompt builder
// ============================================================
function getLtxPresets() {
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('pulse_ltx_presets') || '[]'); } catch (_) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  return [...LTX_PROMPT_PRESETS, ...custom.filter(p => p && p.id && p.name)];
}

function saveLtxPreset() {
  const tab = getActiveBbTab();
  if (!tab || !tab.ltx) return;
  const name = prompt('Preset name:', 'My LTX preset');
  if (!name || !name.trim()) return;
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('pulse_ltx_presets') || '[]'); } catch (_) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  const l = tab.ltx;
  custom.push({
    id: 'custom_' + Date.now().toString(36),
    name: name.trim(),
    fields: {
      shotType: l.shotType, action: l.action, setting: l.setting,
      camera: l.camera, lighting: l.lighting, style: l.style,
      audioType: l.audioType, audioDescription: l.audioDescription, hasSpeech: l.hasSpeech,
    },
  });
  localStorage.setItem('pulse_ltx_presets', JSON.stringify(custom));
  renderLtxWizard();
  showToast('Preset saved');
}

function initLtxStateFromAttachments(tab) {
  if (!tab) return;
  const images = _bbAttachments.filter(a => a.type === 'image');
  const audios = _bbAttachments.filter(a => a.type === 'audio');
  const prev = tab.ltx || {};
  const firstImg = images[0];
  const rawSubject = firstImg ? (firstImg.prompt || (firstImg.name || '').replace(/\.[^.]+$/, '') || '') : '';
  const subjectDefault = looksLikeGuid(rawSubject) ? '' : rawSubject;
  tab.ltx = {
    enabled: !!prev.enabled,
    preset: prev.preset || 'none',
    shotType: prev.shotType || 'medium shot',
    subject: prev.subject != null ? prev.subject : subjectDefault,
    action: prev.action || '',
    setting: prev.setting || '',
    camera: prev.camera || 'is static',
    lighting: prev.lighting || '',
    style: prev.style || 'cinematic',
    audioType: prev.audioType || (audios.length ? 'music' : 'none'),
    audioDescription: prev.audioDescription || '',
    hasSpeech: prev.hasSpeech != null ? !!prev.hasSpeech : false,
    dialogue: Array.isArray(prev.dialogue) ? prev.dialogue.map(d => ({ ...d })) : [],
  };
  if (!tab.ltx.dialogue.length) {
    tab.ltx.dialogue = [{ speaker: 'subject', language: 'English', text: '' }];
  }
}

function buildLtxAutoPrompt(tab) {
  const ltx = (tab && tab.ltx) || {};
  const images = _bbAttachments.filter(a => a.type === 'image');
  const audios = _bbAttachments.filter(a => a.type === 'audio');
  const hasImage = images.length > 0;
  const hasAudio = audios.length > 0;
  const subject = (ltx.subject || '').trim();
  const action = (ltx.action || '').trim();
  const setting = (ltx.setting || '').trim();
  const shotType = (ltx.shotType || '').trim();
  const camera = (ltx.camera || '').trim();
  const lighting = (ltx.lighting || '').trim();
  const style = (ltx.style || '').trim();
  const audioType = ltx.audioType || 'none';
  const audioDesc = (ltx.audioDescription || '').trim();
  const hasSpeech = !!ltx.hasSpeech || audioType === 'speech';

  const parts = [];
  if (!hasImage) {
    let s = '';
    if (shotType) s += shotType + ' of ';
    s += subject || 'a subject';
    if (action) s += ', ' + action;
    if (setting) s += ', in ' + setting;
    parts.push(s + '.');
  } else {
    let s = subject ? subject + ' ' : '';
    s += action || 'moves naturally';
    parts.push(s + '.');
    if (setting) parts.push('The scene is ' + setting + '.');
  }
  if (camera) parts.push('The camera ' + camera + '.');
  if (lighting) parts.push('The scene is lit by ' + lighting + '.');
  if (style) parts.push('The visual style is ' + style + '.');
  if (hasAudio) {
    if (audioType === 'speech') parts.push('The audio features spoken dialogue.');
    else if (audioType === 'music') parts.push(audioDesc ? 'Music: ' + audioDesc + '.' : 'Music plays in the background.');
    else if (audioType === 'ambient') parts.push(audioDesc ? 'Ambient sound: ' + audioDesc + '.' : 'Ambient sound fills the scene.');
  }
  if (hasSpeech) {
    (ltx.dialogue || []).forEach((line) => {
      const text = (line.text || '').trim();
      if (!text) return;
      const lang = (line.language || 'English').trim();
      const speaker = (line.speaker || 'subject');
      const rawLabel = speaker === 'subject' ? (subject || 'The subject') : speaker;
      const speakerLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
      const langPart = lang && lang.toLowerCase() !== 'english' ? ` in ${lang}` : '';
      const lineText = /[.!?]$/.test(text) ? text : text + '.';
      parts.push(`${speakerLabel} says${langPart}, "${lineText}"`);
    });
  }
  return parts.filter(Boolean).join(' ');
}

function parseLtxPromptState(text, base) {
  const src = String(text || '').trim();
  if (!src) return null;
  const looksLtx =
    /The camera\s+/i.test(src) ||
    /The visual style is\s+/i.test(src) ||
    /The scene is lit by\s+/i.test(src) ||
    /Music:\s*|Music plays in the background\./i.test(src) ||
    /Ambient sound:\s*|Ambient sound fills the scene\./i.test(src) ||
    /The audio features spoken dialogue\./i.test(src);
  if (!looksLtx) return null;

  const baseStr = typeof base === 'string'
    ? base.trim()
    : (base && (base.prompt || base.subject) ? String(base.prompt || base.subject).trim() : '');
  const state = { dialogue: [] };
  const firstMatch = src.match(/^([\s\S]*?)\.(?:\s|$)/);
  const firstSentence = (firstMatch ? firstMatch[1] : src).trim();

  if (baseStr && firstSentence.toLowerCase().startsWith(baseStr.toLowerCase())) {
    const subject = firstSentence.slice(0, baseStr.length).trim() || baseStr;
    const action = firstSentence.slice(baseStr.length).trim();
    if (subject) state.subject = subject;
    if (action) state.action = action;
  } else {
    let head = firstSentence;
    const settingMatch = head.match(/,\s*in\s+(.+)$/i);
    if (settingMatch) {
      state.setting = settingMatch[1].trim();
      head = head.slice(0, settingMatch.index).trim();
    }
    const shotMatch = head.match(/^(extreme close-up|close-up|medium close-up|medium shot|medium wide shot|wide shot|establishing shot|selfie close-up|selfie medium shot|over-the-shoulder shot|overhead shot)\s+of\s+(.+)$/i);
    if (shotMatch) {
      state.shotType = shotMatch[1];
      head = shotMatch[2].trim();
    }
    const commaIdx = head.indexOf(', ');
    if (commaIdx >= 0) {
      state.subject = head.slice(0, commaIdx).trim();
      state.action = head.slice(commaIdx + 2).trim();
    } else if (baseStr) {
      if (head) state.action = head;
    } else {
      if (head) state.subject = head;
    }
  }

  const camera = src.match(/\bThe camera\s+(.+?)\.(?:\s|$)/i);
  if (camera) state.camera = stripTrailingPeriod(camera[1]);
  const lighting = src.match(/\bThe scene is lit by\s+(.+?)\.(?:\s|$)/i);
  if (lighting) state.lighting = stripTrailingPeriod(lighting[1]);
  const style = src.match(/\bThe visual style is\s+(.+?)\.(?:\s|$)/i);
  if (style) state.style = stripTrailingPeriod(style[1]);
  if (state.setting == null) {
    const setting = src.match(/\bThe scene is\s+(?!lit by)(.+?)\.(?:\s|$)/i);
    if (setting) state.setting = stripTrailingPeriod(setting[1]);
  }

  if (/The audio features spoken dialogue\./i.test(src)) {
    state.audioType = 'speech';
  } else {
    const music = src.match(/\bMusic:\s*(.+?)\.(?:\s|$)/i);
    if (music) {
      state.audioType = 'music';
      state.audioDescription = stripTrailingPeriod(music[1]);
    } else if (/Music plays in the background\./i.test(src)) {
      state.audioType = 'music';
      state.audioDescription = '';
    } else {
      const ambient = src.match(/\bAmbient sound:\s*(.+?)\.(?:\s|$)/i);
      if (ambient) {
        state.audioType = 'ambient';
        state.audioDescription = stripTrailingPeriod(ambient[1]);
      } else if (/Ambient sound fills the scene\./i.test(src)) {
        state.audioType = 'ambient';
        state.audioDescription = '';
      }
    }
  }

  const dlgRe = /([^.\n"]+?)\s+says(?: in ([^,]+))?,\s*"([^"]*)"/g;
  let dm;
  while ((dm = dlgRe.exec(src))) {
    const label = dm[1].trim();
    const lower = label.toLowerCase();
    const subjectLower = (state.subject || '').toLowerCase();
    const isSubject = lower === 'subject' || lower === 'the subject' ||
      (!!subjectLower && lower === subjectLower) ||
      (!!baseStr && lower === baseStr.toLowerCase());
    let lineText = dm[3] || '';
    if (/\.$/.test(lineText)) lineText = lineText.slice(0, -1);
    state.dialogue.push({
      speaker: isSubject ? 'subject' : 'A voice',
      language: (dm[2] || 'English').trim() || 'English',
      text: lineText,
    });
  }
  state.hasSpeech = state.dialogue.length > 0 || state.audioType === 'speech';
  return state;
}

function applyLtxPrompt(tab) {
  if (!tab || !tab.ltx) return;
  const text = buildLtxAutoPrompt(tab);
  const input = document.getElementById('bb-input');
  if (input) input.value = text;
  tab.prompt = text;
  tab.ltx.enabled = true;
  updateAutoPromptUI();
  autoResizeBbInput();
}

function openLtxWizard() {
  if (currentVideoModel !== 'ltx') return;
  const tab = getActiveBbTab();
  if (!tab) return;
  if (!tab.ltx) initLtxStateFromAttachments(tab);
  if (ltxWizardWinId && windows[ltxWizardWinId]) {
    focusWindow(ltxWizardWinId);
    renderLtxWizard();
    return;
  }
  ltxWizardWinId = createWindow({
    title: 'LTX Auto Prompt',
    icon: 'fa-wand-magic-sparkles',
    width: 720,
    height: 760,
    stateKey: 'LtxAutoPrompt',
    onClose: () => { ltxWizardWinId = null; },
  });
  renderLtxWizard();
}

function renderLtxWizard() {
  if (!ltxWizardWinId) return;
  const win = document.getElementById(ltxWizardWinId);
  if (!win) return;
  const body = win.querySelector('.window-body');
  if (!body) return;
  const tab = getActiveBbTab();
  if (!tab) {
    body.innerHTML = '<div style="padding:20px;font-size:12px;color:#666">No prompt tab selected.</div>';
    return;
  }
  if (!tab.ltx) initLtxStateFromAttachments(tab);
  const ltx = tab.ltx;
  const images = _bbAttachments.filter(a => a.type === 'image');
  const audios = _bbAttachments.filter(a => a.type === 'audio');
  const hasImage = images.length > 0;
  const hasAudio = audios.length > 0;
  const presets = getLtxPresets();
  const presetOpts = presets.map(p => `<option value="${escAttr(p.id)}"${ltx.preset === p.id ? ' selected' : ''}>${escHtml(p.name)}</option>`).join('');

  const shotOpts = ['extreme close-up', 'close-up', 'medium close-up', 'medium shot', 'medium wide shot', 'wide shot', 'establishing shot', 'selfie close-up', 'selfie medium shot', 'over-the-shoulder shot', 'overhead shot']
    .map(v => `<option value="${v}"${ltx.shotType === v ? ' selected' : ''}>${v}</option>`).join('');
  const cameraOpts = ['is static', 'slowly dollies in', 'slowly dollies out', 'is handheld', 'is handheld and tracking', 'tracks the subject', 'pans across the scene', 'zooms in', 'zooms out', 'slowly orbits the subject']
    .map(v => `<option value="${v}"${ltx.camera === v ? ' selected' : ''}>${v}</option>`).join('');

  const dialogueRows = (ltx.dialogue || []).map((line, k) => `
    <div class="h3w-row">
      <select class="ltx-dlg-speaker" data-idx="${k}">
        <option value="subject"${(line.speaker || 'subject') === 'subject' ? ' selected' : ''}>The subject</option>
        <option value="A voice"${line.speaker === 'A voice' ? ' selected' : ''}>A voice</option>
      </select>
      <input type="text" class="ltx-dlg-lang" data-idx="${k}" value="${escAttr(line.language || 'English')}" placeholder="Language" style="width:70px">
      <input type="text" class="h3w-grow ltx-dlg-text" data-idx="${k}" value="${escAttr(line.text || '')}" placeholder="Dialogue line">
      <button type="button" class="h3w-btn ltx-dlg-del" data-idx="${k}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');

  body.style.padding = '0';
  body.style.background = '#fff';
  body.innerHTML = `
    <div class="h3w">
      <div class="h3w-section">
        <h4>Preset</h4>
        <div class="h3w-row">
          <select id="ltx-preset" class="h3w-grow">${presetOpts}</select>
          <button type="button" id="ltx-save-preset" class="h3w-btn">Save as preset</button>
        </div>
        <div class="h3w-note">${hasImage ? 'Image attached: the image defines appearance — focus on motion, camera and audio.' : 'Text-to-video: describe subject, action, setting, camera, lighting and audio.'}</div>
      </div>
      <div class="h3w-section">
        <h4>Shot</h4>
        <div class="h3w-row">
          <label>Shot</label>
          <select id="ltx-shot" class="h3w-grow">${shotOpts}</select>
        </div>
        <div class="h3w-row">
          <label>Subject</label>
          <input type="text" id="ltx-subject" class="h3w-grow" value="${escAttr(ltx.subject || '')}" placeholder="${hasImage ? 'Brief identifier (the image defines appearance)' : 'Describe the subject'}">
        </div>
        <div class="h3w-row">
          <label>Action</label>
          <textarea id="ltx-action" style="min-height:46px" placeholder="What happens / how the subject moves...">${escHtml(ltx.action || '')}</textarea>
        </div>
        <div class="h3w-row">
          <label>Setting</label>
          <input type="text" id="ltx-setting" class="h3w-grow" value="${escAttr(ltx.setting || '')}" placeholder="Where the scene takes place">
        </div>
        <div class="h3w-row">
          <label>Camera</label>
          <select id="ltx-camera" class="h3w-grow">${cameraOpts}</select>
        </div>
        <div class="h3w-row">
          <label>Lighting</label>
          <input type="text" id="ltx-lighting" class="h3w-grow" value="${escAttr(ltx.lighting || '')}" placeholder="e.g. golden hour, neon, soft studio light">
        </div>
        <div class="h3w-row">
          <label>Style</label>
          <input type="text" id="ltx-style" class="h3w-grow" value="${escAttr(ltx.style || '')}" placeholder="e.g. cinematic, film grain, commercial">
        </div>
      </div>
      <div class="h3w-section">
        <h4>Audio</h4>
        ${hasAudio ? `
        <div class="h3w-row">
          <label>Type</label>
          <select id="ltx-audio-type" class="h3w-grow">
            <option value="none"${(ltx.audioType || 'none') === 'none' ? ' selected' : ''}>None</option>
            <option value="ambient"${ltx.audioType === 'ambient' ? ' selected' : ''}>Ambient / SFX</option>
            <option value="music"${ltx.audioType === 'music' ? ' selected' : ''}>Music</option>
            <option value="speech"${ltx.audioType === 'speech' ? ' selected' : ''}>Speech / Voice</option>
          </select>
        </div>
        <div class="h3w-row">
          <label>Audio</label>
          <input type="text" id="ltx-audio-desc" class="h3w-grow" value="${escAttr(ltx.audioDescription || '')}" placeholder="Describe the audio (music style, ambience, etc.)">
        </div>` : '<div class="h3w-note">Attach audio to the prompt bar to describe it here.</div>'}
        <label class="h3w-row" style="margin-top:6px">
          <input type="checkbox" id="ltx-has-speech"${ltx.hasSpeech ? ' checked' : ''}> This video has dialogue / speech
        </label>
      </div>
      <div class="h3w-section" id="ltx-dialogue-section" style="${(ltx.hasSpeech || ltx.audioType === 'speech') ? '' : 'display:none'}">
        <h4>Dialogue</h4>
        ${dialogueRows || '<div class="h3w-note">No dialogue lines yet.</div>'}
        <button type="button" id="ltx-add-dialogue" class="h3w-btn" style="margin-top:6px">+ Add line</button>
      </div>
      <div class="h3w-section">
        <h4>Prompt preview</h4>
        <textarea id="ltx-preview" class="h3w-preview" readonly></textarea>
      </div>
      <div class="h3w-footer">
        <button type="button" id="ltx-refresh" class="h3w-btn">Refresh attachments</button>
        <button type="button" id="ltx-generate" class="h3w-btn primary">Use Prompt</button>
      </div>
    </div>`;

  const refreshPreview = () => {
    const prev = document.getElementById('ltx-preview');
    if (prev) prev.value = buildLtxAutoPrompt(tab);
  };

  const presetEl = document.getElementById('ltx-preset');
  if (presetEl) presetEl.onchange = () => {
    const p = getLtxPresets().find(x => x.id === presetEl.value);
    ltx.preset = presetEl.value;
    if (p && p.id !== 'none' && p.fields) Object.assign(ltx, p.fields);
    renderLtxWizard();
  };
  const savePresetBtn = document.getElementById('ltx-save-preset');
  if (savePresetBtn) savePresetBtn.onclick = saveLtxPreset;

  const shotEl = document.getElementById('ltx-shot');
  if (shotEl) shotEl.onchange = () => { ltx.shotType = shotEl.value; refreshPreview(); };
  const subjectEl = document.getElementById('ltx-subject');
  if (subjectEl) subjectEl.oninput = () => { ltx.subject = subjectEl.value; refreshPreview(); };
  const actionEl = document.getElementById('ltx-action');
  if (actionEl) actionEl.oninput = () => { ltx.action = actionEl.value; refreshPreview(); };
  const settingEl = document.getElementById('ltx-setting');
  if (settingEl) settingEl.oninput = () => { ltx.setting = settingEl.value; refreshPreview(); };
  const cameraEl = document.getElementById('ltx-camera');
  if (cameraEl) cameraEl.onchange = () => { ltx.camera = cameraEl.value; refreshPreview(); };
  const lightingEl = document.getElementById('ltx-lighting');
  if (lightingEl) lightingEl.oninput = () => { ltx.lighting = lightingEl.value; refreshPreview(); };
  const styleEl = document.getElementById('ltx-style');
  if (styleEl) styleEl.oninput = () => { ltx.style = styleEl.value; refreshPreview(); };

  const audioTypeEl = document.getElementById('ltx-audio-type');
  if (audioTypeEl) audioTypeEl.onchange = () => {
    ltx.audioType = audioTypeEl.value;
    if (ltx.audioType === 'speech') ltx.hasSpeech = true;
    renderLtxWizard();
  };
  const audioDescEl = document.getElementById('ltx-audio-desc');
  if (audioDescEl) audioDescEl.oninput = () => { ltx.audioDescription = audioDescEl.value; refreshPreview(); };

  const speechEl = document.getElementById('ltx-has-speech');
  if (speechEl) speechEl.onchange = () => {
    ltx.hasSpeech = speechEl.checked;
    const sec = document.getElementById('ltx-dialogue-section');
    if (sec) sec.style.display = (ltx.hasSpeech || ltx.audioType === 'speech') ? '' : 'none';
    refreshPreview();
  };

  body.querySelectorAll('.ltx-dlg-speaker').forEach(el => {
    el.onchange = () => { const k = Number(el.dataset.idx); ltx.dialogue[k] = ltx.dialogue[k] || {}; ltx.dialogue[k].speaker = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.ltx-dlg-lang').forEach(el => {
    el.oninput = () => { const k = Number(el.dataset.idx); ltx.dialogue[k] = ltx.dialogue[k] || {}; ltx.dialogue[k].language = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.ltx-dlg-text').forEach(el => {
    el.oninput = () => { const k = Number(el.dataset.idx); ltx.dialogue[k] = ltx.dialogue[k] || {}; ltx.dialogue[k].text = el.value; refreshPreview(); };
  });
  body.querySelectorAll('.ltx-dlg-del').forEach(el => {
    el.onclick = () => {
      const k = Number(el.dataset.idx);
      ltx.dialogue.splice(k, 1);
      if (!ltx.dialogue.length) ltx.dialogue = [{ speaker: 'subject', language: 'English', text: '' }];
      renderLtxWizard();
    };
  });

  const addDlg = document.getElementById('ltx-add-dialogue');
  if (addDlg) addDlg.onclick = () => {
    ltx.dialogue.push({ speaker: 'subject', language: 'English', text: '' });
    renderLtxWizard();
  };
  const refreshBtn = document.getElementById('ltx-refresh');
  if (refreshBtn) refreshBtn.onclick = () => { initLtxStateFromAttachments(tab); renderLtxWizard(); };
  const genBtn = document.getElementById('ltx-generate');
  if (genBtn) genBtn.onclick = () => { applyLtxPrompt(tab); refreshPreview(); showToast('LTX auto prompt applied'); };

  refreshPreview();
}

function parseAssetMetadata(asset) {
  let meta = asset && asset.metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch (_) { meta = {}; }
  }
  return (meta && typeof meta === 'object') ? meta : {};
}

function inferResolutionFromSize(w, h) {
  if (!w && !h) return null;
  const long = Math.max(w || 0, h || 0);
  if (long >= 1500) return '1080p';
  if (long >= 900) return '720p';
  if (long >= 400) return '480p';
  return null;
}

async function ensureAssetPool() {
  if (allAssets && allAssets.length) return allAssets;
  try {
    const hist = await apiGet('/history');
    allAssets = hist || [];
    _libCache.assets = allAssets;
    return allAssets;
  } catch (_) {
    return allAssets || [];
  }
}

async function restoreAttachmentsFromGen(gen) {
  const atts = (gen && gen.attachments) || {};
  // Support both nested {images,audio,lora} and accidental flat arrays
  const images = Array.isArray(atts.images) ? atts.images : (Array.isArray(atts) ? atts.filter(a => a && a.type === 'image') : []);
  let audios = Array.isArray(atts.audios) ? atts.audios.filter(Boolean) : [];
  if (!audios.length && atts.audio) audios = [atts.audio];
  const lora = atts.lora || null;
  let missing = 0;

  const pool = await ensureAssetPool();

  function findAsset(ref, typeHint) {
    if (!ref) return null;
    if (ref.id) {
      const byId = pool.find(a => a.id === ref.id);
      if (byId) return byId;
    }
    const name = ref.name || ref.filename;
    if (!name) return null;
    const base = name.split('/').pop();
    return pool.find(a => {
      if (typeHint === 'image' && a.type && a.type !== 'image') return false;
      if (typeHint === 'audio' && a.type && a.type !== 'audio') return false;
      return a.filename === name || a.filename === base;
    }) || null;
  }

  _bbAttachments = [];

  // LoRA cannot mix with media — prefer media when both present
  const hasMedia = images.length > 0 || audios.length > 0;
  if (lora && lora.name && !hasMedia) {
    _bbAttachments.push({ type: 'lora', name: lora.name });
    renderAttachments();
    return { missing: 0 };
  }

  for (const img of images) {
    if (!img) { missing++; continue; }
    const asset = findAsset(img, 'image');
    const filename = (asset && asset.filename) || img.name || img.filename || '';
    if (!filename) {
      missing++;
      continue;
    }
    const aspect = asset
      ? ((asset.width && asset.height) ? asset.width / asset.height : parseAspectRatio(asset.aspect_ratio))
      : 1.5;
    _bbAttachments.push({
      type: 'image',
      name: filename,
      src: `/images/${filename}`,
      aspect: aspect && isFinite(aspect) ? aspect : 1.5,
      id: (asset && asset.id) || img.id || '',
      prompt: (asset && asset.prompt) || '',
    });
  }

  for (const audio of audios) {
    const asset = findAsset(audio, 'audio');
    const filename = (asset && asset.filename) || audio.name || audio.filename || '';
    if (!filename) {
      missing++;
    } else {
      _bbAttachments.push({
        type: 'audio',
        name: filename,
        src: `/audio/${filename}`,
        id: (asset && asset.id) || audio.id || '',
        prompt: (asset && asset.prompt) || '',
      });
    }
  }

  renderAttachments();
  return { missing };
}

async function applyGenToBottomBar(asset) {
  if (!asset) return;

  // Always re-fetch from history so we get fresh metadata.gen from DB
  let full = asset;
  try {
    const hist = await apiGet('/history');
    if (Array.isArray(hist)) {
      allAssets = hist;
      _libCache.assets = hist;
      _libCache.childrenMap = buildChildrenMap(hist);
      if (asset.id) {
        const found = hist.find(a => a.id === asset.id);
        if (found) full = found;
      }
    }
  } catch (_) {}

  const input = document.getElementById('bb-input');
  if (input) input.value = '';
  clearBottomBarAttachments();

  const meta = parseAssetMetadata(full);
  const gen = meta.gen || null;
  const promptText = (gen && gen.original_prompt) || full.prompt || '';
  if (input) input.value = promptText;
  autoResizeBbInput();

  const isVideoAsset = full.type === 'video' || (full.filename && full.filename.endsWith('.mp4'));
  const mode = (gen && gen.mode) || (isVideoAsset ? 'video' : 'image');
  setBottomBarMode(mode);

  const res =
    (gen && gen.resolution) ||
    inferResolutionFromSize(full.width, full.height) ||
    bbRes ||
    '720p';
  setBottomBarRes(res);

  setBottomBarAr((gen && gen.aspect_ratio) || full.aspect_ratio || bbAr || '3:2');
  if (mode === 'video') {
    const dur = (gen && gen.duration != null)
      ? gen.duration
      : (meta.duration != null ? meta.duration : (full.duration != null ? full.duration : bbDuration));
    setBottomBarDuration(dur);
  }
  setBottomBarEnhancer((gen && gen.enhancer_id) || 'none');
  setBottomBarUpscale(!!((gen && gen.video_upscale === 'relayvsr_x2') || (gen && gen.upscale && gen.upscale.status === 'done')));

  let missing = 0;
  if (gen) {
    const r = await restoreAttachmentsFromGen(gen);
    missing = r.missing || 0;
  } else if (full.parent_id) {
    // Fallback: variations/children without gen — re-attach parent as source image
    const pool = await ensureAssetPool();
    const parent = pool.find(a => a.id === full.parent_id);
    if (parent && parent.filename && parent.type !== 'audio' && parent.type !== 'video') {
      const aspect = (parent.width && parent.height)
        ? parent.width / parent.height
        : parseAspectRatio(parent.aspect_ratio);
      _bbAttachments.push({
        type: 'image',
        name: parent.filename,
        src: `/images/${parent.filename}`,
        aspect: aspect && isFinite(aspect) ? aspect : 1.5,
        id: parent.id || '',
        prompt: parent.prompt || '',
      });
      renderAttachments();
    }
  }

  const updates = {};
  if (gen && gen.image_model) {
    currentImageModel = gen.image_model;
    updates.image_model = gen.image_model;
  }
  if (gen && gen.i2i_model) {
    currentI2iModel = gen.i2i_model;
    updates.i2i_model = gen.i2i_model;
  }
  if (gen && gen.video_model) {
    currentVideoModel = gen.video_model;
    updates.video_model = gen.video_model;
    updatePromptHelpVisibility();
    if (currentVideoModel === 'grok') {
      _bbAttachments = _bbAttachments.filter(a => a.type !== 'audio');
      renderAttachments();
    }
  }
  if (gen && gen.ltx_version) {
    currentLtxVersion = String(gen.ltx_version) === '2.5' ? '2.5' : '2.3';
    updates.ltx_version = currentLtxVersion;
  }
  if (gen && gen.fasth3_mode) {
    currentFastH3Mode = gen.fasth3_mode === 'i2v' ? 'i2v' : 'reference';
    updates.fasth3_mode = currentFastH3Mode;
  }
  if (Object.keys(updates).length) {
    try { await apiPost('/settings', updates); } catch (_) {}
  }
  updatePromptModelBadge();

  const tab = getActiveBbTab();
  if (mode === 'video' && tab && currentVideoModel === 'fasth3') {
    const savedH3 = (gen && gen.h3 && typeof gen.h3 === 'object')
      ? JSON.parse(JSON.stringify(gen.h3))
      : null;
    const parsedH3 = !savedH3 && promptText ? parseH3PromptState(promptText) : null;
    const src = savedH3 || parsedH3;
    tab.h3 = null;
    initH3StateFromAttachments(tab);
    if (src) {
      if (Array.isArray(src.subjects)) {
        tab.h3.subjects = tab.h3.subjects.map((def, i) => {
          const saved = src.subjects[i] || {};
          return {
            description: saved.description != null ? saved.description : def.description,
            details: saved.details != null ? saved.details : def.details,
            retention: saved.retention || def.retention,
          };
        });
      }
      if (Array.isArray(src.audios)) {
        tab.h3.audios = tab.h3.audios.map((def, j) => {
          const saved = src.audios[j] || {};
          return {
            type: saved.type || def.type,
            subjectIndex: Number.isInteger(saved.subjectIndex) ? saved.subjectIndex : def.subjectIndex,
            retention: saved.retention || def.retention,
            language: saved.language || def.language,
            description: saved.description != null ? saved.description : def.description,
          };
        });
      }
      if (src.scene != null) tab.h3.scene = src.scene;
      if (src.preset != null) tab.h3.preset = src.preset;
      if (src.hasSpeech != null) tab.h3.hasSpeech = !!src.hasSpeech;
      if (Array.isArray(src.dialogue)) tab.h3.dialogue = src.dialogue.map(d => ({ ...d }));
      tab.h3.enabled = parsedH3 ? true : !!src.enabled;
    }
    if (!tab.h3.dialogue.length) tab.h3.dialogue = [{ speaker: 1, language: 'English', text: '' }];
    if (h3WizardWinId && windows[h3WizardWinId]) renderH3Wizard();
  }
  if (mode === 'video' && tab && currentVideoModel === 'ltx') {
    const savedLtx = (gen && gen.ltx && typeof gen.ltx === 'object')
      ? JSON.parse(JSON.stringify(gen.ltx))
      : null;
    const firstImg = _bbAttachments.find(a => a.type === 'image');
    const basePrompt = firstImg ? (firstImg.prompt || '') : '';
    const parsedLtx = !savedLtx && promptText ? parseLtxPromptState(promptText, basePrompt) : null;
    const src = savedLtx || parsedLtx;
    tab.ltx = null;
    initLtxStateFromAttachments(tab);
    if (src) {
      ['shotType', 'subject', 'action', 'setting', 'camera', 'lighting', 'style', 'audioType', 'audioDescription'].forEach((key) => {
        if (src[key] == null) return;
        if (parsedLtx && src[key] === '') return;
        tab.ltx[key] = src[key];
      });
      if (src.hasSpeech != null) tab.ltx.hasSpeech = !!src.hasSpeech;
      if (Array.isArray(src.dialogue)) tab.ltx.dialogue = src.dialogue.map(d => ({ ...d }));
      tab.ltx.enabled = parsedLtx ? true : !!src.enabled;
    }
    if (!tab.ltx.dialogue.length) tab.ltx.dialogue = [{ speaker: 'subject', language: 'English', text: '' }];
    if (ltxWizardWinId && windows[ltxWizardWinId]) renderLtxWizard();
  }
  if (tab) tab.prompt = promptText;
  updateAutoPromptUI();

  if (!gen) {
    showToast('Loaded prompt (no saved gen settings — re-generate once to capture full settings)', 'warning');
  } else if (missing > 0) {
    showToast(`Loaded prompt (${missing} attachment${missing === 1 ? '' : 's'} missing)`, 'warning');
  } else {
    showToast('Prompt loaded into bottom bar');
  }
  refreshOpenModelDialogs();
}

async function bbSend() {
  const input = document.getElementById('bb-input');
  let prompt = input.value.trim();
  if (!prompt) return;

  if (bbMode === 'speech') {
    const voice = _bbAttachments.find(a => a.type === 'voice');
    if (!voice) { showToast('Drag a voice from the Voices library into the prompt bar', 'error'); return; }
    const sp = getSpeechConfig();
    const voiceAsset = (allAssets || []).find(a => String(a.id) === String(voice.id));
    const voiceTranscript = (voiceAsset && voiceAsset.metadata && voiceAsset.metadata.voice && voiceAsset.metadata.voice.transcript) || '';
    const job = {
      id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      prompt, original_prompt: prompt, mode: 'speech',
      speech: { ...sp, ref_text: (sp.ref_text || voiceTranscript || '') },
      attVoice: { id: voice.id || '', name: voice.name || '' },
    };
    _genQueue.push(job); updateQueueBadge(); processNext(); return;
  }

  // Show rainbow immediately
  document.querySelector('.bb-inner')?.classList.add('is-generating');

  // Capture attachments immediately (before async enhancement)
  const attImages = _bbAttachments.filter(a => a.type === 'image');
  const attAudios = _bbAttachments.filter(a => a.type === 'audio');
  const attAudio = attAudios[0] || null;
  const attLora = _bbAttachments.find(a => a.type === 'lora');
  const activeTab = getActiveBbTab();

  // Grok and FastH3 video max 15s
  let jobDuration = bbDuration;
  if (bbMode === 'video' && (currentVideoModel === 'grok' || currentVideoModel === 'fasth3') && jobDuration > 15) {
    jobDuration = 15;
    showToast((currentVideoModel === 'grok' ? 'Grok' : 'FastH3') + ' video max 15s — using 15s', 'warning');
  }

  // Create job snapshot and queue it now so badge shows +1 immediately
  const job = {
    id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    prompt,
    original_prompt: prompt, // BEFORE enhance — do not overwrite after enhance
    mode: bbMode,
    resolution: bbRes,
    aspect_ratio: bbAr,
    duration: jobDuration,
    enhancer_id: bbEnhancer || 'none',
    image_model: currentImageModel || 'schnell',
    i2i_model: currentI2iModel || 'klein',
    video_model: currentVideoModel || 'ltx',
    ltx_version: currentLtxVersion || '2.3',
    fasth3_mode: currentFastH3Mode || 'reference',
    video_upscale: (bbMode === 'video' && bbUpscale) ? 'relayvsr_x2' : 'off',
    attImages: attImages.map(a => ({ id: a.id, name: a.name, type: a.type })),
    // Grok never sends audio
    attAudios: (currentVideoModel === 'grok') ? [] : attAudios.map(a => ({ id: a.id, name: a.name, type: a.type })),
    attAudio: (currentVideoModel === 'grok') ? null : (attAudio ? { id: attAudio.id, name: attAudio.name, type: attAudio.type } : null),
    attLora: attLora ? { id: attLora.id, name: attLora.name, type: attLora.type } : null,
    h3: (bbMode === 'video' && activeTab && activeTab.h3) ? JSON.parse(JSON.stringify(activeTab.h3)) : null,
    ltx: (bbMode === 'video' && activeTab && activeTab.ltx) ? JSON.parse(JSON.stringify(activeTab.ltx)) : null,
  };

  _genQueue.push(job);
  updateQueueBadge();
  // Keep input and attachments so user can tweak and re-submit

  // Now run enhancement (updates job.prompt only; original_prompt stays pre-enhance)
  const structuredH3 = /subject_definitions:/i.test(prompt);
  if (!structuredH3 && bbEnhancer && bbEnhancer !== 'none' && isOllamaConnected) {
    const enh = bbEnhancersList.find(e => e.id === bbEnhancer);
    if (enh && enh.prompt) {
      try {
        const res = await apiPost('/ollama/enhance', { prompt, enhancer: enh.prompt });
        if (res.enhanced) job.prompt = res.enhanced;
      } catch (e) { /* fall back to original prompt */ }
    }
  }

  // Start processing (jobs run sequentially)
  if (!_isProcessingQueue) processNext();
}

function getLibWid() {
  const entry = Object.entries(windows).find(([id, w]) => w.title === 'Library');
  return entry ? entry[0] : null;
}

async function refreshLibraryFromDB() {
  const w = getLibWid();
  if (!w) return;
  try {
    const assets = await apiGet('/history');
    allAssets = assets || [];
    _libCache.assets = allAssets;
    _libCache.childrenMap = buildChildrenMap(allAssets);
    renderLibrary(w);
  } catch (_) {}
}

async function saveGenerationWithGen(job, fields, extraMeta) {
  const gen = buildGenMetadata(job);
  const metadata = Object.assign({ gen }, extraMeta || {});
  const body = Object.assign({}, fields, { metadata });
  // Drop undefined keys (JSON.stringify does this, but keep body clean)
  Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k]; });
  const saved = await apiPost('/save-generation', body);
  if (!saved || !saved.success) {
    console.warn('[save-generation] failed', saved);
    throw new Error((saved && saved.error) || 'save failed');
  }
  return { saved, metadata };
}

async function runJob(job) {
  // Ensure arrays always exist
  if (!Array.isArray(job.attImages)) job.attImages = [];

  if (job.mode === 'image') {
    let count;
    const bodyPayload = {
      prompt: job.prompt,
      resolution: job.resolution,
      aspect_ratio: job.aspect_ratio,
      mode: 'image',
      image_model: job.image_model,
      i2i_model: job.i2i_model,
    };
    if (job.attLora) bodyPayload.lora_name = job.attLora.name;
    if (job.attImages.length === 2) {
      count = 1;
      bodyPayload.source_image = job.attImages[0].name;
      bodyPayload.modifier_image = job.attImages[1].name;
    } else if (job.attImages.length === 1) {
      count = 1;
      bodyPayload.source_image = job.attImages[0].name;
    } else {
      count = 4;
    }
    bodyPayload.count = count;
    bodyPayload.job_id = job.id;
    showGenToastPanel(count);
    const stopProgress = startProgressPolling(job.id, (p) => updateGenToastProgress(p.index ?? 0, p));

    try {
      const r = await fetch('/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let idx = 0;
      let lastErr = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const ev = JSON.parse(line.substring(6));
          if (ev.type === 'error') {
            lastErr = ev.error || lastErr || 'Unknown error';
            continue;
          }
          if (ev.type === 'image_ready' && idx < count) {
            try {
              const { saved, metadata } = await saveGenerationWithGen(job, {
                prompt: job.prompt,
                filename: ev.local_filename,
                type: 'image',
                aspect_ratio: job.aspect_ratio,
                width: ev.width || 0,
                height: ev.height || 0,
                parent_id: job.attImages.length ? job.attImages[0].id : undefined,
              });
              if (saved && saved.id) {
                allAssets.unshift({
                  id: saved.id, type: 'image', filename: ev.local_filename, prompt: job.prompt,
                  width: ev.width || 0, height: ev.height || 0, aspect_ratio: job.aspect_ratio,
                  metadata, parent_id: job.attImages.length ? job.attImages[0].id : null,
                });
                _libCache.assets = allAssets;
                _libCache.childrenMap = buildChildrenMap(allAssets);
              }
            } catch (err) {
              console.warn('[runJob] image save failed', err);
            }
            const badge = ev.width && ev.height ? `${ev.width}x${ev.height}` : '';
            const html = `<img src="/images/${ev.local_filename}" loading="lazy">${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
            fillGenToastCard(idx, html, () => refreshLibraryFromDB());
            idx++;
          }
        }
      }
      // Final library sync from DB once all results are in
      if (idx > 0) await refreshLibraryFromDB();
      if (idx === 0) {
        showToast(lastErr || 'Generation returned no results', 'error');
        cleanupGenToast();
      }
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error');
      cleanupGenToast();
    } finally {
      stopProgress();
    }
  } else if (job.mode === 'speech') {
    const v = job.attVoice || {};
    const sp = job.speech || {};
    showGenToastPanel(1);
    const stopProgress = startProgressPolling(job.id, (p) => updateGenToastProgress(0, p));
    try {
      const res = await apiPost('/tts/generate', {
        text: job.prompt, voice_id: v.id || '', voice_filename: v.name || '',
        engine: sp.engine || 'qwen3', language: sp.language || 'English',
        emotion: sp.emotion || 'neutral', instruction: sp.instruction || '',
        ref_text: sp.ref_text || '', seed: Number(sp.seed) || 0, job_id: job.id,
      });
      if (res && res.success) {
        const label = String(res.name || job.prompt || 'Speech').trim();
        const preview = label.length > 90 ? label.slice(0, 90) + '...' : label;
        const dur = res.duration ? `<span style="font-size:9px;opacity:0.7">${Number(res.duration).toFixed(1)}s</span>` : '';
        fillGenToastCard(0, `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;height:100%;padding:8px;box-sizing:border-box;color:#fff;background:#0b0b0b">
            <i class="fa-solid fa-microphone-lines" style="font-size:18px;color:#a78bfa"></i>
            <div style="font-size:10px;line-height:1.3;text-align:center;max-width:100%;word-break:break-word">${escHtml(preview)}</div>
            ${dur}
            <audio controls src="/audio/${encodeURIComponent(res.filename)}" style="width:100%;height:30px"></audio>
          </div>`, () => refreshLibraryFromDB(), 6000);
        await refreshLibraryFromDB();
        showToast('Speech saved to Audio');
      } else {
        showToast((res && res.error) || 'Speech generation failed', 'error');
        cleanupGenToast();
      }
    } catch (e) {
      showToast('Speech generation failed: ' + e.message, 'error');
      cleanupGenToast();
    } finally {
      stopProgress();
    }
  } else {
    // Video mode
    showGenToastPanel(1);

    const vidPayload = {
      prompt: job.prompt,
      resolution: job.resolution,
      aspect_ratio: job.aspect_ratio,
      mode: 'video',
      duration: job.duration,
      image_model: job.image_model,
      i2i_model: job.i2i_model,
      video_model: job.video_model || currentVideoModel || 'ltx',
      ltx_version: job.ltx_version || currentLtxVersion || '2.3',
      fasth3_mode: job.fasth3_mode || currentFastH3Mode || 'reference',
      video_upscale: job.video_upscale || 'off',
    };
    const currentTab = getActiveBbTab();
    if (currentTab && currentTab.ltx && currentTab.ltx.enabled) {
      vidPayload.disable_prompt_enhance = true;
    }
    if (job.attLora) vidPayload.lora_name = job.attLora.name;
    if (job.attAudio && job.attImages.length === 1) {
      vidPayload.source_image = job.attImages[0].name;
      vidPayload.modifier_audio = job.attAudio.name;
    } else if (job.attImages.length === 1) {
      vidPayload.source_image = job.attImages[0].name;
    }
    // FastH3 multi-reference: send all images/audios in attachment order
    if ((job.video_model || currentVideoModel) === 'fasth3') {
      if (job.attImages && job.attImages.length) {
        vidPayload.ref_images = job.attImages.map(a => a.name);
      }
      const auds = job.attAudios || [];
      if (auds.length) {
        vidPayload.ref_audios = auds.map(a => a.name);
      }
    }
    vidPayload.job_id = job.id;
    const stopProgress = startProgressPolling(job.id, (p) => updateGenToastProgress(0, p), { stopOnFinished: false });
    try {
      const res = await apiPost('/generate', vidPayload);
      if (res.success && res.results) {
        let anyOk = false;
        let lastVidErr = '';
        for (let idx = 0; idx < res.results.length; idx++) {
          const r = res.results[idx];
          if (r.success) {
            anyOk = true;
            job.upscale = r.upscale || null;
            try {
              const { saved, metadata } = await saveGenerationWithGen(job, {
                prompt: job.prompt,
                filename: r.local_filename,
                type: 'video',
                aspect_ratio: job.aspect_ratio,
                width: r.width || 0,
                height: r.height || 0,
                duration: r.duration || null,
                parent_id: job.attImages.length ? job.attImages[0].id : undefined,
              });
              if (saved && saved.id) {
                allAssets.unshift({
                  id: saved.id, type: 'video', filename: r.local_filename, prompt: job.prompt,
                  width: r.width || 0, height: r.height || 0, duration: r.duration,
                  aspect_ratio: job.aspect_ratio, metadata,
                  parent_id: job.attImages.length ? job.attImages[0].id : null,
                });
                _libCache.assets = allAssets;
                _libCache.childrenMap = buildChildrenMap(allAssets);
              }
            } catch (err) {
              console.warn('[runJob] video save failed', err);
            }
            if (r.upscale && r.upscale.status === 'failed') {
              showToast('Upscale failed — original video saved', 'warning');
            }
            const badge = r.duration ? `${r.duration}s` : '';
            const html = `<video src="/videos/${r.local_filename}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
            fillGenToastCard(idx, html, () => refreshLibraryFromDB());
          } else {
            lastVidErr = r.error || lastVidErr || 'Unknown error';
          }
        }
        if (anyOk) await refreshLibraryFromDB();
        else {
          showToast(lastVidErr || 'Video generation failed', 'error');
          cleanupGenToast();
        }
      } else {
        showToast((res && res.error) || 'Video generation failed', 'error');
        cleanupGenToast();
      }
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error');
      cleanupGenToast();
    } finally {
      stopProgress();
    }
  }
}

function cleanupGenToast() {
  const p = document.getElementById('gen-toast-panel');
  if (p) p.remove();
  if (!_genQueue.length) {
    document.querySelector('.bb-inner')?.classList.remove('is-generating');
  }
}

function updateQueueBadge() {
  const badge = document.getElementById('bb-queue-badge');
  if (!badge) return;
  if (_genQueue.length) {
    badge.textContent = '+' + _genQueue.length;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

async function processNext() {
  if (!_genQueue.length) {
    _isProcessingQueue = false;
    updateQueueBadge();
    if (!document.querySelector('.gen-toast-panel')) {
      document.querySelector('.bb-inner')?.classList.remove('is-generating');
    }
    return;
  }
  _isProcessingQueue = true;
  document.querySelector('.bb-inner')?.classList.add('is-generating');
  updateQueueBadge();
  const job = _genQueue.shift();
  updateQueueBadge();
  try {
    await runJob(job);
  } catch (e) {
    showToast('Job failed: ' + e.message, 'error');
  }
  processNext();
}

// ============================================================
// Admin functions
// ============================================================

function escAttr(s) {
  return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function generateAllThumbnails() {
  try {
    const res = await apiPost('/admin/generate-thumbnails');
    showToast(`Generated ${res.generated} thumbnails (${res.failed} failed, ${res.skipped} skipped)`, res.failed ? 'warning' : 'success');
  } catch (e) {
    showToast('Failed to generate thumbnails: ' + e.message, 'error');
  }
}

function uidFromPath(path) {
  return path.replace(/\./g, '_').replace(/\[/g, '_').replace(/\]/g, '');
}

function renderTreeValue(settingKey, value, path, depth) {
  const indent = depth * 24;
  const label = depth === 0 ? settingKey : path.split('.').pop().replace(/\[(\d+)\]$/, '[$1]');

  if (value === null || value === undefined) {
    return `<div style="padding:2px 0;margin-left:${indent}px;display:flex;align-items:center;gap:6px">
      <span class="se-tree-key" style="font-size:11px;font-weight:600;color:#333">${escHtml(label)}</span>
      <input type="text" class="se-input" data-spath="${path}" value="" style="flex:1;padding:3px 6px;font-size:11px;border:1px solid #d1d5db;border-radius:3px;font-family:monospace;color:#000;max-width:400px">
      <span class="se-saved" style="font-size:9px;color:#22c55e;opacity:0;flex-shrink:0">Saved</span>
    </div>`;
  }

  if (typeof value !== 'object') {
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    let input;
    if (isBool) {
      input = `<input type="checkbox" class="se-input" data-spath="${path}" ${value ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:#6366f1;flex-shrink:0">`;
    } else if (isNum) {
      input = `<input type="number" class="se-input" data-spath="${path}" value="${escAttr(String(value))}" style="flex:1;padding:3px 6px;font-size:11px;border:1px solid #d1d5db;border-radius:3px;font-family:monospace;color:#000;max-width:400px">`;
    } else {
      input = `<input type="text" class="se-input" data-spath="${path}" value="${escAttr(value)}" style="flex:1;padding:3px 6px;font-size:11px;border:1px solid #d1d5db;border-radius:3px;font-family:monospace;color:#000;max-width:400px">`;
    }
    return `<div style="padding:2px 0;margin-left:${indent}px;display:flex;align-items:center;gap:6px;min-height:26px">
      <span class="se-tree-key" style="font-size:11px;font-weight:600;color:#333;white-space:nowrap">${escHtml(label)}</span>
      <div style="display:flex;align-items:center;gap:4px;flex:1">${input}</div>
      <span class="se-saved" style="font-size:9px;color:#22c55e;opacity:0;flex-shrink:0">Saved</span>
    </div>`;
  }

  const isArr = Array.isArray(value);
  const count = isArr ? value.length : Object.keys(value).length;
  const itemLabel = isArr ? `${count} items` : `${count} keys`;
  const uid = uidFromPath(path);
  const openStart = false;

  let html = `<div data-se-parent="${uid}" data-se-type="${isArr ? 'array' : 'object'}" style="margin-left:${indent}px">
    <div class="se-toggle" data-target="${uid}" style="display:flex;align-items:center;gap:4px;padding:3px 0;cursor:pointer;user-select:none">
      <span class="se-arrow" style="font-size:9px;color:#888;width:12px;text-align:center;transition:transform 0.15s">${openStart ? '&#9660;' : '&#9654;'}</span>
      <span style="font-size:11px;font-weight:600;color:#333">${escHtml(label)}</span>
      <span style="font-size:10px;color:#999;font-weight:400">(${itemLabel})</span>
    </div>
    <div class="se-children" id="se-${uid}" style="display:${openStart ? 'block' : 'none'}">`;

  if (isArr) {
    value.forEach((item, idx) => {
      html += renderTreeValue(settingKey, item, `${path}[${idx}]`, depth + 1);
    });
  } else {
    Object.keys(value).forEach(k => {
      html += renderTreeValue(settingKey, value[k], `${path}.${k}`, depth + 1);
    });
  }

  html += `</div></div>`;
  return html;
}

function reconstructValueFromTree(path, bodyEl) {
  const directInput = bodyEl.querySelector(`[data-spath="${CSS.escape(path)}"]`);
  if (directInput) {
    if (directInput.type === 'checkbox') return directInput.checked;
    if (directInput.type === 'number') return Number(directInput.value);
    return directInput.value;
  }

  // Check for empty object/array: look up the parent's data-se-type
  const parentEl = bodyEl.querySelector(`[data-se-parent="${uidFromPath(path)}"]`);
  if (parentEl) {
    const childInputs = bodyEl.querySelectorAll(`[data-spath^="${path}."], [data-spath^="${path}["]`);
    if (childInputs.length === 0) {
      return parentEl.dataset.seType === 'array' ? [] : {};
    }
  }

  const childInputs = bodyEl.querySelectorAll(`[data-spath^="${path}."], [data-spath^="${path}["]`);
  if (childInputs.length === 0) return null;

  const isArr = bodyEl.querySelector(`[data-spath^="${path}[0]"]`) !== null;

  if (isArr) {
    const arr = {};
    childInputs.forEach(inp => {
      const m = inp.dataset.spath.match(/^(.+?)\[(\d+)\](.*)$/);
      if (m && m[1] === path) {
        const idx = parseInt(m[2]);
        const rest = m[3];
        if (!rest) {
          arr[idx] = inp.type === 'checkbox' ? inp.checked : inp.value;
        } else {
          arr[idx] = reconstructValueFromTree(`${path}[${idx}]`, bodyEl);
        }
      }
    });
    const keys = Object.keys(arr).map(Number);
    const maxIdx = Math.max(...keys, -1);
    return Array.from({ length: maxIdx + 1 }, (_, i) => i in arr ? arr[i] : null);
  }

  const obj = {};
  childInputs.forEach(inp => {
    const rest = inp.dataset.spath.substring(path.length + 1);
    const childKey = rest.split('.')[0].split('[')[0];
    const childPath = `${path}.${childKey}`;
    if (!(childKey in obj)) {
      const directChild = bodyEl.querySelector(`[data-spath="${CSS.escape(childPath)}"]`);
      if (directChild) {
        obj[childKey] = directChild.type === 'checkbox' ? directChild.checked
          : directChild.type === 'number' ? Number(directChild.value)
          : directChild.value;
      } else {
        obj[childKey] = reconstructValueFromTree(childPath, bodyEl);
      }
    }
  });
  return obj;
}

function openSettingsEditor() {
  const wid = createWindow({ title: 'Settings Editor', icon: 'fa-sliders', width: 700, height: 500, stateKey: 'SettingsEditor' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = '#fff';
  body.style.padding = '0';
  body.innerHTML = '<div style="padding:20px;text-align:center;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  (async () => {
    let settings = [];
    let settingKeys = [];

    async function saveSEState() {
      const openNodes = new Set();
      document.querySelectorAll('[id^="se-"]').forEach(el => {
        if (el.style.display === 'block') openNodes.add(el.id.replace('se-', ''));
      });
      return { openNodes, scrollTop: document.getElementById('se-scroll')?.scrollTop || 0 };
    }

    function restoreSEState(state) {
      const { openNodes } = state;
      openNodes.forEach(uid => {
        const el = document.getElementById('se-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.se-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.se-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
    }

    async function renderSE(savedState) {
      if (!savedState) savedState = await saveSEState();
      let html = `
        <div style="display:flex;flex-direction:column;height:100%">
          <div id="se-scroll" style="flex:1;overflow-y:auto;min-height:0;padding:8px 0 8px 10px">`;

      settings.forEach(s => {
        const key = s.key;
        const raw = s.value;
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch (_) {}
        html += renderTreeValue(key, parsed, key, 0);
      });

      html += `
          </div>
          <div style="padding:10px 16px;border-top:1px solid #e0e0e0;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0">
            <button id="se-refresh" class="server-save-btn" style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-rotate"></i> Refresh</button>
            <button id="se-save-all" class="server-save-btn">Save All Changes</button>
          </div>
        </div>`;
      body.innerHTML = html;
      const scrollEl = document.getElementById('se-scroll');
      if (scrollEl) scrollEl.scrollTop = savedState.scrollTop;
      restoreSEState(savedState);

      // Toggle collapse/expand
      body.querySelectorAll('.se-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const target = document.getElementById('se-' + toggle.dataset.target);
          const arrow = toggle.querySelector('.se-arrow');
          if (target) {
            const isOpen = target.style.display !== 'none';
            target.style.display = isOpen ? 'none' : 'block';
            arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
          }
        });
      });

      // Refresh
      document.getElementById('se-refresh').onclick = async () => {
        const icon = document.querySelector('#se-refresh i');
        icon.classList.add('fa-spin');
        const state = await saveSEState();
        try {
          const res = await apiGet('/admin/settings');
          settings = res.settings || [];
          settingKeys = settings.map(s => s.key);
          await renderSE(state);
        } catch (e) {
          showToast('Refresh failed: ' + e.message, 'error');
        } finally {
          icon.classList.remove('fa-spin');
        }
      };

      // Save
      document.getElementById('se-save-all').onclick = async () => {
        let count = 0;
        for (const key of settingKeys) {
          const value = reconstructValueFromTree(key, body);
          try {
            const valStr = typeof value === 'object' || Array.isArray(value) ? JSON.stringify(value) : String(value);
            await apiPost('/admin/update-setting', { key, value: valStr });
            count++;
          } catch (_) {}
        }
        showToast('Saved ' + count + ' settings', 'success');
      };
    }

    try {
      const res = await apiGet('/admin/settings');
      settings = res.settings || [];
      settingKeys = settings.map(s => s.key);
      await renderSE();
    } catch (e) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444">Failed to load settings: ' + e.message + '</div>';
    }
  })();
}

function openLibraryEditor() {
  const wid = createWindow({ title: 'Library Editor', icon: 'fa-th-large', width: 900, height: 600, stateKey: 'LibraryEditor' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = '#fff';
  body.style.padding = '0';
  body.innerHTML = '<div style="padding:20px;text-align:center;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  (async () => {
    let items = [];
    let itemKeys = [];

    function saveLEState() {
      const leOpen = new Set();
      document.querySelectorAll('[id^="le-"]').forEach(el => {
        if (el.style.display === 'block') leOpen.add(el.id.replace('le-', ''));
      });
      const seOpen = new Set();
      document.querySelectorAll('[id^="se-"]').forEach(el => {
        if (el.style.display === 'block') seOpen.add(el.id.replace('se-', ''));
      });
      return { leOpen, seOpen, scrollTop: document.getElementById('le-scroll')?.scrollTop || 0 };
    }

    function restoreLEState(state) {
      const { leOpen, seOpen } = state;
      leOpen.forEach(uid => {
        const el = document.getElementById('le-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.le-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.le-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
      seOpen.forEach(uid => {
        const el = document.getElementById('se-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.se-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.se-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
    }

    function renderLE(savedState) {
      if (!savedState) savedState = saveLEState();
      let html = `
        <div style="display:flex;flex-direction:column;height:100%">
          <div id="le-scroll" style="flex:1;overflow-y:auto;min-height:0;padding:8px 0 8px 10px">`;

      items.forEach((a, i) => {
        const isVideo = a.type === 'video' || (a.filename && a.filename.endsWith('.mp4'));
        const isAudio = a.type === 'audio' || (a.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(a.filename));
        const icon = isAudio ? 'fa-music' : (isVideo ? 'fa-video' : 'fa-image');
        const iconColor = isAudio ? '#8b5cf6' : (isVideo ? '#22c55e' : '#60a5fa');
        const dims = a.width && a.height ? a.width + '\u00D7' + a.height : '';
        const dur = a.duration ? a.duration + 's' : '';
        const badge = [dur, dims].filter(Boolean).join(' \u2022 ');
        const uid = uidFromPath(a.id);

        html += `<div data-le-item="${uid}" style="margin-bottom:2px">
          <div class="le-toggle" data-target="${uid}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;user-select:none;border-radius:4px;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};border:1px solid #e5e7eb">
            <span class="le-arrow" style="font-size:8px;color:#888;width:10px;text-align:center">&#9654;</span>
            <i class="fa-solid ${icon}" style="color:${iconColor};font-size:12px;width:16px;text-align:center;flex-shrink:0"></i>
            <span style="flex:1;font-size:11px;font-weight:500;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.prompt || a.filename || a.id)}</span>
            ${badge ? `<span style="font-size:9px;color:#999;white-space:nowrap;flex-shrink:0">${badge}</span>` : ''}
            <span class="le-fav" data-id="${a.id}" data-fav="${a.favorite ? '1' : '0'}" style="cursor:pointer;font-size:11px;flex-shrink:0;width:18px;text-align:center;color:${a.favorite ? '#facc15' : '#ccc'};pointer-events:auto">${a.favorite ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>'}</span>
            ${(!isVideo && !isAudio) ? `<span class="le-char" data-id="${a.id}" data-char="${a.character ? '1' : '0'}" style="cursor:pointer;font-size:11px;flex-shrink:0;width:18px;text-align:center;color:${a.character ? '#38bdf8' : '#ccc'};pointer-events:auto">${a.character ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-regular fa-user"></i>'}</span>` : ''}
            ${isAudio ? `<span class="le-voice" data-id="${a.id}" data-voice="${a.voice ? '1' : '0'}" style="cursor:pointer;font-size:11px;flex-shrink:0;width:18px;text-align:center;color:${a.voice ? '#a78bfa' : '#ccc'};pointer-events:auto">${a.voice ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-regular fa-microphone"></i>'}</span>` : ''}
            <span class="le-del" data-id="${a.id}" style="cursor:pointer;font-size:10px;flex-shrink:0;width:18px;text-align:center;color:#ef4444;pointer-events:auto"><i class="fa-solid fa-trash-can"></i></span>
          </div>
          <div class="le-children" id="le-${uid}" style="display:none;padding:2px 0 4px 0">`;

        // Render the item's full JSON as a tree using renderTreeValue
        html += renderTreeValue(a.id, a, a.id, 0);

        html += `</div></div>`;
      });

      html += `
          </div>
          <div style="padding:10px 16px;border-top:1px solid #e0e0e0;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:8px">
              <button id="le-refresh" class="server-save-btn" style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-rotate"></i> Refresh</button>
              <span style="font-size:11px;color:#888">${items.length} items</span>
            </div>
            <button id="le-save-all" class="server-save-btn">Save All Changes</button>
          </div>
        </div>`;
      body.innerHTML = html;
      const scrollEl = document.getElementById('le-scroll');
      if (scrollEl) scrollEl.scrollTop = savedState.scrollTop;
      restoreLEState(savedState);

      // Toggle item expand/collapse
      body.querySelectorAll('.le-toggle').forEach(toggle => {
        toggle.addEventListener('click', e => {
          if (e.target.closest('.le-fav') || e.target.closest('.le-char') || e.target.closest('.le-voice') || e.target.closest('.le-del')) return;
          const target = document.getElementById('le-' + toggle.dataset.target);
          const arrow = toggle.querySelector('.le-arrow');
          if (target) {
            const isOpen = target.style.display !== 'none';
            target.style.display = isOpen ? 'none' : 'block';
            arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
          }
        });
      });

      // Also wire toggle for the tree nodes inside each item
      body.querySelectorAll('.se-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const target = document.getElementById('se-' + toggle.dataset.target);
          const arrow = toggle.querySelector('.se-arrow');
          if (target) {
            const isOpen = target.style.display !== 'none';
            target.style.display = isOpen ? 'none' : 'block';
            arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
          }
        });
      });

      // Favorite toggle
      body.querySelectorAll('.le-fav').forEach(el => {
        el.addEventListener('click', async e => {
          e.stopPropagation();
          const id = el.dataset.id;
          const fav = el.dataset.fav === '1' ? false : true;
          try {
            await apiPost('/admin/update-generation', { id, favorite: fav });
            el.dataset.fav = fav ? '1' : '0';
            el.style.color = fav ? '#facc15' : '#ccc';
            el.innerHTML = fav ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
            refreshLibraryScrollPreserved(document.querySelector('[id^="win-"]')?.id);
          } catch (_) {}
        });
      });

      // Character toggle
      body.querySelectorAll('.le-char').forEach(el => {
        el.addEventListener('click', async e => {
          e.stopPropagation();
          const id = el.dataset.id;
          const isChar = el.dataset.char === '1' ? false : true;
          try {
            await apiPost('/admin/update-generation', { id, character: isChar });
            el.dataset.char = isChar ? '1' : '0';
            el.style.color = isChar ? '#38bdf8' : '#ccc';
            el.innerHTML = isChar ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-regular fa-user"></i>';
            refreshLibraryScrollPreserved(document.querySelector('[id^="win-"]')?.id);
          } catch (_) {}
        });
      });

      // Voice toggle
      body.querySelectorAll('.le-voice').forEach(el => {
        el.addEventListener('click', async e => {
          e.stopPropagation();
          const id = el.dataset.id;
          const isVoice = el.dataset.voice === '1' ? false : true;
          try {
            const res = await apiPost('/admin/update-generation', { id, voice: isVoice });
            const nextVoice = (res && typeof res.voice === 'boolean') ? res.voice : isVoice;
            el.dataset.voice = nextVoice ? '1' : '0';
            el.style.color = nextVoice ? '#a78bfa' : '#ccc';
            el.innerHTML = nextVoice ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-regular fa-microphone"></i>';
            refreshLibraryScrollPreserved(document.querySelector('[id^="win-"]')?.id);
          } catch (_) {}
        });
      });

      // Delete
      body.querySelectorAll('.le-del').forEach(el => {
        el.addEventListener('click', async e => {
          e.stopPropagation();
          if (!confirm('Delete this item? This cannot be undone.')) return;
          const id = el.dataset.id;
          try {
            await apiPost('/admin/delete-generation', { id });
            items = items.filter(a => a.id !== id);
            itemKeys = items.map(a => a.id);
            renderLE(saveLEState());
            refreshLibraryScrollPreserved(document.querySelector('[id^="win-"]')?.id);
          } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
        });
      });

      // Refresh
      document.getElementById('le-refresh').onclick = async () => {
        const icon = document.querySelector('#le-refresh i');
        icon.classList.add('fa-spin');
        const state = saveLEState();
        try {
          const res = await apiGet('/admin/generations');
          items = res.generations || [];
          itemKeys = items.map(a => a.id);
          renderLE(state);
        } catch (e) {
          showToast('Refresh failed: ' + e.message, 'error');
        } finally {
          icon.classList.remove('fa-spin');
        }
      };

      // Save
      document.getElementById('le-save-all').onclick = async () => {
        let count = 0;
        for (const id of itemKeys) {
          if (!items.some(a => a.id === id)) continue;
          const value = reconstructValueFromTree(id, body);
          if (!value || typeof value !== 'object') continue;
          try {
            await apiPost('/admin/update-generation', {
              id,
              prompt: value.prompt !== undefined ? String(value.prompt) : undefined,
              favorite: value.favorite !== undefined ? Boolean(value.favorite) : undefined,
              type: value.type !== undefined ? String(value.type) : undefined,
              filename: value.filename !== undefined ? String(value.filename) : undefined,
              width: value.width !== undefined ? Number(value.width) : undefined,
              height: value.height !== undefined ? Number(value.height) : undefined,
              aspect_ratio: value.aspect_ratio !== undefined ? String(value.aspect_ratio) : undefined,
              duration: value.duration !== undefined ? Number(value.duration) : undefined,
              voice: value.voice !== undefined ? Boolean(value.voice) : undefined,
              parent_id: value.parent_id !== undefined ? String(value.parent_id) : undefined,
              metadata: value.metadata !== undefined ? (typeof value.metadata === 'object' ? JSON.stringify(value.metadata) : String(value.metadata)) : undefined
            });
            count++;
          } catch (_) {}
        }
        showToast('Saved ' + count + ' items', 'success');
      };
    }

    try {
      const res = await apiGet('/admin/generations');
      items = res.generations || [];
      itemKeys = items.map(a => a.id);
      renderLE();
    } catch (e) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444">Failed to load: ' + e.message + '</div>';
    }
  })();
}

// ============================================================
// APP: Music Video
// ============================================================
function openMusicVideo() {
  const wid = createWindow({ title: 'Music Video', icon: 'fa-music', width: 1180, height: 760, stateKey: 'MusicVideo' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = 'var(--bg-window-light, #f5f5f5)';
  body.style.padding = '0';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.overflow = 'hidden';

  let projects = [];
  let currentProjectId = null;
  let currentProject = null;
  let audioDuration = null;
  let busySegments = {};
  let batchState = { active: false, paused: false, cancelled: false, mode: null, slotId: null, current: 0, total: 0, label: '' };

  const RES_OPTIONS = ['480p', '720p', '1080p'];
  const AR_OPTIONS = ['3:2', '16:9', '1:1', '9:16', '2:3'];

  const SECTION_NAMES = [
    'Intro', 'Verse 1', 'Pre Chorus 1', 'Chorus 1',
    'Verse 2', 'Pre Chorus 2', 'Chorus 2',
    'Verse 3', 'Pre Chorus 3', 'Chorus 3',
    'Verse 4', 'Pre Chorus 4', 'Chorus 4',
    'Bridge', 'Outro',
  ];
  let timingsWinId = null;
  let timingsWinProjectId = null;
  let timingsSaveTimer = null;
  let offsetsWinId = null;
  let mvOffsets = { ltx23: 2, ltx25: 0, fasth3: 0 };

  function parseDrag(e) {
    let raw = e.dataTransfer.getData('application/json');
    if (!raw) raw = e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function assetThumb(assetId, filename) {
    const thumb = `/thumbnails/${assetId}.jpg`;
    const fallback = `/images/${filename}`;
    return `<img src="${thumb}" onerror="this.onerror=null;this.src='${fallback}'" alt="">`;
  }

  function resOptionsHTML(selected) {
    return RES_OPTIONS.map(r => `<option value="${r}" ${(selected || '720p') === r ? 'selected' : ''}>${r}</option>`).join('');
  }
  function arOptionsHTML(selected) {
    return AR_OPTIONS.map(a => `<option value="${a}" ${(selected || '3:2') === a ? 'selected' : ''}>${a}</option>`).join('');
  }

  function offsetText(key) {
    const v = Number(mvOffsets[key] || 0);
    return v ? ` (${v > 0 ? '+' : ''}${v}f)` : '';
  }
  function modelOptionsHTML(selected) {
    const opts = [
      ['', 'Project model…'],
      ['ltx23', 'LTX 2.3' + offsetText('ltx23')],
      ['ltx25', 'LTX 2.5' + offsetText('ltx25')],
      ['fasth3', 'FastH3' + offsetText('fasth3')],
    ];
    return opts.map(([v, label]) => `<option value="${v}" ${((selected || '') === v) ? 'selected' : ''}>${label}</option>`).join('');
  }

  async function loadMvOffsets() {
    try {
      const s = await apiGet('/settings');
      mvOffsets = { ...mvOffsets, ...(s.segment_timecode_offsets || {}) };
    } catch (_) {}
  }

  function findSeg(segId) {
    for (const slot of (currentProject?.slots || [])) {
      const seg = (slot.segments || []).find(s => s.id === segId);
      if (seg) return seg;
    }
    return null;
  }
  function removeSegFromModel(segId) {
    for (const slot of (currentProject?.slots || [])) {
      if (!slot.segments) continue;
      const i = slot.segments.findIndex(s => s.id === segId);
      if (i >= 0) { slot.segments.splice(i, 1); return; }
    }
  }
  function updateDurLabel(segId) {
    const seg = findSeg(segId);
    const row = document.querySelector(`.music-seg-row[data-seg="${segId}"]`);
    if (!row || !seg) return;
    const el = row.querySelector('.music-seg-dur');
    const d = Math.max(0, (Number(seg.end_time) || 0) - (Number(seg.start_time) || 0));
    if (el) el.textContent = d.toFixed(1) + 's';
  }

  function getSections() {
    const stored = (currentProject?.settings || {}).sections;
    return SECTION_NAMES.map((name, i) => {
      const s = Array.isArray(stored) ? (stored[i] || {}) : {};
      return {
        name,
        start: Math.max(0, Number(s.start) || 0),
        end: Math.max(0, Number(s.end) || 0),
      };
    });
  }

  function fmtSecs(v) {
    const total = Math.max(0, Number(v) || 0);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function openTimings() {
    if (!currentProject) return;
    if (timingsWinId && windows[timingsWinId] && timingsWinProjectId === currentProjectId) {
      focusWindow(timingsWinId);
      return;
    }
    if (timingsWinId && windows[timingsWinId]) closeWindow(timingsWinId);
    timingsWinProjectId = currentProjectId;
    timingsWinId = createWindow({
      title: 'Song Sections',
      icon: 'fa-clock',
      width: 520,
      height: 640,
      stateKey: 'MusicVideoTimings',
      onClose: () => { timingsWinId = null; timingsWinProjectId = null; },
    });
    renderTimings();
  }

  function renderTimings() {
    if (!timingsWinId) return;
    const win = document.getElementById(timingsWinId);
    if (!win) return;
    const bodyEl = win.querySelector('.window-body');
    if (!bodyEl) return;
    bodyEl.style.padding = '0';
    bodyEl.style.background = '#fff';
    const sections = getSections();
    const lastEnd = sections.reduce((mx, s) => Math.max(mx, s.end), 0);
    bodyEl.innerHTML = `
      <div class="mv-timings">
        <div class="mv-timings-head">
          <span class="mv-timings-title">${escHtml(currentProject?.title || 'Untitled')}</span>
          <span class="mv-timings-total">Last end: ${fmtSecs(lastEnd)}</span>
        </div>
        <div class="mv-timings-grid">
          <div class="mv-timings-row mv-timings-row-head">
            <span>Section</span><span>Start (s)</span><span>End (s)</span><span>Length</span>
          </div>
          ${sections.map((s, i) => `
            <div class="mv-timings-row" data-idx="${i}">
              <span class="mv-timings-name">${escHtml(s.name)}</span>
              <input type="number" class="mv-timings-input mv-timings-start" data-idx="${i}" step="0.1" min="0" value="${s.start}">
              <input type="number" class="mv-timings-input mv-timings-end" data-idx="${i}" step="0.1" min="0" value="${s.end}">
              <span class="mv-timings-len">${fmtSecs(Math.max(0, s.end - s.start))}</span>
            </div>`).join('')}
        </div>
      </div>`;

    bodyEl.querySelectorAll('.mv-timings-input').forEach((inp) => {
      inp.onchange = () => {
        const idx = parseInt(inp.dataset.idx, 10);
        const val = Math.max(0, parseFloat(inp.value) || 0);
        inp.value = val;
        const list = getSections();
        if (inp.classList.contains('mv-timings-start')) list[idx].start = val;
        else list[idx].end = val;
        currentProject.settings = currentProject.settings || {};
        currentProject.settings.sections = list;
        const row = inp.closest('.mv-timings-row');
        const lenEl = row ? row.querySelector('.mv-timings-len') : null;
        if (lenEl) lenEl.textContent = fmtSecs(Math.max(0, list[idx].end - list[idx].start));
        const totalEl = bodyEl.querySelector('.mv-timings-total');
        if (totalEl) totalEl.textContent = 'Last end: ' + fmtSecs(list.reduce((mx, s) => Math.max(mx, s.end), 0));
        saveTimings(list);
      };
    });
  }

  function saveTimings(sections) {
    const pid = currentProjectId;
    clearTimeout(timingsSaveTimer);
    timingsSaveTimer = setTimeout(async () => {
      try {
        await apiPost(`/music/projects/${pid}/settings`, { settings: { sections } });
      } catch (e) {
        showToast('Save timings failed: ' + e.message, 'error');
      }
    }, 350);
  }

  function renderShell() {
    body.innerHTML = `
      <div class="story-layout">
        <aside class="story-sidebar">
          <div class="story-sidebar-head">
            <span>Music Videos</span>
            <button type="button" id="mv-new" class="story-btn-sm" title="New project"><i class="fa-solid fa-plus"></i></button>
          </div>
          <div id="mv-project-list" class="story-session-list"></div>
        </aside>
        <main class="story-main" id="mv-main">
          <div class="story-empty">Loading…</div>
        </main>
      </div>`;
    document.getElementById('mv-new').onclick = async () => {
      try {
        const p = await apiPost('/music/projects', { title: 'Untitled Music Video' });
        await loadProjects();
        await selectProject(p.id);
      } catch (e) {
        showToast('Create project failed: ' + e.message, 'error');
      }
    };
  }

  async function loadProjects() {
    try {
      const res = await apiGet('/music/projects');
      projects = res.projects || [];
    } catch (e) {
      projects = [];
      showToast('Failed to load projects: ' + e.message, 'error');
    }
    renderProjectList();
  }

  function renderProjectList() {
    const list = document.getElementById('mv-project-list');
    if (!list) return;
    if (!projects.length) {
      list.innerHTML = '<div class="story-muted" style="padding:10px">No projects yet</div>';
      return;
    }
    list.innerHTML = projects.map(p => `
      <div class="story-session-item ${p.id === currentProjectId ? 'active' : ''}" data-pid="${p.id}">
        <span class="story-session-title">${escHtml(p.title || 'Untitled')}</span>
        <button type="button" class="story-session-del" data-pid="${p.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
      </div>`).join('');
    list.querySelectorAll('.story-session-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.closest('.story-session-del')) return;
        selectProject(item.dataset.pid);
      };
    });
    list.querySelectorAll('.story-session-del').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this project? Library media is kept.')) return;
        const wasCurrent = currentProjectId === btn.dataset.pid;
        try {
          await fetch('/music/projects/' + btn.dataset.pid, { method: 'DELETE' });
        } catch (_) {}
        if (wasCurrent) { currentProjectId = null; currentProject = null; }
        await loadProjects();
        if (projects.length) {
          await selectProject(currentProjectId || projects[0].id);
        } else {
          await ensureProject();
        }
      };
    });
  }

  async function selectProject(id) {
    if (batchState.active && id !== currentProjectId) { showToast('Cancel the running batch first', 'info'); return; }
    try {
      currentProject = await apiGet('/music/projects/' + id);
      currentProjectId = currentProject.id;
      audioDuration = null;
    } catch (e) {
      showToast('Failed to load project: ' + e.message, 'error');
      return;
    }
    renderProjectList();
    renderProject();
    if (timingsWinId && windows[timingsWinId]) {
      timingsWinProjectId = currentProjectId;
      renderTimings();
    }
  }

  async function ensureProject() {
    if (currentProjectId) return;
    try {
      const p = await apiPost('/music/projects', { title: 'Untitled Music Video' });
      await loadProjects();
      await selectProject(p.id);
    } catch (e) {
      showToast('Create project failed: ' + e.message, 'error');
    }
  }

  function renderSlot(slot) {
    const img = slot.image || {};
    const imgHTML = img.filename
      ? assetThumb(img.asset_id, img.filename) +
        `<button type="button" class="music-slot-trash" data-slot="${slot.id}" title="Remove image"><i class="fa-solid fa-xmark"></i></button>`
      : '<div class="music-slot-placeholder"><i class="fa-solid fa-image" style="font-size:20px;display:block;margin-bottom:4px"></i>Drop image</div>';
    const segs = (slot.segments || []).map(renderSegment).join('');
    const canGen = !!img.filename && (slot.segments || []).length > 0;
    const slotBatch = batchState.active && batchState.mode === 'slot' && batchState.slotId === slot.id;
    return `
      <div class="music-slot" data-slot="${slot.id}">
        <div class="music-slot-head">
          <input class="music-slot-name" data-slot="${slot.id}" value="${escAttr(slot.name || '')}" placeholder="Character name">
          <button type="button" class="music-slot-gen-all" data-slot="${slot.id}" ${(!canGen || batchState.active) ? 'disabled' : ''} title="Generate all segments for this character">
            <i class="fa-solid fa-forward"></i> ${slotBatch ? `Generating ${batchState.current}/${batchState.total}…` : 'Generate All'}
          </button>
        </div>
        <div class="music-slot-img" data-slot="${slot.id}">${imgHTML}</div>
        <div class="music-seg-list" data-slot="${slot.id}">${segs}</div>
        <button type="button" class="music-add-seg" data-slot="${slot.id}"><i class="fa-solid fa-plus"></i> Add segment</button>
      </div>`;
  }

  function renderSegment(seg) {
    const busy = busySegments[seg.id];
    const status = seg.status || 'draft';
    let statusHTML = '';
    if (busy === 'generating' || status === 'generating') {
      statusHTML = '<span class="music-seg-status generating"><i class="fa-solid fa-spinner fa-spin"></i> generating…</span>';
    } else if (status === 'ready') {
      statusHTML = '<span class="music-seg-status ready"><i class="fa-solid fa-check"></i> saved</span>';
    } else if (status === 'error') {
      statusHTML = `<span class="music-seg-status error" title="${escAttr(seg.error || '')}"><i class="fa-solid fa-circle-exclamation"></i> error</span>`;
    }
    const d = Math.max(0, (Number(seg.end_time) || 0) - (Number(seg.start_time) || 0));
    const disabled = (busy === 'generating' || status === 'generating') ? ' disabled' : '';
    return `
      <div class="music-seg-row" data-seg="${seg.id}">
        <div class="music-seg-times">
          <label>Start</label>
          <input type="number" step="0.1" min="0" class="music-seg-num music-seg-start" data-seg="${seg.id}" value="${seg.start_time ?? 0}">
          <label>End</label>
          <input type="number" step="0.1" min="0" class="music-seg-num music-seg-end" data-seg="${seg.id}" value="${seg.end_time ?? 0}">
          <span class="music-seg-dur">${d.toFixed(1)}s</span>
        </div>
        <textarea class="music-seg-prompt" data-seg="${seg.id}" placeholder="Prompt for this segment…">${escHtml(seg.prompt || '')}</textarea>
        <div class="music-seg-actions">
          <button type="button" class="music-seg-gen" data-seg="${seg.id}"${disabled}><i class="fa-solid fa-play"></i> Generate</button>
          ${statusHTML}
          <button type="button" class="music-seg-del" data-seg="${seg.id}" title="Delete segment"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>`;
  }

  function renderProject() {
    const main = document.getElementById('mv-main');
    if (!main) return;
    if (!currentProject) {
      main.innerHTML = '<div class="story-empty">Create or select a project to start.</div>';
      return;
    }
    const s = currentProject.settings || {};
    const audio = currentProject.audio || {};
    const totalSegments = (currentProject.slots || []).reduce((n, sl) => n + ((sl.segments || []).length), 0);
    const readySegments = (currentProject.slots || []).reduce((n, sl) => n + ((sl.segments || []).filter((x) => !!x.video_filename).length), 0);
    const imageSlots = (currentProject.slots || []).filter((sl) => (sl.image || {}).filename);
    const missingSegments = imageSlots.reduce((n, sl) => n + ((sl.segments || []).filter((x) => !x.video_filename).length), 0);
    const audioLabel = audio.name
      || ((allAssets.find((x) => x.id === audio.asset_id) || {}).prompt || '')
      || audio.filename;
    const audioChip = audio.filename
      ? `<span class="music-audio-chip"><i class="fa-solid fa-music"></i>
           <span class="story-audio-name">${escHtml(audioLabel)}</span>
           ${audioDuration ? `<span class="story-muted">${Number(audioDuration).toFixed(1)}s</span>` : ''}
           <button type="button" class="music-audio-trash" title="Remove audio"><i class="fa-solid fa-xmark"></i></button>
         </span>`
      : '<div class="story-muted">Drop an audio file from the Library here</div>';
    main.innerHTML = `
      <div class="story-main-head">
        <input id="mv-title" class="story-title-input" value="${escAttr(currentProject.title || '')}" placeholder="Untitled Music Video">
        <div class="music-settings">
          <label class="story-muted">Res</label>
          <select id="mv-res">${resOptionsHTML(s.resolution || '720p')}</select>
          <label class="story-muted">AR</label>
          <select id="mv-ar">${arOptionsHTML(s.aspect_ratio || '3:2')}</select>
          <label class="story-muted" title="Model used for this project's renders (generation + timecode offset)">Model</label>
          <select id="mv-model" title="Project render model (generation + timecode offset)">${modelOptionsHTML(s.model || '')}</select>
          <button type="button" id="mv-timings" class="music-timings-btn" title="Set song section timings">
            <i class="fa-solid fa-clock"></i> Timings
          </button>
          <button type="button" id="mv-offsets" class="music-timings-btn" title="Set per-model filename timecode offsets"><i class="fa-solid fa-sliders"></i> Offsets</button>
          <button type="button" id="mv-auto-segs" class="music-auto-btn" title="Create segments from section timings">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Auto Segments
          </button>
          <button type="button" id="mv-gen-all" class="music-gen-all-btn" ${(!totalSegments || batchState.active) ? 'disabled' : ''} title="Generate every segment in every scene">
            <i class="fa-solid fa-forward-fast"></i> Generate All Scenes
          </button>
          <button type="button" id="mv-gen-missing" class="music-auto-btn" ${(!missingSegments || batchState.active) ? 'disabled' : ''} title="Generate only segments that have no video yet">
            <i class="fa-solid fa-forward"></i> Missing (${missingSegments})
          </button>
          <button type="button" id="mv-download-segs" class="music-download-btn" ${(!readySegments || batchState.active) ? 'disabled' : ''} title="Download all generated segments as a zip">
            <i class="fa-solid fa-file-zipper"></i> Download Segments
          </button>
          <button type="button" id="mv-reapply-names" class="music-timings-btn" ${readySegments ? '' : 'disabled'} title="Re-apply timecode filenames using the project model"><i class="fa-solid fa-arrows-rotate"></i> Re-apply Names</button>
          <button type="button" id="mv-clear-segs" class="music-clear-btn" ${totalSegments ? '' : 'disabled'} title="Remove all segments from every character">
            <i class="fa-solid fa-broom"></i> Clear Segments
          </button>
        </div>
      </div>
      <div id="mv-batch-bar" class="music-batch-bar" style="display:none">
        <span id="mv-batch-label" class="music-batch-label"></span>
        <div class="music-batch-track"><div id="mv-batch-fill" class="music-batch-fill"></div></div>
        <button type="button" id="mv-batch-pause" class="music-batch-btn"><i class="fa-solid fa-pause"></i> Pause</button>
        <button type="button" id="mv-batch-cancel" class="music-batch-btn danger"><i class="fa-solid fa-xmark"></i> Cancel</button>
      </div>
      <div class="music-main-body">
        <div id="mv-audio-drop" class="music-audio-drop">
          <div class="music-audio-drop-label"><i class="fa-solid fa-music"></i> Audio Track</div>
          ${audioChip}
        </div>
        <div class="music-char-grid">
          ${(currentProject.slots || []).map(renderSlot).join('')}
        </div>
      </div>`;
    wireProjectHandlers();
  }

  function wireProjectHandlers() {
    const titleEl = document.getElementById('mv-title');
    if (titleEl) titleEl.onchange = async () => {
      const title = titleEl.value.trim() || 'Untitled Music Video';
      currentProject.title = title;
      const p = projects.find(x => x.id === currentProjectId);
      if (p) p.title = title;
      renderProjectList();
      try { await apiPost(`/music/projects/${currentProjectId}/title`, { title }); } catch (_) {}
    };

    const resEl = document.getElementById('mv-res');
    if (resEl) resEl.onchange = async () => {
      currentProject.settings = currentProject.settings || {};
      currentProject.settings.resolution = resEl.value;
      try { await apiPost(`/music/projects/${currentProjectId}/settings`, { settings: { resolution: resEl.value } }); } catch (_) {}
    };
    const arEl = document.getElementById('mv-ar');
    if (arEl) arEl.onchange = async () => {
      currentProject.settings = currentProject.settings || {};
      currentProject.settings.aspect_ratio = arEl.value;
      try { await apiPost(`/music/projects/${currentProjectId}/settings`, { settings: { aspect_ratio: arEl.value } }); } catch (_) {}
    };
    const modelEl = document.getElementById('mv-model');
    if (modelEl) modelEl.onchange = async () => {
      currentProject.settings = currentProject.settings || {};
      currentProject.settings.model = modelEl.value;
      try {
        await apiPost(`/music/projects/${currentProjectId}/settings`, { settings: { model: modelEl.value } });
        showToast(modelEl.value
          ? 'Project model saved. Use Re-apply Names or Download Segments.'
          : 'Project model cleared');
      } catch (e) {
        showToast('Save model failed: ' + e.message, 'error');
      }
    };

    // Song section timings
    const timingsBtn = document.getElementById('mv-timings');
    if (timingsBtn) timingsBtn.onclick = () => openTimings();

    const offsetsBtn = document.getElementById('mv-offsets');
    if (offsetsBtn) offsetsBtn.onclick = () => openOffsets();

    const reapplyNamesBtn = document.getElementById('mv-reapply-names');
    if (reapplyNamesBtn) reapplyNamesBtn.onclick = () => reapplyProjectNames();

    // Auto-create segments from section timings
    const autoSegsBtn = document.getElementById('mv-auto-segs');
    if (autoSegsBtn) autoSegsBtn.onclick = async () => {
      if (!currentProject) return;
      const timed = ((currentProject.settings || {}).sections || []).filter(
        (s) => (Number(s.end) || 0) > (Number(s.start) || 0)
      ).length;
      if (!timed) { showToast('Add section timings first', 'error'); return; }
      const projectModel = (currentProject.settings || {}).model || '';
      const effectiveModel = projectModel || currentVideoModel;
      const maxClip = effectiveModel === 'fasth3' ? 15 : 30;
      if (!confirm(`Create segments from ${timed} timed sections for characters with images that have no segments?\n\nPadding: 3s · Chunk overlap: 3s · Max clip: ${maxClip}s`)) return;
      try {
        const res = await apiPost(`/music/projects/${currentProjectId}/auto-segments`, {});
        await selectProject(currentProjectId);
        if (res.created) {
          showToast(`Created ${res.created} segments across ${res.slots_processed} character(s)`);
        } else {
          showToast('No characters to fill (add images or clear existing segments)', 'info');
        }
      } catch (e) {
        showToast('Auto segments failed: ' + e.message, 'error');
      }
    };

    // Generate all scenes
    const genAllBtn = document.getElementById('mv-gen-all');
    if (genAllBtn) genAllBtn.onclick = () => generateAllSegments();

    const genMissingBtn = document.getElementById('mv-gen-missing');
    if (genMissingBtn) genMissingBtn.onclick = () => generateMissingSegments();

    // Download all generated segments as a zip
    const dlSegsBtn = document.getElementById('mv-download-segs');
    if (dlSegsBtn) dlSegsBtn.onclick = () => downloadSegments();

    // Batch controls
    const batchPauseBtn = document.getElementById('mv-batch-pause');
    if (batchPauseBtn) batchPauseBtn.onclick = () => toggleBatchPause();
    const batchCancelBtn = document.getElementById('mv-batch-cancel');
    if (batchCancelBtn) batchCancelBtn.onclick = () => cancelBatch();

    // Clear all segments
    const clearSegsBtn = document.getElementById('mv-clear-segs');
    if (clearSegsBtn) clearSegsBtn.onclick = async () => {
      const total = (currentProject.slots || []).reduce((n, sl) => n + ((sl.segments || []).length), 0);
      if (!total) { showToast('No segments to clear', 'info'); return; }
      if (!confirm(`Clear all ${total} segment(s) from every character?`)) return;
      try {
        await apiPost(`/music/projects/${currentProjectId}/segments/clear`, {});
        (currentProject.slots || []).forEach((sl) => { sl.segments = []; });
        renderProject();
        showToast('All segments cleared');
      } catch (e) {
        showToast('Failed to clear segments: ' + e.message, 'error');
      }
    };

    // Audio drop
    const audioDrop = document.getElementById('mv-audio-drop');
    if (audioDrop) {
      audioDrop.addEventListener('dragover', (e) => { e.preventDefault(); audioDrop.classList.add('music-drop-active'); });
      audioDrop.addEventListener('dragleave', () => audioDrop.classList.remove('music-drop-active'));
      audioDrop.addEventListener('drop', async (e) => {
        e.preventDefault();
        audioDrop.classList.remove('music-drop-active');
        const data = parseDrag(e);
        if (!data || data.type !== 'audio') { showToast('Drop an audio file from the Library', 'error'); return; }
        try {
          const displayName = (data.prompt || '').trim();
          const res = await apiPost(`/music/projects/${currentProjectId}/audio`, { asset_id: data.id, filename: data.name, name: displayName });
          currentProject.audio = res.audio || { asset_id: data.id, filename: data.name, name: displayName };
          audioDuration = res.duration ?? null;
          renderProject();
        } catch (err) { showToast('Failed to set audio: ' + err.message, 'error'); }
      });
    }
    const audioTrash = document.querySelector('.music-audio-trash');
    if (audioTrash) audioTrash.onclick = async () => {
      try {
        await apiPost(`/music/projects/${currentProjectId}/audio`, { asset_id: '', filename: '' });
        currentProject.audio = {};
        audioDuration = null;
        renderProject();
      } catch (_) {}
    };

    // Slot image drop zones
    document.querySelectorAll('.music-slot-img').forEach(zone => {
      const slotId = zone.dataset.slot;
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('music-drop-active'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('music-drop-active'));
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('music-drop-active');
        const data = parseDrag(e);
        if (!data || data.type !== 'image') { showToast('Drop an image from the Library', 'error'); return; }
        try {
          const updated = await apiPost(`/music/slots/${slotId}`, { image: { asset_id: data.id, filename: data.name } });
          const slot = (currentProject.slots || []).find(s => s.id === slotId);
          if (slot) slot.image = updated.image || { asset_id: data.id, filename: data.name };
          renderProject();
        } catch (err) { showToast('Failed to set image: ' + err.message, 'error'); }
      });
    });
    document.querySelectorAll('.music-slot-trash').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const slotId = btn.dataset.slot;
        try {
          await apiPost(`/music/slots/${slotId}`, { image: {} });
          const slot = (currentProject.slots || []).find(s => s.id === slotId);
          if (slot) slot.image = {};
          renderProject();
        } catch (_) {}
      };
    });
    document.querySelectorAll('.music-slot-name').forEach(inp => {
      inp.onchange = async () => {
        const slotId = inp.dataset.slot;
        const name = inp.value.trim();
        const slot = (currentProject.slots || []).find(s => s.id === slotId);
        if (slot) slot.name = name;
        try { await apiPost(`/music/slots/${slotId}`, { name }); } catch (_) {}
      };
    });

    // Generate all segments for one character
    document.querySelectorAll('.music-slot-gen-all').forEach((btn) => {
      btn.onclick = () => generateSlotSegments(btn.dataset.slot);
    });

    // Add segment
    document.querySelectorAll('.music-add-seg').forEach(btn => {
      btn.onclick = async () => {
        const slotId = btn.dataset.slot;
        const slot = (currentProject.slots || []).find(s => s.id === slotId);
        let start = 0;
        if (slot && slot.segments && slot.segments.length) {
          start = Math.max(...slot.segments.map(s => Number(s.end_time) || 0));
        }
        try {
          const seg = await apiPost(`/music/slots/${slotId}/segments`, { start_time: start, end_time: start + 6, prompt: '' });
          if (slot) { slot.segments = slot.segments || []; slot.segments.push(seg); }
          renderProject();
        } catch (err) { showToast('Add segment failed: ' + err.message, 'error'); }
      };
    });

    // Segment start/end/prompt
    document.querySelectorAll('.music-seg-start').forEach(inp => {
      inp.onchange = async () => {
        const segId = inp.dataset.seg;
        const seg = findSeg(segId);
        if (seg) seg.start_time = parseFloat(inp.value) || 0;
        updateDurLabel(segId);
        try { await apiPost(`/music/segments/${segId}`, { start_time: seg ? seg.start_time : 0 }); } catch (_) {}
      };
    });
    document.querySelectorAll('.music-seg-end').forEach(inp => {
      inp.onchange = async () => {
        const segId = inp.dataset.seg;
        const seg = findSeg(segId);
        if (seg) seg.end_time = parseFloat(inp.value) || 0;
        updateDurLabel(segId);
        try { await apiPost(`/music/segments/${segId}`, { end_time: seg ? seg.end_time : 0 }); } catch (_) {}
      };
    });
    document.querySelectorAll('.music-seg-prompt').forEach(txt => {
      txt.onchange = async () => {
        const segId = txt.dataset.seg;
        const seg = findSeg(segId);
        if (seg) seg.prompt = txt.value;
        try { await apiPost(`/music/segments/${segId}`, { prompt: txt.value }); } catch (_) {}
      };
    });

    // Delete segment
    document.querySelectorAll('.music-seg-del').forEach(btn => {
      btn.onclick = async () => {
        const segId = btn.dataset.seg;
        if (!confirm('Delete this segment?')) return;
        try {
          await fetch('/music/segments/' + segId, { method: 'DELETE' });
          removeSegFromModel(segId);
          renderProject();
        } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
      };
    });

    // Generate
    document.querySelectorAll('.music-seg-gen').forEach(btn => {
      btn.onclick = () => generateSegment(btn.dataset.seg);
    });
  }

  function setSegRowState(segId, state, error) {
    const row = document.querySelector(`.music-seg-row[data-seg="${segId}"]`);
    if (!row) return;
    const btn = row.querySelector('.music-seg-gen');
    const actions = row.querySelector('.music-seg-actions');
    let st = row.querySelector('.music-seg-status');
    if (!st && actions) {
      st = document.createElement('span');
      actions.insertBefore(st, row.querySelector('.music-seg-del'));
    }
    if (state === 'generating') {
      if (btn) btn.disabled = true;
      if (st) { st.className = 'music-seg-status generating'; st.removeAttribute('title'); st.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> generating…'; }
    } else if (state === 'ready') {
      if (btn) btn.disabled = batchState.active;
      if (st) { st.className = 'music-seg-status ready'; st.removeAttribute('title'); st.innerHTML = '<i class="fa-solid fa-check"></i> saved'; }
    } else if (state === 'error') {
      if (btn) btn.disabled = batchState.active;
      if (st) { st.className = 'music-seg-status error'; st.title = error || ''; st.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> error'; }
    } else {
      if (btn) btn.disabled = batchState.active;
      if (st) { st.className = 'music-seg-status'; st.removeAttribute('title'); st.innerHTML = ''; }
    }
  }

  function updateSegmentProgress(segId, p) {
    const wf = Math.max(0, Math.min(100, Number(p.workflow_percent) || 0));
    const node = Math.max(0, Math.min(100, Number(p.node_percent) || 0));
    const row = document.querySelector(`.music-seg-row[data-seg="${segId}"]`);
    if (row) {
      const actions = row.querySelector('.music-seg-actions');
      let st = row.querySelector('.music-seg-status');
      if (!st && actions) {
        st = document.createElement('span');
        actions.insertBefore(st, row.querySelector('.music-seg-del'));
      }
      if (st) {
        st.className = 'music-seg-status generating';
        st.innerHTML = `WF ${wf}% · Node ${node}%`;
      }
    }
    if (batchState.active) {
      batchState.progressText = `WF ${wf}% · Node ${node}%`;
      updateBatchBar(batchState.current, batchState.total, batchState.currentLabel);
    }
  }

  async function runSegment(segId, opts = {}) {
    const seg = findSeg(segId);
    if (!seg) return { ok: false, error: 'Segment not found' };
    if (!currentProject.audio || !currentProject.audio.filename) return { ok: false, error: 'Set an audio track first' };
    const slot = (currentProject.slots || []).find((s) => (s.segments || []).some((x) => x.id === segId));
    if (slot && (!slot.image || !slot.image.filename)) return { ok: false, error: 'Set an image for this character first' };
    if ((Number(seg.end_time) || 0) <= (Number(seg.start_time) || 0)) return { ok: false, error: 'End time must be greater than start time' };
    if (!(seg.prompt || '').trim()) return { ok: false, error: 'Enter a prompt for this segment' };

    busySegments[segId] = 'generating';
    setSegRowState(segId, 'generating');

    const jobId = 'seg_' + segId + '_' + Date.now().toString(36);
    const stopProgress = startProgressPolling(jobId, (p) => updateSegmentProgress(segId, p));

    let ok = false;
    let error = '';
    try {
      const res = await apiPost(`/music/segments/${segId}/generate`, { job_id: jobId });
      if (res && res.success) {
        seg.status = 'ready';
        seg.video_asset_id = res.asset_id;
        seg.video_filename = res.filename;
        seg.error = '';
        ok = true;
        setSegRowState(segId, 'ready');
      } else {
        error = (res && res.error) || 'Generation failed';
        seg.status = 'error';
        seg.error = error;
        setSegRowState(segId, 'error', error);
      }
    } catch (e) {
      error = e.message || 'Generation failed';
      seg.status = 'error';
      seg.error = error;
      setSegRowState(segId, 'error', error);
    } finally {
      stopProgress();
    }
    delete busySegments[segId];
    if (ok && opts.refreshLibrary) {
      try { await refreshLibraryFromDB(); } catch (_) {}
    }
    return { ok, error };
  }

  async function generateSegment(segId) {
    const res = await runSegment(segId, { refreshLibrary: true });
    if (res.ok) showToast('Segment saved to Library');
    else showToast(res.error || 'Generation failed', 'error');
    renderProject();
  }

  function batchBarEls() {
    return {
      bar: document.getElementById('mv-batch-bar'),
      label: document.getElementById('mv-batch-label'),
      fill: document.getElementById('mv-batch-fill'),
      pause: document.getElementById('mv-batch-pause'),
      cancel: document.getElementById('mv-batch-cancel'),
    };
  }

  function updateBatchBar(done, total, currentLabel) {
    const { label, fill, pause } = batchBarEls();
    const pct = total ? Math.round((done / total) * 100) : 0;
    const progressSuffix = batchState.progressText ? ' · ' + batchState.progressText : '';
    if (label) {
      label.textContent = (batchState.paused
        ? `Paused — ${done}/${total}${currentLabel ? ' — ' + currentLabel : ''}`
        : `Generating ${done}/${total}${currentLabel ? ' — ' + currentLabel : ''}`) + progressSuffix;
    }
    if (fill) fill.style.width = pct + '%';
    if (pause) {
      pause.innerHTML = batchState.paused
        ? '<i class="fa-solid fa-play"></i> Resume'
        : '<i class="fa-solid fa-pause"></i> Pause';
    }
    if (batchState.mode === 'slot') {
      const btn = document.querySelector(`.music-slot-gen-all[data-slot="${batchState.slotId}"]`);
      if (btn) btn.innerHTML = `<i class="fa-solid fa-forward"></i> ${done}/${total}`;
    }
  }

  function showBatchBar(labelText) {
    const { bar, cancel } = batchBarEls();
    if (bar) bar.style.display = 'flex';
    if (cancel) cancel.disabled = false;
    document.querySelectorAll('#mv-gen-all, #mv-gen-missing, #mv-download-segs, #mv-clear-segs, #mv-auto-segs, .music-slot-gen-all, .music-seg-gen, .music-add-seg').forEach((b) => { b.disabled = true; });
    updateBatchBar(0, batchState.total, labelText || '');
  }

  function hideBatchBar() {
    const { bar } = batchBarEls();
    if (bar) bar.style.display = 'none';
  }

  function waitWhilePaused() {
    return new Promise((resolve) => {
      const check = () => {
        if (!batchState.active || batchState.cancelled || !batchState.paused) resolve();
        else setTimeout(check, 200);
      };
      check();
    });
  }

  function toggleBatchPause() {
    if (!batchState.active) return;
    batchState.paused = !batchState.paused;
    updateBatchBar(batchState.current, batchState.total, batchState.currentLabel);
  }

  function cancelBatch() {
    if (!batchState.active) return;
    batchState.cancelled = true;
    batchState.paused = false;
    const { cancel, label } = batchBarEls();
    if (cancel) cancel.disabled = true;
    if (label) label.textContent = 'Cancelling after current segment…';
  }

  async function runBatch(items, mode, slotId, labelText) {
    if (batchState.active) return;
    batchState = { active: true, paused: false, cancelled: false, mode, slotId: slotId || null, current: 0, total: items.length, label: labelText || '', currentLabel: '', progressText: '' };
    showBatchBar(labelText);
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < items.length; i++) {
      if (batchState.cancelled) break;
      await waitWhilePaused();
      if (batchState.cancelled) break;
      const seg = items[i];
      const slot = (currentProject.slots || []).find((s) => (s.segments || []).some((x) => x.id === seg.id));
      const char = slot ? (slot.name || 'Character') : 'Character';
      batchState.currentLabel = `${char} ${Number(seg.start_time).toFixed(1)}–${Number(seg.end_time).toFixed(1)}s`;
      batchState.progressText = '';
      updateBatchBar(i, items.length, batchState.currentLabel);
      const res = await runSegment(seg.id, { refreshLibrary: false });
      if (res.ok) ok++; else failed++;
      batchState.progressText = '';
      batchState.current = i + 1;
      updateBatchBar(i + 1, items.length);
    }
    const cancelled = batchState.cancelled;
    batchState.active = false;
    hideBatchBar();
    try { await refreshLibraryFromDB(); } catch (_) {}
    renderProject();
    if (cancelled) showToast(`Batch cancelled — ${ok} generated, ${failed} failed`, 'info');
    else showToast(`Batch complete — ${ok} generated, ${failed} failed`, failed ? 'error' : 'success');
  }

  async function generateSlotSegments(slotId) {
    if (batchState.active) return;
    const slot = (currentProject.slots || []).find((s) => s.id === slotId);
    if (!slot) return;
    if (!slot.image || !slot.image.filename) { showToast('Set an image for this character first', 'error'); return; }
    const items = (slot.segments || []).slice();
    if (!items.length) { showToast('No segments for this character', 'info'); return; }
    if (!confirm(`Regenerate all ${items.length} segment(s) for ${slot.name || 'this character'}?`)) return;
    await runBatch(items, 'slot', slotId, slot.name || 'Character');
  }

  async function generateAllSegments() {
    if (batchState.active) return;
    const slots = (currentProject.slots || []).filter((s) => (s.image || {}).filename && (s.segments || []).length);
    if (!slots.length) { showToast('No characters with images and segments', 'info'); return; }
    const items = slots.flatMap((s) => (s.segments || []).slice());
    if (!confirm(`Regenerate all ${items.length} segment(s) across ${slots.length} character(s)?\n\nThis runs sequentially and may take a long time.`)) return;
    await runBatch(items, 'all', null, 'All scenes');
  }

  async function generateMissingSegments() {
    if (batchState.active) return;
    const slots = (currentProject.slots || []).filter((s) => (s.image || {}).filename);
    const missingSlots = slots.filter((s) => (s.segments || []).some((x) => !x.video_filename));
    const items = missingSlots.flatMap((s) => (s.segments || []).filter((x) => !x.video_filename));
    if (!items.length) { showToast('No missing segments', 'info'); return; }
    if (!confirm(`Generate ${items.length} missing segment(s) across ${missingSlots.length} character(s)?`)) return;
    await runBatch(items, 'missing', null, 'Missing scenes');
  }

  function downloadSegments() {
    if (!currentProject) return;
    const ready = (currentProject.slots || []).reduce((n, sl) => n + ((sl.segments || []).filter((x) => !!x.video_filename).length), 0);
    if (!ready) { showToast('No generated segments to download', 'info'); return; }
    const a = document.createElement('a');
    a.href = `/music/projects/${currentProjectId}/segments/zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function reapplyProjectNames() {
    if (!currentProject) return;
    if (!confirm('Re-apply timecode filenames for this project using the selected project model?\n\nThis updates library display names. Downloads already use the offset.')) return;
    try {
      const res = await apiPost(`/music/projects/${currentProjectId}/segments/reapply-names`, {});
      await selectProject(currentProjectId);
      showToast(`Updated ${res.updated || 0} of ${res.total || 0} filename(s)`);
    } catch (e) { showToast('Re-apply failed: ' + e.message, 'error'); }
  }

  function openOffsets() {
    if (!currentProject) return;
    if (offsetsWinId && windows[offsetsWinId]) { focusWindow(offsetsWinId); return; }
    offsetsWinId = createWindow({
      title: 'Timecode Offsets',
      icon: 'fa-sliders',
      width: 460,
      height: 380,
      stateKey: 'MusicVideoOffsets',
      onClose: () => { offsetsWinId = null; },
    });
    renderOffsets();
  }

  async function renderOffsets() {
    if (!offsetsWinId) return;
    const win = document.getElementById(offsetsWinId);
    if (!win) return;
    const bodyEl = win.querySelector('.window-body');
    if (!bodyEl) return;
    let s = {};
    try { s = await apiGet('/settings'); } catch (_) {}
    if (!offsetsWinId || !document.getElementById(offsetsWinId)) return;
    mvOffsets = { ...mvOffsets, ...(s.segment_timecode_offsets || {}) };
    bodyEl.style.padding = '0';
    bodyEl.innerHTML = `
      <div class="mv-offsets">
        <div class="mv-offsets-note">Positive = filename later (place the clip later). LTX 2.3 defaults to +2 frames.</div>
        <label class="mv-offsets-row"><span>LTX 2.3</span><input id="mv-off-ltx23" type="number" step="1" value="${Number(mvOffsets.ltx23 || 0)}"><span>frames</span></label>
        <label class="mv-offsets-row"><span>LTX 2.5</span><input id="mv-off-ltx25" type="number" step="1" value="${Number(mvOffsets.ltx25 || 0)}"><span>frames</span></label>
        <label class="mv-offsets-row"><span>FastH3</span><input id="mv-off-fasth3" type="number" step="1" value="${Number(mvOffsets.fasth3 || 0)}"><span>frames</span></label>
        <div class="mv-offsets-actions">
          <button type="button" id="mv-offsets-save" class="music-timings-btn"><i class="fa-solid fa-floppy-disk"></i> Save</button>
          <button type="button" id="mv-offsets-reapply" class="music-timings-btn"><i class="fa-solid fa-arrows-rotate"></i> Re-apply Names</button>
        </div>
      </div>`;
    document.getElementById('mv-offsets-save').onclick = async () => {
      const payload = {};
      for (const k of ['ltx23', 'ltx25', 'fasth3']) {
        const el = document.getElementById('mv-off-' + k);
        payload[k] = Math.trunc(Number(el.value) || 0);
      }
      try {
        const res = await apiPost('/settings', { segment_timecode_offsets: payload });
        mvOffsets = { ...mvOffsets, ...((res.settings || {}).segment_timecode_offsets || payload) };
        renderProject();
        renderOffsets();
        showToast('Timecode offsets saved');
      } catch (e) { showToast('Save offsets failed: ' + e.message, 'error'); }
    };
    document.getElementById('mv-offsets-reapply').onclick = async () => {
      await reapplyProjectNames();
      renderOffsets();
    };
  }

  // Boot
  renderShell();
  (async () => {
    await loadMvOffsets();
    await loadProjects();
    if (projects.length) {
      await selectProject(projects[0].id);
    } else {
      await ensureProject();
    }
  })();
}

// ============================================================
// APP: Single Frame
// ============================================================
function openSingleFrame() {
  const wid = createWindow({ title: 'Single Frame', icon: 'fa-camera-retro', width: 1040, height: 720, stateKey: 'SingleFrame' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = 'var(--bg-window-light, #f5f5f5)';
  body.style.padding = '0';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.overflow = 'hidden';

  const FRAME_WINDOW = 24;
  let asset = null;
  let fps = 24;
  let duration = 0;
  let frameCount = 0;
  let videoW = 0;
  let videoH = 0;
  let startIndex = 0;
  let selectedIndex = -1;
  let windowFrames = [];
  let loading = false;

  function parseDrag(e) {
    let raw = e.dataTransfer.getData('application/json');
    if (!raw) raw = e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function fmtTime(s) {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s - Math.floor(s)) * 1000);
    return m + ':' + (sec < 10 ? '0' : '') + sec + '.' + String(ms).padStart(3, '0');
  }

  function renderShell() {
    body.innerHTML = `
      <div class="sf-layout">
        <div id="sf-drop" class="sf-drop">
          <i class="fa-solid fa-film"></i>
          <div class="sf-drop-title">Drop a video from the Library</div>
          <div class="sf-muted">Frames load 24 at a time (1 second)</div>
        </div>
        <div id="sf-main" class="sf-main" style="display:none">
          <div class="sf-head">
            <span id="sf-filename" class="sf-filename"></span>
            <span id="sf-info" class="sf-muted"></span>
          </div>
          <div class="sf-preview-wrap">
            <video id="sf-preview" class="sf-preview" muted playsinline preload="auto"></video>
          </div>
          <div class="sf-strip-wrap">
            <button id="sf-prev" class="sf-nav" title="Previous second"><i class="fa-solid fa-chevron-left"></i></button>
            <div id="sf-strip" class="sf-strip"></div>
            <button id="sf-next" class="sf-nav" title="Next second"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
          <div class="sf-seek-row">
            <input type="range" id="sf-seek" min="0" max="0" step="1" value="0">
            <span id="sf-seek-label" class="sf-muted"></span>
          </div>
          <div class="sf-bottom">
            <div id="sf-selected" class="sf-selected">No frame selected</div>
            <button id="sf-save" class="story-btn-primary" disabled><i class="fa-solid fa-download"></i> Save Image to Library</button>
          </div>
        </div>
      </div>`;
    wireDrop();
    wireControls();
  }

  function wireDrop() {
    const drop = document.getElementById('sf-drop');
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (drop && drop.offsetParent !== null) drop.classList.add('sf-drop-active');
    });
    body.addEventListener('dragleave', () => {
      if (drop) drop.classList.remove('sf-drop-active');
    });
    body.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (drop) drop.classList.remove('sf-drop-active');
      const data = parseDrag(e);
      if (!data || data.type !== 'video') { showToast('Drop a video from the Library', 'error'); return; }
      await loadVideo(data.id, data.name);
    });
  }

  function wireControls() {
    const seek = document.getElementById('sf-seek');
    if (seek) {
      seek.addEventListener('input', () => {
        const idx = parseInt(seek.value, 10) || 0;
        const label = document.getElementById('sf-seek-label');
        if (label) label.textContent = `Frame ${idx} / ${Math.max(0, frameCount - 1)} · ${fmtTime(idx / fps)}`;
      });
      seek.addEventListener('change', async () => {
        const idx = parseInt(seek.value, 10) || 0;
        const winStart = Math.floor(idx / FRAME_WINDOW) * FRAME_WINDOW;
        await loadWindow(winStart);
        selectFrame(idx);
      });
    }
    const prev = document.getElementById('sf-prev');
    if (prev) prev.onclick = () => moveWindow(-FRAME_WINDOW);
    const next = document.getElementById('sf-next');
    if (next) next.onclick = () => moveWindow(FRAME_WINDOW);
    const save = document.getElementById('sf-save');
    if (save) save.onclick = saveSelectedFrame;
  }

  async function loadVideo(assetId, filename) {
    try {
      const info = await apiPost('/frames/info', { asset_id: assetId });
      if (!info || !info.success) {
        showToast((info && info.error) || 'Failed to read video', 'error');
        return;
      }
      asset = { id: assetId, filename: info.filename || filename };
      fps = info.fps || 24;
      duration = info.duration || 0;
      frameCount = info.frame_count || Math.round(duration * fps);
      videoW = info.width || 0;
      videoH = info.height || 0;
      startIndex = 0;
      selectedIndex = -1;
      windowFrames = [];

      const drop = document.getElementById('sf-drop');
      const main = document.getElementById('sf-main');
      if (drop) drop.style.display = 'none';
      if (main) main.style.display = 'flex';

      const fn = document.getElementById('sf-filename');
      if (fn) fn.textContent = asset.filename;
      const inf = document.getElementById('sf-info');
      if (inf) inf.textContent = `${frameCount} frames · ${Number(fps).toFixed(2)} fps · ${Number(duration).toFixed(2)}s · ${videoW}×${videoH}`;

      const preview = document.getElementById('sf-preview');
      if (preview) preview.src = '/videos/' + asset.filename;

      const seek = document.getElementById('sf-seek');
      if (seek) { seek.max = Math.max(0, frameCount - 1); seek.value = 0; }

      const sel = document.getElementById('sf-selected');
      if (sel) sel.textContent = 'No frame selected';
      updateSeekLabel();
      updateSaveButton();

      await loadWindow(0);
    } catch (e) {
      showToast('Failed to read video: ' + e.message, 'error');
    }
  }

  async function loadWindow(start) {
    if (!asset || loading) return;
    loading = true;
    const maxStart = Math.max(0, frameCount - FRAME_WINDOW);
    startIndex = Math.max(0, Math.min(Number(start) || 0, maxStart));
    try {
      const res = await apiPost('/frames/window', {
        asset_id: asset.id,
        start_index: startIndex,
        count: FRAME_WINDOW,
        fps,
      });
      if (!res || !res.success) {
        showToast((res && res.error) || 'Failed to load frames', 'error');
        return;
      }
      windowFrames = res.frames || [];
      renderStrip();
    } catch (e) {
      showToast('Failed to load frames: ' + e.message, 'error');
    } finally {
      loading = false;
    }
  }

  function renderStrip() {
    const strip = document.getElementById('sf-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const ar = (videoW && videoH) ? (videoW / videoH) : 1.5;
    const cellH = 72;
    const cellW = Math.max(40, Math.round(cellH * ar));
    windowFrames.forEach((fr) => {
      const cell = document.createElement('div');
      cell.className = 'sf-frame' + (fr.index === selectedIndex ? ' selected' : '');
      cell.dataset.index = fr.index;
      cell.title = `Frame ${fr.index} · ${fmtTime(fr.time)}`;
      cell.style.width = cellW + 'px';
      cell.style.height = cellH + 'px';
      cell.innerHTML = `<img src="${fr.url}" loading="lazy" alt="">`;
      cell.onclick = () => selectFrame(fr.index);
      strip.appendChild(cell);
    });
    if (!windowFrames.length) {
      strip.innerHTML = '<div class="sf-muted" style="padding:12px">No frames in this range</div>';
    }
  }

  function selectFrame(index) {
    selectedIndex = index;
    const strip = document.getElementById('sf-strip');
    if (strip) {
      strip.querySelectorAll('.sf-frame').forEach((c) => {
        c.classList.toggle('selected', Number(c.dataset.index) === index);
      });
    }
    const preview = document.getElementById('sf-preview');
    if (preview) {
      try { preview.currentTime = index / fps; } catch (_) {}
      preview.pause();
    }
    const seek = document.getElementById('sf-seek');
    if (seek) seek.value = index;
    updateSeekLabel();
    updateSaveButton();
    const sel = document.getElementById('sf-selected');
    if (sel) sel.textContent = `Frame ${index} · ${fmtTime(index / fps)}`;
  }

  function moveWindow(delta) {
    if (!asset) return;
    const next = startIndex + delta;
    if (next < 0 || next >= frameCount) return;
    loadWindow(next);
  }

  function updateSeekLabel() {
    const label = document.getElementById('sf-seek-label');
    if (!label) return;
    const cur = selectedIndex >= 0 ? selectedIndex : startIndex;
    label.textContent = `Frame ${cur} / ${Math.max(0, frameCount - 1)} · ${fmtTime(cur / fps)}`;
  }

  function updateSaveButton() {
    const btn = document.getElementById('sf-save');
    if (btn) btn.disabled = selectedIndex < 0;
  }

  async function saveSelectedFrame() {
    if (!asset || selectedIndex < 0) return;
    const btn = document.getElementById('sf-save');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }
    try {
      const res = await apiPost('/frames/save', { asset_id: asset.id, frame_index: selectedIndex });
      if (res && res.success) {
        showToast('Frame saved to Library');
        try { await refreshLibraryFromDB(); } catch (_) {}
      } else {
        showToast((res && res.error) || 'Save failed', 'error');
      }
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    } finally {
      if (btn) btn.innerHTML = orig;
      updateSaveButton();
    }
  }

  renderShell();
}

document.addEventListener('DOMContentLoaded', init);
