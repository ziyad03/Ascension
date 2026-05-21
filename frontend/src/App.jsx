import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Moderator from './pages/Moderator';
import Team from './pages/Team';
import PublicDashboard from './pages/PublicDashboard';
import Jury from './pages/Jury';
import TournamentOverlay from './components/TournamentOverlay';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/moderator" element={<Moderator />} />
        <Route path="/team" element={<Team />} />
        <Route path="/public" element={<PublicDashboard />} />
        <Route path="/jury" element={<Jury />} />
      </Routes>
      <TournamentOverlay />
    </Router>
  );
}
