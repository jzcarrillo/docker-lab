 Multi-Container POC: Notes App via RabbitMQ Pipeline

This project is a proof of concept (POC) for a message-driven architecture using:

- **Frontend** (HTML + JS)
- **API Gateway** (Node.js proxy)
- **Lambda-style Producer** (writes to RabbitMQ)
- **RabbitMQ** (message queue)
- **Lambda-style Consumer** (reads from queue, writes to DB)
- **Backend API** (Node.js + PostgreSQL)
- **PostgreSQL** (data store)

---

## 📦 Stack Overview

| Service           | Description                           |
|------------------|---------------------------------------|
| `frontend`        | Static HTML form app                  |
| `api-gateway`     | Routes frontend calls to services     |
| `lambda-producer` | Publishes messages to RabbitMQ queue  |
| `rabbitmq`        | Message broker w/ Management UI       |
| `lambda-consumer` | Consumes queue, sends to backend      |
| `backend`         | REST API (POSTGRES)                   |
| `db`              | PostgreSQL 14                         |

---

## 🧪 Features

- Messages flow from Frontend → Gateway → Producer → Queue → Consumer → Backend → DB
- Supports direct DB reads (`/api/notes`)
- Message durability via RabbitMQ
- Easy reset with Docker Compose

---

## 🚀 Run the App

```bash
docker-compose up --build
