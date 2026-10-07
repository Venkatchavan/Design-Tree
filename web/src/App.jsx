

import { useQuery } from '@tanstack/react-query'
import { meApi } from './lib/api.js'
import LoginPage from './pages/LoginPage.jsx'
import Placeholder from './pages/Placeholder.jsx'

function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: meApi,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="login-screen">
        <div className="login-sub" style={{ color: '#fff' }}>
          Loading…
        </div>
      </div>
    )
  }

  // NOTE: after logout the ['me'] refetch 401s but `data` keeps its stale
  // value, so the error state (not just `data`) must gate the app screen.
  if (!isError && data?.user) {
    return <Placeholder user={data.user} />
  }

  return <LoginPage />
}

export default App
