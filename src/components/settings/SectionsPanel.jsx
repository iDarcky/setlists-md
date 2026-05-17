import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import UpgradeGate from '../ui/UpgradeGate';
import { SECTION_TYPE_KEYS, sectionStyle } from '../../music';

// Settings → Sections. Gated to paid plans. Lets the user rename any
// built-in section type (Verse → Strofa, Chorus → Refren), override its
// accent colour, and create their own brand-new types that appear in the
// editor section picker. The .md format is unchanged — files still use
// the canonical English names internally, only the display label and
// colour are user-customisable.

function SectionRow({ baseKey, label, color, presetColor, onLabelChange, onColorChange, onResetLabel, onResetColor, openColor, onToggleColor }) {
  const showLabelReset = !!label && label !== baseKey;
  const showColorReset = !!color && color !== presetColor;
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--modes-border)] last:border-b-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleColor}
          className="h-8 w-8 rounded-md border shrink-0 transition-all"
          style={{ background: color || presetColor, borderColor: openColor ? 'var(--color-brand)' : 'var(--modes-border)' }}
          aria-label={`Pick ${baseKey} colour`}
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-label-11 text-[var(--modes-text-dim)] uppercase tracking-wider">{baseKey}</span>
          <Input
            value={label ?? ''}
            placeholder={baseKey}
            onChange={(e) => onLabelChange(e.target.value || null)}
            className="h-8 px-2 text-copy-13"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showLabelReset && (
            <Button size="sm" variant="ghost" onClick={onResetLabel} title="Reset label">Aa</Button>
          )}
          {showColorReset && (
            <Button size="sm" variant="ghost" onClick={onResetColor} title="Reset colour">●</Button>
          )}
        </div>
      </div>
      {openColor && (
        <div className="flex flex-col gap-2 items-end">
          <HexColorPicker
            color={color || presetColor}
            onChange={onColorChange}
            style={{ width: '100%', height: 160 }}
          />
          <Button size="sm" variant="ghost" onClick={onToggleColor}>Done</Button>
        </div>
      )}
    </div>
  );
}

function CustomTypeRow({ type, onChange, onRemove, openColor, onToggleColor }) {
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--modes-border)] last:border-b-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleColor}
          className="h-8 w-8 rounded-md border shrink-0 transition-all"
          style={{ background: type.color, borderColor: openColor ? 'var(--color-brand)' : 'var(--modes-border)' }}
          aria-label="Pick custom colour"
        />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex gap-2">
            <Input
              value={type.name}
              placeholder="Name (e.g. Strofa)"
              onChange={(e) => onChange({ ...type, name: e.target.value })}
              className="h-8 px-2 text-copy-13 flex-1"
            />
            <Input
              value={type.label || ''}
              placeholder="Display (optional)"
              onChange={(e) => onChange({ ...type, label: e.target.value })}
              className="h-8 px-2 text-copy-13 flex-1"
            />
          </div>
          <span className="text-label-10 text-[var(--modes-text-dim)]">
            Write <code className="bg-[var(--modes-surface-strong)] px-1 rounded">## {type.name || 'Name'} 1</code> in the editor to use it.
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onRemove} title="Remove">×</Button>
      </div>
      {openColor && (
        <div className="flex flex-col gap-2 items-end">
          <HexColorPicker
            color={type.color}
            onChange={(c) => onChange({ ...type, color: c })}
            style={{ width: '100%', height: 160 }}
          />
          <Button size="sm" variant="ghost" onClick={onToggleColor}>Done</Button>
        </div>
      )}
    </div>
  );
}

function genId() {
  return `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function SectionsPanel({ settings, update, onUpgrade }) {
  return (
    <UpgradeGate feature="chart-style" onUpgrade={onUpgrade}>
      <SectionsPanelInner settings={settings} update={update} />
    </UpgradeGate>
  );
}

function SectionsPanelInner({ settings, update }) {
  const labels = settings?.sectionLabels || {};
  const colors = settings?.sectionColors || {};
  const customTypes = settings?.customSectionTypes || [];
  const [openColor, setOpenColor] = useState(null);

  const setLabel = (key, value) => update('sectionLabels', { ...labels, [key]: value });
  const clearLabel = (key) => {
    const next = { ...labels };
    delete next[key];
    update('sectionLabels', next);
  };
  const setColor = (key, value) => update('sectionColors', { ...colors, [key]: value });
  const clearColor = (key) => {
    const next = { ...colors };
    delete next[key];
    update('sectionColors', next);
  };

  const updateCustom = (id, next) => {
    update('customSectionTypes', customTypes.map(t => t.id === id ? { ...next, id } : t));
  };
  const removeCustom = (id) => {
    update('customSectionTypes', customTypes.filter(t => t.id !== id));
    if (openColor === id) setOpenColor(null);
  };
  const addCustom = () => {
    const newType = { id: genId(), name: '', label: '', color: '#7c4dff' };
    update('customSectionTypes', [...customTypes, newType]);
    setOpenColor(newType.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2 mb-2">
          Built-in types
        </h3>
        <p className="text-copy-13 text-[var(--modes-text-muted)] px-2 mb-2">
          Rename or recolour the standard section types. The .md format keeps the
          original name internally, so songs stay portable across users.
        </p>
        <div className="modes-card p-4">
          {SECTION_TYPE_KEYS.map(key => {
            const preset = sectionStyle(key);
            return (
              <SectionRow
                key={key}
                baseKey={key}
                label={labels[key] || ''}
                color={colors[key] || ''}
                presetColor={preset.b}
                onLabelChange={(v) => v ? setLabel(key, v) : clearLabel(key)}
                onColorChange={(c) => setColor(key, c)}
                onResetLabel={() => clearLabel(key)}
                onResetColor={() => clearColor(key)}
                openColor={openColor === key}
                onToggleColor={() => setOpenColor(o => o === key ? null : key)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
            Custom types
          </h3>
          <Button size="sm" variant="secondary" onClick={addCustom}>+ Add</Button>
        </div>
        {customTypes.length === 0 ? (
          <div className="modes-card p-5 text-center">
            <p className="text-copy-13 text-[var(--modes-text-muted)] m-0">
              Create your own section types — they'll work in the editor and show up
              with your chosen colour in every chart.
            </p>
          </div>
        ) : (
          <div className="modes-card p-4">
            {customTypes.map(t => (
              <CustomTypeRow
                key={t.id}
                type={t}
                onChange={(next) => updateCustom(t.id, next)}
                onRemove={() => removeCustom(t.id)}
                openColor={openColor === t.id}
                onToggleColor={() => setOpenColor(o => o === t.id ? null : t.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
