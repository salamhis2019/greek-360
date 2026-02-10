import { createBrowserRouter, createMemoryRouter } from 'react-router-dom'
import { appRouteObjects } from './routes'

export const createBrowserAppRouter = () => createBrowserRouter(appRouteObjects)

export const createMemoryAppRouter = (initialEntries: string[]) =>
  createMemoryRouter(appRouteObjects, { initialEntries })
