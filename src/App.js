import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Calendar,
  PieChart as PieIcon,
  BarChart3,
  Trash2,
  Settings,
  Wallet,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

/** ====== Local storage ====== */
const LS_KEY = 'finapp_v1_stackblitz';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtMoney(amount, currency) {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(0)}`;
  }
}
function fmtPct(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n)}%`;
}
function normalizeText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

/** 🎨 Colores para gráficas */
const CHART_COLORS = [
  '#2563eb', // azul
  '#16a34a', // verde
  '#f59e0b', // ámbar
  '#ef4444', // rojo
  '#8b5cf6', // morado
  '#06b6d4', // cyan
  '#f97316', // naranja
  '#22c55e', // verde claro
  '#0ea5e9', // azul claro
  '#64748b', // gris
];

/** Reglas simples de autocategorización (v1) */
const CATEGORY_RULES = [
  { match: ['uber', 'didi', 'taxi'], category: 'Transporte' },
  { match: ['starbucks', 'cafe', 'cafeteria'], category: 'Comida' },
  {
    match: ['netflix', 'spotify', 'prime', 'disney'],
    category: 'Entretenimiento',
  },
  {
    match: ['super', 'walmart', 'costco', 'soriana', 'chedraui'],
    category: 'Super',
  },
  { match: ['gas', 'gasolina', 'pemex', 'shell'], category: 'Transporte' },
  { match: ['renta', 'alquiler'], category: 'Hogar' },
  {
    match: ['luz', 'agua', 'internet', 'telcel', 'izzi', 'totalplay'],
    category: 'Servicios',
  },
  { match: ['ropa', 'zara', 'h&m', 'pull', 'bershka'], category: 'Ropa' },
  { match: ['cine'], category: 'Salidas' },
  {
    match: ['restaurante', 'taqueria', 'tacos', 'sushi', 'pizza'],
    category: 'Salidas',
  },
];

function suggestCategory(note, fallback) {
  const t = normalizeText(note);
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some((m) => t.includes(m))) return rule.category;
  }
  return fallback;
}

const DEFAULT_CATEGORIES = [
  'Comida',
  'Salidas',
  'Servicios',
  'Ropa',
  'Transporte',
  'Super',
  'Hogar',
  'Salud',
  'Educación',
  'Otros',
];

const PAYMENT_TYPES = [
  { key: 'cash', label: 'Efectivo' },
  { key: 'debit', label: 'Débito' },
  { key: 'credit', label: 'Crédito' },
];

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function defaultState() {
  return {
    settings: {
      currency: 'MXN',
      remindersEnabled: true,
    },
    categories: [...DEFAULT_CATEGORIES],
    expenses: [],
  };
}

/** ====== Simple UI helpers ====== */
function Card({ title, icon: Icon, children, right }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitleRow}>
          {Icon ? <Icon size={16} /> : null}
          <div style={styles.cardTitle}>{title}</div>
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  style,
  title,
}) {
  const base = {
    ...styles.btn,
    ...(variant === 'primary' ? styles.btnPrimary : styles.btnOutline),
    ...(disabled ? styles.btnDisabled : {}),
    ...style,
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick} style={base}>
      {children}
    </button>
  );
}

function Pill({ children }) {
  return <span style={styles.pill}>{children}</span>;
}

function Empty({ title, subtitle }) {
  return (
    <div style={{ padding: 18, textAlign: 'center', color: '#666' }}>
      <div style={{ fontWeight: 700, color: '#111' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

/** Leyenda con color + % + monto */
function LegendList({ items, currency, total }) {
  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
      {items.map((c, idx) => {
        const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        return (
          <div
            key={c.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: color,
                  display: 'inline-block',
                  flex: '0 0 auto',
                }}
              />
              <span
                style={{
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.name}
              </span>
              <span style={{ color: '#666', fontSize: 12 }}>
                {total > 0 ? `${pct}%` : ''}
              </span>
            </div>
            <span style={{ fontWeight: 900 }}>
              {fmtMoney(c.value, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** ====== App ====== */
export default function App() {
  const [state, setState] = useState(() => loadState() ?? defaultState());
  useEffect(() => saveState(state), [state]);

  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(monthKey(now));
  const currency = state.settings.currency;

  const activeMonthDates = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [activeMonth]);

  const monthExpenses = useMemo(() => {
    const { start, end } = activeMonthDates;
    return state.expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.expenses, activeMonthDates]);

  const prevMonthKey = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return monthKey(d);
  }, [activeMonth]);

  const prevMonthDates = useMemo(() => {
    const [y, m] = prevMonthKey.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [prevMonthKey]);

  const prevMonthExpenses = useMemo(() => {
    const { start, end } = prevMonthDates;
    return state.expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
  }, [state.expenses, prevMonthDates]);

  const totals = useMemo(() => {
    const cur = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const prev = prevMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const delta = cur - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : cur > 0 ? 100 : 0;
    return { cur, prev, delta, pct };
  }, [monthExpenses, prevMonthExpenses]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const e of monthExpenses)
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  const topCategories = useMemo(() => byCategory.slice(0, 3), [byCategory]);

  const calendarGroups = useMemo(() => {
    const m = new Map();
    for (const e of monthExpenses) {
      const d = new Date(e.date);
      const key = d.toISOString().slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(e);
    }
    const keys = [...m.keys()].sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => {
      const items = m.get(k);
      const total = items.reduce((s, e) => s + e.amount, 0);
      return { day: k, total, items };
    });
  }, [monthExpenses]);

  function addCategory(name) {
    const n = (name || '').trim();
    if (!n) return;
    if (state.categories.some((c) => normalizeText(c) === normalizeText(n)))
      return;
    setState((s) => ({ ...s, categories: [...s.categories, n] }));
  }

  function addExpense(expense) {
    setState((s) => ({ ...s, expenses: [expense, ...s.expenses] }));
  }

  function removeExpense(id) {
    setState((s) => ({
      ...s,
      expenses: s.expenses.filter((e) => e.id !== id),
    }));
  }

  function updateSettings(patch) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }

  const monthOptions = useMemo(() => {
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
      opts.push({
        key: monthKey(t),
        label: t.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      });
    }
    return opts;
  }, []);

  const quickInsights = useMemo(() => {
    const share =
      totals.cur > 0 ? (topCategories[0]?.value || 0) / totals.cur : 0;
    const biggest = topCategories[0]
      ? `Tu categoría #1 es ${topCategories[0].name} (${Math.round(
          share * 100
        )}% del mes).`
      : 'Aún no hay gastos este mes.';

    const trend =
      totals.prev > 0
        ? `Vas ${fmtPct(totals.pct)} vs el mes pasado (${fmtMoney(
            totals.delta,
            currency
          )}).`
        : totals.cur > 0
        ? 'Este es tu primer mes con datos para comparar.'
        : 'Registra tu primer gasto para ver insights.';

    const recorte = topCategories.length
      ? `Si quieres recortar, empieza por ${topCategories[0].name}: es donde más se nota.`
      : '';

    return [
      { title: 'Lo más fuerte', text: biggest, icon: Sparkles },
      { title: 'Comparación', text: trend, icon: BarChart3 },
      { title: 'Sugerencia', text: recorte, icon: ChevronRight },
    ].filter((x) => x.text);
  }, [totals, topCategories, currency]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <Header
          monthOptions={monthOptions}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
          settings={state.settings}
          updateSettings={updateSettings}
        />

        <div style={styles.grid}>
          {/* IZQUIERDA: DASHBOARD */}
          <div style={{ gridColumn: 'span 8' }}>
            <Card
              title="Dashboard"
              icon={BarChart3}
              right={<Pill>Mes calendario</Pill>}
            >
              <div style={styles.statsRow}>
                <Stat
                  label="Total del mes"
                  value={fmtMoney(totals.cur, currency)}
                  icon={Wallet}
                />
                <Stat
                  label="Mes pasado"
                  value={fmtMoney(totals.prev, currency)}
                  icon={Calendar}
                />
                <Stat
                  label="Cambio"
                  value={`${fmtMoney(totals.delta, currency)} · ${fmtPct(
                    totals.pct
                  )}`}
                  icon={BarChart3}
                />
              </div>

              <div style={styles.split2}>
                <div style={styles.subCard}>
                  <div style={styles.subTitle}>
                    <PieIcon size={16} /> Categorías
                  </div>

                  <div style={{ height: 240 }}>
                    {byCategory.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(v) => fmtMoney(Number(v), currency)}
                            labelFormatter={(label) => `Categoría: ${label}`}
                          />
                          <Pie
                            data={byCategory}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {byCategory.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <Empty
                        title="Aún no hay datos"
                        subtitle="Registra tu primer gasto para ver la gráfica."
                      />
                    )}
                  </div>

                  {byCategory.length ? (
                    <LegendList
                      items={byCategory}
                      currency={currency}
                      total={totals.cur}
                    />
                  ) : null}
                </div>

                <div style={styles.subCard}>
                  <div style={styles.subTitle}>
                    <Sparkles size={16} /> Insights rápidos
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {quickInsights.map((c, i) => (
                      <div key={i} style={styles.insight}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          <c.icon size={16} />
                          <div style={{ fontWeight: 700 }}>{c.title}</div>
                        </div>
                        <div style={{ color: '#666', marginTop: 6 }}>
                          {c.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Tabs
                currency={currency}
                expenses={monthExpenses}
                calendarGroups={calendarGroups}
                byCategory={byCategory}
                totalMonth={totals.cur}
                onRemove={removeExpense}
              />
            </Card>
          </div>

          {/* DERECHA: AGREGAR + TOP */}
          <div style={{ gridColumn: 'span 4' }}>
            <QuickAdd
              categories={state.categories}
              currency={currency}
              onAdd={addExpense}
              onAddCategory={addCategory}
            />

            <div style={{ height: 12 }} />

            <Card title="Top categorías" icon={PieIcon}>
              {topCategories.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {topCategories.map((c) => (
                    <div key={c.name} style={styles.row}>
                      <div>{c.name}</div>
                      <div style={{ fontWeight: 900 }}>
                        {fmtMoney(c.value, currency)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#666' }}>
                  Aún no hay categorías con gastos.
                </div>
              )}
            </Card>
          </div>
        </div>

        <div style={styles.footer}>
          MVP local-first. Tus datos se guardan en tu navegador (localStorage).
        </div>
      </div>
    </div>
  );
}

function Header({
  monthOptions,
  activeMonth,
  setActiveMonth,
  settings,
  updateSettings,
}) {
  return (
    <div style={styles.header}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Finanzas claras</div>
        <div style={{ color: '#666' }}>
          Registra en segundos · entiende tu mes
        </div>
      </div>

      <div style={styles.headerRight}>
        <select
          value={activeMonth}
          onChange={(e) => setActiveMonth(e.target.value)}
          style={styles.select}
        >
          {monthOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <SettingsPanel settings={settings} updateSettings={updateSettings} />
      </div>
    </div>
  );
}

function SettingsPanel({ settings, updateSettings }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'inline-block' }}>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        style={{ padding: '10px 12px' }}
        title="Configuración"
      >
        <Settings size={16} />
      </Button>

      {open ? (
        <div style={styles.modalBackdrop} onMouseDown={() => setOpen(false)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 900 }}>Configuración</div>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Moneda</div>
              <select
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value })}
                style={styles.select}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div style={{ height: 12 }} />

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={settings.remindersEnabled}
                onChange={(e) =>
                  updateSettings({ remindersEnabled: e.target.checked })
                }
              />
              <span>Recordatorios (visual por ahora)</span>
            </label>

            <div style={{ height: 8 }} />
            <div style={{ fontSize: 12, color: '#666' }}>
              Tus datos viven en este navegador. Si borras datos del sitio, se
              perderán.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div style={styles.stat}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ color: '#666' }}>{label}</div>
        <Icon size={16} color="#666" />
      </div>
      <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

function QuickAdd({ categories, currency, onAdd, onAddCategory }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState(categories[0] || 'Otros');
  const [payment, setPayment] = useState('cash');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCat, setNewCat] = useState('');
  const amountRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => amountRef.current?.focus?.(), 50);
  }, [open]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] || 'Otros');
  }, [categories, category]);

  function reset() {
    setAmount('');
    setNote('');
    setPayment('cash');
    setDate(new Date().toISOString().slice(0, 10));
  }

  function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    const chosen = category || 'Otros';
    const suggested = suggestCategory(note, chosen);

    onAdd({
      id: uid(),
      amount: Math.round(n),
      note: note.trim(),
      category: suggested,
      payment,
      date: new Date(date + 'T12:00:00').toISOString(),
      currency,
    });

    reset();
    setOpen(false);
  }

  return (
    <Card
      title="Agregar gasto"
      icon={Plus}
      right={
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} style={{ marginRight: 8 }} />
          Nuevo
        </Button>
      }
    >
      <div style={{ color: '#666', fontSize: 13 }}>
        Tip: escribe “uber”, “netflix”, “walmart”… para autocategorizar.
      </div>

      {open ? (
        <div style={styles.modalBackdrop} onMouseDown={() => setOpen(false)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div
              style={{
                fontWeight: 900,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>Nuevo gasto</div>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={styles.label}>Monto</div>
                <input
                  ref={amountRef}
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  placeholder={`Ej: 120 (${currency})`}
                  style={styles.input}
                />
              </div>

              <div>
                <div style={styles.label}>Nota (opcional)</div>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej: Uber / Tacos / Netflix"
                  style={styles.input}
                />
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  Sugerencia: <b>{suggestCategory(note, category)}</b>
                </div>
              </div>

              <div style={styles.twoCols}>
                <div>
                  <div style={styles.label}>Categoría</div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={styles.select}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={styles.label}>Pago</div>
                  <select
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                    style={styles.select}
                  >
                    {PAYMENT_TYPES.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={styles.label}>Fecha</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.divider} />

              <div>
                <div style={styles.label}>Agregar categoría</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="Ej: Mascotas"
                    style={styles.input}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const v = newCat.trim();
                      if (!v) return;
                      onAddCategory(v);
                      setNewCat('');
                    }}
                  >
                    Añadir
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <Button onClick={submit} style={{ flex: 1 }}>
                  Guardar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    reset();
                    setOpen(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Tabs({
  currency,
  expenses,
  calendarGroups,
  byCategory,
  totalMonth,
  onRemove,
}) {
  const [tab, setTab] = useState('mov');
  return (
    <div style={{ marginTop: 16 }}>
      <div style={styles.tabs}>
        <button
          onClick={() => setTab('mov')}
          style={tab === 'mov' ? styles.tabActive : styles.tab}
        >
          Movimientos
        </button>
        <button
          onClick={() => setTab('cal')}
          style={tab === 'cal' ? styles.tabActive : styles.tab}
        >
          Calendario
        </button>
        <button
          onClick={() => setTab('cat')}
          style={tab === 'cat' ? styles.tabActive : styles.tab}
        >
          Por categoría
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === 'mov' ? (
          <ExpensesList
            expenses={expenses}
            currency={currency}
            onRemove={onRemove}
          />
        ) : null}
        {tab === 'cal' ? (
          <CalendarList
            groups={calendarGroups}
            currency={currency}
            onRemove={onRemove}
          />
        ) : null}
        {tab === 'cat' ? (
          <CategoryView
            data={byCategory}
            currency={currency}
            totalMonth={totalMonth}
          />
        ) : null}
      </div>
    </div>
  );
}

function ExpensesList({ expenses, currency, onRemove }) {
  if (!expenses.length)
    return (
      <Empty title="Sin movimientos" subtitle="Agrega un gasto para empezar." />
    );

  return (
    <div style={styles.list}>
      {expenses.map((e) => (
        <div key={e.id} style={styles.listRow}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div
                style={{
                  fontWeight: 900,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.category}
              </div>
              <Pill>
                {PAYMENT_TYPES.find((p) => p.key === e.payment)?.label ||
                  'Pago'}
              </Pill>
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {e.note
                ? e.note
                : new Date(e.date).toLocaleString(undefined, {
                    day: '2-digit',
                    month: 'short',
                  })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 900 }}>
              {fmtMoney(e.amount, currency)}
            </div>
            <button
              onClick={() => onRemove(e.id)}
              style={styles.iconBtn}
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarList({ groups, currency, onRemove }) {
  if (!groups.length)
    return (
      <Empty
        title="Calendario vacío"
        subtitle="Tus gastos aparecerán agrupados por día."
      />
    );

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {groups.map((g) => (
        <div key={g.day} style={styles.dayCard}>
          <div style={styles.dayHeader}>
            <div style={{ fontWeight: 900 }}>
              {new Date(g.day + 'T12:00:00').toLocaleDateString(undefined, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </div>
            <div style={{ fontWeight: 900 }}>{fmtMoney(g.total, currency)}</div>
          </div>
          <div style={{ borderTop: '1px solid #eee' }}>
            {g.items.map((e) => (
              <div key={e.id} style={styles.dayRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>{e.category}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.note || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontWeight: 900 }}>
                    {fmtMoney(e.amount, currency)}
                  </div>
                  <button
                    onClick={() => onRemove(e.id)}
                    style={styles.iconBtn}
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryView({ data, currency, totalMonth }) {
  if (!data.length)
    return (
      <Empty
        title="Sin datos"
        subtitle="Agrega gastos para ver por categoría."
      />
    );

  const max = Math.max(...data.map((d) => d.value));
  const chartData = data.slice(0, 8);

  return (
    <div style={styles.split2}>
      <div style={styles.subCard}>
        <div style={styles.subTitle}>
          <BarChart3 size={16} /> Ranking
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {data.map((d, idx) => {
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            const pct =
              totalMonth > 0 ? Math.round((d.value / totalMonth) * 100) : 0;
            return (
              <div key={d.name} style={styles.rankRow}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {d.name}{' '}
                    <span
                      style={{ color: '#666', fontWeight: 700, fontSize: 12 }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    {fmtMoney(d.value, currency)}
                  </div>
                </div>
                <div style={styles.barBg}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${(d.value / max) * 100}%`,
                      background: color,
                      opacity: 0.35,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.subCard}>
        <div style={styles.subTitle}>
          <PieIcon size={16} /> Gráfica
        </div>

        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-20}
                height={50}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => fmtMoney(Number(v), currency)}
                labelFormatter={(label) => `Categoría: ${label}`}
              />
              <Bar dataKey="value">
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** ====== Styles ====== */
const styles = {
  page: { minHeight: '100vh', background: '#fafafa', color: '#111' },
  container: { maxWidth: 1100, margin: '0 auto', padding: 18 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  headerRight: { display: 'flex', gap: 10, alignItems: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 },
  card: {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: 18,
    padding: 14,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  cardTitle: { fontWeight: 900 },
  statsRow: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, 1fr)' },
  stat: {
    border: '1px solid #eee',
    borderRadius: 18,
    padding: 14,
    background: '#fff',
  },
  split2: {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: '1fr 1fr',
    marginTop: 12,
  },
  subCard: {
    border: '1px solid #eee',
    borderRadius: 18,
    padding: 12,
    background: '#fff',
  },
  subTitle: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontWeight: 900,
    marginBottom: 10,
  },
  insight: {
    border: '1px solid #eee',
    borderRadius: 16,
    padding: 12,
    background: '#fff',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    border: '1px solid #eee',
    borderRadius: 16,
    padding: 10,
  },
  btn: {
    borderRadius: 16,
    padding: '10px 12px',
    border: '1px solid transparent',
    cursor: 'pointer',
    fontWeight: 900,
  },
  btnPrimary: { background: '#111', color: '#fff' },
  btnOutline: { background: '#fff', color: '#111', borderColor: '#e5e5e5' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  select: {
    borderRadius: 14,
    padding: '10px 12px',
    border: '1px solid #e5e5e5',
    background: '#fff',
  },
  input: {
    width: '100%',
    borderRadius: 14,
    padding: '10px 12px',
    border: '1px solid #e5e5e5',
  },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  divider: { height: 1, background: '#eee', margin: '8px 0' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '10px 12px',
    borderRadius: 16,
    border: '1px solid #e5e5e5',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 900,
  },
  tabActive: {
    padding: '10px 12px',
    borderRadius: 16,
    border: '1px solid #111',
    background: '#111',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 900,
  },
  list: {
    border: '1px solid #eee',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#fff',
    marginTop: 12,
  },
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderBottom: '1px solid #eee',
  },
  iconBtn: {
    border: '1px solid #eee',
    background: '#fff',
    borderRadius: 14,
    padding: 8,
    cursor: 'pointer',
  },
  dayCard: {
    border: '1px solid #eee',
    borderRadius: 18,
    background: '#fff',
    overflow: 'hidden',
  },
  dayHeader: { display: 'flex', justifyContent: 'space-between', padding: 12 },
  dayRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
  },
  rankRow: {
    border: '1px solid #eee',
    borderRadius: 16,
    padding: 12,
    background: '#fff',
  },
  barBg: {
    height: 8,
    borderRadius: 999,
    background: '#f0f0f0',
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: { height: 8 },
  pill: {
    fontSize: 11,
    padding: '4px 8px',
    borderRadius: 999,
    background: '#f2f2f2',
    border: '1px solid #e9e9e9',
  },
  footer: { marginTop: 16, fontSize: 12, color: '#666' },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50,
  },
  modal: {
    width: 'min(520px, 100%)',
    background: '#fff',
    borderRadius: 18,
    border: '1px solid #eee',
    padding: 14,
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  },
  checkboxRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    cursor: 'pointer',
  },
};
