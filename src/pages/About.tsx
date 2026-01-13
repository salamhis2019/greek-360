import { Link } from 'react-router-dom'

function About() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold">About</h1>
      <p className="text-gray-600">This is the about page.</p>
      <Link to="/" className="text-blue-500 hover:underline">
        Go to Home
      </Link>
    </div>
  )
}

export default About
