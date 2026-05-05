import express from "express";
import cors from "cors";
import router from "./routes/index.js";

const app = express();

const corsOptions = {
  origin: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err?.message ?? err);
  res.status(500).json({ error: err?.message ?? "Internal server error" });
});

export default app;
