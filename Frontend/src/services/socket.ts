import { io, Socket } from 'socket.io-client'

const SOCKET_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8000'

let socket: Socket | null = null

export const connectSocket = (): Socket => {
  if (!socket || !socket.connected) {
    console.log('Connecting to Socket.IO server at:', SOCKET_URL)
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
    })

    // Add connection event listeners for debugging
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected successfully')
    })

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error)
    })

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket.IO disconnected:', reason)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts')
    })

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Socket.IO reconnection attempt', attemptNumber)
    })

    socket.on('reconnect_error', (error) => {
      console.error('❌ Socket.IO reconnection error:', error)
    })

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket.IO reconnection failed')
    })
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting Socket.IO')
    socket.disconnect()
    socket = null
  }
}

export const getSocket = (): Socket | null => {
  return socket
}

export const isSocketConnected = (): boolean => {
  return socket !== null && socket.connected
}

