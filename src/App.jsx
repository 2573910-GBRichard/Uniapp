import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { sendEmployeeReport } from './lib/reports'
import { fetchSevenShiftsUsers } from './lib/sevenShifts'
import { supabase } from './lib/supabase'

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Hiring & Training', path: '/hiring-training' },
  { label: 'Employees', path: '/employees' },
  { label: 'Safe Reconciliation', path: '/safe-reconciliation' },
  { label: 'Marketing', path: '/marketing' },
  { label: 'Sports Board', path: '/sports-board' },
  { label: 'Applicants', path: '/applicants' },
  { label: 'Alerts', path: '/alerts' },
  { label: 'Talon', path: '/talon', private: true, roles: ['admin'] },
  { label: 'Rook', path: '/rook', private: true, roles: ['admin'] },
]

const metricCards = [
  { label: 'Employees in training', value: '24', note: 'Across all locations' },
  { label: 'Overdue certifications', value: '7', note: 'Needs follow-up today' },
  { label: 'Open applicants', value: '18', note: 'Breezy import later' },
  { label: 'Managers with admin access', value: '4', note: 'Rich, Eric, Sabrinah, John' },
]

const locationRows = [
  { location: "Gentle Ben's", inTraining: 11, overdue: 2, applicants: 7, status: 'Stable' },
  { location: 'Bacio Italiano', inTraining: 6, overdue: 3, applicants: 5, status: 'Needs review' },
  { location: 'Agave House', inTraining: 7, overdue: 2, applicants: 6, status: 'Stable' },
]

const fallbackProfiles = {
  'sabrinah@uniconcepts.local': {
    full_name: 'Sabrinah Herrera',
    role: 'training_manager',
    location_scope: 'all',
    safe_access_scope: 'assigned',
    allowed_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
    safe_locations: ["Gentle Ben's"],
  },
  'eric@uniconcepts.local': {
    full_name: 'Eric Smith',
    role: 'gm',
    location_scope: 'assigned',
    safe_access_scope: 'assigned',
    allowed_locations: ["Gentle Ben's"],
    safe_locations: ["Gentle Ben's"],
  },
  'jordan@uniconcepts.local': {
    full_name: 'Jordan Nasy',
    role: 'gm',
    location_scope: 'assigned',
    safe_access_scope: 'assigned',
    allowed_locations: ['Bacio Italiano'],
    safe_locations: ['Bacio Italiano'],
  },
  'alexa@uniconcepts.local': {
    full_name: 'Alexa Curell',
    role: 'gm',
    location_scope: 'assigned',
    safe_access_scope: 'assigned',
    allowed_locations: ['Agave House'],
    safe_locations: ['Agave House'],
  },
  'rich@uniconcepts.local': {
    full_name: 'Richard Fifer',
    role: 'admin',
    location_scope: 'all',
    safe_access_scope: 'all',
    allowed_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
    safe_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
  },
  'john@uniconcepts.local': {
    full_name: 'John Bujarski',
    role: 'admin',
    location_scope: 'all',
    safe_access_scope: 'all',
    allowed_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
    safe_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
  },
}

const fallbackEmployeeRows = [
  {
    id: 'fallback-1',
    name: 'Marissa Cole',
    location: "Gentle Ben's",
    allLocations: [{ id: '139087', name: "Gentle Ben's" }],
    role: 'Server',
    allRoles: [{ id: 'server', name: 'Server', isPrimary: true }],
    startDate: '2026-04-10',
    assignedTrainer: 'Sabrinah',
    assignedManager: 'Rich',
    phone: '',
    workingToday: false,
    trainingSteps: [
      { id: 'server-day-1', name: 'Day 1 training', scheduledDate: '2026-04-11', completedDate: '2026-04-11', score: 91, status: 'Complete' },
    ],
  },
  {
    id: 'fallback-2',
    name: 'Diego Alvarez',
    location: 'Agave House',
    allLocations: [{ id: '339280', name: 'Agave House' }],
    role: 'Cook',
    allRoles: [{ id: 'cook', name: 'Cook', isPrimary: true }],
    startDate: '2026-04-08',
    assignedTrainer: 'Eric',
    assignedManager: 'John',
    phone: '',
    workingToday: false,
    trainingSteps: [
      { id: 'cook-day-1', name: 'Day 1 training', scheduledDate: '2026-04-09', completedDate: '2026-04-09', score: 84, status: 'Complete' },
    ],
  },
  {
    id: 'fallback-3',
    name: 'Sienna Price',
    location: 'Bacio Italiano',
    allLocations: [{ id: '239069', name: 'Bacio Italiano' }],
    role: 'Expo',
    allRoles: [{ id: 'expo', name: 'Expo', isPrimary: true }],
    startDate: '2026-04-12',
    assignedTrainer: 'John',
    assignedManager: 'Rich',
    phone: '',
    workingToday: false,
    trainingSteps: [
      { id: 'expo-day-1', name: 'Day 1 training', scheduledDate: '2026-04-12', completedDate: '2026-04-12', score: 93, status: 'Complete' },
    ],
  },
  {
    id: 'fallback-4',
    name: 'Jamal Turner',
    location: "Gentle Ben's",
    allLocations: [{ id: '139087', name: "Gentle Ben's" }],
    role: 'Security',
    allRoles: [{ id: 'security', name: 'Security', isPrimary: true }],
    startDate: '2026-04-09',
    assignedTrainer: 'Eric',
    assignedManager: 'Sabrinah',
    phone: '',
    workingToday: false,
    trainingSteps: [
      { id: 'security-day-1', name: 'Day 1 training', scheduledDate: '2026-04-10', completedDate: '2026-04-10', score: 86, status: 'Complete' },
    ],
  },
]

const trainingStatusChoices = ['Pending', 'Scheduled', 'Complete', 'Needs Review']
const marketingRestaurants = ["Gentle Ben's", 'Bacio Italiano', 'Agave House']
const marketingStatusChoices = ['Draft', 'Ready for design', 'Awaiting approval', 'Approved', 'Scheduled', 'Posted']
const marketingTypeChoices = ['Live music', 'Holiday', 'Brunch', 'Drink special', 'Happy hour', 'Sports watch', 'Theme night', 'Other']
const marketingLibraryCategories = ['Food / Drinks', 'Atmosphere', 'Late Nights']
const sportsRestaurants = ["Gentle Ben's", 'Bacio Italiano', 'Agave House']

function parseEmployeeStartDate(value) {
  if (!value || value === 'Unknown') return null
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  const normalized = `${value}`.trim().replace(/\//g, '-')
  const parts = normalized.split('-')
  if (parts.length === 3) {
    const [first, second, third] = parts
    if (first.length === 4) {
      const isoLike = new Date(`${first}-${second.padStart(2, '0')}-${third.padStart(2, '0')}T00:00:00`)
      if (!Number.isNaN(isoLike.getTime())) return isoLike
    }
    if (third.length === 4) {
      const monthFirst = new Date(`${third}-${first.padStart(2, '0')}-${second.padStart(2, '0')}T00:00:00`)
      if (!Number.isNaN(monthFirst.getTime())) return monthFirst
    }
  }

  return null
}

const sampleSportsGames = [
  {
    id: 'sports-1',
    title: 'Diamondbacks vs Padres',
    league: 'MLB',
    restaurant: "Gentle Ben's",
    startTime: '1:10 PM',
    window: 'Morning / Afternoon',
    channel: 'Bally Sports Arizona / local feed',
    channelNumber: 'local',
    mustWatch: true,
    arizonaFocus: true,
    alertLeadMinutes: 10,
    status: 'Alert scheduled',
    notes: 'Arizona team priority. Patio and bar TVs should carry this feed before first pitch.',
  },
  {
    id: 'sports-2',
    title: 'Lakers vs Warriors',
    league: 'NBA Playoffs',
    restaurant: 'Agave House',
    startTime: '5:30 PM',
    window: 'Evening',
    channel: 'ESPN',
    channelNumber: '206',
    mustWatch: true,
    arizonaFocus: false,
    alertLeadMinutes: 10,
    status: 'Need manager text',
    notes: 'Prime-time playoff anchor. Asterisk means this should be on TVs.',
  },
  {
    id: 'sports-3',
    title: 'Arizona Softball vs UCLA',
    league: 'Arizona Wildcats',
    restaurant: 'Bacio Italiano',
    startTime: '6:00 PM',
    window: 'Evening',
    channel: 'ESPN+',
    channelNumber: 'streaming',
    mustWatch: false,
    arizonaFocus: true,
    alertLeadMinutes: 10,
    status: 'Listed only',
    notes: 'Lower priority unless tournament implications increase.',
  },
]

const sampleManagerAlerts = [
  {
    id: 'alert-1',
    manager: 'Eric Smith',
    restaurant: "Gentle Ben's",
    phone: '951-365-1762',
    workingNow: true,
    alertWindow: '10:00 AM all-games send',
    status: 'Twilio pending registration',
  },
  {
    id: 'alert-2',
    manager: 'Sabrinah Herrera',
    restaurant: 'Agave House',
    phone: 'Manager phone from app feed',
    workingNow: false,
    alertWindow: '15 minutes before must-watch',
    status: 'Needs app feed sync',
  },
]

const sampleMarketingEvents = [
  {
    id: 'mkt-1',
    restaurant: "Gentle Ben's",
    title: 'NBA Finals Watch Party Push',
    type: 'Sports watch',
    date: '2026-04-30',
    time: '5:30 PM',
    status: 'Awaiting approval',
    owner: 'Talon',
    channel: 'Instagram + in-store screens',
    notes: 'Needs final GM approval before auto-post sequence.',
  },
  {
    id: 'mkt-2',
    restaurant: 'Bacio Italiano',
    title: 'Mother\'s Day Brunch Feature',
    type: 'Brunch',
    date: '2026-05-05',
    time: '9:00 AM',
    status: 'Ready for design',
    owner: 'Marketing queue',
    channel: 'Instagram + flyers',
    notes: 'Use Bacio spring brand kit and brunch food gallery.',
  },
  {
    id: 'mkt-3',
    restaurant: 'Agave House',
    title: 'Late Night DJ Fridays',
    type: 'Live music',
    date: '2026-05-02',
    time: '10:00 PM',
    status: 'Draft',
    owner: 'Alexa',
    channel: 'Instagram story + text reminder',
    notes: 'Need final DJ asset upload and cover photo approval.',
  },
]

const sampleMarketingAssets = [
  {
    id: 'asset-1',
    restaurant: "Gentle Ben's",
    category: 'Food / Drinks',
    label: 'Burger hero shot',
    status: 'Ready',
    usage: 'Watch party promo',
  },
  {
    id: 'asset-2',
    restaurant: "Gentle Ben's",
    category: 'Atmosphere',
    label: 'Patio crowd sunset',
    status: 'Ready',
    usage: 'Brand library',
  },
  {
    id: 'asset-3',
    restaurant: 'Bacio Italiano',
    category: 'Food / Drinks',
    label: 'Brunch spritz flat lay',
    status: 'Awaiting edit',
    usage: 'Mother\'s Day brunch',
  },
  {
    id: 'asset-4',
    restaurant: 'Agave House',
    category: 'Late Nights',
    label: 'DJ booth crowd',
    status: 'Ready',
    usage: 'Friday late night push',
  },
]

const brandKitDefaults = {
  "Gentle Ben's": {
    primaryColor: '#9B1C20',
    accentColor: '#F4B400',
    logo: 'gentle-bens-primary-logo.svg',
    font: 'League Spartan',
    locked: true,
  },
  'Bacio Italiano': {
    primaryColor: '#1F5C49',
    accentColor: '#E5C07B',
    logo: 'bacio-script-logo.svg',
    font: 'Cormorant Garamond',
    locked: true,
  },
  'Agave House': {
    primaryColor: '#0F766E',
    accentColor: '#F97316',
    logo: 'agave-house-badge.svg',
    font: 'Montserrat',
    locked: true,
  },
}

const sampleSafeEntries = [
  { restaurant: "Gentle Ben's", date: '2026-04-14', manager: 'John', startingSafe: 2200, deposit: 1450, expectedSafe: 750, actualSafe: 760, variance: 10, notes: 'Counted after patio close.' },
  { restaurant: 'Bacio Italiano', date: '2026-04-13', manager: 'Rich', startingSafe: 1800, deposit: 900, expectedSafe: 900, actualSafe: 900, variance: 0, notes: 'Matched exactly.' },
  { restaurant: 'Agave House', date: '2026-04-12', manager: 'Eric', startingSafe: 1600, deposit: 700, expectedSafe: 900, actualSafe: 885, variance: -15, notes: 'Variance needs signoff.' },
]

function getTrainingTemplateForRole(role) {
  const lowered = `${role || ''}`.toLowerCase()

  if (lowered.includes('dish')) {
    return [
      { id: 'dish-day-1', name: 'Dish Day 1', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
      { id: 'dish-day-2', name: 'Dish Day 2', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
      { id: 'dish-day-3', name: 'Dish Day 3', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
    ]
  }

  if (lowered.includes('door') || lowered.includes('security')) {
    return [
      { id: 'security-orientation-signoff', name: 'Security Orientation Sign Off', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
      { id: 'security-day-1', name: 'Security Day 1', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
    ]
  }

  if (lowered.includes('cook') || lowered.includes('prep') || lowered.includes('boh manager')) {
    return [
      { id: 'salad-day-1', name: 'Salad Day 1', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
      { id: 'salad-day-2', name: 'Salad Day 2', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
      { id: 'salad-day-3', name: 'Salad Day 3', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
    ]
  }

  return [
    { id: 'expo-day-1', name: 'Expo Day 1', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
    { id: 'expo-day-2', name: 'Expo Day 2', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
    { id: 'expo-day-3', name: 'Expo Day 3', scheduledDate: '', completedDate: '', score: '', status: 'Pending' },
  ]
}

function createDefaultTrainingSteps(role) {
  return getTrainingTemplateForRole(role)
}

function formatRestaurantName(locationId, fallbackName) {
  if (fallbackName) return fallbackName
  if (String(locationId) === '139087') return "Gentle Ben's"
  if (String(locationId) === '239069') return 'Bacio Italiano'
  if (String(locationId) === '339280') return 'Agave House'
  return fallbackName || 'Unknown location'
}

function formatShortLocationName(value) {
  if (!value) return 'Unknown'
  const lowered = `${value}`.toLowerCase()
  if (lowered.includes('gentle')) return 'Bens'
  if (lowered.includes('bacio')) return 'Bacio'
  if (lowered.includes('agave')) return 'Agave'
  return value
}

function formatMonthDay(value) {
  const parsed = parseEmployeeStartDate(value)
  if (!parsed) return value || 'Unknown'
  return parsed.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
  })
}

function formatMonthDayYear(value) {
  const parsed = parseEmployeeStartDate(value)
  if (!parsed) return value || 'Unknown'
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accessProfile, setAccessProfile] = useState(null)
  const [employeeRows, setEmployeeRows] = useState(fallbackEmployeeRows)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [employeesError, setEmployeesError] = useState('')
  const [safeEntries, setSafeEntries] = useState(sampleSafeEntries)
  const [savedSafeEntries, setSavedSafeEntries] = useState([])
  const [safeLoading, setSafeLoading] = useState(false)
  const [safeError, setSafeError] = useState('')
  const [safeSaveStatus, setSafeSaveStatus] = useState('')
  const [marketingEvents, setMarketingEvents] = useState(sampleMarketingEvents)
  const [marketingAssets, setMarketingAssets] = useState(sampleMarketingAssets)
  const [marketingEventsError, setMarketingEventsError] = useState('')
  const [marketingAssetsError, setMarketingAssetsError] = useState('')
  const [brandKits, setBrandKits] = useState(brandKitDefaults)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const supabaseConnected = Boolean(supabase)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let active = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session ?? null)
      setAuthLoading(false)
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setAuthLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadAccessProfile() {
      if (!session?.user?.id || !supabase) {
        setAccessProfile(null)
        return
      }

      const { data: appUser } = await supabase
        .from('app_users')
        .select('id, full_name, email, role, location_scope, safe_access_scope')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!active) return

      if (!appUser) {
        const email = session.user.email?.toLowerCase() || ''
        const fallback = fallbackProfiles[email]
        setAccessProfile(
          fallback
            ? { ...fallback, email, source: 'fallback' }
            : {
                full_name: session.user.email || 'Signed-in user',
                email,
                role: 'admin',
                location_scope: 'all',
                safe_access_scope: 'all',
                allowed_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
                safe_locations: ["Gentle Ben's", 'Bacio Italiano', 'Agave House'],
                source: 'session-fallback',
              },
        )
        return
      }

      const { data: locations } = await supabase
        .from('user_locations')
        .select('location_name')
        .eq('user_id', appUser.id)

      if (!active) return

      const locationNames = (locations || []).map((item) => item.location_name)

      setAccessProfile({
        ...appUser,
        allowed_locations: appUser.location_scope === 'all'
          ? ["Gentle Ben's", 'Bacio Italiano', 'Agave House']
          : locationNames,
        safe_locations: appUser.safe_access_scope === 'all'
          ? ["Gentle Ben's", 'Bacio Italiano', 'Agave House']
          : locationNames,
        source: 'supabase',
      })
    }

    loadAccessProfile()
    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    let mounted = true

    async function loadUsers() {
      try {
        const users = await fetchSevenShiftsUsers()
        if (mounted && users.length) {
          setEmployeeRows(users)
          setEmployeesError('')
        }
      } catch {
        if (mounted) {
          setEmployeesError('Live 7shifts data not loaded yet, showing fallback preview data.')
        }
      } finally {
        if (mounted) {
          setEmployeesLoading(false)
        }
      }
    }

    loadUsers()

    return () => {
      mounted = false
    }
  }, [])

  const scopedLocations = accessProfile?.allowed_locations?.length
    ? accessProfile.allowed_locations
    : ["Gentle Ben's", 'Bacio Italiano', 'Agave House']

  const scopedEmployeeRows = useMemo(() => {
    if (!accessProfile || accessProfile.location_scope === 'all') return employeeRows

    return employeeRows.filter((row) => {
      const locations = (row.allLocations || []).map((location) => location.name)
      return locations.some((name) => scopedLocations.includes(name))
    })
  }, [accessProfile, employeeRows, scopedLocations])

  const scopedLocationRows = useMemo(() => {
    if (!accessProfile || accessProfile.location_scope === 'all') return locationRows
    return locationRows.filter((row) => scopedLocations.includes(row.location))
  }, [accessProfile, scopedLocations])

  const visibleNavItems = useMemo(() => {
    if (!accessProfile) return []

    return navItems.filter((item) => {
      if (!item.private) return true
      return item.roles?.includes(accessProfile.role)
    })
  }, [accessProfile])

  if (authLoading) {
    return <LoadingScreen message="Checking session..." />
  }

  if (!session) {
    return <LoginScreen supabaseConnected={supabaseConnected} />
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div>
          <div className="brand-block">
            <div className="sidebar-top-row">
              <div>
                <div className="brand-kicker">UNICONCEPTS OPS</div>
                <h1>Control Center</h1>
              </div>
              <button type="button" className="ghost-button compact-button sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)}>
                {sidebarCollapsed ? '⟩' : '⟨'}
              </button>
            </div>
            {!sidebarCollapsed ? <p>Hiring, training, and operational visibility by restaurant access level.</p> : null}
          </div>

          {!sidebarCollapsed ? (
            <>
              <div className="signed-in-card">
                <div className="eyebrow">SIGNED IN</div>
                <strong>{accessProfile?.full_name || session.user.email}</strong>
                <span>{formatRole(accessProfile?.role)} • {formatScope(accessProfile)}</span>
                <button type="button" className="ghost-button compact-button" onClick={() => supabase.auth.signOut()}>
                  Sign out
                </button>
              </div>

              <nav className="nav-list" aria-label="Primary navigation">
                {visibleNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span>{item.label}</span>
                    {item.private ? <small>Private</small> : null}
                  </NavLink>
                ))}
              </nav>
            </>
          ) : (
            <nav className="nav-list nav-list-collapsed" aria-label="Primary navigation">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={item.label}
                  className={({ isActive }) => `nav-item nav-item-collapsed${isActive ? ' active' : ''}`}
                >
                  <span>{item.label.slice(0, 1)}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        {!sidebarCollapsed ? (
          <div className="sidebar-footer">
            <div className="access-card">
              <div className="eyebrow">ACCESS</div>
              <strong>{formatScope(accessProfile)}</strong>
              <span>{scopedLocations.join(', ')}</span>
            </div>
            <div className="integration-chip">
              <span>Supabase</span>
              <strong>{supabaseConnected ? 'Connected' : 'Not connected'}</strong>
            </div>
          </div>
        ) : null}
      </aside>

      <main className="main-panel">
        <Routes>
          <Route path="/" element={<DashboardPage employeeRows={scopedEmployeeRows} locationRows={scopedLocationRows} employeesLoading={employeesLoading} employeesError={employeesError} accessProfile={accessProfile} />} />
          <Route path="/hiring-training" element={<HiringTrainingPage employeeRows={scopedEmployeeRows} employeesLoading={employeesLoading} employeesError={employeesError} recentOnly accessProfile={accessProfile} />} />
          <Route path="/employees" element={<EmployeesPage employeeRows={scopedEmployeeRows} employeesLoading={employeesLoading} employeesError={employeesError} accessProfile={accessProfile} />} />
          <Route path="/safe-reconciliation" element={<SafeReconciliationPage accessProfile={accessProfile} />} />
          <Route path="/marketing" element={<MarketingPage accessProfile={accessProfile} marketingEvents={marketingEvents} marketingAssets={marketingAssets} marketingEventsError={marketingEventsError} marketingAssetsError={marketingAssetsError} brandKits={brandKits} setBrandKits={setBrandKits} setMarketingEvents={setMarketingEvents} />} />
          <Route path="/sports-board" element={<SportsBoardPage accessProfile={accessProfile} employeeRows={scopedEmployeeRows} />} />
          <Route path="/alerts" element={<PlaceholderPage title="Alerts" text="Manager text alerts, notification routing, and escalation settings will live here." />} />
          <Route path="/applicants" element={<PlaceholderPage title="Applicants" text="Breezy import, stage tracking, and applicant routing will live here." />} />
          <Route path="/talon" element={<TalonPage accessProfile={accessProfile} />} />
          <Route path="/rook" element={<PlaceholderPage title="Rook" text="Private build lane for advanced workflows and experiments." />} />
        </Routes>
      </main>
    </div>
  )
}

function LoadingScreen({ message }) {
  return (
    <div className="login-shell">
      <article className="panel login-card">
        <div className="eyebrow">UNICONCEPTS OPS</div>
        <h2>Loading</h2>
        <p className="helper-text">{message}</p>
      </article>
    </div>
  )
}

function LoginScreen({ supabaseConnected }) {
  const [email, setEmail] = useState('richard@uniconcepts.com')
  const [password, setPassword] = useState('Uni2026!')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    if (!supabase) {
      setLoading(false)
      setError('Supabase connection missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
    }
  }

  return (
    <div className="login-shell">
      <article className="panel login-card">
        <div className="eyebrow">UNICONCEPTS OPS</div>
        <h2>Manager login</h2>
        <p className="helper-text">Use your Uniconcepts email to access the dashboard. Location permissions and safe access are handled after sign-in.</p>
        {!supabaseConnected ? <div className="helper-text error-text">Supabase is not connected in this environment yet.</div> : null}
        <form onSubmit={handleLogin}>
          <label className="login-field">
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label className="login-field">
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button type="submit" className="primary-button login-button" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        {error ? <div className="error-text">{error}</div> : null}
        <div className="helper-text muted-small">Seeded accounts exist for Richard, John, Sabrinah, Eric, Jordan, and Alexa.</div>
      </article>
    </div>
  )
}

function PageHeader({ title, eyebrow, actionLabel }) {
  return (
    <div className="topbar">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {actionLabel ? (
        <div className="topbar-actions">
          <button type="button" className="primary-button">{actionLabel}</button>
        </div>
      ) : null}
    </div>
  )
}

function DashboardPage({ employeeRows, locationRows, employeesLoading, employeesError, accessProfile }) {
  const canSendReport = accessProfile?.role === 'admin' || accessProfile?.role === 'training_manager'
  const [reportStatus, setReportStatus] = useState('')
  const [reportSending, setReportSending] = useState(false)

  async function handleSendReport() {
    setReportSending(true)
    setReportStatus('Sending employee report…')

    try {
      const response = await sendEmployeeReport()
      setReportStatus(`Employee report sent to ${response.sentTo || 'recipient'} at ${response.sentAt || 'just now'}.`)
    } catch (error) {
      setReportStatus(error.message || 'Unable to send employee report right now.')
    } finally {
      setReportSending(false)
    }
  }

  return (
    <>
      <PageHeader title="Dashboard" eyebrow="OVERVIEW" actionLabel="Refresh data" />
      <section className="metrics-grid">
        {metricCards.map((card) => (
          <article key={card.label} className="panel metric-card">
            <span className="metric-label">{card.label}</span>
            <strong className="metric-value">{card.value}</strong>
            <span className="metric-note">{card.note}</span>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel panel-large">
          <div className="panel-header">
            <div>
              <div className="eyebrow">LOCATION SNAPSHOT</div>
              <h3>Restaurant readiness</h3>
            </div>
            <button type="button" className="ghost-button">Open report</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>In training</th>
                  <th>Overdue</th>
                  <th>Applicants</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {locationRows.map((row) => (
                  <tr key={row.location}>
                    <td>{row.location}</td>
                    <td>{row.inTraining}</td>
                    <td>{row.overdue}</td>
                    <td>{row.applicants}</td>
                    <td><span className={`status-pill${row.status !== 'Stable' ? ' warn' : ''}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">LIVE EMPLOYEES</div>
              <h3>Current records from 7shifts</h3>
            </div>
          </div>
          <div className="stack-list">
            {employeesLoading ? <div className="stack-item"><strong>Loading…</strong><span>Pulling employee records from 7shifts.</span></div> : null}
            {!employeesLoading && employeeRows.slice(0, 5).map((employee) => (
              <div key={employee.id ?? employee.name} className="stack-item">
                <strong>{employee.name}</strong>
                <span>{employee.location} • {employee.role}</span>
              </div>
            ))}
            {!employeesLoading && employeesError ? <div className="helper-text">{employeesError}</div> : null}
          </div>
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">REPORTING</div>
              <h3>Employee email report</h3>
            </div>
          </div>
          <div className="helper-text">Send the current 7shifts employee export by email using the backend route and Microsoft Graph.</div>
          {canSendReport ? (
            <div className="topbar-actions">
              <button type="button" className="primary-button" onClick={handleSendReport} disabled={reportSending}>
                {reportSending ? 'Sending…' : 'Send employee report'}
              </button>
            </div>
          ) : (
            <div className="helper-text">Your current role can view data but cannot send reports.</div>
          )}
          {reportStatus ? <div className="helper-text">{reportStatus}</div> : null}
        </article>
      </section>
    </>
  )
}

function HiringTrainingPage({ employeeRows, employeesLoading, employeesError, recentOnly = false, accessProfile }) {
  const [selectedRestaurant, setSelectedRestaurant] = useState('All restaurants')
  const [selectedRole, setSelectedRole] = useState('All roles')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [showRoleDebug, setShowRoleDebug] = useState(false)
  const [employeeWorkflowState, setEmployeeWorkflowState] = useState(() => Object.fromEntries(fallbackEmployeeRows.map((employee) => [employee.id, employee.trainingSteps || []])))

  const baseEmployees = useMemo(() => {
    const recentEmployees = recentOnly
      ? employeeRows.filter((row) => {
          const cutoff = new Date()
          cutoff.setMonth(cutoff.getMonth() - 3)
          const parsedStartDate = parseEmployeeStartDate(row.startDate)
          if (!parsedStartDate) return false
          console.log('[HiringTraining recent filter]', row.name, 'startDate=', row.startDate, 'parsed=', parsedStartDate.toISOString())
          return parsedStartDate >= cutoff
        })
      : employeeRows

    return recentEmployees
  }, [employeeRows, recentOnly])

  const allowedRestaurants = accessProfile?.allowed_locations || []

  useEffect(() => {
    if (accessProfile?.location_scope === 'assigned' && allowedRestaurants.length === 1) {
      setSelectedRestaurant(allowedRestaurants[0])
    }
  }, [accessProfile, allowedRestaurants])

  const restaurantOptions = useMemo(() => {
    const names = new Set(baseEmployees.flatMap((row) => (row.allLocations || []).map((location) => location.name)).filter(Boolean))
    const sorted = Array.from(names).sort()
    if (accessProfile?.location_scope === 'assigned') return sorted
    return ['All restaurants', ...sorted]
  }, [baseEmployees, accessProfile])

  const roleOptions = useMemo(() => {
    const names = new Set(baseEmployees.map((row) => row.role).filter(Boolean))
    return ['All roles', ...Array.from(names).sort()]
  }, [baseEmployees])

  const filteredEmployees = useMemo(() => {
    return baseEmployees.filter((row) => {
      const matchesRestaurant =
        selectedRestaurant === 'All restaurants' ||
        (row.allLocations || []).some((location) => location.name === selectedRestaurant)
      const matchesRole = selectedRole === 'All roles' || row.role === selectedRole
      return matchesRestaurant && matchesRole
    })
  }, [baseEmployees, selectedRestaurant, selectedRole])

  const selectedEmployee = filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ?? filteredEmployees[0] ?? null
  const selectedEmployeeSteps = selectedEmployee
    ? (employeeWorkflowState[selectedEmployee.id] ?? selectedEmployee.trainingSteps ?? createDefaultTrainingSteps(selectedEmployee.role))
    : []

  useEffect(() => {
    if (!selectedEmployeeId || !filteredEmployees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(filteredEmployees[0]?.id ?? null)
    }
  }, [filteredEmployees, selectedEmployeeId])

  useEffect(() => {
    if (!selectedEmployee) return
    setEmployeeWorkflowState((current) => {
      if (current[selectedEmployee.id]?.length) return current
      return {
        ...current,
        [selectedEmployee.id]: selectedEmployee.trainingSteps?.length
          ? selectedEmployee.trainingSteps
          : createDefaultTrainingSteps(selectedEmployee.role),
      }
    })
  }, [selectedEmployee])

  function updateTrainingStep(employeeId, stepId, field, value) {
    setEmployeeWorkflowState((current) => ({
      ...current,
      [employeeId]: (current[employeeId] || []).map((step) => (step.id === stepId ? { ...step, [field]: value } : step)),
    }))
  }

  return (
    <>
      <PageHeader title="Hiring & Training" eyebrow="PRIMARY MODULE" actionLabel="Assign training" />

      <section className="content-grid training-grid hiring-training-layout">
        <article className="panel panel-large">
          <div className="panel-header align-end">
            <div>
              <div className="eyebrow">EMPLOYEE DIRECTORY</div>
              <h3>Filter by restaurant and role</h3>
            </div>
            <button type="button" className="ghost-button" onClick={() => setShowRoleDebug((value) => !value)}>
              {showRoleDebug ? 'Hide role debug' : 'Show role debug'}
            </button>
          </div>

          <div className="filter-groups">
            <FilterGroup label="Restaurant" options={restaurantOptions} selected={selectedRestaurant} onSelect={setSelectedRestaurant} locked={accessProfile?.location_scope === 'assigned'} />
            <FilterGroup label="Role" options={roleOptions} selected={selectedRole} onSelect={setSelectedRole} />
          </div>

          <div className="helper-text filter-summary">Showing {filteredEmployees.length} of {baseEmployees.length} employees with known hire dates in the last 3 months</div>

          <EmployeeTable
            employeeRows={filteredEmployees}
            employeesLoading={employeesLoading}
            employeesError={employeesError}
            selectedEmployeeId={selectedEmployee?.id}
            onSelectEmployee={setSelectedEmployeeId}
            showRoleDebug={showRoleDebug}
            employeeWorkflowState={employeeWorkflowState}
            onUpdateStep={updateTrainingStep}
          />
        </article>

        <article className="panel panel-large workflow-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">DAY 1 TRAINING</div>
              <h3>{selectedEmployee ? selectedEmployee.name : 'Select an employee'}</h3>
            </div>
          </div>
          {selectedEmployee ? (
            <>
              <div className="helper-text">{selectedEmployee.location} • {selectedEmployee.role}</div>
              <div className="workflow-meta workflow-meta-two-up">
                <div className="stack-item compact-card"><strong>Hire date</strong><span>{formatMonthDayYear(selectedEmployee.startDate)}</span></div>
                <div className="stack-item compact-card"><strong>Details</strong><span>Phone and schedule info stay in the database, not on this screen.</span></div>
              </div>
              <TrainingWorkflowTable employee={selectedEmployee} steps={selectedEmployeeSteps.slice(0, 1)} onUpdateStep={updateTrainingStep} />
              {showRoleDebug ? <RoleDebugCard employee={selectedEmployee} /> : null}
            </>
          ) : (
            <div className="helper-text">Choose an employee to manage Day 1 scheduling, completion, and 1Huddle score.</div>
          )}
        </article>
      </section>
    </>
  )
}

function EmployeesPage({ employeeRows, employeesLoading, employeesError, accessProfile }) {
  return <HiringTrainingPage employeeRows={employeeRows} employeesLoading={employeesLoading} employeesError={employeesError} recentOnly={false} accessProfile={accessProfile} />
}

function SafeReconciliationPage({ accessProfile }) {
  const safeLocations = accessProfile?.safe_access_scope === 'all'
    ? ["Gentle Ben's", 'Bacio Italiano', 'Agave House']
    : (accessProfile?.safe_locations || [])

  const defaultRestaurant = accessProfile?.safe_access_scope === 'assigned'
    ? safeLocations[0] || 'Bacio Italiano'
    : 'Bacio Italiano'

  const [restaurant, setRestaurant] = useState(defaultRestaurant)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [manager, setManager] = useState('')
  const [startingSafe, setStartingSafe] = useState('')
  const [expectedDeposit, setExpectedDeposit] = useState('')
  const [actualSafe, setActualSafe] = useState('')
  const [notes, setNotes] = useState('')
  const [toastLoading, setToastLoading] = useState(false)
  const [toastStatus, setToastStatus] = useState('')
  const [toastBreakdown, setToastBreakdown] = useState(null)
  const canAccessSafe = safeLocations.length > 0

  const toastRestaurantGuids = {
    "Gentle Ben's": 'bc2c707a-62de-4ece-968a-cc4d3d400524',
  }

  const expectedSafe = (Number(startingSafe || 0) - Number(expectedDeposit || 0)).toFixed(2)
  const variance = (Number(actualSafe || 0) - Number(expectedSafe || 0)).toFixed(2)

  async function handlePullFromToast() {
    const restaurantGuid = toastRestaurantGuids[restaurant]
    if (!restaurantGuid) {
      setToastStatus(`Toast pull is not configured yet for ${restaurant}.`)
      return
    }

    setToastLoading(true)
    setToastStatus('')

    try {
      const response = await fetch(`/api/toast-safe-summary?businessDate=${date}&restaurantGuid=${restaurantGuid}`)
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Unable to pull Toast safe summary.')
      }

      const pulledDeposit = Number(data?.expectedDepositEstimate || 0)
      setExpectedDeposit(pulledDeposit.toFixed(2))
      setToastBreakdown(data?.cashBreakdown || null)
      setToastStatus(`Pulled Toast expected deposit: $${pulledDeposit.toFixed(2)}`)
    } catch (error) {
      setToastStatus(error.message || 'Unable to pull Toast safe summary.')
      setToastBreakdown(null)
    } finally {
      setToastLoading(false)
    }
  }

  async function handleSave() {
    if (!canAccessSafe) return

    const record = {
      restaurant,
      reconciliation_date: date,
      manager,
      starting_safe: Number(startingSafe || 0),
      expected_deposit: Number(expectedDeposit || 0),
      expected_safe: Number(expectedSafe || 0),
      actual_safe: Number(actualSafe || 0),
      variance: Number(variance || 0),
      notes,
    }

    if (!supabase) {
      const fallbackRecord = {
        restaurant,
        date,
        manager,
        startingSafe: Number(startingSafe || 0),
        deposit: Number(expectedDeposit || 0),
        expectedSafe: Number(expectedSafe || 0),
        actualSafe: Number(actualSafe || 0),
        variance: Number(variance || 0),
        notes,
      }
      setSafeEntries((current) => [fallbackRecord, ...current])
      return
    }

    try {
      const { error } = await supabase.from('safe_reconciliations').upsert(record, { onConflict: 'restaurant,reconciliation_date' })
      if (error) throw error
      setSafeSaveStatus('Saved to Supabase.')
    } catch (error) {
      setSafeSaveStatus(error.message || 'Unable to save right now.')
    }
  }

  return (
    <>
      <PageHeader title="Safe Reconciliation" eyebrow="PRIVATE MODULE" actionLabel="Save entry" />
      {!canAccessSafe ? (
        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">ACCESS REQUIRED</div>
              <h3>Safe reconciliation access is not assigned</h3>
            </div>
          </div>
          <p className="placeholder-copy">This module uses separate permissions from Hiring & Training. Ask Richard to assign safe access if needed.</p>
        </article>
      ) : (
        <section className="content-grid training-grid compliance-layout safe-layout">
          <article className="panel panel-large">
            <div className="panel-header">
              <div>
                <div className="eyebrow">ENTRY FORM</div>
                <h3>Daily safe reconciliation</h3>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Restaurant
                <select value={restaurant} onChange={(event) => setRestaurant(event.target.value)}>
                  {safeLocations.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                Manager
                <input value={manager} onChange={(event) => setManager(event.target.value)} placeholder="Manager name" />
              </label>
              <label>
                Starting safe
                <input value={startingSafe} onChange={(event) => setStartingSafe(event.target.value)} placeholder="0.00" />
              </label>
              <label>
                Expected deposit
                <input value={expectedDeposit} onChange={(event) => setExpectedDeposit(event.target.value)} placeholder="0.00" />
              </label>
              <label>
                Actual safe
                <input value={actualSafe} onChange={(event) => setActualSafe(event.target.value)} placeholder="0.00" />
              </label>
            </div>
            <label className="login-field">
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="4" />
            </label>
            <div className="topbar-actions" style={{ marginBottom: 16 }}>
              <button type="button" className="secondary-button" onClick={handlePullFromToast} disabled={toastLoading}>
                {toastLoading ? 'Pulling from Toast...' : 'Pull from Toast'}
              </button>
            </div>
            {toastStatus ? <div className="helper-text">{toastStatus}</div> : null}
            {toastBreakdown ? (
              <div className="helper-text">
                Payments in drawers: ${Number(toastBreakdown.totalCashPaymentsInDrawers || 0).toFixed(2)} | Cash collected: ${Number(toastBreakdown.cashCollected || 0).toFixed(2)} | Cash in: ${Number(toastBreakdown.cashIn || 0).toFixed(2)} | Cash out: ${Number(toastBreakdown.cashOut || 0).toFixed(2)} | Pay out: ${Number(toastBreakdown.payOut || 0).toFixed(2)} | Tip out: ${Number(toastBreakdown.tipOut || 0).toFixed(2)}
              </div>
            ) : null}
            <div className="metrics-grid safe-metrics-grid">
              <article className="panel metric-card">
                <span className="metric-label">Expected safe</span>
                <strong className="metric-value">${expectedSafe}</strong>
                <span className="metric-note">Starting minus deposit</span>
              </article>
              <article className="panel metric-card">
                <span className="metric-label">Variance</span>
                <strong className="metric-value">${variance}</strong>
                <span className="metric-note">Actual minus expected</span>
              </article>
            </div>
            <div className="topbar-actions">
              <button type="button" className="primary-button" onClick={handleSave}>Save reconciliation</button>
            </div>
            {safeSaveStatus ? <div className="helper-text">{safeSaveStatus}</div> : null}
          </article>

          <article className="panel stack-panel compliance-panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">RECENT ENTRIES</div>
                <h3>Running safe log</h3>
              </div>
            </div>
            <SafeLogTable rows={savedSafeEntries.length ? savedSafeEntries : sampleSafeEntries} />
          </article>
        </section>
      )}
    </>
  )
}

function MarketingPage({ accessProfile, marketingEvents, marketingAssets, marketingEventsError, marketingAssetsError, brandKits, setBrandKits, setMarketingEvents }) {
  const visibleRestaurants = accessProfile?.role === 'admin'
    ? ['All restaurants', ...marketingRestaurants]
    : (accessProfile?.allowed_locations || marketingRestaurants)
  const defaultRestaurant = visibleRestaurants[0] || 'All restaurants'
  const [selectedRestaurant, setSelectedRestaurant] = useState(defaultRestaurant)
  const [selectedLibraryCategory, setSelectedLibraryCategory] = useState('All categories')
  const [draftEvent, setDraftEvent] = useState({
    restaurant: selectedRestaurant === 'All restaurants' ? marketingRestaurants[0] : selectedRestaurant,
    title: '',
    type: marketingTypeChoices[0],
    date: new Date().toISOString().slice(0, 10),
    time: '17:00',
    status: marketingStatusChoices[0],
    notes: '',
  })

  useEffect(() => {
    if (!visibleRestaurants.includes(selectedRestaurant)) {
      setSelectedRestaurant(defaultRestaurant)
    }
  }, [visibleRestaurants, selectedRestaurant, defaultRestaurant])

  useEffect(() => {
    if (selectedRestaurant !== 'All restaurants') {
      setDraftEvent((current) => ({ ...current, restaurant: selectedRestaurant }))
    }
  }, [selectedRestaurant])

  const filteredEvents = useMemo(() => {
    if (selectedRestaurant === 'All restaurants') return marketingEvents
    return marketingEvents.filter((event) => event.restaurant === selectedRestaurant)
  }, [marketingEvents, selectedRestaurant])

  const filteredAssets = useMemo(() => {
    return marketingAssets.filter((asset) => {
      if (selectedRestaurant !== 'All restaurants' && asset.restaurant !== selectedRestaurant) return false
      if (selectedLibraryCategory === 'All categories') return true
      return asset.category === selectedLibraryCategory
    })
  }, [marketingAssets, selectedRestaurant, selectedLibraryCategory])

  function handleDraftChange(field, value) {
    setDraftEvent((current) => ({ ...current, [field]: value }))
  }

  function handleAddDraftEvent() {
    const restaurantName = draftEvent.restaurant || (selectedRestaurant === 'All restaurants' ? marketingRestaurants[0] : selectedRestaurant)
    if (!draftEvent.title.trim()) return
    if (selectedRestaurant !== 'All restaurants' && restaurantName !== selectedRestaurant) {
      setDraftEvent((current) => ({ ...current, restaurant: selectedRestaurant }))
      return
    }
    setMarketingEvents((current) => [
      {
        id: `mkt-${Date.now()}`,
        restaurant: restaurantName,
        title: draftEvent.title.trim(),
        type: draftEvent.type,
        date: draftEvent.date,
        time: draftEvent.time,
        status: draftEvent.status,
        owner: accessProfile?.full_name || 'Talon',
        channel: 'Approval queue',
        notes: draftEvent.notes.trim() || 'Needs review before automation sequence.',
      },
      ...current,
    ])
    setDraftEvent({
      restaurant: accessProfile?.role === 'admin' ? 'All restaurants' : restaurantName,
      title: '',
      type: marketingTypeChoices[0],
      date: new Date().toISOString().slice(0, 10),
      time: '17:00',
      status: marketingStatusChoices[0],
      notes: '',
    })
  }

  return (
    <>
      <PageHeader title="Marketing" eyebrow="AUTOMATION PIPELINE" actionLabel="Queue campaign" />
      <section className="content-grid marketing-layout">
        <article className="panel panel-large">
          <div className="panel-header">
            <div>
              <div className="eyebrow">CALENDAR</div>
              <h3>Restaurant-specific promotion queue</h3>
            </div>
          </div>
          <div className="filter-groups">
            <FilterGroup label="Restaurant" options={visibleRestaurants} selected={selectedRestaurant} onSelect={setSelectedRestaurant} locked={accessProfile?.role !== 'admin'} />
          </div>
          <div className="marketing-calendar-grid">
            {filteredEvents.map((event) => (
              <article key={event.id} className="stack-item marketing-event-card">
                <div className="marketing-card-top">
                  <span className="status-pill">{event.status}</span>
                  <strong>{event.restaurant}</strong>
                </div>
                <h4>{event.title}</h4>
                <p>{event.type} • {event.date} • {event.time}</p>
                <p>{event.channel}</p>
                <span>{event.notes}</span>
              </article>
            ))}
          </div>
          {marketingEventsError ? <div className="helper-text">{marketingEventsError}</div> : null}
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">NEW EVENT</div>
              <h3>Queue an approval-only campaign</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Restaurant
              <select value={draftEvent.restaurant} onChange={(event) => handleDraftChange('restaurant', event.target.value)}>
                {visibleRestaurants.filter((restaurant) => restaurant !== 'All restaurants').map((restaurant) => <option key={restaurant} value={restaurant}>{restaurant}</option>)}
              </select>
            </label>
            <label>
              Campaign title
              <input value={draftEvent.title} onChange={(event) => handleDraftChange('title', event.target.value)} placeholder="Late night patio push" />
            </label>
            <label>
              Type
              <select value={draftEvent.type} onChange={(event) => handleDraftChange('type', event.target.value)}>
                {marketingTypeChoices.map((choice) => <option key={choice}>{choice}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={draftEvent.status} onChange={(event) => handleDraftChange('status', event.target.value)}>
                {marketingStatusChoices.map((choice) => <option key={choice}>{choice}</option>)}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={draftEvent.date} onChange={(event) => handleDraftChange('date', event.target.value)} />
            </label>
            <label>
              Time
              <input type="time" value={draftEvent.time} onChange={(event) => handleDraftChange('time', event.target.value)} />
            </label>
          </div>
          <label className="login-field">
            Notes
            <textarea value={draftEvent.notes} onChange={(event) => handleDraftChange('notes', event.target.value)} rows="4" placeholder="What should Talon generate, what approvals are needed, and which assets should be used?" />
          </label>
          <button type="button" className="primary-button" onClick={handleAddDraftEvent}>Add to approval queue</button>
        </article>

        <article className="panel panel-large">
          <div className="panel-header">
            <div>
              <div className="eyebrow">PHOTO LIBRARY</div>
              <h3>Restaurant-scoped asset library</h3>
            </div>
          </div>
          <div className="filter-groups">
            <FilterGroup label="Category" options={['All categories', ...marketingLibraryCategories]} selected={selectedLibraryCategory} onSelect={setSelectedLibraryCategory} />
          </div>
          <div className="marketing-asset-grid">
            {filteredAssets.map((asset) => (
              <article key={asset.id} className="stack-item marketing-asset-card">
                <strong>{asset.label}</strong>
                <span>{asset.restaurant}</span>
                <span>{asset.category}</span>
                <span>{asset.status} • {asset.usage}</span>
              </article>
            ))}
          </div>
          {marketingAssetsError ? <div className="helper-text">{marketingAssetsError}</div> : null}
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">BRAND KITS</div>
              <h3>Locked admin-only brand controls</h3>
            </div>
          </div>
          <div className="stack-list compact-grid">
            {Object.entries(brandKits).map(([restaurant, kit]) => (
              <div key={restaurant} className="stack-item">
                <strong>{restaurant}</strong>
                <span>Primary: {kit.primaryColor} • Accent: {kit.accentColor}</span>
                <span>{kit.logo} • {kit.font}</span>
                <span>{kit.locked ? 'Locked for admin only' : 'Editable'}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  )
}

function SportsBoardPage({ accessProfile, employeeRows }) {
  const visibleRestaurants = accessProfile?.role === 'admin'
    ? ['All restaurants', ...sportsRestaurants]
    : (accessProfile?.allowed_locations || sportsRestaurants)
  const defaultRestaurant = visibleRestaurants[0] || 'All restaurants'
  const [selectedRestaurant, setSelectedRestaurant] = useState(defaultRestaurant)

  const filteredGames = useMemo(() => {
    if (selectedRestaurant === 'All restaurants') return sampleSportsGames
    return sampleSportsGames.filter((game) => game.restaurant === selectedRestaurant)
  }, [selectedRestaurant])

  const alerts = useMemo(() => {
    return sampleManagerAlerts.map((alert) => {
      const matchedEmployee = employeeRows.find((row) => row.name.toLowerCase() === alert.manager.toLowerCase())
      return {
        ...alert,
        phone: matchedEmployee?.phone || alert.phone || 'No phone from app feed yet',
        workingNow: matchedEmployee?.workingToday || alert.workingNow,
      }
    })
  }, [employeeRows])

  const filteredAlerts = useMemo(() => {
    if (selectedRestaurant === 'All restaurants') return alerts
    return alerts.filter((alert) => alert.restaurant === selectedRestaurant)
  }, [alerts, selectedRestaurant])

  const mustWatchGames = filteredGames.filter((game) => game.mustWatch)
  const arizonaGames = filteredGames.filter((game) => game.arizonaFocus)
  const channelsNeeded = Array.from(new Set(filteredGames.map((game) => `${game.channel}${game.channelNumber && game.channelNumber !== 'local' && game.channelNumber !== 'streaming' ? ` (${game.channelNumber})` : ''}`)))
  const daytimeGames = filteredGames.filter((game) => game.window === 'Morning / Afternoon')
  const eveningGames = filteredGames.filter((game) => game.window === 'Evening')

  return (
    <>
      <PageHeader title="Sports Board" eyebrow="MANAGER FEED" actionLabel="Build today\'s slate" />
      <section className="metrics-grid sports-metrics-grid">
        <article className="panel metric-card">
          <span className="metric-label">Must-watch games</span>
          <strong className="metric-value">{mustWatchGames.length}</strong>
          <span className="metric-note">Asterisked games must be on TVs.</span>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Arizona-relevant</span>
          <strong className="metric-value">{arizonaGames.length}</strong>
          <span className="metric-note">Wildcats and Arizona pro teams.</span>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Channels needed today</span>
          <strong className="metric-value">{channelsNeeded.length}</strong>
          <span className="metric-note">Verified DirecTV / local feeds listed.</span>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Manager text alerts</span>
          <strong className="metric-value">{filteredAlerts.length}</strong>
          <span className="metric-note">10:00 AM all-games + 15 min must-watch reminders.</span>
        </article>
      </section>

      <section className="content-grid sports-layout">
        <article className="panel panel-large">
          <div className="panel-header">
            <div>
              <div className="eyebrow">SPORTS FILTER</div>
              <h3>Restaurant-specific game board</h3>
            </div>
          </div>
          <div className="filter-groups">
            <FilterGroup label="Restaurant" options={visibleRestaurants} selected={selectedRestaurant} onSelect={setSelectedRestaurant} locked={accessProfile?.role !== 'admin'} />
          </div>
          <div className="sports-callout">
            <strong>Channels needed today:</strong>
            <span>{channelsNeeded.join(' • ') || 'No channels selected yet'}</span>
          </div>
          <div className="helper-text">Managers working today: not automatically confirmed yet.</div>
          <div className="sports-section-grid">
            <div className="sports-section-block">
              <div className="eyebrow">MORNING / AFTERNOON GAMES</div>
              <div className="sports-game-list">
                {daytimeGames.map((game) => <SportsGameCard key={game.id} game={game} />)}
              </div>
            </div>
            <div className="sports-section-block">
              <div className="eyebrow">EVENING GAMES</div>
              <div className="sports-game-list">
                {eveningGames.map((game) => <SportsGameCard key={game.id} game={game} />)}
              </div>
            </div>
          </div>
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">MANAGER TEXT ALERTS</div>
              <h3>Current routing status</h3>
            </div>
          </div>
          <div className="stack-list">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="stack-item">
                <strong>{alert.manager}</strong>
                <span>{alert.restaurant}</span>
                <span>{alert.phone || 'No phone from app feed yet'} • {alert.workingNow ? 'Working today' : 'Not confirmed on shift'}</span>
                <span>{alert.alertWindow} • {alert.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">NEXT BUILD STEPS</div>
              <h3>What gets wired next</h3>
            </div>
          </div>
          <div className="stack-list compact-grid">
            <div className="stack-item">
              <strong>Live sports feed</strong>
              <span>Replace placeholder games with a shared slate that powers both the board and the 8:00 AM email.</span>
            </div>
            <div className="stack-item">
              <strong>Manager routing</strong>
              <span>Replace placeholder manager rows with the real working manager and phone pulled from the app feed / schedule path.</span>
            </div>
            <div className="stack-item">
              <strong>Text logging + opt-ins</strong>
              <span>Turn on SMS logs and quiet-hour rules after Twilio registration clears.</span>
            </div>
          </div>
        </article>
      </section>
    </>
  )
}

function SportsGameCard({ game }) {
  return (
    <article className="sports-game-card">
      <div className="sports-game-header">
        <div>
          <strong>{game.mustWatch ? '* ' : ''}{game.title}</strong>
          <span>{game.league}</span>
        </div>
        <span className={`status-pill${game.mustWatch ? '' : ' warn'}`}>{game.mustWatch ? 'Must watch' : 'Optional'}</span>
      </div>
      <div className="sports-meta-row">
        <span>{game.startTime} • {game.restaurant}</span>
        <span>{game.channel}{game.channelNumber && game.channelNumber !== 'local' && game.channelNumber !== 'streaming' ? ` • DirecTV ${game.channelNumber}` : ''}</span>
      </div>
      <p>{game.notes}</p>
      <div className="sports-tag-row">
        <span>{game.window}</span>
        <span>{game.status}</span>
      </div>
    </article>
  )
}

function PlaceholderPage({ title, text }) {
  return (
    <>
      <PageHeader title={title} eyebrow="COMING SOON" />
      <article className="panel stack-panel">
        <p className="placeholder-copy">{text}</p>
      </article>
    </>
  )
}

function TalonPage({ accessProfile }) {
  return (
    <>
      <PageHeader title="Talon" eyebrow="PRIVATE MODULE" />
      <section className="content-grid assistant-grid">
        <article className="panel panel-large assistant-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">TALON CONTROL</div>
              <h3>Live operator lane</h3>
            </div>
          </div>
          <div className="assistant-chat-preview">
            <div className="stack-item">
              <strong>What Talon can do</strong>
              <span>Use the Uni app to route requests, send reports, review safe reconciliations, and draft manager-facing updates.</span>
            </div>
            <div className="stack-item">
              <strong>Outbound tools</strong>
              <span>Supabase Edge Functions are wired for email, mailbox reads, and future SMS sends once Twilio is approved.</span>
            </div>
            <div className="stack-item">
              <strong>Guardrails</strong>
              <span>Private by default. Only admin roles see this panel. Safe access remains separate from general hiring/training visibility.</span>
            </div>
          </div>
          <div className="chat-input-row">
            <textarea rows="4" placeholder="Future Talon command bar can live here." />
            <div className="topbar-actions">
              <button type="button" className="primary-button">Send to Talon</button>
              <button type="button" className="ghost-button">Open chat history</button>
            </div>
          </div>
        </article>

        <article className="panel stack-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">ACCESS</div>
              <h3>Who can see this</h3>
            </div>
          </div>
          <div className="helper-text">Current role: {formatRole(accessProfile?.role)}. This page stays private to admin users.</div>
        </article>
      </section>
    </>
  )
}

function FilterGroup({ label, options, selected, onSelect, locked = false }) {
  return (
    <div className="filter-group-block">
      <div className="eyebrow">{label}</div>
      <div className="filter-chips wrap">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip-button${selected === option ? ' active' : ''}`}
            onClick={() => onSelect(option)}
            disabled={locked}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function EmployeeTable({ employeeRows, employeesLoading, employeesError, selectedEmployeeId, onSelectEmployee, showRoleDebug, employeeWorkflowState, onUpdateStep }) {
  return (
    <div className="table-wrap">
      {employeesLoading ? <div className="helper-text">Loading live 7shifts employee records…</div> : null}
      {!employeesLoading && employeesError ? <div className="helper-text">{employeesError}</div> : null}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Role</th>
            <th>Start date</th>
            <th>Day 1</th>
            <th>Day 2</th>
            <th>Day 3</th>
            {showRoleDebug ? <th>Role Debug</th> : null}
          </tr>
        </thead>
        <tbody>
          {employeeRows.map((row) => {
            const steps = employeeWorkflowState[row.id] ?? row.trainingSteps ?? createDefaultTrainingSteps(row.role)
            return (
              <tr
                key={row.id ?? row.name}
                className={selectedEmployeeId === row.id ? 'selected-row' : ''}
                onClick={() => onSelectEmployee?.(row.id)}
                title={row.phone ? `Phone: ${row.phone}` : 'No phone on file'}
              >
                <td>{row.name}</td>
                <td><LocationCell row={row} compact /></td>
                <td>{row.role}</td>
                <td>{formatMonthDay(row.startDate)}</td>
                {steps.slice(0, 3).map((step) => (
                  <td key={step.id}>
                    <div className="day-column-cell">
                      <strong>{step.name}</strong>
                      <input
                        type="date"
                        value={step.completedDate || ''}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onUpdateStep(row.id, step.id, 'completedDate', event.target.value)}
                      />
                    </div>
                  </td>
                ))}
                {showRoleDebug ? <td>{row.allRoles?.map((role) => role.isPrimary ? `${role.name}*` : role.name).join(', ') || 'No roles pulled'}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LocationCell({ row, compact = false }) {
  const locations = Array.isArray(row.allLocations) ? row.allLocations : []
  if (locations.length <= 1) return <span>{compact ? formatShortLocationName(row.location) : row.location}</span>
  const extraCount = locations.length - 1
  return (
    <details className="location-details">
      <summary>{compact ? formatShortLocationName(row.location) : row.location} <span className="location-more">+{extraCount} more</span></summary>
      <div className="location-menu">{locations.map((location) => <div key={location.id ?? location.name}>{compact ? formatShortLocationName(location.name) : location.name}</div>)}</div>
    </details>
  )
}

function RoleDebugCard({ employee }) {
  return (
    <div className="debug-card">
      <div className="eyebrow">ROLE DEBUG</div>
      <strong>Displayed role: {employee.role}</strong>
      <div className="helper-text">Raw roles pulled from 7shifts:</div>
      <ul className="debug-list">{(employee.allRoles || []).map((role) => <li key={role.id ?? role.name}>{role.name} {role.isPrimary ? '(primary)' : ''}</li>)}</ul>
    </div>
  )
}

function TrainingWorkflowTable({ employee, steps, onUpdateStep }) {
  return (
    <div className="table-wrap workflow-table-wrap">
      <table>
        <thead><tr><th>Step</th><th>Scheduled day</th><th>Completed</th><th>1Huddle score</th></tr></thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.id}>
              <td>{step.name}</td>
              <td><input type="date" value={step.scheduledDate || ''} onChange={(event) => onUpdateStep(employee.id, step.id, 'scheduledDate', event.target.value)} /></td>
              <td><input type="date" value={step.completedDate || ''} onChange={(event) => onUpdateStep(employee.id, step.id, 'completedDate', event.target.value)} /></td>
              <td><input type="number" min="0" max="100" placeholder="Score" value={step.score ?? ''} onChange={(event) => onUpdateStep(employee.id, step.id, 'score', event.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SafeLogTable({ rows }) {
  if (!rows.length) {
    return <div className="helper-text">No saved reconciliations yet.</div>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Restaurant</th>
            <th>Manager</th>
            <th>Starting</th>
            <th>Deposit</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.restaurant}-${row.reconciliation_date || row.date}`}>
              <td>{row.reconciliation_date || row.date}</td>
              <td>{row.restaurant}</td>
              <td>{row.manager || '—'}</td>
              <td>${Number(row.starting_safe ?? row.startingSafe ?? 0).toFixed(2)}</td>
              <td>${Number(row.expected_deposit ?? row.deposit ?? 0).toFixed(2)}</td>
              <td>${Number(row.expected_safe ?? row.expectedSafe ?? 0).toFixed(2)}</td>
              <td>${Number(row.actual_safe ?? row.actualSafe ?? 0).toFixed(2)}</td>
              <td className={Number(row.variance || 0) < 0 ? 'warn-text' : ''}>{Number(row.variance || 0) >= 0 ? '+' : ''}${Number(row.variance || 0).toFixed(2)}</td>
              <td>{row.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatRole(role) {
  if (!role) return 'User'
  if (role === 'training_manager') return 'Training Manager'
  if (role === 'gm') return 'GM'
  if (role === 'admin') return 'Admin'
  return role
}

function formatScope(accessProfile) {
  if (!accessProfile) return 'Loading access...'
  return accessProfile.location_scope === 'all' ? 'All restaurants' : 'Assigned restaurant only'
}

export default App
