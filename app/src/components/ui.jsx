import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sun, Cloud, CloudRain, CloudSun, Plus, Star, X, ImagePlus, Clock } from "lucide-react";
import { homeTime } from "../lib/helpers.js";
import { isNative, pickNativePhoto, tapHaptic } from "../lib/native.js";

export function HomeClock({ homeTz, homeCity }) {
const [t, setT] = useState(() => homeTime(homeTz));
useEffect(() => {
const id = setInterval(() => setT(homeTime(homeTz)), 30000);
return () => clearInterval(id);
}, [homeTz]);
if (!t) return null;
return <div className="homeclock"><Clock size={13} /><span className="homeclock-l">{homeCity || "Home"}</span><span className="homeclock-t">{t}</span></div>;
}

export function WeatherGlyph({ kind, size = 22 }) {
const p = { size, strokeWidth: 1.6 };
if (kind === "sun") return <Sun {...p} />;
if (kind === "cloud") return <Cloud {...p} />;
if (kind === "cloudrain") return <CloudRain {...p} />;
return <CloudSun {...p} />;
}

export function Card({ children }) { return <div className="card">{children}</div>; }

export function QuickAdd({ placeholder, onAdd }) {
const [v, setV] = useState("");
const go = () => { if (v.trim()) { onAdd(v.trim()); setV(""); } };
return <div className="quickadd"><input value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} /><button onClick={go}><Plus size={16} /></button></div>;
}

export function Stat({ label, value, accent }) {
return <div className={"stat" + (accent ? " accent" : "")}><div className="stat-v">{value}</div><div className="stat-l">{label}</div></div>;
}

export function RateRow({ label, value, onChange }) {
return (
<div className="raterow"><span className="rate-label">{label}</span><div className="stars">
{[1, 2, 3, 4, 5].map(n => <button key={n} className="starbtn" onClick={() => onChange(n === value ? 0 : n)}><Star size={20} fill={n <= value ? "var(--accent)" : "none"} stroke={n <= value ? "var(--accent)" : "var(--line2)"} strokeWidth={1.5} /></button>)}
</div></div>
);
}

export function MiniStars({ label, v }) {
return <span className="mini"><span className="mini-l">{label}</span>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={11} fill={n <= v ? "var(--accent)" : "none"} stroke={n <= v ? "var(--accent)" : "var(--line2)"} strokeWidth={1.5} />)}</span>;
}

export function OverlaySheet({ title, onClose, children }) {
return createPortal(
<div className="sheet" onClick={onClose}>
<div className="sheetcard" onClick={e => e.stopPropagation()}>
<div className="sheethead">
<div className="sheettitle">{title}</div>
<button className="sheetx" onClick={onClose} aria-label="Close"><X size={16} /></button>
</div>
{children}
</div>
</div>
, document.body);
}

export function PhotoPicker({ files, setFiles, flash }) {
const pick = (fileList) => {
const room = Math.max(0, 4 - files.length);
const selected = Array.from(fileList || []).slice(0, room);
if (!selected.length) return;
const withPreview = selected.map(f => { f.__preview = URL.createObjectURL(f); return f; });
setFiles([...(files || []), ...withPreview]);
flash && flash(`${selected.length} photo${selected.length === 1 ? "" : "s"} ready`);
};
const remove = (idx) => {
const f = (files || [])[idx];
if (f && f.__preview) { try { URL.revokeObjectURL(f.__preview); } catch (e) {} }
setFiles((files || []).filter((_, i) => i !== idx));
};
const addNative = async () => {
await tapHaptic();
const f = await pickNativePhoto();
if (f) pick([f]);
};
return (
<div className="photopicker">
{isNative
? <button type="button" className="photobtn" onClick={addNative}><ImagePlus size={15} /> Add photo</button>
: <label className="photobtn"><ImagePlus size={15} /> Add photos<input type="file" accept="image/*" multiple onChange={e => pick(e.target.files)} /></label>}
<div className="muted xs">Photos upload to your account when you save.</div>
{!!(files || []).length && <div className="photochips">{files.map((f, i) => <button key={i} className="photochip" onClick={() => remove(i)}><img src={f.__preview} alt="" /><span>×</span></button>)}</div>}
</div>
);
}

export function PhotoGrid({ photos, onOpen }) {
return <div className="photogrid">{photos.map((p, i) => <button key={i} onClick={(e) => { e.stopPropagation(); onOpen(i); }}><img src={p.src} alt="Journal memory" loading="lazy" /></button>)}</div>;
}

export function PhotoViewer({ photos, index, onClose }) {
const [i, setI] = useState(index);
const startX = useRef(null);
const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
const onTouchEnd = (e) => {
if (startX.current == null) return;
const dx = e.changedTouches[0].clientX - startX.current;
startX.current = null;
if (dx <= -40) setI(v => Math.min(v + 1, photos.length - 1));
else if (dx >= 40) setI(v => Math.max(v - 1, 0));
};
return createPortal(
<div className="viewer" onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
<button className="viewer-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
<img src={photos[i].src} alt="Expanded memory" onClick={e => e.stopPropagation()} />
{photos.length > 1 && (
<div className="viewer-dots" onClick={e => e.stopPropagation()}>
{photos.map((_, n) => <button key={n} className={"dot" + (n === i ? " on" : "")} onClick={() => setI(n)} aria-label={`Photo ${n + 1}`} />)}
</div>
)}
</div>
, document.body);
}
