Multi-Component App with Redis, RabbitMQ, and API Gateway

🔧 Project Overview
This project demonstrates a production-style multi-service architecture using Docker Compose. It features:

- ✅ API Gateway with rate limiting
- 🗃️ Redis cache for optimized GET requests
- 📩 RabbitMQ message broker
- 🔁 Lambda-style producers/consumers
- 💾 PostgreSQL database for persistence
- 🌐 RedisInsight UI for Redis monitoring
- 🧩 Frontend with dynamic note-taking interface
- 🔒 HTTPS enabled via Nginx reverse proxy (simulating ALB)

🧱 Architecture

![image](https://github.com/user-attachments/assets/6818708f-b35d-4bb6-b3b4-63b831cb64f1)

| Service         | Port  | Description                                 |
| --------------- | ----- | ------------------------------------------- |
| ALB (Nginx)     | 443   | HTTPS reverse proxy                         |
| Frontend        | —     | Static HTML/JS UI                           |
| API Gateway     | 8081  | Express API + Rate Limit                    |
| Backend API     | 3000  | Express REST API + PostgreSQL + Redis       |
| PostgreSQL      | 5432  | Note storage DB                             |
| Redis           | 6379  | Cache storage                               |
| RedisInsight UI | 8010  | Redis GUI                                   |
| RabbitMQ        | 5672  | Messaging broker                            |
| RabbitMQ Admin  | 15672 | Web-based RabbitMQ management console       |
| Lambda Producer | 3001  | Publishes messages to RabbitMQ              |
| Lambda Consumer | —     | Subscribes to RabbitMQ and triggers backend |

🛠️ Prerequisites
Docker + Docker Compose

Ports 3000, 8081, 8010, 15672, etc. must be free

 Features
- 🔁 Auto-invalidate cache on Create/Update/Delete
- 🧪 Redis TTL caching for GETs
- 📦 Background processing via RabbitMQ
- 🛡️ Rate-limiting via express-rate-limit
- 🔍 Real-time Redis inspection with RedisInsight

⚙️ How It Works
- Users access the frontend via a secure Nginx reverse proxy (simulating ALB).
- All API requests pass through the API Gateway, which applies rate limiting and routes traffic to the correct service.
- GET requests are cached in Redis to improve performance and reduce database load.
- The backend connects to PostgreSQL for full CRUD operations and manages Redis cache invalidation on data changes.
- For asynchronous tasks, the Lambda Producer sends messages to RabbitMQ, which are processed by the Lambda Consumer and forwarded to the backend.
- RedisInsight provides a visual interface to monitor keys, values, and TTLs in Redis in real time.

🔐 Security Notes
- API Gateway uses CORS headers to restrict frontend origin.
- Rate limiting prevents abuse of the /submit route.
- Database accepts requests only from backend (internal network).

📌 Notes
- Messages from lambda-producer go through RabbitMQ and are handled by lambda-consumer, triggering POST /process.
- RedisInsight is auto-connected to your Redis container.
- PostgreSQL data is stored in the pgdata volume.

🧠 Future Improvements
- Add authentication using Amazon Cognito or Auth0
- Use TLS for RabbitMQ and backend APIs
- Container orchestration with Kubernetes or ECS
 - Observability via Prometheus + Grafana
   
🧑‍💻 Author
Created by John Christopher M. Carrillo as part of a hands-on POC for modern distributed system design using Node.js, Docker, and RabbitMQ.

