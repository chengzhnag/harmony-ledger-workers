import { useContext, useEffect } from 'react'
import {
  UNSAFE_DataRouterStateContext,
  isRouteErrorResponse,
  useInRouterContext,
  useRouteError,
} from 'react-router-dom'

import { errorReporter } from '@/lib/errorReporter'
import { ErrorFallback } from './ErrorFallback'

type RouteError = unknown

function reportRouteError(error: RouteError) {
  if (!error) return

  let errorMessage = 'Unknown route error'
  let errorStack = ''

  if (isRouteErrorResponse(error)) {
    errorMessage = `Route Error ${error.status}: ${error.statusText}`
    if (error.data) {
      errorMessage += ` - ${JSON.stringify(error.data)}`
    }
  } else if (error instanceof Error) {
    errorMessage = error.message
    errorStack = error.stack || ''
  } else if (typeof error === 'string') {
    errorMessage = error
  } else {
    try {
      errorMessage = JSON.stringify(error)
    } catch {
      errorMessage = String(error)
    }
  }

  errorReporter.report({
    message: errorMessage,
    stack: errorStack,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    source: 'react-router',
    error,
    level: 'error',
  })
}

function RouteErrorBoundaryView({ error }: { error: RouteError }) {
  useEffect(() => {
    reportRouteError(error)
  }, [error])

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorFallback
        title={`${error.status} ${error.statusText}`}
        message="Sorry, an error occurred while loading this page."
        error={error.data ? { message: JSON.stringify(error.data, null, 2) } : error}
        statusMessage="Navigation error detected"
      />
    )
  }

  return (
    <ErrorFallback
      title="Unexpected Error"
      message="An unexpected error occurred while loading this page."
      error={error}
      statusMessage="Routing error detected"
    />
  )
}

function DataRouterRouteErrorBoundary() {
  const error = useRouteError()
  return <RouteErrorBoundaryView error={error} />
}

export function RouteErrorBoundary() {
  const inRouter = useInRouterContext()
  const dataRouterState = useContext(UNSAFE_DataRouterStateContext)

  const misconfigured = !inRouter || !dataRouterState
  const message = !inRouter
    ? 'Router is not mounted. Add a router at the app root.'
    : 'This router does not support route errors. Use createBrowserRouter + RouterProvider.'

  useEffect(() => {
    if (!misconfigured) return
    errorReporter.report({
      message,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: 'react-router',
      level: 'error',
    })
  }, [misconfigured, message])

  // Guard: If this component is rendered outside of a data router (e.g. BrowserRouter)
  // then useRouteError() would throw. Show a friendly fallback instead.
  if (misconfigured) {
    return (
      <ErrorFallback
        title="Router configuration error"
        message={message}
        statusMessage="Routing error boundary could not initialize"
      />
    )
  }

  return <DataRouterRouteErrorBoundary />
}