const router = require("express").Router();
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("_id username email profilePic")
      .sort({ username: 1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Could not load users" });
  }
});

module.exports = router;
