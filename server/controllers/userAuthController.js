const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodeMailer = require("nodemailer");
const User = require("../models/userModel");
const twilio = require("twilio");
const BlacklistedToken = require("../models/BlacklistedToken");
const ConnectionFilter = require("../models/connectionFilterModel");
const FriendRequest = require("../models/friendRequestSchema");
const Postcreate = require("../models/PostModel");
const cloudinary = require("cloudinary")
const mongoose = require("mongoose");
const Moment = require("../models/momentSchema")

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
            profilePic: file ? result.secure_url : `https://api.dicebear.com/5.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
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
        const { email, intrest, hashtag, tag, location } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Please enter an email",
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

        let connection = await ConnectionFilter.findOne({ userId });

        if (!connection) {
            // Create a new connection filter
            connection = new ConnectionFilter({
                userId,
                intrestedFiled: intrest ? [{ intrested: intrest }] : [],
                hashTagFiled: (hashtag && tag) ? [{ hashTag: hashtag, tag }] : [],
                locationFiled: location ? [{ location }] : [],
            });
        } else {
            // Update existing filter
            if (intrest) connection.intrestedFiled.push({ intrested: intrest });
            if (hashtag && tag) connection.hashTagFiled.push({ hashTag: hashtag, tag });
            if (location) connection.locationFiled.push({ location });
        }

        await connection.save();

        return res.status(200).json({
            success: true,
            message: "Connection filter saved successfully",
            connection,
        });

    } catch (error) {
        console.error("Error in connectionFilter:", error);
        return res.status(500).json({
            success: false,
            message: "Server error in connection filter controller",
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


        if (user.otp !== otp || Date.now() > user.otpExpires) {
            return res.status(400).json({ message: "Invalid or expired OTP." });
        }


        user.status = 'approved';
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();


        const mainUser = await User.findById(requesterId);

        mainUser.linkRequests.push({ requesterId: userId });

        await mainUser.save();

        res.status(200).json({ message: "Account successfully linked.", mainUser });

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
        const { password } = req.body;
        // if(user.password === )
        const isMatch = bcrypt.compare(user.password, password);

        if (!isMatch) {
            return re.status(400).json({
                sucess: false,
                message: "user Password and input password is not match"
            })
        }

        return res.status(200).json({ message: "User logged out successfully." });

    } catch (err) {
        console.error("Logout Error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};


exports.getMatchedIntrested = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }


        const userFilter = await ConnectionFilter.findOne({ userId: user._id });
        if (!userFilter) {
            return res.status(400).json({
                success: false,
                message: "User's interest filter not found",
            });
        }

        const userInterestedFields = userFilter.intrestedFiled.filter(field => field.intrested).map(field => field.intrested);

        if (userInterestedFields.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No interests found for this user",
                matchedUsers: [],
            });
        }

        const matchedFilters = await ConnectionFilter.find({
            userId: { $ne: user._id },
            "intrestedFiled.intrested": { $in: userInterestedFields },
        }).populate("userId"); // Populate full user details

        return res.status(200).json({
            success: true,
            userInterestedFields,
            matchedUsers: matchedFilters,
        });

    } catch (error) {
        console.error("Error in getMatchedIntrested:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error in getMatchedIntrested",
        });
    }
};



exports.getHashTagContent = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found",
            });
        }

        const userFilter = await ConnectionFilter.findOne({ userId: user._id });
        if (!userFilter) {
            return res.status(400).json({
                success: false,
                message: "User's hashtag filter not found",
            });
        }

        const userHashTags = userFilter.hashTagFiled
            .filter(field => field.hashTag)
            .map(field => field.hashTag);

        if (userHashTags.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No hashtags found for this user",
                tags: [],
            });
        }

        const matchedFilters = await ConnectionFilter.find({
            userId: { $ne: user._id },
            "hashTagFiled.hashTag": { $in: userHashTags },
        });

        const matchedTags = matchedFilters.flatMap(filter =>
            filter.hashTagFiled
                .filter(field => userHashTags.includes(field.hashTag))
                .map(field => field.tag)
        );

        const uniqueTags = [...new Set(matchedTags)];

        return res.status(200).json({
            success: true,
            matchedTags: uniqueTags,
        });

    } catch (error) {
        console.error("Error in getHashTagContent:", error);
        return res.status(500).json({
            success: false,
            message: "Server error in getHashTagContent",
        });
    }
};




exports.getAllowLocation = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const userFilter = await ConnectionFilter.findOne({ userId: user._id });
        if (!userFilter) {
            return res.status(400).json({
                success: false,
                message: "User's Location filter not found",
            });
        }

        const userLocation = userFilter.locationFiled.filter(field => field.location).map(field => field.location);


        const matchedFilters = await ConnectionFilter.find({
            userId: { $ne: user._id },
            "locationFiled.location": { $in: userLocation },
        }).populate("userId")


        return res.status(200).json({
            sucess: true,
            matchedFilters,
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            sucess: false,
            message: "Error in getAllowLocations"
        })
    }
}



exports.sendFriendRequest = async (req, res) => {
    try {
        const user = req.user.userId

        const { reciverId } = req.params;

        if (!reciverId) {
            return res.status(400).json({
                sucess: false,
                message: "Please Provid InviteUserId"
            })
        }

        const isExistingRequest = await FriendRequest.findOne({
            sender: user,
            receiver: reciverId,
            status: "pending"
        })

        if (isExistingRequest) {
            return res.status(400).json({
                sucess: false,
                message: "Friend Request Already Send"
            })
        }

        const request = await FriendRequest.create({
            sender: user,
            receiver: reciverId
        });

        const receiverSocketId = global.onlineUsers.get(reciverId.toString());

        if (receiverSocketId) {
            global.io.to(receiverSocketId).emit("Receive_friend_request", {
                senderId: user,
                requestId: request._id
            })
        }

        return res.status(200).json({
            sucess: true,
            message: "Friend request sent"
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            sucess: false,
            message: "Error in inviteAFriend Route"
        })
    }
}


exports.acceptFriendRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const user = req.user.userId;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: "Please provide requestId"
            });
        }

        const request = await FriendRequest.findOne({ sender: requestId });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Friend request not found"
            });
        }

        request.status = "accepted";
        await request.save();

        await User.findByIdAndUpdate(user, {
            $addToSet: { userAllFriends: request.sender }
        });

        await User.findByIdAndUpdate(request.sender, {
            $addToSet: { userAllFriends: user }
        });


        const senderSocketId = global.onlineUsers.get(request.sender.toString());

        if (senderSocketId) {
            global.io.to(senderSocketId).emit("friend_request_accepted", {
                friendId: user,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Friend request accepted"
        });

    } catch (error) {
        console.error("Error in acceptFriendRequest:", error);
        return res.status(500).json({
            success: false,
            message: "Error in acceptRequest controller"
        });
    }
}



exports.createPost = async (req, res) => {
    try {
        const { description, visibility } = req.body;  // Fixed spelling
        const userId = req.user.userId;
        const image = req.file?.path;

        // Validate required fields
        if (!description || !visibility) {
            return res.status(400).json({
                success: false,
                message: "Description and visibility are required.",
            });
        }

        if (!['public', 'private'].includes(visibility)) {
            return res.status(400).json({
                success: false,
                message: "Visibility must be either 'public' or 'private'.",
            });
        }

        let imageUrl = null;

        // Upload image if present
        if (image) {
            const result = await cloudinary.uploader.upload(image, {
                folder: "profile_pics", // more appropriate than "profile_pics"
            });
            imageUrl = result.secure_url;
        }

        // Create post
        const newPost = await Postcreate.create({
            userId,
            image: imageUrl,
            description,
            visibility,
        });

        // Update coins
        const user = await User.findById(userId);
        user.coinWallet.tedGold += 1;
        user.coinWallet.tedSilver += 1;
        user.coinWallet.tedBronze += 1;

        const { tedGold, tedSilver, tedBronze } = user.coinWallet;
        const totalCoin = Math.min(
            Math.floor(tedGold / 75),
            Math.floor(tedSilver / 50),
            Math.floor(tedBronze / 25)
        );

        user.coinWallet.tedGold -= totalCoin * 75;
        user.coinWallet.tedSilver -= totalCoin * 50;
        user.coinWallet.tedBronze -= totalCoin * 25;
        user.coinWallet.totalTedCoin += totalCoin;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Post created and coins awarded successfully",
            postUrl: newPost.image,
            visibility: newPost.visibility,
            coins: {
                tedGold: user.coinWallet.tedGold,
                tedSilver: user.coinWallet.tedSilver,
                tedBronze: user.coinWallet.tedBronze,
                totalTedCoin: user.coinWallet.totalTedCoin,
            },
        });
    } catch (error) {
        console.error("Error in createPost:", error);
        return res.status(500).json({
            success: false,
            message: "Error occurred in createPost",
        });
    }
};



exports.generateAndTrackShare = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.userId;

        const post = await Postcreate.findById(postId).populate("userId"); // assuming post has a userId (post owner)
        if (!post || post.visibility !== 'public') {
            return res.status(404).json({
                success: false,
                message: "Post not found or not public",
            });
        }

        // Check if already shared
        if (post.shares.includes(userId)) {
            const postUrl = `https://yourfrontenddomain.com/posts/${postId}`;
            const encodedUrl = encodeURIComponent(postUrl);
            return res.status(200).json({
                success: true,
                message: "Already shared",
                alreadyShared: true,
                shareLinks: {
                    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=Check%20this%20out!`,
                    whatsapp: `https://api.whatsapp.com/send?text=${encodedUrl}`,
                    linkedin: `https://www.linkedin.com/shareArticle?url=${encodedUrl}&title=Awesome%20Post`,
                    telegram: `https://t.me/share/url?url=${encodedUrl}`,
                    email: `mailto:?subject=Check%20this%20post&body=${encodedUrl}`,
                    copyLink: postUrl
                }
            });
        }

        // Update Post share
        post.shares.push(userId);
        post.shareCount += 1;
        await post.save();

        // Update sharing user (who shared the post)
        const user = await User.findById(userId);
        user.coinWallet.tedGold += 1;
        user.coinWallet.tedSilver += 1;
        user.coinWallet.tedBronze += 1;

        // Reward the original post owner
        const postOwner = post.userId;
        const { tedGold, tedSilver, tedBronze } = postOwner.coinWallet;

        const totalTedCoin = Math.floor(
            tedGold / 75 + tedSilver / 50 + tedBronze / 25
        );

        postOwner.coinWallet.totalTedCoin = totalTedCoin;
        await postOwner.save();

        // Convert coins for current user who shared
        const tg = user.coinWallet.tedGold;
        const ts = user.coinWallet.tedSilver;
        const tb = user.coinWallet.tedBronze;

        const totalCoin = Math.min(
            Math.floor(tg / 75),
            Math.floor(ts / 50),
            Math.floor(tb / 25)
        );

        user.coinWallet.tedGold -= totalCoin * 75;
        user.coinWallet.tedSilver -= totalCoin * 50;
        user.coinWallet.tedBronze -= totalCoin * 25;
        user.coinWallet.totalTedCoin += totalCoin;

        await user.save();

        const postUrl = `https://yourfrontenddomain.com/posts/${postId}`;
        const encodedUrl = encodeURIComponent(postUrl);

        return res.status(200).json({
            success: true,
            message: "Post shared successfully, coins awarded",
            shareLinks: {
                facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=Check%20this%20out!`,
                whatsapp: `https://api.whatsapp.com/send?text=${encodedUrl}`,
                linkedin: `https://www.linkedin.com/shareArticle?url=${encodedUrl}&title=Awesome%20Post`,
                telegram: `https://t.me/share/url?url=${encodedUrl}`,
                email: `mailto:?subject=Check%20this%20post&body=${encodedUrl}`,
                copyLink: postUrl
            },
            coins: {
                tedGold: user.coinWallet.tedGold,
                tedSilver: user.coinWallet.tedSilver,
                tedBronze: user.coinWallet.tedBronze,
                totalTedCoin: user.coinWallet.totalTedCoin
            }
        });

    } catch (error) {
        console.error("Error in generateAndTrackShare:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while sharing the post"
        });
    }
};





exports.giveTedBlackCoinToPost = async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { postId } = req.params;

        console.log("Received postId:", postId);


        const post = await Postcreate.findOne({ _id: postId });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found",
            });
        }



        const giver = await User.findById(currentUserId);
        const receiver = await User.findById(post.userId);

        if (!giver || !receiver) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (
            giver.coinWallet.tedGold < 1 ||
            giver.coinWallet.tedSilver < 2 ||
            giver.coinWallet.tedBronze < 3
        ) {
            return res.status(400).json({
                success: false,
                message: "Insufficient coins to give TedBlack coin",
            });
        }

        giver.coinWallet.tedGold -= 1;
        giver.coinWallet.tedSilver -= 2;
        giver.coinWallet.tedBronze -= 3;

        giver.coinWallet.tedBlack += 1;


        const calculateTotalTedCoin = (wallet) => {
            return Math.floor(
                wallet.tedGold / 75 +
                wallet.tedSilver / 50 +
                wallet.tedBronze / 25
            );
        };

        giver.coinWallet.totalTedCoin = calculateTotalTedCoin(giver.coinWallet);
        receiver.coinWallet.totalTedCoin = calculateTotalTedCoin(receiver.coinWallet);

        await giver.save();
        await receiver.save();

        return res.status(200).json({
            success: true,
            message: "TedBlack coin successfully given to post owner",
            giverWallet: giver.coinWallet,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error while processing TedBlack coin reward",
        });
    }
};




exports.report = async (req, res) => {
    try {
        const currentUserId = req.user.userId; // The user who is giving the TedBlack coin
        const { postId } = req.params;


        const post = await Postcreate.findOne({ _id: postId });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found",
            });
        }

        const giver = await User.findById(currentUserId);
        const receiver = await User.findById(post.userId);

        if (!giver || !receiver) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (
            giver.coinWallet.tedGold < 1 ||
            giver.coinWallet.tedSilver < 2 ||
            giver.coinWallet.tedBronze < 3
        ) {
            return res.status(400).json({
                success: false,
                message: "Insufficient coins to give TedBlack coin",
            });
        }

        giver.coinWallet.tedGold -= 1;
        giver.coinWallet.tedSilver -= 1;
        giver.coinWallet.tedBronze -= 1;

        giver.coinWallet.tedBlack += 1;

        const calculateTotalTedCoin = (wallet) => {
            return Math.floor(
                wallet.tedGold / 75 +
                wallet.tedSilver / 50 +
                wallet.tedBronze / 25
            );
        };

        giver.coinWallet.totalTedCoin = calculateTotalTedCoin(giver.coinWallet);
        receiver.coinWallet.totalTedCoin = calculateTotalTedCoin(receiver.coinWallet);

        await giver.save();
        await receiver.save();

        return res.status(200).json({
            success: true,
            message: "reporte the post",
            giverWallet: giver.coinWallet,
        });

    } catch (error) {
        console.log("error");
        return res.status(500).json({
            success: false,
            message: "Server error while processing report",
        })
    }
}





exports.createMoment = async (req, res) => {
    try {
        const { descripition } = req.body;
        const userId = req.user.userId;
        const image = req.file?.path;

        if (!image || !descripition) {
            return res.status(400).json({
                success: false,
                message: "Image and description are required",
            });
        }

        const result = await cloudinary.uploader.upload(image, {
            folder: "profile_pics",
        });

        const newMoment = await Moment.create({
            userId,
            image: result.secure_url,
            descripition,
        });

        return res.status(201).json({
            success: true,
            message: "Moment created successfully and will expire in 24 hours",
            moment: newMoment
        });
    } catch (error) {
        console.error("Error in createMoment:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while creating moment",
        });
    }
};
