const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map(); // userId -> Set(socketId)

function addOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeOnline(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

function getOnlineIds() {
  return [...onlineUsers.keys()];
}

function initSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = String(socket.userId);
    socket.join(userId);
    addOnline(userId, socket.id);
    io.emit("onlineUsers", getOnlineIds());

    socket.on("sendMessage", async (payload, callback) => {
      try {
        const receiverId = String(payload?.receiverId || "");
        const messageText = String(payload?.text || "").trim();

        if (!mongoose.isValidObjectId(receiverId) || messageText.length === 0 || messageText.length > 4000) {
          return callback?.({ error: "Invalid recipient or message" });
        }
        if (receiverId === userId) return callback?.({ error: "You cannot message yourself" });

        const receiverExists = await User.exists({ _id: receiverId });
        if (!receiverExists) return callback?.({ error: "Recipient not found" });

        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          text: messageText
        });

        const populated = await Message.findById(message._id)
          .populate("sender", "username profilePic")
          .populate("receiver", "username profilePic");

        io.to(receiverId).emit("newMessage", populated);
        socket.emit("newMessage", populated);
        callback?.({ success: true, messageId: String(message._id) });
      } catch (error) {
        callback?.({ error: "Message could not be sent" });
      }
    });

    socket.on("disconnect", () => {
      const wentOffline = removeOnline(userId, socket.id);
      if (wentOffline) io.emit("onlineUsers", getOnlineIds());
    });
  });
}

module.exports = initSocket;
