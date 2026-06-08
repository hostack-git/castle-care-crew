import { createClient } from '@supabase/supabase-js';

const HOSTACK_URL = 'https://yskzkobduekupiobrbxr.supabase.co';
const PROPERTY = 'bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a';
const SHEET_ID = '1k7SwmRTv6qKljEfyjOBVOYkfQHed263ovFrP3gevbis';
const KEY = process.env.HOSTACK_SERVICE_ROLE_KEY?.trim();

if (!KEY) {
  console.error('Missing HOSTACK_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ADD NEW WEEKS HERE — format must match the Sheet tab name exactly
const TABS = ['1-7 JUN', '8-14 JUN'];

const sb = createClient(HOSTACK_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LANG_MAP = {
  pepe: 'es',
  miguel: 'es',
  roxana: 'es',
  jorge: 'es',
  mike: 'fr',
  blanche: 'fr',
};

const TIMES = {
  Breakfast: ['07:00', '12:00'],
  Housekeeping: ['09:00', '15:00'],
  Laundry: ['09:00', '15:00'],
  Cottages: ['09:00', '15:00'],
  Maintenance: ['09:00', '17:00'],
  'Special Task': ['09:00', '15:00'],
  Onboarding: ['09:00', '17:00'],
  'Deep Cleaning': ['09:00', '15:00'],
};

const MONTHS = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }

  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }

  return rows;
}

function weekStart(tab) {
  const upper = tab.toUpperCase();
  const match = upper.match(/^(\d{1,2})\s*-\s*\d{1,2}\s+([A-Z]{3,})/);
  if (!match) {
    throw new Error('Cannot parse tab name: ' + tab);
  }
  const day = String(parseInt(match[1], 10)).padStart(2, '0');
  const month = String(MONTHS[match[2].slice(0, 3)]).padStart(2, '0');
  return '2026-' + month + '-' + day;
}

function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function normCell(raw) {
  const v = (raw ?? '').trim();
  if (!v) return { kind: 'empty' };
  if (/^departure/i.test(v)) return { kind: 'empty' };
  if (/^arrive/i.test(v)) return { kind: 'empty' };
  if (/^off(\s|\d|$)/i.test(v)) return { kind: 'off' };

  const cleaned = v.replace(/\s+\d+$/, '').trim();
  const words = cleaned.split(/\s+/);
  const name = words
    .map(function(w) { return w[0].toUpperCase() + w.slice(1).toLowerCase(); })
    .join(' ');

  return { kind: 'shift', name: name };
}

function dominantRole(cells) {
  const counts = {};
  for (let i = 0; i < cells.length; i++) {
    const n = normCell(cells[i]);
    if (n.kind === 'shift') {
      counts[n.name] = (counts[n.name] ?? 0) + 1;
    }
  }
  const entries = Object.entries(counts).sort(function(a, b) { return b[1] - a[1]; });
  return entries.length > 0 ? entries[0][0] : 'Housekeeping';
}

function parseRota(csv) {
  const rows = parseCSV(csv);
  const nameRowIndexes = [];

  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] ?? '').trim().toLowerCase() === 'name') {
      nameRowIndexes.push(i);
    }
  }

  const start = (nameRowIndexes[1] ?? nameRowIndexes[0]) + 1;
  const rota = {};

  for (let i = start; i < rows.length; i++) {
    const name = (rows[i][0] ?? '').trim();
    if (!name) break;
    if (name.toLowerCase() === 'family dinner') break;
    if (name.toLowerCase() === 'activity') break;
    rota[name] = [1, 2, 3, 4, 5, 6, 7].map(function(j) {
      return (rows[i][j] ?? '').toString();
    });
  }

  return rota;
}

async function ensureVolunteer(sb, volBy, name, cells) {
  const key = name.trim().toLowerCase();
  let v = volBy.get(key);

  if (v) {
    if (v.status !== 'active') {
      const result = await sb.from('volunteers').update({ status: 'active' }).eq('id', v.id);
      if (result.error) throw result.error;
    }
    return v.id;
  }

  const lang = LANG_MAP[key] ?? 'en';
  const result = await sb
    .from('volunteers')
    .insert({
      property_id: PROPERTY,
      name: name,
      status: 'active',
      role_type: dominantRole(cells),
      preferred_language: lang,
      start_date: '2026-06-01',
      end_date: '2026-12-31',
    })
    .select('id,name,status')
    .single();

  if (result.error) {
    throw new Error('Insert volunteer ' + name + ': ' + result.error.message);
  }

  volBy.set(key, result.data);
  return result.data.id;
}

async function ensureTemplate(sb, tplBy, shiftName) {
  const key = shiftName.trim().toLowerCase();
  let t = tplBy.get(key);
  if (t) return t;

  const times = TIMES[shiftName] ?? ['09:00', '17:00'];
  const result = await sb
    .from('shift_templates')
    .insert({
      property_id: PROPERTY,
      name: shiftName,
      start_time: times[0],
      end_time: times[1],
    })
    .select('id,name,start_time,end_time')
    .single();

  if (result.error) {
    throw new Error('Insert template ' + shiftName + ': ' + result.error.message);
  }

  tplBy.set(key, result.data);
  return result.data;
}

async function main() {
  console.log('Loading existing volunteers and templates...');

  const volResult = await sb
    .from('volunteers')
    .select('id,name,status')
    .eq('property_id', PROPERTY);
  if (volResult.error) throw volResult.error;

  const tplResult = await sb
    .from('shift_templates')
    .select('id,name,start_time,end_time')
    .eq('property_id', PROPERTY);
  if (tplResult.error) throw tplResult.error;

  const volBy = new Map(
    (volResult.data ?? []).map(function(v) { return [v.name.trim().toLowerCase(), v]; })
  );
  const tplBy = new Map(
    (tplResult.data ?? []).map(function(t) { return [t.name.trim().toLowerCase(), t]; })
  );

  let totalShifts = 0;
  let volsCreated = 0;
  let tplsCreated = 0;

  for (let ti = 0; ti < TABS.length; ti++) {
    const tab = TABS[ti];
    console.log('\n── Tab: ' + tab + ' ──');

    const url =
      'https://docs.google.com/spreadsheets/d/' +
      SHEET_ID +
      '/gviz/tq?tqx=out:csv&sheet=' +
      encodeURIComponent(tab) +
      '&headers=0';

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error('Fetch failed for tab ' + tab + ': ' + resp.status);
    }
    const csv = await resp.text();

    const rota = parseRota(csv);
    const ws = weekStart(tab);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(ws, i));
    }

    console.log('  Dates: ' + days[0] + ' to ' + days[6]);
    console.log('  Volunteers: ' + Object.keys(rota).join(', '));

    const exResult = await sb
      .from('shifts')
      .select('id,volunteer_id,shift_date')
      .eq('property_id', PROPERTY)
      .gte('shift_date', days[0])
      .lte('shift_date', days[6]);
    if (exResult.error) throw exResult.error;

    const existing = new Map(
      (exResult.data ?? []).map(function(s) {
        return [s.volunteer_id + '__' + s.shift_date, s.id];
      })
    );

    const toInsert = [];
    const toUpdate = [];

    const names = Object.keys(rota);
    for (let ni = 0; ni < names.length; ni++) {
      const name = names[ni];
      const cells = rota[name];
      const vid = await ensureVolunteer(sb, volBy, name, cells);
      if (!volBy.has(name.trim().toLowerCase()) === false) {
        // already existed
      }

      for (let di = 0; di < 7; di++) {
        const n = normCell(cells[di]);
        if (n.kind === 'empty') continue;

        const key = vid + '__' + days[di];
        const existingId = existing.get(key);

        const base = {
          property_id: PROPERTY,
          volunteer_id: vid,
          shift_date: days[di],
        };

        let row;
        if (n.kind === 'off') {
          row = Object.assign({}, base, {
            shift_template_id: null,
            start_time: '00:00',
            end_time: '00:00',
            status: 'off',
          });
        } else {
          const tpl = await ensureTemplate(sb, tplBy, n.name);
          tplsCreated = tplResult.data.length < tplBy.size ? tplsCreated + 1 : tplsCreated;
          totalShifts++;
          row = Object.assign({}, base, {
            shift_template_id: tpl.id,
            start_time: tpl.start_time,
            end_time: tpl.end_time,
            status: 'scheduled',
          });
        }

        if (existingId) {
          toUpdate.push(Object.assign({ id: existingId }, row));
        } else {
          toInsert.push(row);
        }
      }
    }

    if (toInsert.length > 0) {
      const insertResult = await sb.from('shifts').insert(toInsert);
      if (insertResult.error) {
        throw new Error('Insert shifts: ' + insertResult.error.message);
      }
      console.log('  Inserted: ' + toInsert.length + ' new shifts');
    }

    if (toUpdate.length > 0) {
      for (let i = 0; i < toUpdate.length; i++) {
        const row = toUpdate[i];
        const id = row.id;
        const data = Object.assign({}, row);
        delete data.id;
        const updateResult = await sb.from('shifts').update(data).eq('id', id);
        if (updateResult.error) {
          throw new Error('Update shift ' + id + ': ' + updateResult.error.message);
        }
      }
      console.log('  Updated: ' + toUpdate.length + ' existing shifts');
    }

    if (toInsert.length === 0 && toUpdate.length === 0) {
      console.log('  No changes needed for this week.');
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log('Tabs processed: ' + TABS.join(', '));
  console.log('Total shifts written: ' + totalShifts);
  console.log('Volunteers created: ' + volsCreated);
}

main().catch(function(e) {
  console.error('FATAL:', e.message ?? e);
  process.exit(1);
});
