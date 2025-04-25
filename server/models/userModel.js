const e = require('express');
const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    gender: {
        type: String,
        required: true,
        enum: ['male', 'female', 'other']
    },
    dateBirth: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    userName: {
        type: String,
        // required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phoneNo: {
        type: String,
        required: true,
        match: [/^(\+91)?\d{10}$/, 'Phone number must be 10 digits with optional +91']
    },
    password: {
        type: String,
        // required: true,
        minlength: [6, 'Password must be at least 6 characters']
    },
    profilePic: {
        type: String,
        required: true
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
        default: Date.now,
    },
    theme: {
        type: String,
        default: "light",
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    linkRequests: [{
        requesterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        otp: String,
        otpExpires: Date
    }],
    userAllFriends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    coinWallet: {
        tedGold: {
            type: Number,
            default: 0
        },
        tedSilver: {
            type: Number,
            default: 0
        },
        tedBronze: {
            type: Number,
            default: 0
        },
        tedBlack: {
            type: Number,
            default: 0
        },
        totalTedCoin:{
            type:Number,
            default:0,
        },
    },
})


module.exports = mongoose.model('User', userSchema);