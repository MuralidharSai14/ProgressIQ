/**
 * PROGRESSIQ — Project Context
 * Global state: which project is currently active.
 * React Context lets any component access this without passing props manually.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import apiService from '../services/api'

interface ProjectContextType {
  projectId: number | null
  projectName: string
  setProject: (id: number, name: string) => void
  clearProject: () => void
  backendOnline: boolean
}

const ProjectContext = createContext<ProjectContextType>({
  projectId: null,
  projectName: '',
  setProject: () => {},
  clearProject: () => {},
  backendOnline: false,
})

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projectId, setProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('progressiq_project_id')
    return saved ? parseInt(saved) : null
  })
  const [projectName, setProjectName] = useState<string>(() =>
    localStorage.getItem('progressiq_project_name') || ''
  )
  const [backendOnline, setBackendOnline] = useState(false)

  useEffect(() => {
    apiService.health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  const setProject = (id: number, name: string) => {
    setProjectId(id)
    setProjectName(name)
    localStorage.setItem('progressiq_project_id', String(id))
    localStorage.setItem('progressiq_project_name', name)
  }

  const clearProject = () => {
    setProjectId(null)
    setProjectName('')
    localStorage.removeItem('progressiq_project_id')
    localStorage.removeItem('progressiq_project_name')
  }

  return (
    <ProjectContext.Provider value={{ projectId, projectName, setProject, clearProject, backendOnline }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => useContext(ProjectContext)
