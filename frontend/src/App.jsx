import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ThreeDViewRoute } from './routes';
import { ReplicatePage } from './routes';
import './App.css';

const icons = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m4-8v8m5-8l2 2m-2-2v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8" />
    </svg>
  ),
  view: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7 0c0 5-7 9-7 9s-7-4-7-9a7 7 0 0114 0z" />
    </svg>
  ),
  replicate: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

function NavLink({ to, icon, label, activeColor }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
        ${isActive
          ? `${activeColor} text-white shadow-md`
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <span className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 shadow-sm flex flex-col py-6 px-4 flex-shrink-0">
        {/* Logo */}
        <div className="mb-8 px-2">
          <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
            Roomify AI
          </span>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Interior design, reimagined</p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1.5 flex-1">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest px-2 mb-2">Menu</p>
          <NavLink to="/" icon={icons.home} label="Home" activeColor="bg-gradient-to-r from-blue-500 to-blue-600" />
          <NavLink to="/3dview" icon={icons.view} label="3D View" activeColor="bg-gradient-to-r from-emerald-500 to-teal-600" />
          <NavLink to="/replicate" icon={icons.replicate} label="Replicate" activeColor="bg-gradient-to-r from-purple-500 to-indigo-600" />
        </nav>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 px-2">
          <p className="text-xs text-gray-400">© 2026 Roomify AI</p>
        </div>
      </aside>

      {/* Main Content — flex-1, overflow-auto, each route fills it */}
      <main className="flex-1 overflow-auto flex flex-col">
        <Routes>
          <Route path="/3dview" element={<ThreeDViewRoute />} />
          <Route path="/replicate" element={<ReplicatePage />} />
          <Route
            path="/"
            element={
              <div className="flex-1 flex flex-col items-center justify-center p-10 h-full">
                <div className="text-center max-w-xl">
                  <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-blue-100">
                    ✨ AI-Powered Room Design
                  </div>
                  <h1 className="text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
                    Transform any room with{' '}
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      AI magic
                    </span>
                  </h1>
                  <p className="text-lg text-gray-500 mb-10">
                    Upload room images, generate 3D walkthroughs, or reimagine your space in any design style.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Link
                      to="/3dview"
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-7 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-teal-200 hover:scale-105 transition-all duration-200 flex items-center gap-2"
                    >
                      {icons.view} Try 3D View
                    </Link>
                    <Link
                      to="/replicate"
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-7 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-purple-200 hover:scale-105 transition-all duration-200 flex items-center gap-2"
                    >
                      {icons.replicate} Replicate Room
                    </Link>
                  </div>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-3 gap-6 mt-16 w-full max-w-3xl">
                  {[
                    { icon: '🏠', title: 'Upload & Analyze', desc: 'Upload room photos and let AI analyze layout and furniture.' },
                    { icon: '🧊', title: '3D Visualization', desc: 'Walk through an interactive 3D model of your room.' },
                    { icon: '🎨', title: 'Style Reimagine', desc: 'Redecorate with any theme — Modern, Classic, Boho, and more.' },
                  ].map((card) => (
                    <div key={card.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-3xl mb-3">{card.icon}</div>
                      <h3 className="font-bold text-gray-900 mb-1">{card.title}</h3>
                      <p className="text-sm text-gray-500">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;