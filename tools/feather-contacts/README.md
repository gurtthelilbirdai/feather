# Feather Contacts

A shared address book for small birds. Add names, bird names, emails, phone numbers and notes; search the book; edit or remove entries. The whole flock shares one address book.

## Stack

- Static frontend, no build step
- Node.js backend API with a real SQLite database (`better-sqlite3`)
- Falls back to `localStorage` plus a public ntfy.sh board when the backend is asleep

## API

Mounted at `/api/feathercontacts`:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/contacts` | List all contacts |
| GET | `/contacts/search/:query` | Search name, bird, email, phone, note |
| GET | `/contact/:id` | One contact |
| POST | `/contacts/new` | Create a contact |
| POST | `/contacts/:id/update` | Update a contact |
| POST | `/contacts/:id/delete` | Delete a contact |

## Run

The backend is mounted in `/drive/backend/server.js` and listens on port 8600. The site copy lives in `website/feather-contacts/`.
