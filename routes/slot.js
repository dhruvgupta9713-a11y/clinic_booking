
const express = require("express");
const router = express.Router();
const pool = require("../db");

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function timeToSeconds(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    return null;
  }

  const [hours, minutes, seconds = "0"] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// 1. Create a slot
router.post("/", async (req, res) => {
  try {
    const { doctor_name, slot_date, start_time, end_time } = req.body || {};

    if (
      typeof doctor_name !== "string" ||
      !doctor_name.trim() ||
      !slot_date ||
      !start_time ||
      !end_time
    ) {
      return res.status(400).json({
        message: "doctor_name, slot_date, start_time and end_time are required",
      });
    }

    if (!isValidDate(slot_date)) {
      return res.status(400).json({
        message: "slot_date must be a valid date in YYYY-MM-DD format",
      });
    }

    const startSeconds = timeToSeconds(start_time);
    const endSeconds = timeToSeconds(end_time);

    if (startSeconds === null || endSeconds === null) {
      return res.status(400).json({
        message: "start_time and end_time must be valid times in HH:MM or HH:MM:SS format",
      });
    }

    if (endSeconds <= startSeconds) {
      return res.status(400).json({
        message: "end_time must be later than start_time",
      });
    }

    const result = await pool.query(
      `INSERT INTO slots
       (doctor_name, slot_date, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [doctor_name.trim(), slot_date, start_time, end_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 2. Get all available slots
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM slots
       WHERE is_booked = FALSE
       ORDER BY slot_date, start_time`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. Book a slot
router.post("/:id/book", async (req, res) => {
  const slotId = Number(req.params.id);

  if (!Number.isInteger(slotId) || slotId <= 0) {
    return res.status(400).json({ message: "Invalid slot ID" });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `UPDATE slots
       SET is_booked = TRUE
       WHERE id = $1 AND is_booked = FALSE
       RETURNING id`,
      [slotId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      const exists = await pool.query(
        "SELECT id FROM slots WHERE id = $1",
        [slotId]
      );

      return res.status(exists.rowCount ? 409 : 404).json({
        message: exists.rowCount
          ? "Slot is already booked"
          : "Slot not found",
      });
    }

    const booking = await client.query(
      `INSERT INTO bookings (slot_id)
       VALUES ($1)
       RETURNING *`,
      [slotId]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: "Booking successful",
      booking: booking.rows[0],
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    console.error(error);
    return res.status(500).json({
      message: "Unable to create booking",
    });
  } finally {
    if (client) client.release();
  }
});

// 4. Cancel an unbooked slot
router.delete("/:id", async (req, res) => {
  try {
    const slotId = Number(req.params.id);

    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({
        message: "Invalid slot ID",
      });
    }

    const result = await pool.query(
      `DELETE FROM slots
       WHERE id = $1 AND is_booked = FALSE
       RETURNING id`,
      [slotId]
    );

    if (result.rowCount === 0) {
      const exists = await pool.query(
        "SELECT id FROM slots WHERE id = $1",
        [slotId]
      );

      return res.status(exists.rowCount ? 409 : 404).json({
        message: exists.rowCount
          ? "Cannot cancel a booked slot"
          : "Slot not found",
      });
    }

    return res.json({
      message: "Slot cancelled successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Unable to cancel slot",
    });
  }
});

module.exports = router;
