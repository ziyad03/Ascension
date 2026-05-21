import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/* ─────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cyan:    #06b6d4;
    --indigo:  #6366f1;
    --red:     #ef4444;
    --green:   #22c55e;
    --gold:    #fbbf24;
    --bg:      #04080f;
    --surface: rgba(8,14,28,0.82);
    --border:  rgba(255,255,255,0.065);
    --text:    #e2e8f0;
    --muted:   rgba(148,163,184,0.55);
    --r:       20px;
  }

  /* ── Root ── */
  .mr {
    min-height: 100svh;
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
    color: var(--text);
    padding: 1rem;
    position: relative;
    overflow-x: hidden;
  }

  /* ── Background atmosphere ── */
  .mr-bg {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
  }

  .mr-bg::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 5%  5%,  rgba(6,182,212,0.11)  0%, transparent 55%),
      radial-gradient(ellipse 50% 60% at 95% 95%, rgba(99,102,241,0.09)  0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 50% 0%,  rgba(251,191,36,0.06)  0%, transparent 55%),
      radial-gradient(ellipse 35% 45% at 80% 30%, rgba(239,68,68,0.04)   0%, transparent 55%);
  }

  .mr-grid {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(6,182,212,0.038) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,182,212,0.038) 1px, transparent 1px);
    background-size: 52px 52px;
    animation: gridDrift 45s linear infinite;
    mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black, transparent);
  }

  @keyframes gridDrift {
    0%   { background-position: 0 0, 0 0; }
    100% { background-position: 52px 52px, 52px 52px; }
  }

  .orb {
    position: fixed; border-radius: 50%;
    pointer-events: none; z-index: 0;
    filter: blur(90px);
    animation: orbFloat var(--dur,20s) ease-in-out infinite alternate;
  }

  .orb-1 { width:350px; height:350px; background:rgba(6,182,212,0.055);  top:-8%;   left:-8%;  --dur:22s; }
  .orb-2 { width:450px; height:450px; background:rgba(99,102,241,0.045); bottom:-12%; right:-8%; --dur:28s; }
  .orb-3 { width:250px; height:250px; background:rgba(251,191,36,0.035); top:30%;   right:25%; --dur:17s; }
  .orb-4 { width:200px; height:200px; background:rgba(239,68,68,0.03);   bottom:20%; left:20%; --dur:20s; }

  @keyframes orbFloat {
    from { transform: translate(0,0) scale(1); }
    to   { transform: translate(35px,45px) scale(1.08); }
  }

  /* ── Inner wrapper ── */
  .mr-inner {
    position: relative; z-index: 10;
    max-width: 1280px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 0.9rem;
  }

  /* ── Glass card ── */
  .gc {
    background: var(--surface);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid var(--border);
    border-radius: var(--r);
  }

  .gc-cyan   { border-color: rgba(6,182,212,0.22); }
  .gc-gold   { border-color: rgba(251,191,36,0.22); }
  .gc-indigo { border-color: rgba(99,102,241,0.22); }
  .gc-green  { border-color: rgba(34,197,94,0.22); }
  .gc-red    { border-color: rgba(239,68,68,0.22); }

  /* ── Header ── */
  .mod-header {
    display: flex; align-items: center;
    justify-content: space-between; flex-wrap: wrap; gap: 12px;
    padding: 0.9rem 1.4rem;
    animation: revealDown 0.6s cubic-bezier(.22,1,.36,1) both;
    position: relative; overflow: hidden;
  }

  .mod-header::after {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.5), transparent);
  }

  .brand { display: flex; align-items: center; gap: 12px; }

  .brand-logo {
    width: 44px; height: 44px; border-radius: 13px;
    background: linear-gradient(135deg, #0891b2, #6366f1);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(6,182,212,0.35);
    flex-shrink: 0; position: relative; overflow: hidden;
  }

  .brand-logo::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
  }

  .brand-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.6rem; letter-spacing: 0.08em; color: #f0f9ff; line-height: 1;
  }

  .brand-sub {
    font-size: 0.65rem; color: var(--muted);
    letter-spacing: 0.12em; text-transform: uppercase; margin-top: 1px;
  }

  /* Header right */
  .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  /* Session pill */
  .session-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 15px; border-radius: 999px;
    font-size: 0.73rem; font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase;
    border: 1px solid; transition: all 0.4s;
  }

  .session-pill.active  { background:rgba(34,197,94,0.1);  border-color:rgba(34,197,94,0.32);  color:#4ade80; }
  .session-pill.stopped { background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.28);  color:#f87171; }

  .sdot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    transition: background 0.4s, box-shadow 0.4s;
  }

  .sdot.active  { background:#4ade80; box-shadow:0 0 8px #4ade80; animation:blink 2s infinite; }
  .sdot.stopped { background:#f87171; }

  @keyframes blink { 0%,100%{opacity:1;box-shadow:0 0 8px currentColor} 50%{opacity:.4;box-shadow:none} }

  /* Circular timer in header */
  .timer-ring-wrap {
    position: relative; width: 68px; height: 68px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }

  .timer-ring-svg { width:68px; height:68px; transform:rotate(-90deg); }

  .timer-track { fill:none; stroke:rgba(6,182,212,0.12); stroke-width:3.5; }

  .timer-fill  {
    fill:none; stroke:url(#tGrad); stroke-width:3.5;
    stroke-linecap:round; transition:stroke-dashoffset 0.9s linear;
  }

  .timer-fill.danger { stroke:url(#tGradDanger); }

  .timer-val {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem; letter-spacing: 0.04em; color: #22d3ee; line-height: 1;
  }

  .timer-val.danger { color:#f87171; animation:pulseTxt 0.5s ease infinite alternate; }
  .timer-val-sub { font-size:0.42rem; letter-spacing:0.12em; color:var(--muted); text-transform:uppercase; margin-top:1px; }

  @keyframes pulseTxt { from{opacity:1} to{opacity:.45} }

  /* ── Controls bar ── */
  .controls-bar {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    animation: revealUp 0.5s 0.05s cubic-bezier(.22,1,.36,1) both;
  }

  @media (max-width: 520px) { .controls-bar { grid-template-columns: repeat(2,1fr); } }

  .ctrl-btn {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    min-height: 50px; border: none; border-radius: 13px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.83rem; font-weight: 600; cursor: pointer;
    transition: transform 0.15s, opacity 0.2s, box-shadow 0.25s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    position: relative; overflow: hidden;
  }

  .ctrl-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
    pointer-events: none;
  }

  .ctrl-btn::after {
    content: '';
    position: absolute; inset: 0;
    background: rgba(255,255,255,0.1);
    opacity: 0; transition: opacity 0.15s;
  }

  @media (hover:hover) { .ctrl-btn:hover::after { opacity:1; } }
  .ctrl-btn:active:not(:disabled) { transform: scale(0.96); }
  .ctrl-btn:disabled { opacity: 0.38; cursor: not-allowed; }

  .ctrl-btn.green  { background:linear-gradient(135deg,#16a34a,#14532d); color:#fff; box-shadow:0 4px 20px rgba(22,163,74,0.32); }
  .ctrl-btn.red    { background:linear-gradient(135deg,#dc2626,#7f1d1d); color:#fff; box-shadow:0 4px 20px rgba(220,38,38,0.32); }
  .ctrl-btn.blue   { background:linear-gradient(135deg,#2563eb,#1e3a8a); color:#fff; box-shadow:0 4px 20px rgba(37,99,235,0.28); }
  .ctrl-btn.indigo { background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; box-shadow:0 4px 20px rgba(99,102,241,0.32); }

  /* ── Current question banner ── */
  .cq-banner {
    padding: 1.2rem 1.5rem;
    animation: revealUp 0.45s 0.1s cubic-bezier(.22,1,.36,1) both;
    position: relative; overflow: hidden;
  }

  .cq-banner::before {
    content: '';
    position: absolute; top:0; left:0; right:0; height:1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.6), transparent);
  }

  .cq-banner::after {
    content: '';
    position: absolute; inset:0;
    background: radial-gradient(ellipse 60% 80% at 0% 50%, rgba(6,182,212,0.06), transparent);
    pointer-events: none;
  }

  .cq-label {
    font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(6,182,212,0.8); font-weight: 600;
    display: flex; align-items: center; gap: 7px; margin-bottom: 0.5rem;
  }

  .live-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: #22d3ee; box-shadow: 0 0 8px #22d3ee;
    animation: blink 1.5s infinite;
  }

  .cq-text {
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.05rem, 2.2vw, 1.4rem);
    font-weight: 700; color: #f0f9ff; line-height: 1.4;
  }

  .cq-tags { display:flex; gap:7px; flex-wrap:wrap; margin-top:0.65rem; }

  .ctag {
    padding: 3px 11px; border-radius: 999px;
    font-size: 0.65rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
  }

  .ctag-cat  { background:rgba(99,102,241,0.14); color:#a5b4fc; border:1px solid rgba(99,102,241,0.22); }
  .ctag-type { background:rgba(6,182,212,0.1);   color:#67e8f9; border:1px solid rgba(6,182,212,0.2); }
  .ctag-pts  { background:rgba(251,191,36,0.1);  color:#fbbf24; border:1px solid rgba(251,191,36,0.22); }

  /* ── 2-col main grid ── */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem;
  }

  @media (max-width: 800px) { .main-grid { grid-template-columns: 1fr; } }

  /* ── Panel ── */
  .panel { padding: 1.1rem 1.25rem; }

  .panel-hd {
    display: flex; align-items: center;
    justify-content: space-between; gap: 8px; margin-bottom: 0.9rem;
  }

  .panel-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.88rem; font-weight: 700; color: #f0f9ff;
    display: flex; align-items: center; gap: 8px;
  }

  .panel-icon {
    width: 32px; height: 32px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .count-badge {
    padding: 2px 10px; border-radius: 999px;
    font-size: 0.68rem; font-weight: 700;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(148,163,184,0.75);
  }

  /* Scrollable list */
  .scroll-list {
    max-height: 400px; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(6,182,212,0.2) transparent;
    padding-right: 3px;
  }

  .scroll-list::-webkit-scrollbar { width: 4px; }
  .scroll-list::-webkit-scrollbar-thumb { background:rgba(6,182,212,0.2); border-radius:4px; }

  /* Empty state */
  .empty-state {
    text-align: center; padding: 3rem 1rem;
    color: rgba(148,163,184,0.35); font-size: 0.82rem;
    display: flex; flex-direction: column;
    align-items: center; gap: 0.6rem;
  }

  /* ── Question item ── */
  .q-item {
    display: flex; align-items: center; gap: 10px;
    padding: 0.8rem 1rem;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.055);
    border-radius: 13px; cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.15s;
    text-align: left; width: 100%;
    -webkit-tap-highlight-color: transparent;
    position: relative; overflow: hidden;
  }

  .q-item::after {
    content: '';
    position: absolute; inset:0;
    background: linear-gradient(90deg, rgba(6,182,212,0.06), transparent);
    opacity: 0; transition: opacity 0.2s;
  }

  @media (hover:hover) {
    .q-item:not(:disabled):hover {
      background: rgba(6,182,212,0.07);
      border-color: rgba(6,182,212,0.22);
      transform: translateX(3px);
    }
    .q-item:not(:disabled):hover::after { opacity: 1; }
  }

  .q-item:active:not(:disabled) { transform: scale(0.99); }

  .q-item.active-q {
    background: rgba(6,182,212,0.1);
    border-color: rgba(6,182,212,0.38);
  }

  .q-item.active-q::before {
    content: '';
    position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, #06b6d4, #6366f1);
    border-radius: 0 2px 2px 0;
  }

  .q-item:disabled { opacity: 0.38; cursor: not-allowed; }

  .q-num {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: rgba(255,255,255,0.06);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.68rem; font-weight: 700; color: rgba(148,163,184,0.65);
    border: 1px solid rgba(255,255,255,0.07);
  }

  .q-body { flex:1; min-width:0; }

  .q-text {
    font-size: 0.82rem; font-weight: 500; color: #cbd5e1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .q-meta {
    display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap;
  }

  .qtag {
    font-size: 0.6rem; font-weight: 600; letter-spacing: 0.05em;
    text-transform: uppercase; padding: 2px 8px; border-radius: 999px;
  }

  .qtag-cat  { background:rgba(99,102,241,0.14); color:#a5b4fc; border:1px solid rgba(99,102,241,0.2); }
  .qtag-type { background:rgba(6,182,212,0.1);   color:#67e8f9; border:1px solid rgba(6,182,212,0.18); }

  .q-pts {
    margin-left: auto; flex-shrink: 0;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.05rem; letter-spacing: 0.04em; color: #fbbf24;
  }

  /* ── Answer card ── */
  .answer-card {
    background: rgba(255,255,255,0.028);
    border: 1px solid rgba(255,255,255,0.065);
    border-radius: 13px; padding: 0.9rem;
    animation: slideIn 0.3s cubic-bezier(.22,1,.36,1) both;
    position: relative; overflow: hidden;
  }

  .answer-card::before {
    content: '';
    position: absolute; top:0; left:0; right:0; height:1px;
    background: linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent);
  }

  @keyframes slideIn {
    from { opacity:0; transform:translateY(10px) scale(0.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }

  .answer-top {
    display: flex; align-items: center;
    justify-content: space-between; gap: 8px; margin-bottom: 0.6rem;
  }

  .team-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 999px;
    background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
    font-size: 0.7rem; font-weight: 600; color: #a5b4fc;
  }

  .team-chip-avatar {
    width: 18px; height: 18px; border-radius: 50%;
    background: linear-gradient(135deg,#6366f1,#0891b2);
    font-size: 0.58rem; font-weight: 800; color: #fff;
    display: flex; align-items: center; justify-content: center;
  }

  .answer-type-badge {
    font-size: 0.6rem; padding: 2px 8px; border-radius: 999px;
    background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.22);
    color: #fbbf24; font-weight: 600; letter-spacing: 0.04em; white-space: nowrap;
  }

  .answer-text {
    font-size: 0.84rem; color: #e2e8f0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 9px; padding: 8px 11px; margin-bottom: 0.7rem;
    line-height: 1.5;
  }

  .answer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .action-btn {
    min-height: 42px; border: none; border-radius: 11px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8rem; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: transform 0.15s, opacity 0.2s, box-shadow 0.2s;
    -webkit-tap-highlight-color: transparent;
    position: relative; overflow: hidden;
  }

  .action-btn::before {
    content: '';
    position: absolute; inset:0;
    background: linear-gradient(135deg,rgba(255,255,255,0.1),transparent);
    pointer-events: none;
  }

  .action-btn:active { transform: scale(0.95); }

  .action-btn.accept {
    background: linear-gradient(135deg,#16a34a,#14532d);
    color: #fff; box-shadow: 0 4px 14px rgba(22,163,74,0.35);
  }

  .action-btn.refuse {
    background: linear-gradient(135deg,#dc2626,#7f1d1d);
    color: #fff; box-shadow: 0 4px 14px rgba(220,38,38,0.32);
  }

  @media (hover:hover) {
    .action-btn.accept:hover { opacity:0.88; transform:translateY(-1px); }
    .action-btn.refuse:hover { opacity:0.88; transform:translateY(-1px); }
  }

  /* ── Leaderboard ── */
  .lb-section { padding: 1.1rem 1.25rem; }

  .lb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
    gap: 0.75rem; margin-top: 0.6rem;
  }

  .lb-card {
    padding: 1rem 1.1rem;
    background: rgba(255,255,255,0.028);
    border: 1px solid rgba(255,255,255,0.065);
    border-radius: 15px;
    transition: transform 0.25s cubic-bezier(.22,1,.36,1), border-color 0.25s;
    position: relative; overflow: hidden;
    animation: revealUp 0.5s cubic-bezier(.22,1,.36,1) both;
  }

  .lb-card:hover { transform: translateY(-4px); }

  .lb-card::before {
    content: '';
    position: absolute; top:0; left:0; right:0; height:2px;
    background: linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent);
    opacity: 0; transition: opacity 0.3s;
  }

  .lb-card:hover::before { opacity: 1; }

  .lb-rank {
    display: flex; align-items: center; gap: 5px;
    margin-bottom: 0.4rem;
  }

  .lb-rank-num {
    width: 22px; height: 22px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 700;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(148,163,184,0.6);
  }

  .lb-rank-num.gold   { background:rgba(251,191,36,0.15); color:#fbbf24; border-color:rgba(251,191,36,0.28); }
  .lb-rank-num.silver { background:rgba(148,163,184,0.1); color:#94a3b8; border-color:rgba(148,163,184,0.2); }
  .lb-rank-num.bronze { background:rgba(180,83,9,0.14);   color:#fb923c; border-color:rgba(180,83,9,0.24); }

  .lb-name {
    font-weight: 600; font-size: 0.88rem; color: #e2e8f0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 0.45rem;
  }

  .lb-score {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2rem; color: #fbbf24;
    line-height: 1; letter-spacing: 0.02em;
  }

  .lb-score-sub { font-size: 0.63rem; color: var(--muted); margin-top: 1px; }

  /* Score bar */
  .lb-bar {
    margin-top: 0.6rem; height: 3px;
    background: rgba(255,255,255,0.06);
    border-radius: 999px; overflow: hidden;
  }

  .lb-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #ef4444);
    border-radius: 999px;
    transition: width 0.8s cubic-bezier(.22,1,.36,1);
  }

  /* ── Keyframes ── */
  @keyframes revealDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes revealUp   { from{opacity:0;transform:translateY(24px)}  to{opacity:1;transform:translateY(0)} }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

  .p2-panel {
    padding: 1.1rem 1.25rem;
    display: grid;
    gap: 1rem;
    border-color: rgba(239,68,68,0.24);
    background:
      radial-gradient(ellipse 70% 90% at 100% 0%, rgba(239,68,68,0.08), transparent),
      rgba(8,14,28,0.88);
  }

  .p2-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .p2-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.98rem;
    font-weight: 800;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .p2-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
  }

  @media (max-width: 860px) { .p2-grid { grid-template-columns: 1fr; } }

  .p2-box {
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    border-radius: 14px;
    padding: 0.95rem;
    display: grid;
    gap: 0.7rem;
  }

  .p2-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .p2-mini {
    min-height: 38px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 0 12px;
    background: rgba(255,255,255,0.05);
    color: #e2e8f0;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
  }

  .p2-mini.red { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.28); color: #fecaca; }
  .p2-mini.green { background: rgba(34,197,94,0.13); border-color: rgba(34,197,94,0.27); color: #bbf7d0; }
  .p2-mini.gold { background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.26); color: #fde68a; }
  .p2-mini:disabled { opacity: 0.42; cursor: not-allowed; }

  .dev-panel {
    padding: 1rem 1.15rem;
    border-color: rgba(6,182,212,0.22);
    background:
      radial-gradient(ellipse 80% 100% at 0% 0%, rgba(6,182,212,0.08), transparent),
      rgba(8,14,28,0.92);
    display: grid;
    gap: 0.9rem;
  }

  .dev-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .dev-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.92rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .dev-sub {
    color: rgba(148,163,184,0.7);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dev-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }

  @media (max-width: 900px) { .dev-grid { grid-template-columns: 1fr; } }

  .dev-box {
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 13px;
    background: rgba(255,255,255,0.03);
    padding: 0.85rem;
    display: grid;
    gap: 0.6rem;
  }

  .dev-box-title {
    font-size: 0.78rem;
    color: #67e8f9;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }

  .dev-target {
    min-height: 38px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(2,6,23,0.7);
    color: #e2e8f0;
    padding: 0 10px;
    font-family: 'DM Sans', sans-serif;
  }

  .dev-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    border: 1px solid rgba(6,182,212,0.28);
    padding: 6px 12px;
    color: #67e8f9;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .p2-file {
    width: 100%;
    color: rgba(226,232,240,0.72);
    font-size: 0.78rem;
  }

  .p2-list {
    display: grid;
    gap: 0.5rem;
    max-height: 230px;
    overflow-y: auto;
  }

  .p2-challenge {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(15,23,42,0.7);
    color: #e2e8f0;
    border-radius: 11px;
    padding: 0.75rem;
    cursor: pointer;
  }

  .p2-challenge.active {
    border-color: rgba(239,68,68,0.44);
    box-shadow: 0 0 18px rgba(239,68,68,0.1);
  }

  .p2-challenge strong {
    display: block;
    font-size: 0.82rem;
    margin-bottom: 4px;
  }

  .p2-muted {
    color: rgba(148,163,184,0.68);
    font-size: 0.72rem;
  }
`;

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

/* ─────────────────────────────────────────────────────────────────
   CIRCULAR TIMER
───────────────────────────────────────────────────────────────── */
function CircularTimer({ value, max = 30 }) {
  const r      = 26;
  const circ   = 2 * Math.PI * r;
  const pct    = max > 0 ? Math.max(0, value / max) : 0;
  const offset = circ * (1 - pct);
  const danger = value <= 5 && value > 0;

  return (
    <div className="timer-ring-wrap">
      <svg className="timer-ring-svg" viewBox="0 0 68 68" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="tGradDanger" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <circle className="timer-track"  cx="34" cy="34" r={r} />
        <circle
          className={`timer-fill ${danger ? 'danger' : ''}`}
          cx="34" cy="34" r={r}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={`timer-val ${danger ? 'danger' : ''}`}>
        {value}
        <span className="timer-val-sub">sec</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────── */
export default function Moderator() {
  const [sessionActive,   setSessionActive]   = useState(false);
  const [questions,       setQuestions]       = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers,         setAnswers]         = useState([]);
  const [teams,           setTeams]           = useState([]);
  const [timer,           setTimer]           = useState(30);
  const [maxTimer,        setMaxTimer]        = useState(30);
  const [tournament,      setTournament]      = useState(null);
  const [packs,           setPacks]           = useState([]);
  const [csvFile,         setCsvFile]         = useState(null);
  const [csvPreview,      setCsvPreview]      = useState(null);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [challengeDraft,  setChallengeDraft]  = useState(null);
  const [editStatus,      setEditStatus]      = useState('');
  const [devStatus,       setDevStatus]       = useState({ enabled: false, panel: false });
  const [devPanelOpen,    setDevPanelOpen]    = useState(() => localStorage.getItem('crazy:dev-panel') === '1');
  const [devTeamTarget,   setDevTeamTarget]   = useState('');
  const [manualEliminationTarget, setManualEliminationTarget] = useState('');

  const socketRef = useRef(null);

  /* ── Socket ── */
  useEffect(() => {
    const socket = io(API_BASE);
    socketRef.current = socket;

    socket.emit('join', { room: 'session-1',         role: 'moderator' });
    socket.emit('join', { room: 'moderator-session', role: 'moderator' });

    socket.on('game:answer_received', (data) => setAnswers(prev => [...prev, data]));
    socket.on('score:refresh', (data) => setTeams(data.teams || []));
    socket.on('tournament:state', setTournament);
    socket.on('tournament:phase1_complete', setTournament);
    socket.on('tournament:phase2_started', setTournament);
    socket.on('phase2:challenge_started', setTournament);
    socket.on('phase2:submission_update', setTournament);
    socket.on('phase2:round_winner', setTournament);
    socket.on('phase2:hint_usage_update', setTournament);
    socket.on('phase2:pause_update', setTournament);
    socket.on('phase2:round_ended', setTournament);
    socket.on('phase2:round_timeout', setTournament);
    socket.on('phase2:round_skipped', setTournament);
    socket.on('phase2:team_eliminated', setTournament);
    socket.on('tournament:phase2_complete', setTournament);
    socket.on('tournament:dev_phase2_started', setTournament);
    socket.on('tournament:dev_phase3_started', setTournament);
    socket.on('tournament:dev_state_updated', setTournament);
    socket.on('tournament:dev_reset', setTournament);

    fetch(`${API_BASE}/api/questions`)
      .then(r => r.json())
      .then(setQuestions)
      .catch(() => {});

    fetch(`${API_BASE}/api/phase2/packs`)
      .then(r => r.json())
      .then(setPacks)
      .catch(() => {});

    fetch(`${API_BASE}/api/tournament/dev/status`)
      .then(r => r.json())
      .then(setDevStatus)
      .catch(() => {});

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!devStatus.enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setDevPanelOpen(prev => {
          const next = !prev;
          localStorage.setItem('crazy:dev-panel', next ? '1' : '0');
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [devStatus.enabled]);

  /* ── Timer ── */
  useEffect(() => {
    if (!sessionActive || timer <= 0) return;
    const id = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [sessionActive, timer]);

  /* ── Actions ── */
  const startSession = () => {
    setSessionActive(true);
    socketRef.current?.emit('game:start', { sessionId: 'session-1' });
  };

  const stopSession = () => {
    setSessionActive(false);
    setTimer(30); setMaxTimer(30);
    socketRef.current?.emit('game:stop', { sessionId: 'session-1' });
  };

  const sendQuestion = (q) => {
    setCurrentQuestion(q);
    socketRef.current?.emit('moderator:send_question', {
      question: q.text, options: q.options,
      type: q.type, points: q.points, timer: 30
    });
    setAnswers([]);
    setTimer(30);
    setMaxTimer(30);
  };

  const addTime = (s) => {
    setTimer(t => t + s);
    setMaxTimer(m => m + s);
  };

  const previewCsv = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    const res = await fetch(`${API_BASE}/api/phase2/packs/preview`, { method: 'POST', body: formData });
    setCsvPreview(await res.json());
  };

  const importCsv = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('name', csvFile.name.replace(/\.csv$/i, ''));
    const res = await fetch(`${API_BASE}/api/phase2/packs/import`, { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      setPacks(prev => [data.pack, ...prev]);
      setCsvPreview(null);
    } else {
      setCsvPreview(data);
    }
  };

  const saveChallengeEdit = async () => {
    if (!challengeDraft?.id || !challengeDraft?.packId) return;

    const res = await fetch(`${API_BASE}/api/phase2/packs/${challengeDraft.packId}/challenges/${challengeDraft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challengeDraft)
    });
    const data = await res.json();

    if (!res.ok) {
      setEditStatus(data.error || 'Erreur mise à jour');
      return;
    }

    setEditStatus('Challenge mis à jour');
    setPacks(prev => prev.map(pack => ({
      ...pack,
      challenges: (pack.challenges || []).map(challenge => challenge.id === data.challenge.id ? data.challenge : challenge)
    })));
    setSelectedChallenge(data.challenge);
    setChallengeDraft({
      id: data.challenge.id,
      packId: data.challenge.packId,
      question: data.challenge.question || '',
      answer: data.challenge.answer || '',
      hint: data.challenge.hint || '',
      category: data.challenge.category || '',
      difficulty: data.challenge.difficulty || 'Medium',
      points: data.challenge.points ?? 10,
      penalty: data.challenge.penalty ?? -1,
      timeLimit: data.challenge.timeLimit ?? 30
    });
  };

  const regenerateDraftHint = async () => {
    if (!challengeDraft?.id || !challengeDraft?.packId) return;

    const res = await fetch(`${API_BASE}/api/phase2/packs/${challengeDraft.packId}/challenges/${challengeDraft.id}/regenerate-hint`, {
      method: 'POST'
    });
    const data = await res.json();

    if (!res.ok) {
      setEditStatus(data.error || 'Erreur génération indice');
      return;
    }

    setChallengeDraft(prev => prev ? ({ ...prev, hint: data.hint }) : prev);
    setPacks(prev => prev.map(pack => ({
      ...pack,
      challenges: (pack.challenges || []).map(challenge => challenge.id === data.challenge.id ? data.challenge : challenge)
    })));
    setSelectedChallenge(data.challenge);
    setChallengeDraft({
      id: data.challenge.id,
      packId: data.challenge.packId,
      question: data.challenge.question || '',
      answer: data.challenge.answer || '',
      hint: data.challenge.hint || '',
      category: data.challenge.category || '',
      difficulty: data.challenge.difficulty || 'Medium',
      points: data.challenge.points ?? 10,
      penalty: data.challenge.penalty ?? -1,
      timeLimit: data.challenge.timeLimit ?? 30
    });
    setEditStatus('Indice régénéré');
  };

  const endPhase1 = () => socketRef.current?.emit('phase1:end');
  const skipPhase1 = () => socketRef.current?.emit('phase1:skip');
  const skipPhase3 = () => socketRef.current?.emit('dev:skip_phase3');
  const generateMockRankings = () => socketRef.current?.emit('dev:generate_mock_rankings');
  const resetTournament = () => socketRef.current?.emit('dev:reset_tournament');
  const simulateScores = () => socketRef.current?.emit('dev:simulate_scores');
  const forceQualification = () => devTeamTarget && socketRef.current?.emit('dev:force_qualification', { teamId: devTeamTarget });
  const forceElimination = () => devTeamTarget && socketRef.current?.emit('dev:force_elimination', { teamId: devTeamTarget });
  const startPhase2 = () => socketRef.current?.emit('phase2:start');
  const startPhase2Challenge = () => {
    if (!selectedChallenge) return;
    socketRef.current?.emit('phase2:start_challenge', { challengeId: selectedChallenge.id });
  };
  const pausePhase2 = () => socketRef.current?.emit('phase2:pause', { paused: !tournament?.phase2?.paused });
  const endRound = () => socketRef.current?.emit('phase2:end_round');
  const skipChallenge = () => socketRef.current?.emit('phase2:skip_challenge');
  const forceNextRound = () => socketRef.current?.emit('phase2:force_next_round');
  const revealHint = () => socketRef.current?.emit('phase2:reveal_hint');
  const regenerateHint = () => socketRef.current?.emit('phase2:regenerate_hint');
  const revealAnswer = () => socketRef.current?.emit('phase2:reveal_answer');
  const manualEliminate = () => manualEliminationTarget && socketRef.current?.emit('phase2:manual_eliminate', { teamId: manualEliminationTarget });
  const endPhase2 = () => socketRef.current?.emit('phase2:end');

  const validateAnswer = (answer, accepted) => {
  if (!socketRef.current) return;

  // Récupération sécurisée des données
  const teamId = answer.teamId || 'team-unknown';
  const points = accepted ? (answer.points || currentQuestion?.points || 10) : 0;

  console.log('Validation envoyée au backend:', { teamId, accepted, points });

  // Envoi précis des champs attendus par le backend
  socketRef.current.emit('answer:validate', {
    teamId,
    accepted,
    points
  });

  // Supprimer la réponse de l'interface après validation
  setAnswers(prev => prev.filter(a => a.id !== answer.id));
};
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const maxScore    = sortedTeams[0]?.score || 1;
  const rankClass   = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const devCandidates = tournament?.phase1?.rankings || sortedTeams;
  const phase2Monitoring = tournament?.phase2?.monitoring || {};
  const phase2Submissions = tournament?.phase2?.submissions || [];
  const phase2Penalties = phase2Monitoring.penaltyEvents || [];
  const phase2HintUsage = phase2Monitoring.hintUsageLog || [];
  const phase2Activity = phase2Monitoring.activityFeed || [];
  const phase2QualifiedTeams = tournament?.phase2?.qualifiedTeams || tournament?.phase1?.qualified || [];

  return (
    <>
      <style>{styles}</style>

      {/* Background */}
      <div className="mr-bg" />
      <div className="mr-grid" />
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="orb orb-3" /><div className="orb orb-4" />

      <div className="mr">
        <div className="mr-inner">

          {/* ── Header ── */}
          <div className="gc gc-cyan mod-header">
            <div className="brand">
              <div className="brand-logo">
                <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <p className="brand-name">Modérateur</p>
                <p className="brand-sub">Panneau de contrôle - Crazy Challenge</p>
              </div>
            </div>

            <div className="header-right">
              <div className={`session-pill ${sessionActive ? 'active' : 'stopped'}`}>
                <span className={`sdot ${sessionActive ? 'active' : 'stopped'}`} />
                {sessionActive ? 'Session active' : 'Session arrêtée'}
              </div>
              <CircularTimer value={timer} max={maxTimer} />
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="gc controls-bar">
            <button className="ctrl-btn green" onClick={startSession} disabled={sessionActive}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 9-14 9V3z"/>
              </svg>
              Lancer
            </button>
            <button className="ctrl-btn red" onClick={stopSession} disabled={!sessionActive}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Arrêter
            </button>
            <button className="ctrl-btn blue" onClick={() => { setTimer(30); setMaxTimer(30); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
              </svg>
              Reset
            </button>
            <button className="ctrl-btn indigo" onClick={() => addTime(30)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              +30 sec
            </button>
          </div>

          <div className="gc p2-panel">
            <div className="p2-head">
              <div>
                <div className="p2-title">
                  <span>P2</span>
                  Phase 2 - CSV Elimination Round
                </div>
                <p className="p2-muted">
                  {tournament?.phase === 'phase2'
                    ? `${tournament?.phase2?.scores?.length || 0} équipes en course · Round ${tournament?.phase2?.roundNumber || 0}`
                    : 'Terminez la Phase 1 pour verrouiller le Top 4.'}
                </p>
              </div>
              <div className="p2-actions">
                <button className="p2-mini gold" onClick={endPhase1}>Fin Phase 1</button>
                <button className="p2-mini red" onClick={startPhase2}>Démarrer Phase 2</button>
                <button className="p2-mini" onClick={pausePhase2}>{tournament?.phase2?.paused ? 'Reprendre' : 'Pause'}</button>
                <button className="p2-mini red" onClick={endPhase2}>Clôturer Phase 2</button>
              </div>
            </div>

            <div className="p2-grid">
              <div className="p2-box">
                <div className="panel-title">Import CSV</div>
                <input className="p2-file" type="file" accept=".csv,text/csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                <div className="p2-actions">
                  <button className="p2-mini" onClick={previewCsv} disabled={!csvFile}>Prévisualiser</button>
                  <button className="p2-mini green" onClick={importCsv} disabled={!csvFile}>Importer Pack</button>
                </div>
                {csvPreview && (
                  <div>
                    <p className="p2-muted">
                      {csvPreview.valid === false
                        ? `CSV invalide · Champs manquants: ${(csvPreview.missingFields || []).join(', ') || 'lignes incomplètes'}`
                        : `${csvPreview.count || 0} challenges prêts à importer`}
                    </p>
                    {csvPreview.rowErrors?.length > 0 && (
                      <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.35rem' }}>
                        {csvPreview.rowErrors.slice(0, 4).map((row) => (
                          <div key={row.row} className="p2-muted">
                            Ligne {row.row}: {row.missing.join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p2-box">
                <div className="panel-title">Contrôles Challenge</div>
                <div className="p2-actions">
                  <button className="p2-mini red" onClick={startPhase2Challenge} disabled={!selectedChallenge}>Lancer challenge</button>
                  <button className="p2-mini" onClick={endRound}>Fin round</button>
                  <button className="p2-mini" onClick={skipChallenge}>Passer challenge</button>
                  <button className="p2-mini" onClick={forceNextRound}>Round suivant</button>
                  <button className="p2-mini gold" onClick={revealHint}>Révéler indice</button>
                  <button className="p2-mini" onClick={regenerateHint}>Regénérer indice</button>
                  <button className="p2-mini red" onClick={revealAnswer}>Révéler réponse</button>
                </div>
                <p className="p2-muted">
                  Challenge actif: {tournament?.phase2?.currentChallenge?.question || 'aucun'}
                </p>
                <p className="p2-muted">
                  Pack actif: {tournament?.phase2?.currentPackName || 'aucun'} · Statut: {tournament?.phase2?.roundStatus || 'idle'}
                </p>
              </div>
            </div>

            <div className="p2-list">
              {packs.flatMap(pack => (pack.challenges || []).map(challenge => (
                <button
                  className={`p2-challenge ${selectedChallenge?.id === challenge.id ? 'active' : ''}`}
                  key={challenge.id}
                  onClick={() => {
                    setSelectedChallenge(challenge);
                    setChallengeDraft({
                      id: challenge.id,
                      packId: challenge.packId,
                      question: challenge.question || '',
                      answer: challenge.answer || '',
                      hint: challenge.hint || '',
                      category: challenge.category || '',
                      difficulty: challenge.difficulty || 'Medium',
                      points: challenge.points ?? 10,
                      penalty: challenge.penalty ?? -1,
                      timeLimit: challenge.timeLimit ?? 30
                    });
                    setEditStatus('');
                  }}
                >
                  <strong>{challenge.question}</strong>
                  <span className="p2-muted">
                    {pack.name} · {challenge.category} · {challenge.difficulty} · {challenge.points} pts · {challenge.penalty} pénalité
                  </span>
                </button>
              )))}
              {packs.length === 0 && <p className="p2-muted">Aucun challenge pack importé.</p>}
            </div>

            {challengeDraft && (
              <div className="p2-box" style={{ marginTop: '1rem' }}>
                <div className="panel-title">Édition du challenge</div>
                <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <textarea
                    value={challengeDraft.question}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, question: e.target.value }))}
                    rows={4}
                    style={{ gridColumn: '1 / -1', width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Question"
                  />
                  <input
                    value={challengeDraft.answer}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, answer: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Réponse"
                  />
                  <input
                    value={challengeDraft.category}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Catégorie"
                  />
                  <textarea
                    value={challengeDraft.hint}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, hint: e.target.value }))}
                    rows={3}
                    style={{ gridColumn: '1 / -1', width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Indice"
                  />
                  <select
                    value={challengeDraft.difficulty}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, difficulty: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                  <input
                    type="number"
                    value={challengeDraft.points}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, points: Number(e.target.value) }))}
                    style={{ width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Points"
                  />
                  <input
                    type="number"
                    value={challengeDraft.penalty}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, penalty: Number(e.target.value) }))}
                    style={{ width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Pénalité"
                  />
                  <input
                    type="number"
                    value={challengeDraft.timeLimit}
                    onChange={(e) => setChallengeDraft(prev => ({ ...prev, timeLimit: Number(e.target.value) }))}
                    style={{ width: '100%', background: 'rgba(15,23,42,0.55)', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '10px', padding: '0.85rem' }}
                    placeholder="Temps limite"
                  />
                </div>
                <div className="p2-actions" style={{ marginTop: '0.85rem' }}>
                  <button className="p2-mini" onClick={regenerateDraftHint}>Régénérer l'indice</button>
                  <button className="p2-mini green" onClick={saveChallengeEdit}>Sauvegarder</button>
                </div>
                {editStatus && <p className="p2-muted" style={{ marginTop: '0.55rem' }}>{editStatus}</p>}
              </div>
            )}

            <div className="p2-grid" style={{ marginTop: '1rem' }}>
              <div className="p2-box">
                <div className="panel-title">Match Controls</div>
                <select className="dev-target" value={manualEliminationTarget} onChange={e => setManualEliminationTarget(e.target.value)}>
                  <option value="">Choisir une équipe qualifiée</option>
                  {phase2QualifiedTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <div className="p2-actions" style={{ marginTop: '0.75rem' }}>
                  <button className="p2-mini red" onClick={manualEliminate} disabled={!manualEliminationTarget}>Éliminer l'équipe</button>
                </div>
              </div>

              <div className="p2-box">
                <div className="panel-title">Live Submissions</div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {phase2Submissions.length === 0 ? (
                    <p className="p2-muted">Aucune soumission reçue.</p>
                  ) : phase2Submissions.slice(-6).reverse().map((submission) => (
                    <div key={submission.id} className="p2-muted">
                      {submission.teamName} · {submission.correct ? `+${submission.points}` : `${submission.penalty}`} · {new Date(submission.timestamp).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p2-grid" style={{ marginTop: '1rem' }}>
              <div className="p2-box">
                <div className="panel-title">Pénalités</div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {phase2Penalties.length === 0 ? (
                    <p className="p2-muted">Aucune pénalité.</p>
                  ) : phase2Penalties.map((entry) => (
                    <div key={entry.id} className="p2-muted">
                      {entry.teamName} · {entry.penalty} · {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p2-box">
                <div className="panel-title">Demandes d'indice</div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {phase2HintUsage.length === 0 ? (
                    <p className="p2-muted">Aucune demande d'indice.</p>
                  ) : phase2HintUsage.map((entry) => (
                    <div key={entry.id} className="p2-muted">
                      {entry.teamName} · Round {entry.roundNumber} · {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p2-box">
                <div className="panel-title">Activité des équipes</div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {phase2Activity.length === 0 ? (
                    <p className="p2-muted">Aucune activité enregistrée.</p>
                  ) : phase2Activity.map((entry) => (
                    <div key={entry.id} className="p2-muted">
                      {entry.message} · {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {devStatus.enabled && devPanelOpen && (
            <div className="gc dev-panel">
              <div className="dev-head">
                <div>
                  <div className="dev-title">Development Testing Panel</div>
                  <div className="dev-sub">Raccourci d'ouverture: Ctrl + Alt + M</div>
                </div>
                <div className="dev-status">
                  {tournament?.development?.isSkipped ? 'Mock State Active' : 'Development Mode'}
                </div>
              </div>

              <div className="dev-grid">
                <div className="dev-box">
                  <div className="dev-box-title">Phase Injection</div>
                  <button className="p2-mini red" onClick={skipPhase1}>SKIP TO PHASE 2</button>
                  <button className="p2-mini red" onClick={skipPhase3}>SKIP TO PHASE 3</button>
                </div>

                <div className="dev-box">
                  <div className="dev-box-title">Mock Systems</div>
                  <button className="p2-mini" onClick={generateMockRankings}>Generate Mock Rankings</button>
                  <button className="p2-mini gold" onClick={simulateScores}>Simulate Scores</button>
                  <button className="p2-mini" onClick={resetTournament}>Reset Tournament</button>
                </div>

                <div className="dev-box">
                  <div className="dev-box-title">Manual Team State</div>
                  <select className="dev-target" value={devTeamTarget} onChange={e => setDevTeamTarget(e.target.value)}>
                    <option value="">Choisir une équipe</option>
                    {devCandidates.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <button className="p2-mini green" onClick={forceQualification} disabled={!devTeamTarget}>Force Qualification</button>
                  <button className="p2-mini red" onClick={forceElimination} disabled={!devTeamTarget}>Force Elimination</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Current question banner ── */}
          {currentQuestion && (
            <div className="gc gc-cyan cq-banner">
              <div className="cq-label">
                <span className="live-dot" />
                Question en cours
              </div>
              <p className="cq-text">{currentQuestion.text}</p>
              <div className="cq-tags">
                {currentQuestion.category && <span className="ctag ctag-cat">{currentQuestion.category}</span>}
                {currentQuestion.type     && <span className="ctag ctag-type">{currentQuestion.type}</span>}
                <span className="ctag ctag-pts">{currentQuestion.points} pts</span>
              </div>
            </div>
          )}

          {/* ── 2-col: Questions + Answers ── */}
          <div className="main-grid">

            {/* Questions */}
            <div className="gc gc-indigo panel">
              <div className="panel-hd">
                <div className="panel-title">
                  <div className="panel-icon" style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(79,70,229,0.2))' }}>
                    <svg width="16" height="16" fill="none" stroke="#a5b4fc" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                  </div>
                  Banque de questions
                </div>
                <span className="count-badge">{questions.length}</span>
              </div>

              <div className="scroll-list">
                {questions.length === 0 ? (
                  <div className="empty-state">
                    <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                      <circle cx="12" cy="12" r="1"/>
                    </svg>
                    Chargement des questions…
                  </div>
                ) : questions.map((q, i) => (
                  <button
                    key={q.id}
                    className={`q-item ${currentQuestion?.id === q.id ? 'active-q' : ''}`}
                    onClick={() => sendQuestion(q)}
                    disabled={!sessionActive}
                  >
                    <div className="q-num">{i + 1}</div>
                    <div className="q-body">
                      <div className="q-text">{q.text}</div>
                      <div className="q-meta">
                        {q.category && <span className="qtag qtag-cat">{q.category}</span>}
                        {q.type     && <span className="qtag qtag-type">{q.type}</span>}
                      </div>
                    </div>
                    <div className="q-pts">{q.points}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Answers */}
            <div className="gc gc-green panel">
              <div className="panel-hd">
                <div className="panel-title">
                  <div className="panel-icon" style={{ background:'linear-gradient(135deg,rgba(22,163,74,0.25),rgba(8,145,178,0.2))' }}>
                    <svg width="16" height="16" fill="none" stroke="#4ade80" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  Réponses reçues
                </div>
                <span className="count-badge">{answers.length}</span>
              </div>

              <div className="scroll-list">
                {answers.length === 0 ? (
                  <div className="empty-state">
                    <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    En attente de réponses…
                  </div>
                ) : answers.map((a, i) => (
                  <div key={i} className="answer-card">
                    <div className="answer-top">
                      <div className="team-chip">
                        <div className="team-chip-avatar">
                          {String(a.teamId).charAt(0).toUpperCase()}
                        </div>
                        Équipe {a.teamId}
                      </div>
                      {a.type && <span className="answer-type-badge">{a.type}</span>}
                    </div>
                    <div className="answer-text">{a.answer}</div>
                    <div className="answer-actions">
                      <button className="action-btn accept" onClick={() => validateAnswer(a, true)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Valider
                      </button>
                      <button className="action-btn refuse" onClick={() => validateAnswer(a, false)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Leaderboard ── */}
          <div className="gc gc-gold lb-section">
            <div className="panel-hd">
              <div className="panel-title">
                <div className="panel-icon" style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.25),rgba(239,68,68,0.18))' }}>
                  <svg width="16" height="16" fill="none" stroke="#fbbf24" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                  </svg>
                </div>
                Classement en direct
              </div>
              <span className="count-badge">{teams.length} équipes</span>
            </div>

            {sortedTeams.length === 0 ? (
              <div className="empty-state" style={{ paddingTop:'1.5rem', paddingBottom:'1.5rem' }}>
                <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                En attente des équipes…
              </div>
            ) : (
              <div className="lb-grid">
                {sortedTeams.map((team, i) => (
                  <div
                    key={team.id}
                    className="lb-card"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="lb-rank">
                      <div className={`lb-rank-num ${rankClass(i)}`}>
                        #{i + 1}
                      </div>
                    </div>
                    <div className="lb-name">{team.name}</div>
                    <div className="lb-score">{team.score}</div>
                    <div className="lb-score-sub">points</div>
                    <div className="lb-bar">
                      <div className="lb-bar-fill" style={{ width:`${(team.score / maxScore) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
