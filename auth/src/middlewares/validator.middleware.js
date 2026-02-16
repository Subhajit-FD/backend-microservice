const {body, validationResult} = require("express-validator");

const responseWithValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

const registerUserValidation = [
    body("username").notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Invalid email format"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("fullname.firstname").notEmpty().withMessage("First name is required"),
    body("fullname.lastname").notEmpty().withMessage("Last name is required"),
    body("role").optional().isIn(["user", "seller"]).withMessage("Invalid role"),
    responseWithValidationErrors
]

const loginUserValidation = [
    body("email").isEmail().withMessage("Invalid username or email").optional(),
    body("username").isString().optional().notEmpty().withMessage("Invalid username or email"),
    body("password").notEmpty().withMessage("Password is required"),
    (req, res, next) => {
        if (!req.body.email && !req.body.username) {
            return res.status(400).json({ message: "Either email or username is required" });
        }
    responseWithValidationErrors(req, res, next);
    }
]

const addUserAddressValidation = [
    body("street").notEmpty().withMessage("Street is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("state").notEmpty().withMessage("State is required"),
    body("pincode").notEmpty().matches(/^[1-9]{1}[0-9]{5}$/).withMessage("Pincode is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("isDefault").isBoolean().optional().withMessage("Is default is required"),
    responseWithValidationErrors
]

module.exports = {
    registerUserValidation,
    loginUserValidation,
    addUserAddressValidation
}