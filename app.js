
const express = require("express");
const app = express();
const bookingRoutes = require("./routes/booking");

app.use(express.json());
app.use("/api/bookings", bookingRoutes);

// Home route
app.get("/", (req, res) => {
  res.send("Clinic Booking API is running!");
});

// Slot routes
const slotRoutes = require("./routes/slot");
app.use("/api/slots", slotRoutes);

module.exports = app;