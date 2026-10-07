/**
 * Setup: the trade directory for this side. Name, type and an Australian
 * phone number (checked before saving), which shows as a tap-to-call link on
 * To chase, Waiting on and each step.
 */
import { useState } from 'react';
import { formatAuPhone, type DashboardApi, type SideFilter, type Trade } from '@ct/core';
import { useData, useSideQuery } from '../data/DataContext';
import { LoadError, LoadingRows } from '../components/bits';
import { SetupFrame } from '../setup/SetupFrame';
import { checkName, checkPhone } from '../setup/validate';
import { telHref, plural } from '../ui/itemWords';

type TradeRow = Trade & { openItems: number };

export function loadTrades(api: DashboardApi, filter: SideFilter): Promise<TradeRow[]> {
  return api.listTrades(filter);
}

export function SetupTradesScreen() {
  const q = useSideQuery(loadTrades);
  const { sides, sideId } = useData();
  const side = sides.find((s) => s.id === sideId)?.name;
  return (
    <SetupFrame title="Trades" sub={`The trade directory${side ? ` for ${side}` : ''}. Numbers show as tap-to-call links on To chase, Waiting on and each step.`}>
      {q.status === 'loading' && <LoadingRows rows={5} label="Loading trades" />}
      {q.status === 'error' && <LoadError what="the trades" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <TradesBody trades={q.data} />}
    </SetupFrame>
  );
}

interface Draft {
  name: string;
  type: string;
  phone: string;
}

function draftErrors(d: Draft) {
  return {
    name: checkName(d.name, 'trade'),
    type: d.type.trim() ? null : 'Say what they do, like Plumber or Tiler.',
    phone: checkPhone(d.phone),
  };
}

export function TradesBody({ trades }: { trades: TradeRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const types = [...new Set(trades.map((t) => t.type))].sort((a, b) => a.localeCompare(b));
  return (
    <>
      <datalist id="trade-type-list">
        {types.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <AddTrade
        onSaved={(msg) => {
          setNotice(msg);
          setEditing(null);
        }}
      />
      {notice && (
        <p className="su-saved" role="status" data-testid="trade-saved">
          {notice}
        </p>
      )}
      {trades.length === 0 ? (
        <p className="empty">No trades yet. Add them as you book them.</p>
      ) : (
        <table className="su-table su-trades" data-testid="trades">
          <thead>
            <tr>
              <th scope="col">Trade</th>
              <th scope="col">Does</th>
              <th scope="col">Phone</th>
              <th scope="col">Open items</th>
              <th scope="col">
                <span className="sr-only">Change</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) =>
              editing === t.id ? (
                <EditTradeRow
                  key={t.id}
                  trade={t}
                  onDone={(msg) => {
                    setEditing(null);
                    if (msg) setNotice(msg);
                  }}
                />
              ) : (
                <tr key={t.id} data-testid={`trade-${t.id}`}>
                  <th scope="row" className="su-strong">
                    {t.name}
                  </th>
                  <td>{t.type}</td>
                  <td>
                    {telHref(t.phone) ? (
                      <a className="su-tel" href={telHref(t.phone)!} data-testid="trade-phone">
                        {t.phone}
                      </a>
                    ) : (
                      <span className="su-muted">No number</span>
                    )}
                  </td>
                  <td>{t.openItems ? plural(t.openItems, 'item') : <span className="su-muted">None</span>}</td>
                  <td className="su-right">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => {
                        setNotice(null);
                        setEditing(t.id);
                      }}
                    >
                      Change<span className="sr-only"> {t.name}</span>
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </>
  );
}

function useSaveTrade() {
  const { api, refresh, sideId } = useData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(op: 'add_trade' | 'edit_trade', args: Record<string, unknown>): Promise<string | null> {
    setSaving(true);
    setError(null);
    try {
      const r = await api.applySetup(op, op === 'add_trade' && sideId ? { ...args, side: sideId } : args);
      if (!r.ok) {
        setError(r.reason);
        return null;
      }
      refresh();
      return r.result.summary;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSaving(false);
    }
  }
  return { save, saving, error };
}

function AddTrade({ onSaved }: { onSaved: (msg: string) => void }) {
  const [d, setD] = useState<Draft>({ name: '', type: '', phone: '' });
  const [touched, setTouched] = useState(false);
  const { save, saving, error } = useSaveTrade();
  const errs = draftErrors(d);
  const show = (m: string | null) => (touched ? m : null);
  return (
    <form
      className="su-panel su-addtrade"
      noValidate
      aria-labelledby="addtrade-h"
      data-testid="add-trade"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (errs.name || errs.type || errs.phone) return;
        void save('add_trade', { name: d.name.trim(), type: d.type.trim(), ...(d.phone.trim() ? { phone: d.phone.trim() } : {}) }).then((msg) => {
          if (!msg) return;
          setD({ name: '', type: '', phone: '' });
          setTouched(false);
          onSaved(`Saved: ${msg}.`);
        });
      }}
    >
      <h2 id="addtrade-h" className="su-panel-h">
        Add a trade
      </h2>
      <div className="su-row3">
        <TradeField id="at-name" label="Name" value={d.name} error={show(errs.name)} onChange={(name) => setD({ ...d, name })} placeholder="Kerbside Concrete" />
        <TradeField id="at-type" label="What they do" value={d.type} error={show(errs.type)} onChange={(type) => setD({ ...d, type })} placeholder="Concreter" list="trade-type-list" />
        <TradeField
          id="at-phone"
          label="Phone"
          value={d.phone}
          error={show(errs.phone)}
          onChange={(phone) => setD({ ...d, phone })}
          placeholder="0412 345 678"
          inputMode="tel"
          hint={!errs.phone && d.phone.trim() ? `Saved as ${formatAuPhone(d.phone)}` : 'Mobile or landline with area code'}
        />
      </div>
      <div className="su-actions">
        <button type="submit" className="btn btn-primary" disabled={saving} data-testid="add-trade-save">
          {saving ? 'Adding…' : 'Add trade'}
        </button>
        {error && (
          <p className="su-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function TradeField(props: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  list?: string;
  inputMode?: 'tel';
  hint?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className={props.error ? 'su-field has-error' : 'su-field'}>
      <label htmlFor={props.id} className={props.hideLabel ? 'sr-only' : undefined}>
        {props.label}
      </label>
      <input
        id={props.id}
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        list={props.list}
        inputMode={props.inputMode}
        autoComplete="off"
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${props.id}-error` : undefined}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error ? (
        <span className="su-error" id={`${props.id}-error`}>
          {props.error}
        </span>
      ) : (
        props.hint && <span className="su-hint">{props.hint}</span>
      )}
    </div>
  );
}

function EditTradeRow({ trade, onDone }: { trade: TradeRow; onDone: (msg: string | null) => void }) {
  const [d, setD] = useState<Draft>({ name: trade.name, type: trade.type, phone: trade.phone ?? '' });
  const { save, saving, error } = useSaveTrade();
  const errs = draftErrors(d);
  const phoneCleared = !!trade.phone && !d.phone.trim();
  const id = (f: string) => `et-${trade.id}-${f}`;
  async function submit() {
    if (errs.name || errs.type || errs.phone || phoneCleared) return;
    const args: Record<string, unknown> = { trade: trade.id };
    if (d.name.trim() !== trade.name) args.name = d.name.trim();
    if (d.type.trim() !== trade.type) args.type = d.type.trim();
    if (d.phone.trim() && formatAuPhone(d.phone) !== trade.phone) args.phone = d.phone.trim();
    if (Object.keys(args).length === 1) return onDone(null);
    const msg = await save('edit_trade', args);
    if (msg) onDone(`Saved: ${msg}.`);
  }
  return (
    <tr className="su-trade-edit" data-testid={`trade-edit-${trade.id}`}>
      <td colSpan={5}>
        <form
          noValidate
          aria-label={`Change ${trade.name}`}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="su-row3">
            <TradeField id={id('name')} label="Name" value={d.name} error={errs.name} onChange={(name) => setD({ ...d, name })} />
            <TradeField id={id('type')} label="What they do" value={d.type} error={errs.type} onChange={(type) => setD({ ...d, type })} list="trade-type-list" />
            <TradeField
              id={id('phone')}
              label="Phone"
              value={d.phone}
              inputMode="tel"
              error={errs.phone ?? (phoneCleared ? 'A saved number can be changed here but not removed.' : null)}
              onChange={(phone) => setD({ ...d, phone })}
            />
          </div>
          <div className="su-actions">
            <button type="submit" className="btn btn-primary" disabled={saving} data-testid="trade-edit-save">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={() => onDone(null)}>
              Cancel
            </button>
            {error && (
              <p className="su-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      </td>
    </tr>
  );
}
