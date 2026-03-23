import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Heart, TrendingUp, Shield, Users, ArrowRight, Sparkles } from 'lucide-react'

const LandingPage = () => {
  const navigate = useNavigate()

  const features = [
    {
      icon: Heart,
      title: 'Emotion Detection',
      description: 'Advanced AI-powered emotion recognition to track your wellbeing throughout the day.',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      icon: TrendingUp,
      title: 'Real-time Analytics',
      description: 'Monitor your emotional patterns and get insights into your wellness trends.',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      icon: Shield,
      title: 'Privacy Protected',
      description: 'Your data is secure and confidential, used only for wellness improvement.',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      icon: Users,
      title: 'Team Insights',
      description: 'Help your organization understand overall team wellness and support needs.',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  }

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.1),transparent_50%)]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">Wellness Tracker</span>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 smooth-transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Get Started
          </motion.button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 lg:pt-32 pb-20">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center"
          >
            <motion.div variants={itemVariants} className="mb-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Powered Employee Wellness
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight"
            >
              <span className="gradient-text">Track Your Wellness</span>
              <br />
              <span className="text-gray-800">One Emotion at a Time</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed"
            >
              Empowering employees and organizations with real-time emotion detection
              and wellness insights. Make data-driven decisions for a healthier, happier workplace.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <button
                onClick={() => navigate('/login')}
                className="group px-8 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-semibold text-lg shadow-xl hover:shadow-2xl smooth-transition transform hover:-translate-y-1 flex items-center space-x-2"
              >
                <span>Start Tracking</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 smooth-transition" />
              </button>
              <button className="px-8 py-4 glass-effect rounded-xl font-semibold text-lg hover:bg-white/90 smooth-transition">
                Learn More
              </button>
            </motion.div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="glass-effect rounded-2xl p-6 hover:shadow-2xl smooth-transition transform hover:-translate-y-2"
                >
                  <div className={`w-14 h-14 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-7 h-7 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-24 glass-effect rounded-3xl p-8 sm:p-12"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-2">7</div>
                <div className="text-gray-600 font-medium">Emotions Tracked</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-2">24/7</div>
                <div className="text-gray-600 font-medium">Real-time Monitoring</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-2">100%</div>
                <div className="text-gray-600 font-medium">Privacy Protected</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold gradient-text mb-2">AI</div>
                <div className="text-gray-600 font-medium">Powered Analytics</div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200/50 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 Employee Wellness Tracker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

