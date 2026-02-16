const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../db/redis");

const registerUser = async (req, res) => {
  const {
    username,
    email,
    password,
    fullname: { firstname, lastname },
    role
  } = req.body;
  const existingUser = await userModel.findOne({
    $or: [{ email }, { username }],
  });
  if (existingUser) {
    return res
      .status(409)
      .json({ message: "Username or email already exists" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      fullname: {
        firstname,
        lastname,
      },
      role
    });
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: true,
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const loginUser = async (req, res) => {
  const {username, email, password } = req.body;
  try {
    const user = await userModel.findOne({ $or: [{ email }, { username }] }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: true,
    });

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const getCurrentUser = async (req, res) => {
  return res.status(200).json({ 
    message: "Current user fetched successfully",
    user: req.user });
}

const logoutUser = async (req, res) => {

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    await redis.set(`blacklist:${token}`, "true", "EX", 60 * 60 * 24);
    res.clearCookie("token",{httpOnly:true,secure:true});
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}

const getUserAddresses = async (req, res) => {
  const id = req.user.id;
  const user = await userModel.findById(id).select("addresses").lean();
  if(!user){
    return res.status(404).json({ message: "User not found" });
  }
  try {
    const addresses = user.addresses;
    return res.status(200).json({ addresses });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}

const addUserAddress = async (req, res) => {
  const id = req.user.id;
  const { street, city, state, pincode, country, isDefault } = req.body;
  const user = await userModel.findOneAndUpdate(
    { _id: id },
    { $push: { addresses: { street, city, state, pincode, country, isDefault } } },
    { new: true }
  );
  if(!user){
    return res.status(404).json({ message: "User not found" });
  }
  try {
    return res.status(201).json({ message: "Address added successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}

const deleteUserAddress = async (req, res) => {
  const id = req.user.id;
  const { addressId } = req.params;

  const isAddressExist = await userModel.findOne({
    _id: id,
    addresses: { $elemMatch: { _id: addressId } }
  });

  if(!isAddressExist){
    return res.status(404).json({ message: "Address not found" });
  }

  const user = await userModel.findOneAndUpdate(
    { _id: id },
    { $pull: { addresses: { _id: addressId } } },
    { new: true }
  );
  if(!user){
    return res.status(404).json({ message: "User not found" });
  }
  try {
    return res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  getUserAddresses,
  addUserAddress,
  deleteUserAddress
};
