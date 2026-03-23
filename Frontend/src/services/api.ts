import axios from 'axios'

const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface LoginRequest {
  employee_id: string
  department: string
  role: string
}

export interface LoginResponse {
  message: string
  employee_id: string
  needs_consent: boolean
}


export interface EmployeeConsentRequest {
  employee_id: string
  consent_to_recording: boolean
  consent_to_analytics: boolean
  consent_to_policy: boolean
  confirmation_text: string
}
export interface AdminStatsRequest {
  department?: string
  date_range?: 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'All Time'
}

export interface AdminEmotionStat {
  status: string
  total: number
}

export interface AdminEmployeeStat {
  employee_id: string
  department: string
  session_count: number
  avg_duration: number
  dominant_emotion: string | null
}

export interface AdminDepartmentStat {
  department: string
  employee_count: number
  session_count: number
  avg_duration: number
  happy_pct: number
  dominant_emotion: string | null
}

export interface AdminTimeSeriesPoint {
  date: string
  session_count: number
  total_duration: number
  dominant_emotion: string | null
}

export interface AdminRiskEmployee {
  employee_id: string
  department: string
  negative_count: number
  total_count: number
  negative_ratio: number
}

export interface AdminStatsResponse {
  emotions: AdminEmotionStat[]
  employees: AdminEmployeeStat[]
  departments: AdminDepartmentStat[]
  time_series: AdminTimeSeriesPoint[]
  risk_employees: AdminRiskEmployee[]
}

export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/login', data)
    return response.data
  },
  submitEmployeeConsent: async (data: EmployeeConsentRequest): Promise<{ message: string; employee_id: string }> => {
    const response = await api.post<{ message: string; employee_id: string }>('/employee_consent', data)
    return response.data
  },
}

export const adminAPI = {
  getStats: async (params: AdminStatsRequest = {}): Promise<AdminStatsResponse> => {
    const response = await api.get<AdminStatsResponse>('/admin_stats', {
      params: {
        department: params.department ?? 'All',
        date_range: params.date_range ?? 'Last 30 Days',
      },
    })
    return response.data
  },
}

export default api



