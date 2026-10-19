export type Role = 'staff' | 'manager'
export type Lang = 'en' | 'th'
export type AutoClosed = null | 'switched_project' | 'end_of_day'

export interface Profile {
  id: string
  full_name: string
  role: Role
  language: Lang
  active: boolean
}

export interface Project {
  id: string
  code: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  color: string
  archived: boolean
}

export interface Visit {
  id: string
  user_id: string
  project_id: string
  check_in_at: string
  check_out_at: string | null
  task: string
  work_done: string | null
  in_lat: number | null
  in_lng: number | null
  in_accuracy_m: number | null
  out_lat: number | null
  out_lng: number | null
  out_accuracy_m: number | null
  auto_closed: AutoClosed
  edited_by: string | null
  edited_at: string | null
}

export type VisitWithProject = Visit & { project: Project }
export type VisitFull = VisitWithProject & { profile: Profile }
