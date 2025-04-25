const mongoose = require("mongoose");

const postSchemsa = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    image: {
        type: String,
        required: true,
    },
    descripition: {
        type: String,
        required: true,
    },
    comments: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            comment: {
                type: String,
                required: true,
            },
        },
    ],
    expressions: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        },
    ],
    shareCount: {
        type: Number,
        default: 0,
    },
    shares: [ 
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],
});

module.exports = mongoose.model("Postcreate", postSchemsa);

