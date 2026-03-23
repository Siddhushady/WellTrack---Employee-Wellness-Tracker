import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogIn, User, Building2, AlertCircle, Loader2 } from 'lucide-react'
import { authAPI, LoginResponse } from '../services/api'

const LoginPage = () => {
  const navigate = useNavigate()
  const [employeeId, setEmployeeId] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const departments = ['IT', 'Accounting', 'Marketing', 'All']
  const roles = ['Employee', 'HR/Manager']

  useEffect(() => {
    if (!error) return
    const timeout = setTimeout(() => setError(''), 3000)
    return () => clearTimeout(timeout)
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!employeeId.trim()) {
      setError('Please enter your Employee ID')
      setLoading(false)
      return
    }

    if (!department) {
      setError('Please select a department')
      setLoading(false)
      return
    }

    if (!role) {
      setError('Please select a role')
      setLoading(false)
      return
    }

    let loginResponse: LoginResponse
    try {
      loginResponse = await authAPI.login({
        employee_id: employeeId.trim(),
        department,
        role,
      })
    } catch (err) {
      const anyErr = err as any
      const detail = anyErr?.response?.data?.detail

      if (detail === 'Invalid credentials') {
        setError('Invalid credentials')
      } else if (detail === 'Employee ID must be alphanumeric') {
        setError('Employee ID must be alphanumeric (letters and numbers only)')
      } else {
        setError('Login failed. Please try again.')
      }

      setLoading(false)
      return
    }

    localStorage.setItem('employee_id', employeeId.trim())
    localStorage.setItem('department', department)
    localStorage.setItem('role', role)
    localStorage.setItem('consent_given', role === 'Employee' && !loginResponse.needs_consent ? 'true' : 'false')

    if (role === 'Employee') {
      if (loginResponse.needs_consent) {
        navigate('/employee-consent')
      } else {
        navigate('/dashboard')
      }
    } else {
      navigate('/admin')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_70%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center space-x-2 text-gray-600 hover:text-gray-900 smooth-transition group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 smooth-transition" />
          <span className="font-medium">Back to Home</span>
        </button>

        <div className="glass-effect rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
              <LogIn className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to track your wellness</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="employeeId" className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Employee ID
              </label>
              <input
                id="employeeId"
                type="text"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value)
                  setError('')
                }}
                placeholder="Enter your Employee ID"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none smooth-transition bg-white/50 backdrop-blur-sm"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">Use letters and numbers only (alphanumeric)</p>
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-semibold text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Department
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value)
                  setError('')
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none smooth-transition bg-white/50 backdrop-blur-sm appearance-none cursor-pointer"
                disabled={loading}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value)
                  setError('')
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none smooth-transition bg-white/50 backdrop-blur-sm appearance-none cursor-pointer"
                disabled={loading}
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl smooth-transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <LogIn className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our privacy policy and terms of service
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center text-sm text-gray-600"
        >
          <p>Need help? Contact your administrator</p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default LoginPage

