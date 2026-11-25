"use client";

// The Options tab — everything on the booking form that has an option. Edits
// stay local until that section's Save settings button is pressed; the button
// PUTs only the section's own fields to /api/admin/config (the route keeps the
// current value for anything missing), so unsaved edits elsewhere are left
// alone. The header shows a quiet Saving… / Saved indicator; failures surface
// as a toast with a retry.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CARS } from "@/components/fleet/data";
import type { SiteConfig } from "@/lib/siteConfigDefaults";
import { ACCENT, BLUE, btn, card, input } from "../ui";

// The photo choices for added cars: the EXISTING car images already in the repo.
const IMAGE_CHOICES = [...new Set(CARS.filter((c) => c.image).map((c) => c.image!))];

type SaveState = "idle" | "saving" | "saved" | "error";

// The config fields each section's Save settings button writes.
const SECTIONS = {
  pickups: ["popularPickups"],
  durations: ["durations"],
  tripTypes: ["tripTypes"],
  quickRequests: ["quickRequests"],
  // Added cars carry their Quick Booking prices, so saving cars writes those too.
  cars: ["hiddenCars", "extraCars", "qbRates"],
  quickCars: ["quickCars"],
  qbRates: ["qbRates"],
  payment: ["payment"],
} satisfies Record<string, (keyof SiteConfig)[]>;
type Section = keyof typeof SECTIONS;

export default function OptionsTab({
  config,
  savedConfig,
  onConfig,
  onSaved,
}: {
  config: SiteConfig;
  savedConfig: SiteConfig;
  onConfig: (c: SiteConfig) => void;
  onSaved: (c: SiteConfig) => void;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savingSection, setSavingSection] = useState<Section | null>(null);

  const set = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    onConfig({ ...config, [key]: value });
  };

  // Set one Quick Booking fare for a car, keeping its other fares.
  const setQb = (id: string, field: "airport" | "hours12" | "hours24", value: string) => {
    const r = config.qbRates[id] ?? { airport: 0, hours12: 0, hours24: 0 };
    set("qbRates", { ...config.qbRates, [id]: { ...r, [field]: Number(value) || 0 } });
  };

  // Removing an added car also drops its Quick Booking prices (one update, so
  // both changes land together).
  const removeCar = (i: number) => {
    const id = config.extraCars[i].id;
    const { [id]: _drop, ...qbRates } = config.qbRates;
    void _drop;
    onConfig({ ...config, extraCars: config.extraCars.filter((_, j) => j !== i), qbRates });
  };

  const isDirty = (section: Section) =>
    SECTIONS[section].some((k) => JSON.stringify(config[k]) !== JSON.stringify(savedConfig[k]));
  const anyDirty = (Object.keys(SECTIONS) as Section[]).some(isDirty);

  // Warn before leaving the page with edits that haven't been saved.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const save = async (section: Section) => {
    const keys = SECTIONS[section];
    const patch = Object.fromEntries(keys.map((k) => [k, config[k]]));
    setSavingSection(section);
    setSaveState("saving");
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    const next = res?.ok ? (body as SiteConfig | null) : null;
    setSavingSection(null);
    if (next) {
      // Take the server's cleaned-up values for this section only, so unsaved
      // edits in other sections stay on screen.
      const fromServer = Object.fromEntries(keys.map((k) => [k, next[k]]));
      onSaved({ ...savedConfig, ...fromServer });
      onConfig({ ...config, ...fromServer });
      setSaveState("saved");
    } else {
      setSaveState("error");
      // Show the server's reason when it gives one, not just the status code.
      const reason = (body as { error?: string } | null)?.error;
      toast.error(`Changes didn't save${res ? ` (error ${res.status})` : " (no connection)"}`, {
        description: reason,
        action: { label: "Retry", onClick: () => void save(section) },
      });
    }
  };

  const saveButton = (section: Section) => (
    <div className="mt-4 flex justify-end border-t border-neutral-100 pt-4">
      <button
        type="button"
        onClick={() => void save(section)}
        disabled={!isDirty(section) || savingSection !== null}
        className={btn}
        style={{ background: BLUE }}
      >
        {savingSection === section ? "Saving…" : "Save settings"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-josefin text-2xl font-light">Form options</h1>
        <span
          className="text-xs font-semibold transition-opacity duration-300"
          style={{
            color: saveState === "error" ? "#dc2626" : saveState === "saved" ? "#15803d" : "#a3a3a3",
            opacity: saveState === "idle" ? 0 : 1,
          }}
          aria-live="polite"
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Not saved" : ""}
        </span>
      </div>

      {/* popular pickups */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Popular pickup spots</h2>
        <div className="flex flex-col gap-2">
          {config.popularPickups.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p.city} onChange={(e) => set("popularPickups", config.popularPickups.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} className={`${input} !w-28`} placeholder="City" />
              <input value={p.name} onChange={(e) => set("popularPickups", config.popularPickups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Spot name" />
            </div>
          ))}
        </div>
        {saveButton("pickups")}
      </section>

      {/* durations */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Duration tiers</h2>
        <div className="flex flex-col gap-3">
          {config.durations.map((d, i) => (
            <div key={d.id} className="grid gap-2 sm:grid-cols-[10rem_6rem_1fr]">
              <input value={d.name} onChange={(e) => set("durations", config.durations.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} />
              {d.id !== "multiday" ? (
                <input type="number" min={1} value={d.hours ?? 0} onChange={(e) => set("durations", config.durations.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) } : x)))} className={input} />
              ) : (
                <span className="self-center text-xs text-neutral-400">per-day</span>
              )}
              <input value={d.desc} onChange={(e) => set("durations", config.durations.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} className={input} />
            </div>
          ))}
        </div>
        {saveButton("durations")}
      </section>

      {/* trip types */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Trip types</h2>
        <div className="flex flex-col gap-3">
          {config.tripTypes.map((t, i) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <input value={t.name} onChange={(e) => set("tripTypes", config.tripTypes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} />
              <input value={t.desc} onChange={(e) => set("tripTypes", config.tripTypes.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} className={input} />
            </div>
          ))}
        </div>
        {saveButton("tripTypes")}
      </section>

      {/* quick requests */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Quick request chips</h2>
        <div className="flex flex-col gap-2">
          {config.quickRequests.map((q, i) => (
            <div key={i} className="flex gap-2">
              <input value={q} onChange={(e) => set("quickRequests", config.quickRequests.map((x, j) => (j === i ? e.target.value : x)))} className={input} />
              <button type="button" onClick={() => set("quickRequests", config.quickRequests.filter((_, j) => j !== i))} className="shrink-0 text-xs font-semibold text-red-600">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => set("quickRequests", [...config.quickRequests, ""])} className="self-start text-xs font-semibold" style={{ color: ACCENT }}>+ Add chip</button>
        </div>
        {saveButton("quickRequests")}
      </section>

      {/* cars */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Cars</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Added cars appear in the form&apos;s all-cars list and in Quick Booking. Photos come from the existing
          library only, new photos still need a code update.
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CARS.map((c) => {
            const hidden = config.hiddenCars.includes(c.name);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => set("hiddenCars", hidden ? config.hiddenCars.filter((n) => n !== c.name) : [...config.hiddenCars, c.name])}
                title={hidden ? "Hidden, click to show" : "Shown, click to hide"}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${hidden ? "border-red-200 bg-red-50 text-red-600 line-through" : "border-neutral-200 bg-white text-neutral-700"}`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {config.extraCars.map((c, i) => (
            <div key={c.id} className="grid gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 sm:grid-cols-[1fr_5rem_10rem]">
              <input value={c.name} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Car name" />
              <input value={c.year} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} className={input} placeholder="Year" />
              <input value={c.type} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className={input} placeholder="Class e.g. Luxury SUV" />
              <input value={c.specs.join(", ")} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, specs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))} className={`${input} sm:col-span-2`} placeholder="Specs, comma separated" />
              <div className="flex items-center gap-2">
                <select value={c.image ?? ""} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, image: e.target.value || null } : x)))} className={input}>
                  <option value="">No photo</option>
                  {IMAGE_CHOICES.map((img) => <option key={img} value={img}>{img.split("/")[3]}</option>)}
                </select>
                <button type="button" onClick={() => removeCar(i)} className="shrink-0 text-xs font-semibold text-red-600">Remove</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quick Booking ₦</span>
                <span className="text-[11px] text-neutral-500">Airport</span>
                <input
                  type="number" min={0} step={1000} value={config.qbRates[c.id]?.airport || ""} placeholder="0"
                  onChange={(e) => setQb(c.id, "airport", e.target.value)}
                  className={`${input} !w-28 text-right tabular-nums`}
                />
                <span className="text-[11px] text-neutral-500">12 hours / full day</span>
                <input
                  type="number" min={0} step={1000} value={config.qbRates[c.id]?.hours12 || ""} placeholder="0"
                  onChange={(e) => setQb(c.id, "hours12", e.target.value)}
                  className={`${input} !w-28 text-right tabular-nums`}
                />
                <span className="text-[11px] text-neutral-500">24 hours</span>
                <input
                  type="number" min={0} step={1000} value={config.qbRates[c.id]?.hours24 || ""} placeholder="0"
                  onChange={(e) => setQb(c.id, "hours24", e.target.value)}
                  className={`${input} !w-28 text-right tabular-nums`}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set("extraCars", [...config.extraCars, { id: `car-${Date.now().toString(36)}`, name: "", year: "", type: "", specs: [], image: null }])}
            className="self-start text-xs font-semibold"
            style={{ color: ACCENT }}
          >
            + Add car
          </button>
        </div>
        {saveButton("cars")}
      </section>

      {/* quick booking cars */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Quick Booking cars</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Pick which cars appear in the Quick Booking pop-up. {config.quickCars.length === 0 ? "None selected, all cars show." : `${config.quickCars.length} selected.`}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...CARS, ...config.extraCars].map((c) => {
            const on = config.quickCars.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => set("quickCars", on ? config.quickCars.filter((id) => id !== c.id) : [...config.quickCars, c.id])}
                className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors"
                style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { borderColor: "rgba(0,0,0,0.12)", color: "#525252" }}
              >
                {c.name} · {c.year}{!c.image ? " (no photo)" : ""}
              </button>
            );
          })}
        </div>
        {config.quickCars.length > 0 && (
          <button type="button" onClick={() => set("quickCars", [])} className="mt-3 text-xs font-semibold text-neutral-400 hover:text-neutral-700">
            Clear (show all)
          </button>
        )}
        {saveButton("quickCars")}
      </section>

      {/* Quick Booking prices — Airport, 12 hours / full day and 24 hours per car */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Quick Booking prices (₦)</h2>
        <p className="mb-3 text-xs text-neutral-500">
          The Airport Pickup, 12-hour and 24-hour fares shown for each car in Quick Booking. Leave Airport or
          24 hours at 0 to not offer it for that car.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 pl-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            <span className="min-w-0 flex-1">Car</span>
            <span className="w-28 text-right">Airport</span>
            <span className="w-28 text-right">12 hours / full day</span>
            <span className="w-28 text-right">24 hours</span>
          </div>
          {((config.quickCars.length
            ? config.quickCars.map((id) => [...CARS, ...config.extraCars].find((c) => c.id === id)).filter(Boolean)
            : [...CARS.filter((c) => c.image), ...config.extraCars]
          ) as { id: string; name: string; year: number | string }[]).map((c) => {
            return (
              <div key={c.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{c.name} · {c.year}</span>
<input
                  type="number" min={0} step={1000} value={config.qbRates[c.id]?.airport || ""} placeholder="0"
                  onChange={(e) => setQb(c.id, "airport", e.target.value)}
                  className={`${input} !w-28 text-right tabular-nums`}
                />
                <input
                  type="number" min={0} step={1000} value={config.qbRates[c.id]?.hours12 || ""} placeholder="0"
                  onChange={(e) => setQb(c.id, "hours12", e.target.value)}
                  className={`${input} !w-28 text-right tabular-nums`}
                />
                <input
                  type="number" min={0} step={1000} value={config.qbRates[c.id]?.hours24 || ""} placeholder="0"
                  onChange={(e) => setQb(c.id, "hours24", e.target.value)}
                  className={`${input} !w-28 text-right tabular-nums`}
                />
              </div>
            );
          })}
        </div>
        {saveButton("qbRates")}
      </section>

      {/* payment channel, Paystack */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Payment channel</h2>
        <p className="text-xs leading-relaxed text-neutral-500">
          Customers pay online through <span className="font-semibold text-neutral-700">Paystack</span> on the last
          step of Quick Booking, card, bank transfer, or USSD, using the Quick Booking prices above. Full-form
          bookings show no price; the team confirms the fare with the guest.
        </p>
        <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
          Set your keys as environment variables (Vercel → Settings → Environment Variables):
          <br />• <span className="font-mono font-semibold text-neutral-700">NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</span>, your Paystack public key
          <br />• <span className="font-mono font-semibold text-neutral-700">PAYSTACK_SECRET_KEY</span>, your Paystack secret key
          <br />Until both are set, the pay button will say payments aren&apos;t configured yet.
        </p>
      </section>

      {/* bank account, sent to guests from the Telegram "Payment details" buttons */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Bank account</h2>
        <p className="mb-3 text-xs text-neutral-500">
          The account customers transfer to. It&apos;s sent when you tap <span className="font-semibold text-neutral-700">Payment details</span> under
          a Telegram booking alert, by WhatsApp or email.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["bankName", "Bank name", "e.g. GTBank"],
            ["accountNumber", "Account number", "10 digits"],
            ["accountName", "Account name", "Name on the account"],
          ] as const).map(([key, label, placeholder]) => (
            <label key={key} className="block text-xs font-semibold text-neutral-600">
              {label}
              <input
                value={config.payment[key]}
                placeholder={placeholder}
                inputMode={key === "accountNumber" ? "numeric" : undefined}
                onChange={(e) => set("payment", { ...config.payment, [key]: e.target.value })}
                className={`${input} mt-1`}
              />
            </label>
          ))}
        </div>
        {saveButton("payment")}
      </section>
    </div>
  );
}
