/**
 * Six built-in starter templates in the #1832 folder format: landing, dashboard, settings, onboarding, pricing, mobile shell.
 * Token-driven: every colour is a CSS variable from the template's tokens, with a dark value and a `-light` value picked by `light-dark()`, so a retheme or a brand kit changes all six.
 * Liquid Glass friendly: cards are translucent with a backdrop blur over a soft gradient, and text sits on solid-enough surfaces (contrast is checked in starters.test.ts).
 * Default text comes from the content packs (#1836) with a fixed seed, so the starters look real and never change between runs.
 */
import { resolve, series, record, records } from '../content/pack';
import type { TemplateFolder } from '../template';
import type { SlotType } from '../template';

const C = { seed: 'swift-starters' };
const P = (ref: string, index = 0): string => resolve(ref, { ...C, index });

/** Shared design tokens: dark values plain, light values with the `-light` suffix. */
export const STARTER_TOKENS: Record<string, string> = {
  '--bg': '#0b0d12', '--bg-light': '#eef1f6', '--bg2': '#171b26', '--bg2-light': '#dfe6f1',
  '--fg': '#f6f7fa', '--fg-light': '#0f1117', '--muted': '#c3cad8', '--muted-light': '#414858',
  '--accent': '#5eead4', '--accent-light': '#0f766e', '--accent-fg': '#06201c', '--accent-fg-light': '#ffffff',
  '--card': 'rgba(255,255,255,0.09)', '--card-light': 'rgba(255,255,255,0.72)',
  '--border': 'rgba(255,255,255,0.18)', '--border-light': 'rgba(15,17,23,0.14)',
  '--radius': '20px', '--blur': '24px',
};
/** Root-level variables: pick dark or light by the viewer's colour scheme. Every element uses only these. */
const pick = (n: string): string => `--c-${n}:light-dark(var(--${n}-light,var(--${n})),var(--${n}))`;
const ROOT_VARS = `color-scheme:light dark;${['bg', 'bg2', 'fg', 'muted', 'accent', 'accent-fg', 'card', 'border'].map(pick).join(';')}`;
const root = (id: string, w: number, h: number, extra = ''): string =>
  `id="${id}" style="${ROOT_VARS};position:relative;width:${w}px;height:${h}px;overflow:hidden;box-sizing:border-box;font-family:var(--font,system-ui);color:var(--c-fg);background:radial-gradient(circle at 15% 10%,color-mix(in srgb,var(--c-accent) 28%,transparent),transparent 45%),linear-gradient(135deg,var(--c-bg),var(--c-bg2));${extra}"`;
const glass = 'background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--radius,20px);backdrop-filter:blur(var(--blur,24px)) saturate(1.4);-webkit-backdrop-filter:blur(var(--blur,24px)) saturate(1.4)';
const btn = (id: string, text: string, ghost = false): string => `<div id="${id}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 28px;border-radius:14px;font-size:18px;font-weight:600;box-sizing:border-box;${ghost ? `border:1px solid var(--c-border);color:var(--c-fg)` : 'background:var(--c-accent);color:var(--c-accent-fg)'}">${text}</div>`;
const muted = 'color:var(--c-muted)';

type SlotDef = { id: string; type: SlotType; label: string; prompt: string; default: string | string[]; required?: boolean };
type FrameSpec = { id: string; title: string; file: string; w: number; h: number; html: string };
const folder = (name: string, description: string, slots: SlotDef[], frames: FrameSpec[]): TemplateFolder => ({
  files: {
    'template.json': JSON.stringify({ swiftCanvasTemplate: 1, name, description, slots, tokens: STARTER_TOKENS, frames: frames.map(({ html: _h, ...f }) => f) }),
    ...Object.fromEntries(frames.map((f) => [`frames/${f.file}`, f.html])),
  },
});
const text = (id: string, label: string, prompt: string, def: string): SlotDef => ({ id, type: 'text', label, prompt, default: def });
const list = (id: string, label: string, prompt: string, def: string[]): SlotDef => ({ id, type: 'list', label, prompt, default: def });
const items = (css: string): string => `<style>${css}</style>`;

// ---------- landing ----------
const landing = (): TemplateFolder => {
  const html = `<div ${root('landing', 1280, 900)}>${items('#landing ul{list-style:none;margin:0;padding:0;display:flex;gap:20px}#landing li{flex:1;padding:24px;font-size:18px;line-height:1.4;' + glass + '}')}
<div id="landing-nav" style="position:absolute;left:80px;right:80px;top:32px;height:56px;display:flex;align-items:center;justify-content:space-between"><div id="landing-brand" style="font-size:22px;font-weight:700">{{brand}}</div>${btn('landing-signin', 'Sign in', true)}</div>
<div id="landing-hero" style="position:absolute;left:80px;top:170px;width:760px"><div id="landing-headline" style="font-size:68px;line-height:1.05;font-weight:700;letter-spacing:-.02em">{{headline}}</div><div id="landing-sub" style="margin-top:24px;font-size:24px;line-height:1.4;${muted}">{{subhead}}</div><div style="margin-top:36px;display:flex;gap:16px">${btn('landing-cta', '{{cta}}')}${btn('landing-cta2', 'See how it works', true)}</div></div>
<div id="landing-features" style="position:absolute;left:80px;right:80px;top:600px"><div id="landing-features-h" style="font-size:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;${muted};margin-bottom:16px">Why teams switch</div><ul id="landing-list">{{features}}</ul></div></div>`;
  return folder('Landing', 'Marketing page: nav, hero with call to action, three reasons to switch.', [
    text('brand', 'Brand', 'The product or company name.', 'Northwind'), text('headline', 'Headline', 'The main promise in under 10 words.', P('copy.headline')),
    text('subhead', 'Subhead', 'One sentence that backs up the promise.', P('copy.subhead')), text('cta', 'Button', 'Primary action, 2 words.', P('copy.cta')),
    list('features', 'Reasons', 'Three short benefits, one sentence each.', ['Set up in minutes, not weeks', 'One shared view for the whole team', 'Your data stays yours, always']),
  ], [{ id: 'landing', title: 'Landing 1280', file: 'landing.html', w: 1280, h: 900, html }]);
};

// ---------- dashboard ----------
const dashboard = (): TemplateFolder => {
  const bars = series('metrics.revenue', 12, C); const max = Math.max(...bars);
  const barHtml = bars.map((v, i) => `<div style="flex:1;height:${Math.round((v / max) * 100)}%;border-radius:8px 8px 0 0;background:var(--c-accent);opacity:${i === bars.length - 1 ? 1 : 0.6}"></div>`).join('');
  const orders = records('orders.order', 5, C).map((o) => `${o.id} · ${o.status} · ${o.total}`);
  const kpi = (i: number, id: string): string => `<div id="dash-${id}" style="${glass};padding:24px;width:340px;box-sizing:border-box"><div id="dash-${id}-l" style="font-size:16px;${muted}">{{${id}-label}}</div><div id="dash-${id}-v" style="margin-top:8px;font-size:44px;font-weight:700">{{${id}}}</div></div>`;
  const html = `<div ${root('dash', 1280, 860)}>${items('#dash ul{list-style:none;margin:0;padding:0}#dash li{padding:14px 0;font-size:18px;border-bottom:1px solid var(--c-border)}#dash li:last-child{border-bottom:0}')}
<div id="dash-title" style="position:absolute;left:64px;top:44px;font-size:36px;font-weight:700">{{title}}</div><div id="dash-range" style="position:absolute;right:64px;top:50px;font-size:18px;${muted}">Last 12 months</div>
<div style="position:absolute;left:64px;top:124px;display:flex;gap:24px">${kpi(0, 'kpi1')}${kpi(1, 'kpi2')}${kpi(2, 'kpi3')}</div>
<div id="dash-chart" style="position:absolute;left:64px;top:300px;width:700px;height:500px;box-sizing:border-box;padding:28px;${glass}"><div id="dash-chart-t" style="font-size:20px;font-weight:600">{{chart-title}}</div><div id="dash-bars" style="margin-top:24px;height:360px;display:flex;align-items:flex-end;gap:10px">${barHtml}</div></div>
<div id="dash-orders" style="position:absolute;left:788px;top:300px;width:428px;height:500px;box-sizing:border-box;padding:28px;${glass}"><div id="dash-orders-t" style="font-size:20px;font-weight:600;margin-bottom:8px">Recent orders</div><ul id="dash-orders-l">{{orders}}</ul></div></div>`;
  const k = records('metrics.kpi', 3, C);
  return folder('Dashboard', 'Metrics overview: three KPI cards, a revenue chart and a recent-orders list.', [
    text('title', 'Title', 'Name of the dashboard.', 'Overview'), text('chart-title', 'Chart title', 'What the chart shows.', 'Revenue per month'),
    ...[1, 2, 3].flatMap((n) => [text(`kpi${n}-label`, `KPI ${n} label`, 'Short metric name.', k[n - 1]!.kpi!), text(`kpi${n}`, `KPI ${n} value`, 'The number, formatted.', k[n - 1]!.revenue!)]),
    list('orders', 'Orders', 'Five recent orders, one line each: id, status, total.', orders),
  ], [{ id: 'dash', title: 'Dashboard 1280', file: 'dashboard.html', w: 1280, h: 860, html }]);
};

// ---------- settings ----------
const settings = (): TemplateFolder => {
  const person = record('people.person', C);
  const toggle = (id: string, label: string, on: boolean): string => `<div id="${id}" style="display:flex;align-items:center;justify-content:space-between;min-height:56px;font-size:18px"><span>${label}</span><span style="width:52px;height:30px;border-radius:15px;box-sizing:border-box;padding:3px;display:flex;justify-content:${on ? 'flex-end' : 'flex-start'};background:${on ? 'var(--c-accent)' : 'var(--c-border)'}"><span style="width:24px;height:24px;border-radius:12px;background:${on ? 'var(--c-accent-fg)' : 'var(--c-fg)'}"></span></span></div>`;
  const field = (id: string, label: string, v: string): string => `<div style="margin-bottom:20px"><div style="font-size:16px;${muted};margin-bottom:6px">${label}</div><div id="${id}" style="min-height:48px;display:flex;align-items:center;padding:0 16px;box-sizing:border-box;border-radius:12px;border:1px solid var(--c-border);background:var(--c-card);font-size:18px">${v}</div></div>`;
  const html = `<div ${root('settings', 1280, 800)}>${items('#settings ul{list-style:none;margin:0;padding:0}#settings li{min-height:48px;display:flex;align-items:center;padding:0 16px;border-radius:12px;font-size:18px;margin-bottom:4px}#settings li:first-child{background:var(--c-accent);color:var(--c-accent-fg);font-weight:600}')}
<div id="settings-side" style="position:absolute;left:48px;top:48px;width:280px;height:704px;box-sizing:border-box;padding:24px 16px;${glass}"><div id="settings-side-t" style="font-size:28px;font-weight:700;padding:0 16px 16px">{{title}}</div><ul id="settings-nav">{{sections}}</ul></div>
<div id="settings-main" style="position:absolute;left:352px;top:48px;width:880px;height:704px;box-sizing:border-box;padding:40px;${glass}"><div id="settings-h" style="font-size:30px;font-weight:700;margin-bottom:28px">{{section-title}}</div>${field('settings-name', 'Name', '{{name}}')}${field('settings-email', 'Email', '{{email}}')}<div style="margin-top:28px;border-top:1px solid var(--c-border)">${toggle('settings-t1', 'Email me a weekly summary', true)}${toggle('settings-t2', 'Notify me about mentions', true)}${toggle('settings-t3', 'Share usage data', false)}</div><div style="position:absolute;right:40px;bottom:40px;display:flex;gap:12px">${btn('settings-cancel', 'Cancel', true)}${btn('settings-save', 'Save changes')}</div></div></div>`;
  return folder('Settings', 'Settings page: section list, profile fields, toggles and save bar.', [
    text('title', 'Title', 'Page title.', 'Settings'), list('sections', 'Sections', 'Settings sections, first one is active.', ['Profile', 'Notifications', 'Billing', 'Team', 'Security']),
    text('section-title', 'Section title', 'Title of the active section.', 'Profile'), text('name', 'Name', 'Full name of the user.', `${person.first} ${person.last}`),
    text('email', 'Email', 'Email address.', P('people.email')),
  ], [{ id: 'settings', title: 'Settings 1280', file: 'settings.html', w: 1280, h: 800, html }]);
};

// ---------- onboarding ----------
const onboarding = (): TemplateFolder => {
  const dot = (n: number, on: boolean): string => `<div style="width:${on ? 40 : 12}px;height:12px;border-radius:6px;background:${on ? 'var(--c-accent)' : 'var(--c-border)'}"></div>`;
  const html = `<div ${root('onb', 1280, 800)}>${items('#onb ul{list-style:none;margin:28px 0 0;padding:0}#onb li{display:flex;align-items:center;min-height:56px;font-size:20px;border-bottom:1px solid var(--c-border)}#onb li:before{content:"";width:12px;height:12px;border-radius:6px;margin-right:16px;background:var(--c-accent)}#onb li:last-child{border-bottom:0}')}
<div id="onb-card" style="position:absolute;left:340px;top:100px;width:600px;box-sizing:border-box;padding:48px;${glass}"><div id="onb-dots" style="display:flex;gap:8px;margin-bottom:32px">${dot(1, true)}${dot(2, false)}${dot(3, false)}</div><div id="onb-step" style="font-size:16px;${muted}">{{step}}</div><div id="onb-title" style="margin-top:8px;font-size:40px;line-height:1.1;font-weight:700">{{title}}</div><div id="onb-sub" style="margin-top:16px;font-size:20px;line-height:1.4;${muted}">{{subtitle}}</div><ul id="onb-list">{{tasks}}</ul><div style="margin-top:36px;display:flex;justify-content:space-between">${btn('onb-skip', 'Skip for now', true)}${btn('onb-next', '{{next}}')}</div></div></div>`;
  return folder('Onboarding', 'First-run step: progress dots, welcome message, a short checklist and next/skip.', [
    text('step', 'Step label', 'Where the user is, like "Step 1 of 3".', 'Step 1 of 3'), text('title', 'Title', 'Welcome message, short.', 'Welcome aboard'),
    text('subtitle', 'Subtitle', 'One sentence about what happens next.', 'Three quick things and you are ready to go.'),
    list('tasks', 'Checklist', 'Three setup tasks.', ['Create your first project', 'Invite your team', 'Connect your data']), text('next', 'Button', 'Next action, 2 words.', 'Continue'),
  ], [{ id: 'onb', title: 'Onboarding 1280', file: 'onboarding.html', w: 1280, h: 800, html }]);
};

// ---------- pricing ----------
const pricing = (): TemplateFolder => {
  const plans = [
    { n: 'starter', name: 'Starter', price: '$0', feats: ['1 project', 'Community support', 'Basic analytics'], hi: false },
    { n: 'pro', name: 'Pro', price: '$24', feats: ['Unlimited projects', 'Priority support', 'Advanced analytics', 'Custom domains'], hi: true },
    { n: 'team', name: 'Team', price: '$79', feats: ['Everything in Pro', 'Shared workspaces', 'Single sign-on', 'Audit log'], hi: false },
  ];
  const card = (p: (typeof plans)[number], x: number): string => `<div id="price-${p.n}" style="position:absolute;left:${x}px;top:230px;width:350px;height:520px;box-sizing:border-box;padding:32px;${glass};${p.hi ? 'border:2px solid var(--c-accent)' : ''}"><div id="price-${p.n}-name" style="font-size:22px;font-weight:700">{{${p.n}-name}}</div><div id="price-${p.n}-amount" style="margin-top:12px;font-size:56px;font-weight:700">{{${p.n}-price}}<span style="font-size:18px;font-weight:400;${muted}"> /month</span></div><ul id="price-${p.n}-list">{{${p.n}-features}}</ul><div style="position:absolute;left:32px;right:32px;bottom:32px">${btn(`price-${p.n}-cta`, p.hi ? 'Start free trial' : 'Choose plan', !p.hi).replace('display:inline-flex', 'display:flex')}</div></div>`;
  const html = `<div ${root('price', 1280, 820)}>${items('#price ul{list-style:none;margin:24px 0 0;padding:0}#price li{padding:8px 0;font-size:18px}#price li:before{content:"\\2713";margin-right:10px;color:var(--c-accent);font-weight:700}')}
<div id="price-title" style="position:absolute;left:0;right:0;top:64px;text-align:center;font-size:52px;font-weight:700;letter-spacing:-.02em">{{title}}</div><div id="price-sub" style="position:absolute;left:0;right:0;top:140px;text-align:center;font-size:22px;${muted}">{{subtitle}}</div>${plans.map((p, i) => card(p, 80 + i * 380)).join('')}</div>`;
  return folder('Pricing', 'Three plan cards with price, feature list and button; the middle plan is highlighted.', [
    text('title', 'Title', 'Pricing headline.', P('copy.headline', 3)), text('subtitle', 'Subtitle', 'One sentence about trials or cancelling.', P('copy.subhead', 2)),
    ...plans.flatMap((p) => [text(`${p.n}-name`, `${p.name} name`, 'Plan name.', p.name), text(`${p.n}-price`, `${p.name} price`, 'Price with currency symbol, no period.', p.price), list(`${p.n}-features`, `${p.name} features`, 'Three or four features.', p.feats)]),
  ], [{ id: 'price', title: 'Pricing 1280', file: 'pricing.html', w: 1280, h: 820, html }]);
};

// ---------- mobile shell ----------
const mobile = (): TemplateFolder => {
  const tab = (id: string, label: string, on: boolean): string => `<div id="${id}" style="flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:13px;${on ? 'color:var(--c-accent);font-weight:700' : muted}"><span style="width:24px;height:24px;border-radius:8px;background:${on ? 'var(--c-accent)' : 'var(--c-border)'}"></span>${label}</div>`;
  const html = `<div ${root('mob', 390, 844)}>${items('#mob ul{list-style:none;margin:0;padding:0}#mob li{margin-bottom:12px;padding:16px;min-height:44px;box-sizing:border-box;font-size:17px;' + glass + '}')}
<div id="mob-bar" style="position:absolute;left:0;right:0;top:0;height:104px;box-sizing:border-box;padding:56px 20px 0;font-size:28px;font-weight:700">{{title}}</div>
<div id="mob-body" style="position:absolute;left:20px;right:20px;top:112px;bottom:100px;overflow:hidden"><div id="mob-hello" style="font-size:16px;${muted};margin-bottom:12px">{{greeting}}</div><ul id="mob-list">{{cards}}</ul></div>
<div id="mob-tabs" style="position:absolute;left:12px;right:12px;bottom:20px;height:68px;display:flex;box-sizing:border-box;${glass};border-radius:24px">${tab('mob-t1', 'Home', true)}${tab('mob-t2', 'Search', false)}${tab('mob-t3', 'Inbox', false)}${tab('mob-t4', 'Profile', false)}</div></div>`;
  const prod = records('products.product', 4, C).map((p) => `${p.name} · ${p.price}`);
  return folder('Mobile shell', 'Phone app shell 390x844: title bar, scrolling card list and a glass tab bar.', [
    text('title', 'Title', 'Screen title.', 'Home'), text('greeting', 'Greeting', 'A short line under the title.', 'Picked for you today'),
    list('cards', 'Cards', 'Four list items, one line each.', prod),
  ], [{ id: 'mob', title: 'Mobile 390', file: 'mobile.html', w: 390, h: 844, html }]);
};

export type Starter = { dir: string; folder: TemplateFolder };
/** The built-in starters, in the shape `loadTemplates({ builtin })` takes. */
export const STARTERS: Starter[] = [['landing', landing], ['dashboard', dashboard], ['settings', settings], ['onboarding', onboarding], ['pricing', pricing], ['mobile-shell', mobile]].map(([dir, make]) => ({ dir: `builtin:${dir as string}`, folder: (make as () => TemplateFolder)() }));
