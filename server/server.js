const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const app = express();
const authRoutes = require("./routes/userAuthRoutes")
const PORT = process.env.PORT || 3000;

const cors = require('cors');
const { dbConnect } = require('./dataBase/db');

app.use(cors({origin:"",credentials:true}));
app.use(express.json());
app.use(express.urlencoded({extended:false}))

dbConnect()

app.use("/api/v1/user",authRoutes)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});