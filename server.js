require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// Basic middlewares
app.use(cors());
app.use(express.json());

// routes
const authRoutes = require('./routes/auth');
const parcelRoutes = require('./routes/parcels');

app.use('/api/auth', authRoutes);
app.use('/api/parcels', parcelRoutes);

// Socket.IO logic
io.on('connection', socket => {
  console.log('Socket connected:', socket.id);

  socket.on('joinParcel', parcelId => {
    socket.join(parcelId);
  });

  socket.on('leaveParcel', parcelId => {
    socket.leave(parcelId);
  });

  // agent -> server: location update
  socket.on('parcelLocationUpdate', payload => {
    // broadcast to room
    if (!payload || !payload.parcelId) return;
    io.to(payload.parcelId).emit('parcelLocationUpdated', payload);
  });

  // status update
  socket.on('parcelStatusUpdate', payload => {
    if (!payload || !payload.parcelId) return;
    io.to(payload.parcelId).emit('parcelStatusUpdated', payload);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// expose io to routes via app (so routes can emit if needed)
app.set('io', io);

// Connect DB & start server
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('DB connection error:', err);
    process.exit(1);
  });
