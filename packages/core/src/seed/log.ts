/**
 * The seeded audit trail: inbound messages and the change sets they produced.
 * The rows elsewhere in the seed already hold every `after` value. Beatty's
 * tiler change (Tue 15 Sep, after the Mon 14 Sep snapshot) is the "why it
 * moved" source for its slip.
 */
import { toChangeRecord, type Change } from '../changes.js';
import { sydneyStamp } from '../dates.js';
import type { ChangeRecord, ChangeSet, InboundMessage, JsonValue } from '../types.js';
import { BEATTY, BEATTY_TILER } from './beatty.js';
import { PARK_RD, PARK_RD_WINDOWS } from './parkRd.js';
import { SEAVIEW } from './seaview.js';

/** Stand-in for Dominic's Telegram user id in seeded messages (the real one lives in .env). */
export const SEED_SENDER = 'seed-dominic';

interface Entry {
  msg: { id: string; date: string; time: string; text?: string; transcript?: string; audioPath?: string };
  cs: { id: string; time?: string; status?: ChangeSet['status']; summary: string; op: string; args: Record<string, JsonValue> };
  changes: Change[];
}

const upd = (table: Change['table'], rowId: string, field: string, before: JsonValue, after: JsonValue): Change => ({
  kind: 'update',
  table,
  rowId,
  field,
  before,
  after,
});

const ENTRIES: Entry[] = [
  {
    msg: { id: 'msg-0812-eta', date: '2026-08-12', time: '10:04', text: 'Park Rd windows now 26 Oct, factory pushed it a week' },
    cs: { id: 'cs-0812-eta', time: '10:05', summary: 'Park Rd windows ETA Mon 19 Oct to Mon 26 Oct', op: 'set_shipment_eta', args: { shipment: 'Park Rd windows', eta: '26 Oct' } },
    changes: [upd('shipment', PARK_RD_WINDOWS, 'eta', '2026-10-19', '2026-10-26')],
  },
  {
    msg: { id: 'msg-0812-status', date: '2026-08-12', time: '10:06', text: 'and theyre in production' },
    cs: { id: 'cs-0812-status', time: '10:06', summary: 'Park Rd windows: Design to In production', op: 'set_shipment_status', args: { shipment: 'Park Rd windows', status: 'in_production' } },
    changes: [upd('shipment', PARK_RD_WINDOWS, 'status', 'design', 'in_production')],
  },
  {
    msg: { id: 'msg-0908-beatty', date: '2026-09-08', time: '16:19', text: 'Beatty confirmed with Raff' },
    cs: { id: 'cs-0908-beatty', time: '16:20', summary: 'Beatty St confirmed Tue 8 Sep', op: 'confirm_job', args: { job: 'Beatty' } },
    changes: [upd('job', BEATTY, 'lastConfirmed', '2026-09-01', '2026-09-08')],
  },
  {
    msg: {
      id: 'msg-0915-tiler',
      date: '2026-09-15',
      time: '10:11',
      audioPath: 'audio/2026-09-15-msg-0915-tiler.ogg',
      transcript: "Harbour Tiling can't get to Beatty till the 5th of October",
    },
    cs: { id: 'cs-0915-tiler', time: '10:12', summary: 'Book tiler at Beatty St expected Mon 28 Sep to Mon 5 Oct', op: 'set_item_expected_date', args: { item: 'tiler', job: 'Beatty', date: 'the 5th of October' } },
    changes: [upd('item', BEATTY_TILER, 'expectedDate', '2026-09-28', '2026-10-05')],
  },
  {
    msg: { id: 'msg-0915-park', date: '2026-09-15', time: '16:39', text: 'park rd all confirmed with raff' },
    cs: { id: 'cs-0915-park', time: '16:40', summary: 'Park Rd confirmed Tue 15 Sep', op: 'confirm_job', args: { job: 'park rd' } },
    changes: [upd('job', PARK_RD, 'lastConfirmed', '2026-09-08', '2026-09-15')],
  },
  {
    msg: { id: 'msg-0916-seaview', date: '2026-09-16', time: '17:04', text: 'Seaview confirmed' },
    cs: { id: 'cs-0916-seaview', time: '17:05', summary: 'Seaview St confirmed Wed 16 Sep', op: 'confirm_job', args: { job: 'Seaview' } },
    changes: [upd('job', SEAVIEW, 'lastConfirmed', '2026-09-09', '2026-09-16')],
  },
  {
    // Dominic tapped Cancel: recorded, never applied.
    msg: { id: 'msg-0916-cancel', date: '2026-09-16', time: '17:10', text: 'windows 2 Nov' },
    cs: { id: 'cs-0916-cancel', status: 'cancelled', summary: 'Park Rd windows ETA Mon 26 Oct to Mon 2 Nov', op: 'set_shipment_eta', args: { shipment: 'windows', job: 'Park Rd', eta: '2 Nov' } },
    changes: [upd('shipment', PARK_RD_WINDOWS, 'eta', '2026-10-26', '2026-11-02')],
  },
];

export function seedLog(): { inboundMessages: InboundMessage[]; changeSets: ChangeSet[]; changes: ChangeRecord[] } {
  const inboundMessages: InboundMessage[] = [];
  const changeSets: ChangeSet[] = [];
  const changes: ChangeRecord[] = [];
  for (const e of ENTRIES) {
    const receivedAt = sydneyStamp(e.msg.date, e.msg.time);
    inboundMessages.push({
      id: e.msg.id,
      channel: 'telegram',
      sender: SEED_SENDER,
      rawText: e.msg.text ?? null,
      audioPath: e.msg.audioPath ?? null,
      transcript: e.msg.transcript ?? null,
      photoPath: null,
      receivedAt,
    });
    const status = e.cs.status ?? 'confirmed';
    const at = sydneyStamp(e.msg.date, e.cs.time ?? e.msg.time);
    changeSets.push({
      id: e.cs.id,
      messageId: e.msg.id,
      status,
      summary: e.cs.summary,
      opName: e.cs.op,
      opArgs: e.cs.args,
      createdAt: receivedAt,
      confirmedAt: status === 'confirmed' ? at : null,
      cancelledAt: status === 'cancelled' ? at : null,
      undoneAt: null,
    });
    e.changes.forEach((c, i) => changes.push(toChangeRecord(c, e.cs.id, i + 1, `${e.cs.id}-${i + 1}`)));
  }
  return { inboundMessages, changeSets, changes };
}
