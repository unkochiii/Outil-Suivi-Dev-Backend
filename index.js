require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const cors = require("cors");
const compteRoutes = require("./routes/user/interactive/compte");
const accountRoutes = require("./routes/admin/account/account");

const officialsAdminRoutes = require("./routes/admin/official/Official");
const officialsRoutes = require("./routes/user/visual/officials");

const pagesAdminRoutes = require("./routes/admin/page/Page");
const pagesRoutes = require("./routes/user/visual/pages");

const rapportAdminRoutes = require("./routes/admin/rapport/rapport");
const rapportRoutes = require("./routes/user/interactive/repports");

const taskAdminRoutes = require("./routes/admin/task/Task");
const taskRoutes = require("./routes/user/visual/tasks");

const toDoAdminRoutes = require("./routes/admin/toDo/TODO");
const toDoRoutes = require("./routes/user/interactive/toDo");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});
app.get("/", (req, res) => {
  res.json({ message: "Serveur Outil Suivi Dev" });
});
app.use(compteRoutes);
app.use(accountRoutes);

app.use(officialsRoutes);
app.use(officialsAdminRoutes);

app.use(pagesRoutes);
app.use(pagesAdminRoutes);

app.use(rapportRoutes);
app.use(rapportAdminRoutes);

app.use(taskRoutes);
app.use(taskAdminRoutes);

app.use(toDoRoutes);
app.use(toDoAdminRoutes);

app.all(/.*/, function (req, res) {
  res.status(404).json({ message: "Page not found" });
});

app.listen(process.env.PORT, () => {
  console.log("Server has started");
});
