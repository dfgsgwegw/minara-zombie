import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import tournamentRouter from "./tournament.js";
import scoresRouter from "./scores.js";
import adminRouter from "./admin.js";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tournamentRouter);
router.use(scoresRouter);
router.use(adminRouter);

export default router;
