# 🧪 Multi-Component POC: Event-Driven Architecture with Rate-Limited API Gateway

This project is a proof-of-concept (POC) demonstrating an event-driven, containerized microservices architecture using Docker. It simulates a production-like environment from frontend to database, with asynchronous communication through RabbitMQ and API throttling at the gateway level.

---

## 📌 Architecture Overview

ALB (HTTPS)
⬇
Frontend (HTML/JS)
⬇
API Gateway (Node.js + express-rate-limit)
⬇
Lambda Producer (Node.js)
⬇
RabbitMQ (Message Broker)
⬇
Lambda Consumer (Node.js)
⬇
Backend API (Express + PostgreSQL)
⬇
PostgreSQL (Database)


---

## 🧱 Stack Components

| Layer            | Technology            | Description |
|------------------|------------------------|-------------|
| **Frontend**     | HTML + JavaScript      | Displays form and list of notes. Sends user input to `/submit`. |
| **API Gateway**  | Node.js + Express + `http-proxy-middleware` + `express-rate-limit` | Forwards traffic to either `/submit` or `/api/notes`, with request throttling. |
| **Lambda Producer** | Node.js + AMQP       | Pushes message to RabbitMQ queue from API Gateway. |
| **RabbitMQ**     | RabbitMQ (Docker)      | Message broker for decoupling producer and consumer. |
| **Lambda Consumer** | Node.js + AMQP + Axios | Pulls messages from the queue and calls the backend `/process` endpoint. |
| **Backend**      | Node.js + Express + PostgreSQL | Provides REST API for notes and processes incoming messages. |
| **Database**     | PostgreSQL             | Stores note records. |

---

## ✨ Features

- ✅ **Create, Read, Update, Delete** (CRUD) notes
- ✅ **Asynchronous messaging** with RabbitMQ
- ✅ **Rate limiting**: Max 20 requests/minute to `/submit` route
- ✅ **CORS-enabled API Gateway** for secure cross-origin requests
- ✅ **Fully Dockerized**, runnable with `docker-compose`
- ✅ **Health checks** for backend and gateway

---

## 🚀 How It Works

1. **User submits a note** via the frontend.
2. **Frontend hits `/submit`** endpoint exposed by the API Gateway.
3. **API Gateway forwards** the request to the Lambda Producer, applying rate limiting (20 req/min).
4. **Lambda Producer sends the message** to RabbitMQ queue `notes`.
5. **Lambda Consumer listens** to the queue, then forwards the message to the backend `/process` endpoint.
6. **Backend saves** the note to PostgreSQL.
7. **Frontend reloads** and fetches the updated list from `/api/notes`.

---

![image](https://github.com/user-attachments/assets/54fb269f-f237-4d6e-b41d-3c445b3c8804)


🔐 Security Notes
- API Gateway uses CORS headers to restrict frontend origin.
- Rate limiting prevents abuse of the /submit route.
- Database accepts requests only from backend (internal network).

🧠 Future Improvements
- Add authentication using Amazon Cognito or Auth0
- Use TLS for RabbitMQ and backend APIs
- Container orchestration with Kubernetes or ECS
- Observability via Prometheus + Grafana

🧑‍💻 Author
Created by John Christopher M. Carrillo as part of a hands-on POC for modern distributed system design using Node.js, Docker, and RabbitMQ.



