const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodeMailer = require("nodemailer");
const User = require("../models/userModel");
const twilio = require("twilio");
const BlacklistedToken = require("../models/BlacklistedToken");


const transPorter = nodeMailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});


const twilioClient = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN)


const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();


exports.register = async (req, res) => {
    try {
        const { gender, theme, dateBirth, fullName, email, phoneNo } = req.body;

        if (!gender || !theme || !dateBirth || !fullName || !email || !phoneNo) {
            return res.status(400).json({
                sucess: false,
                message: "All fields are required"
            });
        }



        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                sucess: false,
                message: "User already exists"
            });
        }

        console.log(req.file?.filename)
        
        const otp = generateOtp();
        const otpExpires = Date.now() + 10 * 60 * 200;

        // const {path} = req.file

        user = new User({
            gender,
            theme,
            profilePic: req.file ? req.file.filename : `https://api.dicebear.com/5.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
            fullName,
            dateBirth,
            email,
            phoneNo,
            otp,
            otpExpires: otpExpires,
        });

        await user.save();

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: "Verify your email - OTP",
            text: `Your OTP for email verification is: ${otp}`,
        };

        await transPorter.sendMail(mailOptions);

        await twilioClient.messages.create({
            body: `Your OTP for email verification is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNo,
        });
        console.log(req.file)

        return res.status(200).json({
            sucess: true,
            message: "OTP sent to your email and phone number",
        })
        

    } catch (error) {
        console.error("Error in register:", error);
        res.status(500).json({
            sucess: false,
            message: "error in register User controller"
        });
    }
}



exports.otpVerify = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                sucess: false,
                message: 'Please provide all details'
            })
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                sucess: false,
                message: "User Not Found"
            })
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({
                sucess: false,
                message: "Invalid Or  Expired OTP"
            })
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;

        await user.save()

        return res.status(200).json({
            sucess: true,
            message: "OTP verified. Account Activated",
            user,
        })
    } catch (error) {
        console.log("error in Otpverify ", error.message)
        return res.status(500).json({
            sucess: false,
            message: "Error in verify otp controller"
        })
    }
}



exports.ProfileCreation = async (req, res) => {
    try {
        const { email, password, userName } = req.body;

        if (!userName || !email || !password) {
            return res.status(400).json({
                sucess: false,
                message: 'Please provide all details'
            })
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                sucess: false,
                message: "User Not Found"
            })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt)

        user.userName = userName;
        user.password = hashedPassword

        await user.save();

        return res.status(200).json({
            sucess: true,
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            sucess: false,
            message: "Error in Profile Creation controller"
        })
    }
}




exports.connectionFilter = async (req, res) => {
    try {
        const { email, intrest, hashtag, location } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Please Enter Email"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const userId = user._id;

        let connection = await ConnectionFilter.findOne({ userId });

        if (!connection) {
            // Create new connection filter
            connection = new ConnectionFilter({
                userId,
                intrestedFiled: intrest ? [{ intrested: intrest }] : [],
                hashTagFiled: hashtag ? [{ hashTag: hashtag }] : [],
                locationFiled: location ? [{ location }] : [],
            });
        } else {
            // Update existing filters by pushing new values
            if (intrest) connection.intrestedFiled.push({ intrested: intrest });
            if (hashtag) connection.hashTagFiled.push({ hashTag: hashtag });
            if (location) connection.locationFiled.push({ location });
        }

        await connection.save();

        return res.status(200).json({
            success: true,
            message: "Connection filter created successfully",
            connection
        });

    } catch (error) {
        console.error("Error in connectionFilter:", error);
        return res.status(500).json({
            success: false,
            message: "Server error in connection filter controller"
        });
    }
};




exports.login = async (req, res) => {
    try {
        const { userName, email, password } = req.body;

        if (!userName || !email || !password) {
            return res.status(400).json({
                sucess: false,
                message: "Please provide all details",
            })
        }

        let user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                sucess: "false",
                message: "User is not register"
            })
        };


        if (!user.isVerified) {
            return res.status(400).json({
                message: "Please verify your email first"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "Please Enter Correct password",
            })
        }



        const otp = generateOtp();
        const otpExpires = Date.now() + 10 * 60 * 200;



        user.otp = otp;
        user.otpExpires = otpExpires

        await user.save()

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: "User Login with - OTP",
            text: `Your OTP for Login verification is: ${otp}`,
        };

        await transPorter.sendMail(mailOptions)

        await twilioClient.messages.create({
            body: `Your OTP for Login verification is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phoneNo,
        })

        return res.status(200).json({
            sucess: true,
            message: "OTP sent to your email and phone number",
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            sucess: false,
            message: "Error in login controller"
        })
    }
}



exports.loginOtpverify = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                sucess: false,
                message: "Please provide all details"
            })
        };

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                sucess: false,
                message: "User Not Found"
            })
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({
                sucess: false,
                message: "Invalid Or  Expired OTP"
            })
        }

        const token = await jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "2d" });

        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save()

        return res.status(200).json({
            sucess: true,
            message: "Login Otp Verify ",
            user,
            token
        })


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            sucess: false,
            message: "error in loginverifyOtp controller"
        })
    }
}



exports.getConnectionFilter = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const userId = user._id;

        const getData = await ConnectionFilter.findOne({ userId });

        if (!getData) {
            return res.status(404).json({
                success: false,
                message: "No connection filter found for this user",
            });
        }

        return res.status(200).json({
            success: true,
            data: getData,
        });

    } catch (error) {
        console.error("Error in getConnectionFilter:", error);
        return res.status(500).json({
            success: false,
            message: "Server error in getConnectionFilter controller",
        });
    }
};



exports.PasswordResetRequest = async (req, res) => {
    try {
        const { email, phoneNo } = req.body;

        let user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                sucess: false,
                message: "User Not Found ! using email"
            })
        }


        const resetToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "10m" } // valid for 10 mins
        );

        const resetURL = `http://localhost:4000/api/v1/user/reset-password/${resetToken}`;


        if (email) {

            const mailOptions = {
                from: process.env.SMTP_USER,
                to: email,
                subject: "Password Reset Link",
                html: `<p>Click <a href="${resetURL}">here</a> to reset your password. This link expires in 15 minutes.</p>`
            };

            await transPorter.sendMail(mailOptions)


        } else {
            await twilioClient.messages.create({
                body: `Click Here to Reset Password is: ${resetURL}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: user.phoneNo,
            })
        }

        res.json({
            message: "Link send to Email Or Via Phone No"
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            sucess: false,
            message: "Error in PasswordResetRequest controller"
        })
    }
}



exports.resetPassword = async (req, res) => {
    try {
        const { newPassword, token } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(400).json({ message: "Invalid token or user not found" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            sucess: false,
            message: "Error in resetPassword controller"
        })
    }
}





exports.addAccount = async (req, res) => {
    try {
        const { userName, email, phoneNo, password } = req.body;
        const mainUserId = req.user.userId; // from JWT middleware
        const main = await User.findById(mainUserId)

        
        const secondaryAccount = await User.findOne({ $or: [{ email }, { phoneNo }] });
        if (!secondaryAccount) {
            return res.status(404).json({ message: "Secondary account not found." });
        }

       
        if (secondaryAccount._id.toString() === mainUserId) {
            return res.status(400).json({ message: "You cannot link your own account." });
        }

      
        const isMatch = await bcrypt.compare(password, secondaryAccount.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password for the secondary account." });
        }

        const existingRequest = secondaryAccount.linkRequests.find(
            (r) => r.requesterId.toString() === mainUserId && r.status === 'pending'
        );
        if (existingRequest) {
            return res.status(400).json({ message: "A link request has already been sent." });
        }


        // Step 6: Generate approve/reject URLs
        const approveLink = `http://localhost:4000/api/v1/user/account-link/approve/${secondaryAccount._id}/${mainUserId}`;
        const rejectLink = `http://localhost:4000/api/v1/user/account-link/reject/${secondaryAccount._id}/${mainUserId}`;

        const emailContent = `
      <p><strong>${req.user.fullName}</strong> is trying to link your account.</p>
      <p>Do you want to allow this?</p>
      <a href="${approveLink}" style="padding:10px 20px;background-color:green;color:white;text-decoration:none;margin-right:10px;">Allow</a>
      <a href="${rejectLink}" style="padding:10px 20px;background-color:red;color:white;text-decoration:none;">Reject</a>
    `;

        const smsContent = `Link Request: ${req.user.fullName} wants to link your account. Approve: ${approveLink} | Reject: ${rejectLink}`;

        // Step 7: Send Email
        await transPorter.sendMail({
            from: process.env.SMTP_USER,
            to: secondaryAccount.email,
            subject: "New Account Linking Request",
            html: emailContent
        });

        // Step 8: Send SMS
        await twilioClient.messages.create({
            body: smsContent,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: secondaryAccount.phoneNo,
        });

        // Step 9: Return response
        return res.status(200).json({
            message: "Approval email & SMS sent to secondary user.",
            secondaryAccount,
            main
        });

    } catch (error) {
        console.error("AddAccount Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error in addAccount controller"
        });
    }
};


exports.approveLinkAccount = async (req, res) => {
    try {
        const { userId, requesterId } = req.params;

        const user = await User.findById(userId);

       

        const otp = generateOtp(); 
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 mins

        user.otp = otp;
        user.otpExpires = otpExpires;

        await user.save();

        await transPorter.sendMail({
            from: process.env.SMTP_USER,
            to: user.email,
            subject: "OTP for Linking Account",
            html: `<p>Your OTP to confirm the account link: <b>${otp}</b></p>`
        });

     
        await twilioClient.messages.create({
            body: `Your OTP for linking account: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phoneNo,
        });

        return res.status(200).json({ message: "OTP sent. Please verify to complete linking." });

    } catch (error) {
        console.error("Approve Link Error:", error.message);
        return res.status(500).json({ message: "Server Error" });
    }
};



exports.finalizeLinkAccount = async (req, res) => {
    try {
        const { userId, requesterId, otp } = req.body;

        const user = await User.findById(userId);
       

        if ( user.otp !== otp || Date.now() > user.otpExpires) {
            return res.status(400).json({ message: "Invalid or expired OTP." });
        }

      
        user.status = 'approved';
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

       
        const mainUser = await User.findById(requesterId);

        mainUser.linkRequests.push({ requesterId: userId });
        
        await mainUser.save();

        res.status(200).json({ message: "Account successfully linked.",mainUser });

    } catch (err) {
        console.error("Finalize Link Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};



exports.rejectLinkAccount = async (req, res) => {
    try {
        const { userId, requesterId } = req.params;

        const user = await User.findById(userId);
        const request = user.linkRequests.find(
            (r) => r.requesterId.toString() === requesterId && r.status === 'pending'
        );

        if (!request) return res.status(404).json({ message: "No pending request found." });

        request.status = 'rejected';
        await user.save();

        res.status(200).json({ message: "Linking request rejected." });

    } catch (err) {
        console.error("Reject Link Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};





exports.logoutUser = async (req, res) => {
  try {
    const token = req.header("Authorization"); // Bearer <token>
    if (!token) return res.status(400).json({ message: "Token not provided." });

    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000); // JWT exp is in seconds

    const blacklisted = new BlacklistedToken({ token, expiresAt });
    await blacklisted.save();

    const user = await User.findById(req.user.userId);
    const {password} = req.body;
    // if(user.password === )
    const isMatch =  bcrypt.compare(user.password,password);

    if(!isMatch){
        return re.status(400).json({
            sucess:false,
            message:"user Password and input password is not match"
        })
    }

    return res.status(200).json({ message: "User logged out successfully." });

  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
