const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    profilePic: user.profilePic || ""
  };
}

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: username.trim() }]
    });
    if (existing) return res.status(409).json({ message: "Email or username is already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    res.status(201).json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not create account" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    const valid = user && await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    res.json({ token: createToken(user._id), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not log in" });
  }
};

exports.me = (req, res) => res.json({ user: publicUser(req.user) });
