const {body, validationResult} = require('express-validator');

const validationErrorHandler = (req,res,next) =>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array()});
    }
    next();
};

const registerValidationRules = () =>{
    return [
        body('username').notEmpty().withMessage('Username is required').isLength({min:3}).withMessage('Username must be at least 3 characters long'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({min:6}).withMessage('Password must be at least 6 characters long'),
        body('fullname.firstName').notEmpty().withMessage('First name is required').isLength({min:2}).withMessage('First name must be at least 2 characters long'),
        body('fullname.lastName').notEmpty().withMessage('Last name is required').isLength({min:2}).withMessage('Last name must be at least 2 characters long'),
        validationErrorHandler
    ];
}

const loginValidationRules = () =>{
    return [
        body('username').optional().isLength({min:3}).withMessage('Username must be at least 3 characters long'),
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('password').isLength({min:6}).withMessage('Password must be at least 6 characters long'),
        (req,res,next) =>{
            if(!req.body.username && !req.body.email){
                return res.status(400).json({message:"Either username or email is required"});
            }
        },
        validationErrorHandler
    ];
}

const addressValidationRules = () =>{
    return [
        body('street').notEmpty().withMessage('Street is required'),
        body('city').notEmpty().withMessage('City is required'),
        body('state').notEmpty().withMessage('State is required'),
        body('pincode').notEmpty().withMessage('Pincode is required').isPostalCode('IN').withMessage('Valid pincode is required'),
        validationErrorHandler
    ];
}

module.exports = {
    registerValidationRules,
    loginValidationRules,
    addressValidationRules
};