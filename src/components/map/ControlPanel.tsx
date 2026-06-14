"use client";

import { useState } from "react";
import {
  DEFAULT_SETTINGS,
  type BlendMode,
  type MapSettings,
} from "./map-settings";

const BLEND_MODES: BlendMode[] = [
  "soft-light",
  "overlay",
  "multiply",
  "screen",
  "color",
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v: number) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-[11px] uppercase tracking-wider">
        <span className="text-white/50">{label}</span>
        <span className="font-mono normal-case text-cyan-300/90">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ControlPanel({
  settings,
  onChange,
}: {
  settings: MapSettings;
  onChange: (settings: MapSettings) => void;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof MapSettings>(key: K, value: MapSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const copySettings = async () => {
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="absolute right-4 top-4 z-10 w-72 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 text-white shadow-2xl backdrop-blur-xl">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium tracking-wide">Map editor</span>
        <span className="text-white/40">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-6 px-5 pb-5">
          <Section title="Camera">
            <Slider
              label="Pitch"
              value={settings.pitch}
              min={0}
              max={85}
              step={0.5}
              onChange={(v) => set("pitch", v)}
              format={(v) => `${v.toFixed(1)}°`}
            />
            <Slider
              label="Bearing"
              value={settings.bearing}
              min={-180}
              max={180}
              step={0.5}
              onChange={(v) => set("bearing", v)}
              format={(v) => `${v.toFixed(1)}°`}
            />
            <Slider
              label="Zoom"
              value={settings.zoom}
              min={2}
              max={18}
              step={0.05}
              onChange={(v) => set("zoom", v)}
              format={(v) => v.toFixed(2)}
            />
          </Section>

          <Section title="Imagery">
            <Slider
              label="Hue shift"
              value={settings.hue}
              min={0}
              max={360}
              step={1}
              onChange={(v) => set("hue", v)}
              format={(v) => `${v}°`}
            />
            <Slider
              label="Saturation"
              value={settings.saturation}
              min={-1}
              max={1}
              step={0.05}
              onChange={(v) => set("saturation", v)}
              format={(v) => v.toFixed(2)}
            />
            <Slider
              label="Brightness"
              value={settings.brightness}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => set("brightness", v)}
              format={(v) => v.toFixed(2)}
            />
            <Slider
              label="Contrast"
              value={settings.contrast}
              min={-1}
              max={1}
              step={0.05}
              onChange={(v) => set("contrast", v)}
              format={(v) => v.toFixed(2)}
            />
          </Section>

          <Section title="Mood">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-white/50">
                Tint color
              </span>
              <input
                type="color"
                value={settings.tintColor}
                onChange={(e) => set("tintColor", e.currentTarget.value)}
                className="h-7 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
              />
            </div>
            <Slider
              label="Tint strength"
              value={settings.tintStrength}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => set("tintStrength", v)}
              format={(v) => v.toFixed(2)}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-wider text-white/50">
                Blend
              </span>
              <select
                value={settings.blendMode}
                onChange={(e) => set("blendMode", e.currentTarget.value as BlendMode)}
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/80 outline-none"
              >
                {BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <Slider
              label="Vignette"
              value={settings.vignette}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => set("vignette", v)}
              format={(v) => v.toFixed(2)}
            />
          </Section>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onChange(DEFAULT_SETTINGS)}
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10"
            >
              Reset
            </button>
            <button
              onClick={copySettings}
              className="flex-1 rounded-lg bg-cyan-400/20 px-3 py-2 text-xs text-cyan-200 transition-colors hover:bg-cyan-400/30"
            >
              {copied ? "Copied!" : "Copy settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
