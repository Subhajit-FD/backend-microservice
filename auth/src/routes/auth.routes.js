const express = require("express");
const router = express.Router();
const { registerUserValidation,loginUserValidation, addUserAddressValidation,deleteUserAddressValidation } = require("../middlewares/validator.middleware");
const { registerUser, loginUser, getCurrentUser, logoutUser, getUserAddresses, addUserAddress,deleteUserAddress } = require("../controllers/auth.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");

router.post("/register",registerUserValidation, registerUser);
router.post("/login", loginUserValidation, loginUser);
router.get("/me",authenticateToken,getCurrentUser)
router.get("/logout",logoutUser)

router.get("/users/me/addresses",authenticateToken,getUserAddresses)
router.post("/users/me/addresses",addUserAddressValidation,authenticateToken,addUserAddress)
router.delete("/users/me/addresses/:addressId",authenticateToken,deleteUserAddress)

module.exports = router;
