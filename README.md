# Clinic Appointment Booking API

A backend REST API built using **Node.js, Express.js, and PostgreSQL** to manage clinic appointment slots and bookings. The API supports slot creation, availability checking, booking, and cancellation while preventing double-booking.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- node-postgres (`pg`)
- dotenv
- Automated testing

## Project Structure

```text
clinic-booking-api/
├── routes/
│   ├── slot.js
│   └── booking.js
├── test/
├── app.js
├── server.js
├── db.js
├── test-db.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Features

- Create appointment slots for doctors.
- Retrieve all available slots.
- Book an available appointment slot.
- Cancel an existing booking.
- Cancel an unbooked appointment slot.
- Validate request parameters and input data.
- Prevent double-booking using database transactions and constraints.
- Store booking status and cancellation timestamps.
- Return appropriate HTTP status codes and error messages.

## Prerequisites

Install the following before running the project:

- Node.js and npm
- PostgreSQL
- Postman (optional, for API testing)

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <your-repository-folder>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=clinic_booking
DB_PASSWORD=your_postgres_password
DB_PORT=5432
```

Replace the database credentials with your own values.

### 4. Set up the database

Create a PostgreSQL database named `clinic_booking`, then execute the SQL schema for the `slots` and `bookings` tables.

The database uses a unique partial index on `bookings.slot_id` for confirmed bookings to prevent multiple active bookings for the same slot.

### 5. Start the server

```bash
node server.js
```

The API will run at:

`http://localhost:5000`

## API Endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check API status |
| POST | `/api/slots` | Create an appointment slot |
| GET | `/api/slots` | List available slots |
| POST | `/api/slots/:id/book` | Book an appointment slot |
| DELETE | `/api/slots/:id` | Cancel an unbooked slot |
| DELETE | `/api/bookings/:id` | Cancel an existing booking |

## Example API Requests

### Create a slot

**POST** `/api/slots`

```json
{
  "doctor_name": "Dr. Sharma",
  "slot_date": "2026-10-26",
  "start_time": "11:00",
  "end_time": "11:30"
}
```

### View available slots

**GET** `/api/slots`

Returns available appointment slots ordered by date and start time.

### Book a slot

**POST** `/api/slots/1/book`

Replace `1` with the actual slot ID.

### Cancel a booking

**DELETE** `/api/bookings/1`

Replace `1` with the actual booking ID. The booking is marked as cancelled, and the slot becomes available again.

### Cancel an unbooked slot

**DELETE** `/api/slots/1`

A slot that is already booked cannot be cancelled through this endpoint.

## Concurrency and Data Integrity

The booking operation uses a database transaction and an atomic update to ensure that only one request can successfully book an available slot.

A PostgreSQL partial unique index provides an additional database-level safeguard against duplicate active bookings.

## Testing

The repository includes a `test/` directory and a `test-db.js` file for testing-related code.

Install dependencies and run the test command configured in `package.json`. Ensure the test database is configured separately from the development database before running database tests.

Recommended test scenarios include:

- Creating a valid slot.
- Rejecting invalid slot details.
- Booking an available slot.
- Rejecting a second booking for the same slot.
- Cancelling a booking and making the slot available again.
- Rejecting repeated booking cancellations.
- Sending simultaneous booking requests and verifying that only one succeeds.

## Future Improvements

- Add authentication and role-based authorization.
- Prevent overlapping appointment times for the same doctor.
- Add pagination and date-based filtering.
- Provide interactive API documentation using Swagger.

## Author

**Dhruv Gupta**
