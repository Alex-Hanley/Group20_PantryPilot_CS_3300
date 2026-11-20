import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Item = { id: string; name: string; quantity: number; unit: string; category: string; location: string };
type Pantry = { items: Item[]; history: { id: string; text: string; time: string }[] };
const storageKey = 'pantrypilot.inventory.v1';
const empty: Pantry = { items: [], history: [] };
const blank = { name: '', quantity: '1', unit: 'each', category: '', location: 'Pantry' };

function load(): { pantry: Pantry; error: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { pantry: empty, error: '' };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.items) || !Array.isArray(data.history)
      || !data.items.every((i: Item) => i && typeof i.id === 'string'
        && ['name', 'unit', 'category', 'location'].every(k => typeof i[k as keyof Item] === 'string')
        && Number.isFinite(i.quantity) && i.quantity >= 0)
      || !data.history.every((h: Pantry['history'][number]) => h && typeof h.id === 'string'
        && typeof h.text === 'string' && typeof h.time === 'string')) throw new Error();
    return { pantry: data, error: '' };
  } catch {
    return { pantry: empty, error: 'Saved pantry could not be loaded. Reload after checking browser storage; changes are disabled to protect saved data.' };
  }
}

function App() {
  const [initial] = useState(load);
  const [pantry, setPantry] = useState(initial.pantry);
  const [error, setError] = useState(initial.error);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

// crypto.randomUUID only exists on HTTPS and localhost. Over plain HTTP (e.g. a phone
// on the LAN hitting `vite --host`) build a v4 UUID from getRandomValues instead.
  function newId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

  function commit(items: Item[], text: string) {
    if (initial.error) return false;
    const next = { items, history: [{ id: newId(), text, time: new Date().toISOString() }, ...pantry.history] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setPantry(next);
      setError('');
      return true;
    } catch {
      setError('Could not save changes. Check available browser storage and try again.');
      return false;
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.name.trim() || !form.unit.trim() || !form.location.trim()
      || !form.quantity.trim() || !Number.isFinite(quantity) || quantity < 0) {
      setError('Enter a name, unit, location, and a quantity of zero or more.');
      return;
    }
    const item: Item = { id: editing ?? newId(), name: form.name.trim(), quantity,
      unit: form.unit.trim(), category: form.category.trim(), location: form.location.trim() };
    const items = editing ? pantry.items.map(i => i.id === editing ? item : i) : [...pantry.items, item];
    if (commit(items, `${editing ? 'Updated' : 'Added'} ${item.name}: ${quantity} ${item.unit}`)) {
      setEditing(null);
      setForm(blank);
    }
  }

  function consume(item: Item) {
    const raw = (amounts[item.id] ?? '1').trim();
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive amount to consume.');
      return;
    }
    if (amount > item.quantity) {
      setError(`Cannot consume more than ${item.quantity} ${item.unit} of ${item.name}.`);
      return;
    }
    const quantity = Number((item.quantity - amount).toPrecision(15));
    if (commit(pantry.items.map(i => i.id === item.id ? { ...i, quantity } : i),
      `Consumed ${amount} ${item.unit} of ${item.name}`)) {
      setAmounts(current => ({ ...current, [item.id]: '1' }));
    }
  }

  function adjust(item: Item, delta: number) {
    const quantity = item.quantity + delta;
    if (quantity < 0 || !Number.isFinite(quantity)) return;
    commit(pantry.items.map(i => i.id === item.id ? { ...i, quantity } : i),
      `${delta < 0 ? 'Consumed' : 'Restored'} 1 ${item.unit} of ${item.name}`);
  }

  const visible = pantry.items.filter(i => `${i.name} ${i.category} ${i.location}`.toLowerCase().includes(query.toLowerCase()));
  return <main>
    <header><p className="eyebrow">PANTRYPILOT / TEAM 20</p><h1>Your pantry, in view.</h1>
      <p>Keep track of what you have and what you use.</p><small>Starter version · Saved in this browser only</small></header>
    {error && <p role="alert" className="error">{error}</p>}
    <section aria-labelledby="item-heading">
      <h2 id="item-heading">{editing ? 'Edit item' : 'Add a pantry item'}</h2>
      <form onSubmit={save}>
        <fieldset disabled={Boolean(initial.error)}>
          {(['name', 'quantity', 'unit', 'category', 'location'] as const).map(key => <label key={key}>
            {key.charAt(0).toUpperCase() + key.slice(1)}{key === 'category' ? ' (optional)' : ''}
            <input name={key} type={key === 'quantity' ? 'number' : 'text'} min={key === 'quantity' ? 0 : undefined}
              step={key === 'quantity' ? 'any' : undefined} required={key !== 'category'} value={form[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })} />
          </label>)}
          <button type="submit">{editing ? 'Save changes' : 'Add item'}</button>
          {editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
        </fieldset>
      </form>
    </section>
    <section aria-labelledby="inventory-heading">
      <div className="section-heading"><h2 id="inventory-heading">Inventory <span>{pantry.items.length}</span></h2>
        <label>Search pantry<input type="search" placeholder="Name, category, or location" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      {visible.length === 0 ? <p className="empty">{pantry.items.length ? 'No matching items.' : 'Your pantry is empty. Add your first item above.'}</p> :
        <ul className="inventory">{visible.map(item => <li key={item.id}>
          <div><h3>{item.name}</h3><p>{item.category || 'Uncategorized'} · {item.location}</p></div>
          <strong>{item.quantity} {item.unit}</strong>
          <div className="actions">
            <form className="consume-form" onSubmit={event => { event.preventDefault(); consume(item); }}>
              <label>Amount ({item.unit})
                <input className="consume-amount" inputMode="decimal" aria-label={`Amount to consume for ${item.name}`}
                  value={amounts[item.id] ?? '1'} disabled={item.quantity === 0 || Boolean(initial.error)}
                  onChange={event => setAmounts(current => ({ ...current, [item.id]: event.target.value }))} />
              </label>
              <button className="secondary" type="submit" disabled={item.quantity === 0 || Boolean(initial.error)}
                aria-label={`Consume ${item.name}`}>Consume</button>
            </form>
            <button className="secondary" onClick={() => adjust(item, 1)} aria-label={`Restore 1 ${item.unit} of ${item.name}`}>Restore 1</button>
            <button className="secondary" onClick={() => { setEditing(item.id); setForm({ ...item, quantity: String(item.quantity) }); }} aria-label={`Edit ${item.name}`}>Edit</button>
            <button className="secondary" onClick={() => {
              if (window.confirm(`Remove ${item.name} from the pantry?`) && commit(pantry.items.filter(i => i.id !== item.id), `Removed ${item.name}`) && editing === item.id) {
                setEditing(null); setForm(blank);
              }
            }} aria-label={`Remove ${item.name}`}>Remove</button>
          </div>
        </li>)}</ul>}
      <small>Enter an amount to consume in the item’s unit. Restore adds one unit.</small>
    </section>
    <section aria-labelledby="activity-heading"><h2 id="activity-heading">Activity</h2>
      {pantry.history.length ? <ul className="history">{pantry.history.map(entry => <li key={entry.id}>
        <span>{entry.text}</span><time dateTime={entry.time}>{new Date(entry.time).toLocaleString()}</time>
      </li>)}</ul> : <p className="empty">Your inventory changes will appear here.</p>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
