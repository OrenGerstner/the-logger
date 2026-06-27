import { useNavigation } from '@/navigation/NavigationContext';
import { Home } from '@/screens/Home/Home';
import { NewSession } from '@/screens/NewSession/NewSession';
import { TableSetup } from '@/screens/TableSetup/TableSetup';
import { PlayScreen } from '@/screens/Play/PlayScreen';
import { CardPicker } from '@/screens/CardPicker/CardPicker';
import { PostflopScreen } from '@/screens/Postflop/PostflopScreen';
import { HandResult } from '@/screens/HandResult/HandResult';
import { HandHistory } from '@/screens/HandHistory/HandHistory';
import { PastSessions } from '@/screens/PastSessions/PastSessions';
import { Settings } from '@/screens/Settings/Settings';

export function App() {
  const { currentScreen } = useNavigation();
  const { name, params } = currentScreen;

  return (
    <div className="app-shell">
      {name === 'home' && <Home />}
      {name === 'newSession' && <NewSession />}
      {name === 'tableSetup' && <TableSetup />}
      {name === 'play' && <PlayScreen />}
      {name === 'cardPicker' && <CardPicker />}
      {name === 'postflop' && (
        <PostflopScreen street={(params?.street as 'flop' | 'turn' | 'river') ?? 'flop'} />
      )}
      {name === 'handResult' && <HandResult />}
      {name === 'handHistory' && <HandHistory />}
      {name === 'pastSessions' && <PastSessions />}
      {name === 'settings' && <Settings />}
    </div>
  );
}
