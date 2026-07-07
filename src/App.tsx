import { NavLink, Route, Routes } from 'react-router-dom'
import { Today } from './screens/Today'
import { ActiveWorkout } from './screens/ActiveWorkout'
import { History } from './screens/History'
import { SessionDetail } from './screens/SessionDetail'
import { ProgramView } from './screens/ProgramView'
import { CoachReview } from './screens/CoachReview'
import { Settings } from './screens/Settings'

const TABS = [
  { to: '/', label: 'Today', icon: '🏋️' },
  { to: '/history', label: 'History', icon: '📆' },
  { to: '/program', label: 'Program', icon: '📋' },
  { to: '/coach', label: 'Coach', icon: '🥋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<ActiveWorkout />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route path="/program" element={<ProgramView />} />
          <Route path="/coach" element={<CoachReview />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `tab ${isActive ? 'tab-active' : ''}`}
            end={tab.to === '/'}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
