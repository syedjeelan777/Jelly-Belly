/**
 * STICKYVERSE — screen router.
 */
import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { MainMenu } from './screens/MainMenu';
import { WorldSelect } from './screens/WorldSelect';
import { LevelSelect } from './screens/LevelSelect';
import { GameScreen } from './screens/GameScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HowToPlay } from './screens/HowToPlay';
import { Credits } from './screens/Credits';
import { Stats } from './screens/Stats';
import { MyLevels } from './screens/MyLevels';
import { EditorScreen } from './screens/EditorScreen';
import { audio } from './game/audio/audio';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  // Unlock audio on first interaction and keep volumes in sync.
  useEffect(() => {
    const unlock = () => {
      audio.ensure();
      const s = useGameStore.getState().settings;
      audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume });
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    audio.setVolumes({ master: useGameStore.getState().settings.masterVolume, music: useGameStore.getState().settings.musicVolume, sfx: useGameStore.getState().settings.sfxVolume });
  });

  return (
    <div className="app">
      {screen === 'menu' && <MainMenu />}
      {screen === 'worlds' && <WorldSelect />}
      {screen === 'levels' && <LevelSelect />}
      {screen === 'game' && <GameScreen key={useGameStore.getState().activeLevelId} />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'howto' && <HowToPlay />}
      {screen === 'credits' && <Credits />}
      {screen === 'stats' && <Stats />}
      {screen === 'mylevels' && <MyLevels />}
      {screen === 'editor' && <EditorScreen />}
    </div>
  );
}
