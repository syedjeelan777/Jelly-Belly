/**
 * Settings — audio, gameplay, display, controls reference.
 */
import { useGameStore } from '../store/gameStore';
import { BackHeader, FullscreenButton, GameButton, Slider, ToggleRow } from '../components/ui';
import { audio } from '../game/audio/audio';
import { useState } from 'react';
import { saveAvailable } from '../data/save';

export function SettingsScreen() {
  const navigate = useGameStore((s) => s.navigate);
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const resetProgress = useGameStore((s) => s.resetProgress);
  const [confirmReset, setConfirmReset] = useState(false);

  const applyVol = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    updateSettings(next);
    audio.ensure();
    audio.setVolumes({ master: next.masterVolume, music: next.musicVolume, sfx: next.sfxVolume });
  };

  return (
    <div className="screen">
      <BackHeader title="Settings" onBack={() => navigate('menu')} right={<FullscreenButton />} />
      <div className="settings-wrap">
        <section className="settings-section">
          <h2>🔊 Audio</h2>
          <Slider label="Master volume" value={settings.masterVolume} onChange={(v) => applyVol({ masterVolume: v })} />
          <Slider label="Music volume" value={settings.musicVolume} onChange={(v) => applyVol({ musicVolume: v })} />
          <Slider label="Effects volume" value={settings.sfxVolume} onChange={(v) => applyVol({ sfxVolume: v })} />
          <p className="settings-note">
            {saveAvailable() ? 'Audio saves automatically.' : 'Storage unavailable — settings persist for this session only.'}
          </p>
        </section>

        <section className="settings-section">
          <h2>🎮 Gameplay</h2>
          <ToggleRow label="Show move counter" checked={settings.showMoveCounter} onChange={(v) => updateSettings({ showMoveCounter: v })} />
          <ToggleRow label="Confirm restart" checked={settings.confirmRestart} onChange={(v) => updateSettings({ confirmRestart: v })} description="Ask before resetting a level" />
          <ToggleRow label="Tutorial tips" checked={settings.showTutorials} onChange={(v) => updateSettings({ showTutorials: v })} description="Show short level tips" />
        </section>

        <section className="settings-section">
          <h2>🖥 Display</h2>
          <ToggleRow label="Screen shake" checked={settings.screenShake} onChange={(v) => updateSettings({ screenShake: v })} />
          <ToggleRow label="Reduced motion" checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} description="Calm visuals, no shake or particles" />
        </section>

        <section className="settings-section">
          <h2>⌨️ Controls</h2>
          <ul className="controls-list">
            <li><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd> <span>Move</span></li>
            <li><kbd>Z</kbd> <span>Undo</span></li>
            <li><kbd>R</kbd> <span>Restart</span></li>
            <li><kbd>Esc</kbd> <span>Pause</span></li>
            <li>📱 Touch <span>On-screen D-pad (mobile)</span></li>
            <li>🎮 Gamepad <span>D-pad, A = confirm, B = restart, Z-keys = undo</span></li>
          </ul>
        </section>

        <section className="settings-section danger">
          <h2>⚠ Danger Zone</h2>
          {!confirmReset ? (
            <GameButton variant="danger" onClick={() => setConfirmReset(true)}>Reset all progress</GameButton>
          ) : (
            <div className="confirm-row">
              <span>Delete all progress?</span>
              <GameButton variant="danger" onClick={() => { resetProgress(); setConfirmReset(false); }}>Yes, reset</GameButton>
              <GameButton variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</GameButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
