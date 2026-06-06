/**
 * HOSTACK — Rota Import Script
 * Run via: Settings → Secrets → Actions (no terminal needed)
 * To add a new week: update the TABS array below.
 */

import { createClient } from '@supabase/supabase-js';

const HOSTACK_URL = 'https://yskzkobduekupiobrbxr.supabase.co';
const PROPERTY    = 'bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a';
const SHEET_ID    = '1k7SwmRTv6qKljEfyjOBVOYkfQHed263ovFrP3gevbis';
const KEY         = process.env.HOSTACK_SERVICE_ROLE_KEY?.trim();

if (!KEY) { console.error('Missing HOSTACK_SERVICE_ROLE_KEY'); process.exit(1); }

// ── ADD NEW WEEKS HERE ──────────────────────────────────────────────────────
const TABS = ['1-7 JUN', '8-14 JUN'];
// ───────────────────────────────────────────────────────────────────────────

const sb = createClient(HOSTACK_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const LANG_MAP = { pepe:'es', miguel:'es', roxana:'es', jorge:'es', mike:'fr', blanche:'fr' };
const TIMES = {
  'Breakfast':['07:00','12:00'], 'Housekeeping':['09:00','15:00'],
  'Laundry':['09:00','15:00'],   'Cottages':['09:00','15:00'],
  'Maintenance':['09:00','17:00'],'Special Task':['09:00','15:00'],
  'Onboarding':['09:00','17:00'],'Deep Cleaning':['09:00','15:00'],
};
const MONTHS = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};

function parseCSV(text) {
  const rows=[]; let cur=[],field='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else q=false;}else field+=ch;}
    else{if(ch==='"')q=true;else if(ch===','){cur.push(f
