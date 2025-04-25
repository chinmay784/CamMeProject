const express = require('express');
const {
    register,
    otpVerify,
    ProfileCreation,
    login,
    loginOtpverify,
    connectionFilter,
    getConnectionFilter,
    PasswordResetRequest,
    resetPassword,
    addAccount,
    approveLinkAccount,
    finalizeLinkAccount,
    rejectLinkAccount,
    logoutUser,
    getMatchedIntrested,
    getHashTagContent,
    getAllowLocation,
    sendFriendRequest,
    acceptFriendRequest,
    createPost
} = require('../controllers/userAuthController');
const { authMiddelWere } = require('../middelwere/authMiddelWere');
const {uploadd} = require("../middelwere/multer");
const checkBlacklist = require('../middelwere/BlackListToken');
const {upload} = require("../config/cloudinary")

const router = express.Router();


router.post('/register',uploadd.single("file"), register);
router.post("/verifyotp", otpVerify);
router.post("/profileComplite", ProfileCreation);
router.post("/login", login);
router.post("/loginOtpverify", loginOtpverify);
router.post("/connectionFilter", connectionFilter);
router.get("/getConnectionFilter", getConnectionFilter);
router.post("/forgetPassword", PasswordResetRequest);
router.post("/reset-password", resetPassword);
router.post("/addAccount",authMiddelWere,addAccount)
router.get("/account-link/approve/:userId/:requesterId", approveLinkAccount)
router.post("/account-link/verify-otp", finalizeLinkAccount)
router.post("/account-link/reject/:userId/:requesterId", rejectLinkAccount)
router.post("/logout", checkBlacklist,logoutUser);
router.get("/getMatchIntrested",authMiddelWere,getMatchedIntrested);
router.get("/getHashTagContent",authMiddelWere,getHashTagContent);
router.get("/getLocation",authMiddelWere,getAllowLocation);
router.post("/inviteAFriend/:reciverId",authMiddelWere,sendFriendRequest)
router.post("/acceptFriendRequest/:requestId",authMiddelWere,acceptFriendRequest);
router.post("/createpost",authMiddelWere,upload.single("image"),createPost);

module.exports = router;