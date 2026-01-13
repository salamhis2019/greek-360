import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1 className="text-4xl font-bold">Welcome to Greek 360</h1>

      <div className="flex gap-2">
        <Badge>New</Badge>
        <Badge variant="secondary">React 19</Badge>
        <Badge variant="outline">TypeScript</Badge>
        <Badge variant="destructive">Hot</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>React + Vite</CardTitle>
            <CardDescription>Lightning fast development</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Build modern web apps with the latest React features and Vite's instant HMR.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Learn More
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tailwind CSS</CardTitle>
            <CardDescription>Utility-first styling</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Rapidly build custom designs without leaving your HTML.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Learn More
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>shadcn/ui</CardTitle>
            <CardDescription>Beautiful components</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Accessible and customizable components built with Radix UI.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Learn More
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button>Primary Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>

      <Link to="/about">
        <Button variant="link">Go to About →</Button>
      </Link>
    </div>
  )
}

export default Home
