import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { createBrowserAppRouter } from '@/app/router/createAppRouter'

const browserRouter = createBrowserAppRouter()

const App = () => {
  return (
    <AppProviders>
      <RouterProvider router={browserRouter} />
    </AppProviders>
  )
}

export default App
