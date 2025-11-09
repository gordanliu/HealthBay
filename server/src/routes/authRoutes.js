import express from "express";
import { handleLogin, handleLogout, handleSignup, handleRefreshToken} from "../controllers/authController.js";

const authRouter = express.Router();

// --------------------- SIGNUP ---------------------
authRouter.post("/signup", handleSignup);

// --------------------- LOGIN ---------------------
authRouter.post("/login", handleLogin);

// --------------------- LOGOUT ---------------------
authRouter.post("/logout", handleLogout);

// --------------------- REFRESH ---------------------
authRouter.post("/refresh", handleRefreshToken);

export default authRouter;
