import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Node backend running");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
