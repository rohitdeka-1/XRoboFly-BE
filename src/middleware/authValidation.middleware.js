import Joi from "joi";  

export const signupValidation = (req, res, next) => {
    const schema = Joi.object({  
        name: Joi.string().max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(4).required(),
        userPhone: Joi.string().min(10).max(15).pattern(/^[0-9+\s()-]+$/).required()
    });
    
    const { error } = schema.validate(req.body);  
    if (error) {
       
        return res.status(400).json({
            message: "Bad Request",
            error: error.details[0].message 
        });
    }
    next();
};

export const loginValidation = (req, res, next) => {
    const schema = Joi.object({ 
        identity: Joi.string().required(),
        password: Joi.string().min(4).required()
    });

    const { error } = schema.validate(req.body); 
    if (error) {
        return res.status(400).json({
            message: "Bad Request",
            error: error.details[0].message  
        });
    }

    next();
};

 

 
