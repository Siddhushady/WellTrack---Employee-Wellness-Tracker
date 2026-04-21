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

export interface CurrentWeekStats {
  start_date: string
  end_date: string
  emotions: AdminEmotionStat[]
  departments: { department: string; employee_count: number; happy_pct: number }[]
}

export interface EmployeeEmotionSummary {
  employee_id: string
  department: string
  days: number
  start_date: string
  end_date: string
  first_session_date: string | null
  last_session_date: string | null
  session_count: number
  active_days: number
  emotions: AdminEmotionStat[]
}

export interface WellnessReport {
  id: number
  employee_id: string
  timeframe: 'week' | 'month'
  report_type: 'insight' | 'flagged'
  report_content: string
  report_summary: EmployeeEmotionSummary
  sent_at: string
}

export interface SendWellnessReportRequest {
  employee_id: string
  timeframe: 'week' | 'month'
  report_type?: 'insight' | 'flagged'
  report_content: string
  report_summary: EmployeeEmotionSummary
}

export interface FlaggedEmployee {
  employee_id: string
  department: string
  negative_count: number
  total_count: number
  negative_ratio: number
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
  getCurrentWeekStats: async (): Promise<CurrentWeekStats> => {
    const response = await api.get<CurrentWeekStats>('/admin_stats/current_week')
    return response.data
  },
  getFlags: async (): Promise<FlaggedEmployee[]> => {
    const response = await api.get<FlaggedEmployee[]>('/admin_stats/flags')
    return response.data
  },
  getEmployeeEmotionSummary: async (
    employeeId: string,
    timeframe: 'week' | 'month'
  ): Promise<EmployeeEmotionSummary> => {
    const response = await api.get<EmployeeEmotionSummary>('/analyze/employee/summary', {
      params: {
        employee_id: employeeId,
        timeframe,
      },
    })
    return response.data
  },
  sendEmployeeReport: async (data: SendWellnessReportRequest): Promise<{ id: number; employee_id: string; sent_at: string }> => {
    const response = await api.post<{ id: number; employee_id: string; sent_at: string }>('/employee_reports', data)
    return response.data
  },
}

export const reportAPI = {
  getEmployeeReports: async (employeeId: string): Promise<WellnessReport[]> => {
    const response = await api.get<WellnessReport[]>(`/employee_reports/${employeeId}`)
    return response.data
  },
}

export default api



