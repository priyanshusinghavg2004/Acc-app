import React, { useEffect, useRef, useState } from 'react';

// Lightweight, dependency-free tour guide with clickTarget support
// Props:
// - isOpen: boolean
// - steps: [{ id, title, text, selector?, placement?, route?, advanceMode?: 'button'|'clickTarget' }]
// - stepIndex: number
// - onStepChange(idx)
// - onClose()
// - onComplete()
// Behavior:
// - If step.route is present and the current hash doesn't match, navigation is caller's responsibility.
// - When advanceMode = 'clickTarget', clicking the target element advances to next step.

const defaultPlacement = 'bottom';

function getRectForSelector(selector) {
  try {
    if (!selector) return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { el, rect };
  } catch { return null; }
}

function MascotRupeeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe58a" />
          <stop offset="100%" stopColor="#f5c542" />
        </linearGradient>
      </defs>
      {/* Face */}
      <circle cx="22" cy="32" r="18" fill="#fbe9e7" stroke="#e0d5d3" />
      <circle cx="16" cy="28" r="2" fill="#333" />
      <circle cx="28" cy="28" r="2" fill="#333" />
      <path d="M14 36c2.5 3 9.5 3 12 0" stroke="#ff7aa2" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Cap */}
      <path d="M10 22c3-6 14-6 17 0" fill="#4f46e5" />
      <rect x="10" y="20" width="17" height="3" fill="#4338ca" />
      {/* Coin with Rupee */}
      <circle cx="48" cy="32" r="13" fill="url(#coinGrad)" stroke="#d4a62b" />
      <path d="M44 26h10M44 30h8M44 26c2 4 6 4 10 4-5 3-8 8-10 12" stroke="#7a5200" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function TourGuide({ isOpen, steps, stepIndex, onStepChange, onClose, onComplete, onSnooze }) {
  const [targetRect, setTargetRect] = useState(null);
  const activeStep = steps?.[stepIndex] || null;
  const observerRef = useRef(null);
  const clickListenerRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utterRef = useRef(null);
  // Voice selection is automatic; no UI or persistence needed
  const tipRef = useRef(null);
  const [manualPos, setManualPos] = useState(null);
  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const pendingSpeakRef = useRef('');

  // Prefer Hindi female voice and slightly faster rate
  function pickBestVoice(voices) {
    if (!voices || voices.length === 0) return null;
    const byName = (needle) => voices.find(v => new RegExp(needle, 'i').test(`${v.name} ${v.lang}`));
    // Prefer well-known Hindi female voices
    return (
      byName('Neerja') || byName('Sarika') || byName('Kajal') || byName('Hindi') ||
      voices.find(v => /hi/i.test(v.lang)) || byName('en-IN') || voices[0]
    );
  }

  function speak(text) {
    const synth = synthRef.current;
    if (!synth) return;
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    const voices = synth.getVoices ? synth.getVoices() : [];
    const preferred = pickBestVoice(voices);
    if (preferred) u.voice = preferred;
    u.lang = preferred?.lang || 'hi-IN';
    u.rate = 1.1; // slightly faster default
    u.pitch = 1;  // natural
    u.onend = () => setSpeaking(false);
    utterRef.current = u;
    setSpeaking(true);
    synth.cancel();
    synth.speak(u);
  }

  function stopSpeaking() {
    try {
      const synth = synthRef.current;
      if (synth) synth.cancel();
    } catch {}
    setSpeaking(false);
    pendingSpeakRef.current = '';
  }

  // Find and track target rect for current step
  useEffect(() => {
    if (!isOpen || !activeStep) return;
    const { selector } = activeStep;
    const updateRect = () => {
      const data = getRectForSelector(selector);
      if (data) {
        try { data.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
        setTargetRect(data.rect);
      } else {
        setTargetRect(null);
      }
    };
    updateRect();
    // Observe layout changes
    observerRef.current = new ResizeObserver(() => updateRect());
    observerRef.current.observe(document.body);
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    const id = setInterval(updateRect, 300);
    return () => {
      try { observerRef.current && observerRef.current.disconnect(); } catch {}
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(id);
    };
  }, [isOpen, stepIndex, activeStep]);

  // Reset manual position when step changes or tour reopens
  useEffect(() => { setManualPos(null); }, [stepIndex, isOpen]);

  // clickTarget advance handling (allowing clicks to pass through)
  useEffect(() => {
    if (!isOpen || !activeStep || activeStep.advanceMode !== 'clickTarget') return;
    const handler = (e) => {
      if (!activeStep.selector) return;
      const el = document.querySelector(activeStep.selector);
      if (el && (el === e.target || el.contains(e.target))) {
        // Slight delay to allow the original handler to run first
        setTimeout(() => {
          if (stepIndex < steps.length - 1) onStepChange(stepIndex + 1); else onComplete();
        }, 50);
      }
    };
    clickListenerRef.current = handler;
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isOpen, activeStep, stepIndex, steps, onStepChange, onComplete]);

  // Autoplay audio on step change (with retries for voice readiness)
  useEffect(() => {
    if (!isOpen || !activeStep) return;
    try {
      const text = `${activeStep.title || ''}. ${activeStep.text || ''}`;
      pendingSpeakRef.current = text;
      stopSpeaking();
      speak(text);
      // retry shortly in case voices are not yet ready or navigation swaps DOM
      const t1 = setTimeout(() => { if (isOpen && pendingSpeakRef.current) speak(pendingSpeakRef.current); }, 250);
      const t2 = setTimeout(() => { if (isOpen && pendingSpeakRef.current) speak(pendingSpeakRef.current); }, 800);
      const t3 = setTimeout(() => { if (isOpen && pendingSpeakRef.current) speak(pendingSpeakRef.current); }, 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex]);

  // Stop audio when tour closes or component unmounts
  useEffect(() => {
    if (!isOpen) stopSpeaking();
    return () => stopSpeaking();
  }, [isOpen]);

  // Retry speak when voices list becomes available
  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;
    const onVoices = () => {
      if (!isOpen) return;
      const pending = pendingSpeakRef.current;
      if (pending) {
        try { speak(pending); } catch {}
      }
    };
    try { synth.addEventListener && synth.addEventListener('voiceschanged', onVoices); } catch {}
    return () => { try { synth.removeEventListener && synth.removeEventListener('voiceschanged', onVoices); } catch {} };
  }, [isOpen]);

  // When hash changes during tour (e.g., step navigates to a tab), attempt to re-speak pending text
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => {
      const pending = pendingSpeakRef.current;
      if (pending) {
        setTimeout(() => speak(pending), 200);
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [isOpen]);

  if (!isOpen || !activeStep) return null;

  // Tooltip positioning
  const placement = activeStep.placement || defaultPlacement;
  const tipStyle = computeTooltipStyle(targetRect, placement);

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
      {/* Dim overlay (does not block clicks so clickTarget can pass-through) */}
      <div className="fixed inset-0 bg-black bg-opacity-50" style={{ pointerEvents: 'none' }} />

      {/* Spotlight outline */}
      {targetRect && (
        <div
          className="fixed border-2 border-yellow-400 rounded-lg shadow-lg animate-pulse"
          style={{
            left: `${Math.max(8, targetRect.left - 4)}px`,
            top: `${Math.max(8, targetRect.top - 4)}px`,
            width: `${Math.max(0, targetRect.width + 8)}px`,
            height: `${Math.max(0, targetRect.height + 8)}px`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip card */}
      <div ref={tipRef} className="fixed bg-white rounded-xl shadow-2xl p-4 w-96 max-w-[92vw]" style={{ ...(manualPos ? { left: manualPos.left, top: manualPos.top } : tipStyle), pointerEvents: 'auto' }}>
        <div className="flex justify-between items-start mb-2 cursor-move"
          onMouseDown={(e) => {
            try {
              const rect = tipRef.current?.getBoundingClientRect();
              dragRef.current.active = true;
              dragRef.current.offsetX = e.clientX - (rect?.left || 0);
              dragRef.current.offsetY = e.clientY - (rect?.top || 0);
              const onMove = (ev) => {
                if (!dragRef.current.active) return;
                const vw = window.innerWidth; const vh = window.innerHeight;
                let nx = ev.clientX - dragRef.current.offsetX;
                let ny = ev.clientY - dragRef.current.offsetY;
                const w = rect?.width || 384; const h = rect?.height || 160;
                nx = Math.max(8, Math.min(nx, vw - w - 8));
                ny = Math.max(8, Math.min(ny, vh - h - 8));
                setManualPos({ left: nx, top: ny });
              };
              const onUp = () => { dragRef.current.active = false; window.removeEventListener('mousemove', onMove, true); window.removeEventListener('mouseup', onUp, true); };
              window.addEventListener('mousemove', onMove, true);
              window.addEventListener('mouseup', onUp, true);
            } catch {}
          }}
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <MascotRupeeIcon />
            </div>
            <h3 className="text-base font-bold text-gray-900">{activeStep.title || 'Guide'}</h3>
          </div>
          <button className="text-gray-400 hover:text-gray-600" onClick={() => { stopSpeaking(); onClose && onClose(); }} aria-label="Close">×</button>
        </div>
        <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{activeStep.text || ''}</div>
        <div className="flex items-center gap-2 mb-3">
          <button
            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            onClick={() => {
              try {
                const synth = synthRef.current;
                if (!synth) return;
                if (speaking) {
                  synth.cancel();
                  setSpeaking(false);
                  return;
                }
                const text = `${activeStep.title || ''}. ${activeStep.text || ''}`;
                speak(text);
              } catch {}
            }}
          >
            {speaking ? 'Stop Audio' : 'Play Audio'}
          </button>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-500">Step {stepIndex + 1} / {steps.length}</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50" onClick={() => { stopSpeaking(); onClose && onClose(); }}>Skip</button>
            {onSnooze && (
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50" onClick={() => { stopSpeaking(); onSnooze(); }}>Remind later</button>
            )}
            {stepIndex > 0 && (
              <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50" onClick={() => { stopSpeaking(); onStepChange(stepIndex - 1); }}>Previous</button>
            )}
            {activeStep.advanceMode === 'clickTarget' ? (
              <button className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded" disabled>Click the highlighted element…</button>
            ) : (
              <button className={`px-3 py-1 text-sm rounded ${stepIndex < steps.length - 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
                onClick={() => {
                  stopSpeaking();
                  if (stepIndex < steps.length - 1) onStepChange(stepIndex + 1); else { onComplete && onComplete(); }
                }}
              >{stepIndex < steps.length - 1 ? 'Next' : 'Finish'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function computeTooltipStyle(rect, placement) {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Reserve extra safe space near bottom (e.g., OS taskbar or browser UI)
  const bottomSafeArea = 56; // px
  if (!rect) {
    // center
    return { left: `calc(50% - 10rem)`, top: `calc(50% - 6rem)` };
  }
  let left = rect.left;
  let top = rect.bottom + margin;
  if (placement === 'top') top = rect.top - margin - 140;
  if (placement === 'left') { left = rect.left - margin - 320; top = rect.top; }
  if (placement === 'right') { left = rect.right + margin; top = rect.top; }
  // clamp
  left = Math.max(8, Math.min(left, vw - 320 - 8));
  top = Math.max(8, Math.min(top, vh - 160 - 8 - bottomSafeArea));
  return { left: `${left}px`, top: `${top}px` };
}


