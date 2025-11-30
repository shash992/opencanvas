import Sidebar from './Sidebar'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <div className="layout-body">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}

