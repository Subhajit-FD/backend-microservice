const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../db/redis");

const register = async (req,res) =>{
    const {username,email,password,fullname:{firstName,lastName}} = req.body;

    const isUserExist = await userModel.findOne({ $or: [{ email }, { username }] });

    if(isUserExist){
        return res.status(400).json({message:"User already exists"});
    }
    const hashedPassword = await bcrypt.hash(password,10);

    const newUser = await userModel.create({
        username,
        email,
        password:hashedPassword,
        fullname:{firstName,lastName}
    });

    const token = jwt.sign({id:newUser._id, role:newUser.role, fullName:newUser.fullname, username:newUser.username}, process.env.JWT_SECRET, {expiresIn:"1d"});

    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(201).json({message:"User registered successfully", user: newUser});
}

const login = async (req,res) =>{
    const {username,email,password} = req.body;

    const user = await userModel.findOne({ $or: [{ email }, { username }] });

    if(!user){
        return res.status(400).json({message:"Invalid credentials"});
    }
    const isPasswordValid = await bcrypt.compare(password,user.password);

    if(!isPasswordValid){
        return res.status(400).json({message:"Invalid credentials"});
    }
    const token = jwt.sign({id:user._id, role:user.role, fullName:user.fullname, username:user.username}, process.env.JWT_SECRET, {expiresIn:"1d"});

    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(200).json({message:"Login successful", user: user});
}

const getCurrentUser = async (req,res) =>{
    res.status(200).json({user:req.user, message:"User details retrieved successfully"});
}

const logout = async (req,res) =>{
    const token = req.cookies.token;

    if (!token) {
        return res.status(400).json({ message: "No token provided." });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await redis.setex(`blacklist_${decoded}`,"true",24 * 60 * 60);
        res.clearCookie("token",{
            httpOnly: true,
            secure: true,
            sameSite: "strict"
        });
        return res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        return res.status(400).json({ message: "Invalid token." });
    }
}

const getUserAddresses = async (req,res)=>{
    const id = req.user.id
    const user = await userModel.findById(id);

    if(!user){
        return res.status(404).json({message: "user not found"})
    }

    return res.status(200).json({
        message: "user addresses retrived sucessfully",
        addresses:user.addresses
    });
}

const addUserAddress = async (req,res) =>{
    const id = req.user.id
    const {street, city, state, pincode, isDefault} = req.body;
    const user = await userModel.findOneAndUpdate({_id:id},{
        $push:{
            address:{street, city, state, pincode, isDefault}
        }
    },{new:true});

    if(!user){
        return res.status(404).json({message: "user not found"})
    }

    res.status(201).json({
        message: "Address added successfully",
        addresses:user.addresses[user.addresses.length - 1]
    });
}

const deleteUserAddress = async (req,res) =>{
    const id = req.user.id
    const addressId = req.params.addressId;

    const isAddressExist = await userModel.findOne({_id:id, "address._id":addressId});

    if(!isAddressExist){
        return res.status(404).json({message: "Address not found"})
    }

    const user = await userModel.findOneAndUpdate({_id:id},{
        $pull:{
            address:{_id:addressId}
        }
    },{new:true});

    if(!user){
        return res.status(404).json({message: "user not found"})
    }

    res.status(200).json({
        message: "Address deleted successfully",
        addresses:user.addresses
    });

}

module.exports = {
    register,
    login,
    getCurrentUser,
    logout,
    getUserAddresses,
    addUserAddress,
    deleteUserAddress
}