// ============================================================
// Pulse Image — Desktop Shell
// ============================================================

let isTauri = false;
let isComfyConnected = false;
let isOllamaConnected = false;
let allAssets = [];
let projects = [];
let windows = {};
let windowZIndex = 10;
let nextWindowId = 1;
let assetCache = {};
let chatMessages = [];
let chatSessions = [];
let currentSessionId = null;
let _windowStates = {};

let currentImageModel = 'schnell';
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
    card.innerHTML = '<div class="spinner"></div>';
    panel.appendChild(card);
    _genToastState.cards.push(card);
  }
}

function fillGenToastCard(idx, innerHTML, onDone) {
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
    case 'chat': openChat(); break;
    case 'director': openDirector(); break;
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
let libResizeObs = null;

async function openLibrary() {
  try {
    const s = await apiGet('/settings');
    libraryDensity = s.library_density === 'compact' ? 'compact' : 'full';
    libraryFilters = Array.isArray(s.library_filters) ? s.library_filters.filter(t => ['image','video','audio'].includes(t)) : [];
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
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-shrink:0">
        <button id="lib-view-full" class="lib-view-btn${libraryDensity === 'full' ? ' active' : ''}" title="Full"><i class="fa-solid fa-th-large"></i></button>
        <button id="lib-view-compact" class="lib-view-btn${libraryDensity === 'compact' ? ' active' : ''}" title="Compact"><i class="fa-solid fa-th"></i></button>
        <span style="width:1px;height:18px;background:#d1d5db;margin:0 4px"></span>
        <button class="lib-filter-btn${libraryFilters.includes('image') ? ' active' : ''}" data-type="image"><i class="fa-solid fa-image"></i> Images</button>
        <button class="lib-filter-btn${libraryFilters.includes('video') ? ' active' : ''}" data-type="video"><i class="fa-solid fa-video"></i> Videos</button>
        <button class="lib-filter-btn${libraryFilters.includes('audio') ? ' active' : ''}" data-type="audio"><i class="fa-solid fa-music"></i> Audio</button>
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

  const activeTypes = [];
  document.querySelectorAll(`#${wid} .lib-filter-btn.active`).forEach(b => activeTypes.push(b.dataset.type));

  const { assets, childrenMap } = _libCache;

  let filtered = [];
  if (activeTypes.length) {
    filtered = assets.filter(a => {
      const isVideo = a.type === 'video' || (a.filename && a.filename.endsWith('.mp4'));
      const isAudio = a.type === 'audio' || (a.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(a.filename));
      const isImage = !isVideo && !isAudio;
      return (activeTypes.includes('image') && isImage) ||
             (activeTypes.includes('video') && isVideo) ||
             (activeTypes.includes('audio') && isAudio);
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
          prompt: (a.prompt || '').trim()
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

function renderPreviewInto(asset, libWid, wid) {
  // Same content-building as openPreview
  const isVideo = asset.type === 'video' || (asset.filename && asset.filename.endsWith('.mp4'));
  const isAudio = asset.type === 'audio' || (asset.filename && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(asset.filename));
  const url = isVideo ? `/videos/${asset.filename}` : isAudio ? `/audio/${asset.filename}` : `/images/${asset.filename}`;
  const dims = asset.width && asset.height ? `${asset.width}\u00D7${asset.height}` : '';
  const dur = asset.metadata?.duration ? `${asset.metadata.duration}s` : '';
  const badgeText = [dur, dims].filter(Boolean).join(' \u2022 ');
  const related = findRelated(asset);

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
        <span style="flex:1;font-size:12px;line-height:1.3;word-break:break-word">${asset.prompt || ''}</span>
        <button id="pv-dl" title="Download" style="background:none;border:none;color:#888;cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-download"></i></button>
        <button id="pv-fav" title="${asset.favorite ? 'Remove from favorites' : 'Add to favorites'}" style="background:none;border:none;color:${asset.favorite ? '#facc15' : '#555'};cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-star"></i></button>
        <button id="pv-trash" title="Delete" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px;flex-shrink:0"><i class="fa-solid fa-trash-can"></i></button>${isVideo || isAudio ? '' : `
        <button id="pv-var" title="Generate Variations" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:11px;padding:2px 6px;border:1px solid #60a5fa;border-radius:4px;flex-shrink:0;white-space:nowrap">Variations</button>
        <button id="pv-vid" title="Create Video from This" style="background:none;border:none;color:#22c55e;cursor:pointer;font-size:11px;padding:2px 6px;border:1px solid #22c55e;border-radius:4px;flex-shrink:0;white-space:nowrap">To Video</button>`}
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">
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
            : `<img id="pv-media" src="${url}" style="max-width:100%;max-height:100%;object-fit:contain">`
        }
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
      a.href = url; a.download = asset.filename || 'download';
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

    if (!isVideo && !isAudio) {
      const arStr = asset.aspect_ratio || (asset.width && asset.height ? `${asset.width}:${asset.height}` : bbAr);

      document.getElementById('pv-var').onclick = async () => {
        if (_isGenerating) return;
        _isGenerating = true;
        const count = 4;
        showGenToastPanel(count);
        document.querySelector('.bb-inner')?.classList.add('is-generating');
        try {
          const r = await fetch('/generate/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: asset.prompt || '', resolution: bbRes, aspect_ratio: arStr, mode: 'image', source_image: asset.filename }),
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
                try { await apiPost('/save-generation', { prompt: asset.prompt || '', filename: ev.local_filename, type: 'image', aspect_ratio: arStr, width: ev.width || 0, height: ev.height || 0, parent_id: asset.id }); } catch (_) {}
                const badge = ev.width && ev.height ? `${ev.width}x${ev.height}` : '';
                const html = `<img src="/images/${ev.local_filename}" loading="lazy">${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
                fillGenToastCard(idx, html, () => refreshLibraryScrollPreserved(libWid));
                idx++;
              }
            }
          }
          if (idx === 0) { showToast('No results', 'error'); cleanupGenToast(); }
        } catch (e) { showToast('Variations failed: ' + e.message, 'error'); cleanupGenToast(); }
      };

      document.getElementById('pv-vid').onclick = async () => {
        if (_isGenerating) return;
        _isGenerating = true;
        showGenToastPanel(1);
        document.querySelector('.bb-inner')?.classList.add('is-generating');
        try {
          const res = await apiPost('/generate', { prompt: asset.prompt || '', resolution: bbRes, aspect_ratio: arStr, mode: 'video', duration: bbDuration, source_image: asset.filename });
          if (res.success && res.results) {
            for (let idx = 0; idx < res.results.length; idx++) {
              const r = res.results[idx];
              if (r.success) {
                try { await apiPost('/save-generation', { prompt: asset.prompt || '', filename: r.local_filename, type: 'video', aspect_ratio: arStr, width: r.width || 0, height: r.height || 0, duration: r.duration || null, parent_id: asset.id }); } catch (_) {}
                const badge = r.duration ? `${r.duration}s` : '';
                const html = `<video src="/videos/${r.local_filename}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
                fillGenToastCard(idx, html, () => refreshLibraryScrollPreserved(libWid));
              }
            }
          } else { showToast('Video generation failed', 'error'); cleanupGenToast(); }
        } catch (e) { showToast('Failed: ' + e.message, 'error'); cleanupGenToast(); }
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
        if (isVideo) el.muted = true;
        if (volSlider) el.volume = parseFloat(volSlider.value) / 100;
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
          el.volume = parseFloat(volSlider.value) / 100;
          if (parseFloat(volSlider.value) > 0 && el.muted) { el.muted = false; if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>'; }
          if (parseFloat(volSlider.value) === 0 && !el.muted) { el.muted = true; if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>'; }
        });

        if (muteBtn) muteBtn.onclick = () => {
          el.muted = !el.muted;
          muteBtn.innerHTML = el.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
          if (volSlider && !el.muted) { el.volume = parseFloat(volSlider.value) / 100; }
        };
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

function updatePreviewContent(asset, libWid) {
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
// APP: Chat
// ============================================================
async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsText(file);
  });
}

function mdToHtml(md) {
  if (!md) return '';
  let h = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const c = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trimEnd();
    return `<pre><code${lang ? ` class="lang-${lang}"` : ''}>${escHtml(c)}</code></pre>`;
  });
  h = h
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const lines = h.split('\n');
  let inUl = false, inOl = false, out = [];
  for (let line of lines) {
    const hrMatch = line.match(/^\s*[-*_]{3,}\s*$/);
    if (hrMatch) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push('<hr>');
      continue;
    }
    const hdMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hdMatch) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(`<h${hdMatch[1].length}>${hdMatch[2]}</h${hdMatch[1].length}>`);
      continue;
    }
    const ulMatch = line.match(/^(\s*)-\s+(.*)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (ulMatch) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${ulMatch[2]}</li>`);
    } else if (olMatch) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${olMatch[2]}</li>`);
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(line);
    }
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');
  return out.join('\n').replace(/\n/g, '<br>');
}

function addMsg(role, content, push = true) {
  if (push) chatMessages.push({ role, content });
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/am|pm/i, m => m.toUpperCase());
  const d = document.createElement('div');
  d.className = `chat-msg ${role}`;
  d.innerHTML = `<div class="msg-text">${mdToHtml(content)}</div><div class="msg-time">${t}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendFileToChat(file) {
  const text = await readFileAsText(file);
  const bar = document.getElementById('chat-input-bar');
  if (!bar) return;
  bar.classList.add('is-generating');

  // Ensure we have a session
  if (!currentSessionId) {
    try {
      const session = await apiPost('/chat/sessions', {});
      currentSessionId = session.id;
      await loadChatSessions();
      renderChatSidebar();
    } catch (e) {
      bar.classList.remove('is-generating');
      showToast('Failed to create session', 'error');
      return;
    }
  }

  addMsg('user', '📄 ' + file.name);
  try { await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: [{ role: 'user', content: '📄 ' + file.name }] }); } catch (e) {}

  const msgs = document.getElementById('chat-msgs');
  const placeholder = document.createElement('div');
  placeholder.className = 'chat-msg assistant';
  placeholder.innerHTML = '<div class="spinner" style="width:16px;height:16px;margin:4px 0"></div>';
  if (msgs) { msgs.appendChild(placeholder); msgs.scrollTop = msgs.scrollHeight; }
  try {
    const res = await apiPost('/chat', {
      prompt: "I've attached a document. Use it to help answer my questions.",
      attachment: { name: file.name, content: text },
      history: chatMessages
    });
    if (placeholder.parentNode) placeholder.remove();
    const reply = res.response || 'No response';
    addMsg('assistant', reply);
    try { await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: [{ role: 'assistant', content: reply }] }); } catch (e) {}
  } catch (e) {
    if (placeholder.parentNode) placeholder.remove();
    const errMsg = 'Error: ' + e.message;
    addMsg('assistant', errMsg);
    try { await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: [{ role: 'assistant', content: errMsg }] }); } catch (e2) {}
  } finally {
    bar.classList.remove('is-generating');
  }
}

async function showChatUpload() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.md,.json,.csv,.py,.js,.html,.css,.xml,.yaml,.yml,.toml,.ini,.cfg,.log,.env,.rtf,.doc,.docx';
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      await sendFileToChat(file);
    } catch (e) {
      showToast('Upload failed: ' + e.message, 'error');
    }
  };
  fileInput.click();
}

// ============================================================
// Attachments bar + LoRA picker
// ============================================================
async function showLoraPicker() {
  if (_bbAttachments.some(a => a.type === 'lora')) { showToast('Only one LoRA allowed'); return; }
  try {
    const s = await apiGet('/settings');
    if ((s.image_model || 'schnell') !== 'schnell') { showToast('LoRA requires Flux Schnell model — change in Models > Image Generation'); return; }
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
  if (!_bbAttachments.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  _bbAttachments.forEach((att, i) => {
    const el = document.createElement('div');
    el.className = 'bb-att';
    if (att.type === 'lora') {
      el.innerHTML = '<i class="fa-solid fa-layer-group" style="font-size:13px;color:#6366f1"></i><span class="bb-att-name">' + escHtml(att.name) + '</span>';
    } else if (att.type === 'image' || att.type === 'video') {
      const safeAspect = att.aspect && isFinite(att.aspect) ? att.aspect : 1.5;
      el.innerHTML = '<img src="' + att.src + '" class="bb-att-img" style="aspect-ratio:' + safeAspect + '">';
    } else if (att.type === 'audio') {
      const label = att.prompt || att.name;
      el.innerHTML = '<i class="fa-solid fa-music" style="font-size:13px;color:#8b5cf6"></i><span class="bb-att-name">' + escHtml(label) + '</span>';
    }
    const trash = document.createElement('span');
    trash.className = 'bb-att-trash';
    trash.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    trash.onclick = (e) => { e.stopPropagation(); _bbAttachments.splice(i, 1); renderAttachments(); };
    el.appendChild(trash);
    bar.appendChild(el);
  });
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function loadChatSessions() {
  try {
    chatSessions = await apiGet('/chat/sessions');
  } catch (e) {
    chatSessions = [];
  }
}

async function renderChatSidebar() {
  const list = document.getElementById('chat-sidebar-list');
  if (!list) return;
  if (!chatSessions.length) {
    list.innerHTML = '<div class="chat-sidebar-list-empty">No chats yet</div>';
    return;
  }
  list.innerHTML = chatSessions.map(s =>
    `<div class="chat-session-item${s.id === currentSessionId ? ' active' : ''}" data-id="${s.id}">
      <i class="fa-regular fa-comment" style="flex-shrink:0;font-size:10px"></i>
      <span style="overflow:hidden;text-overflow:ellipsis">${escHtml(s.title)}</span>
      <button class="ch-del" data-id="${s.id}"><i class="fa-solid fa-xmark"></i></button>
    </div>`
  ).join('');
  list.querySelectorAll('.chat-session-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.ch-del')) return;
      switchChatSession(el.dataset.id);
    });
  });
  list.querySelectorAll('.ch-del').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteChatSession(el.dataset.id);
    });
  });
}

async function switchChatSession(sessionId) {
  if (sessionId === currentSessionId) return;
  currentSessionId = sessionId;
  chatMessages = [];
  const msgs = document.getElementById('chat-msgs');
  if (msgs) msgs.innerHTML = '';
  try {
    const ms = await apiGet(`/chat/sessions/${sessionId}/messages`);
    chatMessages = ms;
    chatMessages.forEach(m => addMsg(m.role, m.content, false));
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  } catch (e) {}
  renderChatSidebar();
}

async function newChatSession() {
  try {
    const session = await apiPost('/chat/sessions', {});
    currentSessionId = session.id;
    chatMessages = [];
    const msgs = document.getElementById('chat-msgs');
    if (msgs) msgs.innerHTML = '';
    await loadChatSessions();
    renderChatSidebar();
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  } catch (e) {
    showToast('Failed to create chat session', 'error');
  }
}

async function deleteChatSession(sessionId) {
  try {
    await apiPost(`/chat/sessions/${sessionId}/delete`, {});
    if (currentSessionId === sessionId) {
      currentSessionId = null;
      chatMessages = [];
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.innerHTML = '';
    }
    await loadChatSessions();
    renderChatSidebar();
  } catch (e) {
    showToast('Failed to delete session', 'error');
  }
}

async function saveCurrentMessages() {
  if (!currentSessionId || !chatMessages.length) return;
  try {
    await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: chatMessages.slice(-2) });
  } catch (e) {}
}

async function autoTitleSession(sessionId) {
  try {
    await apiPost(`/chat/sessions/${sessionId}/auto-title`, {});
    await loadChatSessions();
    renderChatSidebar();
  } catch (e) {}
}

async function openChat() {
  currentSessionId = null;
  try { const s = await apiGet('/settings'); _windowStates = s.window_states || {}; } catch (e) {}
  const ollamaStatus = isOllamaConnected
    ? '<span style="color:#22c55e"><i class="fa-solid fa-circle"></i> Online</span>'
    : '<span style="color:#ef4444"><i class="fa-solid fa-circle"></i> Offline</span>';
  await loadChatSessions();
  const content = `
    <div class="chat-layout">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <button id="chat-new-btn"><i class="fa-solid fa-plus"></i> New</button>
        </div>
        <div class="chat-sidebar-list" id="chat-sidebar-list"></div>
      </div>
      <div class="chat-main">
        <div id="chat-drag-overlay" class="drag-overlay">
          <div class="drag-overlay-content">
            <i class="fa-solid fa-cloud-upload-alt"></i>
            <span>Drop your files here</span>
            <small>Documents</small>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;padding:2px 12px 0;font-size:10px;gap:4px;color:#888">${ollamaStatus}</div>
        <div id="chat-msgs" class="chat-messages"></div>
        <div class="chat-bar" id="chat-input-bar">
          <button class="chat-plus" id="chat-plus"><i class="fa-solid fa-plus"></i></button>
          <input type="text" id="chat-input" placeholder="Message..." />
          <button id="chat-send"><i class="fa-solid fa-arrow-up"></i></button>
        </div>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Chat', icon: 'fa-robot', width: 720, height: 560, content, stateKey: 'Chat' });
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const plus = document.getElementById('chat-plus');
    const msgs = document.getElementById('chat-msgs');
    const bar = document.getElementById('chat-input-bar');
    const dragOverlay = document.getElementById('chat-drag-overlay');
    const newBtn = document.getElementById('chat-new-btn');

    // Restore last session or first available
    if (chatSessions.length > 0) {
      chatMessages = [];
      switchChatSession(chatSessions[0].id);
    } else {
      renderChatSidebar();
    }

    async function doChat() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      bar.classList.add('is-generating');

      // Ensure we have a session
      if (!currentSessionId) {
        try {
          const session = await apiPost('/chat/sessions', {});
          currentSessionId = session.id;
          await loadChatSessions();
          renderChatSidebar();
        } catch (e) {
          bar.classList.remove('is-generating');
          showToast('Failed to create session', 'error');
          return;
        }
      }

      const isFirstMsg = chatMessages.length === 0;
      addMsg('user', text);
      // Save user message immediately
      try {
        await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: [{ role: 'user', content: text }] });
      } catch (e) {}

      const placeholder = document.createElement('div');
      placeholder.className = 'chat-msg assistant';
      placeholder.innerHTML = '<div class="spinner" style="width:16px;height:16px;margin:4px 0"></div>';
      msgs.appendChild(placeholder);
      msgs.scrollTop = msgs.scrollHeight;

      try {
        const res = await apiPost('/chat', { prompt: text, history: chatMessages });
        placeholder.remove();
        const reply = res.response || 'No response';
        addMsg('assistant', reply);
        // Save assistant message
        try {
          await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: [{ role: 'assistant', content: reply }] });
        } catch (e) {}
        // Auto-title on first exchange
        if (isFirstMsg) {
          autoTitleSession(currentSessionId);
        }
      } catch (e) {
        placeholder.remove();
        const errMsg = 'Error: ' + e.message;
        addMsg('assistant', errMsg);
        try {
          await apiPost(`/chat/sessions/${currentSessionId}/messages`, { messages: [{ role: 'assistant', content: errMsg }] });
        } catch (e2) {}
      } finally {
        bar.classList.remove('is-generating');
      }
    }

    // New Chat
    newBtn.addEventListener('click', newChatSession);

    // Upload via + button
    plus.addEventListener('click', showChatUpload);

    // Send
    send.addEventListener('click', doChat);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doChat(); });

    // Drag and drop
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
        await sendFileToChat(file);
      } catch (e) {
        showToast('Upload failed: ' + e.message, 'error');
      }
    });
  }, 50);
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
let bbRes = '720p';
let bbAr = '3:2';
let bbDuration = 6;
let bbEnhancer = 'none';
let bbEnhancersList = [];
let autoPlayEnabled = false;
let _bbAttachments = []; // {type:'lora'|'image'|'audio', name, src?, aspect?, id?}

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
});

// ============================================================
// APP: Image Generation Model
// ============================================================
async function openImageGen() {
  const s = await apiGet('/settings');
  const genModel = s.image_model || 'schnell';
  const qwenTurbo = s.qwen_turbo || false;
  const content = `
    <div id="img-gen-body">
      <div class="servers-panel" style="max-width:380px">
        <div class="servers-panel-header"><i class="fa-solid fa-bolt" style="color:#d97706"></i> Image Generation Model</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="img-model-btn ${genModel === 'schnell' ? 'active' : ''}" data-model="schnell"><i class="fa-solid fa-bolt"></i> Flux Schnell <span style="font-size:10px;opacity:0.6">(fast)</span></button>
          <button class="img-model-btn ${genModel === 'klein' ? 'active' : ''}" data-model="klein"><i class="fa-solid fa-microchip"></i> Flux 2 Klein</button>
          <button class="img-model-btn ${genModel === 'qwen' ? 'active' : ''}" data-model="qwen"><i class="fa-solid fa-magic"></i> Qwen 2.5 2512</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:0 2px">
          <span style="font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.4px">Qwen Turbo (4-step LoRA)</span>
          <label class="toggle-label">
            <input type="checkbox" id="qwen-turbo-toggle" ${qwenTurbo ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>
      <div style="text-align:right;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:12px">
        <button id="img-gen-save" class="server-save-btn">Save</button>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Image Generation', icon: 'fa-wand-magic-sparkles', width: 420, height: 330, content, fixed: true });
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
        </div>
      </div>
      <div style="text-align:right;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:12px">
        <button id="img-edit-save" class="server-save-btn">Save</button>
      </div>
    </div>
  `;
  const wid = createWindow({ title: 'Image Edit', icon: 'fa-pen', width: 420, height: 260, content, fixed: true });
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
        showToast('Edit model saved');
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
    "qwen_image_2512_fp8_e4m3fn.safetensors"
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
    "qwen_image_vae.safetensors"
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
    "ltx-2.3-spatial-upscaler-x2-1.1.safetensors"
  ]
};

async function openWorkflowModels() {
  const content = `
    <div id="wf-models-body" style="min-height:200px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:600;font-size:12px;color:#444"><i class="fa-solid fa-cubes" style="color:#2563eb"></i> Workflow Models</div>
        <button id="wf-models-check" class="server-refresh-btn" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:5px;background:#fff;font-size:11px;color:#444;cursor:pointer"><i class="fa-solid fa-sync"></i> Check Models</button>
      </div>
      <div id="wf-models-summary" style="font-size:11px;color:#555;margin-bottom:6px">Click Check to scan ComfyUI</div>
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
      document.querySelectorAll('.bb-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bbMode = btn.dataset.mode;
      document.getElementById('bb-duration-group').style.display = bbMode === 'video' ? 'flex' : 'none';
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
      document.querySelectorAll('.bb-enhance-menu').forEach(m => m.classList.remove('show'));
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
      document.querySelectorAll('.bb-ar-menu').forEach(m => m.classList.remove('show'));
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
      else if (action === 'chat-history-editor') openChatHistoryEditor();
      else if (action === 'director-data-editor') openDirectorDataEditor();
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
    const hasLoRA = _bbAttachments.some(a => a.type === 'lora');
    const hasImage = _bbAttachments.some(a => a.type === 'image');
    const hasAudio = _bbAttachments.some(a => a.type === 'audio');
    const imgCount = _bbAttachments.filter(a => a.type === 'image').length;

    if (type === 'lora') return !_bbAttachments.length;
    if (type === 'image') return !hasLoRA && !hasAudio && imgCount < 2;
    if (type === 'audio') return !hasLoRA && !hasAudio;
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
      if (!canAddAttachment(data.type)) { showToast('Cannot add — incompatible combination'); return; }
      const asp = data.aspect && isFinite(data.aspect) ? data.aspect : 1.5;
      _bbAttachments.push({ type: data.type, name: data.name, src: data.src, aspect: asp, id: data.id, prompt: data.prompt || '' });
      renderAttachments();
    } catch (e) { showToast('Drop error: ' + e.message, 'error'); }
  });

  // Bottom bar send
  document.getElementById('bb-send').addEventListener('click', bbSend);
  document.getElementById('bb-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') bbSend();
  });

  loadAutoPlayState();

  console.log('Pulse Image Desktop initialized' + (isTauri ? ' [Tauri]' : ' [Browser]'));
}

async function bbSend() {
  const input = document.getElementById('bb-input');
  let prompt = input.value.trim();
  if (!prompt) return;

  // Show rainbow immediately
  document.querySelector('.bb-inner')?.classList.add('is-generating');

  // Capture attachments immediately (before async enhancement)
  const attImages = _bbAttachments.filter(a => a.type === 'image');
  const attAudio = _bbAttachments.find(a => a.type === 'audio');
  const attLora = _bbAttachments.find(a => a.type === 'lora');

  // Create job snapshot and queue it now so badge shows +1 immediately
  const job = {
    id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    prompt,
    mode: bbMode,
    resolution: bbRes,
    aspect_ratio: bbAr,
    duration: bbDuration,
    attImages: attImages.map(a => ({ id: a.id, name: a.name, type: a.type })),
    attAudio: attAudio ? { id: attAudio.id, name: attAudio.name, type: attAudio.type } : null,
    attLora: attLora ? { id: attLora.id, name: attLora.name, type: attLora.type } : null,
  };

  _genQueue.push(job);
  updateQueueBadge();
  // Keep input and attachments so user can tweak and re-submit

  // Now run enhancement (updates job.prompt already in queue)
  if (bbEnhancer && bbEnhancer !== 'none' && isOllamaConnected) {
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

async function runJob(job) {

  if (job.mode === 'image') {
    let count;
    const bodyPayload = { prompt: job.prompt, resolution: job.resolution, aspect_ratio: job.aspect_ratio, mode: 'image' };
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
    showGenToastPanel(count);

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
              const saved = await apiPost('/save-generation', {
                prompt: job.prompt, filename: ev.local_filename, type: 'image',
                aspect_ratio: job.aspect_ratio, width: ev.width || 0, height: ev.height || 0,
                parent_id: job.attImages.length ? job.attImages[0].id : undefined
              });
              if (saved && saved.id) {
                allAssets.unshift({ id: saved.id, type: 'image', filename: ev.local_filename, prompt: job.prompt, width: ev.width || 0, height: ev.height || 0, aspect_ratio: job.aspect_ratio });
                _libCache.assets = allAssets;
                _libCache.childrenMap = buildChildrenMap(allAssets);
              }
            } catch (_) {}
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
        showToast('Generation returned no results', 'error');
        cleanupGenToast();
      }
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error');
      cleanupGenToast();
    }
  } else {
    // Video mode
    showGenToastPanel(1);

    const vidPayload = { prompt: job.prompt, resolution: job.resolution, aspect_ratio: job.aspect_ratio, mode: 'video', duration: job.duration };
    if (job.attLora) vidPayload.lora_name = job.attLora.name;
    if (job.attAudio && job.attImages.length === 1) {
      vidPayload.source_image = job.attImages[0].name;
      vidPayload.modifier_audio = job.attAudio.name;
    } else if (job.attImages.length === 1) {
      vidPayload.source_image = job.attImages[0].name;
    }
    try {
      const res = await apiPost('/generate', vidPayload);
      if (res.success && res.results) {
        for (let idx = 0; idx < res.results.length; idx++) {
          const r = res.results[idx];
          if (r.success) {
            try {
              const saved = await apiPost('/save-generation', {
                prompt: job.prompt, filename: r.local_filename, type: 'video',
                aspect_ratio: job.aspect_ratio, width: r.width || 0, height: r.height || 0,
                duration: r.duration || null,
                parent_id: job.attImages.length ? job.attImages[0].id : undefined
              });
              if (saved && saved.id) {
                allAssets.unshift({ id: saved.id, type: 'video', filename: r.local_filename, prompt: job.prompt, width: r.width || 0, height: r.height || 0, duration: r.duration, aspect_ratio: job.aspect_ratio });
                _libCache.assets = allAssets;
                _libCache.childrenMap = buildChildrenMap(allAssets);
              }
            } catch (_) {}
            const badge = r.duration ? `${r.duration}s` : '';
            const html = `<video src="/videos/${r.local_filename}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>${badge ? `<div style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);color:#ccc;font-size:9px;padding:1px 4px;border-radius:2px;line-height:1.4">${badge}</div>` : ''}`;
            fillGenToastCard(idx, html, () => refreshLibraryFromDB());
          }
        }
        await refreshLibraryFromDB();
      } else {
        showToast('Video generation failed', 'error');
        cleanupGenToast();
      }
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error');
      cleanupGenToast();
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
          if (e.target.closest('.le-fav') || e.target.closest('.le-del')) return;
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

function openChatHistoryEditor() {
  const wid = createWindow({ title: 'Chat History Editor', icon: 'fa-comments', width: 800, height: 550, stateKey: 'ChatHistoryEditor' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = '#fff';
  body.style.padding = '0';
  body.innerHTML = '<div style="padding:20px;text-align:center;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  (async () => {
    let sessions = [];

    function saveCEState() {
      const openNodes = new Set();
      document.querySelectorAll('[id^="ce-"]').forEach(el => {
        if (el.style.display === 'block') openNodes.add(el.id.replace('ce-', ''));
      });
      const seOpen = new Set();
      document.querySelectorAll('[id^="se-"]').forEach(el => {
        if (el.style.display === 'block') seOpen.add(el.id.replace('se-', ''));
      });
      return { openNodes, seOpen, scrollTop: document.getElementById('ce-scroll')?.scrollTop || 0 };
    }

    function restoreCEState(state) {
      state.openNodes.forEach(uid => {
        const el = document.getElementById('ce-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.ce-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.ce-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
      state.seOpen.forEach(uid => {
        const el = document.getElementById('se-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.se-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.se-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
    }

    function renderCE(savedState) {
      if (!savedState) savedState = saveCEState();
      let html = `
        <div style="display:flex;flex-direction:column;height:100%">
          <div id="ce-scroll" style="flex:1;overflow-y:auto;min-height:0;padding:8px 0 8px 10px">`;

      sessions.forEach((s, i) => {
        const uid = uidFromPath(s.id || String(i));
        const msgCount = (s.messages || []).length;
        const dateStr = s.created ? new Date(s.created).toLocaleDateString() : '';
        html += `<div data-ce-item="${uid}" style="margin-bottom:2px">
          <div class="ce-toggle" data-target="${uid}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;user-select:none;border-radius:4px;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};border:1px solid #e5e7eb">
            <span class="ce-arrow" style="font-size:8px;color:#888;width:10px;text-align:center">&#9654;</span>
            <i class="fa-solid fa-comments" style="color:#6366f1;font-size:12px;width:16px;text-align:center;flex-shrink:0"></i>
            <span style="flex:1;font-size:11px;font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.title || 'Untitled')}</span>
            <span style="font-size:10px;color:#999;white-space:nowrap;flex-shrink:0">${msgCount} msgs${dateStr ? ' \u2022 ' + dateStr : ''}</span>
            <span class="ce-del" data-sid="${s.id}" style="cursor:pointer;font-size:10px;flex-shrink:0;width:18px;text-align:center;color:#ef4444;pointer-events:auto"><i class="fa-solid fa-trash-can"></i></span>
          </div>
          <div class="ce-children" id="ce-${uid}" style="display:none;padding:2px 0 4px 0">`;

        html += renderTreeValue(s.id || String(i), s, s.id || String(i), 0);

        html += `</div></div>`;
      });

      html += `
          </div>
          <div style="padding:10px 16px;border-top:1px solid #e0e0e0;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:8px">
              <button id="ce-refresh" class="server-save-btn" style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-rotate"></i> Refresh</button>
              <span style="font-size:11px;color:#888">${sessions.length} sessions</span>
            </div>
            <button id="ce-save-all" class="server-save-btn">Save All Changes</button>
          </div>
        </div>`;
      body.innerHTML = html;
      const scrollEl = document.getElementById('ce-scroll');
      if (scrollEl) scrollEl.scrollTop = savedState.scrollTop;
      restoreCEState(savedState);

      body.querySelectorAll('.ce-toggle').forEach(toggle => {
        toggle.addEventListener('click', e => {
          if (e.target.closest('.ce-del')) return;
          const target = document.getElementById('ce-' + toggle.dataset.target);
          const arrow = toggle.querySelector('.ce-arrow');
          if (target) {
            const isOpen = target.style.display !== 'none';
            target.style.display = isOpen ? 'none' : 'block';
            arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
          }
        });
      });

      // Tree node toggle (from renderTreeValue)
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

      // Delete
      body.querySelectorAll('.ce-del').forEach(el => {
        el.addEventListener('click', async e => {
          e.stopPropagation();
          const sid = el.dataset.sid;
          if (!sid || !confirm('Delete this chat session?')) return;
          try {
            const icon = el.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            await apiPost('/admin/delete-chat-session', { id: sid });
            sessions = sessions.filter(s => s.id !== sid);
            renderCE(saveCEState());
          } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
        });
      });

      // Refresh
      document.getElementById('ce-refresh').onclick = async () => {
        const icon = document.querySelector('#ce-refresh i');
        icon.classList.add('fa-spin');
        const state = saveCEState();
        try {
          const res = await apiGet('/admin/chat-sessions');
          sessions = res.sessions || [];
          renderCE(state);
        } catch (e) {
          showToast('Refresh failed: ' + e.message, 'error');
        } finally {
          icon.classList.remove('fa-spin');
        }
      };

      // Save
      document.getElementById('ce-save-all').onclick = async () => {
        let count = 0;
        for (const s of sessions) {
          const value = reconstructValueFromTree(s.id, body);
          if (!value || typeof value !== 'object') continue;
          try {
            if (value.title !== undefined && value.title !== s.title) {
              await apiPost('/admin/update-chat-session', { id: s.id, key: 'title', value: String(value.title) });
              count++;
            }
            if (value.messages !== undefined) {
              await apiPost('/admin/update-chat-session', { id: s.id, key: 'messages', value: JSON.stringify(value.messages) });
              count++;
            }
          } catch (_) {}
        }
        showToast('Saved ' + count + ' changes', 'success');
      };
    }

    try {
      const res = await apiGet('/admin/chat-sessions');
      sessions = res.sessions || [];
      renderCE();
    } catch (e) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444">Failed to load: ' + e.message + '</div>';
    }
  })();
}

function openDirectorDataEditor() {
  const wid = createWindow({ title: 'Director Data Editor', icon: 'fa-clapperboard', width: 800, height: 550, stateKey: 'DirectorDataEditor' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = '#fff';
  body.style.padding = '0';
  body.innerHTML = '<div style="padding:20px;text-align:center;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

  (async () => {
    let sessions = [];

    function saveDEState() {
      const openNodes = new Set();
      document.querySelectorAll('[id^="de-"]').forEach(el => {
        if (el.style.display === 'block') openNodes.add(el.id.replace('de-', ''));
      });
      const seOpen = new Set();
      document.querySelectorAll('[id^="se-"]').forEach(el => {
        if (el.style.display === 'block') seOpen.add(el.id.replace('se-', ''));
      });
      return { openNodes, seOpen, scrollTop: document.getElementById('de-scroll')?.scrollTop || 0 };
    }

    function restoreDEState(state) {
      state.openNodes.forEach(uid => {
        const el = document.getElementById('de-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.de-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.de-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
      state.seOpen.forEach(uid => {
        const el = document.getElementById('se-' + uid);
        if (el) el.style.display = 'block';
        const toggle = document.querySelector(`.se-toggle[data-target="${CSS.escape(uid)}"]`);
        if (toggle) {
          const arrow = toggle.querySelector('.se-arrow');
          if (arrow) arrow.innerHTML = '&#9660;';
        }
      });
    }

    function renderDE(savedState) {
      if (!savedState) savedState = saveDEState();
      let html = `
        <div style="display:flex;flex-direction:column;height:100%">
          <div id="de-scroll" style="flex:1;overflow-y:auto;min-height:0;padding:8px 0 8px 10px">`;

      sessions.forEach((s, i) => {
        const uid = uidFromPath(s.id || String(i));
        const sceneCount = (s.scenes || []).length;
        const msgCount = (s.messages || []).length;
        const dateStr = s.created ? new Date(s.created).toLocaleDateString() : '';
        html += `<div data-de-item="${uid}" style="margin-bottom:2px">
          <div class="de-toggle" data-target="${uid}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;user-select:none;border-radius:4px;background:${i % 2 === 0 ? '#f9fafb' : '#fff'};border:1px solid #e5e7eb">
            <span class="de-arrow" style="font-size:8px;color:#888;width:10px;text-align:center">&#9654;</span>
            <i class="fa-solid fa-clapperboard" style="color:#6366f1;font-size:12px;width:16px;text-align:center;flex-shrink:0"></i>
            <span style="flex:1;font-size:11px;font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.title || 'Untitled')}</span>
            <span style="font-size:10px;color:#999;white-space:nowrap;flex-shrink:0">${sceneCount} scenes, ${msgCount} msgs${dateStr ? ' \u2022 ' + dateStr : ''}</span>
            <span class="de-del" data-sid="${s.id}" style="cursor:pointer;font-size:10px;flex-shrink:0;width:18px;text-align:center;color:#ef4444;pointer-events:auto"><i class="fa-solid fa-trash-can"></i></span>
          </div>
          <div class="de-children" id="de-${uid}" style="display:none;padding:2px 0 4px 0">`;

        html += renderTreeValue(s.id || String(i), s, s.id || String(i), 0);

        html += `</div></div>`;
      });

      html += `
          </div>
          <div style="padding:10px 16px;border-top:1px solid #e0e0e0;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:8px">
              <button id="de-refresh" class="server-save-btn" style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-rotate"></i> Refresh</button>
              <span style="font-size:11px;color:#888">${sessions.length} sessions</span>
            </div>
            <button id="de-save-all" class="server-save-btn">Save All Changes</button>
          </div>
        </div>`;
      body.innerHTML = html;
      const scrollEl = document.getElementById('de-scroll');
      if (scrollEl) scrollEl.scrollTop = savedState.scrollTop;
      restoreDEState(savedState);

      body.querySelectorAll('.de-toggle').forEach(toggle => {
        toggle.addEventListener('click', e => {
          if (e.target.closest('.de-del')) return;
          const target = document.getElementById('de-' + toggle.dataset.target);
          const arrow = toggle.querySelector('.de-arrow');
          if (target) {
            const isOpen = target.style.display !== 'none';
            target.style.display = isOpen ? 'none' : 'block';
            arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
          }
        });
      });

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

      body.querySelectorAll('.de-del').forEach(el => {
        el.addEventListener('click', async e => {
          e.stopPropagation();
          const sid = el.dataset.sid;
          if (!sid || !confirm('Delete this director session?')) return;
          try {
            const icon = el.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            await apiPost('/admin/delete-director-session', { id: sid });
            sessions = sessions.filter(s => s.id !== sid);
            renderDE(saveDEState());
          } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
        });
      });

      document.getElementById('de-refresh').onclick = async () => {
        const icon = document.querySelector('#de-refresh i');
        icon.classList.add('fa-spin');
        const state = saveDEState();
        try {
          const res = await apiGet('/admin/director-sessions');
          sessions = res.sessions || [];
          renderDE(state);
        } catch (e) {
          showToast('Refresh failed: ' + e.message, 'error');
        } finally {
          icon.classList.remove('fa-spin');
        }
      };

      document.getElementById('de-save-all').onclick = async () => {
        let count = 0;
        for (const s of sessions) {
          const value = reconstructValueFromTree(s.id, body);
          if (!value || typeof value !== 'object') continue;
          try {
            if (value.title !== undefined && value.title !== s.title) {
              await apiPost('/admin/update-director-session', { id: s.id, key: 'title', value: String(value.title) });
              count++;
            }
            if (value.settings !== undefined && value.settings !== s.settings) {
              await apiPost('/admin/update-director-session', { id: s.id, key: 'settings', value: typeof value.settings === 'object' ? JSON.stringify(value.settings) : String(value.settings) });
              count++;
            }
            if (value.scenes !== undefined) {
              await apiPost('/admin/update-director-session', { id: s.id, key: 'scenes', value: JSON.stringify(value.scenes) });
              count++;
            }
            if (value.messages !== undefined) {
              await apiPost('/admin/update-director-session', { id: s.id, key: 'messages', value: JSON.stringify(value.messages) });
              count++;
            }
          } catch (_) {}
        }
        showToast('Saved ' + count + ' changes', 'success');
      };
    }

    try {
      const res = await apiGet('/admin/director-sessions');
      sessions = res.sessions || [];
      renderDE();
    } catch (e) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444">Failed to load: ' + e.message + '</div>';
    }
  })();
}

function openDirector() {
  const wid = createWindow({ title: 'Director', icon: 'fa-clapperboard', width: 900, height: 650, stateKey: 'Director' });
  const el = document.getElementById(wid);
  const body = el.querySelector('.window-body');
  body.style.background = 'var(--chat-bg)';
  body.style.padding = '0';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';

  let currentSessionId = null;
  let settings = { aspect_ratio: typeof bbAr !== 'undefined' ? bbAr : '16:9', resolution: typeof bbRes !== 'undefined' ? bbRes : '720p', duration: 6, loras: [], image_model: typeof currentImageModel !== 'undefined' ? currentImageModel : 'schnell' };
  let directorMessages = [];
  let directorScenes = [];
  let drAttachments = [];
  let directorSessions = [];

  let lastDebugMessages = null;
  let debugActiveTab = 'system';

  const style = document.createElement('style');
  style.textContent = `
    .dr-pills { display:flex; gap:6px; padding:6px 12px; background:var(--chat-bar-bg, #f0f0f0); border-bottom:1px solid var(--chat-bar-border, #ddd); flex-wrap:wrap; flex-shrink:0; }
    .dr-pill { display:flex; align-items:center; gap:4px; padding:3px 10px; border-radius:12px; border:1px solid var(--chat-bar-border, #ddd); background:var(--chat-btn-bg, #fff); color:var(--chat-input-color, #333); font-size:11px; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
    .dr-pill:hover { border-color:var(--accent, #6366f1); color:var(--accent, #6366f1); }
    .dr-pill i { font-size:9px; opacity:0.6; }
    .dr-timeline { display:flex; gap:8px; padding:8px 12px; overflow-x:auto; flex-shrink:0; background:var(--chat-bar-bg, #f0f0f0); border-bottom:1px solid var(--chat-bar-border, #ddd); min-height:80px; align-items:stretch; }
    .dr-scene-card { flex-shrink:0; width:100px; background:var(--chat-btn-bg, #fff); border:1px solid var(--chat-bar-border, #ddd); border-radius:8px; padding:4px; display:flex; flex-direction:column; gap:3px; position:relative; }
    .dr-scene-card .sc-lora { font-size:8px; color:var(--accent, #6366f1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:1px 2px; }
    .dr-scene-card .sc-header { display:flex; justify-content:space-between; align-items:center; font-size:9px; color:var(--chat-muted, #888); }
    .dr-scene-card .sc-header .sc-num { font-weight:600; color:var(--accent, #6366f1); }
    .dr-scene-card .sc-title { font-size:10px; font-weight:500; color:var(--chat-input-color, #333); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .dr-scene-card .sc-thumb { width:100%; aspect-ratio:16/9; border-radius:3px; overflow:hidden; background:var(--chat-bg, #f5f5f7); display:flex; align-items:center; justify-content:center; position:relative; }
    .dr-scene-card .sc-thumb img { width:100%; height:100%; object-fit:cover; }
    .dr-scene-card .sc-thumb .sc-pending { font-size:9px; color:var(--chat-muted, #888); }
    .dr-scene-card .sc-actions { display:flex; gap:2px; justify-content:flex-end; }
    .dr-scene-card .sc-actions button { padding:1px 4px; font-size:8px; border-radius:3px; border:1px solid var(--chat-bar-border, #ddd); background:var(--chat-btn-bg, #fff); color:var(--chat-muted, #666); cursor:pointer; }
    .dr-scene-card .sc-actions button:hover { border-color:var(--accent, #6366f1); color:var(--accent, #6366f1); }
    .dr-scene-card .sc-actions .sc-del { color:#f87171; }
    .dr-scene-card .sc-actions .sc-del:hover { border-color:#f87171; }
    .dr-attachments { display:flex; gap:6px; padding:6px 12px; flex-shrink:0; background:var(--chat-bar-bg, #f0f0f0); border-top:1px solid var(--chat-bar-border, #ddd); overflow-x:auto; min-height:44px; align-items:center; }
    .dr-att { display:flex; align-items:center; gap:4px; padding:2px 6px; border-radius:6px; border:1px solid var(--chat-bar-border, #ddd); background:var(--chat-btn-bg, #fff); font-size:11px; flex-shrink:0; }
    .dr-att img { width:32px; height:24px; object-fit:cover; border-radius:3px; }
    .dr-att .dr-att-trash { cursor:pointer; color:var(--chat-muted, #888); padding:2px; font-size:10px; }
    .dr-att .dr-att-trash:hover { color:#f87171; }
    .dr-scene-card .sc-gen-progress { font-size:8px; color:var(--accent, #6366f1); text-align:center; padding:1px 0; }
    .dr-sess-time { font-size:9px; opacity:0.5; flex-shrink:0; }
    #dr-sess-list .ch-del { position:absolute; top:2px; right:2px; opacity:1; width:18px; height:18px; font-size:10px; background:var(--danger-bg,rgba(220,38,38,0.15)); color:var(--danger-text,#ef4444); z-index:2; }
    #dr-sess-list .ch-del:hover { background:var(--danger-text,#ef4444); color:#fff; }
    .dr-debug-toggle { display:flex; align-items:center; gap:4px; padding:3px 8px; font-size:10px; cursor:pointer; color:var(--text-secondary, #888); flex-shrink:0; border:none; background:transparent; }
    .dr-debug-toggle:hover { color:var(--accent, #6366f1); }
    .dr-debug-panel { display:none; flex-direction:column; flex-shrink:0; max-height:200px; border-top:1px solid var(--cp-border, #ddd); background:var(--window-bg, #fff); font-size:10px; font-family:monospace; overflow:hidden; }
    .dr-debug-panel.open { display:flex; }
    .dr-debug-tabs { display:flex; gap:0; flex-shrink:0; border-bottom:1px solid var(--cp-border, #ddd); }
    .dr-debug-tab { padding:4px 10px; cursor:pointer; color:var(--text-secondary, #888); border-bottom:2px solid transparent; font-size:10px; }
    .dr-debug-tab.active { color:var(--text-primary, #333); border-color:var(--accent, #6366f1); }
    .dr-debug-content { flex:1; overflow:auto; padding:6px 8px; white-space:pre-wrap; word-break:break-all; user-select:text; }
    .dr-debug-copy { padding:2px 6px; font-size:9px; cursor:pointer; color:var(--text-secondary,#888); background:transparent; border:1px solid var(--cp-border,#ddd); border-radius:3px; margin-left:auto; }
    .dr-debug-copy:hover { color:var(--accent,#6366f1); border-color:var(--accent,#6366f1); }
    .dr-pills select { font-size:11px; padding:2px 6px; border-radius:6px; border:1px solid var(--chat-bar-border,#ddd); background:var(--chat-btn-bg,#fff); color:var(--chat-input-color,#333); cursor:pointer; }
    .dr-pills select:focus { outline:none; border-color:var(--accent,#6366f1); }
    .dr-pills select:hover { border-color:var(--accent,#6366f1); }
  `;
  // === Settings pills ===
  function renderSettingsPills() {
    const bar = document.getElementById('dr-pills');
    if (!bar) return;
    let loraChips = '';
    if (settings.loras && settings.loras.length) {
      loraChips = settings.loras.map(l => {
        const name = typeof l === 'string' ? l : l.name || '';
        return '<span class="dr-pill dr-lora-chip" style="color:var(--accent,#6366f1);border-color:var(--accent,#6366f1)"><i class="fa-solid fa-layer-group"></i> ' + escHtml(name.split('.')[0]) + ' <span class="dr-lora-rm" data-lora="' + escHtml(name) + '" style="margin-left:4px;cursor:pointer;opacity:0.6">✕</span></span>';
      }).join('');
    }
    const ratios = ['16:9', '3:2', '1:1', '9:16', '2:3', '4:3'];
    const resolutions = ['480p', '720p', '1080p'];
    const durations = [1,2,3,4,5,6,7,8,9,10,15,20,30,40,50,60];
    bar.innerHTML = `
      <select id="dr-ar-select" title="Aspect Ratio"><option disabled>AR</option>${ratios.map(r => '<option value="' + r + '"' + (settings.aspect_ratio === r ? ' selected' : '') + '>' + r + '</option>').join('')}</select>
      <select id="dr-res-select" title="Resolution"><option disabled>Res</option>${resolutions.map(r => '<option value="' + r + '"' + (settings.resolution === r ? ' selected' : '') + '>' + r + '</option>').join('')}</select>
      <select id="dr-dur-select" title="Duration per scene (seconds)"><option disabled>Dur</option>${durations.map(d => '<option value="' + d + '"' + ((settings.duration || 6) === d ? ' selected' : '') + '>' + d + 's</option>').join('')}</select>
      ${loraChips}
    `;
    bar.querySelectorAll('.dr-lora-rm').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = el.dataset.lora;
        settings.loras = settings.loras.filter(l => (typeof l === 'string' ? l : l.name) !== name);
        renderSettingsPills();
        saveSettings();
      });
    });
    document.getElementById('dr-ar-select')?.addEventListener('change', (e) => {
      settings.aspect_ratio = e.target.value;
      renderSettingsPills();
      saveSettings();
    });
    document.getElementById('dr-res-select')?.addEventListener('change', (e) => {
      settings.resolution = e.target.value;
      renderSettingsPills();
      saveSettings();
    });
    document.getElementById('dr-dur-select')?.addEventListener('change', (e) => {
      settings.duration = parseInt(e.target.value) || 6;
      renderSettingsPills();
      saveSettings();
    });
  }

  async function saveSettings() {
    if (!currentSessionId) return;
    try { await apiPost('/director/sessions/' + currentSessionId + '/settings', { settings }); } catch (e) {}
  }

  // === Timeline ===
  function renderTimeline() {
    const container = document.getElementById('dr-timeline');
    if (!container) return;
    if (!directorScenes.length) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    container.innerHTML = '';
    directorScenes.forEach((sc, i) => {
      const card = document.createElement('div');
      card.className = 'dr-scene-card';
      const hasImg = sc.candidate_images && sc.candidate_images.length > 0;
      const selectedImg = sc.selected_image_id;
      const previewAsset = selectedImg ? allAssets.find(a => a.id === selectedImg) : null;
      const firstAsset = hasImg && !previewAsset ? allAssets.find(a => a.id === sc.candidate_images[0]) : null;
      const thumbSrc = previewAsset ? '/images/' + previewAsset.filename : (firstAsset ? '/images/' + firstAsset.filename : null);
      const isGenerating = sc._generating;
      const asset = previewAsset || firstAsset;
      let sceneAr = (settings.aspect_ratio || '16:9').replace(':', '/');
      if (asset) {
        if (asset.aspect_ratio) sceneAr = asset.aspect_ratio.replace(':', '/');
        else if (asset.width && asset.height) sceneAr = asset.width + '/' + asset.height;
      }

      let thumbHtml = '';
      if (isGenerating) {
        thumbHtml = '<div class="sc-gen-progress"><div class="spinner" style="width:14px;height:14px;margin:0 auto"></div><div>generating...</div></div>';
      } else if (thumbSrc) {
        thumbHtml = '<img src="' + thumbSrc + '" loading="lazy">';
      } else {
        thumbHtml = '<span class="sc-pending"><i class="fa-solid fa-hourglass-half"></i> pending</span>';
      }

      const activeLora = sc.lora_name || (settings.loras && settings.loras.length ? (typeof settings.loras[0] === 'string' ? settings.loras[0] : (settings.loras[0].name || '')) : null);

      card.innerHTML = `
        <div class="sc-header">
          <span class="sc-num">#${i + 1}</span>
          <span>${(sc.duration || 5).toFixed(1)}s</span>
        </div>
        <div class="sc-title" title="${escHtml(sc.description || sc.title || '')}">${escHtml(sc.description || sc.title || 'Scene ' + (i + 1))}</div>
        <div class="sc-thumb" style="aspect-ratio:${sceneAr}">${thumbHtml}</div>
        ${activeLora ? '<div class="sc-lora" title="' + escHtml(activeLora) + '"><i class="fa-solid fa-layer-group"></i> ' + escHtml(activeLora.split('.')[0]) + '</div>' : ''}
        <div class="sc-actions">
          ${hasImg ? '<button class="sc-regen" title="Regenerate"><i class="fa-solid fa-rotate"></i></button><button class="sc-del" title="Delete image"><i class="fa-solid fa-trash-can"></i></button>' : ''}
        </div>
      `;

      // Wire actions
      const regenBtn = card.querySelector('.sc-regen');
      const delBtn = card.querySelector('.sc-del');
      if (regenBtn) regenBtn.onclick = (e) => { e.stopPropagation(); generateSceneImage(sc); };
      if (delBtn) delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('Delete scene #' + (sc.scene_number || (directorScenes.indexOf(sc) + 1)) + '?')) return;
        try {
          await apiPost('/director/sessions/' + currentSessionId + '/scene/' + sc.id + '/delete', {});
          const idx = directorScenes.indexOf(sc);
          if (idx >= 0) {
            directorScenes.splice(idx, 1);
            // Renumber in-memory
            directorScenes.forEach((s, i) => s.scene_number = i + 1);
          }
          renderTimeline();
          showToast('Scene deleted', 'success');
        } catch (e) { showToast('Failed to delete scene', 'error'); }
      };

      container.appendChild(card);
    });
  }

  // === Attachments ===
  function renderAttachments() {
    const bar = document.getElementById('dr-attachments');
    if (!bar) return;
    bar.innerHTML = '';
    if (!drAttachments.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    drAttachments.forEach((att, i) => {
      const el = document.createElement('div');
      el.className = 'dr-att';
      if (att.type === 'image' || att.type === 'video') {
        el.innerHTML = '<img src="' + att.src + '"><span>' + escHtml(att.name) + '</span>';
      } else if (att.type === 'audio') {
        el.innerHTML = '<i class="fa-solid fa-music" style="color:#8b5cf6;font-size:13px"></i><span>' + escHtml(att.name) + '</span>';
      }
      const trash = document.createElement('span');
      trash.className = 'dr-att-trash';
      trash.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      trash.onclick = () => { drAttachments.splice(i, 1); renderAttachments(); };
      el.appendChild(trash);
      bar.appendChild(el);
    });
  }

  // === Messages ===
  function renderMessages() {
    const container = document.getElementById('dr-msgs');
    if (!container) return;
    container.innerHTML = '';
    if (!directorMessages.length) {
      const welcome = document.createElement('div');
      welcome.className = 'chat-msg assistant';
      welcome.innerHTML = '<div class="msg-text">🎬 Welcome to Director! Tell me about the video you want to create. I\'ll help you plan scenes, generate images, and build a complete sequence.</div><div class="msg-time">' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</div>';
      container.appendChild(welcome);
      return;
    }
    directorMessages.forEach(m => {
      const d = document.createElement('div');
      d.className = 'chat-msg ' + (m.role || 'assistant');
      d.innerHTML = '<div class="msg-text">' + mdToHtml(m.content) + '</div><div class="msg-time">' + (m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '') + '</div>';
      container.appendChild(d);
    });
    container.scrollTop = container.scrollHeight;
  }

  // === Generation ===
  async function generateSceneImage(scene) {
    if (!scene || !scene.prompt || !currentSessionId) return;
    scene._generating = true;
    renderTimeline();

    const aspect = settings.aspect_ratio || '16:9';
    const prompt = scene.prompt;
    const loraName = scene.lora_name || (settings.loras && settings.loras.length ? (typeof settings.loras[0] === 'string' ? settings.loras[0] : settings.loras[0].name) : null);
    const loraStr = 0.6;
    const model = settings.image_model || currentImageModel || 'schnell';
    const workflowLabel = loraName ? `LoRA (${loraName.split('.')[0]})` : model === 'klein' ? 'Klein' : model === 'qwen' ? 'Qwen' : 'Schnell';
    showToast('Generating with ' + workflowLabel + ' workflow', 'info');

    try {
      const body = {
        prompt,
        resolution: settings.resolution || '720p',
        aspect_ratio: aspect,
        mode: 'image',
        count: 1,
        image_model: model,
        qwen_turbo: typeof qwenTurbo !== 'undefined' ? qwenTurbo : true,
        lora_name: loraName,
        lora_strength: loraStr
      };
      const resp = await fetch('/generate/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let generatedFn = null;
      let genW = 0, genH = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === 'image_ready') {
            generatedFn = evt.local_filename;
            if (evt.width) genW = evt.width;
            if (evt.height) genH = evt.height;
          }
        }
      }
      if (generatedFn) {
        const saveRes = await apiPost('/director/sessions/' + currentSessionId + '/scene/' + scene.id + '/save-image', {
          filename: generatedFn, prompt, width: genW, height: genH, aspect_ratio: aspect, lora_name: loraName
        });
        if (!allAssets.some(a => a.id === saveRes.asset_id)) allAssets.push({ id: saveRes.asset_id, type: 'image', filename: generatedFn, prompt, width: genW, height: genH, aspect_ratio: aspect });
        if (!scene.candidate_images) scene.candidate_images = [];
        scene.candidate_images.push(saveRes.asset_id);
        scene.selected_image_id = saveRes.asset_id;
        // Persist selected_image_id immediately
        try { await apiPost('/director/sessions/' + currentSessionId + '/scene/' + scene.id + '/select-image', { asset_id: saveRes.asset_id }); } catch (_) {}

        showToast('Image generated for scene #' + (scene.scene_number || (directorScenes.indexOf(scene) + 1)), 'success');
      }
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error');
    }
    scene._generating = false;
    renderTimeline();
  }

  async function generateDirectorVideoForScene(scene) {
    if (!scene || !scene.selected_image_id) return;
    const imgAsset = allAssets.find(a => a.id === scene.selected_image_id);
    if (!imgAsset || !imgAsset.filename) return;
    scene._generating = true;
    renderTimeline();

    const aspect = settings.aspect_ratio || '16:9';
    const vprompt = (scene.prompt || imgAsset.prompt || 'cinematic motion') + ', smooth camera';
    const duration = Math.max(2, Math.min(30, Math.round(scene.duration || 6)));

    const body = {
      prompt: vprompt,
      resolution: settings.resolution || '720p',
      aspect_ratio: aspect,
      mode: 'video',
      duration,
      count: 1,
      source_image: imgAsset.filename,
      image_model: settings.image_model || currentImageModel || 'schnell',
      qwen_turbo: typeof qwenTurbo !== 'undefined' ? qwenTurbo : true
    };

    let videoFn = null;
    let vidW = 0, vidH = 0, vidDur = duration;
    try {
      const resp = await fetch('/generate/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === 'video_ready') {
            videoFn = evt.local_filename;
            if (evt.width) vidW = evt.width;
            if (evt.height) vidH = evt.height;
            if (evt.duration) vidDur = evt.duration;
          }
        }
      }
      if (videoFn) {
        scene.video_id = videoFn;
        scene.status = 'has_video';
        scene.video_duration = vidDur;
        try {
          await apiPost('/director/sessions/' + currentSessionId + '/scene/' + scene.id + '/save-video', {
            filename: videoFn, duration: vidDur, prompt: vprompt,
            width: vidW, height: vidH, parent_id: scene.selected_image_id
          });
        } catch (_) {}
        showToast('Video generated for scene #' + (scene.scene_number || (directorScenes.indexOf(scene) + 1)), 'success');
      }
    } catch (e) {
      showToast('Video generation failed: ' + e.message, 'error');
    }
    scene._generating = false;
    renderTimeline();
  }

  function updateDebugPanel() {
    const content = document.getElementById('dr-debug-content');
    if (!content) return;
    if (!lastDebugMessages || !lastDebugMessages.length) {
      content.textContent = 'No debug data yet.';
      return;
    }
    if (debugActiveTab === 'system') {
      const sys = lastDebugMessages.filter(m => m.role === 'system');
      content.textContent = sys.length ? sys.map(m => m.content).join('\n\n---\n\n') : '(no system messages)';
    } else if (debugActiveTab === 'user') {
      const texts = lastDebugMessages.filter(m => m.role === 'user').map(m => m.content);
      content.textContent = texts.length ? texts.join('\n\n---\n\n') : '(no user messages)';
    } else if (debugActiveTab === 'response') {
      const texts = lastDebugMessages.filter(m => m.role === 'assistant').map(m => m.content);
      content.textContent = texts.length ? texts.join('\n\n---\n\n') : '(no responses yet)';
    }
  }

  async function autoGenerateScenes() {
    const pending = directorScenes.filter(sc => sc.prompt && (!sc.candidate_images || !sc.candidate_images.length));
    if (!pending.length) return;
    const container = document.getElementById('dr-msgs');
    const progressMsg = document.createElement('div');
    progressMsg.className = 'chat-msg assistant';
    progressMsg.innerHTML = '<div class="msg-text"><i class="fa-solid fa-wand-magic-sparkles"></i> Generating images for ' + pending.length + ' scene(s)...</div>';
    container.appendChild(progressMsg);
    container.scrollTop = container.scrollHeight;

    for (const sc of pending) {
      await generateSceneImage(sc);
    }
    const doneText = 'All images generated! You can trash or regenerate individual images from the timeline.';
    progressMsg.innerHTML = '<div class="msg-text" style="color:var(--accent, #6366f1)"><i class="fa-solid fa-check-circle"></i> ' + doneText + '</div>';
    container.scrollTop = container.scrollHeight;
    directorMessages.push({ role: 'assistant', content: doneText, timestamp: new Date().toISOString() });
    try {
      await apiPost('/director/sessions/' + currentSessionId + '/add-message', { role: 'assistant', content: doneText });
    } catch (_) {}
  }

  // === Session ops ===
  async function loadSession(sessionId) {
    currentSessionId = sessionId;
    try {
      const data = await apiGet('/director/sessions/' + sessionId);
      if (data.settings && typeof data.settings === 'object') {
        settings = { ...settings, ...data.settings };
      }
      lastDebugMessages = null;
      updateDebugPanel();
      directorMessages = data.messages || [];
      directorScenes = [];
      const seen = new Set();
      (data.scenes || []).forEach(sc => {
        const num = sc.scene_number;
        if (num != null && seen.has(num)) return;
        if (num != null) seen.add(num);
        directorScenes.push({ ...sc, prompt: sc.prompt || sc.generated_prompt || '', lora_name: sc.lora_name || null });
      });
      // Reload available assets as attachments
      drAttachments = (data.available_assets || []).map(a => ({
        type: a.type, name: a.filename,
        src: '/' + a.type + 's/' + a.filename, id: a.asset_id
      }));
      renderSettingsPills();
      renderTimeline();
      renderMessages();
      renderAttachments();
      // Scroll messages to bottom
      const mc = document.getElementById('dr-msgs');
      if (mc) setTimeout(() => mc.scrollTop = mc.scrollHeight, 50);
    } catch (e) {
      showToast('Failed to load session', 'error');
    }
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    if (!currentSessionId) {
      try {
        const sess = await apiPost('/director/sessions', {});
        currentSessionId = sess.id;
        directorSessions.unshift(sess);
        renderDirectorSidebar();
      } catch (e) {
        showToast('Failed to create session', 'error');
        return;
      }
    }

    const container = document.getElementById('dr-msgs');
    const now = new Date();
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-msg user';
    userDiv.innerHTML = '<div class="msg-text">' + mdToHtml(text) + '</div><div class="msg-time">' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</div>';
    container.appendChild(userDiv);
    container.scrollTop = container.scrollHeight;

    const typing = document.createElement('div');
    typing.className = 'chat-msg assistant';
    typing.innerHTML = '<div class="spinner" style="width:16px;height:16px;margin:4px 0"></div>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    try {
      const res = await apiPost('/director/sessions/' + currentSessionId + '/chat', { message: text, settings: settings });
      typing.remove();
      if (res.debug_messages) {
        lastDebugMessages = res.debug_messages;
        updateDebugPanel();
      }
      if (res.response) {
        const assistDiv = document.createElement('div');
        assistDiv.className = 'chat-msg assistant';
        assistDiv.innerHTML = '<div class="msg-text">' + mdToHtml(res.response) + '</div><div class="msg-time">' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</div>';
        container.appendChild(assistDiv);
        container.scrollTop = container.scrollHeight;
        directorMessages.push({ role: 'assistant', content: res.response });
      }
      // Apply any settings the agent returned (don't overwrite loras with empty from DB race)
      if (res.settings && typeof res.settings === 'object') {
        Object.keys(res.settings).forEach(k => {
          if (k === 'loras' && (!res.settings.loras || !res.settings.loras.length)) return;
          settings[k] = res.settings[k];
        });
        renderSettingsPills();
        saveSettings();
      }
      // Auto-generate if agent returned scenes
      if (res.generate && res.scenes && res.scenes.length) {
        for (const sc of res.scenes) {
          const num = sc.scene_number;
          const existing = num ? directorScenes.find(s => s.scene_number === num) : null;
          if (existing) {
            Object.assign(existing, sc, { id: existing.id });
          } else if (sc.id) {
            directorScenes.push(sc);
          }
        }
        renderTimeline();
        setTimeout(() => autoGenerateScenes(), 300);
      }
      // Handle scene actions (delete/regenerate from chat)
      if (res.scene_actions && res.scene_actions.length) {
        for (const act of res.scene_actions) {
          const sc = directorScenes.find(s => s.scene_number === act.scene_number);
          if (!sc) continue;
          if (act.action === 'delete') {
            const idx = directorScenes.indexOf(sc);
            if (idx >= 0) directorScenes.splice(idx, 1);
            directorScenes.forEach((s, i) => s.scene_number = i + 1);
          } else if (act.action === 'regenerate') {
            sc.candidate_images = [];
            sc.selected_image_id = null;
            sc.status = 'pending';
          }
        }
        renderTimeline();
        // Auto-generate images for regenerated scenes
        const toGen = directorScenes.filter(s => s.prompt && (!s.candidate_images || !s.candidate_images.length));
        if (toGen.length) {
          const container = document.getElementById('dr-msgs');
          const pg = document.createElement('div');
          pg.className = 'chat-msg assistant';
          pg.innerHTML = '<div class="msg-text"><i class="fa-solid fa-wand-magic-sparkles"></i> Regenerating ' + toGen.length + ' scene(s)...</div>';
          container.appendChild(pg);
          container.scrollTop = container.scrollHeight;
          for (const sc of toGen) { await generateSceneImage(sc); }
          pg.innerHTML = '<div class="msg-text" style="color:var(--accent)"><i class="fa-solid fa-check-circle"></i> Scene(s) regenerated!</div>';
          container.scrollTop = container.scrollHeight;
        }
      }
      // Handle video/animation generation
      if (res.animate) {
        const approved = directorScenes.filter(s => s.selected_image_id);
        if (!approved.length) {
          const msgDiv = document.createElement('div');
          msgDiv.className = 'chat-msg assistant';
          msgDiv.innerHTML = '<div class="msg-text" style="color:#f87171"><i class="fa-solid fa-circle-exclamation"></i> No approved scenes to animate. Generate images first.</div>';
          container.appendChild(msgDiv);
          directorMessages.push({ role: 'assistant', content: 'No approved scenes to animate.' });
        } else {
          const vpg = document.createElement('div');
          vpg.className = 'chat-msg assistant';
          vpg.innerHTML = '<div class="msg-text"><i class="fa-solid fa-film"></i> Generating videos for ' + approved.length + ' scene(s)...</div>';
          container.appendChild(vpg);
          container.scrollTop = container.scrollHeight;
          for (const sc of approved) {
            await generateDirectorVideoForScene(sc);
          }
          vpg.innerHTML = '<div class="msg-text" style="color:var(--accent)"><i class="fa-solid fa-check-circle"></i> Videos generated! ' + approved.length + ' scene(s) animated.</div>';
          container.scrollTop = container.scrollHeight;
          directorMessages.push({ role: 'assistant', content: 'Videos generated for all scenes!' });
          try {
            await apiPost('/director/sessions/' + currentSessionId + '/add-message', { role: 'assistant', content: 'Videos generated for all scenes!' });
          } catch (_) {}
        }
        renderTimeline();
      }
    } catch (e) {
      typing.remove();
      showToast('Failed to send message: ' + (e.message || 'unknown error'), 'error');
    }
  }

  // === Handle drop ===
  function handleDrop(e) {
    e.preventDefault();
    let raw = e.dataTransfer.getData('application/json');
    if (!raw) raw = e.dataTransfer.getData('text/plain');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data && data.type && data.src) {
          drAttachments.push({ type: data.type, name: data.name, src: data.src, id: data.id });
          renderAttachments();
          return;
        }
      } catch (_) {}
    }
    // File drop (desktop)
    const files = e.dataTransfer.files;
    if (files.length) {
      for (const file of files) {
        const type = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : null));
        if (!type) continue;
        const blobUrl = URL.createObjectURL(file);
        drAttachments.push({ type, name: file.name, src: blobUrl, id: null, _file: file });
      }
      renderAttachments();
    }
  }

  // === File upload ===
  async function uploadFiles(files) {
    if (!currentSessionId) return;
    for (const file of files) {
      const type = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : null));
      if (!type) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/director/sessions/' + currentSessionId + '/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          const src = '/' + type + 's/' + data.filename;
          drAttachments.push({ type, name: file.name, src, id: data.id });
          if (!allAssets.some(a => a.id === data.id)) {
            allAssets.push({ id: data.id, type, filename: data.filename });
          }
        }
      } catch (e) {
        showToast('Upload failed: ' + file.name, 'error');
      }
    }
    renderAttachments();
  }

  // === Session sidebar ===
  async function loadDirectorSessions() {
    try {
      const data = await apiGet('/director/sessions');
      directorSessions = data.sessions || [];
      renderDirectorSidebar();
    } catch (e) {
      showToast('Failed to load sessions', 'error');
    }
  }

  function renderDirectorSidebar() {
    const list = document.getElementById('dr-sess-list');
    if (!list) return;
    list.innerHTML = '';
    directorSessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'chat-session-item' + (s.id === currentSessionId ? ' active' : '');
      const title = s.title || 'Director Session';
      const time = s.last_updated ? new Date(s.last_updated).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
      item.title = title;
      item.style.position = 'relative';
      item.innerHTML = '<span>' + escHtml(title) + '</span><span class="dr-sess-time">' + time + '</span><button class="ch-del" title="Delete session"><i class="fa-solid fa-xmark"></i></button>';
      const delBtn = item.querySelector('.ch-del');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this session?')) return;
        try {
          await fetch('/director/sessions/' + s.id, { method: 'DELETE' });
          if (currentSessionId === s.id) {
            currentSessionId = null;
            const other = directorSessions.find(x => x.id !== s.id);
            const mainEl = document.getElementById('dr-main');
            if (other) {
              if (mainEl) mainEl.style.display = 'flex';
              await loadSession(other.id);
            } else {
              if (mainEl) mainEl.style.display = 'none';
              document.getElementById('dr-msgs').innerHTML = '';
              directorMessages = [];
              directorScenes = [];
            }
          }
          await loadDirectorSessions();
        } catch (e) {
          showToast('Failed to delete session', 'error');
        }
      });
      item.addEventListener('click', async () => {
        if (s.id === currentSessionId) return;
        const mainEl = document.getElementById('dr-main');
        if (mainEl) mainEl.style.display = 'flex';
        await loadSession(s.id);
        const msgContainer = document.getElementById('dr-msgs');
        if (msgContainer) setTimeout(() => { msgContainer.scrollTop = msgContainer.scrollHeight; }, 100);
        renderDirectorSidebar();
      });
      list.appendChild(item);
    });
  }

  async function switchToNewSession() {
    try {
      const sess = await apiPost('/director/sessions', {});
      currentSessionId = sess.id;
      directorMessages = [];
      directorScenes = [];
      settings = { aspect_ratio: typeof bbAr !== 'undefined' ? bbAr : '16:9', resolution: typeof bbRes !== 'undefined' ? bbRes : '720p', duration: 6, loras: [], image_model: typeof currentImageModel !== 'undefined' ? currentImageModel : 'schnell' };
      drAttachments = [];
      lastDebugMessages = null;
      updateDebugPanel();
      const mainEl = document.getElementById('dr-main');
      if (mainEl) mainEl.style.display = 'flex';
      renderSettingsPills();
      renderTimeline();
      renderMessages();
      renderAttachments();
      directorSessions.unshift(sess);
      renderDirectorSidebar();
    } catch (e) {
      showToast('Failed to create session', 'error');
    }
  }

  // === Build HTML ===
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div id="dr-pills" class="dr-pills"></div>
      <div style="display:flex;flex:1;min-height:0">
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <button id="dr-new-sess"><i class="fa-solid fa-plus"></i> New</button>
          </div>
          <div class="chat-sidebar-list" id="dr-sess-list"></div>
        </div>
        <div id="dr-main" class="chat-main" style="display:none">
          <div id="dr-timeline" class="dr-timeline"></div>
          <div id="dr-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:var(--chat-bg, #f5f5f7)"></div>
          <div id="dr-attachments" class="dr-attachments"></div>
          <div class="chat-bar" style="flex-shrink:0">
            <button class="chat-plus" id="dr-plus" title="Attach file"><i class="fa-solid fa-plus"></i></button>
            <input type="text" id="dr-input" placeholder="Tell me about your video...">
            <button id="dr-send"><i class="fa-solid fa-arrow-up"></i></button>
          </div>
          <button class="dr-debug-toggle" id="dr-debug-btn"><i class="fa-solid fa-bug"></i> Debug</button>
          <div class="dr-debug-panel" id="dr-debug-panel">
            <div class="dr-debug-tabs">
              <span class="dr-debug-tab active" data-tab="system">System</span>
              <span class="dr-debug-tab" data-tab="user">User</span>
              <span class="dr-debug-tab" data-tab="response">Response</span>
              <button class="dr-debug-copy" id="dr-debug-copy" title="Copy to clipboard"><i class="fa-solid fa-copy"></i> Copy</button>
            </div>
            <div class="dr-debug-content" id="dr-debug-content">No debug data yet.</div>
          </div>
        </div>
      </div>
    </div>
  `;
  body.appendChild(style);

  // === Init ===
  (async () => {
    if (!allAssets || !allAssets.length) {
      try { allAssets = await apiGet('/history'); } catch (_) {}
    }
    await loadDirectorSessions();
    if (directorSessions.length) {
      // Load most recent session
      const latest = directorSessions[0];
      const mainEl = document.getElementById('dr-main');
      if (mainEl) mainEl.style.display = 'flex';
      await loadSession(latest.id);
      renderDirectorSidebar();
    } else {
      // Create first session
      try {
        const sess = await apiPost('/director/sessions', {});
        currentSessionId = sess.id;
        directorSessions.unshift(sess);
        const mainEl = document.getElementById('dr-main');
        if (mainEl) mainEl.style.display = 'flex';
        renderDirectorSidebar();
        renderSettingsPills();
        renderMessages();
      } catch (e) {
        showToast('Failed to create session', 'error');
      }
    }
  })();

  // === Wire input, buttons, drag-drop ===
  setTimeout(() => {
    const newBtn = document.getElementById('dr-new-sess');
    if (newBtn) newBtn.addEventListener('click', switchToNewSession);

    const input = document.getElementById('dr-input');
    const sendBtn = document.getElementById('dr-send');
    const plusBtn = document.getElementById('dr-plus');

    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const text = input.value.trim();
          if (text) { input.value = ''; sendMessage(text); }
        }
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const text = input ? input.value.trim() : '';
        if (text && input) { input.value = ''; sendMessage(text); }
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        const fi = document.createElement('input');
        fi.type = 'file';
        fi.accept = 'image/*,video/*,audio/*';
        fi.multiple = true;
        fi.onchange = () => {
          if (fi.files.length) uploadFiles(fi.files);
        };
        fi.click();
      });
    }

    // Debug toggle
    const debugBtn = document.getElementById('dr-debug-btn');
    const debugPanel = document.getElementById('dr-debug-panel');
    if (debugBtn && debugPanel) {
      debugBtn.addEventListener('click', () => {
        debugPanel.classList.toggle('open');
      });
    }
    document.querySelectorAll('.dr-debug-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.dr-debug-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        debugActiveTab = tab.dataset.tab;
        updateDebugPanel();
      });
    });
    const copyBtn = document.getElementById('dr-debug-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const content = document.getElementById('dr-debug-content');
        if (!content || !content.textContent) return;
        try {
          await navigator.clipboard.writeText(content.textContent);
          copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
          setTimeout(() => { copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy'; }, 2000);
        } catch { }
      });
    }

    // Drag and drop on the whole body
    let dragCounter = 0;
    body.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; });
    body.addEventListener('dragover', (e) => { e.preventDefault(); });
    body.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) dragCounter = 0; });
    body.addEventListener('drop', handleDrop);
  }, 50);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showOllamaDebugDialog(debugInfo, rawText, errorMsg) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
        <div class="glass-panel" style="width:100%;max-width:1100px;max-height:85vh;display:flex;flex-direction:column;border:1px solid rgba(255,255,255,0.08)">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08)">
                <div style="font-weight:600;color:#34d399;display:flex;align-items:center;gap:8px">
                    <i class="fa-solid fa-bug"></i>
                    <span>Ollama Debug — Exact Request Sent + Raw Response</span>
                </div>
                <button id="close-ollama-debug" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:22px;cursor:pointer;padding:2px 8px">×</button>
            </div>
            <div id="ollama-debug-body" style="padding:12px;overflow:auto;flex:1;font-size:13px;font-family:monospace;display:flex;flex-direction:column;gap:12px">
                ${debugInfo ? `
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:4px">Ollama Server</div>
                    <div style="background:rgba(0,0,0,0.4);padding:6px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);color:#6ee7b7;white-space:pre-wrap">${escapeHtml(debugInfo.ollama_url || debugInfo.url || 'unknown')}</div>
                </div>
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between">
                        <span>Exact Request Body Sent to /api/generate</span>
                        <span><button class="copy-debug-btn" data-copy="full-request" style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit">Copy JSON Body</button>
                        <button class="copy-debug-btn" data-copy="curl" style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit">Copy as curl</button></span>
                    </div>
                    <pre style="background:rgba(0,0,0,0.4);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:11px;overflow:auto;max-height:200px;color:#a7f3d0">${escapeHtml(JSON.stringify((debugInfo && debugInfo.request && debugInfo.request.body) || {error: 'no request body'}, null, 2))}</pre>
                </div>
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between">
                        <span>System Prompt</span>
                        <button class="copy-debug-btn" data-copy="system" style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit">Copy</button>
                    </div>
                    <pre style="background:rgba(0,0,0,0.4);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:11px;overflow:auto;max-height:140px;color:#fde68a;white-space:pre-wrap">${escapeHtml(debugInfo.system_prompt || '')}</pre>
                </div>
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between">
                        <span>User Prompt</span>
                        <button class="copy-debug-btn" data-copy="user" style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit">Copy</button>
                    </div>
                    <pre style="background:rgba(0,0,0,0.4);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:11px;overflow:auto;max-height:200px;color:#bae6fd;white-space:pre-wrap">${escapeHtml(debugInfo.user_prompt || '')}</pre>
                </div>
                ` : ''}
                <div>
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between">
                        <span>Raw Model Response</span>
                        <button class="copy-debug-btn" data-copy="raw" style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit">Copy</button>
                    </div>
                    <pre style="background:rgba(0,0,0,0.4);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);font-size:11px;overflow:auto;max-height:240px;color:#fca5a5;white-space:pre-wrap">${escapeHtml(rawText || ((debugInfo && debugInfo.raw_response) || '(no raw text)'))}</pre>
                </div>
                ${errorMsg ? '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#f87171;margin-bottom:4px">Error / Note</div><div style="background:rgba(127,29,29,0.3);border:1px solid rgba(220,38,38,0.4);color:#fca5a5;padding:6px 8px;border-radius:4px;font-size:11px">' + escapeHtml(errorMsg) + '</div></div>' : ''}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-top:1px solid rgba(255,255,255,0.08);font-size:10px;color:rgba(255,255,255,0.4)">
                <div>Copy the "Exact Request Body" and paste it into Ollama's web UI for perfect reproduction.</div>
                <button id="close-ollama-debug2" style="padding:4px 12px;font-size:11px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-ollama-debug').onclick = close;
    overlay.querySelector('#close-ollama-debug2').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    overlay.querySelectorAll('.copy-debug-btn').forEach(btn => {
        btn.onclick = () => {
            let textToCopy = '';
            const type = btn.dataset.copy;

            if (type === 'system' && debugInfo) textToCopy = debugInfo.system_prompt || '';
            if (type === 'user' && debugInfo) textToCopy = debugInfo.user_prompt || '';
            if (type === 'raw') textToCopy = rawText || ((debugInfo && debugInfo.raw_response) || '');

            if (type === 'full-request' && debugInfo && debugInfo.request) {
                textToCopy = JSON.stringify(debugInfo.request.body, null, 2);
            }

            if (type === 'curl' && debugInfo && debugInfo.request) {
                const url = (debugInfo.request && debugInfo.request.url) || (debugInfo.ollama_url ? debugInfo.ollama_url + '/api/generate' : 'http://localhost:11434/api/generate');
                const blob = JSON.stringify((debugInfo.request && debugInfo.request.body) || {}, null, 2);
                textToCopy = 'curl -X POST "' + url + '" \\\n  -H "Content-Type: application/json" \\\n  -d \'' + blob.replace(/'/g, "'\\''") + '\'';
            }

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const orig = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = orig; }, 1200);
                }).catch(() => {
                    prompt('Copy this text:', textToCopy);
                });
            }
        };
    });
}

document.addEventListener('DOMContentLoaded', init);
