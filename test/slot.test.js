const assert = require("node:assert/strict");
const http = require("node:http");
const { after, before, test } = require("node:test");

const slots = [
  {
    id: 1,
    doctor_name: "Dr. Smith",
    slot_date: "2026-10-22",
    start_time: "09:00",
    end_time: "09:30",
    is_booked: false,
  },
];
const bookings = [];
let nextSlotId = 2;
let nextBookingId = 1;

const pool = {
  async query(sql, values = []) {
    if (sql.includes("INSERT INTO slots")) {
      const slot = {
        id: nextSlotId++,
        doctor_name: values[0],
        slot_date: values[1],
        start_time: values[2],
        end_time: values[3],
        is_booked: false,
      };
      slots.push(slot);
      return { rows: [slot], rowCount: 1 };
    }

    if (sql.includes("SELECT * FROM slots")) {
      const availableSlots = slots.filter((slot) => !slot.is_booked);
      return { rows: availableSlots, rowCount: availableSlots.length };
    }

    if (sql.includes("UPDATE slots") && sql.includes("SET is_booked = TRUE")) {
      const slot = slots.find((item) => item.id === values[0] && !item.is_booked);
      if (!slot) return { rows: [], rowCount: 0 };
      slot.is_booked = true;
      return { rows: [{ id: slot.id }], rowCount: 1 };
    }

    if (sql.includes("INSERT INTO bookings")) {
      const booking = {
        id: nextBookingId++,
        slot_id: values[0],
        status: "confirmed",
      };
      bookings.push(booking);
      return { rows: [booking], rowCount: 1 };
    }

    if (sql.includes("SELECT id FROM slots")) {
      const slot = slots.find((item) => item.id === values[0]);
      return { rows: slot ? [{ id: slot.id }] : [], rowCount: slot ? 1 : 0 };
    }

    if (sql.includes("DELETE FROM slots")) {
      const index = slots.findIndex(
        (slot) => slot.id === values[0] && !slot.is_booked
      );
      if (index === -1) return { rows: [], rowCount: 0 };
      const [slot] = slots.splice(index, 1);
      return { rows: [{ id: slot.id }], rowCount: 1 };
    }

    throw new Error(`Unexpected query: ${sql}`);
  },

  async connect() {
    return {
      query: async (sql, values) => {
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
          return { rows: [], rowCount: 0 };
        }
        return pool.query(sql, values);
      },
      release() {},
    };
  },
};

const dbPath = require.resolve("../db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: pool,
};

const app = require("../app");
let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  delete require.cache[dbPath];
});

test("slot creation rejects invalid dates and non-positive durations", async () => {
  const invalidDate = await fetch(`${baseUrl}/api/slots`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      doctor_name: "Dr. Smith",
      slot_date: "2026-02-30",
      start_time: "09:00",
      end_time: "09:30",
    }),
  });
  assert.equal(invalidDate.status, 400);
  assert.match((await invalidDate.json()).message, /valid date/);

  const invalidDuration = await fetch(`${baseUrl}/api/slots`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      doctor_name: "Dr. Smith",
      slot_date: "2026-10-22",
      start_time: "09:30",
      end_time: "09:30",
    }),
  });
  assert.equal(invalidDuration.status, 400);
  assert.match((await invalidDuration.json()).message, /later than start_time/);
});

test("valid slots can be created, listed, and cancelled", async () => {
  const createdResponse = await fetch(`${baseUrl}/api/slots`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      doctor_name: "  Dr. Jones  ",
      slot_date: "2026-10-23",
      start_time: "10:00",
      end_time: "10:30",
    }),
  });

  assert.equal(createdResponse.status, 201);
  const createdSlot = await createdResponse.json();
  assert.equal(createdSlot.doctor_name, "Dr. Jones");

  const listedResponse = await fetch(`${baseUrl}/api/slots`);
  const listedSlots = await listedResponse.json();
  assert.ok(listedSlots.some((slot) => slot.id === createdSlot.id));

  const cancelledResponse = await fetch(
    `${baseUrl}/api/slots/${createdSlot.id}`,
    { method: "DELETE" }
  );
  assert.equal(cancelledResponse.status, 200);
});

test("only one of two simultaneous booking requests can book a slot", async () => {
  const responses = await Promise.all([
    fetch(`${baseUrl}/api/slots/1/book`, { method: "POST" }),
    fetch(`${baseUrl}/api/slots/1/book`, { method: "POST" }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409]
  );
  assert.equal(bookings.length, 1);

  const cancelResponse = await fetch(`${baseUrl}/api/slots/1`, {
    method: "DELETE",
  });
  assert.equal(cancelResponse.status, 409);
});
