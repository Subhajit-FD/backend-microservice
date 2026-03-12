const express = require('express');
const { registerValidationRules, loginValidationRules, addressValidationRules } = require('../middlewares/validation.middleware');
const { register, login, getCurrentUser, logout, getUserAddresses, addUserAddress, deleteUserAddress } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/authentication.middleware');
const router = express.Router();

router.post('/register',registerValidationRules,register);
router.post('/login',loginValidationRules,login);
router.get('/me',authenticateToken,getCurrentUser);
router.get('/logout',logout);
router.get('/users/me/addresses',authenticateToken,getUserAddresses);
router.post('/users/me/addresses',authenticateToken,addressValidationRules,addUserAddress);
router.delete('/users/me/addresses/:addressId',authenticateToken,deleteUserAddress);

module.exports = router;