import express from "express";
import { handleGetInjuryHistory } from "../controllers/userInjuryHistoryController.js";

const userInjuryHistoryRouter = express.Router();

userInjuryHistoryRouter.get("/:userId", handleGetInjuryHistory);


export default userInjuryHistoryRouter;