import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings, saveSettings } from '../db/repo'
import { downloadBackup, importBackup } from '../lib/exportImport'
import { pingBackend } from '../lib/coachApi'

export function Settings() {
  const settings = useLiveQuery(getSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string>()
  const [testResult, setTestResult] = useState<string>()

  if (!settings) return <div className="screen" />

  const test = async () => {
    setTestResult('Testing…')
    try {
      await pingBackend(settings.backendUrl, settings.backendSecret)
      setTestResult('✓ Connected')
    } catch (err) {
      setTestResult(`✗ ${err instanceof Error ? err.message : 'Failed'}`)
    }
  }

  const onImport = async (file: File) => {
    if (!window.confirm('Importing replaces ALL current data with the backup. Continue?')) return
    try {
      const { sessions, revisions } = await importBackup(file)
      setStatus(`Imported ${sessions} sessions and ${revisions} program revisions.`)
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  const requestPersist = async () => {
    if (!navigator.storage?.persist) {
      setStatus('Persistent storage not supported on this browser.')
      return
    }
    const granted = await navigator.storage.persist()
    setStatus(granted ? 'Persistent storage granted.' : 'Persistent storage was not granted (yet).')
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Settings</h1>
      </header>

      <h2 className="section-title">Coach backend</h2>
      <label className="field-label">Lambda Function URL</label>
      <input
        type="url"
        value={settings.backendUrl}
        placeholder="https://xxxx.lambda-url.eu-west-1.on.aws/"
        onChange={(e) => void saveSettings({ backendUrl: e.target.value.trim() })}
      />
      <label className="field-label">Shared secret</label>
      <input
        type="password"
        value={settings.backendSecret}
        onChange={(e) => void saveSettings({ backendSecret: e.target.value.trim() })}
      />
      <button className="btn-ghost" onClick={test} disabled={!settings.backendUrl}>
        Test connection
      </button>
      {testResult && <span className="muted small"> {testResult}</span>}

      <h2 className="section-title">Training</h2>
      <label className="toggle-row">
        <span>Auto-progression suggestions</span>
        <input
          type="checkbox"
          checked={settings.autoProgressionOn}
          onChange={(e) => void saveSettings({ autoProgressionOn: e.target.checked })}
        />
      </label>
      <label className="toggle-row">
        <span>Rest timer sound</span>
        <input
          type="checkbox"
          checked={settings.restTimerSoundOn}
          onChange={(e) => void saveSettings({ restTimerSoundOn: e.target.checked })}
        />
      </label>

      <h2 className="section-title">Data</h2>
      <button className="btn-primary" onClick={() => void downloadBackup()}>
        Export backup
      </button>
      <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
        Import backup
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onImport(file)
          e.target.value = ''
        }}
      />
      <button className="btn-ghost" onClick={requestPersist}>
        Request persistent storage
      </button>
      {status && <p className="muted small">{status}</p>}

      <p className="muted small version-line">GripTrack · local-first · your data never leaves this device except for coach reviews.</p>
    </div>
  )
}
