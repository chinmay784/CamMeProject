const mongoose = require("mongoose");

const connectionFilterSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    intrestedFiled: [
        {
            intrested: {
                type: String,
                required: true,
            },
        },
    ],
    hashTagFiled: [
        {
            hashTag: {
                type: String,
                required: true,
            },
            tag:{
                type: String,
                required: true,
            },
        },
    ],
    locationFiled: [
        {
            location: {
                type: String,
                required: true,
            },
        },
    ],
}, {
    timestamps: true
});

module.exports = mongoose.model("ConnectionFilter", connectionFilterSchema);
