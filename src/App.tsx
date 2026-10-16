import { CheckCircle2 } from 'lucide-react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Logo } from './components/UI';
import { AppProvider, useApp } from './lib/store';
import { Classes } from './pages/Classes';
import { CoursePage } from './pages/Course';
import { Login } from './pages/Login';
import { Management } from './pages/Management';
import { Market } from './pages/Market';
import { Wiki } from './pages/Wiki';

function AppRoutes() {
  const { user, notice, recovery, reset } = useApp();
  return (
    <>
      {recovery ? (
        <div className="recovery-page">
          <Logo />
          <h1>Let’s restore your workspace.</h1>
          <p>The saved demo data could not be read. Restore the sample workspace to continue.</p>
          <button className="button" onClick={reset}>
            Restore sample workspace
          </button>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              user ? (
                <Shell>
                  <Routes>
                    <Route path="/classes" element={<Classes />} />
                    <Route path="/classes/:courseId" element={<CoursePage />} />
                    <Route path="/wiki" element={<Wiki />} />
                    <Route path="/wiki/:noteId" element={<Wiki />} />
                    <Route path="/market" element={<Market />} />
                    <Route path="/market/:publicationId" element={<Market />} />
                    <Route path="/manage" element={<Management />} />
                    <Route path="*" element={<Navigate to="/classes" replace />} />
                  </Routes>
                </Shell>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
        </div>
      )}
    </>
  );
}
export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  );
}
