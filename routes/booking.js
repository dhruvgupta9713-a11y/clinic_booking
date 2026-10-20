const express = require("express");
const router = express.Router();
const pool = require("../db");

// Cancel a booking
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const bookingId = Number(req.params.id);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'confirmed'
       RETURNING slot_id`,
      [bookingId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Active booking not found",
      });
    }

    await client.query(
      `UPDATE slots
       SET is_booked = FALSE
       WHERE id = $1`,
      [result.rows[0].slot_id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error(error);
    return res.status(500).json({
      message: "Unable to cancel booking",
    });
  } finally {
    client.release();
  }
});

module.exports = router;