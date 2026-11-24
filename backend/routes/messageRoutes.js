const router = require("express").Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

router.get("/:userId", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const otherUser = await User.findById(req.params.userId).select("_id");
    if (!otherUser) return res.status(404).json({ message: "User not found" });

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: otherUser._id },
        { sender: otherUser._id, receiver: req.user._id }
      ]
    }).sort({ createdAt: 1 }).limit(500);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: "Could not load messages" });
  }
});

module.exports = router;
