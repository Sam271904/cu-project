import React from 'react';

type PersonalizeText = {
  persTitle: string;
  persReload: string;
  persHint: string;
  persAllowLabel: string;
  persDenyLabel: string;
  persPersonasLabel: string;
  persSaving: string;
  persSave: string;
};

type Props = {
  t: PersonalizeText;
  persLoading: boolean;
  persError: string | null;
  persOk: string | null;
  persAllowText: string;
  persDenyText: string;
  persPersonasJson: string;
  onReload: () => void;
  onSetPersAllowText: (v: string) => void;
  onSetPersDenyText: (v: string) => void;
  onSetPersPersonasJson: (v: string) => void;
  onSave: () => void;
};

export function PersonalizePage(props: Props) {
  const {
    t,
    persLoading,
    persError,
    persOk,
    persAllowText,
    persDenyText,
    persPersonasJson,
    onReload,
    onSetPersAllowText,
    onSetPersDenyText,
    onSetPersPersonasJson,
    onSave,
  } = props;

  return (
    <div style={{ border: '1px solid #fce7f3', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fffafb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>{t.persTitle}</h3>
        <button
          type="button"
          data-testid="btn-pers-reload"
          disabled={persLoading}
          onClick={() => void onReload()}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', cursor: persLoading ? 'not-allowed' : 'pointer' }}
        >
          {t.persReload}
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{t.persHint}</div>
      {persError ? <div style={{ color: '#b00020', marginTop: 8 }}>{persError}</div> : null}
      {persOk ? <div style={{ color: '#166534', marginTop: 8 }}>{persOk}</div> : null}

      <label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.persAllowLabel}</label>
      <textarea
        data-testid="textarea-pers-allow"
        value={persAllowText}
        onChange={(e) => onSetPersAllowText(e.target.value)}
        rows={5}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 6,
          padding: 10,
          border: '1px solid #ddd',
          borderRadius: 6,
          fontFamily: 'inherit',
          fontSize: 13,
        }}
      />

      <label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.persDenyLabel}</label>
      <textarea
        data-testid="textarea-pers-deny"
        value={persDenyText}
        onChange={(e) => onSetPersDenyText(e.target.value)}
        rows={4}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 6,
          padding: 10,
          border: '1px solid #ddd',
          borderRadius: 6,
          fontFamily: 'inherit',
          fontSize: 13,
        }}
      />

      <label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.persPersonasLabel}</label>
      <textarea
        data-testid="textarea-pers-personas"
        value={persPersonasJson}
        onChange={(e) => onSetPersPersonasJson(e.target.value)}
        rows={10}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 6,
          padding: 10,
          border: '1px solid #ddd',
          borderRadius: 6,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
        }}
      />

      <button
        type="button"
        data-testid="btn-pers-save"
        disabled={persLoading}
        onClick={() => void onSave()}
        style={{
          marginTop: 12,
          padding: '10px 16px',
          borderRadius: 6,
          border: '1px solid #db2777',
          background: '#fce7f3',
          cursor: persLoading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {persLoading ? t.persSaving : t.persSave}
      </button>
    </div>
  );
}
