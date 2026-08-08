import express from "express";
import cors from "cors";
import routes from "./api/routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Autonomous AI Persona API is running 🚀"
  });
});

app.use("/api", routes);

export default app;