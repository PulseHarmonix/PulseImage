let currentMode = 'image';
let currentAspectRatio = '3:2';
let currentResolution = '720p';
let currentDuration = 1;

let lastPrompt = '';
let lastResolution = '720p';
let lastAspectRatio = '3:2';
let lastDuration = 1;

let lastLabeledPrompt = '';
let currentImageGrid = null;
let hasGenerated = false;

let isComfyConnected = true;

let currentModalParentId = null;
let currentModalSourceFilename = null;
let currentModalModifier = null; // {type: 'image'|'audio', filename: string, id?: any, prompt?: string} for video modifiers via modal + picker

let savedMainState = null; // {mode, duration, resolution, aspectRatio} captured on modal open to restore on close (prevents modal prefill/select from breaking main image gen count=4 vs video)

let currentImageModel = 'schnell'; // 'schnell', 'klein' or 'qwen' - persisted in settings.json, used for main page text-to-image gens (and project cues)
let currentI2IModel = 'klein'; // 'klein' or 'flux2' - persisted, used for modal image edits (i2i) when in image mode; default Flux 2 Klein
let qwenTurbo = true; // Enable 4 Steps LoRA (Turbo mode) when using Qwen model; persisted in settings
let libraryVideoPlayback = '1st_frame'; // '1st_frame' or 'play_loop' - persisted in settings.json, controls autoplay of videos in library
let currentLora = null; // selected LoRA filename (e.g. "foo.safetensors") for use with Flux Schnell + LoRA workflow; session only
let availableLoras = []; // populated from /loras on startup + refresh in settings

// Global asset state for computing variation badges (parent_id based children)
let allAssets = [];
let childrenMap = new Map(); // assetId -> {imageChildren: [], videoChildren: [] }

// ==================== PROJECTS (sidebar + waveform timeline + cue points) ====================
let projects = [];            // loaded from /projects
let currentProject = null;    // the active project object (mutated in place then saved)
let currentView = 'home';  // 'home' | 'library' | 'project' | 'chat'

// Library density for the new masonry view
let libraryDensity = 'full'; // 'full' | 'compact'
let libraryVideoObserver = null; // IntersectionObserver for pausing offscreen video cards in library when libraryVideoPlayback is 'play_loop'

// Preview / detail view state (in-place "normal" view, not a full isolating overlay modal).
// This lets us reuse the main bottom prompt bar (the one where rainbow already works reliably)
// instead of creating a second 'modal-' .input-bar inside a high-z overlay that breaks the rainbow CSS.
let currentPreviewAsset = null;  // the asset currently being previewed in the large detail area
let hadPreviewGenerations = false;  // set when we do parented gens while preview active; checked on hide to refresh library grid with new children

// Semantic reference for scroll restoration after a full masonry re-render (project return,
// explicit load after delete, etc.). When we must destroy/recreate the .library-scroller we
// use this to find a recognizable card and put the view back near the previous "area".
let previewReferenceAsset = null; // { assetId: string, offset: number } — offset is scrollTop - card.offsetTop at capture time

// (Legacy pixel-based scroll save removed — we now rely on keeping the .library-scroller
// DOM element alive across preview enter/exit for native preservation, plus semantic
// asset reference for the unavoidable full-rebuild cases.)

// Prompt enhancers (loaded from settings, editable by user). Used in library + detail prompt bars.
let promptEnhancers = [];
let currentEnhancer = 'none';

function getDefaultPromptEnhancers() {
    return [
        {"id": "none", "name": "No enhancement", "prompt": ""},
        {"id": "cinematic", "name": "Cinematic", "prompt": "cinematic lighting, dramatic composition, film grain, anamorphic lens, color graded, shot on 35mm, high production value, moody atmosphere"},
        {"id": "anime", "name": "Anime", "prompt": "detailed anime style, clean linework, vibrant colors, expressive eyes, dynamic anime composition, studio quality, sharp cel shading"},
        {"id": "photoreal", "name": "Photorealistic", "prompt": "photorealistic, ultra detailed, natural lighting and skin pores, shot on professional full-frame DSLR, 8k, realistic textures, subtle film grain"},
        {"id": "fantasy", "name": "Fantasy Art", "prompt": "epic fantasy illustration, magical glows, intricate details, rich saturated palette, painterly, high fantasy concept art, volumetric god rays"},
        {"id": "cyberpunk", "name": "Cyberpunk", "prompt": "cyberpunk neon city, rain reflections, holographic signs, high-tech low-life, dramatic rim lighting, blade runner aesthetic, moody blues and magentas"},
        {"id": "horror", "name": "Horror", "prompt": "horror movie still, deep shadows, unsettling atmosphere, fog, high contrast chiaroscuro, eerie practical lighting, psychological dread"},
        {"id": "watercolor", "name": "Watercolor", "prompt": "delicate watercolor illustration, soft bleeding edges, layered translucent washes, visible paper texture, artistic and light, beautiful color bleeding"},
        {"id": "oil", "name": "Oil Painting", "prompt": "classical oil painting on canvas, rich impasto texture, dramatic renaissance lighting, visible brush strokes, museum quality fine art"},
        {"id": "3d", "name": "3D Render", "prompt": "high-end 3D CGI render, octane/redshift quality, clean materials, studio product lighting, perfect reflections, ultra sharp, subsurface scattering"},
        {"id": "pixel", "name": "Pixel Art", "prompt": "beautiful 16-bit / 32-bit pixel art, crisp pixels, limited but vibrant palette, retro game aesthetic, clean dithering, nostalgic charm"},
        {"id": "surreal", "name": "Surreal", "prompt": "surreal dreamlike scene, impossible architecture, melting forms, symbolic, salvador dali influence, ethereal lighting, unexpected juxtapositions"},
        {"id": "minimal", "name": "Minimalist", "prompt": "minimalist elegant composition, generous negative space, simple refined forms, muted harmonious palette, zen calm, graphic design precision"},
        {"id": "vintage", "name": "Vintage Film", "prompt": "1970s vintage film photography, kodachrome colors, heavy film grain, slight fade, lens flare, warm nostalgic tones, analog photo look"},
        {"id": "steampunk", "name": "Steampunk", "prompt": "intricate steampunk machinery, brass copper leather, victorian industrial, glowing gauges, dramatic side lighting, rich sepia and teal palette"},
        {"id": "scifi", "name": "Sci-Fi", "prompt": "futuristic sci-fi concept art, sleek advanced tech, clean hard surface modeling, dramatic cinematic lighting, space opera scale, polished materials"},
        {"id": "cartoon", "name": "Cartoon", "prompt": "modern vibrant cartoon style, bold clean outlines, saturated playful colors, expressive features, pixar/disney 3d cartoon influence, polished"},
        {"id": "hyperreal", "name": "Hyperrealistic", "prompt": "hyperrealistic macro detail, insane texture fidelity, perfect anatomy and materials, razor sharp focus, controlled studio lighting"},
        {"id": "darkmoody", "name": "Dark Moody", "prompt": "dark moody cinematic lighting, deep crushed blacks, low key, desaturated cool tones, heavy atmosphere, film noir tension"},
        {"id": "epic", "name": "Epic", "prompt": "epic sweeping vista, heroic scale, majestic god rays, golden hour, national geographic level grandeur, awe-inspiring composition, ultra wide"}
    ];
}

function getEnhancerById(id) {
    if (!id || id === 'none') return {id: 'none', name: 'No enhancement', prompt: ''};
    return (promptEnhancers || []).find(e => e.id === id) || null;
}

// Chat mode state (ephemeral per browser session)
let chatMessages = [];            // [{role: 'user'|'assistant', content: string, thinking?: string, attachmentName?: string}]
let currentChatAttachment = null; // {name: string, content: string} | null for the current chat turn context
let projectAudio = null;      // <audio> element for current project's track
let projectPeaks = [];        // cached peaks for waveform draw
let projectDuration = 0;      // seconds
let projectCues = [];         // convenience ref = currentProject.cues (sorted)
let projectPlayheadEl = null; // the playhead div (created in render)
let projectWaveCanvas = null;
let projectPreviewImg = null;
let projectPreviewVideo = null;
let projectIsPlaying = false;

// Story Mode (working draft lives here while the wizard is open; persisted under currentProject.story)
let currentStory = null;   // { original_prompt, characters: [...], scenes: [...], ... }

// Waveform zoom/pan view state (UI only, not persisted on project)
let waveViewStart = 0;
let waveViewEnd = 0; // set on audio load / reset
let waveIsPanning = false;
let _projectPanMoveHandler = null;
let _projectPanUpHandler = null;
let _projectRafId = null;
let _sbMoveHandler = null;
let _sbUpHandler = null;

// Virtual playback support (for projects without audio file but with duration from story/scenes)
let _virtualBaseTime = 0;
let _virtualLastTs = 0;
let _virtualCurrentTime = 0;

const FRAME_RATE = 24;

function snapToFrame(t) {
  if (typeof t !== 'number' || t < 0) return 0;
  return Math.round(t * FRAME_RATE) / FRAME_RATE;
}

function formatTimeWithFrames(totalSeconds) {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00 / 00';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor( ((totalSeconds % 1) * FRAME_RATE) + 0.0001 ); // small epsilon for rounding
  return `${m}:${s.toString().padStart(2, '0')} / ${f.toString().padStart(2, '0')}`;
}

function getCurrentPlaybackTime() {
  if (projectAudio) {
    return projectAudio.currentTime || 0;
  }
  return _virtualCurrentTime || 0;
}

function startProjectRafPlayhead() {
  stopProjectRafPlayhead();
  const tick = () => {
    if (projectAudio && !projectAudio.paused && projectDuration > 0) {
      const curT = projectAudio.currentTime;

      updateProjectPlayhead(curT);
      updateProjectPreview(curT);
      updateProjectTimeUI();

      // Auto-scroll the waveform view (and scrollbar) so the playhead stays visible
      // while playing. Keep playhead around 50% of the visible area.
      // Stop scrolling the view once the end of the track is at the right edge.
      const v = getWaveView();
      if (curT > v.end + 0.0001) {
        let vis = v.visibleDur;
        let desiredStart = curT - (vis * 0.5);
        let newStart = Math.max(0, desiredStart);
        let newEnd = newStart + vis;

        if (newEnd > projectDuration) {
          newEnd = projectDuration;
          newStart = Math.max(0, newEnd - vis);
        }

        if (newStart !== waveViewStart || newEnd !== waveViewEnd) {
          waveViewStart = newStart;
          waveViewEnd = newEnd;
          applyWaveViewChange();
          // applyWaveViewChange already updates playhead/scrollthumb with current audio time
        }
      }

      _projectRafId = requestAnimationFrame(tick);
    } else {
      _projectRafId = null;
    }
  };
  _projectRafId = requestAnimationFrame(tick);
}

function stopProjectRafPlayhead() {
  if (_projectRafId) {
    cancelAnimationFrame(_projectRafId);
    _projectRafId = null;
  }
}

function startVirtualPlayhead() {
  stopProjectRafPlayhead();
  _virtualBaseTime = _virtualCurrentTime || 0;
  _virtualLastTs = Date.now();
  const tick = () => {
    if (!projectIsPlaying || projectDuration <= 0) {
      _projectRafId = null;
      return;
    }
    const now = Date.now();
    const elapsed = (now - _virtualLastTs) / 1000;
    let curT = _virtualBaseTime + elapsed;
    if (curT >= projectDuration) {
      curT = projectDuration;
      projectIsPlaying = false;
      const pb = document.getElementById('proj-play-btn');
      if (pb) pb.innerHTML = '<i class="fa-solid fa-play"></i>';
      _projectRafId = null;
      updateProjectPlayhead(curT);
      updateProjectPreview(curT);
      updateProjectTimeUI();
      return;
    }
    updateProjectPlayhead(curT);
    updateProjectPreview(curT);
    updateProjectTimeUI();
    // Auto-scroll view like audio case
    const v = getWaveView();
    if (curT > v.end + 0.0001) {
      let vis = v.visibleDur;
      let desiredStart = curT - (vis * 0.5);
      let newStart = Math.max(0, desiredStart);
      let newEnd = newStart + vis;
      if (newEnd > projectDuration) {
        newEnd = projectDuration;
        newStart = Math.max(0, newEnd - vis);
      }
      if (newStart !== waveViewStart || newEnd !== waveViewEnd) {
        waveViewStart = newStart;
        waveViewEnd = newEnd;
        applyWaveViewChange();
      }
    }
    _virtualCurrentTime = curT;
    _projectRafId = requestAnimationFrame(tick);
  };
  _projectRafId = requestAnimationFrame(tick);
}

function initLibraryVideoObserver() {
    if (libraryVideoObserver) return; // already created

    libraryVideoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting) {
                // Video is visible → load and play
                if (video.dataset.src && !video.src) {
                    video.src = video.dataset.src;
                }

                // Only autoplay if the setting allows it
                if (typeof libraryVideoPlayback !== 'undefined' && libraryVideoPlayback === 'play_loop') {
                    video.play().catch(() => {});
                }
            } else {
                // Video is out of view → pause it
                video.pause();
            }
        });
    }, {
        threshold: 0.25,           // Play when 25% of the video is visible
        rootMargin: '0px 0px -50px 0px'
    });
}

function observeLibraryVideos() {
    initLibraryVideoObserver();

    const scroller = document.querySelector('.library-scroller');
    if (!scroller || !libraryVideoObserver) return;

    const videos = scroller.querySelectorAll('video[data-src]');
    videos.forEach(video => {
        // Only observe videos that aren't already being observed
        if (!video._observedByLibrary) {
            libraryVideoObserver.observe(video);
            video._observedByLibrary = true;
        }
    });
}

function cleanupLibraryVideoObserver() {
    if (libraryVideoObserver) {
        libraryVideoObserver.disconnect();
        libraryVideoObserver = null;
    }
}

function stopVirtualPlayhead() {
  stopProjectRafPlayhead();
  // _virtualCurrentTime keeps the paused position for resume
}
function getWaveView() {
  const fullDur = projectDuration || 60;
  let start = Math.max(0, waveViewStart || 0);
  let end = waveViewEnd || fullDur;
  if (end <= start) end = start + Math.max(0.1, fullDur * 0.01);
  end = Math.min(end, fullDur);
  start = Math.max(0, Math.min(start, end - 0.01));
  return { start, end, fullDur, visibleDur: end - start };
}
function resetWaveView() {
  waveViewStart = 0;
  waveViewEnd = projectDuration || 60;
}
function timeToViewPct(t) {
  const v = getWaveView();
  if (t < v.start || t > v.end) return null;
  return ((t - v.start) / v.visibleDur) * 100;
}

function rebuildChildrenMap() {
  childrenMap.clear();
  allAssets.forEach(a => {
    const pid = a.parent_id;
    if (pid) {
      if (!childrenMap.has(pid)) {
        childrenMap.set(pid, { imageChildren: [], videoChildren: [] });
      }
      const entry = childrenMap.get(pid);
      const isVideo = a.type === 'video' || (a.filename && a.filename.endsWith('.mp4'));
      if (isVideo) {
        entry.videoChildren.push(a);
      } else {
        entry.imageChildren.push(a);
      }
    }
  });
}

function getVariationInfo(assetId) {
  const entry = childrenMap.get(assetId);
  if (!entry) {
    return { hasImages: false, hasVideos: false, imageCount: 0, videoCount: 0 };
  }
  return {
    hasImages: entry.imageChildren.length > 0,
    hasVideos: entry.videoChildren.length > 0,
    imageCount: entry.imageChildren.length,
    videoCount: entry.videoChildren.length
  };
}

/** Returns a badge container element (or null) with icons for image/video variations of this asset. */
function createVariationBadgesElement(assetId, { compact = false } = {}) {
  const info = getVariationInfo(assetId);
  if (!info.hasImages && !info.hasVideos) return null;

  const container = document.createElement('div');
  container.className = `absolute top-2 right-2 flex items-center gap-x-1 z-[5] ${compact ? 'scale-[0.8]' : ''}`;

  const badgeCls = 'bg-black/70 text-white text-[10px] px-1 py-0.5 rounded flex items-center gap-x-0.5 shadow-sm';

  if (info.hasImages) {
    const b = document.createElement('div');
    b.className = badgeCls;
    b.innerHTML = `<i class="fa-solid fa-images"></i>${info.imageCount > 1 ? `<span class="font-mono ml-0.5">${info.imageCount}</span>` : ''}`;
    container.appendChild(b);
  }
  if (info.hasVideos) {
    const b = document.createElement('div');
    b.className = badgeCls;
    b.innerHTML = `<i class="fa-solid fa-video"></i>${info.videoCount > 1 ? `<span class="font-mono ml-0.5">${info.videoCount}</span>` : ''}`;
    container.appendChild(b);
  }
  return container;
}

function addVariationBadges(card, assetId, { compact = false } = {}) {
  if (!card || !assetId) return;
  card.querySelectorAll('.var-badge').forEach(b => b.remove());
  const el = createVariationBadgesElement(assetId, { compact });
  if (el) {
    el.classList.add('var-badge');
    card.appendChild(el);
  }
}

function getAssetById(id) {
  return allAssets.find(a => a.id === id) || null;
}

function updateBadgesForAsset(assetId) {
  if (!assetId) return;
  const asset = getAssetById(assetId);
  document.querySelectorAll(`[data-asset-id="${assetId}"]`).forEach(card => {
    addVariationBadges(card, assetId);
    if (asset) {
      // Ensure delete/fav are present (some live cards from stream may be missing them)
      // remove old ones first to avoid duplicates
      card.querySelectorAll('.fa-trash, .fa-star').forEach(el => {
        const p = el.parentElement;
        if (p && p.classList.contains('absolute')) p.remove();
      });
      addFavoriteBadge(card, asset);
      addDeleteIcon(card, asset);
    }
  });
}

function createAssetCard(asset) {
  const card = document.createElement('div');
  card.dataset.assetId = asset.id || '';

  const isAudio = asset.type === 'audio' || (asset.filename && /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(asset.filename));
  const isVideo = asset.type === 'video' || (asset.filename && asset.filename.endsWith('.mp4'));

  if (isAudio) {
    const audioUrl = `/audio/${asset.filename}`;
    card.className = `aspect-square bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800 relative flex flex-col`;
    card.innerHTML = `
      <div class="flex-1 flex items-center justify-center">
        <i class="fa-solid fa-volume-up text-5xl text-emerald-400 audio-icon"></i>
      </div>
      <div class="px-2 pb-1">
        <div class="audio-time text-[9px] text-center text-zinc-400 mb-0.5">0:00 / 0:00</div>
        <input type="range" class="audio-seek w-full accent-emerald-400" style="height:4px;" min="0" max="100" value="0" />
        <div class="flex justify-center gap-x-1 mt-1">
          <button class="audio-play text-emerald-400 hover:text-white text-xs px-1"><i class="fa-solid fa-play"></i></button>
          <button class="audio-stop text-emerald-400 hover:text-white text-xs px-1"><i class="fa-solid fa-stop"></i></button>
        </div>
      </div>
    `;
    const icon = card.querySelector('.audio-icon');
    const timeEl = card.querySelector('.audio-time');
    const seekEl = card.querySelector('.audio-seek');
    const playBtn = card.querySelector('.audio-play');
    const stopBtn = card.querySelector('.audio-stop');
    const audioEl = new Audio(audioUrl);
    audioEl.preload = 'metadata';
    let isSeeking = false;
    function formatTime(seconds) {
      if (isNaN(seconds) || seconds === Infinity) return '0:00';
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }
    function updateTimeDisplay() {
      if (timeEl && audioEl) {
        timeEl.textContent = `${formatTime(audioEl.currentTime)} / ${formatTime(audioEl.duration)}`;
      }
    }
    audioEl.ondurationchange = updateTimeDisplay;
    audioEl.ontimeupdate = () => {
      if (!isSeeking && seekEl && audioEl.duration) {
        seekEl.value = (audioEl.currentTime / audioEl.duration) * 100;
      }
      updateTimeDisplay();
    };
    audioEl.onended = () => {
      if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      if (seekEl) seekEl.value = 0;
      updateTimeDisplay();
    };
    seekEl.onmousedown = () => { isSeeking = true; };
    seekEl.onmouseup = () => { isSeeking = false; };
    seekEl.oninput = () => {
      if (audioEl.duration) {
        audioEl.currentTime = (seekEl.value / 100) * audioEl.duration;
      }
    };
    playBtn.onclick = (e) => {
      e.stopImmediatePropagation();
      if (audioEl.paused) {
        audioEl.play().then(() => {
          playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }).catch(console.error);
      } else {
        audioEl.pause();
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      }
    };
    stopBtn.onclick = (e) => {
      e.stopImmediatePropagation();
      audioEl.pause();
      audioEl.currentTime = 0;
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      if (seekEl) seekEl.value = 0;
      updateTimeDisplay();
    };
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    audioEl.onplay = () => { if (icon) icon.classList.add('text-emerald-300'); };
    audioEl.onpause = () => { if (icon) icon.classList.remove('text-emerald-300'); };
  } else if (isVideo) {
    card.className = `${getAspectClass(asset.aspect_ratio || '3:2')} bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800 relative`;
    const mediaUrl = `/videos/${asset.filename}`;
    card.innerHTML = `
        <video data-src="${mediaUrl}"
                class="w-full h-full object-cover rounded-sm cursor-pointer" loading="lazy"
                muted playsinline loop></video>
        <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
            ${(asset.metadata && asset.metadata.duration) ? asset.metadata.duration + 's • ' : ''}${asset.width}×${asset.height}
        </div>
        `;
    const videoEl = card.querySelector('video');
    videoEl.onclick = (e) => {
      e.stopImmediatePropagation();
      // Use the new in-place (non-full-overlay) preview so we can reuse the main prompt bar
      // (where the rainbow effect works reliably).
      if (typeof showPreviewForAsset === 'function') {
        showPreviewForAsset(asset);
      } else {
        openVideoModal(mediaUrl, asset.filename);
      }
    };
    if (libraryVideoPlayback === '1st_frame') {
      // Ensure it shows the first frame without playing (saves CPU)
      videoEl.preload = 'metadata';
      const ensureFirstFrame = () => {
        try {
          videoEl.currentTime = 0;
          videoEl.pause();
        } catch (e) {}
      };
      videoEl.onloadedmetadata = ensureFirstFrame;
      videoEl.oncanplay = ensureFirstFrame;
      // fallback
      setTimeout(ensureFirstFrame, 100);
    }
  } else {
    card.className = `${getAspectClass(asset.aspect_ratio || '3:2')} bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800 relative`;
    const mediaUrl = `/images/${asset.filename}`;
    card.innerHTML = `
      <img src="${mediaUrl}" 
           class="w-full h-full object-cover rounded-sm cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" alt="">
      <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
        ${asset.width && asset.height ? `${asset.width}×${asset.height}` : ''}
      </div>
    `;
    const img = card.querySelector('img');
    img.onclick = () => {
      // Use the new in-place (non-full-overlay) preview so we can reuse the main prompt bar
      // (where the rainbow effect works reliably).
      if (typeof showPreviewForAsset === 'function') {
        showPreviewForAsset(asset);
      } else {
        openImageModal(mediaUrl, asset.filename, asset);
      }
    };
  }

  if (!isAudio) {
    addVariationBadges(card, asset.id);
  }
  addFavoriteBadge(card, asset);
  addDeleteIcon(card, asset);
  // If favorite star is present (at left-2), shift delete icon to its immediate right
  if (asset.favorite) {
    const trashEl = card.querySelector('.fa-trash');
    if (trashEl && trashEl.parentElement) {
      const tdiv = trashEl.parentElement;
      tdiv.classList.remove('left-2');
      tdiv.classList.add('left-6');
    }
  }
  return card;
}

function attachLibraryCardHoverPrompt(card, asset) {
    // Show the prompt as a top overlay when hovering the card (replaces the old always-visible prompt sections)
    if (!card || !asset) return;
    const promptText = (asset.prompt || '').trim();
    if (!promptText) return;

    let overlay = card.querySelector('.library-prompt-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'library-prompt-overlay absolute top-0 left-0 right-0 px-2 py-1 bg-black/70 text-white text-[10px] truncate pointer-events-none opacity-0 transition-opacity';
        overlay.style.zIndex = '4';
        card.style.position = 'relative'; // ensure containing block
        card.appendChild(overlay);
    }
    overlay.textContent = promptText;

    // Show on hover over the card (or the media inside)
    const show = () => { overlay.style.opacity = '1'; };
    const hide = () => { overlay.style.opacity = '0'; };

    card.addEventListener('mouseenter', show);
    card.addEventListener('mouseleave', hide);

    // Also react to the inner media if present
    const media = card.querySelector('img, video, .audio-icon');
    if (media) {
        media.addEventListener('mouseenter', show);
        media.addEventListener('mouseleave', hide);
    }
}

function getLibraryColumnCount() {
    // full: 5 normal, 4 min, 6 max
    // compact: 7 normal, 4 min, 10 max
    const w = window.innerWidth || 1200;
    const isCompact = libraryDensity === 'compact';
    let cols;
    if (isCompact) {
        if (w < 700) cols = 4;
        else if (w < 1100) cols = 7;
        else if (w < 1400) cols = 8;
        else cols = 10;
    } else {
        if (w < 700) cols = 4;
        else if (w < 1100) cols = 5;
        else if (w < 1400) cols = 5;
        else cols = 6;
    }
    return Math.max(4, Math.min(isCompact ? 10 : 6, cols));
}

function applyLibraryMasonryLayout() {
    const container = document.getElementById('library-masonry');
    if (!container) return;

    const scroller = container.parentElement;
    if (!scroller || !scroller.classList.contains('library-scroller')) return;

    const gap = 1;
    const containerWidth = scroller.clientWidth;
    if (containerWidth <= 0) return;

    const cols = getLibraryColumnCount();
    const colWidth = Math.max(20, (containerWidth - (cols - 1) * gap) / cols);

    const columnHeights = new Array(cols).fill(0);

    // Get card elements (direct children that are the asset cards)
    const cards = Array.from(container.children).filter(el => 
        el.tagName === 'DIV' && 
        !el.classList.contains('library-cards-top-fade') &&
        !el.classList.contains('library-cards-bottom-fade')
    );

    cards.forEach(card => {
        const height = getCardComputedHeight(card, colWidth);

        // Find the column with the smallest current height ("last y position")
        // and always place the next card under it. This eliminates gaps
        // even when cards have very different (tall vs wide) aspect ratios.
        let shortestCol = 0;
        let minHeight = columnHeights[0];
        for (let c = 1; c < cols; c++) {
            if (columnHeights[c] < minHeight) {
                minHeight = columnHeights[c];
                shortestCol = c;
            }
        }

        // Position absolutely inside the relative container
        card.style.position = 'absolute';
        card.style.left = `${shortestCol * (colWidth + gap)}px`;
        card.style.top = `${columnHeights[shortestCol]}px`;
        card.style.width = `${colWidth}px`;
        card.style.height = `${height}px`;
        card.style.margin = '0';
        card.style.boxSizing = 'border-box';
        card.style.zIndex = '1';  // below the fixed top/bottom fades (z20)

        columnHeights[shortestCol] += height + gap;
    });

    // Set container height to the tallest column so the scroller knows the real scroll size
    const maxHeight = Math.max(...columnHeights);
    container.style.height = `${maxHeight}px`;
    container.style.position = 'relative';
    container.style.zIndex = '1';  // below fixed fades
}

function getCardComputedHeight(card, colWidth) {
    if (!card) return colWidth;

    // Prefer actual loaded media dimensions if available (more accurate after load)
    const img = card.querySelector('img');
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        return colWidth * (img.naturalHeight / img.naturalWidth);
    }

    const video = card.querySelector('video');
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        return colWidth * (video.videoHeight / video.videoWidth);
    }

    // Fallback to aspect ratio from class (set at card creation time)
    const ratio = getAspectRatioFromClass(card);
    return colWidth / ratio;
}

function getAspectRatioFromClass(card) {
    if (!card) return 1.5;
    for (const cls of card.classList) {
        if (cls === 'aspect-square') return 1;
        const match = cls.match(/^aspect-\[(\d+)\/(\d+)\]$/);
        if (match) {
            return parseFloat(match[1]) / parseFloat(match[2]);
        }
    }
    return 1.5; // 3:2 default
}

function ensureRainbowBorderStyles() {
    if (document.getElementById('rainbow-generating-border')) return;
    const style = document.createElement('style');
    style.id = 'rainbow-generating-border';
    style.textContent = `
        @property --angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
        }
        @keyframes rainbow-spin {
            to { --angle: 360deg; }
        }
        .input-bar.is-generating {
            position: relative;
            border-color: transparent;
        }
        .input-bar.is-generating::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 1.5rem;
            padding: 3px;
            background: conic-gradient(
                from var(--angle),
                #ff0000, #ff7f00, #ffff00, #7fff00, #00ff00,
                #00ff7f, #00ffff, #007fff, #0000ff, #7f00ff,
                #ff00ff, #ff007f, #ff0000
            );
            -webkit-mask:
                linear-gradient(#000 0 0) content-box,
                linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
            mask:
                linear-gradient(#000 0 0) content-box,
                linear-gradient(#000 0 0);
            mask-composite: xor;
            animation: rainbow-spin 1.8s linear infinite;
            z-index: -2;
            pointer-events: none;
        }
        .input-bar.is-generating::after {
            content: '';
            position: absolute;
            inset: 1px;
            background: #1f1f1f;
            border-radius: 1.5rem;
            z-index: -1;
        }
    `;
    document.head.appendChild(style);
}

function toggleLibraryDensity() {
    libraryDensity = (libraryDensity === 'full') ? 'compact' : 'full';
    applyLibraryMasonryLayout();
    // Optional: persist via settings (lightweight)
    // saveSettings({ library_density: libraryDensity }).catch(() => {});
}

function cleanupLibraryFullHeight() {
    const main = document.getElementById('main-content');
    if (!main) return;
    main.style.marginTop = '';
    main.style.paddingTop = '';
    main.style.marginBottom = '';
    main.style.paddingBottom = '';
    main.style.position = '';
    main.style.overflow = '';
    const tf = document.getElementById('library-top-fade'); if (tf) tf.remove();
    const bf = document.getElementById('library-bottom-fade'); if (bf) bf.remove();
    const scroller = document.getElementById('generations-container');
    if (scroller) {
        scroller.style.height = '';
        scroller.style.overflow = '';
        scroller.style.paddingTop = '';
        scroller.style.paddingBottom = '';
    }
}

function setupLibraryFullHeightFades() {
    const main = document.getElementById('main-content');
    if (!main) return;

    const header = document.querySelector('.flex.items-center.justify-between.px-6.py-4.border-b.border-zinc-800');
    const promptBar = document.getElementById('bottom-prompt-bar');

    const headerH = header ? header.offsetHeight : 68;
    const promptH = promptBar ? promptBar.offsetHeight : 92;

    // Extend the main-content behind the header and prompt bar using negative margins + padding
    // This lets the cards area feel full height, with fades "behind" the bars.
    main.style.marginTop = `-${headerH}px`;
    main.style.paddingTop = `${headerH}px`;
    main.style.marginBottom = `-${promptH}px`;
    main.style.paddingBottom = `${promptH}px`;
    main.style.position = 'relative';
    main.style.overflow = 'hidden';

    const scroller = document.getElementById('generations-container');
    if (scroller) {
        scroller.style.height = '100%';
        scroller.style.overflow = 'auto';
        // The padding on main-content above reserves space so content starts visibly below the bars
        // but the top of the scroller (with fade) is behind the header.
    }

    // Top fade sized to header, will be behind the titlebar
    let topFade = document.getElementById('library-top-fade');
    if (!topFade) {
        topFade = document.createElement('div');
        topFade.id = 'library-top-fade';
        topFade.style.pointerEvents = 'none';
        topFade.style.zIndex = '5';
        main.appendChild(topFade);
    }
    topFade.style.position = 'absolute';
    topFade.style.top = '0';
    topFade.style.left = '0';
    topFade.style.right = '0';
    topFade.style.height = `${headerH}px`;
    topFade.style.background = 'linear-gradient(to bottom, rgba(9,9,11,0.95), transparent)';

    // Bottom fade sized to prompt bar, will be behind the prompt area
    let bottomFade = document.getElementById('library-bottom-fade');
    if (!bottomFade) {
        bottomFade = document.createElement('div');
        bottomFade.id = 'library-bottom-fade';
        bottomFade.style.pointerEvents = 'none';
        bottomFade.style.zIndex = '5';
        main.appendChild(bottomFade);
    }
    bottomFade.style.position = 'absolute';
    bottomFade.style.bottom = '0';
    bottomFade.style.left = '0';
    bottomFade.style.right = '0';
    bottomFade.style.height = `${promptH}px`;
    bottomFade.style.background = 'linear-gradient(to top, rgba(9,9,11,0.95), transparent)';
}

function getAspectClass(ratio) {
    const map = {
        '3:2': 'aspect-[3/2]',
        '2:3': 'aspect-[2/3]',
        '16:9': 'aspect-[16/9]',
        '9:16': 'aspect-[9/16]',
        '1:1': 'aspect-square'
    };
    return map[ratio] || 'aspect-[3/2]';
}

/**
 * Renders the flat library masonry (no prompt sections) with density selector buttons
 * at the top of the cards area, latest first, hover prompts, etc.
 */
function renderLibraryMasonry(assets, targetContainer) {
    if (!targetContainer) return;

    // Remove any legacy absolute fades from main-content so we only have the new inner ones
    cleanupLibraryFullHeight();

    // Reset the video observer (will be re-applied to videos in the new masonry)
    cleanupLibraryVideoObserver()

    // PERSISTENT SCROLLER SUPPORT (for scroll preservation):
    // If the target already contains a .library-scroller as a direct child, reuse it
    // and only clear/rebuild its inner content (density bar + masonry grid + fades).
    // This keeps the actual scrolling element in the DOM so native scrollTop (and layout
    // position) is preserved across refreshes that happen while the library view is visible.
    // Ensure the host uses flex so the scroller can reliably size to remaining space.
    targetContainer.style.display = 'flex';
    targetContainer.style.flexDirection = 'column';
    targetContainer.style.minHeight = '0';
    targetContainer.style.height = '100%';
    targetContainer.style.overflow = 'hidden';

    let scroller = targetContainer.querySelector(':scope > .library-scroller');
    if (scroller) {
        // Clear only the contents of the existing scroller (we will re-add density, grid, fades).
        scroller.innerHTML = '';
    } else {
        targetContainer.innerHTML = '';
        scroller = document.createElement('div');
        scroller.className = 'library-scroller';
        targetContainer.appendChild(scroller);
    }

    // Use flex sizing for the scroller (more reliable than height:100% in nested flex layouts).
    // This ensures the scroller gets a proper viewport height immediately when content is added,
    // so the grey scrollbar appears on cold start (not only after a preview roundtrip).
    scroller.style.flex = '1 1 0%';
    scroller.style.minHeight = '0';
    scroller.style.overflow = 'auto';
    scroller.style.paddingTop = '0';
    scroller.style.paddingBottom = '0';
    scroller.style.position = 'relative';

    // Grey scrollbar (consistent) — re-applied on every render...
    scroller.style.scrollbarWidth = 'thin';
    scroller.style.scrollbarColor = '#888 #333';

    // Keep a live "last viewed area" reference updated while the user is actively scrolling the library.
    // This makes semantic restore (used on full re-renders) always have a recent anchor.
    if (!scroller._scrollRefListener) {
        scroller._scrollRefListener = true;
        scroller.addEventListener('scroll', () => {
            try {
                const cards = scroller.querySelectorAll('#library-masonry > div[data-asset-id]');
                let best = null;
                let bestDist = Infinity;
                const viewTop = scroller.scrollTop;
                cards.forEach(c => {
                    const top = c.offsetTop || 0;
                    const dist = Math.abs(top - viewTop);
                    if (dist < bestDist) { bestDist = dist; best = c; }
                });
                if (best && best.dataset.assetId) {
                    previewReferenceAsset = {
                        assetId: best.dataset.assetId,
                        offset: viewTop - (best.offsetTop || 0)
                    };
                }
            } catch (e) { /* ignore */ }
        }, { passive: true });
    }

    // Density selector buttons at the top of the image cards area
    // Sticky so buttons stay fixed at top of the card window
    const densityBar = document.createElement('div');
    densityBar.className = 'flex gap-x-1 mb-3 mt-2 px-1';
    densityBar.style.zIndex = '15';
    densityBar.style.backgroundColor = '#09090b';
    densityBar.style.paddingTop = '30px';
    densityBar.style.paddingBottom = '2px';
    densityBar.style.marginTop = '0';  // minimal gap under titlebar
    densityBar.innerHTML = `
        <button data-density="full" class="px-3 py-1 text-xs rounded-full ${libraryDensity === 'full' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}">
            <i class="fa-solid fa-th-large mr-1"></i>Full
        </button>
        <button data-density="compact" class="px-3 py-1 text-xs rounded-full ${libraryDensity === 'compact' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}">
            <i class="fa-solid fa-th mr-1"></i>Compact
        </button>
    `;
    scroller.appendChild(densityBar);

    // Wire the buttons
    densityBar.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
            libraryDensity = btn.dataset.density;
            applyLibraryMasonryLayout();
            densityBar.querySelectorAll('button').forEach(b => {
                if (b.dataset.density === libraryDensity) {
                    b.className = 'px-3 py-1 text-xs rounded-full bg-white text-black';
                    if (b.dataset.density === 'full') b.innerHTML = '<i class="fa-solid fa-th-large mr-1"></i>Full';
                    else b.innerHTML = '<i class="fa-solid fa-th mr-1"></i>Compact';
                } else {
                    b.className = 'px-3 py-1 text-xs rounded-full bg-zinc-800 text-white hover:bg-zinc-700';
                    if (b.dataset.density === 'full') b.innerHTML = '<i class="fa-solid fa-th-large mr-1"></i>Full';
                    else b.innerHTML = '<i class="fa-solid fa-th mr-1"></i>Compact';
                }
            });
        };
    });

    // Sort latest first
    const sorted = [...(assets || [])].sort((a, b) => {
        const ta = a.created ? Date.parse(a.created) : 0;
        const tb = b.created ? Date.parse(b.created) : 0;
        return tb - ta;
    });

    // Container for absolute-positioned masonry cards.
    // We use explicit positioning (tracking per-column Y) instead of CSS grid/columns
    // so we can always place the next card in the shortest column → no gaps even with mixed aspect ratios.
    const grid = document.createElement('div');
    grid.id = 'library-masonry';
    grid.className = 'library-masonry';
    grid.style.position = 'relative';
    grid.style.backgroundColor = '#000';  // black so the 1px gaps between positioned cards are black
    scroller.appendChild(grid);

    sorted.forEach(asset => {
        const card = createAssetCard(asset);
        // Basic size; layout pass will compute exact top/left/width/height using column Y tracking
        card.style.width = '100%';
        card.style.margin = '0';
        card.style.boxSizing = 'border-box';
        attachLibraryCardHoverPrompt(card, asset);
        grid.appendChild(card);
    });

    // Position every card using "shortest column so far" algorithm.
    // This guarantees we never leave vertical gaps in any column.
    applyLibraryMasonryLayout();

    // Fixed fades at the top and bottom of the card window (the scroller viewport).
    // These stay fixed; the grid (cards) scrolls underneath them.
    // Remove any existing fade elements first
    document.querySelectorAll('.library-fade').forEach(el => el.remove());

    // Find the correct parent container
    const container = document.getElementById('generations-container') || 
                    document.querySelector('.library-scroller')?.parentElement;

    if (!container) {
        console.warn('Could not find generations-container for fade overlays');
        return;
    }

    // Make sure the container can hold absolute positioned children
    container.style.position = 'relative';

    // Create top fade
    const fadeTop = document.createElement('div');
    fadeTop.className = 'library-fade library-fade-top';
    container.appendChild(fadeTop);

    // Create bottom fade
    const fadeBottom = document.createElement('div');
    fadeBottom.className = 'library-fade library-fade-bottom';
    container.appendChild(fadeBottom);

    // Make sure grid layout is applied (in case)
    applyLibraryMasonryLayout();

    // Post-render double-rAF re-apply: guarantees that even if the synchronous applies above
    // ran before the flex parent chain had assigned a size to the scroller, we get a follow-up
    // measurement after layout. This is what makes the "scroll" devtools tag attach to
    // .library-scroller (with the grey scrollbar styles) on cold startup instead of only
    // after a preview roundtrip forces a reflow.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (typeof applyLibraryMasonryLayout === 'function') {
                applyLibraryMasonryLayout();
            }
        });
    });

    // Ensure the fades are sized and positioned correctly
    ensureLibraryFades();

    // Finally, observe videos for play/pause
    observeLibraryVideos()
}

function ensureLibraryFades() {
    const container = document.getElementById('generations-container');
    if (!container) return;

    // Remove old fades if they exist
    container.querySelectorAll('.library-fade').forEach(el => el.remove());

    // Top fade
    const fadeTop = document.createElement('div');
    fadeTop.className = 'library-fade library-fade-top';
    Object.assign(fadeTop.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        height: '60px',
        background: 'linear-gradient(to bottom, #09090b, transparent)',
        pointerEvents: 'none',
        zIndex: '30'
    });
    container.appendChild(fadeTop);

    // Bottom fade
    const fadeBottom = document.createElement('div');
    fadeBottom.className = 'library-fade library-fade-bottom';
    Object.assign(fadeBottom.style, {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: '60px',
        background: 'linear-gradient(to top, #09090b, transparent)',
        pointerEvents: 'none',
        zIndex: '30'
    });
    container.appendChild(fadeBottom);

    container.style.position = 'relative';
}

// ==================== PERSISTENCE ====================
async function loadHistory() {
    try {
        const res = await fetch('/history');
        const assets = await res.json();   // Now a flat list of assets

        allAssets = assets || [];
        rebuildChildrenMap();

        if (assets.length > 0) {
            document.getElementById('placeholder').style.display = 'none';
            hasGenerated = true;
        }

        const container = document.getElementById('generations-container');
        if (container) {
            renderLibraryMasonry(assets || [], container);
        }

        // Cold-start nudge using double rAF: this waits for the browser to have assigned
        // the flex sizes to the .library-scroller (from the outer column + main-content + genContainer).
        // The synchronous apply inside renderLibraryMasonry may run before layout, causing
        // clientWidth/Height to be 0 (bail) or wrong masonry height → no scrollbar on cold start.
        // Double rAF + re-apply makes the scroll tag attach to .library-scroller with grey
        // styles immediately on startup (matching the post-preview state).
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const s = document.querySelector('.library-scroller');
                if (s && typeof applyLibraryMasonryLayout === 'function') {
                    applyLibraryMasonryLayout();
                }
            });
        });

    } catch (e) {
        console.error("Failed to load history", e);
    }
}

function renderAssetsInGrid(grid, assets) {
    assets.forEach(asset => {
        const card = createAssetCard(asset);
        if (grid && grid.id === 'library-masonry') {
            card.style.width = '100%';
            card.style.margin = '0';
            card.style.boxSizing = 'border-box';
            attachLibraryCardHoverPrompt(card, asset);
        }
        grid.appendChild(card);
    });
}

/**
 * Create a card for the Related sidebar inside an image modal.
 * Similar structure to main grid cards but sized for the w-80 sidebar (2-col compact grid).
 */
function createRelatedAssetCard(asset) {
    const card = document.createElement('div');
    card.className = `${getAspectClass(asset.aspect_ratio || '3:2')} bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 relative cursor-pointer`;

    const isAudio = asset.type === 'audio' || (asset.filename && /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(asset.filename));
    const isVideo = asset.type === 'video' || (asset.filename && asset.filename.endsWith('.mp4'));

    if (isAudio) {
        const audioUrl = `/audio/${asset.filename}`;
        card.className = `aspect-square bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 relative cursor-pointer`;
        card.innerHTML = `
            <div class="w-full h-full flex items-center justify-center bg-zinc-800">
                <i class="fa-solid fa-volume-up text-4xl text-emerald-400"></i>
            </div>
            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded">
                Audio
            </div>
        `;
        card.onclick = () => {
            const audio = new Audio(audioUrl);
            audio.play().catch(console.error);
        };
    } else if (isVideo) {
        const thumbUrl = `/videos/${asset.filename}`;
        const playAttrs = (libraryVideoPlayback === 'play_loop')
          ? 'autoplay loop muted playsinline'
          : 'muted playsinline';
        card.innerHTML = `
            <video src="${thumbUrl}" 
                   class="w-full h-full object-cover" 
                   ${playAttrs}>
            </video>
            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded" style="pointer-events:none">
                ${(asset.metadata && asset.metadata.duration) ? asset.metadata.duration + 's • ' : ''}${asset.width}×${asset.height}
            </div>
        `;
        const videoEl = card.querySelector('video');
        videoEl.onclick = (e) => {
            e.stopImmediatePropagation();
            if (currentPreviewAsset) {
                // In in-place preview, update the current preview instead of opening old modal
                showPreviewForAsset(asset);
            } else {
                closeImageModal(false);
                openVideoModal(thumbUrl, asset.filename);
            }
        };
        if (libraryVideoPlayback === '1st_frame') {
            videoEl.preload = 'metadata';
            const ensureFirstFrame = () => {
                try {
                    videoEl.currentTime = 0;
                    videoEl.pause();
                } catch (e) {}
            };
            videoEl.onloadedmetadata = ensureFirstFrame;
            videoEl.oncanplay = ensureFirstFrame;
            setTimeout(ensureFirstFrame, 100);
        }
    } else {
        const thumbUrl = `/images/${asset.filename}`;
        card.innerHTML = `
            <img src="${thumbUrl}" 
                 class="w-full h-full object-cover hover:opacity-90 transition-opacity" alt="">
            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded" style="pointer-events:none">
                ${asset.width}×${asset.height}
            </div>
        `;
        const img = card.querySelector('img');
        // Attach to card for reliable hit area (img may be partially covered by absolute label)
        card.onclick = (e) => {
            // Ignore clicks on badges/icons (they have their own handlers + stop)
            if (e.target.closest('.fa-trash, .fa-star, .var-badge')) return;
            if (currentPreviewAsset) {
                // In in-place preview, update the current preview instead of opening old modal
                showPreviewForAsset(asset);
            } else {
                closeImageModal(false);
                openImageModal(thumbUrl, asset.filename, asset);
            }
        };
        // Let clicks on the image itself also work (in case card handler is shadowed)
        if (img) {
            img.onclick = (e) => {
                e.stopImmediatePropagation();
                if (currentPreviewAsset) {
                    showPreviewForAsset(asset);
                } else {
                    closeImageModal(false);
                    openImageModal(thumbUrl, asset.filename, asset);
                }
            };
        }
    }

    card.dataset.assetId = asset.id || '';
    if (!isAudio) {
        addVariationBadges(card, asset.id, { compact: true });
    }
    addFavoriteBadge(card, asset);
    addDeleteIcon(card, asset);
    // shift delete right of star if favorite (for related cards too)
    if (asset.favorite) {
        const trashEl = card.querySelector('.fa-trash');
        if (trashEl && trashEl.parentElement) {
            const tdiv = trashEl.parentElement;
            tdiv.classList.remove('left-2');
            tdiv.classList.add('left-6');
        }
    }

    return card;
}

/**
 * Create a small generating placeholder card for use inside the modal's Related section.
 * Styled similarly to related cards but with generating animation and progress.
 */
function createModalGeneratingCard(aspectRatio = null) {
    const ar = aspectRatio || currentAspectRatio;
    const card = document.createElement('div');
    card.className = `${getAspectClass(ar)} bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 relative`;

    card.innerHTML = `
        <div class="absolute inset-0 bg-[radial-gradient(#444_1px,transparent_1px)] bg-[length:4px_4px] opacity-40"></div>
        <div class="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
            <div class="text-center p-1">
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                <div class="text-[10px] text-zinc-400">Generating...</div>
                <div class="progress-text text-[10px] font-mono text-emerald-400 mt-0.5">0%</div>
            </div>
        </div>
    `;
    return card;
}

/**
 * Update a modal generating card (in Related sidebar) with progress or final media.
 * Mirrors the main handleStreamEventInGrid but for the compact related style.
 */
function updateModalGeneratingCard(card, event) {
    if (!card) return;

    if (event.type === 'progress') {
        const progressEl = card.querySelector('.progress-text');
        if (progressEl) progressEl.textContent = `${event.percent}%`;
    }

    if (event.type === 'image_ready') {
        const imageUrl = `/images/${event.local_filename}`;
        card.innerHTML = `
            <img src="${imageUrl}" 
                 class="w-full h-full object-cover" alt="">
            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded">
                ${event.width}×${event.height}
            </div>
        `;
        const img = card.querySelector('img');
        if (img) {
            img.onclick = () => {
                if (currentPreviewAsset) {
                    // In in-place preview, update the current preview instead of opening old modal
                    showPreviewForAsset(event.local_filename);
                } else {
                    closeImageModal(false);
                    openImageModal(imageUrl, event.local_filename);
                }
            };
        }
    }

    if (event.type === 'video_ready') {
        const videoUrl = `/videos/${event.local_filename}`;
        card.innerHTML = `
            <video src="${videoUrl}" 
                   class="w-full h-full object-cover" 
                   autoplay 
                   loop 
                   muted 
                   playsinline>
            </video>
            <div class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded">
                ${event.duration ? event.duration + 's • ' : ''}${event.width}×${event.height}
            </div>
        `;
        const videoEl = card.querySelector('video');
        if (videoEl) {
            videoEl.onclick = (e) => {
                e.stopImmediatePropagation();
                if (currentPreviewAsset) {
                    // In in-place preview, update the current preview instead of opening old modal
                    showPreviewForAsset(event.local_filename);
                } else {
                    closeImageModal(false);
                    openVideoModal(videoUrl, event.local_filename);
                }
            };
        }
    }

    if (event.type === 'error') {
        card.innerHTML = `<div class="flex items-center justify-center h-full text-red-400 text-[10px]">Failed to generate</div>`;
        const clearSec = (typeof window._failed_gen_clear_seconds === 'number' && window._failed_gen_clear_seconds > 0 ? window._failed_gen_clear_seconds : 600);
        setTimeout(() => {
            if (card && card.parentNode) {
                card.parentNode.removeChild(card);
                if (typeof applyLibraryMasonryLayout === 'function') applyLibraryMasonryLayout();
            }
        }, clearSec * 1000);
    }
}

function renderExistingImages(grid, assets) {
    assets.forEach(asset => {
        const card = createAssetCard(asset);
        grid.appendChild(card);
    });
}

async function saveGenerationToServer(assetData) {
    const response = await fetch('/save-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetData)
    });
    return response.json();
}

// ==================== GENERATION ====================
async function sendPrompt(inputId = 'prompt-input') {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Chat view uses the same input/send UI but a different flow
    if (currentView === 'chat') {
        return handleChatSend();
    }

    const prompt = input.value.trim();

    // Allow blank prompt submits when in preview context with a parent (e.g. "Create Video from this"
    // with no motion text, or pure variations). The parent/source + workflow will still produce a
    // linked child. Normal library gens require a non-empty prompt.
    const _isDetailOrModalEarly = inputId === 'modal-prompt-input' || inputId === 'detail-prompt-input';
    const _isPreviewContextEarly = _isDetailOrModalEarly ||
                                   (currentView === 'library' && currentPreviewAsset && currentModalParentId);
    if (!prompt && !(_isPreviewContextEarly && currentModalParentId)) {
        return;
    }

    // Capture settings at the start
    lastPrompt = prompt;
    lastResolution = currentResolution;
    lastAspectRatio = currentAspectRatio;
    lastDuration = currentDuration;

    removeGenerateMoreButton();

    if (!hasGenerated) {
        document.getElementById('placeholder').style.display = 'none';
        hasGenerated = true;
    }

    // Compute preview context early. When an in-place preview is active we must NOT create
    // prompt-labeled sections or main-area cards below the preview (those belong to the flat
    // library masonry or old per-prompt sections). Child generations from preview only appear
    // as compact cards in the preview's Related sidebar (via the parented modalGeneratingCard
    // + post-save loadRelatedAssets).
    const isDetailOrModal = inputId === 'modal-prompt-input' || inputId === 'detail-prompt-input';
    const isPreviewContext = isDetailOrModal ||
                             (currentView === 'library' && currentPreviewAsset && currentModalParentId);

    if (prompt !== lastLabeledPrompt && !isPreviewContext) {
        const masonry = document.getElementById('library-masonry');
        if (currentView === 'library' && masonry) {
            currentImageGrid = masonry;
        } else {
            const section = createPromptSection(prompt);
            currentImageGrid = section.imageGrid;
        }
        lastLabeledPrompt = prompt;
    } else if (isPreviewContext) {
        // Leave currentImageGrid and lastLabeledPrompt alone (they reflect the library state
        // the user will return to after Back). We will pass null targetGrid below.
    }

    // Only pass duration if we're in video mode
    const durationToSend = currentMode === 'video' ? lastDuration : null;

    // If sending from the (old) modal prompt bar, or from the main prompt bar while an in-place
    // preview/detail is active (currentPreviewAsset + currentModalParentId set by showPreviewForAsset),
    // generate only 1 item and link it via parent_id (supports image-to-video when bar is in video mode).
    let parentIdToUse = null;
    let countToUse = null;
    let sourceImageToUse = null;
    let modifierImageToUse = null;
    let modifierAudioToUse = null;
    if (isPreviewContext && currentModalParentId) {
        parentIdToUse = currentModalParentId;
        countToUse = 1;
        // Support submitting the prompt bar from a preview (or old modal):
        // - Video mode + source -> image-to-video
        // - Image mode + source -> image-to-image (adjustment prompt using flux i2i)
        if (currentModalSourceFilename) {
            sourceImageToUse = currentModalSourceFilename;
        }
        if (currentModalModifier) {
            if (currentModalModifier.type === 'image') {
                modifierImageToUse = currentModalModifier.filename;
            } else {
                modifierAudioToUse = currentModalModifier.filename;
            }
        }
    }

    const loraToUse = (inputId !== 'modal-prompt-input' && inputId !== 'detail-prompt-input' && currentImageModel === 'schnell' && currentLora) ? currentLora : null;

    // For preview context we intentionally pass null as targetGrid so perform does not create
    // any visible prompt section or main cards "below" the preview pane. The generation UI
    // feedback lives only in the sidebar Related area.
    const targetGridForGen = isPreviewContext ? null : currentImageGrid;

    // Pass the captured values
    await performBatchGeneration(prompt, lastResolution, lastAspectRatio, targetGridForGen, durationToSend, parentIdToUse, countToUse, sourceImageToUse, modifierImageToUse, modifierAudioToUse, loraToUse);
}

async function generateMore() {
    if (!lastPrompt || !currentImageGrid) return;

    removeGenerateMoreButton();

    // Capture current UI settings
    const resolution = currentResolution;
    const aspectRatio = currentAspectRatio;

    // Only pass duration if we're currently in Video mode
    const durationToSend = currentMode === 'video' ? currentDuration : null;

    lastDuration = durationToSend || lastDuration;

    const loraToUse = (currentImageModel === 'schnell' && currentLora) ? currentLora : null;
    await performBatchGeneration(
        lastPrompt, 
        resolution, 
        aspectRatio, 
        currentImageGrid, 
        durationToSend,
        null, // parentIdToUse
        null, // countToUse / genCount
        null, // sourceImageToUse
        null, // modifierImageToUse
        null, // modifierAudioToUse
        loraToUse
    );
}

function createPromptSection(promptText) {
    const container = document.getElementById('generations-container');
    const section = document.createElement('div');
    section.className = 'mt-2 first:mt-0';

    section.innerHTML = `
        <div class="prompt-label bg-zinc-900 border border-zinc-800 rounded-3xl px-5 py-3 mb-4 text-sm text-zinc-200 flex items-center gap-x-3">
            <i class="fa-solid fa-comment-dots text-emerald-400"></i>
            <span class="font-medium">${promptText}</span>
            <div class="ml-auto text-red-400 hover:text-red-500 cursor-pointer p-1" title="Delete entire section">
                <i class="fa-solid fa-trash"></i>
            </div>
        </div>
        <div class="image-grid grid grid-cols-2 md:grid-cols-4 gap-4"></div>
    `;
    container.appendChild(section);
    // wire the section-level delete (right side of header)
    const label = section.querySelector('.prompt-label');
    if (label) {
        const trash = label.querySelector('.fa-trash');
        if (trash) {
            const trashWrapper = trash.parentElement;
            trashWrapper.onclick = (e) => {
                e.stopImmediatePropagation();
                if (confirm(`Delete ALL assets in the section "${promptText}"? This cannot be undone.`)) {
                    deleteSection(promptText, section);
                }
            };
        }
    }
    return { section, imageGrid: section.querySelector('.image-grid') };
}

async function performBatchGeneration(prompt, resolution, aspectRatio, targetGrid, duration = null, parentId = null, genCount = null, sourceImage = null, modifierImage = null, modifierAudio = null, loraName = null) {
    const isPreviewParentedGen = !!(parentId && currentPreviewAsset);

    if (!targetGrid && !isPreviewParentedGen) {
        // In the redesigned flat library view, append new generations without creating prompt sections
        const masonry = document.getElementById('library-masonry');
        if (currentView === 'library' && masonry) {
            targetGrid = masonry;
        } else {
            const section = createPromptSection(prompt);
            targetGrid = section.imageGrid;
        }
        currentImageGrid = targetGrid;
        lastLabeledPrompt = prompt;
    }

    if (isPreviewParentedGen) {
        // Preview context (in-place detail): never create main prompt sections or visible
        // batch cards under the preview media. Only the compact sidebar generating card
        // (created below) + later loadRelatedAssets refresh are wanted.
        targetGrid = null;
    }

    // Start rainbow effect on prompt bar(s) *immediately* on submit.
    // This applies to library, detail/preview modals (the prompt bar inside image/video details),
    // and covers the enhancer Ollama delay + the main generation.
    // The class is removed in the finally block once the image/video has fully generated.
    ensureRainbowBorderStyles();
    document.querySelectorAll('.input-bar').forEach(b => b.classList.add('is-generating'));

    // === Prompt Enhancer (library + detail views only) ===
    // If user picked a style enhancer and Ollama is available, ask Ollama to rewrite the prompt
    // using the enhancer text. We do NOT change the visible input value.
    let genPrompt = prompt;
    const ollamaOk = (typeof window.isOllamaConnected === 'boolean') ? window.isOllamaConnected : true;
    if (currentEnhancer && currentEnhancer !== 'none' && ollamaOk) {
        const enh = getEnhancerById(currentEnhancer);
        if (enh && enh.prompt && enh.prompt.trim()) {
            try {
                const er = await fetch('/ollama/enhance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: prompt, enhancer: enh.prompt })
                });
                if (er.ok) {
                    const ed = await er.json();
                    if (ed && ed.enhanced && ed.enhanced.trim().length > 4) {
                        genPrompt = ed.enhanced.trim();
                        console.log('[Enhancer] Using enhanced prompt for this generation (enhancer:', currentEnhancer, ')');
                    }
                }
            } catch (ee) {
                console.warn('[Enhancer] call failed, falling back to original prompt', ee);
            }
        }
    }

    const count = (genCount != null) ? genCount : (duration ? 1 : 4);
    const batchPlaceholders = createPlaceholderCardsInGrid(targetGrid, count, aspectRatio, prompt);

    if (currentView === 'library' && targetGrid && targetGrid.id === 'library-masonry') {
        applyLibraryMasonryLayout();
    }

    // Use the returned placeholders (prepended for masonry so they are at start/upper-left).
    // This ensures "newest first" positioning and correct index mapping for stream events.
    const batchCards = batchPlaceholders;

    // If this is a parented generation (has parentId), create a compact generating card
    // in the Related section (works for both old modal and the new in-place preview,
    // since both have a #related-content div in the visible sidebar).
    let modalGeneratingCard = null;
    if (parentId) {
        const relatedContainer = document.getElementById('related-content');
        if (relatedContainer) {
            // Clear any "Loading..." or "No related..." text
            if (relatedContainer.textContent.includes('Loading') ||
                relatedContainer.textContent.includes('No related') ||
                relatedContainer.textContent.includes('related assets yet')) {
                relatedContainer.innerHTML = '';
            }

            // Make sure we have a grid to append into (for consistency with loadRelatedAssets)
            let grid = relatedContainer.querySelector('.grid');
            if (!grid) {
                grid = document.createElement('div');
                grid.className = 'grid grid-cols-1 gap-2';
                relatedContainer.appendChild(grid);
            }

            modalGeneratingCard = createModalGeneratingCard(aspectRatio);
            // Insert at the top so user sees the generating card immediately without scrolling
            grid.insertBefore(modalGeneratingCard, grid.firstChild);
        }
    }

    const generatedFilenames = new Set();
    let lastWidth = 0;
    let lastHeight = 0;

    try {
        const body = {
            prompt: genPrompt,
            resolution: resolution,
            aspect_ratio: aspectRatio,
            mode: duration ? 'video' : 'image',
            image_model: currentImageModel,
            i2i_model: currentI2IModel,
            qwen_turbo: qwenTurbo
        };

        if (duration) body.duration = duration;
        if (genCount != null) body.count = genCount;
        if (sourceImage) body.source_image = sourceImage;
        if (modifierImage) body.modifier_image = modifierImage;
        if (modifierAudio) body.modifier_audio = modifierAudio;
        if (loraName) body.lora_name = loraName;

        const response = await fetch('/generate/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || ''; // keep any partial last line

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    let eventData;
                    try {
                        eventData = JSON.parse(line.substring(6));
                    } catch (e) {
                        continue;
                    }

                    if (eventData.type === 'image_ready') {
                        generatedFilenames.add(eventData.local_filename);
                        let w = eventData.width || 0;
                        let h = eventData.height || 0;
                        // For new images created from modal prompt bar (i2i mod of the opened image),
                        // copy w/h from the parent/source so the new record in json has correct dims.
                        // Prefer lookup by parentId (reliable), fallback to source filename.
                        let copied = false;
                        if (parentId) {
                            const parentAsset = allAssets.find(a => a.id === parentId);
                            if (parentAsset && parentAsset.width && parentAsset.height) {
                                w = parentAsset.width;
                                h = parentAsset.height;
                                copied = true;
                            }
                        }
                        if (!copied && sourceImage) {
                            const sourceAsset = allAssets.find(a => a.filename === sourceImage);
                            if (sourceAsset && sourceAsset.width && sourceAsset.height) {
                                w = sourceAsset.width;
                                h = sourceAsset.height;
                            }
                        }
                        lastWidth = w;
                        lastHeight = h;
                        // Patch so handleStreamEventInGrid + modal card update use the (copied) dims for the size badge immediately
                        eventData.width = w;
                        eventData.height = h;
                    }

                    if (eventData.type === 'video_ready') {
                        generatedFilenames.add(eventData.local_filename);
                        lastWidth = eventData.width;
                        lastHeight = eventData.height;
                    }

                    // Pass the captured cards for this batch
                    handleStreamEventInGrid(eventData, targetGrid, batchCards);

                    // Also update the modal generating card (if we created one for this parented generation)
                    if (modalGeneratingCard) {
                        updateModalGeneratingCard(modalGeneratingCard, eventData);
                    }
                }
            }
        }
        // Flush any trailing complete line in buffer
        if (sseBuffer.startsWith('data: ')) {
            try {
                const eventData = JSON.parse(sseBuffer.substring(6));
                if (eventData.type === 'image_ready') {
                    generatedFilenames.add(eventData.local_filename);
                }
                if (eventData.type === 'video_ready') {
                    generatedFilenames.add(eventData.local_filename);
                }
                handleStreamEventInGrid(eventData, targetGrid, batchCards);
                if (modalGeneratingCard) {
                    updateModalGeneratingCard(modalGeneratingCard, eventData);
                }
            } catch (e) {}
        }

        // === SAVE TO HISTORY (only for images) ===
        console.log('[SAVE] generatedFilenames.size:', generatedFilenames.size, 'duration:', duration);

        // After the streaming loop finishes
        if (generatedFilenames.size > 0) {
            const fileType = duration ? "video" : "image";

            // When creating a new image from the modal dialog (prompt bar i2i, variations, etc.),
            // it modifies the existing/parent image. Copy the width/height from the parent
            // (or source) to the new image's json record on save. This is the key place
            // to ensure the saved JSON for the child has the correct dims.
            let saveW = lastWidth;
            let saveH = lastHeight;
            if (fileType === 'image' && (parentId || sourceImage)) {
                let copied = false;
                if (parentId) {
                    const parentAsset = allAssets.find(a => a.id === parentId);
                    if (parentAsset && parentAsset.width && parentAsset.height) {
                        saveW = parentAsset.width;
                        saveH = parentAsset.height;
                        copied = true;
                    }
                }
                if (!copied && sourceImage) {
                    const sourceAsset = allAssets.find(a => a.filename === sourceImage);
                    if (sourceAsset && sourceAsset.width && sourceAsset.height) {
                        saveW = sourceAsset.width;
                        saveH = sourceAsset.height;
                    }
                }
            }

            for (const filename of generatedFilenames) {
                try {
                    const saveRes = await saveGenerationToServer({
                        prompt: genPrompt || lastPrompt,
                        filename: filename,
                        type: fileType,
                        aspect_ratio: lastAspectRatio,
                        width: saveW,
                        height: saveH,
                        duration: duration,
                        parent_id: parentId,
                        derived_from: parentId ? [parentId] : []
                    });
                    console.log(`[SAVE] ✅ Saved ${fileType}: ${filename}`);

                    // Optimistically add to global state so badges and future modals know about it immediately
                    const newAsset = {
                        id: saveRes.id,
                        type: fileType,
                        prompt: genPrompt || lastPrompt,
                        filename: filename,
                        width: saveW,
                        height: saveH,
                        aspect_ratio: lastAspectRatio,
                        parent_id: parentId,
                        derived_from: parentId ? [parentId] : [],
                        metadata: duration ? { duration: duration } : {},
                        favorite: false,
                        created: new Date().toISOString()
                    };
                    if (!allAssets.some(a => a.id === newAsset.id)) {
                        allAssets.push(newAsset);
                    }
                    if (parentId && currentPreviewAsset) {
                        hadPreviewGenerations = true;
                    }
                    rebuildChildrenMap();

                    // Tag any live-rendered card that was waiting for this filename (so it gets data-asset-id)
                    document.querySelectorAll(`[data-filename="${filename}"]`).forEach(c => {
                        if (!c.dataset.assetId) {
                            c.dataset.assetId = newAsset.id;
                        }
                        // Upgrade click handlers to pass the full asset object (for modal parent_id + prefill + badges)
                        // Always prefer the new in-place preview for library cards.
                        const imgEl = c.querySelector('img');
                        if (imgEl) {
                            const imgUrl = `/images/${filename}`;
                            imgEl.onclick = () => {
                                if (typeof showPreviewForAsset === 'function') {
                                    showPreviewForAsset(newAsset || filename);
                                } else {
                                    openImageModal(imgUrl, filename, newAsset);
                                }
                            };
                        }
                        const vidEl = c.querySelector('video');
                        if (vidEl) {
                            const vidUrl = `/videos/${filename}`;
                            vidEl.onclick = (e) => {
                                e.stopImmediatePropagation();
                                if (typeof showPreviewForAsset === 'function') {
                                    showPreviewForAsset(newAsset || filename);
                                } else {
                                    openVideoModal(vidUrl, filename);
                                }
                            };
                        }

                        // Add the missing UI elements (trash can, favorite) that createAssetCard normally adds.
                        // The stream path only does basic innerHTML + hover prompt, so enrich here with the saved asset.
                        addFavoriteBadge(c, newAsset);
                        addDeleteIcon(c, newAsset);
                        addVariationBadges(c, newAsset.id);
                    });

                    // Update badges on this asset's card (if rendered) and on its parent if any
                    updateBadgesForAsset(newAsset.id);
                    if (parentId) {
                        updateBadgesForAsset(parentId);
                    }
                } catch (err) {
                    console.error("[SAVE] Failed to save generation:", err);
                }
            }

            // If generated as children (e.g. from image modal prompt bar or variations),
            // refresh the Related area in the open modal so the new card(s) appear immediately.
            if (parentId) {
                const relatedDiv = document.getElementById('related-content');
                if (relatedDiv) {
                    loadRelatedAssets(parentId, relatedDiv);
                }
            }
        }

        // For library view, scroll to top so the newly prepended cards (upper-left) are visible.
        // New generations are inserted at the start of the masonry and laid out via shortest-col.
        // Skip entirely for preview-parented gens (their UI feedback is only the sidebar related card).
        if (currentView === 'library' && !isPreviewParentedGen) {
            const scroller = document.querySelector('.library-scroller');
            if (scroller) {
                setTimeout(() => {
                    scroller.scrollTop = 0;
                }, 100);
            }
        }

        if (!isPreviewParentedGen) {
            showGenerateMoreButton();
        }

    } catch (error) {
        console.error('[PERFORM] Stream error:', error);
        if (!isPreviewParentedGen) {
            showGenerateMoreButton();
        }
    } finally {
        // Remove rainbow border when generation completes or errors (any context)
        document.querySelectorAll('.input-bar').forEach(b => b.classList.remove('is-generating'));
    }
}

function createPlaceholderCardsInGrid(grid, count, aspectRatio = null, promptText = null) {
    if (!grid) return [];
    const ar = aspectRatio || currentAspectRatio;
    const created = [];

    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.className = `${getAspectClass(ar)} bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative generating-placeholder`;

        card.innerHTML = `
            <div class="absolute inset-0 bg-[radial-gradient(#444_1px,transparent_1px)] bg-[length:4px_4px] opacity-40"></div>
            <div class="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                <div class="text-center">
                    <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <div class="text-xs text-zinc-400">Generating...</div>
                    <div class="progress-text text-sm font-mono text-emerald-400 mt-1">0%</div>
                </div>
            </div>
        `;

        if (promptText) card.dataset.prompt = promptText;

        if (grid && grid.id === 'library-masonry') {
            // Collect for prepending so new gens appear at start (upper-left). DOM order [0,1,..] for batch indices.
            created.push(card);
        } else {
            grid.appendChild(card);
            created.push(card);
        }
    }

    if (grid && grid.id === 'library-masonry' && created.length > 0) {
        // Prepend the batch at the front of the masonry grid (newest upper-left).
        // Reverse-insert ensures created[0] ends up as firstChild, created[1] next, etc.
        for (let i = created.length - 1; i >= 0; i--) {
            grid.insertBefore(created[i], grid.firstChild);
        }
        // Apply masonry card styles to the new placeholders
        created.forEach(card => {
            card.style.width = '100%';
            card.style.margin = '0';
            card.style.boxSizing = 'border-box';
            card.classList.remove('rounded-2xl');
            card.classList.add('rounded-sm');
        });
    }

    return created;
}

function handleStreamEventInGrid(event, targetGrid, batchCards = null) {
    let card;

    // Robust card selection: prefer batchCards (used for library prepend + accurate order).
    // Default index to 0 for video (count=1) or when event.index is missing/ invalid.
    // This fixes progress % not updating and final card not refreshing for library videos.
    if (batchCards && batchCards.length > 0) {
        let idx = event.index;
        if (typeof idx !== 'number' || idx < 0 || idx >= batchCards.length) {
            idx = (batchCards.length === 1 || event.type === 'video_ready' || event.type === 'start') ? 0 : (batchCards.length - 1);
        }
        card = batchCards[idx];
    } else if (targetGrid) {
        // Fallback (old append logic)
        const allCards = targetGrid.children;
        const batchSize = event.type === 'video_ready' || event.type === 'start' ? 1 : 4;
        const startIndex = Math.max(0, allCards.length - batchSize);
        let idx = (typeof event.index === 'number' && !isNaN(event.index)) ? event.index : 0;
        card = allCards[startIndex + idx];
    }

    if (!card) return;

    if (event.type === 'progress') {
        const progressEl = card.querySelector('.progress-text');
        if (progressEl) progressEl.textContent = `${event.percent}%`;
    }

    if (event.type === 'image_ready') {
        const imageUrl = `/images/${event.local_filename}`;
        card.innerHTML = `
            <img src="${imageUrl}" 
                 class="w-full h-full object-cover rounded-sm cursor-pointer hover:opacity-90 transition-opacity" alt="">
            <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                ${event.width}×${event.height}
            </div>
        `;
        const img = card.querySelector('img');
        img.onclick = () => {
            if (typeof showPreviewForAsset === 'function') {
                showPreviewForAsset(event.local_filename);
            } else {
                openImageModal(imageUrl, event.local_filename);
            }
        };
        card.dataset.filename = event.local_filename;

        if (targetGrid && targetGrid.id === 'library-masonry') {
            const p = card.dataset.prompt || lastLabeledPrompt || '';
            attachLibraryCardHoverPrompt(card, { prompt: p });
            applyLibraryMasonryLayout();
            // Re-apply layout once the image has its real natural size (shuffles as needed for accurate packing)
            const imgEl = card.querySelector('img');
            if (imgEl) {
                if (imgEl.complete && imgEl.naturalWidth > 0) {
                    applyLibraryMasonryLayout();
                } else {
                    imgEl.addEventListener('load', () => applyLibraryMasonryLayout(), { once: true });
                }
            }
        }
    }

    if (event.type === 'video_ready') {
    const videoUrl = `/videos/${event.local_filename}`;
    card.innerHTML = `
        <video src="${videoUrl}" 
               class="w-full h-full object-cover rounded-sm cursor-pointer" 
               autoplay 
               loop 
               muted 
               playsinline>
        </video>
        <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
            ${event.duration}s • ${event.width}×${event.height}
        </div>
    `;

    const videoEl = card.querySelector('video');
    videoEl.onclick = (e) => {
        e.stopImmediatePropagation();
        if (typeof showPreviewForAsset === 'function') {
            showPreviewForAsset(event.local_filename);
        } else {
            openVideoModal(videoUrl, event.local_filename);
        }
    };
    card.dataset.filename = event.local_filename;

        if (targetGrid && targetGrid.id === 'library-masonry') {
            const p = card.dataset.prompt || lastLabeledPrompt || '';
            attachLibraryCardHoverPrompt(card, { prompt: p });
            applyLibraryMasonryLayout();
            // Re-apply once video metadata gives real aspect (for accurate no-gap shuffle of all cards)
            const vidEl = card.querySelector('video');
            if (vidEl) {
                if (vidEl.videoWidth > 0 && vidEl.videoHeight > 0) {
                    applyLibraryMasonryLayout();
                } else {
                    vidEl.addEventListener('loadedmetadata', () => applyLibraryMasonryLayout(), { once: true });
                }
            }
        }
    }

    if (event.type === 'error') {
        card.innerHTML = `<div class="flex items-center justify-center h-full text-red-400 text-sm">Failed to generate</div>`;
        const clearSec = (typeof window._failed_gen_clear_seconds === 'number' && window._failed_gen_clear_seconds > 0 ? window._failed_gen_clear_seconds : 600);
        setTimeout(() => {
            if (card && card.parentNode) card.parentNode.removeChild(card);
        }, clearSec * 1000);
    }
}

// ==================== FULL SCREEN MODAL ====================
function openImageModal(imageUrl, filename, asset = null) {
    // If an in-place preview is currently active, keep the user inside it instead of
    // spawning the old full-screen modal (related clicks, generated cards, etc. must update the preview pane).
    if (currentPreviewAsset && typeof showPreviewForAsset === 'function') {
        showPreviewForAsset(asset || filename);
        return;
    }
    // Close any existing modal
    const existing = document.getElementById('image-modal');
    const hadOpenModal = !!existing;
    if (existing) existing.remove();
    // ensure clean state for new modal (existing may have been force-removed without running close handlers)
    currentModalParentId = null;
    currentModalSourceFilename = null;
    currentModalModifier = null;

    // Capture main bar state BEFORE modal prefill/selectMode overwrites the shared globals (currentMode etc).
    // Only capture if this open is coming from main (not a force-reopen while another modal is up).
    // This fixes the bug where opening a video in modal would make subsequent main-page "image" gens act like video (count=1, duration passed).
    if (!hadOpenModal && !savedMainState) {
        // Capture the *true* main state only on the outermost open from main page.
        // Subsequent force-reopens (e.g. clicking Related cards while modal is open) won't overwrite it.
        savedMainState = {
            mode: currentMode,
            duration: currentDuration,
            resolution: currentResolution,
            aspectRatio: currentAspectRatio
        };
    }

    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'fixed inset-0 bg-black/95 z-[100] flex flex-col';

    modal.innerHTML = `
        <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <button id="modal-back-btn" class="flex items-center gap-x-2 text-white hover:text-zinc-300">
                <i class="fa-solid fa-arrow-left text-2xl"></i>
                <span class="text-sm font-medium">Back</span>
            </button>
            <div class="flex-1 text-center text-sm text-zinc-400 truncate px-4">${(asset && asset.prompt) || ''}</div>
            <div class="flex items-center gap-x-2">
                <button id="modal-download-btn" class="text-white hover:text-emerald-400 p-1" title="Download">
                    <i class="fa-solid fa-download text-xl"></i>
                </button>
                <button id="modal-favorite-btn" class="text-white hover:text-yellow-400 p-1" title="Favorite">
                    <i class="fa-regular fa-star text-xl"></i>
                </button>
                <button id="modal-delete-btn" class="text-white hover:text-red-400 p-1" title="Delete this and its related assets">
                    <i class="fa-solid fa-trash text-xl"></i>
                </button>
            </div>
        </div>

        <div class="flex flex-1 overflow-hidden">
            <!-- Image -->
            <div class="flex-1 flex items-center justify-center p-6 bg-zinc-950">
                <img src="${imageUrl}" class="max-w-[90%] max-h-[82vh] object-contain rounded-2xl shadow-2xl">
            </div>

            <!-- Sidebar -->
            <div class="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col">
                <div class="p-5 border-b border-zinc-800">
                    <h3 class="text-sm font-semibold mb-3">Actions</h3>
                    <div class="flex flex-col gap-y-2">
                        <button id="btn-create-video" class="w-full py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl font-medium flex items-center justify-center gap-x-2">
                            <i class="fa-solid fa-video"></i>
                            <span>Create Video from this</span>
                        </button>
                        <button id="btn-variations" class="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium flex items-center justify-center gap-x-2">
                            <i class="fa-solid fa-magic"></i>
                            <span>Generate Variations</span>
                        </button>
                    </div>
                </div>

                <div class="flex-1 p-5 overflow-auto">
                    <h3 class="text-sm font-semibold mb-3">Related</h3>
                    <div id="related-content" class="text-sm text-zinc-400">Loading...</div>
                </div>
            </div>
        </div>

        <!-- Prompt Bar Container -->
        <div id="modal-prompt-bar-container" 
             class="border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Determine effective asset (for live-rendered cards that may only have filename until tagged on save,
    // and for badge/parent logic in the modal viewer)
    let effectiveAsset = asset;
    if (!effectiveAsset && filename) {
        effectiveAsset = allAssets.find(a => a.filename === filename) || null;
    }

    // Add variation badges to the main preview image in the modal (if this asset has children)
    const previewDiv = modal.querySelector('.flex-1.flex.items-center.justify-center.p-6');
    if (previewDiv && effectiveAsset && effectiveAsset.id) {
        previewDiv.classList.add('relative');
        const previewImg = previewDiv.querySelector('img');
        if (previewImg) {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative inline-block';
            previewImg.parentNode.insertBefore(wrapper, previewImg);
            wrapper.appendChild(previewImg);
            const previewBadges = createVariationBadgesElement(effectiveAsset.id);
            if (previewBadges) {
                wrapper.appendChild(previewBadges);
            }
        } else {
            const previewBadges = createVariationBadgesElement(effectiveAsset.id);
            if (previewBadges) previewDiv.appendChild(previewBadges);
        }
    }

    // Library prev/next arrows on sides of the main media (image)
    if (previewDiv) {
        previewDiv.style.position = 'relative';
        const makeArrow = (dir, icon) => {
            const btn = document.createElement('button');
            btn.className = 'absolute z-[20] bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl ' + (dir < 0 ? 'left-2' : 'right-2') + ' top-1/2 -translate-y-1/2';
            btn.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
            btn.onclick = (e) => { e.stopImmediatePropagation(); navigateToAdjacentAsset(dir, filename); };
            return btn;
        };
        previewDiv.appendChild(makeArrow(-1, 'fa-chevron-left'));
        previewDiv.appendChild(makeArrow(1, 'fa-chevron-right'));
    }

    // Close button
    document.getElementById('modal-back-btn').onclick = () => closeImageModal(true);  // explicit exit to main: restores main bar state + globals for correct image vs video gen count/mode after close

    // === Create and inject the prompt bar ===
    const container = document.getElementById('modal-prompt-bar-container');
    
    if (container) {
        // Create the prompt bar
        const promptBar = createPromptBar('modal-');
        container.appendChild(promptBar);

        // Make sure rainbow styles are injected so the effect can appear on this modal's prompt bar when submitting
        ensureRainbowBorderStyles();

        // Wire Enter key for the modal prompt input (just like main bar)
        const modalInput = document.getElementById('modal-prompt-input');
        if (modalInput) {
            modalInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    if (!isComfyConnected || modalInput.disabled) {
                        e.preventDefault();
                        return;
                    }
                    sendPrompt('modal-prompt-input');
                }
            });
        }

        // Pre-fill if we have asset data
        const assetForPrefill = effectiveAsset || asset;
        if (assetForPrefill) {
            setTimeout(() => {
                prefillModalPromptBar(assetForPrefill);
            }, 100);
        } else {
            setTimeout(() => {
                selectMode('image', 'modal-');
            }, 100);
        }
    }

    // Setup download and favorite controls for the big preview in image modal
    const downloadBtn = modal.querySelector('#modal-download-btn');
    const favoriteBtn = modal.querySelector('#modal-favorite-btn');
    if (downloadBtn) {
        downloadBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            downloadAsset(imageUrl, filename);
        };
    }
    if (favoriteBtn && effectiveAsset) {
        let isFav = !!effectiveAsset.favorite;
        updateFavoriteButton(favoriteBtn, isFav);
        favoriteBtn.onclick = async (e) => {
            e.stopImmediatePropagation();
            isFav = !isFav;
            effectiveAsset.favorite = isFav;
            updateFavoriteButton(favoriteBtn, isFav);
            const idx = allAssets.findIndex(a => a.id === effectiveAsset.id);
            if (idx >= 0) allAssets[idx].favorite = isFav;
            await updateGenerationOnServer(effectiveAsset.id, { favorite: isFav });
            updateFavoriteIndicators(effectiveAsset.id, isFav);
        };
    }

    // Delete for the main image in modal (cascades to related per requirement)
    const deleteBtn = modal.querySelector('#modal-delete-btn');
    if (deleteBtn && effectiveAsset) {
        deleteBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            if (confirm('Delete this image and ALL its related images/videos? This cannot be undone.')) {
                deleteAsset(effectiveAsset.id, true);  // cascade=true
            }
        };
    }

    // Load related assets
    const relatedDiv = document.getElementById('related-content');
    const parentIdForModal = (effectiveAsset && effectiveAsset.id) || (asset && asset.id);
    if (parentIdForModal && relatedDiv) {
        currentModalParentId = parentIdForModal;
        // Only set source filename for image-to-video if the opened asset is an image (not a video)
        const isVideoAsset = effectiveAsset && (effectiveAsset.type === 'video' || (effectiveAsset.filename && effectiveAsset.filename.endsWith('.mp4')));
        currentModalSourceFilename = (!isVideoAsset && effectiveAsset) ? effectiveAsset.filename : null;
        loadRelatedAssets(parentIdForModal, relatedDiv);
    } else if (relatedDiv) {
        currentModalParentId = null;
        currentModalSourceFilename = null;
        relatedDiv.innerHTML = `<div class="text-zinc-500">No related items</div>`;
    }

    // Placeholder action buttons
    const videoBtn = document.getElementById('btn-create-video');
    const assetForActions = effectiveAsset || asset;
    if (videoBtn && assetForActions) {
        videoBtn.onclick = async () => {
            const modalInput = document.getElementById('modal-prompt-input');
            // Prefer prompt typed in the box; fall back to the original asset prompt
            const promptToUse = (modalInput && modalInput.value.trim()) || assetForActions.prompt || '';

            // Use current settings from the modal prompt bar (user can change duration/res/aspect before clicking)
            const resolution = currentResolution;
            const aspectRatio = currentAspectRatio;
            const duration = currentDuration;

            // Prepare the main generations area (same pattern as sendPrompt / generateMore)
            removeGenerateMoreButton();

            if (!hasGenerated) {
                document.getElementById('placeholder').style.display = 'none';
                hasGenerated = true;
            }

            if (!currentImageGrid || promptToUse !== lastLabeledPrompt) {
                const masonry = document.getElementById('library-masonry');
                if (currentView === 'library' && masonry) {
                    currentImageGrid = masonry;
                } else {
                    const section = createPromptSection(promptToUse);
                    currentImageGrid = section.imageGrid;
                }
                lastLabeledPrompt = promptToUse;
            }

            lastPrompt = promptToUse;
            lastResolution = resolution;
            lastAspectRatio = aspectRatio;
            lastDuration = duration;

            // Trigger image-to-video generation (count=1, source image, parent link for Related)
            let modImg = null, modAud = null;
            if (currentModalModifier) {
                if (currentModalModifier.type === 'image') modImg = currentModalModifier.filename;
                else modAud = currentModalModifier.filename;
            }
            await performBatchGeneration(
                promptToUse,
                resolution,
                aspectRatio,
                currentImageGrid,
                duration,
                assetForActions.id,   // parent_id so it shows in Related of this image
                1,                    // single video
                assetForActions.filename,  // source_image for i2v workflow
                modImg,
                modAud,
                null  // lora not applicable for video/ia2v
            );

            // After generation the Related pane will auto-refresh because parentId is passed
        };
    }

    const varBtn = document.getElementById('btn-variations');
    if (varBtn) varBtn.onclick = () => {
        if (!currentModalParentId || !assetForActions) {
            // fallback: just focus the prompt box
            const input = document.getElementById('modal-prompt-input');
            if (input) input.focus();
            return;
        }
        // Generate 1 variation using the *original* prompt of this asset (parent)
        // (the prompt bar send uses whatever is currently typed in the box)
        const originalPrompt = assetForActions.prompt || '';
        const input = document.getElementById('modal-prompt-input');
        if (input && originalPrompt) {
            input.value = originalPrompt;
            sendPrompt('modal-prompt-input');  // sendPrompt will see currentModalParentId and force count=1 + parent_id
        }
    };
}

function closeImageModal(restoreMain = true) {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    currentModalParentId = null;
    currentModalSourceFilename = null;
    currentModalModifier = null;
    if (restoreMain) {
        restoreMainPromptBarState();
    }
}

function restoreMainPromptBarState() {
    if (savedMainState) {
        currentMode = savedMainState.mode;
        currentDuration = savedMainState.duration;
        currentResolution = savedMainState.resolution;
        currentAspectRatio = savedMainState.aspectRatio;
        savedMainState = null;
    } else {
        currentMode = 'image';
        currentDuration = 1;
    }
    // Re-sync main (unprefixed) bar: sets currentMode, populates correct quick-options (res or res+dur), active button classes
    selectMode(currentMode);
    // Ensure main aspect text matches restored state (aspect dropdown select is secondary)
    const aspectText = document.getElementById('aspect-ratio-text');
    if (aspectText) aspectText.innerText = currentAspectRatio;
}

function downloadAsset(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'pulse-asset';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadImage(imageUrl, filename) {
    downloadAsset(imageUrl, filename || 'pulse-image.png');
}

function addFavoriteBadge(card, asset) {
    if (!asset || !asset.favorite) return;
    const badge = document.createElement('div');
    badge.className = 'absolute bottom-2 left-2 text-yellow-400';
    badge.innerHTML = '<i class="fa-solid fa-star text-sm"></i>';
    card.appendChild(badge);
}

function addDeleteIcon(card, asset) {
    if (!asset || !asset.id) return;
    const isVideo = asset.type === 'video' || (asset.filename && asset.filename.endsWith('.mp4'));
    const typeLabel = isVideo ? 'video' : 'image';
    const del = document.createElement('div');
    del.className = 'absolute bottom-2 left-2 text-red-400 hover:text-red-500 cursor-pointer z-10';
    del.innerHTML = '<i class="fa-solid fa-trash text-sm"></i>';
    del.title = `Delete ${typeLabel}`;
    del.onclick = (e) => {
        e.stopImmediatePropagation();
        if (confirm(`Delete this ${typeLabel}? This cannot be undone.`)) {
            deleteAsset(asset.id);
        }
    };
    card.appendChild(del);
}

function updateFavoriteIndicators(assetId, isFav) {
    document.querySelectorAll(`[data-asset-id="${assetId}"]`).forEach(card => {
        // remove any existing fav badge
        card.querySelectorAll('.fa-star').forEach(star => {
            const p = star.parentElement;
            if (p && p.classList.contains('absolute')) p.remove();
        });
        if (isFav) {
            const badge = document.createElement('div');
            badge.className = 'absolute bottom-2 left-2 text-yellow-400';
            badge.innerHTML = '<i class="fa-solid fa-star text-sm"></i>';
            card.appendChild(badge);
        }
        // reposition delete icon: right of star if now fav, else original left-2
        const trashEl = card.querySelector('.fa-trash');
        if (trashEl) {
            const tdiv = trashEl.parentElement;
            if (tdiv) {
                tdiv.classList.remove('left-2', 'left-6');
                tdiv.classList.add(isFav ? 'left-6' : 'left-2');
            }
        }
    });
}

function updateFavoriteButton(btn, isFav) {
    if (!btn) return;
    if (isFav) {
        btn.innerHTML = '<i class="fa-solid fa-star text-xl text-yellow-400"></i>';
        btn.title = 'Remove from favorites';
    } else {
        btn.innerHTML = '<i class="fa-regular fa-star text-xl"></i>';
        btn.title = 'Add to favorites';
    }
}

async function updateGenerationOnServer(assetId, updates) {
    try {
        const res = await fetch('/update-generation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: assetId, ...updates })
        });
        return await res.json();
    } catch (e) {
        console.error('Failed to update generation on server:', e);
        return { success: false, error: e.message || e };
    }
}

async function deleteAsset(assetId, cascade = false) {
    if (!assetId) return false;
    // For cascade deletes (e.g. main image in modal), pre-collect related ids from client state
    // so we can clean UI immediately and consistently (server also does cascade).
    let idsToRemove = [assetId];
    if (cascade) {
        const collect = (pid) => {
            const kids = allAssets.filter(a =>
                a.parent_id === pid ||
                (a.derived_from && a.derived_from.includes(pid))
            );
            kids.forEach(k => {
                if (!idsToRemove.includes(k.id)) {
                    idsToRemove.push(k.id);
                    collect(k.id);
                }
            });
        };
        collect(assetId);
    }
    try {
        const resp = await fetch('/delete-generation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: assetId, cascade })
        });
        const result = await resp.json();
        if (result && result.success) {
            allAssets = allAssets.filter(a => !idsToRemove.includes(a.id));
            rebuildChildrenMap();
            idsToRemove.forEach(id => {
                document.querySelectorAll(`[data-asset-id="${id}"]`).forEach(el => el.remove());
            });
            // If a project is loaded, clean any cues referencing the deleted asset(s)
            if (currentProject && currentProject.cues && currentProject.cues.length) {
                let projChanged = false;
                currentProject.cues.forEach(cue => {
                    if (idsToRemove.includes(cue.selected_image_id)) {
                        cue.selected_image_id = null;
                        projChanged = true;
                    }
                    if (idsToRemove.includes(cue.video_id)) {
                        cue.video_id = null;
                        cue.video_start_offset = 0;
                        projChanged = true;
                    }
                });
                if (projChanged) {
                    saveProjectToServer(currentProject);
                    if (typeof renderCues === 'function') renderCues();
                }
            }
            // Close modal if the deleted asset (or cascade) was the one being viewed
            const imodal = document.getElementById('image-modal');
            if (imodal) {
                // If cascade, or if no more main img, close it
                if (cascade) {
                    imodal.remove();
                    document.body.style.overflow = '';
                } else {
                    // for single deletes (e.g. from related), leave modal open but related will be cleaned
                }
            }
            return true;
        } else {
            alert('Delete failed: ' + (result && result.error ? result.error : 'unknown error'));
        }
    } catch (e) {
        console.error('Delete error:', e);
        alert('Error while deleting asset');
    }
    return false;
}

async function deleteSection(promptText, sectionElement) {
    if (!sectionElement) return;
    const grid = sectionElement.querySelector('.image-grid');
    if (!grid) {
        sectionElement.remove();
        return;
    }
    const cards = Array.from(grid.querySelectorAll('[data-asset-id]'));
    const ids = cards.map(c => c.dataset.assetId).filter(Boolean);
    if (ids.length === 0) {
        sectionElement.remove();
        return;
    }
    // already confirmed in the label onclick
    for (const id of ids) {
        // delete individually (no cascade; just the ones in this prompt group)
        await deleteAsset(id, false);
    }
    // remove the section element (its grid cards already removed by deleteAsset)
    if (sectionElement.parentNode) {
        sectionElement.parentNode.removeChild(sectionElement);
    }
}

function openVideoModal(videoUrl, filename) {
    // If an in-place preview is currently active, keep the user inside it instead of
    // spawning the old full-screen modal (related clicks, generated cards, etc. must update the preview pane).
    if (currentPreviewAsset && typeof showPreviewForAsset === 'function') {
        showPreviewForAsset(filename);
        return;
    }
    const existing = document.getElementById('video-modal');
    if (existing) existing.remove();

    let effectiveAsset = allAssets.find(a => a.filename === filename) || null;

    const modal = document.createElement('div');
    modal.id = 'video-modal';
    modal.className = 'fixed inset-0 bg-black/95 z-[100] flex flex-col';

    modal.innerHTML = `
        <div class="flex items-center justify-between px-6 py-4">
            <button id="video-modal-back-btn" class="flex items-center gap-x-2 text-white hover:text-zinc-300">
                <i class="fa-solid fa-arrow-left text-2xl"></i>
                <span class="text-sm font-medium">Back</span>
            </button>
            <div class="flex items-center gap-x-2">
                <button id="video-download-btn" class="text-white hover:text-emerald-400 p-1" title="Download">
                    <i class="fa-solid fa-download text-xl"></i>
                </button>
                <button id="video-favorite-btn" class="text-white hover:text-yellow-400 p-1" title="Favorite">
                    <i class="fa-regular fa-star text-xl"></i>
                </button>
            </div>
        </div>
        <div class="flex-1 flex items-center justify-center p-6">
            <video src="${videoUrl}" 
                   class="max-w-[92%] max-h-[82vh] rounded-2xl shadow-2xl" 
                   controls 
                   autoplay 
                   loop>
            </video>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Library prev/next arrows on sides of the main media (video)
    const vidPreview = modal.querySelector('.flex-1.flex.items-center.justify-center.p-6');
    if (vidPreview) {
        vidPreview.style.position = 'relative';
        const makeArrow = (dir, icon) => {
            const btn = document.createElement('button');
            btn.className = 'absolute z-[20] bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl ' + (dir < 0 ? 'left-2' : 'right-2') + ' top-1/2 -translate-y-1/2';
            btn.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
            btn.onclick = (e) => { e.stopImmediatePropagation(); navigateToAdjacentAsset(dir, filename); };
            return btn;
        };
        vidPreview.appendChild(makeArrow(-1, 'fa-chevron-left'));
        vidPreview.appendChild(makeArrow(1, 'fa-chevron-right'));
    }

    const downloadBtn = document.getElementById('video-download-btn');
    const favoriteBtn = document.getElementById('video-favorite-btn');
    if (downloadBtn) {
        downloadBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            downloadAsset(videoUrl, filename);
        };
    }
    if (favoriteBtn && effectiveAsset) {
        let isFav = !!effectiveAsset.favorite;
        updateFavoriteButton(favoriteBtn, isFav);
        favoriteBtn.onclick = async (e) => {
            e.stopImmediatePropagation();
            isFav = !isFav;
            effectiveAsset.favorite = isFav;
            updateFavoriteButton(favoriteBtn, isFav);
            const idx = allAssets.findIndex(a => a.id === effectiveAsset.id);
            if (idx >= 0) allAssets[idx].favorite = isFav;
            await updateGenerationOnServer(effectiveAsset.id, { favorite: isFav });
            updateFavoriteIndicators(effectiveAsset.id, isFav);
        };
    }

    document.getElementById('video-modal-back-btn').onclick = closeVideoModal;

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeVideoModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    modal.onclick = (e) => {
        if (e.target === modal) closeVideoModal();
    };
}

function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// ==================== IN-PLACE PREVIEW (non-modal "normal" detail view) ====================
// Goal: show a large image/video preview + sidebar + related while keeping the *real* main
// bottom prompt bar visible and active. This reuses the bar where the rainbow effect already
// works reliably, avoiding the second 'modal-' .input-bar that lives in a high-z overlay
// and breaks the rainbow CSS (stacking, mask, negative z, container padding, etc.).
//
// When a preview is active we hide (or collapse) the library masonry scroller and render
// the preview content into the main area. "Back" restores the masonry.
// The main bar submit will still honor currentModalParentId / source etc. so "generate from this
// preview" (variations, i2v, etc.) continues to work with parent linking.

function showPreviewForAsset(assetOrFilename) {
    // Hide library fades
    document.querySelectorAll('.library-fade').forEach(el => {
        el.style.display = 'none';
    });
    // Close any old full modals
    ['image-modal', 'video-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) {
            m.querySelectorAll('video').forEach(v => {
                try { v.pause(); v.src = ''; if (v.load) v.load(); } catch (e) {}
            });
            m.remove();
        }
    });
    document.body.style.overflow = '';

    // Resolve asset (can be passed by value or by filename)
    let asset = assetOrFilename;
    if (typeof assetOrFilename === 'string') {
        asset = allAssets.find(a => a.filename === assetOrFilename) || null;
    }
    if (!asset) return;

    currentPreviewAsset = asset;

    // Make any submit from the main (bottom) prompt bar while this preview is active
    // behave like the old "modal prompt bar" submit: single item, linked to this asset.
    currentModalParentId = asset.id;
    currentModalSourceFilename = asset.filename;
    currentModalModifier = null;

    // Use the generations-container (same area as the library masonry) so the preview content
    // has the exact same size and position, and the main bottom prompt bar stays exactly the same below it.
    const genContainer = document.getElementById('generations-container');

    // For a persistent library scroller (see Option A in plan): instead of destroying the scroller
    // (which loses native scrollTop), we hide the existing library view subtree and show the preview.
    // This gives us native scroll preservation for free on the common preview <-> library toggle.
    // We still snapshot a semantic reference (visible asset near the view) as fallback for full
    // re-renders (project return, explicit loadHistory after delete, etc.).
    let referenceAssetId = null;
    let referenceOffset = 0;
    const scrollerBeforePreview = document.querySelector('.library-scroller');
    if (scrollerBeforePreview) {
        // Capture a semantic reference: find a card that is roughly at the top of the current view.
        // We'll use its asset id + the delta between scroller scrollTop and the card's offsetTop.
        // On a later full re-render we can locate the card and restore a similar visual position.
        const cards = scrollerBeforePreview.querySelectorAll('#library-masonry > div[data-asset-id]');
        let best = null;
        let bestDist = Infinity;
        const viewTop = scrollerBeforePreview.scrollTop;
        cards.forEach(c => {
            const top = c.offsetTop || 0;
            const dist = Math.abs(top - viewTop);
            if (dist < bestDist) { bestDist = dist; best = c; }
        });
        if (best && best.dataset.assetId) {
            referenceAssetId = best.dataset.assetId;
            referenceOffset = viewTop - (best.offsetTop || 0);
        }
        // Hide the library scroller subtree (and pause its videos for perf) instead of clearing the container.
        scrollerBeforePreview.style.display = 'none';
        scrollerBeforePreview.querySelectorAll('video').forEach(v => {
            try { v.pause(); } catch (e) {}
        });
    }
    // Stash the semantic reference for the exit path (hide or showLibraryView) to use on full re-renders.
    if (referenceAssetId) {
        previewReferenceAsset = { assetId: referenceAssetId, offset: referenceOffset };
    }

    // Do not nuke genContainer. Just ensure any old preview pane is gone, then append the new one.
    // The library scroller (if present) stays in the tree but hidden.
    const existingPreview = document.getElementById('preview-pane');
    if (existingPreview) existingPreview.remove();

    const previewPane = document.createElement('div');
    previewPane.id = 'preview-pane';
    previewPane.style.height = '100%';
    previewPane.style.display = 'flex';
    previewPane.style.flexDirection = 'column';
    // dark "modal-like" feel locally for the preview area
    previewPane.style.background = 'rgba(0,0,0,0.95)';

    if (genContainer) {
      genContainer.appendChild(previewPane);
    } else {
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.appendChild(previewPane);
    }

    const isVideo = asset.type === 'video' || (asset.filename && asset.filename.toLowerCase().endsWith('.mp4'));
    const mediaUrl = isVideo ? `/videos/${asset.filename}` : `/images/${asset.filename}`;

    // Build the preview content (adapted from the old modal structure, but without a second prompt bar).
    const paneHTML = `
        <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800 w-full">
            <button id="preview-back-btn" class="flex items-center gap-x-2 text-white hover:text-zinc-300">
                <i class="fa-solid fa-arrow-left text-2xl"></i>
                <span class="text-sm font-medium">Back</span>
            </button>
            <div class="flex-1 text-center text-sm text-zinc-400 truncate px-4">${asset.prompt || ''}</div>
            <div class="flex items-center gap-x-2">
                <button id="preview-download-btn" class="text-white hover:text-emerald-400 p-1" title="Download">
                    <i class="fa-solid fa-download text-xl"></i>
                </button>
                <button id="preview-favorite-btn" class="text-white hover:text-yellow-400 p-1" title="Favorite">
                    <i class="fa-regular fa-star text-xl"></i>
                </button>
                <button id="preview-delete-btn" class="text-white hover:text-red-400 p-1" title="Delete this and its related assets">
                    <i class="fa-solid fa-trash text-xl"></i>
                </button>
            </div>
        </div>

        <div class="flex flex-1 overflow-hidden w-full">
            <!-- Large media -->
            <div class="flex-1 flex items-center justify-center p-6 bg-zinc-950 relative" id="preview-media-area">
                ${isVideo
                    ? `<video src="${mediaUrl}" class="max-w-[92%] max-h-[82vh] rounded-2xl shadow-2xl" controls autoplay loop muted playsinline></video>`
                    : `<img src="${mediaUrl}" class="max-w-[90%] max-h-[82vh] object-contain rounded-2xl shadow-2xl">`
                }
            </div>

            <!-- Sidebar (actions + related) -->
            <div class="w-80 border-l border-zinc-800 bg-zinc-900 flex flex-col">
                <div class="p-5 border-b border-zinc-800">
                    <h3 class="text-sm font-semibold mb-3">Actions</h3>
                    <div class="flex flex-col gap-y-2">
                        <button id="preview-btn-create-video" class="w-full py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl font-medium flex items-center justify-center gap-x-2">
                            <i class="fa-solid fa-video"></i>
                            <span>Create Video from this</span>
                        </button>
                        <button id="preview-btn-variations" class="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium flex items-center justify-center gap-x-2">
                            <i class="fa-solid fa-magic"></i>
                            <span>Generate Variations</span>
                        </button>
                    </div>
                </div>

                <div class="flex-1 p-5 overflow-auto">
                    <h3 class="text-sm font-semibold mb-3">Related</h3>
                    <div id="related-content" class="text-sm text-zinc-400">Loading...</div>
                </div>
            </div>
        </div>
    `;

    previewPane.innerHTML = paneHTML;

    // Wire back
    const backBtn = document.getElementById('preview-back-btn');
    if (backBtn) backBtn.onclick = () => hidePreviewAndRestoreLibrary();

    // Wire download / favorite / delete (reuse existing helpers where possible)
    const dlBtn = document.getElementById('preview-download-btn');
    if (dlBtn) dlBtn.onclick = (e) => { e.stopImmediatePropagation(); downloadAsset(mediaUrl, asset.filename); };

    const favBtn = document.getElementById('preview-favorite-btn');
    if (favBtn && asset) {
        let isFav = !!asset.favorite;
        // reuse the visual updater if available
        if (typeof updateFavoriteButton === 'function') updateFavoriteButton(favBtn, isFav);
        favBtn.onclick = async (e) => {
            e.stopImmediatePropagation();
            isFav = !isFav;
            asset.favorite = isFav;
            if (typeof updateFavoriteButton === 'function') updateFavoriteButton(favBtn, isFav);
            const idx = allAssets.findIndex(a => a.id === asset.id);
            if (idx >= 0) allAssets[idx].favorite = isFav;
            if (typeof updateGenerationOnServer === 'function') {
                await updateGenerationOnServer(asset.id, { favorite: isFav });
            }
            if (typeof updateFavoriteIndicators === 'function') updateFavoriteIndicators(asset.id, isFav);
        };
    }

    const delBtn = document.getElementById('preview-delete-btn');
    if (delBtn && asset) {
        delBtn.onclick = async (e) => {
            e.stopImmediatePropagation();
            if (confirm('Delete this asset and its related items?')) {
                if (typeof deleteGeneration === 'function') {
                    await deleteGeneration(asset.id, true);
                }
                // refresh library when we come back
                hidePreviewAndRestoreLibrary();
                if (typeof loadHistory === 'function') await loadHistory();
            }
        };
    }

    // Wire the action buttons (Create Video / Variations) — they set the "current modal" globals
    // so that when the *main* bottom bar submits, performBatchGeneration receives the right
    // parent_id / source_image and count=1.
    const createVideoBtn = document.getElementById('preview-btn-create-video');
    if (createVideoBtn) {
        createVideoBtn.onclick = async () => {
            // Set the globals the rest of the code already understands for "generate from this"
            currentModalParentId = asset.id;
            currentModalSourceFilename = asset.filename;
            currentModalModifier = null;

            // Switch the main bar into video mode (user can still change it)
            currentMode = 'video';
            if (asset.metadata && asset.metadata.duration) currentDuration = asset.metadata.duration;
            // Re-sync the main bar UI (buttons, quick options for duration)
            if (typeof selectMode === 'function') selectMode(currentMode);

            // Optionally focus the main prompt input so the user knows to type + submit
            const mainInput = document.getElementById('prompt-input');
            if (mainInput) {
                mainInput.focus();
                mainInput.placeholder = 'Type a motion prompt (or leave blank to use the asset prompt) and press Enter…';
            }
        };
    }

    const variationsBtn = document.getElementById('preview-btn-variations');
    if (variationsBtn) {
        variationsBtn.onclick = () => {
            currentModalParentId = asset.id;
            currentModalSourceFilename = asset.filename;
            currentModalModifier = null;

            // Stay in image mode for variations
            currentMode = 'image';
            // Re-sync the main bar UI
            if (typeof selectMode === 'function') selectMode(currentMode);

            const mainInput = document.getElementById('prompt-input');
            if (mainInput) {
                mainInput.focus();
                mainInput.placeholder = 'Describe the variation you want and press Enter…';
            }
        };
    }

    // Load related (reuse existing helper if present)
    const relatedDiv = document.getElementById('related-content');
    if (relatedDiv && typeof loadRelatedAssets === 'function' && asset.id) {
        loadRelatedAssets(asset.id, relatedDiv);
    }

    // Add prev/next arrows inside the media area (reuse the makeArrow logic we already have)
    const mediaArea = document.getElementById('preview-media-area');
    if (mediaArea) {
        mediaArea.style.position = 'relative';
        const makeArrow = (dir, icon) => {
            const btn = document.createElement('button');
            btn.className = 'absolute z-[20] bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl ' + (dir < 0 ? 'left-2' : 'right-2') + ' top-1/2 -translate-y-1/2';
            btn.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
            btn.onclick = (e) => { e.stopImmediatePropagation(); navigateToAdjacentAsset(dir, asset.filename); };
            return btn;
        };
        mediaArea.appendChild(makeArrow(-1, 'fa-chevron-left'));
        mediaArea.appendChild(makeArrow(1, 'fa-chevron-right'));
    }

    ensureRainbowBorderStyles();

    // Rewire the main library prompt bar's + button to showModifierPicker for this preview
    // (restores the distinct modifier functionality for detail view; main + is upload for library)
    const mainBar = document.querySelector('#bottom-prompt-bar .input-bar');
    if (mainBar) {
      const inputRow = mainBar.querySelector('.flex.items-center.gap-x-3');
      if (inputRow) {
        const plusBtn = inputRow.querySelector('button');
        if (plusBtn) {
          if (!plusBtn._origOnclick) plusBtn._origOnclick = plusBtn.onclick || null;
          plusBtn.onclick = showModifierPicker;
        }
      }
    }

    // The main bottom prompt bar stays visible at the exact same position and size as in library.
    // Rainbow will work on it as usual (class added in perform). Submit will use the preview context for parent/modifier.
}

function hidePreviewAndRestoreLibrary() {
    // Pause ALL videos on the page when leaving preview
    document.querySelectorAll('video').forEach(video => {
        video.pause();
    });

    // Show library fades again
    document.querySelectorAll('.library-fade').forEach(el => {
        el.style.display = '';
    });
    const previewPane = document.getElementById('preview-pane');
    if (previewPane) previewPane.style.display = 'none';

    const genContainer = document.getElementById('generations-container');

    // Restore styles (same as before — keeps the full-height + sticky header/prompt behavior).
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.classList.remove('overflow-y-auto', 'px-6', 'pb-6');
      mainContent.style.padding = '0';
      mainContent.style.overflow = 'hidden';
    }
    // (genContainer overflow hidden is set a few lines below)
    if (genContainer) {
      genContainer.style.display = 'flex';
      genContainer.style.flexDirection = 'column';
      genContainer.style.height = '100%';
      genContainer.style.minHeight = '0';
      genContainer.style.overflow = 'hidden';
    }

    const headerEl = document.querySelector('.flex.items-center.justify-between.px-6.py-4.border-b.border-zinc-800');
    if (headerEl) {
        headerEl.style.position = 'sticky';
        headerEl.style.top = '0';
        headerEl.style.zIndex = '40';
        headerEl.style.backgroundColor = '#09090b';
    }
    const promptEl = document.getElementById('bottom-prompt-bar');
    if (promptEl) {
        promptEl.style.position = 'sticky';
        promptEl.style.bottom = '0';
        promptEl.style.zIndex = '40';
        promptEl.style.backgroundColor = 'transparent';
    }

    // PERSISTENT SCROLLER APPROACH (core of Option A):
    // Try to find an *existing* library scroller that we hid on entry. If present, just un-hide it.
    // This gives us native scroll preservation without any pixel math for the normal preview <-> library flow.
    let scroller = document.querySelector('.library-scroller');
    let didFullRebuild = false;

    if (scroller) {
        scroller.style.display = '';
        // Re-apply flex sizing + grey scrollbar styles on unhide. This (plus the applyLayout)
        // is why the scrollbar appears after a preview roundtrip; we now do the equivalent
        // setup on initial cold start too.
        scroller.style.flex = '1 1 0%';
        scroller.style.minHeight = '0';
        scroller.style.overflow = 'auto';
        scroller.style.scrollbarWidth = 'thin';
        scroller.style.scrollbarColor = '#888 #333';
        // Re-apply layout in case sizes/density changed while the view was hidden.
        if (typeof applyLibraryMasonryLayout === 'function') {
            applyLibraryMasonryLayout();
        }
    } else {
        // No scroller present (e.g. first time, or it was cleared by a project unload, delete, etc.).
        // Fall back to a (selective) full render. We will use semantic restore below.
        if (genContainer) genContainer.innerHTML = '';
        if (genContainer && typeof renderLibraryMasonry === 'function' && allAssets && allAssets.length) {
            renderLibraryMasonry(allAssets, genContainer);
            didFullRebuild = true;
        }
        scroller = document.querySelector('.library-scroller');
        if (typeof applyLibraryMasonryLayout === 'function') {
            applyLibraryMasonryLayout();
        }
    }

    // Semantic / asset-based restore (Option B) for the cases where we did (or had to do) a content rebuild.
    // This is more robust than raw scrollTop when new items have been inserted at the top.
    const ref = previewReferenceAsset;
    if (ref && ref.assetId && scroller) {
        // After layout, try to find the reference card and restore a similar visual position.
        const card = scroller.querySelector(`#library-masonry > div[data-asset-id="${ref.assetId}"]`);
        if (card) {
            // Put the reference card roughly where it was relative to the previous viewport top.
            const target = Math.max(0, (card.offsetTop || 0) + (ref.offset || 0));
            scroller.scrollTop = target;
        } else {
            // Reference asset not found (e.g. it was the one we just previewed and it moved, or deleted).
            // Fall back to a small scroll so the area near it is still roughly visible, or leave as-is.
            // For simplicity we leave the current position (often near top after re-sort).
        }
        // Consume the reference.
        previewReferenceAsset = null;
    }

    // (No legacy pixel var to clean — persistent scroller + semantic reference are the mechanism.)

    // hadPreviewGenerations refresh: still do the server round-trip for authoritative data,
    // but prefer to do a *selective* refresh of the masonry content (keeping the scroller node)
    // so we don't lose the (now native or semantically restored) scroll position.
    if (hadPreviewGenerations && typeof loadHistory === 'function') {
        hadPreviewGenerations = false;
        loadHistory().then(() => {
            // After loadHistory (which calls renderLibraryMasonry), the scroller may have been
            // recreated. Re-apply semantic or a gentle scroll if we still have a reference.
            const newRef = previewReferenceAsset;
            const newScroller = document.querySelector('.library-scroller');
            if (newRef && newRef.assetId && newScroller) {
                const card = newScroller.querySelector(`#library-masonry > div[data-asset-id="${newRef.assetId}"]`);
                if (card) {
                    newScroller.scrollTop = Math.max(0, (card.offsetTop || 0) + (newRef.offset || 0));
                }
                previewReferenceAsset = null;
            } else if (newScroller) {
                // If no semantic ref, at least don't force to top — leave whatever the render produced.
            }
        }).catch(console.error);
    }

    // Restore main + button to upload
    const mainBar = document.querySelector('#bottom-prompt-bar .input-bar');
    if (mainBar) {
      const inputRow = mainBar.querySelector('.flex.items-center.gap-x-3');
      if (inputRow) {
        const plusBtn = inputRow.querySelector('button');
        if (plusBtn && plusBtn._origOnclick) {
          plusBtn.onclick = plusBtn._origOnclick;
        }
      }
    }

    document.body.style.overflow = '';

    currentPreviewAsset = null;

    // Clean up "from this preview" context so subsequent library gens are normal (4 images etc.).
    currentModalParentId = null;
    currentModalSourceFilename = null;
    currentModalModifier = null;
}

function navigateToAdjacentAsset(direction, currentFilename) {
    if (!currentFilename || !allAssets || !allAssets.length) return;
    // Sort newest first to match library view order
    const sorted = [...allAssets].sort((a, b) => {
        const ta = a.created ? Date.parse(a.created) : 0;
        const tb = b.created ? Date.parse(b.created) : 0;
        return tb - ta;
    });
    const idx = sorted.findIndex(a => a.filename === currentFilename);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const nextAsset = sorted[newIdx];
    // Close any open media modals
    ['image-modal', 'video-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.remove();
    });
    document.body.style.overflow = '';
    const nextUrl = (nextAsset.type === 'video' || (nextAsset.filename || '').toLowerCase().endsWith('.mp4'))
        ? `/videos/${nextAsset.filename}`
        : `/images/${nextAsset.filename}`;
    if (nextAsset.type === 'video' || (nextAsset.filename || '').toLowerCase().endsWith('.mp4')) {
        if (typeof showPreviewForAsset === 'function') {
            showPreviewForAsset(nextAsset);
        } else {
            openVideoModal(nextUrl, nextAsset.filename, nextAsset);
        }
    } else {
        if (typeof showPreviewForAsset === 'function') {
            showPreviewForAsset(nextAsset);
        } else {
            openImageModal(nextUrl, nextAsset.filename, nextAsset);
        }
    }
}

// ==================== GENERATE MORE BUTTON ====================
function showGenerateMoreButton() {
    removeGenerateMoreButton();
    const btnContainer = document.createElement('div');
    btnContainer.id = 'generate-more-container';
    btnContainer.className = 'flex justify-center mt-8 mb-4';
    btnContainer.innerHTML = `
        <button id="generate-more-btn" class="px-8 py-3.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-full flex items-center gap-x-3">
            <i class="fa-solid fa-sync fa-fw"></i>
            <span>Generate More</span>
        </button>
    `;
    const genCont = document.getElementById('generations-container');
    const scrollTarget = genCont ? (genCont.querySelector('.library-scroller') || genCont) : document.getElementById('generations-container');
    if (scrollTarget) scrollTarget.appendChild(btnContainer);
    else if (genCont) genCont.appendChild(btnContainer);
    document.getElementById('generate-more-btn').onclick = generateMore;
}

function removeGenerateMoreButton() {
    const el = document.getElementById('generate-more-container');
    if (el) el.remove();
}

// ==================== MODE & RESOLUTION (FULLY RESTORED) ====================
function selectMode(mode, prefix = '') {
    currentMode = mode;

    const btnImage = document.getElementById(`${prefix}btn-image`);
    const btnVideo = document.getElementById(`${prefix}btn-video`);
    const quickOptions = document.getElementById(`${prefix}quick-options`);

    if (!quickOptions) return;

    if (mode === 'image') {
        if (btnImage) btnImage.classList.add('bg-white', 'text-black');
        if (btnVideo) btnVideo.classList.remove('bg-white', 'text-black');

        quickOptions.innerHTML = `
            <button onclick="selectResolution('480p', this, '${prefix}')" class="res-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">480p</button>
            <button onclick="selectResolution('720p', this, '${prefix}')" class="res-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">720p</button>
            <button onclick="selectResolution('1080p', this, '${prefix}')" class="res-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">1080p</button>
        `;
    } else {
        if (btnVideo) btnVideo.classList.add('bg-white', 'text-black');
        if (btnImage) btnImage.classList.remove('bg-white', 'text-black');

        quickOptions.innerHTML = `
            <button onclick="selectResolution('480p', this, '${prefix}')" class="res-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">480p</button>
            <button onclick="selectResolution('720p', this, '${prefix}')" class="res-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">720p</button>
            <button onclick="selectResolution('1080p', this, '${prefix}')" class="res-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">1080p</button>
            <button onclick="selectDuration(1, this, '${prefix}')" class="duration-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">1s</button>
            <button onclick="selectDuration(6, this, '${prefix}')" class="duration-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">6s</button>
            <button onclick="selectDuration(10, this, '${prefix}')" class="duration-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">10s</button>
            <button onclick="selectDuration(20, this, '${prefix}')" class="duration-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">20s</button>
            <button onclick="selectDuration(30, this, '${prefix}')" class="duration-btn px-3 py-1 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">30s</button>
        `;

        setDefaultDuration(prefix);
    }

    setDefaultResolution(prefix);
}

function selectResolution(resolution, element, prefix = '') {
    currentResolution = resolution;

    const scope = prefix ? `#${prefix}quick-options` : '';
    const selector = scope ? `${scope} .res-btn` : '.res-btn';

    document.querySelectorAll(selector).forEach(btn => {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-zinc-800');
    });

    if (element) {
        element.classList.remove('bg-zinc-800');
        element.classList.add('bg-white', 'text-black');
    }
}

function setDefaultResolution(prefix = '') {
    const scope = prefix ? `#${prefix}quick-options` : '';
    const selector = scope ? `${scope} .res-btn` : '.res-btn';
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(btn => {
        if (btn.innerText === currentResolution) {
            selectResolution(currentResolution, btn, prefix);
        }
    });
}

function toggleAspectRatioDropdown(prefix = '') {
    const id = prefix ? `${prefix}aspect-dropdown` : 'aspect-dropdown';
    const dropdown = document.getElementById(id);
    // close enhancers when opening/closing aspect
    document.querySelectorAll('[id$="enhancer-dropdown"]').forEach(d => d.classList.add('hidden'));
    if (dropdown) dropdown.classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
    // Handle outside clicks for aspect and enhancer dropdowns (main + modal)
    const dropdowns = [
        { id: 'aspect-dropdown', toggle: 'toggleAspectRatioDropdown()' },
        { id: 'modal-aspect-dropdown', toggle: "toggleAspectRatioDropdown('modal-')" },
        { id: 'enhancer-dropdown', toggle: 'toggleEnhancerDropdown()' },
        { id: 'modal-enhancer-dropdown', toggle: "toggleEnhancerDropdown('modal-')" }
    ];

    dropdowns.forEach(({ id, toggle }) => {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;

        const clickedToggle = e.target.closest(`button[onclick*="${toggle}"]`);
        if (!dropdown.contains(e.target) && !clickedToggle) {
            dropdown.classList.add('hidden');
        }
    });
});

function selectAspectRatio(ratio, element, prefix = '') {
    currentAspectRatio = ratio;

    const textId = prefix ? `${prefix}aspect-ratio-text` : 'aspect-ratio-text';
    const textEl = document.getElementById(textId);
    if (textEl) textEl.innerText = ratio;

    const ddId = prefix ? `${prefix}aspect-dropdown` : 'aspect-dropdown';
    const dropdown = document.getElementById(ddId);
    if (dropdown) {
        dropdown.querySelectorAll(':scope > div').forEach(div => {
            div.classList.remove('bg-zinc-800');
            const check = div.querySelector('i');
            if (check) check.remove();
        });

        if (element) {
            element.classList.add('bg-zinc-800');
            element.innerHTML += ` <i class="fa-solid fa-check text-emerald-400 ml-auto"></i>`;
        }
        dropdown.classList.add('hidden');
    }
}

function selectDuration(duration, element, prefix = '') {
    currentDuration = duration;

    const scope = prefix ? `#${prefix}quick-options` : '';
    const selector = scope ? `${scope} .duration-btn` : '.duration-btn';

    document.querySelectorAll(selector).forEach(btn => {
        btn.classList.remove('bg-white', 'text-black');
        btn.classList.add('bg-zinc-800');
    });

    if (element) {
        element.classList.remove('bg-zinc-800');
        element.classList.add('bg-white', 'text-black');
    }
}

function setDefaultDuration(prefix = '') {
    const scope = prefix ? `#${prefix}quick-options` : '';
    const selector = scope ? `${scope} .duration-btn` : '.duration-btn';
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(btn => {
        if (parseInt(btn.innerText) === currentDuration) {
            selectDuration(currentDuration, btn, prefix);
        }
    });
}

// ==================== PROMPT ENHANCERS DROPDOWN (library + detail views) ====================

function updateEnhancerUIState(connected) {
    // Grey/disable enhancer buttons when Ollama not available
    document.querySelectorAll('button[onclick*="toggleEnhancerDropdown"]').forEach(btn => {
        const txt = btn.querySelector('[id$="enhancer-text"], #enhancer-text');
        if (!connected) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.setAttribute('disabled', 'true');
            btn.title = 'Prompt enhancers require Ollama connection';
            if (txt) txt.textContent = 'No enhancement';
            if (!currentEnhancer || currentEnhancer !== 'none') currentEnhancer = 'none';
        } else {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.removeAttribute('disabled');
            btn.title = 'Prompt enhancer (uses Ollama to improve prompt)';
        }
    });
}

function selectEnhancer(id, element, prefix = '') {
    currentEnhancer = id || 'none';
    const textElId = prefix ? `${prefix}enhancer-text` : 'enhancer-text';
    const textEl = document.getElementById(textElId);
    if (textEl) {
        const enh = getEnhancerById(id);
        textEl.textContent = enh ? enh.name : 'No enhancement';
    }
    // close the dropdown
    const ddId = prefix ? `${prefix}enhancer-dropdown` : 'enhancer-dropdown';
    const dd = document.getElementById(ddId);
    if (dd) dd.classList.add('hidden');
    // remove active styles from siblings (re-populate will handle on next open)
}

function toggleEnhancerDropdown(prefix = '') {
    const ddId = prefix ? `${prefix}enhancer-dropdown` : 'enhancer-dropdown';
    const dd = document.getElementById(ddId);
    if (!dd) return;
    const isOpen = !dd.classList.contains('hidden');
    // close any open enhancer dropdowns
    document.querySelectorAll('[id$="enhancer-dropdown"]').forEach(d => d.classList.add('hidden'));
    // also close aspect ones for cleanliness
    const asp = document.getElementById('aspect-dropdown'); if (asp) asp.classList.add('hidden');
    const modalAsp = document.getElementById('modal-aspect-dropdown'); if (modalAsp) modalAsp.classList.add('hidden');
    if (isOpen) return;

    // (re)populate
    dd.innerHTML = '';
    const isOllama = (typeof window.isOllamaConnected !== 'undefined') ? window.isOllamaConnected : true;
    if (!isOllama && promptEnhancers.length) {
        // still allow "none" but note disabled
    }

    // None option
    const noneDiv = document.createElement('div');
    const noneActive = !currentEnhancer || currentEnhancer === 'none';
    noneDiv.className = `px-3 py-1 text-xs hover:bg-zinc-800 cursor-pointer flex items-center ${noneActive ? 'bg-zinc-800' : ''}`;
    noneDiv.innerHTML = `No enhancement ${noneActive ? '<i class="fa-solid fa-check text-emerald-400 ml-auto text-[10px]"></i>' : ''}`;
    noneDiv.onclick = (e) => { e.stopImmediatePropagation(); selectEnhancer('none', noneDiv, prefix); };
    dd.appendChild(noneDiv);

    (promptEnhancers || []).forEach(enh => {
        if (!enh || enh.id === 'none') return;
        const d = document.createElement('div');
        const active = currentEnhancer === enh.id;
        d.className = `px-3 py-1 text-xs hover:bg-zinc-800 cursor-pointer flex items-center ${active ? 'bg-zinc-800' : ''}`;
        d.innerHTML = `${enh.name || enh.id} ${active ? '<i class="fa-solid fa-check text-emerald-400 ml-auto text-[10px]"></i>' : ''}`;
        d.onclick = (e) => { e.stopImmediatePropagation(); selectEnhancer(enh.id, d, prefix); };
        dd.appendChild(d);
    });

    dd.classList.remove('hidden');
}

// Hook status check to also update enhancer buttons (called from checkServerStatuses)
const _origCheckServerStatuses = checkServerStatuses;
checkServerStatuses = async function() {
    await _origCheckServerStatuses();
    // after it sets window.isOllamaConnected and updates status, sync enhancer disabled state
    if (typeof window.isOllamaConnected !== 'undefined') {
        updateEnhancerUIState(window.isOllamaConnected);
    }
};

// ==================== SERVER STATUS CHECK (ComfyUI + Ollama) ====================

function updateInputState(connected) {
    isComfyConnected = connected;

    // Main bar
    const input = document.getElementById('prompt-input');
    const sendBtn = document.querySelector('button[onclick="sendPrompt()"]');

    if (input && sendBtn) {
        if (connected) {
            input.disabled = false;
            input.placeholder = "Type to imagine";
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-40', 'cursor-not-allowed');
            sendBtn.classList.add('hover:bg-zinc-200');
        } else {
            input.disabled = true;
            input.placeholder = "ComfyUI is not available";
            sendBtn.disabled = true;
            sendBtn.classList.add('opacity-40', 'cursor-not-allowed');
            sendBtn.classList.remove('hover:bg-zinc-200');
        }
    }

    // Modal prompt bar (if open)
    const modalInput = document.getElementById('modal-prompt-input');
    const modalSendBtn = document.querySelector('button[onclick="sendPrompt(\'modal-prompt-input\')"]');
    if (modalInput && modalSendBtn) {
        if (connected) {
            modalInput.disabled = false;
            modalInput.placeholder = "Type to imagine";
            modalSendBtn.disabled = false;
            modalSendBtn.classList.remove('opacity-40', 'cursor-not-allowed');
            modalSendBtn.classList.add('hover:bg-zinc-200');
        } else {
            modalInput.disabled = true;
            modalInput.placeholder = "ComfyUI is not available";
            modalSendBtn.disabled = true;
            modalSendBtn.classList.add('opacity-40', 'cursor-not-allowed');
            modalSendBtn.classList.remove('hover:bg-zinc-200');
        }
    }
}

async function checkServerStatuses() {
    const statusDiv = document.getElementById('connection-status');
    if (!statusDiv) return;

    let comfyConnected = false;
    let ollamaConnected = false;
    let comfyUrl = '';
    let ollamaUrl = '';

    try {
        const [comfyRes, ollamaRes] = await Promise.all([
            fetch('/comfy/status').catch(() => null),
            fetch('/ollama/status').catch(() => null)
        ]);

        if (comfyRes && comfyRes.ok) {
            const d = await comfyRes.json();
            comfyConnected = !!d.connected;
            comfyUrl = d.url || '';
        }
        if (ollamaRes && ollamaRes.ok) {
            const d = await ollamaRes.json();
            ollamaConnected = !!d.connected;
            ollamaUrl = d.url || '';
        }
    } catch (e) {
        // network failure will be reflected below
    }

    window.isOllamaConnected = ollamaConnected;
    updateInputState(comfyConnected);

    const parts = [];
    if (!comfyConnected) {
        parts.push(`
            <div class="text-red-400 text-sm flex items-center gap-x-2">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <span>ComfyUI is not reachable${comfyUrl ? ' (' + comfyUrl + ')' : ''}</span>
            </div>
        `);
    }
    if (!ollamaConnected) {
        parts.push(`
            <div class="text-red-400 text-sm flex items-center gap-x-2">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <span>Ollama is not reachable${ollamaUrl ? ' (' + ollamaUrl + ')' : ''}</span>
            </div>
        `);
    }

    if (parts.length === 0) {
        statusDiv.innerHTML = '';
    } else {
        statusDiv.innerHTML = parts.join('');
    }
}

// Backwards-compatible alias used by init
async function checkComfyUIStatus() {
    return checkServerStatuses();
}

// Check status on load and every 30 seconds
function initComfyStatusCheck() {
    checkServerStatuses();
    setInterval(checkServerStatuses, 30000);
}

async function loadRelatedAssets(assetId, container) {
    try {
        const res = await fetch('/history');
        const allAssets = await res.json();

        const related = allAssets.filter(a => 
            a.parent_id === assetId || 
            (a.derived_from && a.derived_from.includes(assetId))
        );

        if (related.length === 0) {
            container.innerHTML = `<div class="text-zinc-500 text-sm">No related assets yet</div>`;
            return;
        }

        // Sort by created timestamp, newest first (reverse chronological)
        related.sort((a, b) => {
            const timeA = new Date(a.created || 0).getTime();
            const timeB = new Date(b.created || 0).getTime();
            return timeB - timeA;
        });

        container.innerHTML = '';
        // Render as cards similar to the main image cards (single column list in the sidebar for decent preview size)
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 gap-2';
        related.forEach(rel => {
            const card = createRelatedAssetCard(rel);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    } catch (e) {
        container.innerHTML = `<div class="text-red-400 text-sm">Failed to load related assets</div>`;
    }
}

function prefillModalPromptBar(asset) {
    if (!asset) return;

    lastPrompt = asset.prompt || '';
    currentAspectRatio = asset.aspect_ratio || '3:2';
    lastAspectRatio = currentAspectRatio;

    const isVideoAsset = asset.type === 'video' || (asset.filename && asset.filename.endsWith('.mp4'));
    currentMode = isVideoAsset ? 'video' : 'image';

    if (isVideoAsset && asset.metadata && asset.metadata.duration) {
        currentDuration = asset.metadata.duration;
    }

    const prefix = 'modal-';

    // Pre-fill prompt input early
    const promptInput = document.getElementById(`${prefix}prompt-input`);
    if (promptInput) promptInput.value = lastPrompt;

    // Derive resolution from asset size (before selectMode so setDefaults see it)
    if (asset.height >= 1000) currentResolution = '1080p';
    else if (asset.height >= 650) currentResolution = '720p';
    else currentResolution = '480p';
    lastResolution = currentResolution;

    // Set aspect text
    const aspectText = document.getElementById(`${prefix}aspect-ratio-text`);
    if (aspectText) aspectText.innerText = currentAspectRatio;

    // Let selectMode handle mode button activation, quick-options population,
    // and res/duration highlighting (just like the main prompt bar)
    selectMode(currentMode, prefix);

    // Aspect dropdown selected state (the check + bg) may need a tick for safety
    setTimeout(() => {
        const dropdown = document.getElementById(`${prefix}aspect-dropdown`);
        if (dropdown) {
            dropdown.querySelectorAll(':scope > div').forEach(div => {
                div.classList.remove('bg-zinc-800');
                const check = div.querySelector('i');
                if (check) check.remove();
            });

            dropdown.querySelectorAll(':scope > div').forEach(div => {
                const text = div.innerText.trim();
                if (
                    (currentAspectRatio === '3:2' && text.includes('3:2')) ||
                    (currentAspectRatio === '2:3' && text.includes('2:3')) ||
                    (currentAspectRatio === '1:1' && text.includes('1:1')) ||
                    (currentAspectRatio === '9:16' && text.includes('9:16')) ||
                    (currentAspectRatio === '16:9' && text.includes('16:9'))
                ) {
                    div.classList.add('bg-zinc-800');
                    if (!div.querySelector('i')) {
                        div.innerHTML += ` <i class="fa-solid fa-check text-emerald-400 ml-auto"></i>`;
                    }
                }
            });
        }
    }, 50);
}

function createPromptBar(prefix = '') {
    const bar = document.createElement('div');
    bar.className = 'input-bar rounded-3xl px-4 py-3 shadow-xl w-full max-w-[1100px] mx-auto';

    bar.innerHTML = `
        <div class="flex items-center gap-x-2 mb-3 flex-wrap">
            
            <!-- Mode Buttons -->
            <div class="flex items-center bg-zinc-800 rounded-full p-1 text-sm">
                <button onclick="selectMode('image', '${prefix}')" id="${prefix}btn-image"
                        class="flex items-center gap-x-1.5 px-4 py-1.5 rounded-full bg-white text-black font-medium text-sm">
                    <i class="fa-solid fa-image"></i>
                    <span>Image</span>
                </button>
                <button onclick="selectMode('video', '${prefix}')" id="${prefix}btn-video"
                        class="flex items-center gap-x-1.5 px-4 py-1.5 rounded-full hover:bg-zinc-700 font-medium text-sm">
                    <i class="fa-solid fa-video"></i>
                    <span>Video</span>
                </button>
            </div>

            <!-- Quick Options -->
            <div id="${prefix}quick-options" class="flex items-center gap-x-2 text-sm">
                <!-- Populated by selectMode -->
            </div>

            <!-- Aspect Ratio -->
            <div class="relative">
                <button onclick="toggleAspectRatioDropdown('${prefix}')" 
                        class="flex items-center gap-x-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm font-medium">
                    <span id="${prefix}aspect-ratio-text">3:2</span>
                    <i class="fa-solid fa-chevron-down text-xs"></i>
                </button>

                <div id="${prefix}aspect-dropdown" 
                     class="hidden absolute bottom-12 left-0 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-44 py-2 z-50 text-sm">
                    <div onclick="selectAspectRatio('2:3', this, '${prefix}')" class="px-4 py-2 hover:bg-zinc-800 cursor-pointer">2:3 Tall</div>
                    <div onclick="selectAspectRatio('3:2', this, '${prefix}')" class="px-4 py-2 hover:bg-zinc-800 cursor-pointer bg-zinc-800 flex justify-between items-center">
                        <span>3:2 Wide</span>
                        <i class="fa-solid fa-check text-emerald-400"></i>
                    </div>
                    <div onclick="selectAspectRatio('1:1', this, '${prefix}')" class="px-4 py-2 hover:bg-zinc-800 cursor-pointer">1:1 Square</div>
                    <div onclick="selectAspectRatio('9:16', this, '${prefix}')" class="px-4 py-2 hover:bg-zinc-800 cursor-pointer">9:16 Vertical</div>
                    <div onclick="selectAspectRatio('16:9', this, '${prefix}')" class="px-4 py-2 hover:bg-zinc-800 cursor-pointer">16:9 Widescreen</div>
                </div>
            </div>

            <!-- Prompt Enhancer (next to aspect ratio) -->
            <div class="relative">
                <button onclick="toggleEnhancerDropdown('${prefix}')" 
                        class="flex items-center gap-x-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm font-medium" title="Prompt enhancer (requires Ollama)">
                    <span id="${prefix}enhancer-text">No enhancement</span>
                    <i class="fa-solid fa-chevron-down text-xs"></i>
                </button>
                <div id="${prefix}enhancer-dropdown" 
                     class="hidden absolute bottom-12 left-0 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-48 py-1 z-50 text-sm">
                    <!-- JS populated (shows all, no scrollbar) -->
                </div>
            </div>
        </div>

        <!-- Input Row -->
        <div class="flex items-center gap-x-3">
            <button class="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                <i class="fa-solid fa-plus text-lg"></i>
            </button>

            <input type="text" id="${prefix}prompt-input" 
                   class="flex-1 bg-transparent outline-none text-white placeholder-zinc-400 text-[15px]"
                   placeholder="Type to imagine">

            <button onclick="sendPrompt('${prefix}prompt-input')"
                    class="w-9 h-9 flex items-center justify-center bg-white text-black rounded-full hover:bg-zinc-200 transition-colors">
                <i class="fa-solid fa-arrow-up"></i>
            </button>
        </div>
    `;

    return bar;
}

// ==================== ASSET UPLOAD (via + button) ====================

function showAssetUpload() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 z-[200] flex items-center justify-center';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-8 w-full max-w-md mx-4">
            <h3 class="text-xl font-semibold mb-4 flex items-center gap-x-2">
                <i class="fa-solid fa-upload"></i>
                <span>Upload asset</span>
            </h3>
            <div id="drop-zone" 
                 class="border-2 border-dashed border-zinc-600 hover:border-emerald-400 rounded-2xl p-10 text-center cursor-pointer transition-colors">
                <i class="fa-solid fa-cloud-upload-alt text-5xl text-zinc-400 mb-4"></i>
                <p class="font-medium">Drag & drop file here</p>
                <p class="text-sm text-zinc-400 mt-1">or click to choose</p>
                <p class="text-xs text-zinc-500 mt-3">Supports images and audio files (mp3, wav, etc.)</p>
            </div>
            <input type="file" id="file-input" class="hidden" accept="image/*,audio/*">
            <div class="mt-6 flex justify-end gap-x-3">
                <button id="cancel-upload-btn" class="px-5 py-2 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const dropZone = overlay.querySelector('#drop-zone');
    const fileInput = overlay.querySelector('#file-input');
    const cancelBtn = overlay.querySelector('#cancel-upload-btn');

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = () => {
        if (fileInput.files[0]) {
            handleUploadedFile(fileInput.files[0], overlay);
        }
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-emerald-400', 'bg-zinc-800/50');
    };
    dropZone.ondragleave = () => {
        dropZone.classList.remove('border-emerald-400', 'bg-zinc-800/50');
    };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-emerald-400', 'bg-zinc-800/50');
        if (e.dataTransfer.files[0]) {
            handleUploadedFile(e.dataTransfer.files[0], overlay);
        }
    };

    cancelBtn.onclick = () => overlay.remove();

    // If using Flux Schnell, also offer LoRA selection (in addition to upload)
    // LoRAs are listed from ComfyUI (see /loras + settings refresh; uses /models/loras)
    const contentDiv = overlay.querySelector('div.bg-zinc-900');
    const buttonsDiv = overlay.querySelector('.mt-6');
    if (contentDiv && buttonsDiv && currentImageModel === 'schnell' && availableLoras && availableLoras.length > 0) {
        const loraSec = document.createElement('div');
        loraSec.className = 'mt-4 pt-4 border-t border-zinc-700';
        loraSec.innerHTML = `
            <div class="text-sm font-medium mb-1.5 flex items-center gap-x-2 text-emerald-400">
                <i class="fa-solid fa-magic"></i>
                <span>LoRAs (Flux Schnell only)</span>
            </div>
            <div class="max-h-40 overflow-auto text-xs bg-zinc-950 border border-zinc-600 rounded-xl p-1 space-y-0.5"></div>
            <p class="text-[10px] text-zinc-500 mt-1">Selecting a LoRA will use the special LoRA workflow for the next image generation(s) from this bar.</p>
        `;
        const listEl = loraSec.querySelector('div.max-h-40');
        availableLoras.forEach(lora => {
            const row = document.createElement('div');
            row.className = 'px-2 py-1 hover:bg-zinc-800 rounded cursor-pointer flex items-center gap-x-2 text-emerald-300';
            row.innerHTML = `<i class="fa-solid fa-magic w-3 text-[10px]"></i><span class="truncate">${lora}</span>`;
            row.onclick = () => {
                overlay.remove();
                if (currentImageModel !== 'schnell') {
                    currentImageModel = 'schnell';
                    saveSettings({ image_model: 'schnell' }).catch(() => {});
                }
                updateMainLoraIndicator(lora);
            };
            listEl.appendChild(row);
        });
        // insert before the action buttons
        buttonsDiv.parentNode.insertBefore(loraSec, buttonsDiv);
    }
}

async function handleUploadedFile(file, overlay) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        overlay.remove();

        // Now ask for prompt/details
        showAssetDetailsPrompt(data.filename, data.type, file.name);
    } catch (err) {
        alert('Upload failed: ' + (err.message || err));
        overlay.remove();
    }
}

function showAssetDetailsPrompt(filename, ftype, originalName) {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black/80 z-[200] flex items-center justify-center';
    dialog.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 class="text-lg font-semibold mb-1">Save uploaded asset</h3>
            <p class="text-sm text-zinc-400 mb-4">File: ${originalName}</p>

            <label class="block text-sm mb-1 text-zinc-300">Prompt / Description (saved to history)</label>
            <input id="asset-prompt-input" type="text" 
                   class="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-500 rounded-xl px-4 py-2 text-white outline-none"
                   placeholder="e.g. Calm rain sounds" value="${originalName.replace(/\.[^/.]+$/, '')}">

            <div class="mt-6 flex gap-x-3 justify-end">
                <button id="cancel-details-btn" class="px-5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm">Cancel</button>
                <button id="save-asset-btn" class="px-5 py-2 rounded-full bg-white text-black font-medium text-sm">Save to history</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    const promptInput = dialog.querySelector('#asset-prompt-input');
    const saveBtn = dialog.querySelector('#save-asset-btn');
    const cancelBtn = dialog.querySelector('#cancel-details-btn');

    cancelBtn.onclick = () => dialog.remove();

    saveBtn.onclick = async () => {
        const promptText = promptInput.value.trim() || originalName;
        const assetData = {
            prompt: promptText,
            filename: filename,
            type: ftype,
            aspect_ratio: ftype === 'audio' ? '1:1' : '3:2',
            width: 0,
            height: 0,
            parent_id: null,
            derived_from: [],
            favorite: false
        };

        try {
            await saveGenerationToServer(assetData);
            dialog.remove();

            // Refresh the main view to show the new asset
            const genContainer = document.getElementById('generations-container');
            if (genContainer) genContainer.innerHTML = '';
            await loadHistory();
        } catch (e) {
            alert('Failed to save asset: ' + (e.message || e));
        }
    };

    // focus input
    setTimeout(() => promptInput.focus(), 50);
}

// ==================== MODAL + PICKER (image/audio modifiers for video gen) ====================

function updateModalModifierIndicator(selectedAsset = null) {
    let inputRow = null;
    const modal = document.getElementById('image-modal');
    if (modal) {
      inputRow = modal.querySelector('.input-bar .flex.items-center.gap-x-3');
    } else if (currentPreviewAsset) {
      const mainBar = document.querySelector('#bottom-prompt-bar .input-bar');
      if (mainBar) inputRow = mainBar.querySelector('.flex.items-center.gap-x-3');
    }
    if (!inputRow) return;

    // remove existing indicator if any
    const existing = inputRow.querySelector('.modal-modifier-indicator');
    if (existing) existing.remove();

    if (!selectedAsset) {
        currentModalModifier = null;
        return;
    }

    const isAudio = selectedAsset.type === 'audio' ||
        (selectedAsset.filename && /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(selectedAsset.filename));
    currentModalModifier = {
        type: isAudio ? 'audio' : 'image',
        filename: selectedAsset.filename,
        id: selectedAsset.id || null,
        prompt: selectedAsset.prompt || ''
    };

    const ind = document.createElement('div');
    ind.className = 'modal-modifier-indicator flex-shrink-0 w-7 h-7 rounded-md overflow-hidden border border-emerald-500/70 cursor-pointer relative';
    ind.title = isAudio ? (currentModalModifier.prompt || 'Audio modifier') : (selectedAsset.filename || 'Image modifier');

    if (isAudio) {
        ind.innerHTML = `
            <div class="w-full h-full flex items-center justify-center bg-zinc-950">
                <i class="fa-solid fa-volume-up text-emerald-400 text-base"></i>
            </div>
            <button class="absolute -top-px -right-px w-3 h-3 bg-black/80 rounded-full text-[6px] leading-none flex items-center justify-center text-white hover:bg-red-500">×</button>
        `;
    } else {
        const url = `/images/${currentModalModifier.filename}`;
        ind.innerHTML = `
            <img src="${url}" class="w-full h-full object-cover" alt="">
            <button class="absolute -top-px -right-px w-3 h-3 bg-black/80 rounded-full text-[6px] leading-none flex items-center justify-center text-white hover:bg-red-500">×</button>
        `;
    }

    const xBtn = ind.querySelector('button');
    if (xBtn) {
        xBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            updateModalModifierIndicator(null);
        };
    }
    ind.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        showModifierPicker();
    };

    // insert right after the + button
    const plusBtn = inputRow.querySelector('button');
    if (plusBtn) {
        if (plusBtn.nextSibling) {
            inputRow.insertBefore(ind, plusBtn.nextSibling);
        } else {
            plusBtn.after(ind);
        }
    } else {
        inputRow.prepend(ind);
    }
}

function updateMainLoraIndicator(loraName = null) {
    // Show a small square indicator (like modal modifiers) for selected LoRA on the *main* library prompt bar.
    // Only meaningful when currentImageModel === 'schnell'.
    const mainBar = document.querySelector('.input-bar');
    if (!mainBar) return;
    const inputRow = mainBar.querySelector('.flex.items-center.gap-x-3');
    if (!inputRow) return;

    const existing = inputRow.querySelector('.main-lora-indicator');
    if (existing) existing.remove();

    if (!loraName) {
        currentLora = null;
        return;
    }

    currentLora = loraName;

    const ind = document.createElement('div');
    ind.className = 'main-lora-indicator flex-shrink-0 w-7 h-7 rounded-md overflow-hidden border border-emerald-500/70 cursor-pointer relative flex items-center justify-center bg-zinc-950 text-[9px] font-bold text-emerald-400';
    ind.title = loraName;

    ind.innerHTML = `
        L
        <button class="absolute -top-px -right-px w-3 h-3 bg-black/80 rounded-full text-[6px] leading-none flex items-center justify-center text-white hover:bg-red-500">×</button>
    `;

    const xBtn = ind.querySelector('button');
    if (xBtn) {
        xBtn.onclick = (e) => {
            e.stopImmediatePropagation();
            updateMainLoraIndicator(null);
        };
    }

    // insert right after the + button (first button in row)
    const plusBtn = inputRow.querySelector('button');
    if (plusBtn) {
        plusBtn.insertAdjacentElement('afterend', ind);
    } else {
        inputRow.prepend(ind);
    }
}

function createCompactPickerCard(asset, onPick) {
    const card = document.createElement('div');
    const isAudio = asset.type === 'audio' ||
        (asset.filename && /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(asset.filename));
    card.className = `bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden cursor-pointer hover:border-emerald-400 transition-colors text-[10px]`;

    if (isAudio) {
        const p = (asset.prompt || 'Audio').replace(/"/g, '&quot;');
        card.innerHTML = `
            <div class="aspect-square flex items-center justify-center bg-zinc-950">
                <i class="fa-solid fa-volume-up text-2xl text-emerald-400"></i>
            </div>
            <div class="px-1 py-0.5 bg-zinc-900 text-[8px] text-zinc-300 truncate" title="${p}">${p}</div>
        `;
    } else {
        const mediaUrl = `/images/${asset.filename}`;
        card.innerHTML = `
            <div class="aspect-square">
                <img src="${mediaUrl}" class="w-full h-full object-cover" alt="">
            </div>
        `;
    }

    card.onclick = (e) => {
        e.stopImmediatePropagation();
        onPick(asset);
    };
    return card;
}

async function showModifierPicker() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 z-[250] flex items-center justify-center';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-5 w-full max-w-3xl mx-4 max-h-[82vh] flex flex-col" onclick="event.stopImmediatePropagation()">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h3 class="text-base font-semibold flex items-center gap-x-2">
                        <i class="fa-solid fa-paperclip"></i>
                        <span>Select modifier (image or audio)</span>
                    </h3>
                    <p class="text-[11px] text-zinc-400 mt-0.5">Pick one to use as a modifier/reference when creating a video from the current image. Audio cards show their prompt/description.</p>
                </div>
                <button id="close-picker-x" class="text-xl leading-none text-zinc-400 hover:text-white px-1">×</button>
            </div>

            <div id="picker-grid" class="flex-1 overflow-auto border border-zinc-800 rounded-xl p-2 bg-zinc-950">
                <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2"></div>
            </div>

            <div class="mt-3 flex justify-between items-center text-sm">
                <div class="text-[10px] text-zinc-500">Latest items first • No videos</div>
                <div class="flex gap-x-2">
                    <button id="clear-picker-btn" class="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs">Clear</button>
                    <button id="cancel-picker-btn" class="px-3 py-1 rounded-full bg-zinc-700 hover:bg-zinc-600 text-xs">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-picker-x').onclick = close;
    overlay.querySelector('#cancel-picker-btn').onclick = close;
    overlay.querySelector('#clear-picker-btn').onclick = () => {
        updateModalModifierIndicator(null);
        close();
    };
    // click outside inner to close
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const gridDiv = overlay.querySelector('#picker-grid > div');
    gridDiv.innerHTML = `<div class="col-span-full text-center text-zinc-400 py-6 text-xs">Loading assets...</div>`;

    let candidates = [];
    try {
        const res = await fetch('/history');
        const all = await res.json() || [];
        candidates = all.filter(a => {
            const isVid = a.type === 'video' || (a.filename && a.filename.toLowerCase().endsWith('.mp4'));
            return !isVid;
        }).sort((a, b) => {
            const ta = new Date(a.created || 0).getTime();
            const tb = new Date(b.created || 0).getTime();
            return tb - ta;
        });
    } catch (e) {
        console.warn('Modifier picker history fetch failed, falling back to cache', e);
        candidates = (allAssets || []).filter(a => {
            const isVid = a.type === 'video' || (a.filename && a.filename.toLowerCase().endsWith('.mp4'));
            return !isVid;
        }).sort((a, b) => {
            const ta = new Date(a.created || 0).getTime();
            const tb = new Date(b.created || 0).getTime();
            return tb - ta;
        });
    }

    gridDiv.innerHTML = '';
    if (candidates.length === 0) {
        gridDiv.innerHTML = `<div class="col-span-full text-center text-zinc-500 py-8 text-xs">No images or audio assets yet.<br>Upload using the + on the main page.</div>`;
        return;
    }

    candidates.forEach(asset => {
        const c = createCompactPickerCard(asset, (picked) => {
            updateModalModifierIndicator(picked);
            close();
        });
        gridDiv.appendChild(c);
    });
}

// Attach + button behavior to created prompt bars (modals use modifier picker, main uses upload)
const _origCreatePromptBar = createPromptBar;
createPromptBar = function(prefix = '') {
    const bar = _origCreatePromptBar(prefix);
    setTimeout(() => {
        const inputRow = bar.querySelector('.flex.items-center.gap-x-3');
        if (inputRow) {
            const plusBtn = inputRow.querySelector('button');
            if (plusBtn) {
                if (prefix && (prefix.startsWith('modal-') || prefix.startsWith('detail-'))) {
                    plusBtn.onclick = showModifierPicker;
                } else {
                    plusBtn.onclick = showAssetUpload;
                }
            }
        }
    }, 0);
    return bar;
};




// ==================== INIT ====================
// ==================== IMAGE MODEL SETTINGS (main page only) ====================

async function loadSettings() {
    try {
        const res = await fetch('/settings');
        if (res.ok) {
            const data = await res.json();
            if (data.image_model === 'klein' || data.image_model === 'schnell' || data.image_model === 'qwen') {
                currentImageModel = data.image_model;
            }
            if (data.i2i_model === 'klein' || data.i2i_model === 'flux2') {
                currentI2IModel = data.i2i_model;
            }
            if (data.library_video_playback === '1st_frame' || data.library_video_playback === 'play_loop') {
                libraryVideoPlayback = data.library_video_playback;
            }
            if (typeof data.qwen_turbo === 'boolean') {
                qwenTurbo = data.qwen_turbo;
            }
            // Server settings (for the settings dialog)
            if (typeof data.comfyui_url === 'string') window._server_comfyui_url = data.comfyui_url;
            if (typeof data.ollama_url === 'string') window._server_ollama_url = data.ollama_url;
            if (typeof data.ollama_model === 'string') window._server_ollama_model = data.ollama_model;
            if (typeof data.ollama_timeout === 'number') window._server_ollama_timeout = data.ollama_timeout;
            if (typeof data.failed_gen_clear_seconds === 'number') window._failed_gen_clear_seconds = data.failed_gen_clear_seconds;
            if (Array.isArray(data.prompt_enhancers) && data.prompt_enhancers.length > 0) {
                promptEnhancers = data.prompt_enhancers;
            } else if (!promptEnhancers || promptEnhancers.length === 0) {
                promptEnhancers = getDefaultPromptEnhancers();
                // Persist the seeded list so user can edit later
                saveSettings({ prompt_enhancers: promptEnhancers }).catch(() => {});
            }
        }
        // Apply to any already-rendered library cards (in case of timing with loadHistory)
        if (typeof applyLibraryVideoPlaybackToCards === 'function') {
            applyLibraryVideoPlaybackToCards();
        }
    } catch (e) {
        console.warn('Could not load image model settings, using defaults', e);
    }
}

async function loadLoras(refresh = false) {
    try {
        const qs = refresh ? '?refresh=true' : '';
        const res = await fetch('/loras' + qs);
        if (res.ok) {
            const data = await res.json();
            availableLoras = Array.isArray(data.loras) ? data.loras : [];
            console.log(`[LoRA] Loaded ${availableLoras.length} LoRAs from ComfyUI`);
        }
    } catch (e) {
        console.warn('Could not load LoRAs from ComfyUI', e);
    }
}

async function saveSettings(settings) {
    try {
        const res = await fetch('/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.settings) {
                if (data.settings.image_model) currentImageModel = data.settings.image_model;
                if (data.settings.i2i_model) currentI2IModel = data.settings.i2i_model;
                if (typeof data.settings.qwen_turbo === 'boolean') qwenTurbo = data.settings.qwen_turbo;
                if (data.settings.library_video_playback) libraryVideoPlayback = data.settings.library_video_playback;
                if (typeof data.settings.comfyui_url === 'string') window._server_comfyui_url = data.settings.comfyui_url;
                if (typeof data.settings.ollama_url === 'string') window._server_ollama_url = data.settings.ollama_url;
                if (typeof data.settings.ollama_model === 'string') window._server_ollama_model = data.settings.ollama_model;
                if (typeof data.settings.ollama_timeout === 'number') window._server_ollama_timeout = data.settings.ollama_timeout;
                if (Array.isArray(data.settings.prompt_enhancers)) {
                    promptEnhancers = data.settings.prompt_enhancers;
                }
            }
        }
    } catch (e) {
        console.error('Failed to save settings', e);
    }
}

function applyLibraryVideoPlaybackToCards() {
    // Update existing video elements in library/related views without full re-render
    // (used when changing the setting live in the modal)
    const containers = [
        document.getElementById('generations-container'),
        document.getElementById('related-content')
    ].filter(Boolean);
    containers.forEach(cont => {
        cont.querySelectorAll('video').forEach(v => {
            if (libraryVideoPlayback === 'play_loop') {
                v.autoplay = true;
                v.loop = true;
                v.muted = true;
                v.playsInline = true;
                v.play().catch(() => {});
            } else {
                v.autoplay = false;
                v.loop = false;
                try { v.currentTime = 0; } catch (e) {}
                v.pause();
            }
        });
    });
}

// ==================== PROJECT PERSISTENCE (mirror generations + settings patterns) ====================
async function loadProjects() {
    try {
        const res = await fetch('/projects');
        projects = await res.json() || [];
    } catch (e) {
        console.warn('Failed to load projects, starting empty', e);
        projects = [];
    }
}

async function saveProjectToServer(project) {
    try {
        const res = await fetch('/save-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        const data = await res.json();
        if (data && data.id) {
            // keep local id in sync
            project.id = data.id;
        }
        return data;
    } catch (e) {
        console.error('Failed to save project', e);
        return { success: false, error: e.message || e };
    }
}

async function createNewProject() {
    const name = prompt('Project name?', 'Untitled Project');
    if (!name || !name.trim()) return;

    // Create a small settings dialog for resolution and aspect (as requested)
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/70 z-[250] flex items-center justify-center';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-5 w-full max-w-sm mx-4 border border-zinc-700">
            <h3 class="text-base font-semibold mb-1">New Project Settings</h3>
            <p class="text-xs text-zinc-400 mb-3">Images and videos generated for cues will use these.</p>

            <label class="text-xs text-zinc-400">Resolution</label>
            <select id="newproj-res" class="w-full mb-3 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm">
                <option value="480p">480p</option>
                <option value="720p" selected>720p</option>
                <option value="1080p">1080p</option>
            </select>

            <label class="text-xs text-zinc-400">Aspect Ratio</label>
            <select id="newproj-aspect" class="w-full mb-4 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm">
                <option value="3:2" selected>3:2 (Wide)</option>
                <option value="2:3">2:3 (Tall)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="9:16">9:16 (Vertical)</option>
            </select>

            <div class="flex gap-2 justify-end">
                <button id="newproj-cancel" class="px-4 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Cancel</button>
                <button id="newproj-create" class="px-4 py-1.5 text-sm rounded-full bg-white text-black">Create Project</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const resSel = overlay.querySelector('#newproj-res');
    const aspSel = overlay.querySelector('#newproj-aspect');
    const cancel = overlay.querySelector('#newproj-cancel');
    const createBtn = overlay.querySelector('#newproj-create');

    cancel.onclick = () => overlay.remove();

    createBtn.onclick = async () => {
        const chosenRes = resSel.value;
        const chosenAsp = aspSel.value;
        overlay.remove();

        const proj = {
            id: null,
            name: name.trim(),
            audio_filename: null,
            audio_duration: null,
            resolution: chosenRes,
            aspect_ratio: chosenAsp,
            cues: []
        };
        const resp = await saveProjectToServer(proj);
        if (resp && (resp.success || resp.id)) {
            await loadProjects();
            currentProject = projects.find(p => p.id === resp.id) || projects[projects.length-1];
            currentView = 'project';
            const _cv = document.getElementById('chat-view');
            if (_cv) _cv.classList.add('hidden');
            const _hv = document.getElementById('home-view');
            if (_hv) {
                _hv.style.display = 'none';
                _hv.classList.add('hidden');
            }
            updateMainHeaderForView('project');
            renderSidebarProjectList();
            showProjectEditor();
        }
    };
}

function editProjectSettings() {
    if (!currentProject) return;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/70 z-[250] flex items-center justify-center';
    const curRes = currentProject.resolution || '720p';
    const curAsp = currentProject.aspect_ratio || '3:2';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-5 w-full max-w-sm mx-4 border border-zinc-700">
            <h3 class="text-base font-semibold mb-1">Project Settings</h3>
            <p class="text-xs text-zinc-400 mb-3">Change resolution and aspect ratio. Affects future cue generations (images/videos) and the sizing of visuals in the timeline clips strip / in dialogs. Existing media assets keep their original pixel dimensions (display boxes will adapt, using object-cover).</p>

            <label class="text-xs text-zinc-400">Resolution</label>
            <select id="editproj-res" class="w-full mb-3 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm">
                <option value="480p" ${curRes==='480p' ? 'selected' : ''}>480p</option>
                <option value="720p" ${curRes==='720p' ? 'selected' : ''}>720p</option>
                <option value="1080p" ${curRes==='1080p' ? 'selected' : ''}>1080p</option>
            </select>

            <label class="text-xs text-zinc-400">Aspect Ratio</label>
            <select id="editproj-aspect" class="w-full mb-4 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm">
                <option value="3:2" ${curAsp==='3:2' ? 'selected' : ''}>3:2 (Wide)</option>
                <option value="2:3" ${curAsp==='2:3' ? 'selected' : ''}>2:3 (Tall)</option>
                <option value="1:1" ${curAsp==='1:1' ? 'selected' : ''}>1:1 (Square)</option>
                <option value="16:9" ${curAsp==='16:9' ? 'selected' : ''}>16:9 (Widescreen)</option>
                <option value="9:16" ${curAsp==='9:16' ? 'selected' : ''}>9:16 (Vertical)</option>
            </select>

            <div class="flex gap-2 justify-end">
                <button id="editproj-cancel" class="px-4 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Cancel</button>
                <button id="editproj-save" class="px-4 py-1.5 text-sm rounded-full bg-white text-black">Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const resSel = overlay.querySelector('#editproj-res');
    const aspSel = overlay.querySelector('#editproj-aspect');
    const cancel = overlay.querySelector('#editproj-cancel');
    const saveBtn = overlay.querySelector('#editproj-save');

    cancel.onclick = () => overlay.remove();

    saveBtn.onclick = async () => {
        const chosenRes = resSel.value;
        const chosenAsp = aspSel.value;
        const changed = (chosenRes !== curRes || chosenAsp !== curAsp);
        overlay.remove();
        if (!changed) return;

        currentProject.resolution = chosenRes;
        currentProject.aspect_ratio = chosenAsp;
        await saveProjectToServer(currentProject);

        // Live update without full re-render of editor (to avoid resetting audio/playhead state)
        const label = document.getElementById('proj-res-aspect-label');
        if (label) {
            label.innerHTML = `${chosenRes} ${chosenAsp} <i class="fa-solid fa-edit text-[9px] ml-1 opacity-60"></i>`;
        }
        const previewEl = document.getElementById('project-preview');
        if (previewEl) {
            previewEl.style.aspectRatio = chosenAsp.replace(':', '/');
        }
        renderCues(); // re-compute thumb sizes, positions etc for new aspect
        const t = projectAudio ? projectAudio.currentTime : 0;
        updateProjectPreview(t);
        renderSidebarProjectList(); // in case
    };
}

function renderSidebarProjectList() {
    const listEl = document.getElementById('project-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!projects || projects.length === 0) {
        listEl.innerHTML = `<div class="text-[11px] text-zinc-500 px-2 py-1">No projects yet. Click + above.</div>`;
        return;
    }
    projects.slice().reverse().forEach(p => {  // newest first feel
        const div = document.createElement('div');
        div.className = `px-2 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-800 flex items-center gap-x-2 text-sm ${currentProject && currentProject.id === p.id ? 'bg-zinc-800 ring-1 ring-emerald-600/50' : ''}`;
        const cueCount = (p.cues || []).length;
        const audioLabel = p.audio_filename ? p.audio_filename.split('.').slice(0,-1).join('.') : 'no audio';
        const storyTag = (p.story && (p.story.scenes || []).length) ? ' • story' : '';
        div.innerHTML = `
            <i class="fa-solid fa-folder text-emerald-400 w-4"></i>
            <div class="flex-1 min-w-0">
                <div class="truncate">${p.name || 'Untitled'}</div>
                <div class="text-[10px] text-zinc-500 truncate">${audioLabel} • ${cueCount} cue${cueCount===1?'':'s'}${storyTag}</div>
            </div>
        `;
        div.onclick = () => {
            currentProject = p;
            currentView = 'project';
            const _cv = document.getElementById('chat-view');
            if (_cv) _cv.classList.add('hidden');
            const _hv = document.getElementById('home-view');
            if (_hv) {
                _hv.style.display = 'none';
                _hv.classList.add('hidden');
            }
            updateMainHeaderForView('project');
            renderSidebarProjectList();
            showProjectEditor();
        };
        listEl.appendChild(div);
    });
}

// ==================== CHAT (Ollama) helpers ====================
function parseOllamaThinking(text) {
    if (!text) return { thinking: null, content: text || '' };
    const m = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (m) {
        const thinking = m[1].trim();
        const content = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
        return { thinking, content: content || text };
    }
    return { thinking: null, content: text };
}

function appendChatMessage(role, content, thinking = null, attachmentName = null, tempId = null, pushToState = true) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    if (tempId) div.id = tempId;

    const safe = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    if (role === 'user') {
        div.innerHTML = `
            <div class="flex justify-end">
                <div class="max-w-[70%] bg-zinc-800 rounded-2xl px-4 py-2 text-sm">
                    ${attachmentName ? `<div class="text-[10px] text-emerald-400 mb-0.5">📄 ${safe(attachmentName)}</div>` : ''}
                    ${safe(content)}
                </div>
            </div>`;
    } else {
        let body = safe(content).replace(/\n/g, '<br>');
        if (thinking) {
            body = `
                <details class="mb-2" open>
                    <summary class="text-xs text-amber-400 cursor-pointer select-none">Thinking</summary>
                    <div class="mt-1 p-2 bg-zinc-950 rounded border border-zinc-800 text-[11px] text-zinc-400 whitespace-pre-wrap">${safe(thinking)}</div>
                </details>` + body;
        }
        div.innerHTML = `<div class="max-w-[85%] bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm">${body}</div>`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // only record on actual new messages (not re-renders from state)
    if (!tempId && (role === 'user' || role === 'assistant') && pushToState) {
        chatMessages.push({ role, content, thinking: thinking || null, attachmentName: attachmentName || null });
    }
}

function updateChatAttachmentUI() {
    const bar = document.getElementById('chat-attachment-bar');
    if (!bar) return;
    if (!currentChatAttachment) {
        bar.classList.add('hidden');
        bar.innerHTML = '';
        return;
    }
    bar.classList.remove('hidden');
    bar.innerHTML = `
        <div class="inline-flex items-center gap-x-2 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-0.5">
            <i class="fa-solid fa-file text-emerald-400"></i>
            <span class="truncate max-w-[220px]">${currentChatAttachment.name}</span>
            <button class="ml-1 text-zinc-400 hover:text-white" title="Remove attachment">×</button>
        </div>`;
    const x = bar.querySelector('button');
    if (x) x.onclick = () => {
        currentChatAttachment = null;
        updateChatAttachmentUI();
    };
}

function showChatDocumentUpload() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.txt,.md,.markdown,.json,.csv,text/*';
    inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result || '';
            currentChatAttachment = { name: f.name, content: String(text).slice(0, 24000) };
            updateChatAttachmentUI();
        };
        reader.readAsText(f);
    };
    inp.click();
}

async function handleChatSend() {
    const input = document.getElementById('prompt-input');
    if (!input) return;
    const prompt = input.value.trim();
    if (!prompt) return;

    const att = currentChatAttachment;

    // immediate user bubble
    appendChatMessage('user', prompt, null, att ? att.name : null);
    input.value = '';

    // temp assistant
    const tempId = 'chat-temp-' + Date.now();
    appendChatMessage('assistant', '…', null, null, tempId);

    // Rainbow animated border while awaiting chat response (and if chat triggers image/video gens)
    ensureRainbowBorderStyles();
    const generatingBars = document.querySelectorAll('.input-bar');
    generatingBars.forEach(b => b.classList.add('is-generating'));

    try {
        const historyForApi = chatMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content }));

        const payload = {
            prompt,
            history: historyForApi,
            attachment: att ? { name: att.name, content: att.content } : null
        };

        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        // remove temp
        const t = document.getElementById(tempId);
        if (t) t.remove();

        if (!res.ok || data.error || !data.response) {
            appendChatMessage('assistant', 'Error: ' + (data.error || 'No response from model'));
            return;
        }

        const { thinking, content } = parseOllamaThinking(data.response);
        appendChatMessage('assistant', content, thinking);

        // keep attachment for follow-up questions (user can x it)
    } catch (e) {
        const t = document.getElementById(tempId);
        if (t) t.remove();
        appendChatMessage('assistant', 'Error contacting Ollama: ' + (e.message || e));
    } finally {
        document.querySelectorAll('.input-bar').forEach(b => b.classList.remove('is-generating'));
    }
}

function clearCurrentChat() {
    chatMessages = [];
    currentChatAttachment = null;
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.innerHTML = '';
    updateChatAttachmentUI();
}

function updateMainHeaderForView(view) {
    // Mutate the global header (icon circle + h1) based on view.
    // Be defensive for early calls on startup.
    let h1 = document.querySelector('h1.text-2xl');
    if (!h1) {
        // Fallback: the only prominent h1 in the header area
        h1 = document.querySelector('header h1, .flex.items-center h1, h1');
    }
    if (!h1) return;

    const iconContainer = h1.parentElement ? h1.parentElement.previousElementSibling : null;
    const icon = iconContainer ? iconContainer.querySelector('i') : null;

    if (view === 'library') {
        h1.textContent = 'Library';
        if (icon) icon.className = 'fa-solid fa-th-large text-black text-2xl';
    } else if (view === 'chat') {
        h1.textContent = 'Chat';
        if (icon) icon.className = 'fa-solid fa-robot text-black text-2xl';
    } else if (view === 'home') {
        h1.textContent = 'Home';
        if (icon) icon.className = 'fa-solid fa-home text-black text-2xl';
    } else {
        // project or default
        h1.textContent = 'Pulse Image';
        if (icon) icon.className = 'fa-solid fa-bolt text-black text-2xl';
    }
}

function showChatView() {
    // Query elements once at the top to avoid redeclaration issues and for cleanliness
    const chatV = document.getElementById('chat-view');
    const bottomBar = document.getElementById('bottom-prompt-bar');
    const inp = document.getElementById('prompt-input');

    // If already in chat and the view is visible, just make sure UI is configured (no re-render that could dupe state)
    if (currentView === 'chat' && chatV && !chatV.classList.contains('hidden')) {
        // Re-apply bar config in case something reset it
        if (bottomBar) {
            const topRow = bottomBar.querySelector('.flex.items-center.gap-x-2.mb-3');
            if (topRow) {
                const modeGroup = topRow.querySelector('.bg-zinc-800');
                if (modeGroup) {
                    const kids = Array.from(modeGroup.children || []);
                    kids.forEach((k, i) => { if (i > 0) k.style.display = 'none'; });
                }
                topRow.querySelectorAll('#quick-options, .relative').forEach(el => el.style.display = 'none');
            }
        }
        if (inp) {
            inp.disabled = false;
            inp.placeholder = 'Ask the model anything... (use + for documents)';
        }
        return;
    }

    currentView = 'chat';

    cleanupLibraryFullHeight();

    // hide other main areas
    const editor = document.getElementById('project-editor');
    if (editor) editor.classList.add('hidden');
    const gen = document.getElementById('generations-container');
    if (gen) gen.style.display = 'none';
    const ph = document.getElementById('placeholder');
    if (ph) ph.style.display = 'none';
    const homeV = document.getElementById('home-view');
    if (homeV) {
        homeV.style.display = 'none';
        homeV.classList.add('hidden');
    }

    // show chat (reuse the chatV queried at the top of the function)
    if (chatV) chatV.classList.remove('hidden');

    // bottom bar for chat (keep cog + input row, hide modes/quick/aspect)
    if (bottomBar) bottomBar.style.display = '';

    const topRow = bottomBar ? bottomBar.querySelector('.flex.items-center.gap-x-2.mb-3') : null;
    if (topRow) {
        // keep the rounded mode group but only the first child (cog)
        const modeGroup = topRow.querySelector('.bg-zinc-800');
        if (modeGroup) {
            const kids = Array.from(modeGroup.children || []);
            kids.forEach((k, i) => { if (i > 0) k.style.display = 'none'; });
        }
        // hide quick options + aspect dropdown
        topRow.querySelectorAll('#quick-options, .relative').forEach(el => el.style.display = 'none');
    }

    // rewire main static + button (the one in the static .input-bar)
    setTimeout(() => {
        const mainBar = document.querySelector('.input-bar');
        if (mainBar) {
            const ir = mainBar.querySelector('.flex.items-center.gap-x-3');
            if (ir) {
                const pb = ir.querySelector('button');
                if (pb) pb.onclick = showChatDocumentUpload;
            }
        }
    }, 0);

    // input tweaks for chat
    if (inp) {
        inp.disabled = false;
        inp.placeholder = 'Ask the model anything... (use + for documents)';
    }
    const sendBtn = bottomBar ? bottomBar.querySelector('button[onclick*="sendPrompt"]') : null;
    if (sendBtn) sendBtn.classList.remove('opacity-40', 'cursor-not-allowed');

    // header
    updateMainHeaderForView('chat');

    // model badge
    const badge = document.getElementById('chat-model-badge');
    if (badge) {
        const mdl = (window._server_ollama_model || 'ollama');
        badge.textContent = mdl;
    }

    // initial empty state render if first time
    const msgs = document.getElementById('chat-messages');
    if (msgs && msgs.children.length === 0 && chatMessages.length === 0) {
        // nothing; user will type
    } else if (msgs) {
        // re-render from state (in case returning) — do NOT push to state again
        msgs.innerHTML = '';
        chatMessages.forEach(m => appendChatMessage(m.role, m.content, m.thinking, m.attachmentName, null, false));
    }

    updateChatAttachmentUI();
    renderSidebarProjectList();
}

function showHomeView() {
    currentView = 'home';
    currentProject = null;

    // Exit any active preview when going home
    if (currentPreviewAsset && typeof hidePreviewAndRestoreLibrary === 'function') {
        hidePreviewAndRestoreLibrary();
    }

    updateMainHeaderForView('home');

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.padding = '0';
        mainContent.style.overflow = 'hidden';
    }

    const placeholder = document.getElementById('placeholder');
    const genContainer = document.getElementById('generations-container');
    const projectEditor = document.getElementById('project-editor');
    const chatV = document.getElementById('chat-view');
    const homeV = document.getElementById('home-view');

    // On pure Home startup we don't even create the generations-container yet (see init + showLibraryView safety).
    // This prevents any library UI from flashing in.
    if (placeholder) placeholder.style.display = 'none';
    if (genContainer) genContainer.style.display = 'none';
    if (projectEditor) projectEditor.classList.add('hidden');
    if (chatV) chatV.classList.add('hidden');
    if (homeV) {
        homeV.style.display = 'flex';
        homeV.classList.remove('hidden');
    }

    // Hide bottom prompt bar for clean centered home view
    const bottomBar = document.getElementById('bottom-prompt-bar');
    if (bottomBar) bottomBar.style.display = 'none';

    // Clean up any project media etc (reuse some cleanup from library view)
    if (projectAudio) {
        try {
            projectAudio.pause();
            projectAudio.src = '';
            if (projectAudio.load) projectAudio.load();
        } catch (e) {}
        projectAudio = null;
    }
    // hide project editor explicitly
    if (projectEditor) projectEditor.classList.add('hidden');

    renderSidebarProjectList();
}

// View switching (library grid vs project timeline editor)
function showLibraryView() {
    currentView = 'library';
    currentProject = null;
    // If we are currently in an in-place preview (detail), the sidebar "Library" button
    // (or any call to show the plain library grid) should exit the preview and show the
    // masonry of cards. The explicit Back button inside the preview does the same via
    // hidePreviewAndRestoreLibrary. We do this early so the rest of the library setup
    // (including the children.length===0 render and no re-show of pane) produces the grid.
    if (currentPreviewAsset && typeof hidePreviewAndRestoreLibrary === 'function') {
        hidePreviewAndRestoreLibrary();
    }
    // Set header immediately (important for startup / first paint)
    updateMainHeaderForView('library');
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        // Remove Tailwind classes so the inspector/scroll tag never attaches to main-content.
        // (See the eager creation block in init() for the full explanation.)
        mainContent.classList.remove('overflow-y-auto', 'px-6', 'pb-6');
        mainContent.style.padding = '0';  // full width for the cards
        mainContent.style.overflow = 'hidden';  // prevent double scrollbar; only .library-scroller scrolls
    }
    let genContainer = document.getElementById('generations-container');
    if (genContainer) {
        genContainer.style.display = 'flex';
        genContainer.style.flexDirection = 'column';
        genContainer.style.height = '100%';
        genContainer.style.minHeight = '0';
        genContainer.style.overflow = 'hidden';
    }
    // When the Library button (or showLibraryView for any reason) is used, re-enforce the
    // scroller styles on any existing .library-scroller. This prevents the button from
    // "removing" the grey scrollbar state (e.g. if some other view setup touched ancestors).
    // We do this without clearing content, so it doesn't destroy the current masonry/fades.
    const existingScroller = genContainer ? genContainer.querySelector(':scope > .library-scroller') : null;
    if (existingScroller) {
        existingScroller.style.flex = '1 1 0%';
        existingScroller.style.minHeight = '0';
        existingScroller.style.height = '100%';
        existingScroller.style.overflow = 'auto';
        existingScroller.style.paddingTop = '0';
        existingScroller.style.paddingBottom = '0';
        existingScroller.style.position = 'relative';
        existingScroller.style.scrollbarWidth = 'thin';
        existingScroller.style.scrollbarColor = '#888 #333';
    }
    // Consolidated flex/height enforcement for genContainer (single clean block)
    if (genContainer) {
        genContainer.style.display = 'flex';
        genContainer.style.flexDirection = 'column';
        genContainer.style.height = '100%';
        genContainer.style.minHeight = '0';
        genContainer.style.overflow = 'hidden';
    }
    let placeholder = document.getElementById('placeholder');
    // Also ensure the early mainContent query for consistency with other view setups
    // (the padding/overflow was already handled just above)
    // Make sure header and prompt bar are "over" the faded full-height cards area
    const headerEl = document.querySelector('.flex.items-center.justify-between.px-6.py-4.border-b.border-zinc-800');
    if (headerEl) {
        headerEl.style.position = 'sticky';
        headerEl.style.top = '0';
        headerEl.style.zIndex = '40';
        headerEl.style.backgroundColor = '#09090b';  // solid so it covers the top fade
    }
    const promptEl = document.getElementById('bottom-prompt-bar');
    if (promptEl) {
        promptEl.style.position = 'sticky';
        promptEl.style.bottom = '0';
        promptEl.style.zIndex = '40';
        // The .input-bar inside already has its bg, but ensure the container covers
        promptEl.style.backgroundColor = 'transparent';
    }
    // Close any open overlays (cue dialog, image/video modals) that may contain autoplay/looping videos.
    // These would otherwise continue decoding + RefreshDriver work even after leaving the project page.
    ['image-modal', 'video-modal', 'cue-dialog-overlay'].forEach(id => {
        const m = document.getElementById(id);
        if (m) {
            m.querySelectorAll('video').forEach(v => {
                try { v.pause(); v.src = ''; if (v.load) v.load(); } catch (e) {}
            });
            m.remove();
        }
    });
    document.body.style.overflow = '';
    // Cleanup project media (audio + any video thumbs/preview in the hidden editor subtree)
    // These can keep decoding/playing in background and contribute to high CPU (per Firefox profiler: RefreshDriver tick from HTMLMediaElement events).
    if (projectAudio) {
        try {
            projectAudio.pause();
            projectAudio.src = '';
            if (projectAudio.load) projectAudio.load();
        } catch (e) {}
        projectAudio = null;
    }
    projectPeaks = [];
    projectDuration = 0;
    projectIsPlaying = false;
    waveIsPanning = false;
    waveViewStart = 0;
    waveViewEnd = 0;
    projectPlayheadEl = null;
    projectWaveCanvas = null;
    stopProjectRafPlayhead();
    stopVirtualPlayhead();
    _virtualCurrentTime = 0;
    _virtualBaseTime = 0;
    _virtualLastTs = 0;
    const editorForCleanup = document.getElementById('project-editor');
    if (editorForCleanup) {
        const vids = editorForCleanup.querySelectorAll('video');
        vids.forEach(v => {
            try {
                v.pause();
                v.src = '';
                if (v.load) v.load();
            } catch (e) {}
        });
        // Note: do not clear innerHTML here (renderProjectEditor will do full replace on re-enter)
    }
    // Clean up pan listeners to avoid accumulation across renders or after leaving project
    if (_projectPanMoveHandler) {
      document.removeEventListener('mousemove', _projectPanMoveHandler);
      document.removeEventListener('mouseup', _projectPanUpHandler);
      _projectPanMoveHandler = null;
      _projectPanUpHandler = null;
    }
    // hide project editor
    const editor = document.getElementById('project-editor');
    if (editor) editor.classList.add('hidden');
    // Show bottom prompt bar (library only)
    const bottomBar = document.getElementById('bottom-prompt-bar');
    if (bottomBar) bottomBar.style.display = '';
    // show generations container + placeholder logic
    if (genContainer) genContainer.style.display = '';
    if (placeholder && (!hasGenerated || (allAssets && allAssets.length === 0))) {
        placeholder.style.display = '';
    } else if (placeholder) {
        placeholder.style.display = 'none';
    }
    // update header
    const hdr = document.getElementById('header-project-name');
    if (hdr) hdr.classList.add('hidden');
    const actions = document.getElementById('header-project-actions');
    if (actions) {
      actions.innerHTML = '';
      actions.classList.add('hidden');
      actions.style.display = '';
    }
    // re-render sidebar selection
    renderSidebarProjectList();
    // ensure library is populated (idempotent-ish)
    const mc = document.getElementById('main-content');
    if (mc && !document.getElementById('generations-container')) {
        // safety: recreate if missing (e.g. after first project switch)
        const container = document.createElement('div');
        container.id = 'generations-container';
        if (placeholder) mc.insertBefore(container, placeholder);
        else mc.appendChild(container);
        genContainer = container;  // update the hoisted reference
        // If we had to recreate the container, also make sure main-content is still clean
        // (prevents the overflow-y-auto class from re-attaching the scroll tag).
        mc.classList.remove('overflow-y-auto', 'px-6', 'pb-6');
        mc.style.padding = '0';
        mc.style.overflow = 'hidden';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.minHeight = '0';
        container.style.overflow = 'hidden';
        // Create the library-scroller eagerly inside the fresh container (flex sized).
        const scroller = document.createElement('div');
        scroller.className = 'library-scroller';
        scroller.style.flex = '1 1 0%';
        scroller.style.minHeight = '0';
        scroller.style.height = '100%';
        scroller.style.overflow = 'auto';
        scroller.style.paddingTop = '0';
        scroller.style.paddingBottom = '0';
        scroller.style.position = 'relative';
        scroller.style.scrollbarWidth = 'thin';
        scroller.style.scrollbarColor = '#888 #333';
        container.appendChild(scroller);
    }
    // Reload library cards (and their autoplay videos) if the container was cleared (e.g. we unloaded videos when entering project to save background CPU).
    // This ensures videos are "reloaded" with fresh <video autoplay loop> elements when exiting the project screen.
    if (genContainer && genContainer.children.length === 0 && allAssets && allAssets.length > 0) {
        renderLibraryMasonry(allAssets, genContainer);
    } else if (genContainer && genContainer.querySelector(':scope > .library-scroller') && !genContainer.querySelector('#library-masonry') && allAssets && allAssets.length > 0) {
        // Container has the bare eagerly-created scroller but no masonry content yet — populate it.
        // renderLibraryMasonry will hit the reuse path (innerHTML='' on the scroller) and build inside it.
        renderLibraryMasonry(allAssets, genContainer);
    }
    // Re-enforce scroller styles after any potential render guard above. Clicking the Library
    // sidebar button calls showLibraryView(); this ensures the grey scrollbar + proper flex
    // sizing stays on .library-scroller even if no re-render was needed.
    const scrollerAfterGuards = genContainer ? genContainer.querySelector(':scope > .library-scroller') : null;
    if (scrollerAfterGuards) {
        scrollerAfterGuards.style.flex = '1 1 0%';
        scrollerAfterGuards.style.minHeight = '0';
        scrollerAfterGuards.style.height = '100%';
        scrollerAfterGuards.style.overflow = 'auto';
        scrollerAfterGuards.style.scrollbarWidth = 'thin';
        scrollerAfterGuards.style.scrollbarColor = '#888 #333';
    }
    // Make absolutely sure genContainer keeps the flex hosting setup after the guards too
    // (some code paths in showLibraryView set display etc. later).
    if (genContainer) {
        genContainer.style.display = 'flex';
        genContainer.style.flexDirection = 'column';
        genContainer.style.height = '100%';
        genContainer.style.minHeight = '0';
        genContainer.style.overflow = 'hidden';
    }
    // When activating library via the button (e.g. from Home), force a post-display layout pass.
    // This guarantees correct card positioning and that the scroller gets a real height so the
    // grey scrollbar appears (and the devtools scroll tag attaches to .library-scroller).
    if (currentView === 'library' && typeof applyLibraryMasonryLayout === 'function') {
        // === Stronger first-render height fix ===
        const doLayout = () => {
            const scroller = document.querySelector('.library-scroller');
            if (scroller) {
                // Calculate available height (viewport minus header + prompt bar)
                const header = document.querySelector('.flex.items-center.justify-between.px-6.py-4.border-b.border-zinc-800');
                const promptBar = document.getElementById('bottom-prompt-bar');

                const headerH = header ? header.offsetHeight : 60;
                const promptH = promptBar ? promptBar.offsetHeight : 80;

                const availableHeight = window.innerHeight - headerH - promptH;

                scroller.style.height = `${Math.max(availableHeight, 400)}px`;
                scroller.style.minHeight = '0';
                scroller.style.flex = 'none';
            }

            if (typeof applyLibraryMasonryLayout === 'function') {
                applyLibraryMasonryLayout();
            }
        };

        // Run twice for reliability on first render
        doLayout();
        requestAnimationFrame(() => {
            doLayout();
        });
    }
    // Chat hygiene + bar restore
    const chatV = document.getElementById('chat-view');
    if (chatV) chatV.classList.add('hidden');
    const homeV = document.getElementById('home-view');
    if (homeV) {
        homeV.style.display = 'none';
        homeV.classList.add('hidden');
    }
    // restore full bottom bar controls + main + handler + placeholder
    if (bottomBar) {
        const tr = bottomBar.querySelector('.flex.items-center.gap-x-2.mb-3');
        if (tr) {
            tr.querySelectorAll('#quick-options, .relative').forEach(el => el.style.display = '');
            const mg = tr.querySelector('.bg-zinc-800');
            if (mg) Array.from(mg.children || []).forEach(ch => ch.style.display = '');
        }
    }
    // Ensure the main prompt bar's visual mode (image/video button active class + quick-options content)
    // matches the currentMode variable. The visibility restore above only restores display,
    // not the mode selection state. This prevents UI showing "image" while currentMode is "video"
    // (causing 1 video to be generated instead of 4 images) after returning from project or chat.
    selectMode(currentMode);
    const aspectText = document.getElementById('aspect-ratio-text');
    if (aspectText) aspectText.innerText = currentAspectRatio;
    // Re-show in-place preview if one was active (e.g. after returning from project or chat).
    // This keeps the "detail view" state across view switches without losing the preview pane.
    if (currentPreviewAsset) {
      const scroller = document.querySelector('.library-scroller');
      if (scroller) scroller.style.display = 'none';
      const pane = document.getElementById('preview-pane');
      if (pane) {
        pane.style.display = '';
      } else if (typeof showPreviewForAsset === 'function') {
        // Re-create if the pane was lost (e.g. full DOM clear on project switch)
        showPreviewForAsset(currentPreviewAsset);
      }
      // Do NOT hide the main bottom prompt bar here: the in-place preview intentionally
      // keeps the library's bottom bar visible in the same position/size for rainbow + submit context.
    }
    // Only force-reset the + button to upload when we are NOT in an active in-place preview.
    // While preview is active, showPreviewForAsset (or its rewire) keeps + wired to showModifierPicker.
    if (!currentPreviewAsset) {
      setTimeout(() => {
          const mb = document.querySelector('.input-bar');
          if (mb) {
              const ir = mb.querySelector('.flex.items-center.gap-x-3');
              if (ir) {
                  const pb = ir.querySelector('button');
                  if (pb) pb.onclick = showAssetUpload;
              }
          }
      }, 0);
    }
    const _inp = document.getElementById('prompt-input');
    if (_inp) _inp.placeholder = 'Type to imagine';
    updateMainHeaderForView('library');
    // Density toggle button (appears in the mode group for the library view)
    setTimeout(() => {
        const topRow = document.querySelector('#bottom-prompt-bar .flex.items-center.gap-x-2.mb-3');
        if (topRow) {
            const modeGroup = topRow.querySelector('.bg-zinc-800');
            if (modeGroup) {
                let btn = document.getElementById('library-density-btn');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = 'library-density-btn';
                    btn.className = 'w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full ml-1';
                    btn.title = 'Toggle library density (full ↔ compact masonry)';
                    btn.innerHTML = '<i class="fa-solid fa-th"></i>';
                    btn.onclick = () => {
                        toggleLibraryDensity();
                        btn.innerHTML = (libraryDensity === 'compact')
                            ? '<i class="fa-solid fa-th-large"></i>'
                            : '<i class="fa-solid fa-th"></i>';
                        applyLibraryMasonryLayout();
                    };
                    modeGroup.appendChild(btn);
                }
            }
        }
    }, 30);
    // Apply columns (in case density or size changed)
    applyLibraryMasonryLayout();
    // Keep columns correct on resize while in library
    if (!window._libraryResizeBound) {
        window._libraryResizeBound = true;
        window.addEventListener('resize', () => {
            if (currentView === 'library') {
                applyLibraryMasonryLayout();
            }
        });
    }
}

async function showProjectEditor() {
    // Close any open overlays from previous project (or library) so their media doesn't leak across views.
    ['image-modal', 'video-modal', 'cue-dialog-overlay'].forEach(id => {
        const m = document.getElementById(id);
        if (m) {
            m.querySelectorAll('video').forEach(v => {
                try { v.pause(); v.src = ''; if (v.load) v.load(); } catch (e) {}
            });
            m.remove();
        }
    });
    document.body.style.overflow = '';

    // If we were in an in-place preview, hide it when entering project editor.
    if (currentPreviewAsset && typeof hidePreviewAndRestoreLibrary === 'function') {
      hidePreviewAndRestoreLibrary();
    }

    cleanupLibraryFullHeight();

    const editor = document.getElementById('project-editor');
    const genContainer = document.getElementById('generations-container');
    const placeholder = document.getElementById('placeholder');
    if (placeholder) placeholder.style.display = 'none';
    if (genContainer) genContainer.style.display = 'none';
    if (editor) editor.classList.remove('hidden');

    // Unload library video cards (they use <video autoplay loop muted> in createAssetCard).
    // Per Firefox profiler analysis (RefreshDriver tick dominated by media decode + dense timeupdate/progress/etc events from HTMLMediaElement), hidden autoplay videos continue working in background.
    // When the generations-container is hidden (display:none), we pause + clear src to unload.
    // Then we clear the container content so that on return to library (showLibraryView),
    // the "if (genContainer.children.length === 0)" block will re-populate with fresh
    // cards (reloading the videos with their autoplay behavior).
    if (genContainer) {
      const vids = genContainer.querySelectorAll('video');
      vids.forEach(v => {
        try {
          v.pause();
          v.src = '';
          if (v.load) v.load();
        } catch (e) {}
      });
      genContainer.innerHTML = '';
    }

    // Hide bottom prompt bar on project page (we don't use the main prompt here)
    const bottomBar = document.getElementById('bottom-prompt-bar');
    if (bottomBar) bottomBar.style.display = 'none';

    // header
    const hdr = document.getElementById('header-project-name');
    if (hdr) {
        hdr.textContent = currentProject ? currentProject.name : '';
        hdr.classList.remove('hidden');
    }
    const actions = document.getElementById('header-project-actions');
    if (actions) {
        actions.innerHTML = `
            <button onclick="showLibraryView()" class="px-3 py-1 text-xs rounded-full bg-zinc-800 hover:bg-zinc-700">Back to Library</button>
            <button onclick="deleteCurrentProject()" class="px-2 py-1 text-xs rounded-full bg-red-900/60 hover:bg-red-800 text-red-300">Delete</button>
        `;
        actions.classList.remove('hidden');
        actions.style.display = 'flex';
    }
    await renderProjectEditor();
}

// Project editor: waveform (half height) + clips strip (split rects for cue visuals) + custom scrollbar for zoom/pan.
// Play/pause/stop moved to right of preview; old transport seek + zoom toolbar removed.
async function renderProjectEditor() {
    const editor = document.getElementById('project-editor');
    if (!editor || !currentProject) return;

    // Ensure clean view state for this project (in case we switched projects without full library roundtrip)
    waveViewStart = 0;
    waveViewEnd = 0;
    waveIsPanning = false;

    // Backward compat for old projects: ensure resolution/aspect are set
    if (!currentProject.resolution) currentProject.resolution = currentResolution || '720p';
    if (!currentProject.aspect_ratio) currentProject.aspect_ratio = currentAspectRatio || '3:2';

    editor.innerHTML = `
        <div class="max-w-[1100px] mx-auto">
            <div class="flex items-center justify-between mb-3">
                <div>
                    <div class="text-sm text-zinc-400">PROJECT</div>
                    <div id="proj-name-editable" contenteditable="true" class="text-xl font-semibold outline-none border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 cursor-text">${currentProject.name}</div>
                    <div id="proj-res-aspect-label" class="text-[10px] text-emerald-400 flex items-center gap-x-1 hover:text-emerald-300" style="cursor:pointer" title="Click to change resolution and aspect ratio (affects new generations for cues and sizing of timeline visuals / preview)">
                        ${currentProject.resolution || '720p'} ${currentProject.aspect_ratio || '3:2'}
                        <i class="fa-solid fa-edit text-[9px] ml-1 opacity-60"></i>
                    </div>
                </div>
                <div class="flex items-center gap-x-2">
                    <button onclick="addAudioToCurrentProject()" class="px-3 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center gap-x-2">
                        <i class="fa-solid fa-music"></i>
                        <span>${currentProject.audio_filename ? 'Change audio' : 'Add audio track'}</span>
                    </button>
                    ${currentProject.audio_filename ? `<button onclick="removeAudioFromCurrentProject()" class="px-3 py-1.5 text-sm rounded-full bg-red-800 hover:bg-red-700 flex items-center gap-x-2" title="Remove audio track from project">
                        <i class="fa-solid fa-trash"></i>
                        <span>Remove audio</span>
                    </button>` : ''}
                    <button onclick="addCueAtPlayhead()" class="px-3 py-1.5 text-sm rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center gap-x-2">
                        <i class="fa-solid fa-map-marker-alt"></i>
                        <span>Add cue at playhead</span>
                    </button>
                    <button id="export-sequence-btn" onclick="exportProjectSequence()" class="px-3 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center gap-x-2">
                        <i class="fa-solid fa-file-archive"></i>
                        <span>Export Sequence (zip)</span>
                    </button>
                    <button onclick="showStoryMode()" class="px-3 py-1.5 text-sm rounded-full bg-emerald-700 hover:bg-emerald-600 flex items-center gap-x-2" title="High-level story workflow: describe story + characters with LoRAs, auto-generate scenes, images and videos, then apply to the timeline">
                        <i class="fa-solid fa-book-open"></i>
                        <span id="story-btn-label">Create Story</span>
                    </button>
                </div>
            </div>

            <!-- Preview + play/stop buttons to the right (no seek slider) -->
            <div class="mb-3">
                <div class="text-xs uppercase tracking-wider text-zinc-500 mb-1 px-1 flex items-center justify-between">
                    <span>Preview @ playhead</span>
                    <span id="project-preview-label" class="text-[10px] text-zinc-400 normal-case"></span>
                </div>
                <div class="flex items-start gap-x-3">
                    <div id="project-preview" class="w-full max-w-[420px] aspect-video bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner" style="flex-shrink:0;">
                        <div class="text-center text-zinc-500 text-sm">
                            <i class="fa-solid fa-eye text-3xl mb-2 opacity-50"></i>
                            <div>No media at current time</div>
                        </div>
                    </div>
                    <div class="flex flex-col gap-y-1.5 pt-2">
                        <button id="proj-play-btn" class="w-9 h-9 flex items-center justify-center rounded-full bg-white text-black" title="Play / Pause"><i class="fa-solid fa-play"></i></button>
                        <button id="proj-stop-btn" class="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs" title="Stop &amp; reset to start"><i class="fa-solid fa-stop"></i></button>
                        <button onclick="openProjectPreviewFullscreen()" class="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs" title="Fullscreen preview"><i class="fa-solid fa-expand"></i></button>
                        <div id="proj-time" class="font-mono text-[10px] tabular-nums text-zinc-400 mt-1">0:00 / 0:00</div>
                    </div>
                </div>
            </div>

            <!-- Timeline area: half-height waveform + clips strip (cue visuals as split rects) + scrollbar -->
            <div id="timeline-viz" class="relative bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden mb-1" style="max-width:1100px;">
                <!-- Waveform (halved height) -->
                <div id="wave-section" class="relative border-b border-zinc-800" style="height:70px;">
                    <canvas id="project-waveform" width="900" height="62" class="w-full h-full cursor-crosshair"></canvas>
                    <!-- cue markers + (local) overlays injected by renderCues -->
                    <div id="wave-overlays" class="absolute inset-0 pointer-events-auto cursor-crosshair"></div>
                </div>

                <!-- Clips strip: split rectangles for visuals. Each rect = segment starting at a cue's media. Delete/mute icons live inside the rects. -->
                <div id="clips-strip" class="relative bg-zinc-900 flex border-t border-zinc-700" style="height:120px;"></div>

                <!-- Playhead (spans wave + clips). Created/positioned by updateProjectPlayhead. -->
            </div>

            <!-- Custom scrollbar: full-width at 100% (no pan); drag body=pan, edges=zoom (shrink=zoom in); click bg= center view -->
            <div id="timeline-scrollbar" class="h-5 bg-zinc-900 border border-zinc-700 rounded-full relative mx-auto" style="max-width:1100px; cursor:pointer;" title="Drag middle to pan • Drag edges to zoom (shrink thumb = zoom in) • Click background to seek playhead • Scroll wheel (when mouse over waveform/clips/scrollbar) to zoom around playhead"></div>
        </div>
    `;

    // Load audio + waveform if present (must happen before wiring transport so projectAudio is ready)
    await initProjectAudioAndWaveform();

    // Derive effective projectDuration.
    // Priority / rule per user request: length of the story (from scenes) or length of the soundtrack, whichever is greater.
    // We also consider applied cue visuals for the on-timeline sequence length.
    // This makes play button + timeline appear for pure story projects (no audio, no cues yet).
    {
        let cueMax = 0;
        for (const c of (currentProject.cues || [])) {
            let end = (c.time || 0);
            if (c.video_id) {
                const asset = allAssets.find(a => a.id === c.video_id);
                let vdur = 6;
                if (asset && asset.metadata && typeof asset.metadata.duration === 'number' && asset.metadata.duration > 0) {
                    vdur = asset.metadata.duration;
                }
                end += Math.max(0.1, vdur - (c.video_start_offset || 0));
            } else if (c.selected_image_id) {
                end += 4; // default still duration
            }
            if (end > cueMax) cueMax = end;
        }

        let storyMax = 0;
        const st = currentProject.story;
        if (st) {
            if (typeof st.total_duration === 'number' && st.total_duration > 0) {
                storyMax = st.total_duration;
            } else if (Array.isArray(st.scenes)) {
                for (const sc of st.scenes) {
                    const end = (sc.start_time || 0) + (sc.duration || 0);
                    if (end > storyMax) storyMax = end;
                }
            }
        }

        const audioMax = (typeof currentProject.audio_duration === 'number' ? currentProject.audio_duration : 0) || 0;

        const effective = Math.max(cueMax, storyMax, audioMax);
        if (effective > 0) {
            if (!currentProject.audio_duration || currentProject.audio_duration < effective) {
                currentProject.audio_duration = effective;
            }
            projectDuration = Math.max(projectDuration || 0, effective);
        }
    }

    // Wire basic transport (listeners etc). Now projectAudio will be set if the project has audio.
    wireBasicProjectTransport();
    // Render cues (markers on wave) + clips strip
    renderCues();
    // Wire the new scrollbar (creates thumb/handles + drag listeners for pan/zoom)
    if (typeof wireTimelineScrollbar === 'function') {
        wireTimelineScrollbar();
    }

    // Wire wheel zoom on the entire timeline area (waveform, clips, scrollbar)
    // Zooms centered around the current playhead (not mouse position)
    if (typeof wireTimelineWheelZoom === 'function') {
        wireTimelineWheelZoom();
    }

    // set preview to project aspect
    const previewEl = document.getElementById('project-preview');
    if (previewEl && currentProject && currentProject.aspect_ratio) {
      previewEl.style.aspectRatio = currentProject.aspect_ratio.replace(':', '/');
    }

    // Ensure preview at top shows something for t=0 on open
    updateProjectPreview(0);

    // Ensure playhead is positioned on initial render
    const initialT = projectAudio ? projectAudio.currentTime || 0 : 0;
    updateProjectPlayhead(initialT);
    updateProjectTimeUI();

    // Editable project name
    const nameEl = document.getElementById('proj-name-editable');
    if (nameEl) {
        nameEl.onblur = async () => {
            const newName = nameEl.textContent.trim() || 'Untitled';
            if (currentProject && currentProject.name !== newName) {
                currentProject.name = newName;
                await saveProjectToServer(currentProject);
                renderSidebarProjectList();
                // also update header if visible
                const hdr = document.getElementById('header-project-name');
                if (hdr) hdr.textContent = newName;
            }
        };
        nameEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } };
    }

    // Make res/aspect clickable to change anytime (after project created)
    const resAspectEl = document.getElementById('proj-res-aspect-label');
    if (resAspectEl) {
        resAspectEl.onclick = editProjectSettings;
    }

    // Defensive: ensure bottom prompt is hidden while in project editor (re-renders can happen internally)
    if (currentView === 'project') {
        const bottomBar = document.getElementById('bottom-prompt-bar');
        if (bottomBar) bottomBar.style.display = 'none';
    }

    // Story button label reflects whether this project already has a story
    if (typeof updateStoryButtonLabel === 'function') updateStoryButtonLabel();
}

function wireBasicProjectTransport() {
    const playBtn = document.getElementById('proj-play-btn');
    const stopBtn = document.getElementById('proj-stop-btn');
    if (!playBtn || !currentProject) return;

    const hasRealAudio = !!projectAudio && !!currentProject.audio_filename;
    const canPlayback = projectDuration > 0;

    // Always attach handlers so that if audio becomes available (or after re-init) it works.
    // The handlers themselves guard on projectAudio.
    playBtn.onclick = () => {
        if (hasRealAudio && projectAudio) {
            // Real audio playback
            if (projectAudio.paused) {
                projectAudio.play().catch(console.error);
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                projectIsPlaying = true;
                startProjectRafPlayhead(); // smooth playhead via rAF
                updateProjectPreview(projectAudio.currentTime);
            } else {
                projectAudio.pause();
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                projectIsPlaying = false;
                stopProjectRafPlayhead();
            }
            return;
        }

        // Virtual / no-audio playback (using projectDuration from story or stored duration)
        if (canPlayback) {
            if (projectIsPlaying) {
                projectIsPlaying = false;
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                stopVirtualPlayhead();
            } else {
                projectIsPlaying = true;
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                startVirtualPlayhead();
            }
            return;
        }

        // Fallback: try to init real audio if filename present but no projectAudio yet
        if (!projectAudio && currentProject.audio_filename) {
            initProjectAudioAndWaveform().then(() => {
                if (projectAudio) {
                    projectAudio.play().catch(console.error);
                    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    projectIsPlaying = true;
                    startProjectRafPlayhead();
                    updateProjectPreview(projectAudio.currentTime || 0);
                }
            });
        }
    };

    stopBtn.onclick = () => {
        if (projectAudio) {
            projectAudio.pause();
            projectAudio.currentTime = 0;
        }
        projectIsPlaying = false;
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        stopProjectRafPlayhead();
        stopVirtualPlayhead();
        _virtualCurrentTime = 0;
        updateProjectPlayhead(0);
        updateProjectPreview(0);
        updateProjectTimeUI();
    };

    // Visual state: enable play/pause/stop as long as we have a duration to play over (even without audio file)
    // hasRealAudio is for real audio element; canPlayback allows synthetic playback for story visuals
    if (!canPlayback) {
        playBtn.disabled = true;
        stopBtn.disabled = true;
        playBtn.classList.add('opacity-50');
    } else {
        playBtn.disabled = false;
        stopBtn.disabled = false;
        playBtn.classList.remove('opacity-50');
    }
}

async function initProjectAudioAndWaveform() {
    const waveCanvas = document.getElementById('project-waveform');
    projectWaveCanvas = waveCanvas;
    if (!currentProject || !currentProject.audio_filename || !waveCanvas) {
        return;
    }
    const url = `/audio/${currentProject.audio_filename}`;
    // audio element
    if (projectAudio) {
        projectAudio.pause();
    }
    projectAudio = new Audio(url);
    projectAudio.preload = 'metadata';

    projectAudio.ondurationchange = () => {
        projectDuration = projectAudio.duration || currentProject.audio_duration || 0;
        if (currentProject.audio_duration == null) {
            currentProject.audio_duration = projectDuration;
            saveProjectToServer(currentProject);
        }
        updateProjectTimeUI();
        // Ensure view covers the (possibly updated) duration
        if (!waveViewEnd || waveViewEnd > projectDuration) {
          resetWaveView();
        }
        applyWaveViewChange();
    };

    projectAudio.ontimeupdate = () => {
        if (projectDuration > 0) {
            // Playhead during active playback is driven by rAF (smoother vsync, less work in the dense timeupdate handler per profiler analysis: RefreshDriver + constant timeupdate/progress/etc from media elements were #1 CPU).
            // Still update here when paused (for seek scrubbing while stopped) or if no rAF running.
            if (!projectIsPlaying || !_projectRafId) {
              updateProjectPlayhead(projectAudio.currentTime);
            }
            const now = Date.now();
            if (now - (projectAudio._lastUi || 0) > 50) {  // throttle heavier work (preview may touch/recreate video elems + time label) to ~20fps
                projectAudio._lastUi = now;
                updateProjectPreview(projectAudio.currentTime);
                updateProjectTimeUI();
            }
        }
    };

    projectAudio.onended = () => {
      projectIsPlaying = false;
      stopProjectRafPlayhead();
      const pb = document.getElementById('proj-play-btn');
      if (pb) pb.innerHTML = '<i class="fa-solid fa-play"></i>';
      // leave playhead at end; stop will reset if desired
    };

    // initial duration if cached
    if (currentProject.audio_duration) {
        projectDuration = currentProject.audio_duration;
    }

    // decode for peaks (non-blocking)
    try {
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(buf);
        projectPeaks = computePeaks(decoded, 480);
        projectDuration = decoded.duration;
        resetWaveView();
        if (waveCanvas) drawProjectWaveform(waveCanvas, projectPeaks, projectDuration);
    } catch (e) {
        console.warn('Waveform decode failed (will use time ruler only)', e);
        resetWaveView();
        if (waveCanvas) drawProjectWaveform(waveCanvas, [], projectDuration || 60);
    }

    // click on waveform area (overlays, since it covers the canvas) to seek — snap to nearest frame bar
    const waveOverlays = document.getElementById('wave-overlays');
    if (waveOverlays) {
        waveOverlays.onclick = (ev) => {
            // If a marker was clicked, its handler stops propagation, so we only get here for background
            if (!projectDuration) return;
            const rect = waveOverlays.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const v = getWaveView();
            let t = v.start + (x / rect.width) * v.visibleDur;
            t = snapToFrame(t);
            if (projectAudio) projectAudio.currentTime = Math.max(0, Math.min(projectDuration - 0.05, t));
            updateProjectPlayhead(t);
            updateProjectPreview(t);
            updateProjectTimeUI();
        };
    }

    // Also attach to canvas as fallback (in case overlays not covering in some renders)
    if (waveCanvas) {
        waveCanvas.onclick = (ev) => {
            if (!projectDuration) return;
            const rect = waveCanvas.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const v = getWaveView();
            let t = v.start + (x / rect.width) * v.visibleDur;
            t = snapToFrame(t);
            if (projectAudio) projectAudio.currentTime = Math.max(0, Math.min(projectDuration - 0.05, t));
            updateProjectPlayhead(t);
            updateProjectPreview(t);
            updateProjectTimeUI();
        };
    }

    updateProjectTimeUI();
    // (zoom label removed; scrollbar now owns zoom visualization + pan)

    // Note: pan (drag) + wheel zoom removed from waveform. All zoom/pan now lives in the scrollbar below the clips strip.
    // We still support click-to-seek on the waveform canvas (see above).
    updateScrollThumb();
}

function computePeaks(audioBuffer, numPeaks = 480) {
    const channel = audioBuffer.getChannelData(0);
    const len = channel.length;
    const bucket = Math.max(1, Math.floor(len / numPeaks));
    const peaks = [];
    for (let i = 0; i < numPeaks; i++) {
        let min = 1, max = -1;
        const start = i * bucket;
        for (let j = 0; j < bucket; j++) {
            const v = channel[start + j] || 0;
            if (v < min) min = v;
            if (v > max) max = v;
        }
        peaks.push({ min, max });
    }
    return peaks;
}

function drawProjectWaveform(canvas, peaks, dur) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#111113';
    ctx.fillRect(0, 0, w, h);

    const v = getWaveView();
    const fullDur = dur || v.fullDur || 60;

    // Time ruler at the TOP — enhanced with seconds + 24fps frame markers
    const rulerH = 20;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, w, rulerH);

    if (v.visibleDur > 0) {
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '16px monospace';
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 1;

        const startT = v.start;
        const endT = v.end;
        const visDur = v.visibleDur;

        // Iterate over whole seconds visible
        const firstWholeSec = Math.floor(startT);
        const lastWholeSec = Math.ceil(endT);

        for (let sec = firstWholeSec; sec <= lastWholeSec; sec++) {
            // Second marker + label (at exact second = frame 00)
            if (sec >= startT && sec <= endT) {
                const vp = ((sec - startT) / visDur) * 100;
                const x = (vp / 100) * w;

                // taller tick for the second
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, rulerH * 0.85);
                ctx.stroke();

                // label at second (frame 00)
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                const label = `${m}:${s.toString().padStart(2,'0')}`;
                ctx.fillText(label, x + 2, 14);
            }

            // 23 smaller frame markers between this second and the next (frames 01 to 23)
            // Only draw them if they would be reasonably spaced
            const framePixelWidth = (1 / FRAME_RATE / visDur) * w;
            const drawFrames = framePixelWidth > 1.5; // avoid total clutter when zoomed way out

            if (drawFrames) {
                for (let f = 1; f < FRAME_RATE; f++) {
                    const ft = sec + (f / FRAME_RATE);
                    if (ft < startT || ft > endT) continue;

                    const fvp = ((ft - startT) / visDur) * 100;
                    const fx = (fvp / 100) * w;

                    // small tick for frame
                    ctx.beginPath();
                    ctx.moveTo(fx, rulerH * 0.35);
                    ctx.lineTo(fx, rulerH * 0.7);
                    ctx.stroke();
                }
            }
        }
    }

    // Waveform peaks area (below the ruler)
    const waveTop = rulerH + 1;
    const waveH = h - waveTop;

    // center line for the waveform
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, waveTop + waveH / 2);
    ctx.lineTo(w, waveTop + waveH / 2);
    ctx.stroke();

    if (!peaks || peaks.length === 0) {
        ctx.fillStyle = '#3f3f46';
        ctx.fillText('Waveform unavailable', 12, waveTop + 10);
    } else {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;

        // Map view to peak indices
        const peaksPerSec = peaks.length / fullDur;
        let startIdx = Math.floor(v.start * peaksPerSec);
        let endIdx = Math.ceil(v.end * peaksPerSec);
        startIdx = Math.max(0, Math.min(startIdx, peaks.length - 1));
        endIdx = Math.max(startIdx + 1, Math.min(endIdx, peaks.length));

        const visiblePeaks = peaks.slice(startIdx, endIdx);
        if (visiblePeaks.length > 0) {
            const step = w / visiblePeaks.length;
            const yMid = waveTop + waveH / 2;
            const yScale = (waveH / 2 - 1);
            for (let i = 0; i < visiblePeaks.length; i++) {
                const x = i * step;
                const p = visiblePeaks[i];
                const y1 = yMid + (p.min * yScale);
                const y2 = yMid + (p.max * yScale);
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
            }
        }
    }
}

// --- Zoom / pan helpers (call after changing waveViewStart/End) ---
function applyWaveViewChange() {
  const canvas = document.getElementById('project-waveform');
  if (canvas && projectPeaks && projectDuration) {
    drawProjectWaveform(canvas, projectPeaks, projectDuration);
  }
  renderCues(); // also refreshes clips strip
  const t = projectAudio ? projectAudio.currentTime : 0;
  updateProjectPlayhead(t);
  updateScrollThumb();
}

function updateProjectPlayhead(time) {
    // Always takes absolute time in seconds (zoom/pan aware). 0 means t=0s.
    // The playhead now lives in #timeline-viz and spans the (halved) waveform + clips strip.
    const container = document.getElementById('timeline-viz');
    if (!container) return;
    let ph = document.getElementById('project-playhead');
    if (!ph) {
        ph = document.createElement('div');
        ph.id = 'project-playhead';
        ph.style.position = 'absolute';
        ph.style.top = '0';
        ph.style.bottom = '0';
        ph.style.width = '2px';
        ph.style.background = '#f43f5e';
        ph.style.pointerEvents = 'auto';
        ph.style.cursor = 'ew-resize';
        ph.style.zIndex = '50';
        container.appendChild(ph);
    }
    const t = (typeof time === 'number' ? time : 0);
    const vp = timeToViewPct(t);
    if (vp == null) {
        ph.style.display = 'none';
        return;
    }
    ph.style.display = '';
    ph.style.left = `${vp}%`;
    projectPlayheadEl = ph;

    // Sync virtual time for no-audio playback resume
    if (!projectAudio) {
        _virtualCurrentTime = t;
    }

    // Make the red playhead draggable left/right to seek/position (works across wave+clips)
    if (ph) {
        ph.style.pointerEvents = 'auto';
        ph.style.cursor = 'ew-resize';
        ph.onmousedown = function(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            const cont = document.getElementById('timeline-viz');
            if (!cont || !projectDuration) return;
            const rect = cont.getBoundingClientRect();
            const v = getWaveView();
            const onMove = (e) => {
                const now = Date.now();
                if (now - (onMove._last || 0) < 33) return; // throttle ~30fps during drag
                onMove._last = now;
                const x = e.clientX - rect.left;
                let t = v.start + (x / rect.width) * v.visibleDur;
                t = snapToFrame( Math.max(0, Math.min(projectDuration, t)) );
                if (projectAudio) projectAudio.currentTime = t;
                updateProjectPlayhead(t);
                if (!projectAudio && projectIsPlaying) {
                    // pause virtual playback while user is scrubbing
                    projectIsPlaying = false;
                    const pb = document.getElementById('proj-play-btn');
                    if (pb) pb.innerHTML = '<i class="fa-solid fa-play"></i>';
                    stopVirtualPlayhead();
                }
                updateProjectPreview(t);
            };
            const onUp = (e) => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                const x = e.clientX - rect.left;
                let t = v.start + (x / rect.width) * v.visibleDur;
                t = snapToFrame( Math.max(0, Math.min(projectDuration, t)) );
                if (projectAudio) projectAudio.currentTime = t;
                updateProjectPlayhead(t);
                if (!projectAudio && projectIsPlaying) {
                    // pause virtual playback while user is scrubbing
                    projectIsPlaying = false;
                    const pb = document.getElementById('proj-play-btn');
                    if (pb) pb.innerHTML = '<i class="fa-solid fa-play"></i>';
                    stopVirtualPlayhead();
                }
                updateProjectPreview(t);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp, {once: true});
        };
    }
}

function updateProjectTimeUI() {
    const timeEl = document.getElementById('proj-time');
    if (!timeEl) return;
    const cur = getCurrentPlaybackTime();
    const tot = projectDuration || 0;
    timeEl.textContent = `${formatTimeWithFrames(cur)} / ${formatTimeWithFrames(tot)}`;
    // (no seek slider anymore)
}

function updateProjectPreview(currentTime) {
    const pane = document.getElementById('project-preview');
    const label = document.getElementById('project-preview-label');
    if (!pane || !currentProject) return;
    const t = currentTime || 0;
    if (label) label.textContent = formatTimeWithFrames(t);

    // find active cue: last cue with time <= t
    const cues = (currentProject.cues || []).slice().sort((a,b) => a.time - b.time);
    let active = null;
    for (const c of cues) {
        if ((c.time || 0) <= t) active = c;
        else break;
    }
    if (!active) {
        pane.innerHTML = `<div class="text-center text-zinc-500 text-sm p-4">No cue at this time<br><span class="text-[10px]">Add cues on the waveform</span></div>`;
        return;
    }

    // prefer video if present and t is within its (offset-adjusted) duration window
    const vidAsset = active.video_id ? allAssets.find(a => a.id === active.video_id) : null;
    const vidDur = (vidAsset && vidAsset.metadata && vidAsset.metadata.duration) ? vidAsset.metadata.duration : 6;
    const offset = (active && typeof active.video_start_offset === 'number') ? Math.max(0, active.video_start_offset) : 0;
    const effectiveDur = Math.max(0.1, vidDur - offset);
    const inVidWindow = vidAsset && (t >= (active.time || 0)) && (t < (active.time || 0) + effectiveDur);

    if (inVidWindow && vidAsset) {
        const vurl = `/videos/${vidAsset.filename}`;
        let v = pane.querySelector('video');
        const shouldMuteVid = !!(active && active.mute_audio);
        const localT = t - (active.time || 0);
        const targetVidTime = Math.max(0, offset + localT);
        if (!v || v.dataset.src !== vurl) {
            pane.innerHTML = `<video data-src="${vurl}" src="${vurl}" class="w-full h-full object-cover" playsinline></video>`;
            v = pane.querySelector('video');
            v.muted = shouldMuteVid;
            // Drive preview video from the authoritative clock (real audio or virtual playback time)
            // This makes scene videos play in sync even when there is no project audio track.
            v.currentTime = targetVidTime;
            const isActivelyPlaying = projectIsPlaying || (projectAudio && !projectAudio.paused);
            if (isActivelyPlaying) {
                v.play().catch(()=>{});
                const onFrame = () => {
                  if (v && !v.paused) v.requestVideoFrameCallback(onFrame);
                };
                v.requestVideoFrameCallback(onFrame);
            } else {
                v.pause();
            }
            v.onclick = () => openVideoModal(vurl, vidAsset.filename);
        } else {
            // already have it, just keep time in sync (light)
            if (Math.abs(v.currentTime - targetVidTime) > 0.4) {
                v.currentTime = targetVidTime;
            }
            v.muted = shouldMuteVid;
            const isActivelyPlaying = projectIsPlaying || (projectAudio && !projectAudio.paused);
            if (isActivelyPlaying) {
                v.play().catch(()=>{});
                const onFrame = () => {
                  if (v && !v.paused) v.requestVideoFrameCallback(onFrame);
                };
                v.requestVideoFrameCallback(onFrame);
            } else {
                v.pause();
            }
        }
        return;
    }

    // fallback to selected image (or first candidate)
    const imgId = active.selected_image_id || (active.candidates && active.candidates[0]);
    const imgAsset = imgId ? allAssets.find(a => a.id === imgId) : null;
    if (imgAsset && imgAsset.filename) {
        const iurl = `/images/${imgAsset.filename}`;
        let im = pane.querySelector('img');
        if (!im || im.src.indexOf(imgAsset.filename) === -1) {
            pane.innerHTML = `<img src="${iurl}" class="w-full h-full object-cover" />`;
            im = pane.querySelector('img');
            im.onclick = () => openImageModal(iurl, imgAsset.filename, imgAsset);
        }
        // if we had a video before, it was replaced above
    } else {
        pane.innerHTML = `<div class="text-center text-zinc-500 text-sm p-4">Cue @ ${(active.time||0).toFixed(1)}s<br><span class="text-[10px]">No image/video yet</span></div>`;
    }
}

function renderCueMarkers() {
    const overlays = document.getElementById('wave-overlays');
    if (!overlays || !currentProject) return;
    overlays.innerHTML = '';
    overlays.style.pointerEvents = 'auto';
    const cues = (currentProject.cues || []).slice().sort((a, b) => a.time - b.time);
    const dur = projectDuration || 1;
    const container = document.getElementById('wave-section') || document.getElementById('timeline-viz');
    if (dur <= 0) return;

    const v = getWaveView();
    cues.forEach((c) => {
        const vp = timeToViewPct(c.time || 0);
        if (vp == null) return;

        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.left = `${vp}%`;
        marker.style.top = '18px';
        marker.style.transform = 'translateX(-50%)';
        marker.style.width = '14px';
        marker.style.height = '14px';
        marker.style.background = c.selected_image_id || (c.candidates && c.candidates.length) ? '#10b981' : '#f43f5e';
        marker.style.border = '2px solid #111113';
        marker.style.borderRadius = '9999px';
        marker.style.cursor = 'pointer';
        marker.style.zIndex = '30';
        marker.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.3)';
        const cueLabelText = c.name || formatTimeWithFrames(c.time || 0);
        let extra = c.mute_audio ? ' (video audio muted)' : '';
        if (c.video_id && (c.video_start_offset || 0) > 0.001) {
          extra += ` (video @${formatTimeWithFrames(c.video_start_offset || 0)})`;
        }
        marker.title = `${cueLabelText} — click for cue dialog${extra}`;
        marker.onclick = (e) => {
            if (marker._dragged || marker._suppressDialog) {
                delete marker._dragged;
                delete marker._suppressDialog;
                e.stopImmediatePropagation();
                return;
            }
            e.stopPropagation();
            if (projectAudio) projectAudio.currentTime = (c.time || 0);
            updateProjectPlayhead((c.time || 0));
            updateProjectPreview((c.time || 0));
            openCueDialog(c);
        };

        // Drag to reposition cue (update time on release) — snap to frame
        marker.style.cursor = 'ew-resize';
        marker.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            if (marker._dragged) delete marker._dragged;
            const cont = document.getElementById('wave-section') || document.getElementById('timeline-viz');
            if (!cont || !projectDuration) return;
            const rect = cont.getBoundingClientRect();
            const v = getWaveView();
            marker._dragStartX = ev.clientX;
            marker._dragged = false;
            const onMove = (e) => {
                marker._dragged = true;
                const x = e.clientX - rect.left;
                let nt = v.start + (x / rect.width) * v.visibleDur;
                nt = Math.max(0, Math.min(projectDuration, nt));
                nt = snapToFrame(nt);
                const tvp = timeToViewPct(nt);
                if (tvp != null) {
                    marker.style.left = tvp + '%';
                }
            };
            const onUp = (e) => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (marker._dragged && Math.abs(e.clientX - marker._dragStartX) > 4) {
                    const x = e.clientX - rect.left;
                    let ft = v.start + (x / rect.width) * v.visibleDur;
                    ft = Math.max(0, Math.min(projectDuration, ft));
                    ft = snapToFrame(ft);
                    c.time = ft;
                    marker._suppressDialog = true;
                    saveProjectToServer(currentProject).then(() => {
                        renderCues();
                    });
                }
                delete marker._dragStartX;
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp, { once: true });
        });
        overlays.appendChild(marker);
    });
}

function renderCues() {
    renderCueMarkers();
    if (typeof renderTimelineClips === 'function') {
        renderTimelineClips();
    }
}

function renderTimelineClips() {
    const strip = document.getElementById('clips-strip');
    if (!strip || !currentProject) return;
    strip.innerHTML = '';
    strip.style.pointerEvents = 'auto';

    if (!projectDuration || projectDuration <= 0) {
        strip.innerHTML = `<div class="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">Add an audio track (button above) to enable the waveform + clip timeline.</div>`;
        return;
    }

    const v = getWaveView();
    const cues = (currentProject.cues || []).slice().sort((a, b) => (a.time || 0) - (b.time || 0));

    // Build split points inside the current view (cues act as splitters)
    const viewCues = cues.filter(c => (c.time || 0) >= v.start - 0.001 && (c.time || 0) <= v.end + 0.001);
    let times = [v.start];
    viewCues.forEach(c => times.push(c.time || 0));
    times.push(v.end);
    // dedup + sort
    times = times.filter((t, i, a) => i === 0 || Math.abs(t - a[i - 1]) > 0.0005).sort((a, b) => a - b);

    const arStr = (currentProject && currentProject.aspect_ratio) || '3:2';
    const [aw, ah] = arStr.split(':').map(n => parseFloat(n) || 1);

    // Measure the strip once for clamping narrow media boxes (getBoundingClientRect may be 0 right after innerHTML clear)
    const stripWidth = strip.offsetWidth || strip.getBoundingClientRect().width || 900;

    for (let i = 0; i < times.length - 1; i++) {
        const sT = times[i];
        const eT = times[i + 1];
        const segDur = Math.max(0.01, eT - sT);
        const pct = (segDur / v.visibleDur) * 100;

        const seg = document.createElement('div');
        seg.className = 'h-full flex-shrink-0 border-r-2 border-zinc-500 bg-zinc-950 overflow-hidden relative';
        seg.style.flex = `0 0 ${pct}%`;
        seg.style.minWidth = (pct < 3) ? '6px' : '12px'; // tiny cues still get a sliver

        if (i === 0) {
            // Ensure the leftmost rectangle also has a clear left edge
            seg.style.borderLeft = '2px solid #52525b';
        }

        // Owning cue = the one whose media is active starting at sT (may be before view start)
        let owning = null;
        for (let j = cues.length - 1; j >= 0; j--) {
            if ((cues[j].time || 0) <= sT + 0.0005) { owning = cues[j]; break; }
        }
        const cueHere = cues.find(c => Math.abs((c.time || 0) - sT) < 0.0005);

        // Visual (image or video still at offset) for the owning cue
        // Place a properly aspect-ratio sized box on the LEFT of the rectangle so the full image/video is visible without cropping.
        const visualId = owning ? (owning.video_id || owning.selected_image_id) : null;
        const asset = visualId ? allAssets.find(a => a.id === visualId) : null;
        const isVideoAsset = !!(asset && (asset.type === 'video' || (asset.filename || '').toLowerCase().endsWith('.mp4')));

        // Media box height: 50% bigger cue images
        const mediaH = 63;
        let mediaW = Math.round(mediaH * (aw / ah));
        // Don't let it overflow a narrow segment
        const segWidthPx = (parseFloat(seg.style.flex || '0') / 100) * stripWidth;
        if (segWidthPx > 0) {
            mediaW = Math.min(mediaW, Math.max(20, segWidthPx - 6));
        }

        const mediaBox = document.createElement('div');
        mediaBox.style.position = 'absolute';
        mediaBox.style.left = '2px';
        mediaBox.style.top = '2px';
        mediaBox.style.width = `${mediaW}px`;
        mediaBox.style.height = `${mediaH}px`;
        mediaBox.style.background = '#18181b';
        mediaBox.style.border = '1px solid #3f3f46';
        mediaBox.style.borderRadius = '3px';
        mediaBox.style.overflow = 'hidden';
        mediaBox.style.boxShadow = '0 1px 3px rgba(0,0,0,0.35)';

        if (asset && asset.filename) {
            if (isVideoAsset) {
                const ve = document.createElement('video');
                ve.src = `/videos/${asset.filename}`;
                ve.style.width = '100%';
                ve.style.height = '100%';
                ve.style.objectFit = 'contain';
                ve.muted = true;
                ve.playsInline = true;
                ve.autoplay = false;
                const off = (owning && typeof owning.video_start_offset === 'number') ? Math.max(0, owning.video_start_offset) : 0;
                const applyOff = () => {
                    try {
                        const maxT = (ve.duration || 6) - 0.05;
                        ve.currentTime = Math.max(0, Math.min(off, maxT));
                    } catch (e) {}
                };
                ve.onloadedmetadata = applyOff;
                ve.oncanplay = applyOff;
                setTimeout(applyOff, 40);
                ve.pause();
                // Hover to preview motion
                mediaBox.addEventListener('mouseenter', () => { ve.play().catch(() => {}); });
                mediaBox.addEventListener('mouseleave', () => {
                    ve.pause();
                    try {
                        const maxT = (ve.duration || 6) - 0.05;
                        ve.currentTime = Math.max(0, Math.min(off, maxT));
                    } catch (e) {}
                });
                mediaBox.appendChild(ve);
            } else {
                const img = document.createElement('img');
                img.src = `/images/${asset.filename}`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                mediaBox.appendChild(img);
            }
        } else {
            mediaBox.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#71717a;text-align:center;line-height:1.1;">no media</div>`;
        }

        // Clicking the media box opens the asset (if present) or the cue dialog
        mediaBox.onclick = (ev) => {
            ev.stopPropagation();
            if (visualId) {
                openAssetFromCue(visualId);
            } else if (cueHere || owning) {
                openCueDialog(cueHere || owning);
            }
        };
        seg.appendChild(mediaBox);

        // Delete cue and mute icons placed *under* the image (preferred layout)
        if (cueHere) {
            const actionsTop = 2 + mediaH + 1;
            const actions = document.createElement('div');
            actions.style.position = 'absolute';
            actions.style.left = '2px';
            actions.style.top = `${actionsTop}px`;
            actions.style.display = 'flex';
            actions.style.alignItems = 'center';
            actions.style.gap = '3px';
            actions.style.zIndex = '10';

            const delBtn = document.createElement('button');
            delBtn.title = 'Delete cue';
            delBtn.className = 'text-red-400 hover:bg-red-900/60 px-1 rounded text-[11px]';
            delBtn.innerHTML = '<i class="fa-solid fa-trash fa-xs"></i>';
            delBtn.onclick = (e) => { e.stopPropagation(); deleteCue(cueHere); };
            actions.appendChild(delBtn);

            if (cueHere.mute_audio) {
                const mi = document.createElement('i');
                mi.className = 'fa-solid fa-volume-mute text-red-400';
                mi.style.fontSize = '10px';
                mi.title = 'video audio muted for this cue';
                actions.appendChild(mi);
            }
            seg.appendChild(actions);
        }

        // Small cue name label at bottom of the rect (for the cue that *starts* here if present)
        const labelCue = cueHere || owning;
        if (labelCue && (labelCue.name || labelCue.time != null)) {
            const nl = document.createElement('div');
            nl.className = 'absolute bottom-0 left-0 right-0 text-[16px] bg-black/50 text-center text-zinc-300 truncate px-0.5 leading-tight';
            nl.textContent = labelCue.name || `t=${(labelCue.time || 0).toFixed(1)}s`;
            seg.appendChild(nl);
        }

        // Click on the rect (background or label) seeks to seg start + opens cue dialog for the governing cue
        seg.onclick = (e) => {
            // ignore clicks that hit the icons or visual (visual has its own)
            if (e.target.closest('button') || e.target.closest('video') || e.target.closest('img')) return;
            const targetCue = cueHere || owning;
            if (projectAudio) projectAudio.currentTime = Math.max(0, Math.min(projectDuration - 0.01, sT));
            updateProjectPlayhead(sT);
            updateProjectPreview(sT);
            if (targetCue) openCueDialog(targetCue);
        };

        strip.appendChild(seg);
    }
}

function updateScrollThumb() {
    const cont = document.getElementById('timeline-scrollbar');
    const thumb = document.getElementById('sb-thumb');
    if (!cont || !thumb || !projectDuration || projectDuration <= 0) return;
    const v = getWaveView();
    const leftPct = Math.max(0, Math.min(100, (v.start / projectDuration) * 100));
    const wPct = Math.max(0.5, Math.min(100, (v.visibleDur / projectDuration) * 100));
    thumb.style.left = `${leftPct}%`;
    thumb.style.width = `${wPct}%`;
    // Visual cue when at (or very near) 100% zoom: full bar, pan disabled by style
    if (wPct >= 99.5) {
        thumb.style.opacity = '0.6';
        thumb.style.cursor = 'default';
    } else {
        thumb.style.opacity = '0.85';
        thumb.style.cursor = 'grab';
    }
}

function wireTimelineScrollbar() {
    const cont = document.getElementById('timeline-scrollbar');
    if (!cont || !projectDuration) return;

    // Ensure thumb exists (created in renderProjectEditor HTML)
    let thumb = document.getElementById('sb-thumb');
    if (!thumb) {
        thumb = document.createElement('div');
        thumb.id = 'sb-thumb';
        thumb.className = 'absolute top-0.5 bottom-0.5 bg-emerald-500/70 rounded-full';
        thumb.style.left = '0%';
        thumb.style.width = '100%';
        // left/right edge handles (thin, high-contrast for grab)
        const left = document.createElement('div');
        left.id = 'sb-left';
        left.className = 'absolute left-0 top-1/2 -translate-y-1/2 w-3 h-4 bg-white/80 rounded cursor-col-resize';
        thumb.appendChild(left);
        const right = document.createElement('div');
        right.id = 'sb-right';
        right.className = 'absolute right-0 top-1/2 -translate-y-1/2 w-3 h-4 bg-white/80 rounded cursor-col-resize';
        thumb.appendChild(right);
        cont.appendChild(thumb);
    }
    const leftH = document.getElementById('sb-left') || thumb;
    const rightH = document.getElementById('sb-right') || thumb;

    // Cleanup previous listeners (from last renderProjectEditor)
    if (_sbMoveHandler) {
        document.removeEventListener('mousemove', _sbMoveHandler);
        document.removeEventListener('mouseup', _sbUpHandler);
    }

    let dragMode = null; // 'pan' | 'left' | 'right'
    let startClientX = 0;
    let startStart = 0;
    let startEnd = 0;

    const getMouseT = (clientX) => {
        const rect = cont.getBoundingClientRect();
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        return (x / rect.width) * projectDuration;
    };

    const onDown = (mode) => (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!projectDuration) return;
        dragMode = mode;
        startClientX = ev.clientX;
        const v = getWaveView();
        startStart = v.start;
        startEnd = v.end;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp, { once: true });
    };

    const onMove = (ev) => {
        if (!dragMode || !projectDuration) return;
        const mouseT = getMouseT(ev.clientX);
        const v = getWaveView();
        const vis = Math.max(0.2, startEnd - startStart);

        if (dragMode === 'left') {
            let ns = Math.max(0, Math.min(mouseT, startEnd - 0.2));
            waveViewStart = ns;
            waveViewEnd = startEnd;
        } else if (dragMode === 'right') {
            let ne = Math.max(startStart + 0.2, Math.min(mouseT, projectDuration));
            waveViewStart = startStart;
            waveViewEnd = ne;
        } else if (dragMode === 'pan') {
            const startMouseT = getMouseT(startClientX);
            const dT = mouseT - startMouseT;
            let ns = Math.max(0, Math.min(startStart + dT, projectDuration - vis));
            waveViewStart = ns;
            waveViewEnd = ns + vis;
        }

        // During continuous scrollbar drag/zoom: only refresh cheap parts (waveform + cue dots + playhead).
        // Do NOT re-render the timeline clip images on every tiny movement — only on drag end.
        const canvas = document.getElementById('project-waveform');
        if (canvas && projectPeaks && projectDuration) {
            drawProjectWaveform(canvas, projectPeaks, projectDuration);
        }
        renderCueMarkers();
        const t = projectAudio ? projectAudio.currentTime : 0;
        updateProjectPlayhead(t);
        updateScrollThumb();
    };

    const onUp = () => {
        dragMode = null;
        document.removeEventListener('mousemove', onMove);
        // Refresh the (more expensive) clip images + markers only once when the user finishes adjusting the scrollbar/zoom.
        renderTimelineClips();
        renderCueMarkers();
        const t = projectAudio ? projectAudio.currentTime : 0;
        updateProjectPlayhead(t);
        updateScrollThumb();
    };

    // Attach
    leftH.onmousedown = onDown('left');
    rightH.onmousedown = onDown('right');
    thumb.onmousedown = (ev) => {
        // only body pan if not on an edge handle
        if (ev.target.id === 'sb-left' || ev.target.id === 'sb-right') return;
        onDown('pan')(ev);
    };

    // Direct click on the timebar (background, not on the thumb) sets the playhead position
    // (snapped to frame). If the target time is outside the current visible waveform,
    // automatically adjust the view so the playhead ends up around 50% in the window.
    cont.onmousedown = (ev) => {
        if (ev.target === thumb || ev.target.closest('#sb-thumb')) return; // thumb drag is for panning view only
        if (!projectDuration) return;
        const mt = getMouseT(ev.clientX);
        const snappedT = snapToFrame(mt);

        // Set playhead
        if (projectAudio) {
            projectAudio.currentTime = Math.max(0, Math.min(projectDuration - 0.01, snappedT));
        }

        const v = getWaveView();
        if (snappedT < v.start || snappedT > v.end) {
            // Bring into view centered at ~50%
            let vis = v.visibleDur;
            let newStart = snappedT - (vis * 0.5);
            let newEnd = newStart + vis;

            if (newEnd > projectDuration) {
                newEnd = projectDuration;
                newStart = Math.max(0, newEnd - vis);
            }
            if (newStart < 0) newStart = 0;

            waveViewStart = newStart;
            waveViewEnd = newEnd;
        }

        applyWaveViewChange();
        updateProjectPlayhead(snappedT);
        updateProjectPreview(snappedT);
        updateProjectTimeUI();
    };

    _sbMoveHandler = onMove;
    _sbUpHandler = onUp;

    // initial position
    updateScrollThumb();
}

function wireTimelineWheelZoom() {
  const viz = document.getElementById('timeline-viz');
  if (!viz || !projectDuration) return;

  // Clean up previous listener if re-wiring (though new DOM element on full re-render)
  if (viz._wheelHandler) {
    viz.removeEventListener('wheel', viz._wheelHandler);
  }

  const handler = (ev) => {
    ev.preventDefault();
    if (!projectDuration) return;

    // Zoom in/out centered around the current playhead position
    let playT = projectAudio ? projectAudio.currentTime : 0;
    playT = snapToFrame(playT);

    const v = getWaveView();
    const factor = (ev.deltaY > 0) ? 1.35 : 0.74; // out / in
    let newDur = v.visibleDur * factor;
    newDur = Math.max(0.2, Math.min(projectDuration, newDur));

    if (Math.abs(newDur - v.visibleDur) < 0.001) {
      return; // already at full 100% zoom out (or min zoom in) and wheel is trying to go further; ignore to avoid re-rendering the clip images unnecessarily (prevents flicker when nothing actually changes)
    }

    waveViewStart = Math.max(0, playT - newDur / 2);
    waveViewEnd = waveViewStart + newDur;

    if (waveViewEnd > projectDuration) {
      waveViewEnd = projectDuration;
      waveViewStart = Math.max(0, waveViewEnd - newDur);
    }

    applyWaveViewChange();
  };

  viz.addEventListener('wheel', handler, { passive: false });
  viz._wheelHandler = handler;
}

function focusCueInspector(cue) {
    // Deprecated bottom inspector; use the nice modal dialog instead
    openCueDialog(cue);
}

function closeCueInspector() {
    // no-op, dialogs are self closing
}

function closeCueInspector() {
    const insp = document.getElementById('project-inspector');
    if (insp) insp.classList.add('hidden');
}

function saveCuePrompt(cueId) {
    if (!currentProject) return;
    const ta = document.getElementById('cue-prompt-edit');
    const c = (currentProject.cues || []).find(x => x.id === cueId);
    if (c && ta) {
        c.prompt = ta.value.trim();
        saveProjectToServer(currentProject);
        renderCues();
    }
}

function deleteCue(cue) {
    if (!currentProject || !cue) return;
    if (!confirm('Delete this cue?')) return;
    currentProject.cues = (currentProject.cues || []).filter(c => c.id !== cue.id);
    saveProjectToServer(currentProject);
    renderCues();
    closeCueInspector();
}
function deleteCueById(id) {
    const c = (currentProject.cues || []).find(x => x.id === id);
    if (c) deleteCue(c);
}

function generateImagesForCue(cue, targetContainer = null) {
    if (!cue || !currentProject) return;
    if (!cue.prompt || !cue.prompt.trim()) {
        const p = prompt('Prompt for the 4 images at this cue?', 'a beautiful scene');
        if (!p) return;
        cue.prompt = p.trim();
        saveProjectToServer(currentProject);
    }

    const dur = projectDuration || 1;
    const fullPct = ( (cue.time||0) / dur ) * 100;
    const vp = timeToViewPct(cue.time || 0);
    const usePct = (vp != null ? vp : fullPct);

    let slotParent = null;
    let isDialogTarget = !!targetContainer;
    let slots = [];
    if (targetContainer) {
        slotParent = targetContainer;
    } else {
        slotParent = null; // will not append visible slots for timeline
    }

    // Create 4 live gen slots (visible only for dialog target; hidden for background/timeline to avoid showing 4 under wave)
    const slotRow = document.createElement('div');
    if (isDialogTarget) {
        slotRow.style.position = 'relative';
        slotRow.style.display = 'flex';
        slotRow.style.flexWrap = 'wrap';
        slotRow.style.gap = '6px';
        slotRow.style.justifyContent = 'center';
        slotRow.style.zIndex = '1';
        const arStr = currentProject && currentProject.aspect_ratio ? currentProject.aspect_ratio : '3:2';
        const [aw, ah] = arStr.split(':').map(n => parseFloat(n) || 1);
        const candAspect = aw / ah;
        const baseW = 82;
        const baseH = Math.round(baseW / candAspect);
        const pFont = '11px';
        for (let i = 0; i < 4; i++) {
            const s = document.createElement('div');
            s.style.width = baseW + 'px';
            s.style.height = baseH + 'px';
            s.style.background = '#18181b';
            s.style.border = '1px solid #3f3f46';
            s.style.borderRadius = '4px';
            s.style.overflow = 'hidden';
            s.style.position = 'relative';
            s.innerHTML = `
                <div class="absolute inset-0 bg-[radial-gradient(#444_1px,transparent_1px)] bg-[length:3px_3px] opacity-40"></div>
                <div class="w-full h-full flex flex-col items-center justify-center">
                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <div class="progress-text text-[${pFont}] text-emerald-400 mt-0.5 font-mono">0%</div>
                </div>
            `;
            slotRow.appendChild(s);
            slots.push(s);
        }
        slotParent.appendChild(slotRow);
    } else {
        // hidden slots for event processing (no visible generating 4 under waveform)
        slotRow.style.display = 'none';
        for (let i = 0; i < 4; i++) {
            const s = document.createElement('div');
            slotRow.appendChild(s);
            slots.push(s);
        }
        // append offscreen so updates work
        slotRow.style.position = 'absolute';
        slotRow.style.left = '-9999px';
        document.body.appendChild(slotRow);
    }

    // now stream 4 images (reuse the /generate/stream + event shape exactly)
    const prompt = cue.prompt;
    // Prefer project-specific settings captured at project creation (or current if missing for old projects)
    const resolution = (currentProject && currentProject.resolution) || currentResolution || '720p';
    const aspect = (currentProject && currentProject.aspect_ratio) || currentAspectRatio || '3:2';
    const count = 4;

    (async () => {
        const generated = [];
        try {
            const body = {
                prompt,
                resolution,
                aspect_ratio: aspect,
                mode: 'image',
                count,
                image_model: currentImageModel,
                qwen_turbo: qwenTurbo
            };
            if (currentImageModel === 'schnell') {
              const cueLora = (cue && cue.lora_name) || currentLora;
              if (cueLora) body.lora_name = cueLora;
            }
            const resp = await fetch('/generate/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const reader = resp.body.getReader();
            const dec = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = dec.decode(value);
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    let evt;
                    try { evt = JSON.parse(line.slice(6)); } catch { continue; }
                    const idx = evt.index || 0;
                    if (idx >= 4 || !slots[idx]) continue;

                    if (evt.type === 'progress') {
                        const pt = slots[idx].querySelector('.progress-text');
                        if (pt) pt.textContent = `${evt.percent || 0}%`;
                    }
                    if (evt.type === 'image_ready') {
                        const fn = evt.local_filename;
                        generated[idx] = fn;
                        slots[idx].innerHTML = `<img src="/images/${fn}" class="w-full h-full object-cover" />`;
                        slots[idx].dataset.filename = fn;
                    }
                    if (evt.type === 'error') {
                        slots[idx].innerHTML = `<div class="text-red-400 text-[8px] text-center p-0.5">err</div>`;
                    }
                }
            }
        } catch (e) {
            console.error('Cue gen stream failed', e);
            slotRow.innerHTML = `<div class="text-red-400 text-[10px]">Gen failed</div>`;
            const clearSec = (typeof window._failed_gen_clear_seconds === 'number' && window._failed_gen_clear_seconds > 0 ? window._failed_gen_clear_seconds : 600);
            setTimeout(() => slotRow.remove(), clearSec * 1000);
            return;
        }

        // save the ones we got (like main perform post-stream)
        const savedIds = [];
        for (const fn of generated) {
            if (!fn) continue;
            try {
                const saveRes = await saveGenerationToServer({
                    prompt: cue.prompt,
                    filename: fn,
                    type: 'image',
                    aspect_ratio: aspect,
                    width: 0,
                    height: 0,
                    parent_id: null,
                    derived_from: []
                });
                const newA = {
                    id: saveRes.id,
                    type: 'image',
                    prompt: cue.prompt,
                    filename: fn,
                    width: 0, height: 0,
                    aspect_ratio: aspect,
                    parent_id: null,
                    derived_from: [],
                    favorite: false
                };
                if (!allAssets.some(a => a.id === newA.id)) allAssets.push(newA);
                savedIds.push(newA.id);
            } catch (e) { console.error('save cue image', e); }
        }

        // assign to cue
        if (savedIds.length) {
            cue.candidates = savedIds;
            cue.selected_image_id = null;
        }
        await saveProjectToServer(currentProject);

        if (isDialogTarget) {
            // For dialog: keep the 4 images visible in the bigger target area.
            // Make them clickable to pick one (sets selected, updates timeline, closes dialog)
            slots.forEach((s, idx) => {
                const aid = savedIds[idx];
                if (!aid || !s) return;
                s.style.cursor = 'pointer';
                s.style.border = '2px solid #10b981';
                s.onclick = (e) => {
                    e.stopPropagation();
                    pickImageForCue(cue, aid);
                    // do NOT close dialog (user may want to generate video next)
                    renderCues();
                    // refresh the chosen box in the still-open dialog
                    const currentDlg = document.getElementById('cue-dialog-overlay');
                    if (currentDlg) {
                        const ch = currentDlg.querySelector('#dlg-chosen-media');
                        if (ch) {
                            ch.innerHTML = '';
                            const asset = allAssets.find(a => a.id === aid);
                            if (asset) {
                                const isV = asset.type === 'video' || (asset.filename || '').toLowerCase().endsWith('.mp4');
                                const projAr2 = currentProject && currentProject.aspect_ratio ? currentProject.aspect_ratio : '3:2';
                                ch.style.aspectRatio = projAr2.replace(':', '/');
                                if (isV) {
                                    const mutedAttr = (cue && cue.mute_audio) ? 'muted ' : '';
                                    ch.innerHTML = `<video src="/videos/${asset.filename}" class="w-full h-full object-cover" autoplay loop ${mutedAttr}playsinline></video>`;
                                    const v = ch.querySelector('video');
                                    if (v) {
                                        if (cue) v.muted = !!cue.mute_audio;
                                        const off = (cue && cue.video_start_offset) ? cue.video_start_offset : 0;
                                        const applyOff = () => { try { v.currentTime = Math.max(0, off); } catch (e) {} };
                                        v.onloadedmetadata = applyOff;
                                        applyOff();
                                        v.onclick = () => openVideoModal(`/videos/${asset.filename}`, asset.filename);
                                    }
                                } else {
                                    ch.innerHTML = `<img src="/images/${asset.filename}" class="w-full h-full object-cover" />`;
                                    const im = ch.querySelector('img');
                                    if (im) im.onclick = () => openImageModal(`/images/${asset.filename}`, asset.filename, asset);
                                }
                            }
                        }
                    }
                };
            });
            rebuildChildrenMap();
            renderCues(); // refresh clips strip (and markers)
        } else {
            // cleanup temp slots + redraw real thumbs for timeline
            slotRow.remove();
            rebuildChildrenMap();
            renderCues();
        }
    })();
}

function generateImagesForCueById(id) {
    const c = (currentProject.cues || []).find(x => x.id === id);
    if (c) generateImagesForCue(c);
}

function regenerateCueImages(cue) {
    if (!cue) return;
    cue.candidates = [];
    cue.selected_image_id = null;
    saveProjectToServer(currentProject);
    renderCues();
    generateImagesForCue(cue);
}
function regenerateCueImagesById(id) {
    const c = (currentProject.cues || []).find(x => x.id === id);
    if (c) regenerateCueImages(c);
}

function pickImageForCue(cue, assetId) {
    if (!cue || !assetId) return;
    cue.selected_image_id = assetId;
    cue.candidates = []; // remove the other 3 from timeline view
    saveProjectToServer(currentProject);
    renderCues();
    // also update preview if near this time
    if (projectAudio) updateProjectPreview(projectAudio.currentTime);
    // immediately update cue dialog chosen area if the dialog is still open
    refreshOpenCueDialogChosen(cue);
}

function renderCueChosenMedia(cue, chosenDiv, offsetControlsEl = null, offsetInputEl = null) {
    if (!chosenDiv || !cue) return;
    chosenDiv.innerHTML = '';
    const vidId = cue.video_id;
    const imgId = cue.selected_image_id;
    const idToShow = vidId || imgId;
    let isV = false;
    if (!idToShow) {
        chosenDiv.innerHTML = `<div class="text-center text-zinc-500 text-sm p-4">No image or video selected yet for this cue.<br>Generate or pick above.</div>`;
    } else {
        const asset = allAssets.find(a => a.id === idToShow);
        if (!asset || !asset.filename) {
            chosenDiv.innerHTML = `<div class="text-center text-zinc-500 text-sm p-4">Media not found in library.</div>`;
        } else {
            isV = asset.type === 'video' || (asset.filename || '').toLowerCase().endsWith('.mp4');
            if (isV) {
                const mutedAttr = cue.mute_audio ? 'muted ' : '';
                chosenDiv.innerHTML = `<video src="/videos/${asset.filename}" class="max-h-[280px] w-full object-contain" autoplay loop ${mutedAttr}playsinline controls></video>`;
                const vidEl = chosenDiv.querySelector('video');
                if (vidEl) {
                    vidEl.muted = !!cue.mute_audio;
                    const off = (cue.video_start_offset || 0);
                    const applyChosenOffset = () => {
                        try {
                            vidEl.currentTime = Math.max(0, off);
                        } catch (e) { /* ignore */ }
                    };
                    vidEl.onloadedmetadata = applyChosenOffset;
                    applyChosenOffset();
                    vidEl.onclick = () => openVideoModal(`/videos/${asset.filename}`, asset.filename);
                }
            } else {
                chosenDiv.innerHTML = `<img src="/images/${asset.filename}" class="max-h-[280px] w-full object-contain cursor-pointer" />`;
                const imgEl = chosenDiv.querySelector('img');
                if (imgEl) imgEl.onclick = () => openImageModal(`/images/${asset.filename}`, asset.filename, asset);
            }
        }
    }
    if (idToShow) {
        chosenDiv.style.position = 'relative';
        const oldBadge = chosenDiv.querySelector('.cue-selected-badge');
        if (oldBadge) oldBadge.remove();
        const badge = document.createElement('div');
        badge.className = 'cue-selected-badge absolute top-1 left-1 text-[8px] bg-emerald-600 text-white px-1 rounded-sm';
        badge.textContent = 'selected';
        chosenDiv.appendChild(badge);
    }
    if (offsetControlsEl) offsetControlsEl.style.display = isV ? '' : 'none';
    if (offsetInputEl) {
        offsetInputEl.disabled = !isV;
        offsetInputEl.value = ((isV ? (cue.video_start_offset || 0) : 0)).toFixed(2);
    }
}

function refreshOpenCueDialogChosen(cue) {
    const cueDlg = document.getElementById('cue-dialog-overlay');
    if (!cueDlg || !cue) return;
    const chDiv = cueDlg.querySelector('#dlg-chosen-media');
    const oc = cueDlg.querySelector('#dlg-video-offset-controls');
    const oi = cueDlg.querySelector('#dlg-video-offset');
    if (chDiv) {
        renderCueChosenMedia(cue, chDiv, oc, oi);
    }
}

function useExistingForCueById(cueId) {
    const cue = (currentProject.cues || []).find(x => x.id === cueId);
    if (!cue) return;
    // reuse/adapt the existing picker (images only)
    showCueAssetPicker(cue, 'image');
}

async function showCueAssetPicker(cue, assetType = 'both') {
    // assetType: 'image' | 'video' | 'both'
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 z-[400] flex items-center justify-center';
    const titleType = assetType === 'image' ? 'image' : assetType === 'video' ? 'video' : 'image or video';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-4 w-full max-w-2xl mx-4 max-h-[70vh] flex flex-col" onclick="event.stopImmediatePropagation()">
            <div class="flex justify-between mb-2">
                <div class="text-sm font-medium">Choose existing ${titleType} for cue @ ${(cue.time||0).toFixed(1)}s</div>
                <button class="text-xl leading-none px-2" onclick="this.closest('.fixed').remove()">×</button>
            </div>
            <div id="cue-picker-grid" class="flex-1 overflow-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-1 bg-zinc-950 rounded"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    const grid = overlay.querySelector('#cue-picker-grid');

    let assets = (allAssets || []).filter(a => {
        const isAud = a.type === 'audio' || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(a.filename||'');
        if (isAud) return false;
        const isVid = a.type === 'video' || (a.filename||'').toLowerCase().endsWith('.mp4');
        if (assetType === 'image') return !isVid;
        if (assetType === 'video') return isVid;
        return true; // both
    }).sort((a,b) => new Date(b.created||0) - new Date(a.created||0));

    if (assets.length === 0) {
        const msgType = assetType === 'image' ? 'images' : assetType === 'video' ? 'videos' : 'images or videos';
        grid.innerHTML = `<div class="col-span-full text-center text-xs text-zinc-500 py-8">No ${msgType} in library yet.</div>`;
        return;
    }
    assets.forEach(asset => {
        const isVideo = asset.type === 'video' || (asset.filename||'').toLowerCase().endsWith('.mp4');
        const card = document.createElement('div');
        card.className = 'aspect-square bg-zinc-800 rounded overflow-hidden border border-zinc-700 cursor-pointer relative';
        if (isVideo) {
            const vurl = `/videos/${asset.filename}`;
            card.innerHTML = `
                <video src="${vurl}" class="w-full h-full object-cover" autoplay loop muted playsinline></video>
                <div class="absolute bottom-0 right-0 bg-black/70 text-[8px] px-1 text-white">video</div>
            `;
        } else {
            const url = asset.filename ? `/images/${asset.filename}` : '';
            card.innerHTML = url ? `<img src="${url}" class="w-full h-full object-cover" />` : `<div class="w-full h-full flex items-center justify-center text-xs">img</div>`;
        }
        card.onclick = () => {
            overlay.remove();
            if (isVideo) {
                // Assign existing video directly to the cue position
                cue.video_id = asset.id;
                cue.video_start_offset = 0; // reset offset for newly selected video
                // Optionally clear image if user wants pure video at this head; we keep image if present so user can still gen from it later
                saveProjectToServer(currentProject).then(() => {
                    renderCues();
                    updateProjectPreview(projectAudio ? projectAudio.currentTime : (cue.time || 0));
                    refreshOpenCueDialogChosen(cue);
                });
            } else {
                pickImageForCue(cue, asset.id);
            }
        };
        grid.appendChild(card);
    });
}

function generateVideoForCue(cue, overridePrompt = null) {
    if (!cue || !cue.selected_image_id || !currentProject) {
        alert('Select an image for the cue first (generate or use existing).');
        return;
    }
    const selAsset = allAssets.find(a => a.id === cue.selected_image_id);
    if (!selAsset || !selAsset.filename) {
        alert('Selected image asset not found in library.');
        return;
    }

    // Ask for video prompt (default to cue prompt) + duration
    const defaultVprompt = (cue.prompt || selAsset.prompt || 'cinematic motion') + ', smooth camera, music sync feel';
    let vprompt = overridePrompt || prompt('Video prompt (motion description)?', defaultVprompt);
    if (!vprompt) return;
    vprompt = vprompt.trim();

    const durStr = prompt('Video duration (seconds)? 1 / 6 / 10 / 20 / 30', '6');
    const duration = parseInt(durStr, 10) || 6;

    const overlays = document.getElementById('wave-overlays');
    const container = document.getElementById('wave-section') || document.getElementById('timeline-viz');
    if (!overlays || !container) return; // slots under wave are legacy; main visuals now in clips-strip

    const dur = projectDuration || 1;
    const fullPct = ((cue.time || 0) / dur) * 100;
    const vp = timeToViewPct(cue.time || 0);
    const usePct = (vp != null ? vp : fullPct);

    // 1 live video gen slot (small)
    const slot = document.createElement('div');
    slot.style.position = 'absolute';
    slot.style.left = `${usePct}%`;
    // Position temp gen slot (legacy; main per-cue visuals are now in the clips strip)
    slot.style.top = '125px';
    slot.style.transform = 'translateX(-50%)';
    slot.style.width = '64px';
    slot.style.height = '36px';
    slot.style.background = '#111';
    slot.style.border = '1px solid #3f3f46';
    slot.style.borderRadius = '4px';
    slot.style.overflow = 'hidden';
    slot.style.zIndex = '40';
    slot.innerHTML = `
        <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
            <div class="text-center">
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div class="progress-text text-[9px] text-emerald-400 mt-0.5 font-mono">0%</div>
            </div>
        </div>
    `;
    slot.dataset.cueVideoGen = cue.id;
    overlays.appendChild(slot);

    (async () => {
        let videoFn = null;
        try {
            const body = {
                prompt: vprompt,
                resolution: (currentProject && currentProject.resolution) || currentResolution || '720p',
                aspect_ratio: selAsset.aspect_ratio || (currentProject && currentProject.aspect_ratio) || currentAspectRatio || '3:2',
                mode: 'video',
                duration,
                count: 1,
                source_image: selAsset.filename,
                // pass the project music track so ia2v (ltx image+audio) is used for reactive clip
                modifier_audio: currentProject.audio_filename || undefined,
                image_model: currentImageModel,
                i2i_model: currentI2IModel,
                qwen_turbo: qwenTurbo
            };
            const resp = await fetch('/generate/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const reader = resp.body.getReader();
            const dec = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = dec.decode(value);
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
                    if (evt.type === 'progress') {
                        const pt = slot.querySelector('.progress-text');
                        if (pt) pt.textContent = `${evt.percent || 0}%`;
                    }
                    if (evt.type === 'video_ready') {
                        videoFn = evt.local_filename;
                        const vurl = `/videos/${videoFn}`;
                        slot.innerHTML = `
                            <video src="${vurl}" class="w-full h-full object-cover" autoplay loop muted playsinline></video>
                            <div class="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-1">${duration}s</div>
                        `;
                        slot.dataset.filename = videoFn;
                    }
                    if (evt.type === 'error') {
                        slot.innerHTML = `<div class="text-red-400 text-[9px] p-1">video err</div>`;
                    }
                }
            }
        } catch (e) {
            console.error('Cue video stream', e);
            slot.remove();
            return;
        }

        if (!videoFn) { slot.remove(); return; }

        // save the video (link parent to the cue's selected image for lineage/badges/Related)
        let savedId = null;
        try {
            const saveRes = await saveGenerationToServer({
                prompt: vprompt,
                filename: videoFn,
                type: 'video',
                aspect_ratio: selAsset.aspect_ratio || '3:2',
                width: 0,
                height: 0,
                duration,
                parent_id: cue.selected_image_id,
                derived_from: cue.selected_image_id ? [cue.selected_image_id] : []
            });
            savedId = saveRes.id;
            const newV = {
                id: savedId,
                type: 'video',
                prompt: vprompt,
                filename: videoFn,
                width: 0, height: 0,
                aspect_ratio: selAsset.aspect_ratio || '3:2',
                parent_id: cue.selected_image_id,
                derived_from: cue.selected_image_id ? [cue.selected_image_id] : [],
                metadata: { duration },
                favorite: false
            };
            if (!allAssets.some(a => a.id === savedId)) allAssets.push(newV);
        } catch (e) { console.error('save cue video', e); }

        if (savedId) {
            cue.video_id = savedId;
            cue.video_start_offset = 0; // new generated video always starts at its beginning
        }
        await saveProjectToServer(currentProject);

        slot.remove();
        rebuildChildrenMap();
        renderCues();
        // if playhead near, preview will pick it up on next tick
    })();
}

function generateVideoForCueById(id) {
    const c = (currentProject.cues || []).find(x => x.id === id);
    if (c) generateVideoForCue(c);
}

function openAssetFromCue(assetId) {
    const asset = allAssets.find(a => a.id === assetId);
    if (!asset) return;
    const url = asset.type === 'video' || (asset.filename||'').endsWith('.mp4') ? `/videos/${asset.filename}` : `/images/${asset.filename}`;
    if (asset.type === 'video' || (asset.filename||'').endsWith('.mp4')) {
        openVideoModal(url, asset.filename);
    } else {
        openImageModal(url, asset.filename, asset);
    }
}

function deleteCueById(id) { /* already defined above via wrapper */ }

function addAudioToCurrentProject() {
    if (!currentProject) return;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 z-[260] flex items-center justify-center';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-4 w-full max-w-xl mx-4 max-h-[70vh] flex flex-col" onclick="event.stopImmediatePropagation()">
            <div class="flex justify-between items-center mb-2">
                <div class="text-sm font-medium">Choose audio track for project</div>
                <button class="text-xl px-2" onclick="this.closest('.fixed').remove()">×</button>
            </div>
            <div id="audio-picker-grid" class="flex-1 overflow-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 bg-zinc-950 rounded"></div>
            <div class="text-[10px] text-zinc-500 mt-2">Audios from your Library uploads. Upload more using the + in the bottom prompt bar (switch to Library view).</div>
        </div>
    `;
    document.body.appendChild(overlay);
    const grid = overlay.querySelector('#audio-picker-grid');

    (async () => {
        let auds = [];
        try {
            const res = await fetch('/history');
            const all = await res.json() || [];
            auds = all.filter(a => a.type === 'audio' || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(a.filename||''));
        } catch {
            auds = (allAssets || []).filter(a => a.type === 'audio' || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(a.filename||''));
        }
        if (auds.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-xs text-zinc-500 py-8">No audio files yet. Upload audio tracks from the Library view using the + in the bottom prompt bar.</div>`;
            return;
        }
        auds.sort((a,b) => new Date(b.created||0) - new Date(a.created||0)).forEach(asset => {
            const card = document.createElement('div');
            card.className = 'aspect-square bg-zinc-800 rounded-xl border border-zinc-700 overflow-hidden cursor-pointer flex flex-col';
            card.innerHTML = `
                <div class="flex-1 flex items-center justify-center bg-zinc-900">
                    <i class="fa-solid fa-volume-up text-4xl text-emerald-400"></i>
                </div>
                <div class="px-2 py-1 text-[10px] truncate bg-black/40">${asset.prompt || asset.filename}</div>
            `;
            card.onclick = async () => {
                overlay.remove();
                currentProject.audio_filename = asset.filename;
                currentProject.audio_duration = asset.metadata && asset.metadata.duration ? asset.metadata.duration : null;
                await saveProjectToServer(currentProject);
                // re-render editor to reload wave + transport
                await renderProjectEditor();
                renderSidebarProjectList();
            };
            grid.appendChild(card);
        });
    })();
}

function removeAudioFromCurrentProject() {
    if (!currentProject || !currentProject.audio_filename) return;
    if (!confirm('Remove audio track from this project?')) return;
    currentProject.audio_filename = null;
    currentProject.audio_duration = null;
    saveProjectToServer(currentProject).then(() => {
        renderProjectEditor();
        renderSidebarProjectList();
    });
}

function deleteCurrentProject() {
    if (!currentProject) return;
    if (!confirm(`Delete project "${currentProject.name}"? (Library assets remain.)`)) return;
    const pid = currentProject.id;
    projects = projects.filter(p => p.id !== pid);
    (async () => {
        try {
            await fetch('/delete-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pid })
            });
        } catch (e) { console.warn('delete-project call failed, list pruned client-side only', e); }
    })();
    currentProject = null;
    showHomeView();  // go to home on project delete (workaround keeps library entry via button)
    renderSidebarProjectList();
}

async function exportProjectSequence() {
    if (!currentProject) {
        alert("No project loaded.");
        return;
    }

    const exportBtn = document.getElementById('export-sequence-btn');
    let origHTML = '';
    if (exportBtn) {
        origHTML = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Preparing zip...</span>';
    }

    let assets = allAssets || [];
    if (assets.length === 0) {
        try {
            await loadHistory();
            assets = allAssets || [];
        } catch (e) {
            console.warn("Failed to load assets for export", e);
        }
    }

    const cues = [...(currentProject.cues || [])].sort((a, b) => (a.time || 0) - (b.time || 0));
    const items = [];
    for (const c of cues) {
        const aid = c.video_id || c.selected_image_id;
        if (!aid) continue;
        const asset = assets.find(a => a.id === aid);
        if (!asset || !asset.filename) continue;
        const t = c.time || 0;
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        const frame = Math.floor(((t % 1) * 24) + 0.0001); // 24 fps
        const base = `${mins.toString().padStart(2, '0')}-${secs.toString().padStart(2, '0')}-${frame.toString().padStart(2, '0')}`;
        const ext = (asset.filename.split('.').pop() || 'bin').toLowerCase();
        const dname = `${base}.${ext}`;
        const offset = c.video_start_offset || 0;
        items.push({ asset_id: aid, desired_name: dname, video_start_offset: offset });
    }

    if (items.length === 0) {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = origHTML;
        }
        alert("No images or videos are assigned to any cues in this project.");
        return;
    }

    try {
        const res = await fetch('/export-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: items,
                project_name: currentProject.name || 'sequence'
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || res.statusText || 'Export failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safe = (currentProject.name || 'sequence').replace(/[^a-z0-9]/gi, '_').slice(0, 60);
        a.download = `${safe}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Check for trim warnings from server (set when any video trim failed)
        const trimWarningHeader = res.headers.get('X-Trim-Warnings');
        if (trimWarningHeader) {
            alert("Export completed with warnings:\n\n" + trimWarningHeader + "\n\nA 'TRIM_WARNINGS.txt' file has been included inside the downloaded zip with details on which clips could not be trimmed (full originals were used instead).");
        }
    } catch (e) {
        console.error(e);
        alert("Failed to export sequence: " + (e.message || e));
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = origHTML;
        }
    }
}

function addCueAtPlayhead() {
    if (!currentProject) return;
    const rawT = (projectAudio && !isNaN(projectAudio.currentTime)) ? projectAudio.currentTime : ((projectDuration || 60) * 0.1);
    const t = snapToFrame(rawT);
    const defaultName = `Cue ${formatTimeWithFrames(t)}`;
    const cueName = prompt('Cue name (will be shown rotated on waveform)?', defaultName) || defaultName;

    const cue = {
        id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('c_' + Date.now() + Math.random().toString(36).slice(2)),
        time: t,
        name: cueName.trim(),
        prompt: '',
        candidates: [],
        selected_image_id: null,
        video_id: null,
        video_start_offset: 0,
        mute_audio: false,
        lora_name: null
    };
    if (!currentProject.cues) currentProject.cues = [];
    currentProject.cues.push(cue);
    currentProject.cues.sort((a, b) => a.time - b.time);
    saveProjectToServer(currentProject).then(() => {
        renderCues();
        // do not prompt for image prompt here; user may pick existing asset instead. Set prompt in cue dialog if generating.
    });
}

function openCueDialog(cue) {
    if (!cue || !currentProject) return;

    if (typeof cue.mute_audio === 'undefined') {
      cue.mute_audio = false;
    }
    if (typeof cue.video_start_offset === 'undefined' || cue.video_start_offset == null) {
      cue.video_start_offset = 0;
    }
    if (typeof cue.lora_name === 'undefined') {
      cue.lora_name = null;
    }

    // Prepare LoRA dropdown HTML (only shown in dialog if using Flux Schnell and we have LoRAs loaded)
    let loraSelectHtml = '';
    if (currentImageModel === 'schnell' && availableLoras && availableLoras.length > 0) {
      const opts = availableLoras.map(l => {
        const selected = (cue.lora_name === l) ? ' selected' : '';
        return `<option value="${l}"${selected}>${l}</option>`;
      }).join('');
      loraSelectHtml = `
        <div class="mt-2">
          <label class="block text-xs text-zinc-400 mb-1">LoRA (for image gen, Flux Schnell only)</label>
          <select id="dlg-lora" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm">
            <option value="">None (base Flux Schnell)</option>
            ${opts}
          </select>
          <p class="text-[10px] text-zinc-500 mt-0.5">Choosing a LoRA here will use the LoRA workflow when you click Generate 4 / Regenerate.</p>
        </div>
      `;
    }

    // Remove any existing cue dialog
    const existing = document.getElementById('cue-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cue-dialog-overlay';
    overlay.className = 'fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl w-full max-w-[720px] max-h-[90vh] overflow-auto border border-zinc-700 shadow-2xl" onclick="event.stopImmediatePropagation()">
            <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                <div>
                    <div class="text-sm text-zinc-400">CUE DIALOG</div>
                    <span id="dlg-cue-name" contenteditable="true" class="text-lg font-semibold outline-none border-b border-transparent hover:border-zinc-600 focus:border-emerald-500 cursor-text">${cue.name || 'Unnamed cue'}</span>
                    <span class="text-sm text-zinc-400"> @ ${(cue.time || 0).toFixed(2)}s</span>
                </div>
                <button id="close-cue-dlg" class="text-2xl leading-none px-2 text-zinc-400 hover:text-white">×</button>
            </div>

            <!-- Time reposition controls -->
            <div class="px-4 py-2 border-b border-zinc-700 flex items-center gap-x-2 text-sm bg-zinc-950/50">
                <span class="text-zinc-400">Time:</span>
                <input id="dlg-cue-time" type="number" step="0.01" min="0" class="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm" value="${(cue.time || 0).toFixed(2)}" />
                <span class="text-zinc-400">s</span>
                <button id="dlg-time-dec" class="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs" title="Move cue 0.1s earlier">-0.1</button>
                <button id="dlg-time-inc" class="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs" title="Move cue 0.1s later">+0.1</button>
                <button id="dlg-time-set" class="px-2 py-0.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600">Set</button>
            </div>

            <!-- Mute audio selector for this cue -->
            <div class="px-4 py-2 flex items-center gap-x-2 text-sm border-b border-zinc-700 bg-zinc-950/30">
                <input type="checkbox" id="dlg-mute-audio" class="w-4 h-4 accent-emerald-400" ${cue.mute_audio ? 'checked' : ''} />
                <label for="dlg-mute-audio" class="text-zinc-300 select-none cursor-pointer">Mute audio on the generated video for this cue</label>
            </div>

            <div class="p-4 space-y-4">
                <!-- Image section -->
                <div>
                    <label class="block text-xs text-zinc-400 mb-1">Image prompt (for generating 4 images)</label>
                    <textarea id="dlg-img-prompt" class="w-full h-16 bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-sm" placeholder="Describe the image...">${cue.prompt || ''}</textarea>
                    ${loraSelectHtml}
                    <div class="flex flex-wrap gap-2 mt-2">
                        <button id="dlg-gen-4" class="px-3 py-1.5 text-sm rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center gap-x-1">
                            <i class="fa-solid fa-magic"></i> <span>Generate 4 (bigger view)</span>
                        </button>
                        <button id="dlg-regen-4" class="px-3 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Regenerate 4</button>
                        <button id="dlg-pick-img" class="px-3 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Select existing image</button>
                    </div>
                    <!-- Bigger 4 candidates area (populated on gen) -->
                    <div id="dlg-candidates" class="mt-3 min-h-[90px] bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex flex-wrap gap-2 justify-center"></div>
                </div>

                <!-- Video section (after image selected) -->
                <div>
                    <label class="block text-xs text-zinc-400 mb-1">Video prompt</label>
                    <textarea id="dlg-vid-prompt" class="w-full h-12 bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-sm" placeholder="Motion description...">${cue.video_prompt || (cue.prompt || '') + ' cinematic video'}</textarea>
                    <div class="flex flex-wrap gap-2 mt-2">
                        <button id="dlg-gen-vid" class="px-3 py-1.5 text-sm rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center gap-x-1">
                            <i class="fa-solid fa-video"></i> <span>Generate video from image</span>
                        </button>
                        <button id="dlg-pick-vid" class="px-3 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Select existing video</button>
                    </div>
                </div>

                <!-- Chosen media box below the prompt text area -->
                <div>
                    <div class="text-xs text-zinc-400 mb-1">Selected media for this cue position</div>
                    <div id="dlg-chosen-media" class="bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden flex items-center justify-center" style="min-height: 180px; max-height: 320px;">
                        <div class="text-center text-zinc-500 text-sm p-4">No image or video selected yet for this cue.<br>Generate or pick above.</div>
                    </div>
                </div>

                <!-- Video start offset (shown always but only active for video; updated by refreshChosen) -->
                <div id="dlg-video-offset-controls">
                    <div class="text-xs text-zinc-400 mb-1">Video start offset (skip initial part of the selected video)</div>
                    <div class="flex items-center gap-x-2 text-sm">
                        <input id="dlg-video-offset" type="number" step="0.01" min="0" class="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm" value="0" />
                        <span class="text-zinc-400">s</span>
                        <button id="dlg-offset-reset" class="px-2 py-0.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700">Reset to 0</button>
                        <button id="dlg-offset-usevid" class="px-2 py-0.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600" title="Scrub the video in the box above (use its controls), then click to capture its current time as the cue's start offset">Set from video time</button>
                    </div>
                </div>
            </div>

            <div class="px-4 py-3 border-t border-zinc-700 flex justify-end gap-2">
                <button id="dlg-save-close" class="px-4 py-1.5 text-sm rounded-full bg-white text-black">Save & Close</button>
                <button id="dlg-close" class="px-4 py-1.5 text-sm rounded-full bg-zinc-800 hover:bg-zinc-700">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-cue-dlg').onclick = close;
    overlay.querySelector('#dlg-close').onclick = close;
    overlay.querySelector('#dlg-save-close').onclick = () => {
        // save any prompt changes + current mute state + video offset (in case not via live onchange)
        const imgP = overlay.querySelector('#dlg-img-prompt');
        const vidP = overlay.querySelector('#dlg-vid-prompt');
        const muteChk2 = overlay.querySelector('#dlg-mute-audio');
        const offInp2 = overlay.querySelector('#dlg-video-offset');
        const loraSel2 = overlay.querySelector('#dlg-lora');
        if (imgP) cue.prompt = imgP.value.trim();
        if (vidP) cue.video_prompt = vidP.value.trim(); // optional extra field
        if (muteChk2) cue.mute_audio = !!muteChk2.checked;
        if (offInp2) {
            const ov = parseFloat(offInp2.value);
            if (!isNaN(ov) && ov >= 0) cue.video_start_offset = ov;
        }
        if (loraSel2) cue.lora_name = loraSel2.value || null;
        saveProjectToServer(currentProject).then(() => {
            renderCues();
            close();
        });
    };
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // set correct aspect on chosen box and candidates
    const projAr = currentProject.aspect_ratio || '3:2';
    const chosenDiv = overlay.querySelector('#dlg-chosen-media');
    if (chosenDiv) {
      chosenDiv.style.aspectRatio = projAr.replace(':', '/');
      chosenDiv.style.width = '100%';
    }

    // Video offset controls (for when a video is the selected media on this cue)
    const offsetControls = overlay.querySelector('#dlg-video-offset-controls');
    const offsetInput = overlay.querySelector('#dlg-video-offset');
    const offsetResetBtn = overlay.querySelector('#dlg-offset-reset');
    const offsetUseVidBtn = overlay.querySelector('#dlg-offset-usevid');

    // editable cue name in dialog
    const nameEdit = overlay.querySelector('#dlg-cue-name');
    if (nameEdit) {
      nameEdit.onblur = () => {
        let newName = nameEdit.textContent.trim();
        if (!newName) newName = `Cue ${(cue.time || 0).toFixed(1)}s`;
        if (newName !== (cue.name || '')) {
          cue.name = newName;
          saveProjectToServer(currentProject).then(() => {
            renderCues();
          });
        }
      };
      nameEdit.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameEdit.blur();
        }
      };
    }

    // time reposition in dialog
    const timeInput = overlay.querySelector('#dlg-cue-time');
    const decBtn = overlay.querySelector('#dlg-time-dec');
    const incBtn = overlay.querySelector('#dlg-time-inc');
    const setBtn = overlay.querySelector('#dlg-time-set');
    const applyTime = (newT) => {
      newT = Math.max(0, Math.min(projectDuration || 9999, newT));
      if (Math.abs(newT - (cue.time || 0)) > 0.001) {
        cue.time = newT;
        if (timeInput) timeInput.value = newT.toFixed(2);
        saveProjectToServer(currentProject).then(() => {
          renderCues();
          updateProjectPreview(projectAudio ? projectAudio.currentTime : 0);
        });
      }
    };
    if (setBtn && timeInput) {
      setBtn.onclick = () => {
        const nt = parseFloat(timeInput.value);
        if (!isNaN(nt)) applyTime(nt);
      };
      timeInput.onblur = () => {
        const nt = parseFloat(timeInput.value);
        if (!isNaN(nt)) applyTime(nt);
      };
    }
    if (decBtn) decBtn.onclick = () => applyTime((cue.time || 0) - 0.1);
    if (incBtn) incBtn.onclick = () => applyTime((cue.time || 0) + 0.1);

    // mute audio selector (affects the *generated video track* for this cue, not the main project audio)
    const muteChk = overlay.querySelector('#dlg-mute-audio');
    if (muteChk) {
      muteChk.onchange = () => {
        cue.mute_audio = !!muteChk.checked;
        saveProjectToServer(currentProject);
        renderCues(); // show/hide the mute icon under wave
        const curT = projectAudio ? projectAudio.currentTime : 0;
        updateProjectPreview(curT); // refresh preview video's .muted state live
      };
    }

    // Video offset live controls (numeric + buttons). Only functional when a video is selected (see refreshChosen for show/disable)
    if (offsetInput) {
      const applyOffset = (newOff) => {
        newOff = Math.max(0, newOff);
        if (offsetInput) offsetInput.value = newOff.toFixed(2);
        if (Math.abs((cue.video_start_offset || 0) - newOff) > 0.001) {
          cue.video_start_offset = newOff;
          saveProjectToServer(currentProject);
          // jump the chosen video element to the new offset if present
          const v = chosenDiv && chosenDiv.querySelector('video');
          if (v) {
            try { v.currentTime = newOff; } catch (e) {}
          }
          renderCues();
          const curT = projectAudio ? projectAudio.currentTime : 0;
          updateProjectPreview(curT);
        }
      };
      offsetInput.onchange = offsetInput.onblur = () => {
        let ov = parseFloat(offsetInput.value);
        if (isNaN(ov) || ov < 0) ov = 0;
        applyOffset(ov);
      };
    }
    if (offsetResetBtn) {
      offsetResetBtn.onclick = () => {
        if (offsetInput) offsetInput.value = '0';
        cue.video_start_offset = 0;
        saveProjectToServer(currentProject);
        const v = chosenDiv && chosenDiv.querySelector('video');
        if (v) { try { v.currentTime = 0; } catch (e) {} }
        renderCues();
        const curT = projectAudio ? projectAudio.currentTime : 0;
        updateProjectPreview(curT);
      };
    }
    if (offsetUseVidBtn) {
      offsetUseVidBtn.onclick = () => {
        const v = chosenDiv && chosenDiv.querySelector('video');
        if (v) {
          const newOff = Math.max(0, v.currentTime || 0);
          if (offsetInput) offsetInput.value = newOff.toFixed(2);
          cue.video_start_offset = newOff;
          saveProjectToServer(currentProject);
          // already at that time, but ensure
          try { v.currentTime = newOff; } catch (e) {}
          renderCues();
          const curT = projectAudio ? projectAudio.currentTime : 0;
          updateProjectPreview(curT);
        } else {
          alert('No video currently shown in the Selected media box to read the time from. Pick or generate a video first.');
        }
      };
    }

    // Wire buttons
    const gen4Btn = overlay.querySelector('#dlg-gen-4');
    const regen4Btn = overlay.querySelector('#dlg-regen-4');
    const pickImgBtn = overlay.querySelector('#dlg-pick-img');
    const genVidBtn = overlay.querySelector('#dlg-gen-vid');
    const pickVidBtn = overlay.querySelector('#dlg-pick-vid');

    const candidatesDiv = overlay.querySelector('#dlg-candidates');

    const refreshChosen = () => {
        renderCueChosenMedia(cue, chosenDiv, offsetControls, offsetInput);
    };

    // Initial chosen
    refreshChosen();

    // Save prompt changes live-ish
    const imgPromptTa = overlay.querySelector('#dlg-img-prompt');
    if (imgPromptTa) {
        imgPromptTa.onblur = () => {
            cue.prompt = imgPromptTa.value.trim();
            saveProjectToServer(currentProject);
        };
    }

    // LoRA select for this cue (if present)
    const loraSel = overlay.querySelector('#dlg-lora');
    if (loraSel) {
      loraSel.onchange = () => {
        cue.lora_name = loraSel.value || null;
        saveProjectToServer(currentProject);
      };
    }

    // Generate 4 - use the target support for bigger view in dialog
    gen4Btn.onclick = () => {
        const p = imgPromptTa ? imgPromptTa.value.trim() : cue.prompt;
        if (!p) {
            const np = prompt('Image prompt?', 'a beautiful scene');
            if (!np) return;
            cue.prompt = np.trim();
            if (imgPromptTa) imgPromptTa.value = cue.prompt;
            saveProjectToServer(currentProject);
        }
        candidatesDiv.innerHTML = '<div class="text-xs text-zinc-400 p-2 w-full text-center">Generating 4 images in bigger view...</div>';
        // Call with target so slots go into dialog (bigger)
        generateImagesForCue(cue, candidatesDiv);
        // After gen (the function handles async and will attach picks + refresh timeline), we can refresh chosen after a delay or let pick close it
        setTimeout(refreshChosen, 8000); // rough, in practice pick will close dialog
    };

    regen4Btn.onclick = () => {
        cue.candidates = [];
        cue.selected_image_id = null;
        saveProjectToServer(currentProject).then(() => {
            candidatesDiv.innerHTML = '';
            renderCues();
            gen4Btn.click(); // trigger gen again
        });
    };

    pickImgBtn.onclick = () => {
        showCueAssetPicker(cue, 'image');
        // selection inside picker will call refreshOpenCueDialogChosen immediately
    };

    genVidBtn.onclick = () => {
        if (!cue.selected_image_id) {
            alert('Pick or generate a selected image first.');
            return;
        }
        const vta = overlay.querySelector('#dlg-vid-prompt');
        const vpr = vta ? vta.value.trim() : null;
        generateVideoForCue(cue, vpr || undefined);
        setTimeout(() => {
            refreshChosen();
            renderCues();
        }, 6000);
    };

    pickVidBtn.onclick = () => {
        showCueAssetPicker(cue, 'video');
        // selection inside picker will call refreshOpenCueDialogChosen immediately
    };

    // If already has candidates, show them in dialog candidates area as pickable (bigger, correct aspect)
    if (cue.candidates && cue.candidates.length > 0 && !cue.selected_image_id) {
        candidatesDiv.innerHTML = '';
        const [aw, ah] = projAr.split(':').map(n => parseFloat(n) || 1);
        const candAspect = aw / ah;
        const candW = 82;
        const candH = Math.round(candW / candAspect);
        cue.candidates.slice(0,4).forEach((cid, i) => {
            const asset = allAssets.find(a => a.id === cid) || {};
            const d = document.createElement('div');
            d.style.width = candW + 'px';
            d.style.height = candH + 'px';
            d.style.background = '#18181b';
            d.style.border = '1px solid #3f3f46';
            d.style.borderRadius = '6px';
            d.style.overflow = 'hidden';
            d.style.cursor = 'pointer';
            if (asset.filename) {
                d.innerHTML = `<img src="/images/${asset.filename}" class="w-full h-full object-cover" />`;
            }
            d.onclick = () => {
                pickImageForCue(cue, cid);
                // do not close dialog (user may want to gen video next)
                refreshChosen();
                renderCues();
            };
            candidatesDiv.appendChild(d);
        });
    }

    // If has selected, make sure media shows it
    refreshChosen();
}

function showImageModelSettings() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 z-[200] flex items-center justify-center';
    const isGenSchnell = currentImageModel === 'schnell';
    const isGenKlein = currentImageModel === 'klein';
    const isGenQwen = currentImageModel === 'qwen';
    const isEditKlein = currentI2IModel === 'klein';
    const isLibVideoPlay = libraryVideoPlayback === 'play_loop';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl p-4 w-full max-w-[1360px] mx-4 border border-zinc-700" onclick="event.stopImmediatePropagation()">
            <div class="flex items-center justify-between mb-3">
                <div class="font-semibold">Settings</div>
                <button id="close-model-settings" class="px-3 py-0.5 text-xs rounded-full bg-zinc-700 hover:bg-zinc-600">Close</button>
            </div>

            <div class="grid grid-cols-3 gap-x-4 text-sm">
                <!-- LEFT: Server Connections (ComfyUI + Ollama) -->
                <div>
                    <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5 px-0.5">Servers</div>

                    <!-- ComfyUI -->
                    <div class="bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 mb-2.5">
                        <div class="flex items-center gap-x-1.5 mb-1">
                            <i class="fa-solid fa-server text-emerald-400 text-xs"></i>
                            <span class="text-xs font-medium">ComfyUI</span>
                        </div>
                        <div class="flex gap-x-2">
                            <div class="flex-1">
                                <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">IP / Host</label>
                                <input id="srv-comfy-host" type="text" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-0.5 text-xs" placeholder="10.1.5.202">
                            </div>
                            <div class="w-20">
                                <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">Port</label>
                                <input id="srv-comfy-port" type="number" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-0.5 text-xs" placeholder="8188">
                            </div>
                        </div>
                    </div>

                    <!-- Ollama -->
                    <div class="bg-zinc-950 border border-zinc-700 rounded-xl p-2.5">
                        <div class="flex items-center gap-x-1.5 mb-1">
                            <i class="fa-solid fa-brain text-sky-400 text-xs"></i>
                            <span class="text-xs font-medium">Ollama (Story Mode)</span>
                        </div>
                        <div class="flex gap-x-2 mb-1.5">
                            <div class="flex-1">
                                <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">IP / Host</label>
                                <input id="srv-ollama-host" type="text" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-0.5 text-xs" placeholder="10.1.5.202">
                            </div>
                            <div class="w-20">
                                <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">Port</label>
                                <input id="srv-ollama-port" type="number" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-0.5 text-xs" placeholder="11434">
                            </div>
                        </div>
                        <div class="flex gap-x-2">
                            <div class="w-20">
                                <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">Timeout (s)</label>
                                <input id="srv-ollama-timeout" type="number" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-0.5 text-xs" min="10" step="10">
                            </div>
                            <div class="flex-1 min-w-0">
                                <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">Model</label>
                                <div class="flex gap-x-1">
                                    <select id="srv-ollama-model" class="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-1.5 py-0.5 text-xs"></select>
                                    <button id="srv-ollama-refresh-models" class="px-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center" title="Refresh models from Ollama">
                                        <i class="fa-solid fa-sync text-[9px]"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Failed generation UI timer (used for auto-clearing "Failed to generate" / "Gen failed" error states in library, cues, etc.) -->
                    <div class="mt-2">
                        <label class="block text-[9px] text-zinc-500 leading-none mb-0.5">Failed gen auto-clear (seconds)</label>
                        <input id="srv-failed-gen-clear" type="number" class="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-0.5 text-xs" min="1" step="1" placeholder="600">
                    </div>

                    <!-- Reset button (servers only) -->
                    <button id="reset-servers-btn"
                            class="mt-2 w-full text-[10px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 flex items-center justify-center gap-x-1">
                        <i class="fa-solid fa-undo text-[9px]"></i>
                        <span>Reset URLs to localhost defaults</span>
                    </button>
                </div>

                <!-- RIGHT: Model Selection + LoRAs -->
                <div class="space-y-2.5">
                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-1 px-0.5">Image Generation Model</div>
                        <div class="flex flex-col gap-y-1">
                            <button id="model-btn-schnell" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${isGenSchnell ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-bolt w-3"></i>
                                <span>Flux Schnell <span class="text-[9px] opacity-70">(fast)</span></span>
                            </button>
                            <button id="model-btn-klein" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${isGenKlein ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-microchip w-3"></i>
                                <span>Flux 2 Klein</span>
                            </button>
                            <button id="model-btn-qwen" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${isGenQwen ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-magic w-3"></i>
                                <span>Qwen 2.5 2512</span>
                            </button>
                        </div>
                        <div class="mt-1 px-0.5 flex items-center justify-between">
                            <span class="text-[10px] text-zinc-400">Qwen Turbo (4-step LoRA)</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="qwen-turbo-toggle" class="sr-only peer" ${qwenTurbo ? 'checked' : ''}>
                                <div class="w-7 h-3.5 bg-zinc-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-3.5"></div>
                            </label>
                        </div>
                    </div>

                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-1 px-0.5">Image Edit Model</div>
                        <div class="flex flex-col gap-y-1">
                            <button id="edit-btn-klein" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${isEditKlein ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-microchip w-3"></i>
                                <span>Flux 2 Klein (default)</span>
                            </button>
                            <button id="edit-btn-flux2" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${!isEditKlein ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-image w-3"></i>
                                <span>Flux 2</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium mb-1 px-0.5">Library Video Playback</div>
                        <div class="flex flex-col gap-y-1">
                            <button id="libvid-btn-1st" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${!isLibVideoPlay ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-image w-3"></i>
                                <span>1st frame only (lower CPU)</span>
                            </button>
                            <button id="libvid-btn-play" class="w-full px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-x-2 transition-colors ${isLibVideoPlay ? 'bg-white text-black' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}">
                                <i class="fa-solid fa-play w-3"></i>
                                <span>Autoplay + loop (muted)</span>
                            </button>
                        </div>
                    </div>

                    <!-- LoRAs on the right as requested -->
                    <div>
                        <div class="flex items-center justify-between mb-0.5 px-0.5">
                            <div>
                                <span class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">LoRAs (Flux Schnell)</span>
                            </div>
                            <button id="refresh-loras-btn" class="px-2 py-0.5 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-x-1">
                                <i class="fa-solid fa-sync text-[9px]"></i>
                                <span>Refresh</span>
                            </button>
                        </div>
                        <div id="loras-list" class="max-h-20 overflow-auto text-[10px] bg-zinc-950 border border-zinc-700 rounded p-1 space-y-px"></div>
                        <div id="loras-count" class="text-[9px] text-zinc-500 mt-0.5 px-0.5"></div>
                    </div>

                    <!-- Workflow Models / Required Models Status (placed in the same column as Image Generation Model buttons) -->
                    <div class="mt-2">
                        <div class="flex items-center justify-between mb-0.5 px-0.5">
                            <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Workflow Models</div>
                            <button id="check-workflow-models-btn" class="px-2 py-0.5 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-x-1">
                                <i class="fa-solid fa-sync text-[9px]"></i>
                                <span>Check Models</span>
                            </button>
                        </div>
                        <div id="workflow-models-summary" class="text-[10px] text-zinc-400 mb-1">Click Check to scan ComfyUI</div>
                        <div id="workflow-models-list" class="text-[9px] bg-zinc-950 border border-zinc-700 rounded p-1 max-h-32 overflow-auto space-y-px"></div>
                    </div>
                </div>

                <!-- Prompt Enhancers column: to the right of the image generation model column -->
                <div class="min-w-[220px]">
                    <div class="flex items-center justify-between mb-1 px-0.5">
                        <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Prompt Enhancers (uses Ollama)</div>
                        <button id="add-enhancer-btn" class="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700">+ Add</button>
                    </div>
                    <div id="enhancers-editor-list" class="bg-zinc-950 border border-zinc-700 rounded p-1 space-y-1 text-[11px]"></div>
                    <div class="text-[9px] text-zinc-500 mt-0.5 px-0.5">Edits saved automatically. List shows all (no scrollbar, room for 25).</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-model-settings').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Generation buttons
    const schnellBtn = overlay.querySelector('#model-btn-schnell');
    const genKleinBtn = overlay.querySelector('#model-btn-klein');
    const qwenBtn = overlay.querySelector('#model-btn-qwen');
    const editKleinBtn = overlay.querySelector('#edit-btn-klein');
    const flux2Btn = overlay.querySelector('#edit-btn-flux2');
    const libvid1stBtn = overlay.querySelector('#libvid-btn-1st');
    const libvidPlayBtn = overlay.querySelector('#libvid-btn-play');
    const turboToggle = overlay.querySelector('#qwen-turbo-toggle');

    // Prompt enhancers editor
    const enhancersListEl = overlay.querySelector('#enhancers-editor-list');
    const addEnhBtn = overlay.querySelector('#add-enhancer-btn');
    function renderEnhancersEditor() {
        if (!enhancersListEl) return;
        enhancersListEl.innerHTML = '';
        // Tidy header
        const hdr = document.createElement('div');
        hdr.className = 'flex gap-1 text-[9px] text-zinc-400 font-medium px-0.5 mb-0.5 border-b border-zinc-700 pb-0.5';
        hdr.innerHTML = '<div class="flex-1">Name</div><div class="flex-[3]">Enhancer Prompt (combined with user prompt and sent to Ollama)</div><div class="w-3"></div>';
        enhancersListEl.appendChild(hdr);
        (promptEnhancers || []).forEach((enh, i) => {
            const row = document.createElement('div');
            row.className = 'flex gap-1 items-start';
            row.innerHTML = `
                <input class="flex-1 bg-zinc-900 border border-zinc-600 rounded px-1 py-0.5 text-xs" value="${(enh.name||'').replace(/"/g,'&quot;')}" placeholder="Name">
                <textarea class="flex-[3] bg-zinc-900 border border-zinc-600 rounded px-1 py-0.5 text-xs min-h-[22px] max-h-16 overflow-auto resize-y" placeholder="Enhancer text...">${(enh.prompt||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                <button class="px-1 text-red-400 hover:text-red-500 text-sm mt-0.5" title="Remove">×</button>
            `;
            const nameI = row.querySelector('input');
            const promptTa = row.querySelector('textarea');
            const delB = row.querySelector('button');
            nameI.onchange = () => { enh.name = nameI.value.trim() || 'Untitled'; saveEnhancersNow(); };
            promptTa.onchange = promptTa.onblur = () => { enh.prompt = promptTa.value.trim(); saveEnhancersNow(); };
            delB.onclick = () => {
                if (promptEnhancers.length <= 1) return alert('Keep at least the None entry or one enhancer.');
                promptEnhancers.splice(i, 1);
                renderEnhancersEditor();
                saveEnhancersNow();
            };
            enhancersListEl.appendChild(row);
        });
    }
    function saveEnhancersNow() {
        // Filter out any accidental none dupes etc, keep order
        const cleaned = (promptEnhancers || []).filter(e => e && e.id);
        if (!cleaned.find(e => e.id === 'none')) {
            cleaned.unshift({id:'none', name:'No enhancement', prompt:''});
        }
        promptEnhancers = cleaned;
        saveSettings({ prompt_enhancers: promptEnhancers }).catch(() => {});
    }
    if (addEnhBtn) {
        addEnhBtn.onclick = () => {
            promptEnhancers = promptEnhancers || [];
            promptEnhancers.push({ id: 'custom-' + Date.now().toString(36), name: 'Custom Style', prompt: 'highly detailed, masterpiece, sharp focus, intricate' });
            renderEnhancersEditor();
            saveEnhancersNow();
        };
    }
    // initial render
    setTimeout(renderEnhancersEditor, 10);

    // LoRAs list + refresh (info display + re-query; actual selection of LoRA for gen is via main + button)
    const refreshLorasBtn = overlay.querySelector('#refresh-loras-btn');
    const lorasListEl = overlay.querySelector('#loras-list');
    const lorasCountEl = overlay.querySelector('#loras-count');

    function renderLorasListInSettings() {
        if (!lorasListEl) return;
        lorasListEl.innerHTML = '';
        const count = (availableLoras || []).length;
        if (lorasCountEl) lorasCountEl.textContent = count ? `${count} LoRAs loaded` : '';
        if (!count) {
            lorasListEl.innerHTML = '<div class="px-1 py-0.5 text-[10px] text-zinc-500">No LoRAs found — check ComfyUI models/loras folder</div>';
            return;
        }
        availableLoras.forEach(lora => {
            const row = document.createElement('div');
            row.className = 'px-1 py-0.5 hover:bg-zinc-800 rounded cursor-default text-emerald-300 flex items-center gap-x-1 truncate text-[10px]';
            row.innerHTML = `<i class="fa-solid fa-magic text-[9px] opacity-70"></i> <span class="truncate" title="${lora}">${lora}</span>`;
            lorasListEl.appendChild(row);
        });
    }
    renderLorasListInSettings();

    if (refreshLorasBtn) {
        refreshLorasBtn.onclick = async () => {
            refreshLorasBtn.disabled = true;
            refreshLorasBtn.innerHTML = '<i class="fa-solid fa-sync fa-spin text-[10px]"></i> <span>Refreshing...</span>';
            await loadLoras(true);
            renderLorasListInSettings();
            refreshLorasBtn.disabled = false;
            refreshLorasBtn.innerHTML = '<i class="fa-solid fa-sync text-[10px]"></i> <span>Refresh from ComfyUI</span>';
        };
    }

    // ==================== Server settings wiring (inside the dialog) ====================
    const comfyHostEl = overlay.querySelector('#srv-comfy-host');
    const comfyPortEl = overlay.querySelector('#srv-comfy-port');
    const ollamaHostEl = overlay.querySelector('#srv-ollama-host');
    const ollamaPortEl = overlay.querySelector('#srv-ollama-port');
    const ollamaTimeoutEl = overlay.querySelector('#srv-ollama-timeout');
    const ollamaModelSel = overlay.querySelector('#srv-ollama-model');
    const ollamaRefreshBtn = overlay.querySelector('#srv-ollama-refresh-models');
    const failedGenClearEl = overlay.querySelector('#srv-failed-gen-clear');
    const resetServersBtn = overlay.querySelector('#reset-servers-btn');

    // Workflow Models checker elements (in the Image Gen Model column)
    const checkWorkflowModelsBtn = overlay.querySelector('#check-workflow-models-btn');
    const workflowModelsSummary = overlay.querySelector('#workflow-models-summary');
    const workflowModelsList = overlay.querySelector('#workflow-models-list');

    function parseHostPort(url, defHost, defPort) {
        try {
            if (!url) return { host: defHost, port: defPort };
            // handle no scheme
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

    async function loadServerValuesIntoDialog() {
        // Prefer cached from loadSettings, otherwise fetch fresh
        let s = {};
        try {
            const r = await fetch('/settings');
            if (r.ok) s = await r.json();
        } catch (e) {}
        const cUrl = s.comfyui_url || window._server_comfyui_url || 'http://127.0.0.1:8188';
        const oUrl = s.ollama_url || window._server_ollama_url || 'http://127.0.0.1:11434';
        const oModel = s.ollama_model || window._server_ollama_model || 'qwen3:8b';
        const oTimeout = (typeof s.ollama_timeout === 'number' ? s.ollama_timeout : (window._server_ollama_timeout || 180));
        const fgClear = (typeof s.failed_gen_clear_seconds === 'number' ? s.failed_gen_clear_seconds : 600);

        const c = parseHostPort(cUrl, '127.0.0.1', '8188');
        const o = parseHostPort(oUrl, '127.0.0.1', '11434');

        if (comfyHostEl) comfyHostEl.value = c.host;
        if (comfyPortEl) comfyPortEl.value = c.port;
        if (ollamaHostEl) ollamaHostEl.value = o.host;
        if (ollamaPortEl) ollamaPortEl.value = o.port;
        if (ollamaTimeoutEl) ollamaTimeoutEl.value = oTimeout;
        if (failedGenClearEl) failedGenClearEl.value = fgClear;

        // populate models and select current
        await populateOllamaModels(oModel);
    }

    async function populateOllamaModels(preferredModel) {
        if (!ollamaModelSel) return;
        ollamaModelSel.innerHTML = '<option value="">Loading models...</option>';
        ollamaModelSel.disabled = true;
        let models = [];
        let current = preferredModel || '';
        try {
            const r = await fetch('/ollama/models');
            if (r.ok) {
                const d = await r.json();
                models = Array.isArray(d.models) ? d.models : [];
                if (!current && d.current_model) current = d.current_model;
            }
        } catch (e) {}
        ollamaModelSel.innerHTML = '';
        if (!models.length) {
            const opt = document.createElement('option');
            opt.value = current || '';
            opt.textContent = current ? current + ' (unverified)' : 'No models found - enter manually or start Ollama';
            ollamaModelSel.appendChild(opt);
        } else {
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                if (m === current) opt.selected = true;
                ollamaModelSel.appendChild(opt);
            });
            if (current && !models.includes(current)) {
                const opt = document.createElement('option');
                opt.value = current;
                opt.textContent = current + ' (not in list)';
                opt.selected = true;
                ollamaModelSel.appendChild(opt);
            }
        }
        ollamaModelSel.disabled = false;
    }

    function composeUrl(host, port, defPort) {
        const h = (host || '').trim() || '127.0.0.1';
        const p = (port || '').trim() || defPort;
        return `http://${h}:${p}`;
    }

    async function saveServerField(patch) {
        await saveSettings(patch);
        // kick a quick status re-check so the banner updates promptly
        if (typeof checkServerStatuses === 'function') {
            setTimeout(checkServerStatuses, 150);
        }
    }

    // Wire inputs (save on change / blur for text fields)
    function wireHostPort(hostEl, portEl, kind) {
        if (!hostEl || !portEl) return;
        const saveNow = () => {
            if (kind === 'comfy') {
                const url = composeUrl(hostEl.value, portEl.value, '8188');
                saveServerField({ comfyui_url: url });
            } else {
                const url = composeUrl(hostEl.value, portEl.value, '11434');
                saveServerField({ ollama_url: url });
            }
        };
        hostEl.addEventListener('change', saveNow);
        hostEl.addEventListener('blur', saveNow);
        portEl.addEventListener('change', saveNow);
        portEl.addEventListener('blur', saveNow);
    }

    if (ollamaTimeoutEl) {
        ollamaTimeoutEl.addEventListener('change', () => {
            const v = parseInt(ollamaTimeoutEl.value, 10);
            if (v > 0) saveServerField({ ollama_timeout: v });
        });
        ollamaTimeoutEl.addEventListener('blur', () => {
            const v = parseInt(ollamaTimeoutEl.value, 10);
            if (v > 0) saveServerField({ ollama_timeout: v });
        });
    }

    if (failedGenClearEl) {
        failedGenClearEl.addEventListener('change', () => {
            const v = parseInt(failedGenClearEl.value, 10);
            if (v > 0) saveServerField({ failed_gen_clear_seconds: v });
        });
        failedGenClearEl.addEventListener('blur', () => {
            const v = parseInt(failedGenClearEl.value, 10);
            if (v > 0) saveServerField({ failed_gen_clear_seconds: v });
        });
    }

    if (ollamaModelSel) {
        ollamaModelSel.addEventListener('change', () => {
            const val = ollamaModelSel.value;
            if (val) saveServerField({ ollama_model: val });
        });
    }

    if (ollamaRefreshBtn) {
        ollamaRefreshBtn.onclick = async () => {
            ollamaRefreshBtn.disabled = true;
            ollamaRefreshBtn.innerHTML = '<i class="fa-solid fa-sync fa-spin text-[10px]"></i>';
            const currentVal = ollamaModelSel ? ollamaModelSel.value : '';
            await populateOllamaModels(currentVal);
            ollamaRefreshBtn.disabled = false;
            ollamaRefreshBtn.innerHTML = '<i class="fa-solid fa-sync text-[10px]"></i>';
        };
    }

    wireHostPort(comfyHostEl, comfyPortEl, 'comfy');
    wireHostPort(ollamaHostEl, ollamaPortEl, 'ollama');

    // ==================== Workflow Models Status Checker ====================
    // Hardcoded list of all unique models referenced in the 10 workflow JSONs.
    // Categories match what the /comfy/models backend returns.
    // This is the complete list (extracted from workflows/ at implementation time).
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

    function renderWorkflowModelsStatus(availableByCat, connected) {
        if (!workflowModelsList || !workflowModelsSummary) return;

        workflowModelsList.innerHTML = '';

        if (!connected) {
            workflowModelsSummary.textContent = 'Could not connect to ComfyUI';
            const err = document.createElement('div');
            err.className = 'text-red-400';
            err.textContent = 'ComfyUI unreachable — start the server and try again.';
            workflowModelsList.appendChild(err);
            return;
        }

        let present = 0;
        let total = 0;

        Object.keys(REQUIRED_WORKFLOW_MODELS).forEach(cat => {
            const models = REQUIRED_WORKFLOW_MODELS[cat] || [];
            if (!models.length) return;

            // Category header
            const catHeader = document.createElement('div');
            catHeader.className = 'text-[9px] font-medium text-zinc-400 mt-1 first:mt-0';
            catHeader.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            workflowModelsList.appendChild(catHeader);

            const available = new Set(availableByCat[cat] || []);

            models.forEach(model => {
                total++;
                const isPresent = available.has(model);
                if (isPresent) present++;

                const row = document.createElement('div');
                row.className = 'flex justify-between items-center px-0.5';
                const statusClass = isPresent ? 'text-emerald-400' : 'text-red-400';
                const statusText = isPresent ? '✅ Present' : '❌ Missing';
                row.innerHTML = `
                    <span class="truncate" title="${model}">${model}</span>
                    <span class="${statusClass} text-[9px] whitespace-nowrap ml-1">${statusText}</span>
                `;
                workflowModelsList.appendChild(row);
            });
        });

        workflowModelsSummary.textContent = `${present} of ${total} models present on server`;
    }

    if (checkWorkflowModelsBtn) {
        checkWorkflowModelsBtn.onclick = async () => {
            const origText = checkWorkflowModelsBtn.textContent;
            checkWorkflowModelsBtn.disabled = true;
            checkWorkflowModelsBtn.innerHTML = '<i class="fa-solid fa-sync fa-spin text-[9px]"></i> Checking...';

            try {
                const res = await fetch('/comfy/models');
                const data = await res.json();
                const connected = !!data.connected;
                // Normalize keys if backend uses slightly different (e.g. vae vs vaes)
                const availableByCat = {
                    checkpoints: data.checkpoints || data.unets || [],
                    loras: data.loras || [],
                    vaes: data.vaes || data.vae || [],
                    clips: data.clips || data.clip || [],
                    upscalers: data.upscalers || data.upscale_models || []
                };
                renderWorkflowModelsStatus(availableByCat, connected);
            } catch (e) {
                console.warn('Workflow models check failed', e);
                if (workflowModelsSummary) workflowModelsSummary.textContent = 'Check failed';
                if (workflowModelsList) workflowModelsList.innerHTML = '<div class="text-red-400">Failed to query ComfyUI</div>';
            } finally {
                checkWorkflowModelsBtn.disabled = false;
                checkWorkflowModelsBtn.textContent = origText || 'Check Models';
            }
        };
    }

    // Initial state for the section (unknown until user clicks Check)
    if (workflowModelsSummary) {
        workflowModelsSummary.textContent = 'Click "Check Models" to scan your ComfyUI server';
    }

    // Load current values + models (async, non-blocking for dialog open)
    loadServerValuesIntoDialog().catch(() => {});

    // Original model buttons continue below
    schnellBtn.onclick = async () => {
        if (currentImageModel !== 'schnell') {
            currentImageModel = 'schnell';
            schnellBtn.classList.add('bg-white', 'text-black');
            schnellBtn.classList.remove('bg-zinc-800', 'text-white');
            genKleinBtn.classList.remove('bg-white', 'text-black');
            genKleinBtn.classList.add('bg-zinc-800', 'text-white');
            if (qwenBtn) {
                qwenBtn.classList.remove('bg-white', 'text-black');
                qwenBtn.classList.add('bg-zinc-800', 'text-white');
            }
            await saveSettings({ image_model: 'schnell' });
        }
    };
    genKleinBtn.onclick = async () => {
        if (currentImageModel !== 'klein') {
            currentImageModel = 'klein';
            genKleinBtn.classList.add('bg-white', 'text-black');
            genKleinBtn.classList.remove('bg-zinc-800', 'text-white');
            schnellBtn.classList.remove('bg-white', 'text-black');
            schnellBtn.classList.add('bg-zinc-800', 'text-white');
            if (qwenBtn) {
                qwenBtn.classList.remove('bg-white', 'text-black');
                qwenBtn.classList.add('bg-zinc-800', 'text-white');
            }
            if (currentLora) {
                currentLora = null;
                updateMainLoraIndicator(null);
            }
            await saveSettings({ image_model: 'klein' });
        }
    };
    if (qwenBtn) {
        qwenBtn.onclick = async () => {
            if (currentImageModel !== 'qwen') {
                currentImageModel = 'qwen';
                qwenBtn.classList.add('bg-white', 'text-black');
                qwenBtn.classList.remove('bg-zinc-800', 'text-white');
                schnellBtn.classList.remove('bg-white', 'text-black');
                schnellBtn.classList.add('bg-zinc-800', 'text-white');
                genKleinBtn.classList.remove('bg-white', 'text-black');
                genKleinBtn.classList.add('bg-zinc-800', 'text-white');
                if (currentLora) {
                    currentLora = null;
                    updateMainLoraIndicator(null);
                }
                await saveSettings({ image_model: 'qwen' });
            }
        };
    }
    if (turboToggle) {
        turboToggle.onchange = async () => {
            qwenTurbo = !!turboToggle.checked;
            await saveSettings({ qwen_turbo: qwenTurbo });
        };
    }

    // Edit buttons
    editKleinBtn.onclick = async () => {
        if (currentI2IModel !== 'klein') {
            currentI2IModel = 'klein';
            editKleinBtn.classList.add('bg-white', 'text-black');
            editKleinBtn.classList.remove('bg-zinc-800', 'text-white');
            flux2Btn.classList.remove('bg-white', 'text-black');
            flux2Btn.classList.add('bg-zinc-800', 'text-white');
            await saveSettings({ i2i_model: 'klein' });
        }
    };
    flux2Btn.onclick = async () => {
        if (currentI2IModel !== 'flux2') {
            currentI2IModel = 'flux2';
            flux2Btn.classList.add('bg-white', 'text-black');
            flux2Btn.classList.remove('bg-zinc-800', 'text-white');
            editKleinBtn.classList.remove('bg-white', 'text-black');
            editKleinBtn.classList.add('bg-zinc-800', 'text-white');
            await saveSettings({ i2i_model: 'flux2' });
        }
    };

    // Library video playback buttons
    libvid1stBtn.onclick = async () => {
        if (libraryVideoPlayback !== '1st_frame') {
            libraryVideoPlayback = '1st_frame';
            libvid1stBtn.classList.add('bg-white', 'text-black');
            libvid1stBtn.classList.remove('bg-zinc-800', 'text-white');
            libvidPlayBtn.classList.remove('bg-white', 'text-black');
            libvidPlayBtn.classList.add('bg-zinc-800', 'text-white');
            await saveSettings({ library_video_playback: '1st_frame' });
            applyLibraryVideoPlaybackToCards();
        }
    };
    libvidPlayBtn.onclick = async () => {
        if (libraryVideoPlayback !== 'play_loop') {
            libraryVideoPlayback = 'play_loop';
            libvidPlayBtn.classList.add('bg-white', 'text-black');
            libvidPlayBtn.classList.remove('bg-zinc-800', 'text-white');
            libvid1stBtn.classList.remove('bg-white', 'text-black');
            libvid1stBtn.classList.add('bg-zinc-800', 'text-white');
            await saveSettings({ library_video_playback: 'play_loop' });
            applyLibraryVideoPlaybackToCards();
        }
    };
}

// ==================== STORY MODE (large wizard overlay) ====================
// Implements the full director workflow per the approved plan.
// State lives in currentStory (and is round-tripped to currentProject.story on save drafts / apply).

function updateStoryButtonLabel() {
    const label = document.getElementById('story-btn-label');
    if (!label || !currentProject) return;
    const hasStory = !!(currentProject.story && (currentProject.story.scenes || []).length);
    label.textContent = hasStory ? 'Edit Story' : 'Create Story';
}

function showStoryMode() {
    if (!currentProject) {
        alert('Open a project first to use Story Mode.');
        return;
    }

    // Hydrate working copy
    currentStory = currentProject.story ? JSON.parse(JSON.stringify(currentProject.story)) : {
        original_prompt: '',
        characters: [],
        scenes: [],
        total_duration: (projectDuration || 60),
        created: new Date().toISOString(),
        last_updated: new Date().toISOString()
    };

    // Remove any previous
    const old = document.getElementById('story-mode-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'story-mode-overlay';
    overlay.className = 'fixed inset-0 bg-black/90 z-[400] flex items-center justify-center p-4 overflow-auto';
    overlay.innerHTML = `
        <div class="bg-zinc-900 rounded-2xl w-full max-w-[1100px] max-h-[92vh] flex flex-col border border-zinc-700 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-3 border-b border-zinc-700">
                <div class="flex items-center gap-x-3">
                    <i class="fa-solid fa-book-open text-emerald-400 text-xl"></i>
                    <div>
                        <div class="font-semibold">Story Mode</div>
                        <div class="text-[10px] text-zinc-500 -mt-0.5">Natural language → scenes → images + videos → timeline</div>
                    </div>
                </div>
                <div class="flex items-center gap-x-2 text-sm">
                    <button id="story-save-draft" class="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700">Save Draft</button>
                    <button id="story-apply" class="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 font-medium">Apply to Timeline</button>
                    <button id="story-close" class="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700">Close</button>
                </div>
            </div>

            <!-- Stepper -->
            <div class="px-5 pt-3 pb-2 border-b border-zinc-800 flex gap-2 text-xs" id="story-stepper">
                <div data-step="1" class="story-step px-3 py-1 rounded-full bg-zinc-800 text-emerald-400 cursor-pointer">1. Story + Characters</div>
                <div data-step="2" class="story-step px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer">2. Params</div>
                <div data-step="3" class="story-step px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer">3. Scene Outline</div>
                <div data-step="4" class="story-step px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer">4. Detailed Prompts</div>
                <div data-step="5" class="story-step px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer">5. Images</div>
                <div data-step="6" class="story-step px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer">6. Videos</div>
            </div>

            <!-- Content area (swapped by step) -->
            <div id="story-content" class="flex-1 overflow-auto p-5 min-h-[420px]"></div>

            <div class="px-5 py-3 border-t border-zinc-700 text-[10px] text-zinc-500 flex justify-between">
                <div>LoRAs from your ComfyUI models/loras folder are used for character consistency. All generated assets go to your library.</div>
                <div id="story-status" class="text-emerald-400"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Wire basic chrome
    overlay.querySelector('#story-close').onclick = () => {
        // persist draft on close
        if (currentStory && currentProject) {
            currentProject.story = JSON.parse(JSON.stringify(currentStory));
            saveProjectToServer(currentProject).then(() => {
                renderSidebarProjectList();
                updateStoryButtonLabel();
            });
        }
        overlay.remove();
    };
    overlay.querySelector('#story-save-draft').onclick = async () => {
        if (currentStory && currentProject) {
            currentProject.story = JSON.parse(JSON.stringify(currentStory));
            await saveProjectToServer(currentProject);
            renderSidebarProjectList();
            updateStoryButtonLabel();
            const st = document.getElementById('story-status');
            if (st) { st.textContent = 'Draft saved'; setTimeout(() => st.textContent='', 1200); }
        }
    };
    overlay.querySelector('#story-apply').onclick = () => applyCurrentStoryToTimeline(overlay);

    // Stepper clicks
    overlay.querySelectorAll('.story-step').forEach(el => {
        el.onclick = () => renderStoryStep(parseInt(el.dataset.step, 10), overlay);
    });

    // Initial step
    renderStoryStep(1, overlay);

    // Update header button label while open (defensive)
    updateStoryButtonLabel();
}

// Very small helper to set status text inside the wizard
function setStoryStatus(msg, isError = false) {
    const el = document.getElementById('story-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = isError ? 'text-red-400' : 'text-emerald-400';
}

function renderStoryStep(step, overlay) {
    const content = overlay.querySelector('#story-content');
    if (!content || !currentStory) return;

    // highlight active step
    overlay.querySelectorAll('.story-step').forEach(s => {
        const n = parseInt(s.dataset.step, 10);
        if (n === step) {
            s.classList.add('bg-emerald-600', 'text-white');
            s.classList.remove('bg-zinc-800', 'hover:bg-zinc-700');
        } else {
            s.classList.remove('bg-emerald-600', 'text-white');
            s.classList.add('bg-zinc-800', 'hover:bg-zinc-700');
        }
    });

    content.innerHTML = '';

    if (step === 1) {
        // Story + Characters (already functional from skeleton)
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-5">
                <div>
                    <label class="block text-xs text-zinc-400 mb-1">Story / Concept (natural language)</label>
                    <textarea id="story-text" class="w-full h-40 bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm" placeholder="A cyberpunk courier races through rain-soaked neon streets to deliver a data chip before midnight...">${currentStory.original_prompt || ''}</textarea>
                    <p class="text-[10px] text-zinc-500 mt-1">Describe the whole story. The model will break it into timed scenes.</p>
                </div>
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="text-xs text-zinc-400">Characters (with LoRAs for consistency)</label>
                        <button id="add-char-btn" class="px-2 py-0.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600">+ Add Character</button>
                    </div>
                    <div id="story-char-list" class="space-y-2 max-h-[260px] overflow-auto pr-1"></div>
                </div>
            </div>
            <div class="mt-4 text-[10px] text-zinc-500">Tip: Use strong, specific descriptions + the exact trigger words that were used when training the LoRA.</div>
        `;

        const ta = content.querySelector('#story-text');
        ta.oninput = () => { currentStory.original_prompt = ta.value; };

        const listEl = content.querySelector('#story-char-list');
        function renderChars() {
            listEl.innerHTML = '';
            (currentStory.characters || []).forEach((ch, idx) => {
                const row = document.createElement('div');
                row.className = 'bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-sm';
                row.innerHTML = `
                    <div class="flex gap-2 items-start">
                        <input class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value="${ch.name || ''}" placeholder="Name (e.g. Detective)">
                        <input class="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value="${(ch.lora_strength !== undefined ? ch.lora_strength : 0.8)}" step="0.05" type="number">
                        <button class="px-2 text-red-400 hover:text-red-500" title="Remove">✕</button>
                    </div>
                    <textarea class="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs h-12" placeholder="Short visual description">${ch.description || ''}</textarea>
                    <div class="mt-1 flex gap-2 items-center">
                        <select class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs lora-sel"></select>
                        <span class="text-[10px] text-zinc-500">LoRA + strength</span>
                    </div>
                    <input class="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs" placeholder="Optional trigger words (comma separated)" value="${ch.trigger_words || ''}">
                `;
                const nameIn = row.querySelector('input');
                nameIn.onchange = () => { ch.name = nameIn.value.trim(); };
                const strIn = row.querySelectorAll('input')[1];
                strIn.onchange = () => { ch.lora_strength = parseFloat(strIn.value) || 0.8; };
                const descTa = row.querySelector('textarea');
                descTa.onchange = () => { ch.description = descTa.value.trim(); };
                const trigIn = row.querySelectorAll('input')[2];
                trigIn.onchange = () => { ch.trigger_words = trigIn.value.trim(); };
                row.querySelector('button').onclick = () => {
                    currentStory.characters.splice(idx, 1);
                    renderChars();
                };
                const sel = row.querySelector('.lora-sel');
                sel.innerHTML = `<option value="">No LoRA</option>` + (availableLoras || []).map(l => `<option value="${l}" ${ch.lora_filename === l ? 'selected' : ''}>${l}</option>`).join('');
                sel.onchange = () => { ch.lora_filename = sel.value || null; };
                listEl.appendChild(row);
            });
        }
        renderChars();
        content.querySelector('#add-char-btn').onclick = () => {
            currentStory.characters = currentStory.characters || [];
            currentStory.characters.push({
                id: 'char_' + Date.now().toString(36),
                name: 'New Character',
                description: '',
                lora_filename: null,
                lora_strength: 0.8,
                trigger_words: ''
            });
            renderChars();
        };

    } else if (step === 2) {
        const requestedNum = (currentStory.requested_num_scenes !== undefined ? currentStory.requested_num_scenes : 6);
        const requestedTarget = (currentStory.requested_total_duration !== undefined ? currentStory.requested_total_duration : (currentStory.total_duration || (projectDuration || 60)));
        const requestedStyle = (currentStory.requested_style !== undefined ? currentStory.requested_style : (currentStory.style || ''));

        content.innerHTML = `
            <div class="max-w-md">
                <label class="block text-xs text-zinc-400 mb-1">Number of scenes</label>
                <input id="num-scenes" type="number" class="w-24 bg-zinc-950 border border-zinc-700 rounded px-3 py-1" value="${requestedNum}">
                <p class="text-[10px] text-zinc-500 mt-1">Or leave at 0 / empty for the model to decide.</p>

                <label class="block text-xs text-zinc-400 mt-4 mb-1">Target total length (seconds)</label>
                <input id="target-secs" type="number" class="w-24 bg-zinc-950 border border-zinc-700 rounded px-3 py-1" value="${requestedTarget}">

                <label class="block text-xs text-zinc-400 mt-4 mb-1">Creative style / mood (optional)</label>
                <input id="story-style" class="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1" value="${requestedStyle}" placeholder="cinematic neon rain, high contrast, synthwave">
            </div>
            <div class="mt-6 text-xs text-zinc-400">These parameters guide Pass 1 (scene breakdown). You can still edit timings and descriptions in the next step.</div>
        `;
        const ns = content.querySelector('#num-scenes');
        const ts = content.querySelector('#target-secs');
        const st = content.querySelector('#story-style');

        ns.onchange = () => { currentStory.requested_num_scenes = parseInt(ns.value) || undefined; };
        ts.onchange = () => { 
            currentStory.requested_total_duration = parseFloat(ts.value) || undefined; 
            currentStory.total_duration = currentStory.requested_total_duration; 
        };
        st.onchange = () => { 
            currentStory.requested_style = st.value.trim(); 
            currentStory.style = currentStory.requested_style; 
        };

    } else if (step === 3) {
        // Scene Outline (Pass 1)
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-medium">Scene Outline (Pass 1 result — editable)</div>
                <div class="flex items-center gap-x-3">
                    <label class="flex items-center gap-x-1.5 text-xs text-zinc-400 cursor-pointer select-none" title="When checked, the full prompts sent to Ollama + the raw model reply will be shown in a dialog after the call (very useful for debugging non-JSON responses)">
                        <input type="checkbox" id="story-debug"> 
                        <span>Debug (show raw Ollama request/response)</span>
                    </label>
                    <button id="btn-break" class="px-3 py-1 text-sm rounded-full bg-emerald-600 hover:bg-emerald-500">Break Story into Scenes</button>
                </div>
            </div>
            <div id="scene-list" class="space-y-3"></div>
            <div class="mt-3 text-[10px] text-zinc-500">Edit title, high-level description or start_time/duration. Use "Generate Detailed Prompts" on the next step for rich Flux prompts.</div>
        `;
        content.appendChild(wrap);

        const listEl = wrap.querySelector('#scene-list');
        function renderSceneList() {
            listEl.innerHTML = '';
            (currentStory.scenes || []).forEach((sc, i) => {
                const card = document.createElement('div');
                card.className = 'bg-zinc-950 border border-zinc-700 rounded-xl p-3';
                card.innerHTML = `
                    <div class="flex gap-2 items-center text-sm mb-1">
                        <span class="font-mono text-emerald-400 w-5">#${sc.scene_number || (i+1)}</span>
                        <input class="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5" value="${sc.title || ''}">
                        <span class="text-zinc-400 text-xs">start</span>
                        <input type="number" step="0.1" class="w-16 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs" value="${(sc.start_time||0).toFixed(1)}">
                        <span class="text-zinc-400 text-xs">dur</span>
                        <input type="number" step="0.1" class="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs" value="${(sc.duration||6).toFixed(1)}">
                        <button class="ml-1 text-red-400 text-xs px-1" title="Delete scene">✕</button>
                    </div>
                    <textarea class="w-full h-12 bg-zinc-900 border border-zinc-700 rounded p-2 text-xs">${sc.high_level_description || ''}</textarea>
                `;
                const titleIn = card.querySelector('input');
                titleIn.onchange = () => { sc.title = titleIn.value.trim(); };
                const tInputs = card.querySelectorAll('input[type="number"]');
                tInputs[0].onchange = () => { sc.start_time = parseFloat(tInputs[0].value) || 0; };
                tInputs[1].onchange = () => { sc.duration = parseFloat(tInputs[1].value) || 6; };
                const descTa = card.querySelector('textarea');
                descTa.onchange = () => { sc.high_level_description = descTa.value.trim(); };
                card.querySelector('button').onclick = () => {
                    currentStory.scenes.splice(i, 1);
                    renderSceneList();
                };
                listEl.appendChild(card);
            });
        }
        renderSceneList();

        wrap.querySelector('#btn-break').onclick = async () => {
            const ok = await callStoryBreakdown();
            renderSceneList();
            if (ok) {
                // auto-advance hint
                setTimeout(() => {
                    const step4 = overlay.querySelector('[data-step="4"]');
                    if (step4) step4.click();
                }, 600);
            }
        };

    } else if (step === 4) {
        // Detailed Prompts (Pass 2)
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-medium">Rich Visual Prompts (Pass 2 — editable)</div>
                <button id="btn-gen-all-prompts" class="px-3 py-1 text-sm rounded-full bg-emerald-600 hover:bg-emerald-500">Generate Detailed Prompts</button>
            </div>
            <div id="prompt-list" class="space-y-3"></div>
        `;
        content.appendChild(wrap);

        const listEl = wrap.querySelector('#prompt-list');
        function renderPromptList() {
            listEl.innerHTML = '';
            (currentStory.scenes || []).forEach((sc, i) => {
                const card = document.createElement('div');
                card.className = 'bg-zinc-950 border border-zinc-700 rounded-xl p-3';
                card.innerHTML = `
                    <div class="text-xs text-emerald-400 mb-1">#${sc.scene_number || i+1} — ${sc.title || ''} (@${(sc.start_time||0).toFixed(1)}s)</div>
                    <textarea class="w-full h-20 bg-zinc-900 border border-zinc-700 rounded p-2 text-xs font-mono">${sc.prompt || ''}</textarea>
                    <div class="flex gap-2 mt-1">
                        <button class="text-xs px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 gen-one">Generate for this scene</button>
                    </div>
                `;
                const ta = card.querySelector('textarea');
                ta.onchange = () => { sc.prompt = ta.value.trim(); };
                card.querySelector('.gen-one').onclick = async () => {
                    await callScenePrompt(sc);
                    ta.value = sc.prompt || '';
                };
                listEl.appendChild(card);
            });
        }
        renderPromptList();

        wrap.querySelector('#btn-gen-all-prompts').onclick = async () => {
            const scenesToPrompt = (currentStory.scenes || []).filter(sc => !sc.prompt);
            const totalPrompts = scenesToPrompt.length;
            if (totalPrompts === 0) return;

            // Add a progress bar for bulk prompt generation
            let promptProgress = document.getElementById('prompt-gen-progress');
            if (!promptProgress) {
                promptProgress = document.createElement('div');
                promptProgress.id = 'prompt-gen-progress';
                promptProgress.className = 'mb-2 p-2 bg-zinc-800 rounded text-xs';
                // insert before the list
                listEl.parentNode.insertBefore(promptProgress, listEl);
            }

            for (let i = 0; i < totalPrompts; i++) {
                const sc = scenesToPrompt[i];
                const pct = Math.round(((i) / totalPrompts) * 100);
                promptProgress.innerHTML = `
                    <div>Generating detailed prompt ${i+1} of ${totalPrompts}...</div>
                    <div class="w-full bg-zinc-700 rounded h-1.5 mt-1">
                        <div class="bg-emerald-500 h-1.5 rounded" style="width: ${pct}%"></div>
                    </div>
                `;
                await callScenePrompt(sc);
                renderPromptList();
            }
            promptProgress.innerHTML = `<div class="text-emerald-400">All ${totalPrompts} detailed prompts generated.</div>`;
            setTimeout(() => {
                if (promptProgress && promptProgress.parentNode) promptProgress.parentNode.removeChild(promptProgress);
            }, 1200);
            setStoryStatus('Prompts generated. Move to Images step.');
        };

    } else if (step === 5) {
        // Images (4 options per scene)
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-medium">Generate &amp; Approve Keyframes (4 options per scene)</div>
                <button id="gen-all-images-btn" class="px-3 py-1 text-xs rounded-full bg-emerald-600 hover:bg-emerald-500">Generate All Images for All Scenes</button>
            </div>
            <div id="img-scenes" class="space-y-4"></div>
        `;
        content.appendChild(wrap);
        const listEl = wrap.querySelector('#img-scenes');

        (currentStory.scenes || []).forEach((sc, i) => {
            const card = document.createElement('div');
            card.className = 'bg-zinc-950 border border-zinc-700 rounded-xl p-3';
            card.innerHTML = `
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-emerald-400">#${sc.scene_number || i+1} ${sc.title || ''}</span>
                    <span class="text-zinc-500">${(sc.start_time||0).toFixed(1)}s — ${(sc.duration||6)}s</span>
                </div>
                <div class="text-[10px] text-zinc-400 mb-1 line-clamp-2">${(sc.prompt || sc.high_level_description || '').slice(0,160)}</div>
                <button class="mb-2 px-3 py-1 text-xs rounded-full bg-emerald-600 hover:bg-emerald-500 gen-imgs">Generate 4 Images</button>
                <div class="imgs-grid flex flex-wrap gap-2 min-h-[70px]"></div>
                <div class="text-[10px] text-zinc-500 mt-1">Click a thumbnail to approve it as the keyframe for this scene.</div>
            `;
            const grid = card.querySelector('.imgs-grid');
            card.querySelector('.gen-imgs').onclick = () => generateImagesForScene(sc, grid);
            // initial render if candidates exist
            if (sc.candidates && sc.candidates.length) renderSceneImages(sc, grid);
            listEl.appendChild(card);
        });

        const genAllBtn = wrap.querySelector('#gen-all-images-btn');
        if (genAllBtn) {
            genAllBtn.onclick = () => generateAllImagesForStory(overlay);
        }

    } else if (step === 6) {
        // Videos
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-medium">Generate Videos for Approved Scenes</div>
                <button id="gen-all-videos-btn" class="px-3 py-1 text-xs rounded-full bg-emerald-600 hover:bg-emerald-500">Generate All Videos for All Scenes</button>
            </div>
            <div id="vid-scenes" class="space-y-4"></div>
        `;
        content.appendChild(wrap);
        const listEl = wrap.querySelector('#vid-scenes');

        (currentStory.scenes || []).forEach((sc, i) => {
            const card = document.createElement('div');
            card.className = 'bg-zinc-950 border border-zinc-700 rounded-xl p-3';
            const hasImg = !!sc.selected_image_id;
            const hasVid = !!sc.video_id;
            card.innerHTML = `
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-emerald-400">#${sc.scene_number || i+1} ${sc.title || ''}</span>
                    <span class="text-zinc-500">${hasVid ? 'video ready' : (hasImg ? 'image approved — ready for video' : 'needs approved image')}</span>
                </div>
                <button class="px-3 py-1 text-xs rounded-full ${hasImg ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-800 cursor-not-allowed opacity-60'}" ${hasImg ? '' : 'disabled'}>Generate Video (${(sc.duration||6)}s)</button>
                <div class="text-[10px] text-zinc-500 mt-1">Uses the approved keyframe + scene prompt (music-reactive when project audio exists).</div>
            `;
            const btn = card.querySelector('button');
            btn.onclick = async () => {
                await generateVideoForScene(sc, card);
                // simple refresh of this card area
                renderStoryStep(6, overlay);
            };

            listEl.appendChild(card);

            // Render persistent small video preview in the card so it doesn't disappear
            if (hasVid && sc.video_id) {
                const vAsset = allAssets.find(a => a.id === sc.video_id);
                if (vAsset && vAsset.filename) {
                    const mediaBox = document.createElement('div');
                    mediaBox.className = 'mt-2 w-28 h-16 bg-zinc-900 border border-zinc-600 rounded overflow-hidden';
                    mediaBox.innerHTML = `<video src="/videos/${vAsset.filename}" class="w-full h-full object-cover" muted playsinline></video>`;
                    card.appendChild(mediaBox);

                    const vidEl = mediaBox.querySelector('video');
                    if (vidEl) {
                        vidEl.currentTime = 0;
                        vidEl.pause();
                    }

                    // Hover large preview on the small video
                    attachStoryHoverPreview(mediaBox, `/videos/${vAsset.filename}`, 'video');
                }
            }
        });

        const genAllBtn = wrap.querySelector('#gen-all-videos-btn');
        if (genAllBtn) {
            genAllBtn.onclick = () => generateAllVideosForStory(overlay);
        }
    }
}

async function applyCurrentStoryToTimeline(overlay) {
    if (!currentStory || !currentProject) return;
    setStoryStatus('Applying story to timeline...');

    // Best effort: persist latest story first
    currentProject.story = JSON.parse(JSON.stringify(currentStory));
    await saveProjectToServer(currentProject);

    try {
        const res = await fetch(`/projects/${currentProject.id}/apply-story-to-timeline`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ story: currentStory })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Apply failed');

        // Refresh local state from server response
        const fresh = data.project;
        if (fresh) {
            // Replace in the projects array
            const idx = projects.findIndex(p => p.id === fresh.id);
            if (idx >= 0) projects[idx] = fresh;
            currentProject = fresh;
        }

        if (overlay) overlay.remove();

        // Re-render everything timeline related
        await loadProjects(); // ensure sidebar fresh
        renderSidebarProjectList();
        showProjectEditor(); // re-inits audio + waveform + cues (will use the possibly extended audio_duration)
        renderCues();
        updateStoryButtonLabel();

        setTimeout(() => alert(`Applied ${data.cues_created || 0} scene(s) as cues. Play the timeline to preview.`), 50);
    } catch (e) {
        console.error(e);
        setStoryStatus('Apply failed: ' + (e.message || e), true);
        alert('Failed to apply story: ' + (e.message || e));
    }
}

// --- Story Mode backend calls + per-scene generation (reuses cue patterns heavily) ---

async function callStoryBreakdown() {
    if (!currentStory) return;
    const debugCheckbox = document.getElementById('story-debug');
    const debug = !!(debugCheckbox && debugCheckbox.checked);

    setStoryStatus('Calling Ollama Pass 1 (breaking story into scenes)...');
    const numScenesInput = document.getElementById('num-scenes');
    const targetSecsInput = document.getElementById('target-secs');
    const styleInput = document.getElementById('story-style');
    const body = {
        story_text: currentStory.original_prompt,
        characters: currentStory.characters || [],
        num_scenes: (currentStory.requested_num_scenes !== undefined ? currentStory.requested_num_scenes : (numScenesInput ? parseInt(numScenesInput.value) : undefined)) || undefined,
        target_seconds: (currentStory.requested_total_duration !== undefined ? currentStory.requested_total_duration : (targetSecsInput ? parseFloat(targetSecsInput.value) : undefined)) || currentStory.total_duration,
        style: (currentStory.requested_style !== undefined ? currentStory.requested_style : (styleInput ? styleInput.value : undefined)) || currentStory.style,
        debug: debug
    };
    try {
        const res = await fetch('/story/breakdown', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Breakdown failed');

        // If debug was requested, always show what actually went to Ollama + what came back
        if (debug && (data.debug || data.raw)) {
            showOllamaDebugDialog(data.debug, data.raw, data.error);
        }

        if (data.scenes && data.scenes.length) {
            currentStory.scenes = data.scenes;
            currentStory.last_updated = new Date().toISOString();
            setStoryStatus('Outline received — edit timings/descriptions then continue.');
            return true;
        } else if (data.raw) {
            setStoryStatus('Model returned non-JSON. You can edit scenes manually.', true);
            // still allow manual creation below
            return false;
        }
        throw new Error(data.error || 'No scenes returned');
    } catch (e) {
        console.error(e);
        setStoryStatus('Breakdown error: ' + e.message, true);
        // If debug mode was on, still try to surface whatever we got
        if (debug) {
            // In error case the raw might be in the exception or not available here; the dialog above only triggers on successful http
            // We can offer a generic message
        }
        return false;
    }
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
    // debugInfo (when debug checkbox was enabled) contains the real values from config.py:
    // {
    //   ollama_url, model,
    //   request: { url, method, body },   // <-- exactly what was POSTed to Ollama (note: "format":"json" is now OFF by default)
    //   system_prompt, user_prompt, raw_response
    // }
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-6';
    overlay.innerHTML = `
        <div class="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-[1100px] max-h-[85vh] flex flex-col shadow-2xl">
            <div class="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
                <div class="font-semibold text-emerald-400 flex items-center gap-x-2">
                    <i class="fa-solid fa-bug"></i>
                    <span>Ollama Debug — Exact Request Sent + Raw Response</span>
                </div>
                <button class="text-2xl leading-none px-2 text-zinc-400 hover:text-white" id="close-ollama-debug">×</button>
            </div>

            <div class="p-4 overflow-auto flex-1 text-sm space-y-4 font-mono">
                ${debugInfo ? `
                <div>
                    <div class="text-xs uppercase tracking-wider text-zinc-400 mb-1">Ollama Server (from your config.py)</div>
                    <div class="bg-zinc-950 p-2 rounded border border-zinc-800 whitespace-pre-wrap text-emerald-300">${escapeHtml(debugInfo.ollama_url || debugInfo.url || 'unknown')}</div>
                </div>

                <div>
                    <div class="text-xs uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
                        <span>Exact Request Body Sent to /api/generate</span>
                        <span>
                            <button class="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded mr-1" data-copy="full-request">Copy JSON Body</button>
                            <button class="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded" data-copy="curl">Copy as curl</button>
                        </span>
                    </div>
                    <pre class="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs overflow-auto max-h-[260px] text-emerald-200">${escapeHtml(JSON.stringify((debugInfo && debugInfo.request && debugInfo.request.body) || {error: 'no request body'}, null, 2))}</pre>
                </div>

                <div>
                    <div class="text-xs uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
                        <span>System Prompt (sent to Ollama)</span>
                        <button class="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded" data-copy="system">Copy</button>
                    </div>
                    <pre class="bg-zinc-950 p-3 rounded border border-zinc-800 whitespace-pre-wrap text-xs overflow-auto max-h-[180px] text-amber-200">${escapeHtml(debugInfo.system_prompt || '')}</pre>
                </div>

                <div>
                    <div class="text-xs uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
                        <span>User Prompt (sent to Ollama)</span>
                        <button class="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded" data-copy="user">Copy</button>
                    </div>
                    <pre class="bg-zinc-950 p-3 rounded border border-zinc-800 whitespace-pre-wrap text-xs overflow-auto max-h-[260px] text-sky-200">${escapeHtml(debugInfo.user_prompt || '')}</pre>
                </div>
                ` : ''}

                <div>
                    <div class="text-xs uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
                        <span>Raw Model Response (what Ollama actually returned)</span>
                        <button class="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded" data-copy="raw">Copy</button>
                    </div>
                    <pre class="bg-zinc-950 p-3 rounded border border-zinc-800 whitespace-pre-wrap text-xs overflow-auto max-h-[320px] text-red-200">${escapeHtml(rawText || ((debugInfo && debugInfo.raw_response) || '(no raw text)'))}</pre>
                </div>

                ${errorMsg ? `
                <div>
                    <div class="text-xs uppercase tracking-wider text-red-400 mb-1">Error / Note</div>
                    <div class="bg-red-950/40 border border-red-800 text-red-300 p-2 rounded text-xs">${escapeHtml(errorMsg)}</div>
                </div>` : ''}
            </div>

            <div class="px-4 py-3 border-t border-zinc-700 text-[10px] text-zinc-500 flex justify-between items-center">
                <div>Copy the "Exact Request Body" and paste it into Ollama's web UI (or use with curl) for perfect reproduction.</div>
                <button class="px-3 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700" id="close-ollama-debug2">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-ollama-debug').onclick = close;
    overlay.querySelector('#close-ollama-debug2').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // Copy buttons
    overlay.querySelectorAll('button[data-copy]').forEach(btn => {
        btn.onclick = () => {
            let textToCopy = '';
            const type = btn.dataset.copy;

            if (type === 'system' && debugInfo) textToCopy = debugInfo.system_prompt || '';
            if (type === 'user' && debugInfo) textToCopy = debugInfo.user_prompt || '';
            if (type === 'raw') textToCopy = rawText || ((debugInfo && debugInfo.raw_response) || '');

            if (type === 'full-request' && debugInfo && debugInfo.request) {
                // Copy the exact body that was POSTed, as clean JSON
                textToCopy = JSON.stringify(debugInfo.request.body, null, 2);
            }

            if (type === 'curl' && debugInfo && debugInfo.request) {
                const url = (debugInfo.request && debugInfo.request.url) || (debugInfo.ollama_url ? `${debugInfo.ollama_url}/api/generate` : 'http://localhost:11434/api/generate');
                const body = JSON.stringify((debugInfo.request && debugInfo.request.body) || {}, null, 2);
                textToCopy = `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
            }

            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const orig = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = orig; }, 1200);
                }).catch(() => {
                    // fallback
                    prompt('Copy this text:', textToCopy);
                });
            }
        };
    });
}

async function callScenePrompt(scene) {
    if (!currentStory || !scene) return null;
    setStoryStatus('Generating detailed prompt (Pass 2)...');
    const body = {
        story_text: currentStory.original_prompt,
        characters: currentStory.characters || [],
        scene,
        style: currentStory.style
    };
    try {
        const res = await fetch('/story/generate-prompt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.prompt) {
            scene.prompt = data.prompt;
            setStoryStatus('');
            return data.prompt;
        }
        setStoryStatus('Prompt gen error: ' + (data.error || 'unknown'), true);
        return null;
    } catch (e) {
        setStoryStatus('Prompt error: ' + e.message, true);
        return null;
    }
}

async function generateImagesForScene(scene, containerEl) {
    if (!scene || !currentProject) return;
    const prompt = (scene.prompt || currentStory.original_prompt || 'cinematic scene').trim();
    if (!prompt) {
        alert('Add a prompt (or generate one in step 4) first.');
        return;
    }

    const resolution = currentProject.resolution || '720p';
    const aspect = currentProject.aspect_ratio || '3:2';

    // Determine primary LoRA + strength from first character in this scene (if any)
    let loraName = null;
    let loraStr = 0.8;
    const charIds = scene.characters || [];
    const chars = (currentStory.characters || []).filter(c => charIds.includes(c.id));
    if (chars.length) {
        const primary = chars[0];
        loraName = primary.lora_filename || null;
        loraStr = primary.lora_strength != null ? primary.lora_strength : 0.8;
        // snapshot for "regenerate with same"
        scene.lora_name = loraName;
        scene.lora_strength = loraStr;
    }

    containerEl.innerHTML = '<div class="text-xs text-zinc-400 p-2 w-full text-center">Generating 4 images...</div>';

    const generatedFns = [];
    const savedIds = [];
    let lastW = 0, lastH = 0;

    try {
        const body = {
            prompt,
            resolution,
            aspect_ratio: aspect,
            mode: 'image',
            count: 4,
            image_model: currentImageModel,
            qwen_turbo: qwenTurbo,
            lora_name: loraName,
            lora_strength: loraStr
        };
        const resp = await fetch('/generate/stream', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
        });
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let idx = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value);
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
                if (evt.type === 'progress') {
                    const imgIdx = (evt.index !== undefined ? evt.index + 1 : (generatedFns.length + 1));
                    containerEl.innerHTML = `<div class="text-xs text-emerald-400 p-2">Generating image ${imgIdx}/4 ... ${evt.percent || 0}%</div>`;
                }
                if (evt.type === 'image_ready') {
                    generatedFns.push(evt.local_filename);
                    if (evt.width) lastW = evt.width;
                    if (evt.height) lastH = evt.height;
                }
            }
        }
    } catch (e) {
        console.error('story image gen', e);
        containerEl.innerHTML = '<div class="text-red-400 text-xs p-2">Generation failed</div>';
        return;
    }

    // Save each to history + allAssets (same pattern as cue gens)
    for (const fn of generatedFns) {
        if (!fn) continue;
        try {
            const saveRes = await saveGenerationToServer({
                prompt,
                filename: fn,
                type: 'image',
                aspect_ratio: aspect,
                width: lastW || 0,
                height: lastH || 0,
                parent_id: null,
                derived_from: []
            });
            const newA = {
                id: saveRes.id,
                type: 'image',
                prompt,
                filename: fn,
                width: lastW || 0,
                height: lastH || 0,
                aspect_ratio: aspect,
                parent_id: null,
                derived_from: [],
                favorite: false
            };
            if (!allAssets.some(a => a.id === newA.id)) allAssets.push(newA);
            savedIds.push(saveRes.id);
        } catch (e) { console.error('save story image', e); }
    }

    if (savedIds.length) {
        scene.candidates = savedIds;
        scene.selected_image_id = null; // user must pick
    }
    await saveProjectToServer(currentProject);

    // Render 4 pickable thumbs
    containerEl.innerHTML = '';
    const ar = (currentProject.aspect_ratio || '3:2').split(':').map(Number);
    const ratio = (ar[0] / ar[1]) || 1;
    savedIds.forEach((aid, i) => {
        const asset = allAssets.find(a => a.id === aid);
        if (!asset) return;
        const thumb = document.createElement('div');
        thumb.className = 'border border-zinc-600 rounded overflow-hidden cursor-pointer';
        thumb.style.width = '92px';
        thumb.style.height = Math.round(92 / ratio) + 'px';
        thumb.innerHTML = `<img src="/images/${asset.filename}" class="w-full h-full object-cover" />`;
        thumb.onclick = async () => {
            scene.selected_image_id = aid;
            scene.status = 'approved';
            await saveProjectToServer(currentProject);
            // refresh this container to show selection state
            renderSceneImages(scene, containerEl);
            setStoryStatus('Image selected for scene. Generate video or continue.');
        };
        containerEl.appendChild(thumb);
    });
}

async function generateAllImagesForStory(overlay) {
    if (!currentStory || !currentStory.scenes) return;
    const scenesNeedingImages = currentStory.scenes.filter(sc => sc.prompt && !sc.selected_image_id);
    if (scenesNeedingImages.length === 0) {
        alert('All scenes with prompts already have a selected image, or no prompts are ready.');
        return;
    }
    const totalScenesForImg = scenesNeedingImages.length;
    const imgScenesContainer = document.getElementById('img-scenes');
    let imgProgress = document.getElementById('img-gen-progress');
    if (!imgProgress && imgScenesContainer) {
        imgProgress = document.createElement('div');
        imgProgress.id = 'img-gen-progress';
        imgProgress.className = 'mb-2 p-2 bg-zinc-800 rounded text-xs';
        imgScenesContainer.parentNode.insertBefore(imgProgress, imgScenesContainer);
    }
    setStoryStatus(`Generating images for ${totalScenesForImg} scene(s)...`);
    for (let i = 0; i < totalScenesForImg; i++) {
        const sc = scenesNeedingImages[i];
        const overallPct = Math.round((i / totalScenesForImg) * 100);
        imgProgress.innerHTML = `
            <div>Generating images for scene ${i+1} of ${totalScenesForImg} (overall ${overallPct}%)</div>
            <div class="w-full bg-zinc-700 rounded h-1.5 mt-1">
                <div class="bg-emerald-500 h-1.5 rounded" style="width: ${overallPct}%"></div>
            </div>
        `;
        // Find or create a container in the current DOM if possible
        const existingCard = Array.from(document.querySelectorAll('#img-scenes > div')).find(c =>
            c.textContent.includes(sc.title || `#${sc.scene_number}`)
        );
        let grid = existingCard ? existingCard.querySelector('.imgs-grid') : null;
        if (!grid) {
            // Fallback: re-render after each (simpler but slower)
            await generateImagesForScene(sc, document.createElement('div')); // dummy to trigger logic
        } else {
            await generateImagesForScene(sc, grid);
        }
    }
    imgProgress.innerHTML = `<div class="text-emerald-400">All images for ${totalScenesForImg} scenes generated.</div>`;
    setTimeout(() => {
        if (imgProgress && imgProgress.parentNode) imgProgress.parentNode.removeChild(imgProgress);
    }, 1200);
    setStoryStatus('');
    renderStoryStep(5, overlay);
}

async function generateAllVideosForStory(overlay) {
    if (!currentStory || !currentStory.scenes) return;
    const scenesNeedingVideos = currentStory.scenes.filter(sc => sc.selected_image_id && !sc.video_id);
    if (scenesNeedingVideos.length === 0) {
        alert('No scenes ready for video (need approved image and no video yet).');
        return;
    }
    const totalScenesForVid = scenesNeedingVideos.length;
    const vidScenesContainer = document.getElementById('vid-scenes');
    let vidProgress = document.getElementById('vid-gen-progress');
    if (!vidProgress && vidScenesContainer) {
        vidProgress = document.createElement('div');
        vidProgress.id = 'vid-gen-progress';
        vidProgress.className = 'mb-2 p-2 bg-zinc-800 rounded text-xs';
        vidScenesContainer.parentNode.insertBefore(vidProgress, vidScenesContainer);
    }
    setStoryStatus(`Generating videos for ${totalScenesForVid} scene(s)...`);
    for (let i = 0; i < totalScenesForVid; i++) {
        const sc = scenesNeedingVideos[i];
        const overallPct = Math.round((i / totalScenesForVid) * 100);
        vidProgress.innerHTML = `
            <div>Generating video for scene ${i+1} of ${totalScenesForVid} (overall ${overallPct}%)</div>
            <div class="w-full bg-zinc-700 rounded h-1.5 mt-1">
                <div class="bg-emerald-500 h-1.5 rounded" style="width: ${overallPct}%"></div>
            </div>
        `;
        const existingCard = Array.from(document.querySelectorAll('#vid-scenes > div')).find(c =>
            c.textContent.includes(sc.title || `#${sc.scene_number}`)
        );
        await generateVideoForScene(sc, existingCard || null);
    }
    vidProgress.innerHTML = `<div class="text-emerald-400">All videos for ${totalScenesForVid} scenes generated.</div>`;
    setTimeout(() => {
        if (vidProgress && vidProgress.parentNode) vidProgress.parentNode.removeChild(vidProgress);
    }, 1200);
    setStoryStatus('');
    renderStoryStep(6, overlay);
}

async function generateVideoForScene(scene, cardEl = null) {
    if (!scene || !scene.selected_image_id || !currentProject) {
        alert('Select / generate an image for the scene first.');
        return;
    }
    const imgAsset = allAssets.find(a => a.id === scene.selected_image_id);
    if (!imgAsset || !imgAsset.filename) {
        alert('Selected image asset not found.');
        return;
    }

    const vprompt = (scene.prompt || imgAsset.prompt || 'cinematic motion') + ', smooth camera, music-driven pacing';
    const duration = Math.max(2, Math.min(30, Math.round(scene.duration || 6)));

    const body = {
        prompt: vprompt,
        resolution: currentProject.resolution || '720p',
        aspect_ratio: currentProject.aspect_ratio || '3:2',
        mode: 'video',
        duration,
        count: 1,
        source_image: imgAsset.filename,
        modifier_audio: currentProject.audio_filename || undefined,
        image_model: currentImageModel,
        qwen_turbo: qwenTurbo
    };

    // Update UI for this card if we have a reference
    let progressEl = null;
    let videoContainer = null;
    if (cardEl) {
        const btn = cardEl.querySelector('button');
        if (btn) btn.disabled = true;
        progressEl = document.createElement('div');
        progressEl.className = 'mt-2 text-xs';
        progressEl.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="flex-1 h-2 bg-zinc-800 rounded">
                    <div class="progress-bar h-2 bg-emerald-500 rounded transition-all" style="width:0%"></div>
                </div>
                <span class="progress-text w-8 text-right">0%</span>
            </div>
            <div class="text-[10px] text-zinc-400 mt-1">Generating video...</div>
        `;
        cardEl.appendChild(progressEl);
        videoContainer = document.createElement('div');
        videoContainer.className = 'mt-2 w-full aspect-video bg-black rounded overflow-hidden border border-zinc-700';
        cardEl.appendChild(videoContainer);
    } else {
        setStoryStatus('Generating video for scene...');
    }

    let videoFn = null;
    let vidW = 0, vidH = 0, vidDur = duration;
    try {
        const resp = await fetch('/generate/stream', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value);
            for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
                if (evt.type === 'progress' && progressEl) {
                    const pct = evt.percent || 0;
                    const bar = progressEl.querySelector('.progress-bar');
                    const txt = progressEl.querySelector('.progress-text');
                    if (bar) bar.style.width = `${pct}%`;
                    if (txt) txt.textContent = `${pct}%`;
                }
                if (evt.type === 'video_ready') {
                    videoFn = evt.local_filename;
                    if (evt.width) vidW = evt.width;
                    if (evt.height) vidH = evt.height;
                    if (evt.duration) vidDur = evt.duration;
                    if (videoContainer) {
                        videoContainer.innerHTML = `
                            <video src="/videos/${videoFn}" class="w-full h-full object-cover" muted playsinline></video>
                        `;
                        const v = videoContainer.querySelector('video');
                        if (v) {
                            v.currentTime = 0;
                            v.pause();
                            // Show first frame
                            v.onloadeddata = () => { v.currentTime = 0; };
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('scene video', e);
        if (progressEl) progressEl.innerHTML = '<div class="text-red-400 text-xs">Video gen error</div>';
        else setStoryStatus('Video gen error', true);
        return;
    }

    if (!videoFn) {
        if (progressEl) progressEl.innerHTML = '<div class="text-red-400 text-xs">No video produced</div>';
        else setStoryStatus('No video produced', true);
        return;
    }

    // Save video asset
    let savedId = null;
    try {
        const saveRes = await saveGenerationToServer({
            prompt: vprompt,
            filename: videoFn,
            type: 'video',
            aspect_ratio: currentProject.aspect_ratio || '3:2',
            width: vidW || 0,
            height: vidH || 0,
            duration: vidDur,
            parent_id: scene.selected_image_id,
            derived_from: scene.selected_image_id ? [scene.selected_image_id] : []
        });
        savedId = saveRes.id;
        const newV = {
            id: savedId, type: 'video', prompt: vprompt, filename: videoFn,
            width: vidW || 0,
            height: vidH || 0,
            aspect_ratio: currentProject.aspect_ratio || '3:2',
            parent_id: scene.selected_image_id,
            derived_from: scene.selected_image_id ? [scene.selected_image_id] : [],
            metadata: { duration: vidDur },
            favorite: false
        };
        if (!allAssets.some(a => a.id === savedId)) allAssets.push(newV);
    } catch (e) { console.error('save scene video', e); }

    if (savedId) {
        scene.video_id = savedId;
        scene.status = 'has_video';
    }
    await saveProjectToServer(currentProject);

    if (progressEl) {
        // Clean up progress, the video element (first frame) stays
        progressEl.remove();
        // Attach hover preview to the card for the new video
        const vAsset = allAssets.find(a => a.id === savedId);
        if (vAsset && cardEl) {
            attachStoryHoverPreview(cardEl, `/videos/${vAsset.filename}`, 'video');
        }
    } else {
        setStoryStatus('');
        setTimeout(() => setStoryStatus('Video ready for scene.'), 300);
    }

    // Refresh the step to update status text etc.
    // The caller in step 6 already does a re-render after, but for bulk it's handled outside.
}

// Re-renders the images area for a scene card (used after picking or after gen)
function renderSceneImages(scene, container) {
    if (!container) return;

    // Force cleanup of any stuck story hover previews. This can happen if the user clicks
    // to approve/select an image while the large hover preview is visible — the click handler
    // triggers a re-render (innerHTML='') which can orphan the preview div because the
    // original thumb's mouseleave may not fire reliably during the click + async save + DOM mutation.
    document.querySelectorAll('.story-hover-preview').forEach(el => el.remove());

    container.innerHTML = '';
    const ids = scene.candidates && scene.candidates.length ? scene.candidates : (scene.selected_image_id ? [scene.selected_image_id] : []);
    const arStr = (currentProject && currentProject.aspect_ratio) || '3:2';
    const [aw, ah] = arStr.split(':').map(n => parseFloat(n) || 1);
    const w = 82, h = Math.round(w * (ah / aw));

    ids.slice(0, 4).forEach(aid => {
        const asset = allAssets.find(a => a.id === aid);
        if (!asset) return;
        const d = document.createElement('div');
        d.style.width = w + 'px';
        d.style.height = h + 'px';
        d.className = 'border rounded overflow-hidden ' + (scene.selected_image_id === aid ? 'ring-2 ring-emerald-500' : 'border-zinc-600');
        d.innerHTML = `<img src="/images/${asset.filename}" class="w-full h-full object-cover" />`;
        d.onclick = async () => {
            scene.selected_image_id = aid;
            scene.status = 'approved';
            await saveProjectToServer(currentProject);
            renderSceneImages(scene, container);
        };
        // Hover large preview for images
        attachStoryHoverPreview(d, `/images/${asset.filename}`, 'image');
        container.appendChild(d);
    });
    if (!ids.length) {
        container.innerHTML = '<div class="text-[10px] text-zinc-500 px-2">No images yet — click Generate 4 Images</div>';
    }
}

function attachStoryHoverPreview(targetEl, src, type = 'image') {
    let preview = null;
    targetEl.addEventListener('mouseenter', (e) => {
        if (preview) preview.remove();
        preview = document.createElement('div');
        preview.className = 'fixed z-[600] pointer-events-none bg-black border border-zinc-600 rounded-xl shadow-2xl overflow-hidden story-hover-preview';
        preview.style.maxWidth = '480px';
        preview.style.maxHeight = '480px';

        // Position nicely next to the element, not following mouse
        const rect = targetEl.getBoundingClientRect();
        let left = rect.right + 12;
        let top = rect.top;

        // Adjust if would go off right edge
        if (left + 480 > window.innerWidth) {
            left = Math.max(12, rect.left - 12 - 480);
        }
        // Adjust vertical
        if (top + 480 > window.innerHeight) {
            top = Math.max(12, window.innerHeight - 480 - 12);
        }

        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;

        if (type === 'image') {
            preview.innerHTML = `<img src="${src}" class="max-w-full max-h-full object-contain" />`;
        } else {
            preview.innerHTML = `<video src="${src}" class="max-w-full max-h-full object-contain" muted playsinline autoplay loop></video>`;
        }
        document.body.appendChild(preview);
    });

    targetEl.addEventListener('mouseleave', () => {
        if (preview) {
            preview.remove();
            preview = null;
        }
    });

    // Also dismiss the preview on click (e.g. when selecting/approving the image while preview is visible).
    // This prevents the preview from "locking up" on screen if the click causes re-render of the grid
    // before a reliable mouseleave can fire on the old element.
    targetEl.addEventListener('click', () => {
        if (preview) {
            preview.remove();
            preview = null;
        }
    }, { once: true });
}

function openProjectPreviewFullscreen() {
    if (!currentProject) return;
    const currentTime = projectAudio ? projectAudio.currentTime : 0;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black z-[700] flex flex-col items-center justify-center';
    overlay.innerHTML = `
        <div class="absolute top-4 right-4 flex gap-2">
            <div class="text-white text-sm font-mono px-3 py-1 bg-black/50 rounded">${formatTimeWithFrames(currentTime)}</div>
            <button class="text-white text-3xl leading-none px-3 py-1 hover:text-emerald-400" title="Close (ESC)">×</button>
        </div>
        <div id="fs-media-container" class="w-[95vw] h-[95vh] flex items-center justify-center p-4"></div>
    `;
    document.body.appendChild(overlay);

    const container = overlay.querySelector('#fs-media-container');
    const closeBtn = overlay.querySelector('button');

    // Recreate the current preview media large (full browser size while preserving aspect ratio)
    const previewPane = document.getElementById('project-preview');
    if (previewPane) {
        const media = previewPane.querySelector('img, video');
        if (media) {
            const largeMedia = media.cloneNode(true);
            largeMedia.style.maxWidth = '100%';
            largeMedia.style.maxHeight = '100%';
            largeMedia.style.width = 'auto';
            largeMedia.style.height = 'auto';
            largeMedia.style.objectFit = 'contain';
            largeMedia.style.display = 'block';
            largeMedia.style.margin = '0 auto';
            // For video in fullscreen, allow user controls and set correct time
            if (largeMedia.tagName === 'VIDEO') {
                largeMedia.controls = true;
                largeMedia.muted = true;
                if (currentTime > 0) {
                    largeMedia.currentTime = currentTime;
                }
            }
            container.appendChild(largeMedia);
        } else {
            container.innerHTML = '<div class="text-zinc-400">No media at current time</div>';
        }
    } else {
        container.innerHTML = '<div class="text-zinc-400">No media at current time</div>';
    }

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
    };

    closeBtn.onclick = close;

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            close();
        }
    };
    document.addEventListener('keydown', escHandler);

    // Click outside the media to close (on the overlay bg)
    overlay.onclick = (e) => {
        if (e.target === overlay) close();
    };
}

function init() {
    // Load persisted image model choice first (so sendPrompt uses it for main gens)
    loadSettings().then(() => {
        if (currentImageModel !== 'schnell' && currentLora) {
            currentLora = null;
        }
    }).catch(() => {});
    // Load LoRAs list from ComfyUI (for Schnell LoRA feature in settings + main + picker)
    loadLoras().catch(() => {});

    // Load projects (for sidebar)
    loadProjects().then(() => {
        renderSidebarProjectList();
    }).catch(() => {});

    selectMode('image');

    const mainContent = document.getElementById('main-content');
    const placeholder = document.getElementById('placeholder');

    // NOTE: We no longer eagerly create #generations-container + .library-scroller here on startup.
    // This prevents any library UI from appearing (or flashing) while on the Home screen.
    // The container + scroller (with all the grey scrollbar + flex fixes) will be created on-demand
    // the first time the user clicks the Library button (inside showLibraryView's safety block).
    // This guarantees the "activated via button" path so the scrollbar works immediately.

    // We still call loadHistory early so allAssets are ready when the user decides to go to Library.
    loadHistory();

    // Inject the grey scrollbar CSS rules early (idempotent). The actual .library-scroller
    // element will only be created when the user first clicks Library.
    if (!document.getElementById('library-grey-scrollbar-style')) {
        const style = document.createElement('style');
        style.id = 'library-grey-scrollbar-style';
        style.textContent = `
            .library-scroller::-webkit-scrollbar {
                width: 8px;
                background: #333;
            }
            .library-scroller::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }
            .library-scroller::-webkit-scrollbar-thumb:hover {
                background: #aaa;
            }
        `;
        document.head.appendChild(style);
    }

    // Attach upload handler to the main page + button (in static HTML)
    setTimeout(() => {
        const mainBar = document.querySelector('.input-bar');
        if (mainBar) {
            const inputRow = mainBar.querySelector('.flex.items-center.gap-x-3');
            if (inputRow) {
                const plusBtn = inputRow.querySelector('button');
                if (plusBtn) {
                    plusBtn.onclick = showAssetUpload;
                }
            }
        }
    }, 10);

    // ==================== PROMPT INPUT HANDLER ====================
    const input = document.getElementById('prompt-input');

    // Prevent sending when ComfyUI is down (except for Chat which uses Ollama)
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            if (currentView === 'chat') {
                e.preventDefault();
                sendPrompt();
                return;
            }
            // Prevent sending if ComfyUI is down or input is disabled
            if (!isComfyConnected || input.disabled) {
                e.preventDefault();
                return;
            }
            sendPrompt();
        }
    });

    // Initialize ComfyUI status check
    initComfyStatusCheck();

    // Ensure rainbow border styles are present for generating states (library/detail/chat)
    ensureRainbowBorderStyles();

    // Default to Home view (centered logo). Stay on Home until the user explicitly clicks
    // the Library button in the sidebar. This prevents any automatic switch to the library
    // UI (and its scrollbar timing issues) on startup.
    showHomeView();

    // Initial enhancer label on the static main prompt bar + grey state from last status check
    setTimeout(() => {
        const et = document.getElementById('enhancer-text');
        if (et) {
            const cur = getEnhancerById(currentEnhancer);
            et.textContent = cur ? cur.name : 'No enhancement';
        }
        if (typeof window.isOllamaConnected !== 'undefined') {
            updateEnhancerUIState(window.isOllamaConnected);
        } else {
            // kick a status check which will call the updater via our wrapper
            checkServerStatuses().catch(() => {});
        }
    }, 80);
}

window.onload = init;