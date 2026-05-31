import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import TeamAvatar from '../components/TeamAvatar';
import TowerRail from '../components/TowerRail';
import { readTeamProfile } from '../components/teamIdentity';
import '../neon-quiz.css';

/* ─────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cyan:    #17e9ff;
    --indigo:  #3d2f82;
    --red:     #ef4444;
    --green:   #22c55e;
    --gold:    #fffde8;
    --bg:      #050341;
    --surface: rgba(6, 3, 63, 0.86);
    --border:  rgba(23,233,255,0.18);
    --text:    #fffde8;
    --muted:   rgba(255,253,232,0.62);
    --radius:  22px;
  }

  /* ── Root ── */
  .tr {
    min-height: 100svh;
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
    color: var(--text);
    padding: 1rem;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Background atmosphere ── */
  .tr-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .tr-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 60% at 10% 10%, rgba(6,182,212,0.13) 0%, transparent 55%),
      radial-gradient(ellipse 60% 70% at 90% 90%, rgba(99,102,241,0.11) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 50% 50%, rgba(239,68,68,0.05) 0%, transparent 70%);
  }

  /* Animated grid */
  .tr-grid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image:
      linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px);
    background-size: 52px 52px;
    animation: gridDrift 40s linear infinite;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
  }

  @keyframes gridDrift {
    0%   { background-position: 0 0, 0 0; }
    100% { background-position: 52px 52px, 52px 52px; }
  }

  /* Floating orbs */
  .orb {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    filter: blur(80px);
    animation: orbFloat var(--dur, 20s) ease-in-out infinite alternate;
  }

  .orb-1 { width: 300px; height: 300px; background: rgba(6,182,212,0.06); top: -5%; left: -5%; --dur: 18s; }
  .orb-2 { width: 400px; height: 400px; background: rgba(99,102,241,0.05); bottom: -10%; right: -5%; --dur: 24s; }
  .orb-3 { width: 200px; height: 200px; background: rgba(239,68,68,0.04); top: 40%; right: 20%; --dur: 15s; }

  @keyframes orbFloat {
    from { transform: translate(0, 0) scale(1); }
    to   { transform: translate(30px, 40px) scale(1.1); }
  }

  /* ── Layout wrapper ── */
  .tr-inner {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    flex: 1;
  }

  /* ── Desktop layout ── */
  @media (min-width: 900px) {
    .tr {
      padding: 1.5rem;
      align-items: stretch;
    }

    .tr-inner {
      max-width: 1100px;
      display: grid;
      grid-template-columns: 1fr 420px;
      grid-template-rows: auto auto 1fr auto;
      grid-template-areas:
        "header  header"
        "question buzz"
        "stats   buzz"
        "userbar userbar";
      gap: 1rem;
      align-items: start;
    }

    .area-header   { grid-area: header; }
    .area-question { grid-area: question; }
    .area-stats    { grid-area: stats; }
    .area-buzz     { grid-area: buzz; align-self: stretch; }
    .area-userbar  { grid-area: userbar; }
  }

  /* ── Glass card ── */
  .gc {
    background: var(--surface);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .gc-cyan   { border-color: rgba(6,182,212,0.22); }
  .gc-gold   { border-color: rgba(251,191,36,0.22); }
  .gc-indigo { border-color: rgba(99,102,241,0.22); }
  .gc-green  { border-color: rgba(34,197,94,0.22); }
  .gc-red    { border-color: rgba(239,68,68,0.22); }

  /* ── Header ── */
  .tr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0.9rem 1.25rem;
    animation: revealDown 0.6s cubic-bezier(.22,1,.36,1) both;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-logo {
    width: 42px; height: 42px;
    border-radius: 13px;
    background: linear-gradient(135deg, var(--cyan), var(--indigo));
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(6,182,212,0.35);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  .brand-logo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
    border-radius: inherit;
  }

  .brand-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.5rem;
    letter-spacing: 0.08em;
    color: #f0f9ff;
    line-height: 1;
  }

  .brand-sub {
    font-size: 0.65rem;
    color: var(--muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 1px;
  }

  /* Connection pill */
  .conn-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted);
    transition: border-color 0.3s, color 0.3s;
  }

  .conn-pill.online {
    border-color: rgba(34,197,94,0.3);
    color: rgba(74,222,128,0.85);
  }

  .conn-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .conn-dot.on  { background: #4ade80; box-shadow: 0 0 8px #4ade80; animation: blink 2s infinite; }
  .conn-dot.off { background: #f87171; }

  @keyframes blink {
    0%,100% { opacity: 1; box-shadow: 0 0 8px #4ade80; }
    50%     { opacity: 0.5; box-shadow: 0 0 4px #4ade80; }
  }

  /* ── Stats row ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 0.75rem;
    animation: revealUp 0.5s 0.1s cubic-bezier(.22,1,.36,1) both;
  }

  @media (max-width: 899px) {
    .stats-row { grid-template-columns: repeat(3,1fr); }
  }

  .stat-card {
    padding: 1.1rem 0.9rem;
    text-align: center;
    border-radius: 18px;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.3s;
  }

  .stat-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.03), transparent);
    pointer-events: none;
  }

  .stat-card:hover { transform: translateY(-4px); }

  .stat-icon-wrap {
    width: 42px; height: 42px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 0.65rem;
    position: relative;
  }

  .stat-icon-wrap::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
    pointer-events: none;
  }

  .stat-lbl {
    font-size: 0.67rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.3rem;
    font-weight: 500;
  }

  .stat-val {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.4rem;
    color: #f0f9ff;
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .stat-val.sm { font-size: 1.1rem; padding-top: 0.55rem; font-family: 'DM Sans', sans-serif; font-weight: 600; }
  .stat-val.danger { color: #f87171; animation: shake 0.4s ease; }

  .stat-unit {
    font-size: 0.9rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 400;
    color: var(--muted);
  }

  .stat-sub {
    font-size: 0.67rem;
    color: rgba(100,116,139,0.55);
    margin-top: 0.2rem;
  }

  @keyframes shake {
    0%,100% { transform: translateX(0); }
    25%     { transform: translateX(-3px); }
    75%     { transform: translateX(3px); }
  }

  /* score bump */
  .score-bump { animation: scorePop 0.4s cubic-bezier(.22,1,.36,1); }

  @keyframes scorePop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.22); }
    100% { transform: scale(1); }
  }

  .score-bump-up { animation: scoreUp 0.65s cubic-bezier(.22,1,.36,1); color: #4ade80 !important; }

  @keyframes scoreUp {
    0% { transform: scale(1); filter: brightness(1); }
    35% { transform: scale(1.28); filter: brightness(1.35); }
    100% { transform: scale(1); filter: brightness(1); }
  }

  .correct-flash {
    position: fixed;
    inset: 0;
    z-index: 80;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, rgba(34,197,94,0.22), transparent 55%);
    animation: correctFlash 0.9s ease forwards;
  }

  .correct-flash-inner {
    padding: 1rem 1.4rem;
    border-radius: 18px;
    border: 1px solid rgba(74,222,128,0.45);
    background: rgba(6,24,16,0.82);
    color: #bbf7d0;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow: 0 0 40px rgba(34,197,94,0.35);
    animation: correctPop 0.55s cubic-bezier(.22,1,.36,1);
  }

  @keyframes correctFlash {
    0% { opacity: 0; }
    15% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes correctPop {
    0% { transform: scale(0.85); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .timer-paused .timer-val { color: #fbbf24; }

  /* ── Circular timer ── */
  .timer-wrap {
    position: relative;
    width: 44px; height: 44px;
    margin: 0 auto 0.65rem;
  }

  .timer-svg { width: 44px; height: 44px; transform: rotate(-90deg); }

  .timer-track {
    fill: none;
    stroke: rgba(99,102,241,0.18);
    stroke-width: 3;
  }

  .timer-prog {
    fill: none;
    stroke: url(#timerGrad);
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.95s linear;
  }

  .timer-prog.danger { stroke: url(#timerGradDanger); }

  .timer-num {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1rem;
    letter-spacing: 0.02em;
    color: #f0f9ff;
  }

  .timer-num.danger { color: #f87171; animation: pulse-txt 0.5s ease infinite alternate; }

  @keyframes pulse-txt {
    from { opacity: 1; }
    to   { opacity: 0.5; }
  }

  /* ── Question card ── */
  .q-card {
    padding: 1.5rem 1.6rem;
    border-radius: var(--radius);
    animation: revealUp 0.5s 0.15s cubic-bezier(.22,1,.36,1) both;
    position: relative;
    overflow: hidden;
  }

  .q-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent);
  }

  .q-tags {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    margin-bottom: 0.9rem;
  }

  .qtag {
    padding: 3px 11px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .qtag-cat  { background: linear-gradient(135deg, #17e9ff, #3d2f82); color: #fff; }
  .qtag-pts  { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.28); }
  .qtag-easy { background: rgba(34,197,94,0.1);  color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
  .qtag-med  { background: rgba(251,191,36,0.1);  color: #fbbf24; border: 1px solid rgba(251,191,36,0.25); }
  .qtag-hard { background: rgba(239,68,68,0.1);   color: #f87171; border: 1px solid rgba(239,68,68,0.25); }

  .q-text {
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.1rem, 2.2vw, 1.5rem);
    font-weight: 700;
    color: #f0f9ff;
    line-height: 1.45;
  }

  .q-img {
    width: 100%;
    max-height: 220px;
    object-fit: cover;
    border-radius: 12px;
    margin-top: 1.1rem;
    border: 1px solid var(--border);
  }

  /* ── Buzz section ── */
  .buzz-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.1rem;
    padding: 2rem 1.25rem;
    border-radius: var(--radius);
    animation: revealUp 0.5s 0.2s cubic-bezier(.22,1,.36,1) both;
    position: relative;
    overflow: hidden;
  }

  /* Desktop: fill the column */
  @media (min-width: 900px) {
    .buzz-section {
      padding: 2.5rem 1.5rem;
      gap: 1.6rem;
    }
  }

  .buzz-section::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 60% at 50% 80%, rgba(239,68,68,0.05) 0%, transparent 70%);
    pointer-events: none;
  }

  .buzz-hint {
    font-size: 0.72rem;
    color: var(--muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-align: center;
  }

  /* The button */
  .buzz-btn {
    position: relative;
    cursor: pointer;
    border: none;
    background: none;
    padding: 0;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .buzz-btn:disabled { cursor: not-allowed; }

  /* Outer ripple rings */
  .buzz-rings {
    position: absolute;
    inset: -24px;
    border-radius: 50%;
    pointer-events: none;
  }

  .buzz-ring {
    position: absolute;
    inset: 0;
    border: 1.5px solid rgba(239,68,68,0.35);
    border-radius: 50%;
    animation: ringExpand var(--delay, 2.5s) ease-out infinite;
    animation-delay: var(--off, 0s);
  }

  .buzz-ring:nth-child(2) { --off: 0.8s; }
  .buzz-ring:nth-child(3) { --off: 1.6s; }

  .buzz-btn:disabled .buzz-ring,
  .buzz-btn.buzzed .buzz-ring { display: none; }

  @keyframes ringExpand {
    0%   { transform: scale(0.9); opacity: 0.6; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  /* Glow behind button */
  .buzz-glow {
    position: absolute;
    inset: -20px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(239,68,68,0.55) 0%, transparent 65%);
    filter: blur(20px);
    transition: opacity 0.4s, transform 0.4s;
    opacity: 0.7;
    pointer-events: none;
  }

  .buzz-btn:not(:disabled):hover .buzz-glow { opacity: 1; transform: scale(1.15); }
  .buzz-btn:disabled .buzz-glow { opacity: 0.15; }
  .buzz-btn.buzzed .buzz-glow {
    background: radial-gradient(circle, rgba(34,197,94,0.55) 0%, transparent 65%);
    opacity: 1;
  }

  /* Circle */
  .buzz-circle {
    position: relative;
    width: 160px; height: 160px;
    border-radius: 50%;
    background: linear-gradient(145deg, #ef4444, #be123c);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    box-shadow:
      0 0 0 6px rgba(239,68,68,0.1),
      0 0 0 12px rgba(239,68,68,0.05),
      0 16px 48px rgba(239,68,68,0.45),
      inset 0 1px 0 rgba(255,255,255,0.18),
      inset 0 -2px 8px rgba(0,0,0,0.2);
    transition:
      background 0.4s,
      box-shadow 0.4s,
      transform 0.15s cubic-bezier(.22,1,.36,1);
  }

  @media (min-width: 900px) {
    .buzz-circle { width: 190px; height: 190px; }
  }

  .buzz-btn:not(:disabled):hover .buzz-circle {
    transform: scale(1.05) translateY(-2px);
    box-shadow:
      0 0 0 6px rgba(239,68,68,0.14),
      0 0 0 14px rgba(239,68,68,0.06),
      0 22px 60px rgba(239,68,68,0.55),
      inset 0 1px 0 rgba(255,255,255,0.2),
      inset 0 -2px 8px rgba(0,0,0,0.25);
  }

  .buzz-btn:not(:disabled):active .buzz-circle { transform: scale(0.95); }

  .buzz-btn.buzzed .buzz-circle {
    background: linear-gradient(145deg, #22c55e, #15803d);
    box-shadow:
      0 0 0 6px rgba(34,197,94,0.12),
      0 0 0 12px rgba(34,197,94,0.05),
      0 16px 48px rgba(34,197,94,0.45),
      inset 0 1px 0 rgba(255,255,255,0.18),
      inset 0 -2px 8px rgba(0,0,0,0.2);
    animation: successShake 0.55s cubic-bezier(.22,1,.36,1);
  }

  @keyframes successShake {
    0%   { transform: scale(1) rotate(0deg); }
    20%  { transform: scale(0.9) rotate(-5deg); }
    60%  { transform: scale(1.1) rotate(4deg); }
    100% { transform: scale(1) rotate(0deg); }
  }

  .buzz-btn:disabled:not(.buzzed) .buzz-circle {
    background: linear-gradient(145deg, #374151, #1f2937);
    box-shadow:
      0 0 0 6px rgba(255,255,255,0.03),
      0 8px 24px rgba(0,0,0,0.3),
      inset 0 1px 0 rgba(255,255,255,0.06);
    opacity: 0.65;
  }

  .buzz-btn.frozen .buzz-glow {
    background: radial-gradient(circle, rgba(103,232,249,0.38) 0%, transparent 65%);
    opacity: 0.85;
    animation: freezeGlow 1.8s ease-in-out infinite;
  }

  .buzz-btn.frozen .buzz-circle {
    background:
      linear-gradient(145deg, rgba(125,211,252,0.95), rgba(30,41,59,0.96)),
      repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 12px);
    box-shadow:
      0 0 0 6px rgba(103,232,249,0.12),
      0 0 0 14px rgba(14,165,233,0.06),
      0 16px 48px rgba(14,165,233,0.28),
      inset 0 1px 0 rgba(255,255,255,0.3),
      inset 0 -10px 20px rgba(15,23,42,0.35);
    opacity: 1;
    animation: frozenBuzz 1.9s ease-in-out infinite;
  }

  .buzz-btn.frozen .buzz-circle::after {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.32);
    background:
      linear-gradient(30deg, transparent 44%, rgba(255,255,255,0.28) 45%, transparent 47%),
      linear-gradient(120deg, transparent 56%, rgba(255,255,255,0.22) 57%, transparent 59%);
    pointer-events: none;
  }

  .buzz-btn.frozen .buzz-label { color: #ecfeff; text-shadow: 0 0 14px rgba(103,232,249,0.8); }
  .buzz-btn.frozen .buzz-sub { color: rgba(236,254,255,0.78); }
  .buzz-btn.frozen .buzz-icon { transform: scale(0.92); opacity: 0.9; }

  @keyframes frozenBuzz {
    0%, 100% { transform: translateX(0) rotate(0deg); filter: saturate(0.8); }
    20% { transform: translateX(-2px) rotate(-1deg); }
    40% { transform: translateX(2px) rotate(1deg); }
    60% { transform: translateX(-1px) rotate(0deg); filter: saturate(1.15); }
    80% { transform: translateX(1px) rotate(0.5deg); }
  }

  @keyframes freezeGlow {
    0%, 100% { transform: scale(1); opacity: 0.55; }
    50% { transform: scale(1.12); opacity: 0.9; }
  }

  /* Scan line inside button */
  .buzz-scan {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    overflow: hidden;
    pointer-events: none;
  }

  .buzz-scan::after {
    content: '';
    position: absolute;
    top: -50%;
    left: 0; right: 0;
    height: 60%;
    background: linear-gradient(180deg, rgba(255,255,255,0.1), transparent);
    border-radius: 50%;
  }

  .buzz-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
    transition: transform 0.3s;
  }

  .buzz-btn:not(:disabled):hover .buzz-icon { transform: scale(1.12); }

  .buzz-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.3rem;
    letter-spacing: 0.1em;
    color: #fff;
    line-height: 1;
  }

  .buzz-sub {
    font-size: 0.62rem;
    color: rgba(255,255,255,0.65);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* Particles on buzz */
  .particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 50%;
  }

  .particle {
    position: absolute;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #4ade80;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    animation: particleFly var(--dur, 0.6s) var(--delay, 0s) ease-out forwards;
    --tx: var(--x, 0px);
    --ty: var(--y, 0px);
  }

  @keyframes particleFly {
    0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
    100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
  }

  /* Waiting state */
  .waiting-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 999px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    font-size: 0.76rem;
    color: var(--muted);
    animation: breathe 2.5s ease-in-out infinite;
  }

  @keyframes breathe {
    0%,100% { opacity: 0.6; transform: scale(1); }
    50%     { opacity: 1;   transform: scale(1.02); }
  }

  /* ── User bar ── */
  .user-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0.9rem 1.25rem;
    border-radius: var(--radius);
    animation: revealUp 0.5s 0.3s cubic-bezier(.22,1,.36,1) both;
  }

  .user-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--cyan), var(--indigo));
    display: flex; align-items: center; justify-content: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    letter-spacing: 0.05em;
    color: #fff;
    flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(6,182,212,0.3);
  }

  .user-name  { font-weight: 600; color: #e2e8f0; font-size: 0.9rem; }
  .user-role  { font-size: 0.7rem; color: var(--muted); margin-top: 1px; }

  .user-status {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.7rem;
    color: var(--muted);
  }

  /* ── Keyframes ── */
  @keyframes revealDown {
    from { opacity: 0; transform: translateY(-20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes revealUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Question transition ── */
  .q-enter { animation: qEnter 0.5s cubic-bezier(.22,1,.36,1) both; }

  @keyframes qEnter {
    from { opacity: 0; transform: translateY(30px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

  .team-p2 {
    grid-column: 1 / -1;
    padding: 1.35rem;
    border-color: rgba(239,68,68,0.32);
    background:
      radial-gradient(ellipse 80% 90% at 100% 0%, rgba(239,68,68,0.12), transparent),
      rgba(8,14,28,0.9);
    animation: revealUp 0.5s cubic-bezier(.22,1,.36,1) both;
  }

  .phase1-console {
    grid-column: 1 / -1;
    display: grid;
    justify-items: center;
    gap: 1rem;
    padding: clamp(1rem, 3vw, 2rem);
    min-height: calc(100dvh - 150px);
    align-content: center;
  }

  .phase1-category {
    color: var(--cyan);
    font-size: clamp(0.95rem, 2.5vw, 1.35rem);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 800;
    animation: categoryPulse 1.15s ease-in-out infinite alternate;
  }

  @keyframes categoryPulse {
    from { opacity: 0.72; text-shadow: 0 0 8px rgba(23,233,255,0.45); transform: translateY(0); }
    to { opacity: 1; text-shadow: 0 0 22px rgba(23,233,255,0.9); transform: translateY(-3px); }
  }

  .phase1-question {
    width: min(980px, 100%);
    padding: clamp(1.2rem, 3vw, 2rem);
    border-radius: 8px;
    border: 3px solid var(--cyan);
    background: linear-gradient(180deg, #06033f 0%, #1d347e 100%);
    box-shadow: 0 0 24px rgba(23,233,255,0.42);
    text-align: center;
  }

  .phase1-question h2 {
    margin: 0;
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.35rem, 4vw, 3.1rem);
    line-height: 1.18;
    color: var(--gold);
  }

  .phase1-timer {
    width: clamp(150px, 28vw, 260px);
    aspect-ratio: 1;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 5px solid var(--cyan);
    background: radial-gradient(circle, rgba(120,234,216,0.16), rgba(6,3,63,0.96));
    box-shadow: 0 0 34px rgba(23,233,255,0.46), inset 0 0 26px rgba(23,233,255,0.18);
  }

  .phase1-timer span {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(4rem, 12vw, 8.5rem);
    line-height: 0.9;
    color: var(--gold);
  }

  .phase1-bottom {
    width: min(760px, 100%);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: center;
  }

  .phase1-score {
    min-height: 72px;
    border-radius: 999px;
    background: var(--gold);
    color: var(--bg);
    display: grid;
    place-items: center;
    font-weight: 900;
    box-shadow: 0 12px 0 rgba(0,0,0,0.36);
  }

  .phase1-console .buzz-circle {
    width: clamp(126px, 22vw, 184px);
    height: clamp(126px, 22vw, 184px);
  }

  .phase1-choice {
    width: min(760px, 100%);
    border-radius: 8px;
    border: 2px solid rgba(23,233,255,0.62);
    background: rgba(6,3,63,0.76);
    box-shadow: 0 0 20px rgba(23,233,255,0.22);
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
    text-align: center;
  }

  .phase1-choice-title {
    margin: 0;
    color: var(--gold);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .phase1-choice-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .phase1-choice-btn {
    min-height: 54px;
    border: 2px solid var(--cyan);
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(120,234,216,0.16), rgba(23,233,255,0.08));
    color: #ecfeff;
    font-weight: 900;
    cursor: pointer;
  }

  @media (max-width: 720px) {
    .phase1-bottom { grid-template-columns: 1fr; justify-items: center; }
    .phase1-score { width: 100%; }
    .phase1-choice-row { grid-template-columns: 1fr; }
  }

  .team-p2-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .team-p2-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2rem;
    letter-spacing: 0.08em;
    color: #f8fafc;
  }

  .team-p2-sub {
    color: rgba(148,163,184,0.72);
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .team-p2-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 860px) { .team-p2-grid { grid-template-columns: 1fr; } }

  .team-challenge {
    padding: 1rem;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.035);
  }

  .team-challenge h2 {
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.25rem, 2.8vw, 2rem);
    line-height: 1.3;
    color: #f8fafc;
    margin: 0.8rem 0;
  }

  .team-answer-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-top: 1rem;
  }

  @media (max-width: 560px) { .team-answer-row { grid-template-columns: 1fr; } }

  .team-answer-input {
    min-height: 50px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(2,6,23,0.74);
    color: #f8fafc;
    padding: 0 14px;
    font: inherit;
    outline: none;
  }

  .team-lock-btn,
  .team-hint-btn {
    min-height: 50px;
    border: none;
    border-radius: 12px;
    padding: 0 16px;
    color: #fff;
    font-weight: 800;
    cursor: pointer;
  }

  .team-lock-btn {
    background: linear-gradient(135deg,#ef4444,#7f1d1d);
    box-shadow: 0 10px 30px rgba(239,68,68,0.25);
  }

  .team-hint-btn {
    width: 100%;
    background: linear-gradient(135deg,#f59e0b,#92400e);
  }

  .team-lock-btn:disabled,
  .team-hint-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .team-p2-side {
    display: grid;
    gap: 0.75rem;
  }

  .team-p2-stat {
    padding: 1rem;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.035);
  }

  .team-p2-big {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 2.5rem;
    color: #fbbf24;
  }

  .team-feedback {
    margin-top: 0.8rem;
    padding: 0.75rem;
    border-radius: 12px;
    background: rgba(255,255,255,0.05);
    color: #e2e8f0;
    font-size: 0.85rem;
  }

  .team-feedback.bad { background: rgba(239,68,68,0.13); color: #fecaca; }
  .team-feedback.good { background: rgba(34,197,94,0.13); color: #bbf7d0; }
`;

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

/* ─────────────────────────────────────────────────────────────────
   CIRCULAR TIMER
───────────────────────────────────────────────────────────────── */
function CircularTimer({ value, max = 30, danger }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct  = max > 0 ? Math.max(0, value / max) : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="timer-wrap">
      <svg className="timer-svg" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#3d2f82" />
            <stop offset="100%" stopColor="#17e9ff" />
          </linearGradient>
          <linearGradient id="timerGradDanger" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#ef4444" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <circle className="timer-track" cx="22" cy="22" r={r} />
        <circle
          className={`timer-prog ${danger ? 'danger' : ''}`}
          cx="22" cy="22" r={r}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={`timer-num ${danger ? 'danger' : ''}`}>{value}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PARTICLE BURST
───────────────────────────────────────────────────────────────── */
function ParticleBurst({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle  = (i / 12) * 360;
    const dist   = 55 + ((i * 17) % 30);
    const rad    = (angle * Math.PI) / 180;
    const tx     = Math.cos(rad) * dist;
    const ty     = Math.sin(rad) * dist;
    const dur    = 0.5 + ((i * 7) % 20) / 100;
    const colors = ['#4ade80', '#86efac', '#22c55e', '#6ee7b7'];
    const color  = colors[i % colors.length];
    const size   = 4 + ((i * 5) % 5);
    return { tx, ty, dur, color, size };
  });

  return (
    <div className="particles">
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            '--dur': `${p.dur}s`,
            '--delay': `${i * 0.02}s`,
            background: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────── */
export default function Team() {
  const navigate = useNavigate();
  const teamProfile = readTeamProfile();
  const teamAvatar = localStorage.getItem('teamAvatar') || teamProfile.avatar || '';
  const teamTag = localStorage.getItem('teamTag') || teamProfile.tag || '';
  const teamColor = localStorage.getItem('teamColor') || teamProfile.color || '#17e9ff';

  const [username]    = useState(() => localStorage.getItem('username') || 'Joueur');
  const [teamName]    = useState(() => localStorage.getItem('teamName') || localStorage.getItem('username') || 'Équipe');
  const [score,       setScore]       = useState(0);
  const [timer,       setTimer]       = useState(0);
  const [maxTimer,    setMaxTimer]    = useState(30);
  const [question,    setQuestion]    = useState(null);
  const [hasBuzzed,   setHasBuzzed]   = useState(false);
  const [buzzed,      setBuzzed]      = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [correctFlash, setCorrectFlash] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [phase2Answer, setPhase2Answer] = useState('');
  const [phase2Wager, setPhase2Wager] = useState(10);
  const [phase2Hint, setPhase2Hint] = useState('');
  const [phase2Feedback, setPhase2Feedback] = useState('');
  const [revealedAnswer, setRevealedAnswer] = useState('');

  const socketRef  = useRef(null);
  const scoreRef   = useRef(null);
  const timerRef   = useRef(0);

  /* ── Socket ── */
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) { navigate('/'); return; }

    const socket = io(API_BASE, {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
  setIsConnected(true);
  
  // Envoie teamId et teamName pour le classement
  socket.emit('join', { 
    room: 'session-1', 
    role: 'team',
    teamId: localStorage.getItem('teamId') || `team-${Date.now()}`,
    teamName,
    tag: localStorage.getItem('teamTag') || teamProfile.tag || '',
    color: localStorage.getItem('teamColor') || teamProfile.color || '#17e9ff',
    avatar: localStorage.getItem('teamAvatar') || teamProfile.avatar || ''
  });
});

    socket.on('game:new_question', (data) => {
      const q = {
        id:         data.id,
        text:       data.text || data.question || data.questionText || 'Question inconnue',
        category:   data.category || 'Général',
        points:     data.points || 0,
        difficulty: data.difficulty || data.type || 'medium',
        timeLimit:  data.timeLimit || data.timer || 30,
        options:    data.options,
        imageUrl:   data.imageUrl,
      };
      setQuestion(q);
      setTimer(q.timeLimit);
      setMaxTimer(q.timeLimit);
      timerRef.current = q.timeLimit;
      setTimerPaused(false);
      setHasBuzzed(false);
      setBuzzed(false);
      setShowParticles(false);
    });

    socket.on('game:clear_question', () => {
      setQuestion(null);
      setHasBuzzed(false);
      setBuzzed(false);
    });

    socket.on('game:timer', (payload) => {
      if (payload && typeof payload === 'object') {
        if (payload.phase === 'phase2') return;
        if (Number.isFinite(Number(payload.timeLeft))) {
          setTimer(Number(payload.timeLeft));
          timerRef.current = Number(payload.timeLeft);
        }
        return;
      }
      if (typeof payload === 'number') setTimer(payload);
    });

    socket.on('game:timer_stop', ({ timeLeft, phase }) => {
      if (phase === 'phase2') return;
      const frozen = Number.isFinite(Number(timeLeft)) ? Number(timeLeft) : timerRef.current;
      setTimer(frozen);
      timerRef.current = frozen;
      setTimerPaused(true);
    });

    socket.on('game:score_update', (newScore) => {
      setScore(newScore);
      scoreRef.current?.classList.add('score-bump');
      setTimeout(() => scoreRef.current?.classList.remove('score-bump'), 400);
    });

    socket.on('score:update', (payload) => {
      const localTeamId = localStorage.getItem('teamId') || '';
      if (String(payload?.teamId) !== String(localTeamId)) return;
      if (Number.isFinite(Number(payload?.score))) {
        setScore(Number(payload.score));
      }
      scoreRef.current?.classList.add('score-bump-up');
      setTimeout(() => scoreRef.current?.classList.remove('score-bump-up'), 700);
      if (payload?.correct) {
        setCorrectFlash(`+${payload.delta || 0} pts`);
        setTimeout(() => setCorrectFlash(null), 900);
      }
    });

    socket.on('game:answer_result', (payload) => {
      const localTeamId = localStorage.getItem('teamId') || '';
      if (!payload?.correct) return;
      if (String(payload.teamId) === String(localTeamId)) {
        setCorrectFlash(`Correct · +${payload.delta || 0}`);
        setTimeout(() => setCorrectFlash(null), 900);
      }
    });

    const syncTournamentState = (data) => {
      setTournament(data);
      if (!data?.phase2?.currentChallenge && data?.phase !== 'phase1') {
        setQuestion(null);
      }
    };

    socket.on('tournament:state', syncTournamentState);
    socket.on('tournament:phase1_complete', syncTournamentState);
    socket.on('phase1:test_state_updated', syncTournamentState);
    socket.on('phase1:category_choices', (payload) => syncTournamentState(payload.snapshot || payload));
    socket.on('phase1:category_chosen', (payload) => syncTournamentState(payload.snapshot || payload));
    socket.on('phase1:test_reset', syncTournamentState);
    socket.on('phase1:test_simulation_complete', syncTournamentState);
    socket.on('tournament:phase2_started', syncTournamentState);
    socket.on('phase2:challenge_started', (data) => {
      setTournament(data);
      setPhase2Answer('');
      setPhase2Wager(10);
      setPhase2Hint('');
      setPhase2Feedback('');
      setRevealedAnswer('');
    });
    socket.on('phase2:timer', ({ timer: nextTimer }) => {
      setTournament(prev => prev ? ({ ...prev, phase2: { ...prev.phase2, timer: nextTimer } }) : prev);
    });
    socket.on('phase2:submission_result', (data) => {
      if (data.correct) {
        setPhase2Feedback(`Correct. +${data.points} points${data.usedHint ? ' avec indice' : ''}.`);
        setCorrectFlash(`Correct · +${data.points || 0}`);
        setTimeout(() => setCorrectFlash(null), 900);
      } else if (data.penalty) {
        setPhase2Feedback(`Mauvaise réponse. ${data.penalty} point(s).`);
      } else {
        setPhase2Feedback(data.reason || 'Soumission refusée.');
      }
    });
    socket.on('phase2:submission_update', syncTournamentState);
    socket.on('phase2:round_winner', syncTournamentState);
    socket.on('phase2:scores_updated', syncTournamentState);
    socket.on('phase2:score_update', ({ score, teamId }) => {
      const localTeamId = localStorage.getItem('teamId') || '';
      if (String(teamId) !== String(localTeamId)) return;
      setTournament((prev) => {
        if (!prev?.phase2?.scores) return prev;
        return {
          ...prev,
          phase2: {
            ...prev.phase2,
            scores: prev.phase2.scores.map((team) => (
              String(team.id) === String(localTeamId) ? { ...team, score } : team
            ))
          }
        };
      });
    });
    socket.on('phase2:hint_usage_update', syncTournamentState);
    socket.on('phase2:hint', ({ hint }) => setPhase2Hint(hint));
    socket.on('phase2:hint_revealed', ({ hint, state }) => {
      setPhase2Hint(hint);
      syncTournamentState(state);
    });
    socket.on('phase2:answer_revealed', ({ answer, state }) => {
      setRevealedAnswer(answer);
      syncTournamentState(state);
    });
    socket.on('phase2:pause_update', syncTournamentState);
    socket.on('phase2:round_ended', syncTournamentState);
    socket.on('phase2:round_timeout', syncTournamentState);
    socket.on('phase2:round_skipped', syncTournamentState);
    socket.on('phase2:team_eliminated', syncTournamentState);
    socket.on('tournament:phase2_complete', syncTournamentState);
    socket.on('tournament:dev_phase2_started', syncTournamentState);
    socket.on('tournament:dev_phase3_started', syncTournamentState);
    socket.on('tournament:dev_state_updated', syncTournamentState);
    socket.on('tournament:dev_reset', syncTournamentState);

    socket.on('disconnect', () => setIsConnected(false));

    return () => socket.disconnect();
  }, [navigate, teamAvatar, teamColor, teamName, teamProfile.avatar, teamProfile.color, teamProfile.tag, teamTag]);

  /* ── Local countdown ── */
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  useEffect(() => {
    if (timer <= 0 || timerPaused || !question) return;
    const id = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timer, timerPaused, question]);

  /* ── Buzz ── */
const handleBuzz = useCallback(async () => {
  if (hasBuzzed || !question || timer === 0 || timerPaused) return;
  const buzzTime = timerRef.current;
  setHasBuzzed(true);
  setBuzzed(true);
  setTimerPaused(true);
  setShowParticles(true);
  setTimeout(() => setShowParticles(false), 800);

  const teamId = localStorage.getItem('teamId') || `team-${Date.now()}`;

  socketRef.current?.emit('team:buzz', {
    teamId,
    teamName,
    questionId: question.id,
    buzzTime
  });

  try {
    const token = localStorage.getItem('token');
    
    await fetch(`${API_BASE}/api/game/buzz`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        questionId: question.id, 
        buzzTime,
        teamId
      }),
    });
  } catch (err) {
    console.error('Erreur buzz:', err);
    setHasBuzzed(false);
    setBuzzed(false);
    setTimerPaused(false);
  }
}, [hasBuzzed, question, timer, timerPaused, teamName]);

  const localTeamId = localStorage.getItem('teamId') || '';
  const phase2 = tournament?.phase2;
  const phase3 = tournament?.phase3;
  const phase1Test = tournament?.phase1?.test || {};
  const phase2Active = tournament?.phase === 'phase2' || phase2?.active;
  const phase3Active = tournament?.phase === 'phase3' || phase3?.active;
  const phase2Challenge = phase2?.currentChallenge;
  const phase2Modifier = phase2?.modifier;
  const phase2ModifierLabel = phase2?.modifierLabel;
  const isRiskRound = phase2Modifier === 'risk_round';
  const hintsDisabled = phase2Modifier === 'no_hint' || phase2?.hintsDisabled;
  const phase2Me = phase2?.scores?.find(team => String(team.id) === String(localTeamId));
  const phase3Me = phase3?.scores?.find(team => String(team.id) === String(localTeamId));
  const phase2Rank = phase2Me?.rank || '-';
  const canPlayPhase2 = phase2Active && phase2?.qualifiedTeams?.some(team => String(team.id) === String(localTeamId));
  const eliminatedPhase2 = phase2Active && !canPlayPhase2;
  const canPlayPhase3 = phase3Active && phase3?.finalists?.some(team => String(team.id) === String(localTeamId));
  const eliminatedPhase3 = phase3Active && !canPlayPhase3;
  const canChoosePhase1Category = !phase2Active
    && !phase3Active
    && phase1Test.pendingCategoryChoice
    && String(phase1Test.roundWinner?.id || '') === String(localTeamId);
  const myPenaltyCount = phase2Me?.penalties || 0;
  const myHintCount = phase2Me?.hintsUsed || 0;
  const qualifiedCount = phase2?.qualifiedTeams?.length || 0;
  const eliminationRisk = phase2Active && canPlayPhase2 && typeof phase2Me?.rank === 'number'
    ? phase2Me.rank > Math.max(1, qualifiedCount - 2)
      ? 'Zone rouge'
      : phase2Me.rank === Math.max(1, qualifiedCount - 2)
        ? 'Sous pression'
        : 'Stable'
    : null;

  const submitPhase2Answer = (e) => {
    e.preventDefault();
    if (!phase2Answer.trim() || !canPlayPhase2 || !phase2Challenge) return;

    socketRef.current?.emit('phase2:submit_answer', {
      teamId: localTeamId,
      teamName,
      answer: phase2Answer,
      wager: phase2?.modifier === 'risk_round' ? Number(phase2Wager) : undefined
    });
  };

  const requestPhase2Hint = () => {
    if (!canPlayPhase2 || !phase2Challenge) return;
    socketRef.current?.emit('phase2:request_hint', {
      teamId: localTeamId,
      teamName
    });
  };

  const choosePhase1Category = (category) => {
    if (!canChoosePhase1Category) return;
    socketRef.current?.emit('phase1:choose_category', {
      category,
      teamId: localTeamId
    });
  };
  /* ── Derived ── */
  const diffMap  = { easy: ['qtag-easy','Facile'], medium: ['qtag-med','Moyen'], hard: ['qtag-hard','Difficile'] };
  const [diffCls, diffLbl] = diffMap[question?.difficulty] ?? ['qtag-med', question?.difficulty ?? ''];
  const timerDanger = timer <= 5 && timer > 0;
  const phase2LockActive = phase2Active && Boolean(phase2Challenge) && eliminatedPhase2;
  const phase3LockActive = phase3Active && eliminatedPhase3;
  const buzzFrozen = Boolean(phase2LockActive || phase3LockActive);
  const btnDisabled = hasBuzzed || !question || timer === 0 || timerPaused || buzzFrozen;
  const buzzHintText = buzzFrozen
    ? 'Accès verrouillé: équipe spectatrice'
    : hasBuzzed
      ? 'Tu as buzzé en premier'
      : 'Appuyez pour buzzer';

  return (
    <>
      <style>{styles}</style>

      {/* Background */}
      <div className="tr-bg" />
      <div className="tr-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {correctFlash && (
        <div className="correct-flash">
          <div className="correct-flash-inner">{correctFlash}</div>
        </div>
      )}

      <div className={`tr ${!phase2Active && !phase3Active ? 'phase1-only' : ''}`}>
        <div className="tr-inner">

          {/* ── Header ── */}
          <div className="gc gc-cyan tr-header area-header">
            <div className="brand">
              <div className="brand-logo">
                <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div>
                <p className="brand-name">Deck d'Ascension</p>
                <p className="brand-sub">Votre course dans ISGA Summit Challenge</p>
              </div>
            </div>
            <div className={`conn-pill ${isConnected ? 'online' : ''}`}>
              <span className={`conn-dot ${isConnected ? 'on' : 'off'}`} />
              {isConnected ? 'En ligne' : 'Déconnecté'}
            </div>
          </div>

          {(phase2Active || phase3Active) && (
          <div className="gc" style={{ padding: '0.4rem', borderRadius: '24px' }}>
            <TowerRail
              phase={tournament?.phase || 'phase1'}
              compact
              title={teamName}
              subtitle={phase3Active ? 'Sommet en vue' : phase2Active ? "Vous êtes dans l'étage sous pression." : "Répondez, montez, survivez."}
            />
          </div>
          )}

          {phase3Active && (
            <div className="gc team-p2">
              <div className="team-p2-top">
                <div>
                  <p className="team-p2-title">LA GRANDE FINALE</p>
                  <p className="team-p2-sub">{canPlayPhase3 ? 'Finalist Mode' : 'Spectator Mode'}</p>
                </div>
                <div className="conn-pill online">
                  <span className="conn-dot on" />
                  {canPlayPhase3 ? `Final Rank ${phase3Me?.rank || '-'}` : 'Eliminated'}
                </div>
              </div>

              <div className="team-p2-grid">
                <div className="team-challenge">
                  <div className="q-tags">
                    <span className="qtag qtag-cat">Grande Finale</span>
                    <span className="qtag qtag-pts">Duel</span>
                  </div>
                  <h2>Le duel final est prêt. Les finalistes peuvent entrer dans la manche décisive.</h2>
                  <p className="team-p2-sub">Buzzer systems: {phase3?.buzzerEnabled ? 'ready' : 'standby'}</p>
                  {!canPlayPhase3 && (
                    <div className="team-feedback bad">Vous êtes spectateur pour la finale.</div>
                  )}
                </div>

                <div className="team-p2-side">
                  <div className="team-p2-stat">
                    <p className="team-p2-sub">Score Finale</p>
                    <p className="team-p2-big">{phase3Me?.score ?? 0}</p>
                  </div>
                  <div className="team-p2-stat">
                    <p className="team-p2-sub">Finalistes</p>
                    {(phase3?.scores || []).map((team) => (
                      <div key={team.id} className="team-feedback" style={{ marginTop: '0.45rem' }}>
                        #{team.rank} {team.name} · {team.score}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase2Active && (
            <div className="gc team-p2">
              <div className="team-p2-top">
                <div>
                  <p className="team-p2-title">PHASE 2</p>
                  <p className="team-p2-sub">CSV Elimination Round - {canPlayPhase2 ? 'Equipe qualifiee' : 'Mode spectateur'}</p>
                  {eliminationRisk && <p className="team-p2-sub">Risque d'élimination: {eliminationRisk}</p>}
                </div>
                <div className="conn-pill online">
                  <span className="conn-dot on" />
                  Rank {phase2Rank}
                </div>
              </div>

              <div className="team-p2-grid">
                <div className="team-challenge">
                  {phase2Challenge ? (
                    <>
                      <div className="q-tags">
                        <span className="qtag qtag-cat">{phase2Challenge.category}</span>
                        <span className="qtag qtag-pts">{phase2Challenge.points} pts</span>
                        <span className="qtag qtag-hard">{phase2Challenge.penalty} pénalité</span>
                        {phase2ModifierLabel && (
                          <span className="qtag qtag-hard">{phase2ModifierLabel}</span>
                        )}
                      </div>
                      <h2>{phase2Challenge.question}</h2>
                      <p className="team-p2-sub">Temps restant: {phase2?.timer ?? 0}s</p>

                      {eliminatedPhase2 ? (
                        <div className="team-feedback bad">Vous êtes spectateur pour cette phase.</div>
                      ) : (
                        <>
                          {isRiskRound && (
                            <div className="team-feedback" style={{ marginBottom: '0.65rem' }}>
                              Mise (Risk Round):{' '}
                              <input
                                type="range"
                                min="5"
                                max="20"
                                value={phase2Wager}
                                onChange={(e) => setPhase2Wager(Number(e.target.value))}
                                disabled={!canPlayPhase2 || Boolean(phase2?.roundWinner)}
                              />
                              <strong style={{ marginLeft: '0.5rem' }}>{phase2Wager} pts</strong>
                            </div>
                          )}
                          <form className="team-answer-row" onSubmit={submitPhase2Answer}>
                            <input
                              className="team-answer-input"
                              value={phase2Answer}
                              onChange={e => setPhase2Answer(e.target.value)}
                              placeholder="Votre réponse..."
                              disabled={!canPlayPhase2 || Boolean(phase2?.roundWinner)}
                            />
                            <button className="team-lock-btn" disabled={!canPlayPhase2 || Boolean(phase2?.roundWinner)}>
                              LOCK IN
                            </button>
                          </form>
                        </>
                      )}

                      {phase2Feedback && (
                        <div className={`team-feedback ${phase2Feedback.includes('Correct') ? 'good' : 'bad'}`}>
                          {phase2Feedback}
                        </div>
                      )}
                      {phase2?.roundWinner && (
                        <div className="team-feedback good">
                          {phase2.roundWinner.teamName} remporte le round (+{phase2.roundWinner.points}).
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="team-feedback">En attente du prochain challenge...</div>
                  )}
                </div>

                <div className="team-p2-side">
                  <div className="team-p2-stat">
                    <p className="team-p2-sub">Score Phase 2</p>
                    <p className="team-p2-big">{phase2Me?.score ?? 0}</p>
                  </div>
                  <div className="team-p2-stat">
                    <p className="team-p2-sub">Pression</p>
                    <div className="team-feedback" style={{ marginBottom: '0.55rem' }}>
                      Pénalités: {myPenaltyCount}
                    </div>
                    <div className="team-feedback">
                      Indices utilisés: {myHintCount}
                    </div>
                  </div>
                  <div className="team-p2-stat">
                    <p className="team-p2-sub">Indice</p>
                    <button
                      className="team-hint-btn"
                      onClick={requestPhase2Hint}
                      disabled={!canPlayPhase2 || !phase2Challenge || Boolean(phase2Hint) || hintsDisabled}
                    >
                      {hintsDisabled ? 'Indice désactivé (No Hint)' : 'Utiliser indice (-2 reward)'}
                    </button>
                    {phase2Hint && <div className="team-feedback">{phase2Hint}</div>}
                  </div>
                  {revealedAnswer && (
                    <div className="team-p2-stat">
                      <p className="team-p2-sub">Réponse révélée</p>
                      <p>{revealedAnswer}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!phase2Active && !phase3Active && (
            <div className="phase1-console">
              <div className="phase1-category" key={question?.category || 'waiting'}>
                {question?.category || 'En attente'}
              </div>
              <div className="phase1-question">
                <h2>{question?.text || "En attente d'une question du modérateur..."}</h2>
              </div>
              {phase1Test.pendingCategoryChoice && (
                <div className="phase1-choice">
                  <p className="phase1-choice-title">
                    {canChoosePhase1Category
                      ? 'Choisis la prochaine categorie'
                      : `${phase1Test.roundWinner?.name || 'Le gagnant'} choisit la prochaine categorie`}
                  </p>
                  {canChoosePhase1Category && (
                    <div className="phase1-choice-row">
                      {(phase1Test.nextCategoryChoices || []).map((category) => (
                        <button
                          key={category}
                          className="phase1-choice-btn"
                          onClick={() => choosePhase1Category(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="phase1-timer">
                <span>{timer}</span>
              </div>
              <div className="phase1-bottom">
                <div className="phase1-score">Score: {score}</div>
                <button
                  className={`buzz-btn ${buzzed ? 'buzzed' : ''}`}
                  onClick={handleBuzz}
                  disabled={btnDisabled}
                  aria-label="Buzzer"
                >
                  <div className="buzz-glow" />
                  {!btnDisabled && (
                    <div className="buzz-rings">
                      <div className="buzz-ring" />
                      <div className="buzz-ring" />
                      <div className="buzz-ring" />
                    </div>
                  )}
                  <div className="buzz-circle">
                    <div className="buzz-scan" />
                    <ParticleBurst active={showParticles} />
                    <div className="buzz-icon">
                      <svg width="38" height="38" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                        {buzzed
                          ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          : <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                        }
                      </svg>
                    </div>
                    <span className="buzz-label">{buzzed ? 'BUZZÉ' : 'BUZZ'}</span>
                    {!buzzed && <span className="buzz-sub">Appuyez</span>}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Question ── */}
          {(phase2Active || phase3Active) && <div className="area-question">
            {question ? (
              <>
                <div className="neon-q-card" key={question.id}>
                  <div className="neon-quiz-badge">QUIZ</div>
                  <div className="q-tags">
                    <span className="qtag qtag-cat">{question.category}</span>
                    <span className="qtag qtag-pts">{question.points} pts</span>
                    <span className={`qtag ${diffCls}`}>{diffLbl}</span>
                  </div>
                  <p className="neon-q-text">
                    {question.text || question.question || 'Chargement...'}
                  </p>
                  {question.imageUrl && (
                    <img src={question.imageUrl} alt="Illustration" className="q-img" />
                  )}
                </div>
                {Array.isArray(question.options) && question.options.length > 0 && (
                  <div className="neon-options-grid">
                    {question.options.map((opt, i) => (
                      <div key={i} className="neon-option-pill">
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="neon-q-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
                <div className="neon-quiz-badge">QUIZ</div>
                <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'1.1rem', textAlign:'center', fontWeight: 'bold' }}>
                  En attente d'une question du modérateur…
                </p>
              </div>
            )}
          </div>}

          {/* ── Stats ── */}
          {(phase2Active || phase3Active) && <div className="stats-row area-stats">

            {/* Score */}
            <div className="gc gc-gold stat-card" ref={scoreRef}>
              <div className="stat-icon-wrap" style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.15))' }}>
                <svg width="20" height="20" fill="none" stroke="#fbbf24" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                </svg>
              </div>
              <p className="stat-lbl">Score</p>
              <p className="stat-val">{score}</p>
              <p className="stat-sub">points</p>
            </div>

            {/* Timer */}
            <div className="gc gc-indigo stat-card">
              <CircularTimer value={timer} max={maxTimer} danger={timerDanger} />
              <p className="stat-lbl">Temps</p>
              <p className={`stat-val ${timerDanger ? 'danger' : ''}`}>
                {timer}<span className="stat-unit">s</span>
              </p>
              <p className="stat-sub">secondes</p>
            </div>

            {/* Status */}
            <div className={`gc ${hasBuzzed ? 'gc-green' : question ? 'gc-cyan' : ''} stat-card`}>
              <div className="stat-icon-wrap" style={{ background: hasBuzzed ? 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(6,182,212,0.15))' : 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(6,182,212,0.15))' }}>
                <svg width="20" height="20" fill="none" stroke={hasBuzzed ? '#78ead8' : '#17e9ff'} strokeWidth="2.2" viewBox="0 0 24 24">
                  {hasBuzzed
                    ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    : <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                  }
                </svg>
              </div>
              <p className="stat-lbl">Statut</p>
              <p className="stat-val sm">
                {hasBuzzed ? 'Buzzé' : question ? 'Prêt' : 'Veille'}
              </p>
              <p className="stat-sub">{hasBuzzed ? 'Premier !' : question ? 'Vite !' : 'En attente'}</p>
            </div>

          </div>}

          {/* ── Buzz ── */}
          {(phase2Active || phase3Active) && <div className="gc gc-red buzz-section area-buzz">

            {!question ? (
              <div className="waiting-pill">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
                </svg>
                En attente du modérateur
              </div>
            ) : (
              <p className="buzz-hint">
                {buzzHintText}
              </p>
            )}

            <button
              className={`buzz-btn ${buzzed ? 'buzzed' : ''} ${buzzFrozen ? 'frozen' : ''}`}
              onClick={handleBuzz}
              disabled={btnDisabled}
              aria-label="Buzzer"
            >
              <div className="buzz-glow" />
              {!btnDisabled && (
                <div className="buzz-rings">
                  <div className="buzz-ring" />
                  <div className="buzz-ring" />
                  <div className="buzz-ring" />
                </div>
              )}

              <div className="buzz-circle">
                <div className="buzz-scan" />
                <ParticleBurst active={showParticles} />

                <div className="buzz-icon">
                  <svg width="38" height="38" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                    {buzzed
                      ? <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      : <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    }
                  </svg>
                </div>
                <span className="buzz-label">{buzzFrozen ? 'LOCKED' : buzzed ? 'BUZZÉ' : 'BUZZ'}</span>
                {!buzzed && <span className="buzz-sub">{buzzFrozen ? 'Spectateur' : 'Appuyez'}</span>}
              </div>
            </button>

            {timer <= 5 && timer > 0 && !hasBuzzed && question && (
              <p style={{ fontSize:'0.72rem', color:'#f87171', letterSpacing:'0.08em', textTransform:'uppercase', animation:'pulse-txt 0.5s ease infinite alternate' }}>
                Dépêchez-vous !
              </p>
            )}
          </div>}

          {/* ── User bar ── */}
          <div className="gc user-bar area-userbar">
            <TeamAvatar name={teamName} avatar={teamAvatar} color={teamColor} tag={teamTag} size={44} />
            <div>
              <p className="user-name">{teamName}</p>
              <p className="user-role">{teamTag ? `${teamTag} · ` : ''}{username}</p>
            </div>
            <div className="user-status">
              <span className={`conn-dot ${isConnected ? 'on' : 'off'}`} style={{ width:'5px', height:'5px' }} />
              {isConnected ? 'Connecté' : 'Hors ligne'}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
