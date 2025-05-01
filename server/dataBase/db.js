const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
console.log(process.env.MONGO_URI)
exports.dbConnect = async () =>{
    
    mongoose.connect(process.env.MONGO_URI).then(() => {
        console.log("MongoDB Connected");
    })
    .catch((err) => {
        console.log("MongoDB Connection Error: ", err);
    });
}